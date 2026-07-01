const YemotApiWrapper = require('./ivr/yemot-api-wrapper');
const ExtensionManager = require('./ivr/extension-manager');
const FileManager = require('./ivr/file-manager');
const MenuManager = require('./ivr/menu-manager');
const GoogleSheetsSync = require('./integrations/google-sheets-sync');
const StatusSync = require('./integrations/status-sync');
const winston = require('winston');
require('../env-loader');

/**
 * מודול ראשי של מערכת Yemot Hamashiach
 * מנהל את כל הרכיבים ומספק ממשק אחיד
 */
class YemotSystem {
    constructor() {
        this.yemotApi = null;
        this.extensionManager = null;
        this.fileManager = null;
        this.menuManager = null;
        this.googleSheetsSync = null;
        this.statusSync = null;
        this.database = null;

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/yemot-system.log' })
            ]
        });
    }

    /**
     * אתחול המערכת
     * @param {Object} db - חיבור למסד נתונים
     */
    async initialize(db) {
        try {
            this.database = db;
            this.logger.info('מתחיל אתחול מערכת Yemot...');

            // אתחול Yemot API
            this.yemotApi = new YemotApiWrapper();
            await this.yemotApi.connect(
                process.env.YEMOT_USERNAME,
                process.env.YEMOT_PASSWORD,
                process.env.YEMOT_SERVER
            );

            // אתחול מנהלי רכיבים
            this.extensionManager = new ExtensionManager(this.yemotApi);
            this.fileManager = new FileManager(this.yemotApi);
            this.menuManager = new MenuManager(this.extensionManager);

            // אתחול אינטגרציות
            this.googleSheetsSync = new GoogleSheetsSync();
            await this.googleSheetsSync.initialize(
                process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
                process.env.GOOGLE_SHEETS_SPREADSHEET_ID
            );

            this.statusSync = new StatusSync(
                this.extensionManager,
                this.googleSheetsSync,
                this.database
            );

            this.logger.info('אתחול מערכת Yemot הושלם בהצלחה');
            return true;
        } catch (error) {
            this.logger.error('שגיאה באתחול המערכת:', error.message);
            throw error;
        }
    }

    /**
     * יצירת הזמנה חדשה
     * @param {Object} orderData - נתוני ההזמנה
     */
    async createOrder(orderData) {
        try {
            this.logger.info(`יוצר הזמנה חדשה: ${orderData.id}`);

            // שמירת ההזמנה בבסיס הנתונים
            await this.saveOrderToDatabase(orderData);

            // יצירת שלוחה ב-Yemot
            const extensionResult = await this.extensionManager.createOrderExtension(orderData);

            // יצירת תפריט הזמנה
            await this.menuManager.createOrderMenu(`order_${orderData.id}`, orderData);

            // העלאת קבצי אודיו אם יש
            if (orderData.audioFiles) {
                await this.fileManager.uploadOrderAudioFiles(orderData, orderData.audioFiles);
            }

            // סנכרון עם Google Sheets
            await this.googleSheetsSync.exportOrders([orderData]);

            this.logger.info(`הזמנה ${orderData.id} נוצרה בהצלחה`);
            return {
                orderId: orderData.id,
                extension: extensionResult,
                synced: true
            };
        } catch (error) {
            this.logger.error(`שגיאה ביצירת הזמנה ${orderData.id}:`, error.message);
            throw error;
        }
    }

    /**
     * עדכון סטטוס הזמנה
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     * @param {Object} metadata - מידע נוסף
     */
    async updateOrderStatus(orderId, newStatus, metadata = {}) {
        return await this.statusSync.updateOrderStatus(orderId, newStatus, metadata);
    }

    /**
     * סנכרון מלא
     */
    async fullSync() {
        return await this.statusSync.fullSync();
    }

    /**
     * יצירת לקוח חדש
     * @param {Object} customerData - נתוני הלקוח
     */
    async createCustomer(customerData) {
        try {
            this.logger.info(`יוצר לקוח חדש: ${customerData.phone}`);

            // שמירת הלקוח בבסיס הנתונים
            await this.saveCustomerToDatabase(customerData);

            // סנכרון עם Google Sheets
            await this.googleSheetsSync.exportCustomers([customerData]);

            this.logger.info(`לקוח ${customerData.phone} נוצר בהצלחה`);
            return customerData;
        } catch (error) {
            this.logger.error(`שגיאה ביצירת לקוח ${customerData.phone}:`, error.message);
            throw error;
        }
    }

    /**
     * קבלת סטטוס הזמנה
     * @param {string} orderId - מזהה הזמנה
     */
    async getOrderStatus(orderId) {
        const query = 'SELECT status FROM orders WHERE id = $1';
        const result = await this.database.query(query, [orderId]);
        return result.rows[0]?.status;
    }

    /**
     * יצירת שלוחת מעקב הזמנה
     * @param {string} orderId - מזהה הזמנה
     */
    async createOrderTrackingExtension(orderId) {
        const orderData = await this.getOrderData(orderId);
        const extensionNumber = `track_${orderId}`;

        return await this.extensionManager.createExtension(extensionNumber, {
            type: 'menu',
            whiteList: false // כל אחד יכול לעקוב
        });
    }

    /**
     * שמירת הזמנה בבסיס הנתונים
     * @param {Object} orderData - נתוני ההזמנה
     */
    async saveOrderToDatabase(orderData) {
        const query = `
            INSERT INTO orders (id, customer_id, status, total_amount, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `;
        const values = [
            orderData.id,
            orderData.customerId,
            orderData.status || 'pending',
            orderData.total || 0,
            orderData.notes || ''
        ];

        await this.database.query(query, values);

        // שמירת פריטי הזמנה
        if (orderData.items) {
            for (const item of orderData.items) {
                await this.saveOrderItem(orderData.id, item);
            }
        }
    }

    /**
     * שמירת פריט הזמנה
     * @param {string} orderId - מזהה הזמנה
     * @param {Object} item - פריט ההזמנה
     */
    async saveOrderItem(orderId, item) {
        const query = `
            INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            VALUES ($1, $2, $3, $4)
        `;
        const values = [orderId, item.productId, item.quantity, item.price];

        await this.database.query(query, values);
    }

    /**
     * שמירת לקוח בבסיס הנתונים
     * @param {Object} customerData - נתוני הלקוח
     */
    async saveCustomerToDatabase(customerData) {
        const query = `
            INSERT INTO customers (id, phone, name_hebrew, name_english, city_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `;
        const values = [
            customerData.id,
            customerData.phone,
            customerData.nameHebrew,
            customerData.nameEnglish || null,
            customerData.cityId || null
        ];

        await this.database.query(query, values);
    }

    /**
     * קבלת נתוני הזמנה
     * @param {string} orderId - מזהה הזמנה
     */
    async getOrderData(orderId) {
        const query = `
            SELECT o.*, c.name_hebrew, c.phone, c.name_english
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = $1
        `;
        const result = await this.database.query(query, [orderId]);
        return result.rows[0];
    }

    /**
     * סגירת המערכת
     */
    async shutdown() {
        try {
            if (this.yemotApi) {
                await this.yemotApi.disconnect();
            }
            this.logger.info('מערכת Yemot נסגרה בהצלחה');
        } catch (error) {
            this.logger.error('שגיאה בסגירת המערכת:', error.message);
        }
    }

    /**
     * קבלת סטטיסטיקות המערכת
     */
    async getSystemStats() {
        try {
            const stats = {
                orders: await this.getOrdersCount(),
                customers: await this.getCustomersCount(),
                extensions: await this.getExtensionsCount(),
                lastSync: await this.getLastSyncTime()
            };

            return stats;
        } catch (error) {
            this.logger.error('שגיאה בקבלת סטטיסטיקות:', error.message);
            throw error;
        }
    }

    /**
     * קבלת מספר הזמנות
     */
    async getOrdersCount() {
        const result = await this.database.query('SELECT COUNT(*) as count FROM orders');
        return parseInt(result.rows[0].count);
    }

    /**
     * קבלת מספר לקוחות
     */
    async getCustomersCount() {
        const result = await this.database.query('SELECT COUNT(*) as count FROM customers');
        return parseInt(result.rows[0].count);
    }

    /**
     * קבלת מספר שלוחות (אומדן)
     */
    async getExtensionsCount() {
        // כאן ניתן למנות שלוחות ב-Yemot או לבסיס נתונים
        return 0; // placeholder
    }

    /**
     * קבלת זמן הסנכרון האחרון
     */
    async getLastSyncTime() {
        // ניתן לשמור בטבלת לוגים
        return new Date().toISOString();
    }
}

module.exports = YemotSystem;