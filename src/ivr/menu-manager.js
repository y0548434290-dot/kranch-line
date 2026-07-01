const ExtensionManager = require('./extension-manager');

/**
 * מודול MenuManager - ניהול תפריטי IVR
 * אחראי על יצירה ועדכון תפריטים דינמיים
 */
class MenuManager {
    constructor(extensionManager) {
        this.extensionManager = extensionManager;
    }

    /**
     * יצירת תפריט הזמנה
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} orderData - נתוני ההזמנה
     */
    async createOrderMenu(extensionNumber, orderData) {
        const menuConfig = {
            type: 'menu',
            title: `הזמנה ${orderData.id}`,
            message: this.generateOrderMessage(orderData),
            option1: 'אישור הזמנה',
            option1_action: 'confirm_order',
            option2: 'ביטול הזמנה',
            option2_action: 'cancel_order',
            option3: 'שינוי הזמנה',
            option3_action: 'modify_order',
            timeout: 30,
            max_attempts: 3,
            invalid_option_message: 'אפשרות לא תקינה. אנא נסה שוב.',
            timeout_message: 'זמן ההמתנה פג. מתנתק.'
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט בחירת מוצרים
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Array} products - רשימת מוצרים
     */
    async createProductSelectionMenu(extensionNumber, products) {
        const menuConfig = {
            type: 'menu',
            title: 'בחירת מוצרים',
            message: 'אנא בחר מוצר:',
            timeout: 30,
            max_attempts: 3
        };

        // הוספת אפשרויות למוצרים
        products.forEach((product, index) => {
            const optionNumber = index + 1;
            menuConfig[`option${optionNumber}`] = product.name;
            menuConfig[`option${optionNumber}_action`] = `select_product_${product.id}`;
        });

        // אפשרות חזרה
        const backOption = products.length + 1;
        menuConfig[`option${backOption}`] = 'חזרה לתפריט ראשי';
        menuConfig[`option${backOption}_action`] = 'back_to_main';

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט בחירת כמות
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} product - המוצר הנבחר
     */
    async createQuantityMenu(extensionNumber, product) {
        const menuConfig = {
            type: 'menu',
            title: `כמות ל${product.name}`,
            message: `כמה ${product.name} ברצונך להזמין?`,
            option1: '1',
            option1_action: 'quantity_1',
            option2: '2',
            option2_action: 'quantity_2',
            option3: '3',
            option3_action: 'quantity_3',
            option4: '4',
            option4_action: 'quantity_4',
            option5: '5 ומעלה - לחץ 5',
            option5_action: 'quantity_custom',
            timeout: 30,
            max_attempts: 3
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט בחירת עיר/מוקד
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Array} locations - רשימת ערים/מוקדים
     */
    async createLocationMenu(extensionNumber, locations) {
        const menuConfig = {
            type: 'menu',
            title: 'בחירת עיר/מוקד',
            message: 'אנא בחר עיר או מוקד:',
            timeout: 30,
            max_attempts: 3
        };

        locations.forEach((location, index) => {
            const optionNumber = index + 1;
            menuConfig[`option${optionNumber}`] = location.name;
            menuConfig[`option${optionNumber}_action`] = `select_location_${location.id}`;
        });

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט הקלטת שם
     * @param {string} extensionNumber - מספר השלוחה
     */
    async createNameRecordingMenu(extensionNumber) {
        const menuConfig = {
            type: 'record',
            title: 'הקלטת שם',
            message: 'אנא הקלט את שמך בעברית אחרי הצפצוף',
            beep: 'yes',
            max_length: 10,
            silence_timeout: 3,
            record_action: 'save_name_hebrew',
            next_menu: 'english_name_menu'
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט הקלטת שם אנגלי (אופציונלי)
     * @param {string} extensionNumber - מספר השלוחה
     */
    async createEnglishNameMenu(extensionNumber) {
        const menuConfig = {
            type: 'menu',
            title: 'שם אנגלי',
            message: 'האם ברצונך להקליט שם באנגלית?',
            option1: 'כן',
            option1_action: 'record_english_name',
            option2: 'לא - המשך',
            option2_action: 'skip_english_name',
            timeout: 30,
            max_attempts: 3
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט סיכום הזמנה
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} orderSummary - סיכום ההזמנה
     */
    async createOrderSummaryMenu(extensionNumber, orderSummary) {
        const summaryMessage = this.generateOrderSummaryMessage(orderSummary);

        const menuConfig = {
            type: 'menu',
            title: 'סיכום הזמנה',
            message: summaryMessage,
            option1: 'אישור ושליחה',
            option1_action: 'confirm_and_send',
            option2: 'ביטול',
            option2_action: 'cancel_order',
            option3: 'שינוי',
            option3_action: 'modify_order',
            timeout: 30,
            max_attempts: 3
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת תפריט מעקב הזמנה
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} orderStatus - סטטוס ההזמנה
     */
    async createOrderTrackingMenu(extensionNumber, orderStatus) {
        const statusMessage = this.generateStatusMessage(orderStatus);

        const menuConfig = {
            type: 'menu',
            title: 'מעקב הזמנה',
            message: statusMessage,
            option1: 'שמיעת סטטוס נוסף',
            option1_action: 'repeat_status',
            option2: 'יצירת קשר עם שירות לקוחות',
            option2_action: 'contact_support',
            timeout: 30,
            max_attempts: 3
        };

        return await this.extensionManager.updateExtension(extensionNumber, menuConfig);
    }

    /**
     * יצירת הודעת הזמנה
     * @param {Object} orderData - נתוני ההזמנה
     */
    generateOrderMessage(orderData) {
        return `שלום ${orderData.customerName || 'לקוח יקר'}. 
ברוכים הבאים למערכת ההזמנות שלנו.
הזמנה מספר ${orderData.id}.
לחץ 1 לאישור, 2 לביטול, 3 לשינוי.`;
    }

    /**
     * יצירת הודעת סיכום הזמנה
     * @param {Object} orderSummary - סיכום ההזמנה
     */
    generateOrderSummaryMessage(orderSummary) {
        let message = 'סיכום ההזמנה:\n';

        orderSummary.items.forEach((item, index) => {
            message += `${index + 1}. ${item.productName} - ${item.quantity} יחידות\n`;
        });

        message += `סה"כ: ${orderSummary.total} ש"ח\n`;
        message += `עיר: ${orderSummary.location}\n`;
        message += 'לחץ 1 לאישור, 2 לביטול, 3 לשינוי.';

        return message;
    }

    /**
     * יצירת הודעת סטטוס
     * @param {Object} orderStatus - סטטוס ההזמנה
     */
    generateStatusMessage(orderStatus) {
        const statusTexts = {
            pending: 'ממתינה לאישור',
            confirmed: 'אושרה ובהכנה',
            processing: 'בהכנה',
            completed: 'הושלמה',
            cancelled: 'בוטלה'
        };

        return `סטטוס ההזמנה: ${statusTexts[orderStatus.status] || 'לא ידוע'}
תאריך: ${orderStatus.date}
מספר הזמנה: ${orderStatus.id}`;
    }

    /**
     * עדכון תפריט דינמי
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} updates - עדכונים לתפריט
     */
    async updateMenu(extensionNumber, updates) {
        return await this.extensionManager.updateExtension(extensionNumber, updates);
    }

    /**
     * קבלת תצורת תפריט
     * @param {string} extensionNumber - מספר השלוחה
     */
    async getMenuConfig(extensionNumber) {
        const structure = await this.extensionManager.getExtensionStructure(extensionNumber);
        // ניתוח מבנה התפריט מקובץ ext.ini
        return structure;
    }
}

module.exports = MenuManager;