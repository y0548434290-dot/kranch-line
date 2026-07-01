const ExtensionManager = require('../ivr/extension-manager');
const GoogleSheetsSync = require('./google-sheets-sync');
const winston = require('winston');

/**
 * מודול StatusSync - סנכרון סטטוסים והזמנות
 * אחראי על עדכון סטטוסים בין המערכת ל-Yemot ול-Google Sheets
 */
class StatusSync {
    constructor(extensionManager, googleSheetsSync, database) {
        this.extensionManager = extensionManager;
        this.googleSheetsSync = googleSheetsSync;
        this.database = database;

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logs/status-sync.log' })
            ]
        });
    }

    /**
     * עדכון סטטוס הזמנה
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     * @param {Object} metadata - מידע נוסף
     */
    async updateOrderStatus(orderId, newStatus, metadata = {}) {
        try {
            this.logger.info(`מעדכן סטטוס הזמנה ${orderId} ל-${newStatus}`);

            // עדכון בבסיס הנתונים
            await this.updateDatabaseStatus(orderId, newStatus, metadata);

            // עדכון ב-Google Sheets
            await this.googleSheetsSync.updateOrderStatus(orderId, newStatus);

            // עדכון ב-Yemot אם נדרש
            await this.updateYemotStatus(orderId, newStatus);

            // לוג היסטוריה
            await this.logStatusChange(orderId, newStatus, metadata);

            // התראות
            await this.sendNotifications(orderId, newStatus);

            this.logger.info(`סטטוס הזמנה ${orderId} עודכן בהצלחה`);
            return true;
        } catch (error) {
            this.logger.error(`שגיאה בעדכון סטטוס הזמנה ${orderId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * עדכון סטטוס בבסיס הנתונים
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     * @param {Object} metadata - מידע נוסף
     */
    async updateDatabaseStatus(orderId, newStatus, metadata) {
        const query = `
            UPDATE orders
            SET status = $1, updated_at = NOW()
            WHERE id = $2
        `;
        const values = [newStatus, orderId];

        await this.database.query(query, values);

        // עדכון טבלת היסטוריה
        const historyQuery = `
            INSERT INTO status_history (order_id, old_status, new_status, changed_by, changed_at)
            SELECT id, status, $2, $3, NOW()
            FROM orders WHERE id = $1
        `;
        await this.database.query(historyQuery, [orderId, newStatus, metadata.changedBy || 'system']);
    }

    /**
     * עדכון סטטוס ב-Yemot
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     */
    async updateYemotStatus(orderId, newStatus) {
        // יצירת שלוחת סטטוס או עדכון קיימת
        const extensionNumber = `status_${orderId}`;

        try {
            const statusMessage = this.getStatusMessage(newStatus);
            const menuConfig = {
                type: 'message',
                title: `סטטוס הזמנה ${orderId}`,
                message: statusMessage,
                hangup_after_play: 'yes'
            };

            await this.extensionManager.updateExtension(extensionNumber, menuConfig);
        } catch (error) {
            // אם השלוחה לא קיימת, ניצור חדשה
            await this.extensionManager.createExtension(extensionNumber, {
                type: 'message',
                whiteList: false
            });
        }
    }

    /**
     * קבלת הודעת סטטוס
     * @param {string} status - סטטוס
     */
    getStatusMessage(status) {
        const messages = {
            pending: 'הזמנתך התקבלה ותעובד בקרוב.',
            confirmed: 'הזמנתך אושרה ותכנס להכנה.',
            processing: 'הזמנתך בהכנה.',
            completed: 'הזמנתך הושלמה בהצלחה.',
            cancelled: 'הזמנתך בוטלה.'
        };

        return messages[status] || 'סטטוס לא ידוע.';
    }

    /**
     * לוג שינוי סטטוס
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     * @param {Object} metadata - מידע נוסף
     */
    async logStatusChange(orderId, newStatus, metadata) {
        this.logger.info(`שינוי סטטוס - הזמנה: ${orderId}, סטטוס חדש: ${newStatus}, משתמש: ${metadata.changedBy || 'system'}`);
    }

    /**
     * שליחת התראות
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     */
    async sendNotifications(orderId, newStatus) {
        // קבלת פרטי ההזמנה
        const order = await this.getOrderDetails(orderId);
        if (!order) return;

        // התראה ללקוח (אם יש דרך)
        if (order.customerPhone) {
            await this.sendCustomerNotification(order, newStatus);
        }

        // התראה למנהלים
        await this.sendAdminNotification(order, newStatus);
    }

    /**
     * קבלת פרטי הזמנה
     * @param {string} orderId - מזהה הזמנה
     */
    async getOrderDetails(orderId) {
        const query = `
            SELECT o.*, c.name_hebrew as customer_name, c.phone as customer_phone
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = $1
        `;
        const result = await this.database.query(query, [orderId]);
        return result.rows[0];
    }

    /**
     * שליחת התראה ללקוח
     * @param {Object} order - פרטי ההזמנה
     * @param {string} newStatus - סטטוס חדש
     */
    async sendCustomerNotification(order, newStatus) {
        // כאן ניתן לשלוח SMS או התראה אחרת
        // לעת עתה, ניצור שלוחת התראה ב-Yemot
        const notificationExtension = `notify_${order.id}_${Date.now()}`;

        const message = `שלום ${order.customer_name}. ${this.getStatusMessage(newStatus)}`;

        await this.extensionManager.createExtension(notificationExtension, {
            type: 'message',
            whiteList: true,
            allowedNumbers: [order.customer_phone]
        });

        // ניתן להתקשר אוטומטית או להשאיר לשלוחה
    }

    /**
     * שליחת התראה למנהלים
     * @param {Object} order - פרטי ההזמנה
     * @param {string} newStatus - סטטוס חדש
     */
    async sendAdminNotification(order, newStatus) {
        // לוג למנהלים
        this.logger.info(`התראה למנהלים - הזמנה ${order.id} עברה ל-${newStatus}`);

        // ניתן להוסיף email, SMS, או התראות אחרות
    }

    /**
     * סנכרון סטטוסים עם Google Sheets
     */
    async syncWithSheets() {
        try {
            this.logger.info('מתחיל סנכרון סטטוסים עם Google Sheets');

            // ייבוא הזמנות מ-Google Sheets
            const sheetOrders = await this.googleSheetsSync.importOrders();

            // השוואת סטטוסים ועדכון
            for (const sheetOrder of sheetOrders) {
                const dbOrder = await this.getOrderDetails(sheetOrder.id);
                if (dbOrder && dbOrder.status !== sheetOrder.status) {
                    await this.updateOrderStatus(sheetOrder.id, sheetOrder.status, {
                        changedBy: 'sheets_sync',
                        source: 'google_sheets'
                    });
                }
            }

            this.logger.info('סנכרון סטטוסים עם Google Sheets הושלם');
        } catch (error) {
            this.logger.error('שגיאה בסנכרון עם Google Sheets:', error.message);
            throw error;
        }
    }

    /**
     * סנכרון הזמנות עם Yemot
     */
    async syncWithYemot() {
        try {
            this.logger.info('מתחיל סנכרון הזמנות עם Yemot');

            // קבלת כל ההזמנות הפעילות
            const activeOrders = await this.getActiveOrders();

            // יצירה/עדכון שלוחות ב-Yemot
            for (const order of activeOrders) {
                await this.extensionManager.createOrderExtension(order);
            }

            this.logger.info('סנכרון הזמנות עם Yemot הושלם');
        } catch (error) {
            this.logger.error('שגיאה בסנכרון עם Yemot:', error.message);
            throw error;
        }
    }

    /**
     * קבלת הזמנות פעילות
     */
    async getActiveOrders() {
        const query = `
            SELECT o.*, c.name_hebrew, c.phone
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.status IN ('pending', 'confirmed', 'processing')
            ORDER BY o.created_at DESC
        `;
        const result = await this.database.query(query);
        return result.rows;
    }

    /**
     * סנכרון מלא
     */
    async fullSync() {
        try {
            this.logger.info('מתחיל סנכרון מלא');

            await this.syncWithSheets();
            await this.syncWithYemot();

            // ייצוא נתונים מעודכנים
            await this.exportAllData();

            this.logger.info('סנכרון מלא הושלם');
        } catch (error) {
            this.logger.error('שגיאה בסנכרון מלא:', error.message);
            throw error;
        }
    }

    /**
     * ייצוא כל הנתונים
     */
    async exportAllData() {
        const orders = await this.getAllOrders();
        const customers = await this.getAllCustomers();

        await this.googleSheetsSync.exportOrders(orders);
        await this.googleSheetsSync.exportCustomers(customers);
    }

    /**
     * קבלת כל ההזמנות
     */
    async getAllOrders() {
        const query = `
            SELECT
                o.id,
                o.created_at,
                c.name_hebrew as customer_name,
                c.phone as customer_phone,
                ci.name as location,
                o.total_amount,
                o.status,
                o.notes
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN cities ci ON c.city_id = ci.id
            ORDER BY o.created_at DESC
        `;
        const result = await this.database.query(query);
        return result.rows;
    }

    /**
     * קבלת כל הלקוחות
     */
    async getAllCustomers() {
        const query = `
            SELECT
                id,
                name_hebrew,
                name_english,
                phone,
                city_id,
                created_at
            FROM customers
            ORDER BY created_at DESC
        `;
        const result = await this.database.query(query);
        return result.rows;
    }
}

module.exports = StatusSync;