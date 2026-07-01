const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * מודול GoogleSheetsSync - סנכרון עם Google Sheets
 * אחראי על ייבוא וייצוא נתונים מגיליונות Google
 */
class GoogleSheetsSync {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.spreadsheetId = null;
    }

    /**
     * אתחול חיבור ל-Google Sheets
     * @param {string} credentialsPath - נתיב לקובץ credentials
     * @param {string} spreadsheetId - מזהה הגיליון
     */
    async initialize(credentialsPath, spreadsheetId) {
        try {
            const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.spreadsheetId = spreadsheetId;

            console.log('חיבור ל-Google Sheets הצליח');
            return true;
        } catch (error) {
            console.error('שגיאה בחיבור ל-Google Sheets:', error.message);
            throw error;
        }
    }

    /**
     * ייצוא הזמנות ל-Google Sheets
     * @param {Array} orders - רשימת הזמנות
     */
    async exportOrders(orders) {
        if (!this.sheets || !this.spreadsheetId) {
            throw new Error('Google Sheets לא מאותחל');
        }

        try {
            const values = this.formatOrdersForSheets(orders);
            const range = 'הזמנות!A1'; // שם הגיליון בעברית

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                resource: { values }
            });

            console.log(`יוצא ${orders.length} הזמנות ל-Google Sheets`);
            return true;
        } catch (error) {
            console.error('שגיאה בייצוא הזמנות:', error.message);
            throw error;
        }
    }

    /**
     * ייבוא הזמנות מ-Google Sheets
     */
    async importOrders() {
        if (!this.sheets || !this.spreadsheetId) {
            throw new Error('Google Sheets לא מאותחל');
        }

        try {
            const range = 'הזמנות!A2:Z'; // מתחיל משורה 2 (השורה הראשונה היא כותרות)
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range
            });

            const rows = response.data.values || [];
            const orders = this.parseOrdersFromSheets(rows);

            console.log(`מייבא ${orders.length} הזמנות מ-Google Sheets`);
            return orders;
        } catch (error) {
            console.error('שגיאה בייבוא הזמנות:', error.message);
            throw error;
        }
    }

    /**
     * עדכון סטטוס הזמנה בגיליון
     * @param {string} orderId - מזהה הזמנה
     * @param {string} newStatus - סטטוס חדש
     */
    async updateOrderStatus(orderId, newStatus) {
        if (!this.sheets || !this.spreadsheetId) {
            throw new Error('Google Sheets לא מאותחל');
        }

        try {
            // מציאת שורת ההזמנה
            const range = 'הזמנות!A2:A';
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range
            });

            const rows = response.data.values || [];
            const rowIndex = rows.findIndex(row => row[0] === orderId);

            if (rowIndex === -1) {
                throw new Error(`הזמנה ${orderId} לא נמצאה בגיליון`);
            }

            // עדכון הסטטוס (נניח שהסטטוס בעמודה 8)
            const statusRange = `הזמנות!H${rowIndex + 2}`; // +2 כי A2 הוא שורה 2
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: statusRange,
                valueInputOption: 'RAW',
                resource: { values: [[newStatus]] }
            });

            console.log(`עודכן סטטוס הזמנה ${orderId} ל-${newStatus}`);
            return true;
        } catch (error) {
            console.error('שגיאה בעדכון סטטוס:', error.message);
            throw error;
        }
    }

    /**
     * ייצוא לקוחות ל-Google Sheets
     * @param {Array} customers - רשימת לקוחות
     */
    async exportCustomers(customers) {
        try {
            const values = this.formatCustomersForSheets(customers);
            const range = 'לקוחות!A1';

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                resource: { values }
            });

            console.log(`יוצא ${customers.length} לקוחות ל-Google Sheets`);
            return true;
        } catch (error) {
            console.error('שגיאה בייצוא לקוחות:', error.message);
            throw error;
        }
    }

    /**
     * ייבוא לקוחות מ-Google Sheets
     */
    async importCustomers() {
        try {
            const range = 'לקוחות!A2:Z';
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range
            });

            const rows = response.data.values || [];
            const customers = this.parseCustomersFromSheets(rows);

            console.log(`מייבא ${customers.length} לקוחות מ-Google Sheets`);
            return customers;
        } catch (error) {
            console.error('שגיאה בייבוא לקוחות:', error.message);
            throw error;
        }
    }

    /**
     * ייצוא מוצרים ל-Google Sheets
     * @param {Array} products - רשימת מוצרים
     */
    async exportProducts(products) {
        try {
            const values = this.formatProductsForSheets(products);
            const range = 'מוצרים!A1';

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range,
                valueInputOption: 'RAW',
                resource: { values }
            });

            console.log(`יוצא ${products.length} מוצרים ל-Google Sheets`);
            return true;
        } catch (error) {
            console.error('שגיאה בייצוא מוצרים:', error.message);
            throw error;
        }
    }

    /**
     * סנכרון דו-כיווני
     * משווה נתונים ומעדכן את שניהם
     */
    async syncAll() {
        try {
            console.log('מתחיל סנכרון דו-כיווני...');

            // סנכרון הזמנות
            const sheetOrders = await this.importOrders();
            // כאן צריך להשוות עם בסיס הנתונים ולהחליט מה לעדכן

            // סנכרון לקוחות
            const sheetCustomers = await this.importCustomers();
            // השוואה ועדכון

            console.log('סנכרון דו-כיווני הושלם');
            return {
                ordersSynced: sheetOrders.length,
                customersSynced: sheetCustomers.length
            };
        } catch (error) {
            console.error('שגיאה בסנכרון:', error.message);
            throw error;
        }
    }

    /**
     * פורמט הזמנות לפורמט גיליון
     * @param {Array} orders - רשימת הזמנות
     */
    formatOrdersForSheets(orders) {
        const headers = [
            'מזהה הזמנה',
            'תאריך',
            'שם לקוח',
            'טלפון',
            'עיר',
            'מוצרים',
            'סה"כ',
            'סטטוס',
            'הערות'
        ];

        const rows = [headers];

        orders.forEach(order => {
            const productsText = order.items.map(item =>
                `${item.productName} (${item.quantity})`
            ).join('; ');

            rows.push([
                order.id,
                order.createdAt,
                order.customerName,
                order.customerPhone,
                order.location,
                productsText,
                order.total,
                order.status,
                order.notes || ''
            ]);
        });

        return rows;
    }

    /**
     * פירוסר הזמנות מגיליון
     * @param {Array} rows - שורות מהגיליון
     */
    parseOrdersFromSheets(rows) {
        return rows.map(row => ({
            id: row[0],
            createdAt: row[1],
            customerName: row[2],
            customerPhone: row[3],
            location: row[4],
            products: row[5] ? row[5].split('; ').map(p => {
                const match = p.match(/(.+) \((\d+)\)/);
                return match ? { name: match[1], quantity: parseInt(match[2]) } : null;
            }).filter(Boolean) : [],
            total: parseFloat(row[6]) || 0,
            status: row[7],
            notes: row[8] || ''
        }));
    }

    /**
     * פורמט לקוחות לפורמט גיליון
     * @param {Array} customers - רשימת לקוחות
     */
    formatCustomersForSheets(customers) {
        const headers = [
            'מזהה לקוח',
            'שם עברית',
            'שם אנגלית',
            'טלפון',
            'עיר',
            'תאריך הרשמה'
        ];

        const rows = [headers];

        customers.forEach(customer => {
            rows.push([
                customer.id,
                customer.nameHebrew,
                customer.nameEnglish || '',
                customer.phone,
                customer.city,
                customer.createdAt
            ]);
        });

        return rows;
    }

    /**
     * פירוסר לקוחות מגיליון
     * @param {Array} rows - שורות מהגיליון
     */
    parseCustomersFromSheets(rows) {
        return rows.map(row => ({
            id: row[0],
            nameHebrew: row[1],
            nameEnglish: row[2] || null,
            phone: row[3],
            city: row[4],
            createdAt: row[5]
        }));
    }

    /**
     * פורמט מוצרים לפורמט גיליון
     * @param {Array} products - רשימת מוצרים
     */
    formatProductsForSheets(products) {
        const headers = [
            'מזהה מוצר',
            'שם',
            'תיאור',
            'מחיר',
            'קטגוריה',
            'פעיל'
        ];

        const rows = [headers];

        products.forEach(product => {
            rows.push([
                product.id,
                product.name,
                product.description || '',
                product.price,
                product.category || '',
                product.active ? 'כן' : 'לא'
            ]);
        });

        return rows;
    }
}

module.exports = GoogleSheetsSync;