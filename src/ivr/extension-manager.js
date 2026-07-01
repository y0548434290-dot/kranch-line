const YemotApiWrapper = require('./yemot-api-wrapper');
const fs = require('fs').promises;
const path = require('path');

/**
 * מודול ExtensionManager - ניהול שלוחות IVR
 * אחראי על יצירה, עדכון ומחיקת שלוחות ב-Yemot
 */
class ExtensionManager {
    constructor(yemotApi) {
        this.yemotApi = yemotApi;
        this.basePath = 'ivr2:/'; // נתיב בסיס ב-Yemot
    }

    /**
     * יצירת שלוחה חדשה
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} config - הגדרות השלוחה
     * @param {string} config.type - סוג השלוחה (menu, message, etc.)
     * @param {boolean} config.whiteList - האם להשתמש ברשימת היתרים
     * @param {Array} config.allowedNumbers - רשימת מספרים מורשים
     */
    async createExtension(extensionNumber, config = {}) {
        const extensionPath = `${this.basePath}${extensionNumber}`;

        return await this.yemotApi.executeOperation(async () => {
            // יצירת השלוחה
            await this.yemotApi.getApi().create_ext(extensionPath, {
                type: config.type || 'menu',
                white_list: config.whiteList ? 'yes' : 'no'
            });

            // יצירת WhiteList.ini אם נדרש
            if (config.whiteList && config.allowedNumbers) {
                const whiteListPath = `${extensionPath}/WhiteList.ini`;
                const whiteListContent = config.allowedNumbers.join('\n');
                await this.yemotApi.getApi().upload_txt_file(whiteListPath, whiteListContent);
            }

            return {
                extensionNumber,
                path: extensionPath,
                created: true
            };
        }, `יצירת שלוחה ${extensionNumber}`);
    }

    /**
     * עדכון הגדרות שלוחה
     * @param {string} extensionNumber - מספר השלוחה
     * @param {Object} updates - עדכונים להגדרות
     */
    async updateExtension(extensionNumber, updates) {
        const extensionPath = `${this.basePath}${extensionNumber}`;

        return await this.yemotApi.executeOperation(async () => {
            // קבלת ext.ini קיים
            let currentConfig = {};
            try {
                const existingIni = await this.yemotApi.getApi().get_text_file(`${extensionPath}/ext.ini`);
                currentConfig = this.parseIni(existingIni);
            } catch (error) {
                // קובץ לא קיים, ניצור חדש
            }

            // מיזוג עם עדכונים
            const newConfig = { ...currentConfig, ...updates };
            const iniContent = this.stringifyIni(newConfig);

            // העלאת ext.ini מעודכן
            await this.yemotApi.getApi().upload_txt_file(`${extensionPath}/ext.ini`, iniContent);

            return {
                extensionNumber,
                updated: true,
                config: newConfig
            };
        }, `עדכון שלוחה ${extensionNumber}`);
    }

    /**
     * מחיקת שלוחה
     * @param {string} extensionNumber - מספר השלוחה
     */
    async deleteExtension(extensionNumber) {
        const extensionPath = `${this.basePath}${extensionNumber}`;

        return await this.yemotApi.executeOperation(async () => {
            await this.yemotApi.getApi().delete([extensionPath]);
            return {
                extensionNumber,
                deleted: true
            };
        }, `מחיקת שלוחה ${extensionNumber}`);
    }

    /**
     * קבלת מבנה שלוחה
     * @param {string} extensionNumber - מספר השלוחה
     */
    async getExtensionStructure(extensionNumber) {
        const extensionPath = `${this.basePath}${extensionNumber}`;

        return await this.yemotApi.executeOperation(async () => {
            const structure = await this.yemotApi.getApi().get_ivr_tree(extensionPath);
            return {
                extensionNumber,
                structure
            };
        }, `קבלת מבנה שלוחה ${extensionNumber}`);
    }

    /**
     * יצירת שלוחה להזמנה
     * @param {Object} orderData - נתוני ההזמנה
     * @param {string} orderData.id - מזהה הזמנה
     * @param {string} orderData.customerPhone - טלפון לקוח
     * @param {Array} orderData.items - פריטי הזמנה
     */
    async createOrderExtension(orderData) {
        const extensionNumber = `order_${orderData.id}`;
        const config = {
            type: 'menu',
            whiteList: true,
            allowedNumbers: [orderData.customerPhone]
        };

        // יצירת השלוחה
        const result = await this.createExtension(extensionNumber, config);

        // יצירת תפריט הזמנה
        const menuConfig = this.generateOrderMenuConfig(orderData);
        await this.updateExtension(extensionNumber, menuConfig);

        return result;
    }

    /**
     * יצירת תצורת תפריט להזמנה
     * @param {Object} orderData - נתוני ההזמנה
     */
    generateOrderMenuConfig(orderData) {
        return {
            title: `הזמנה ${orderData.id}`,
            message: 'ברוכים הבאים למערכת ההזמנות. לחץ 1 לאישור, 2 לביטול',
            option1: 'אישור הזמנה',
            option2: 'ביטול הזמנה',
            timeout: 30,
            max_attempts: 3
        };
    }

    /**
     * פירוסר קובץ INI
     * @param {string} iniContent - תוכן קובץ INI
     */
    parseIni(iniContent) {
        const config = {};
        const lines = iniContent.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        }

        return config;
    }

    /**
     * יצירת מחרוזת INI מתוך אובייקט
     * @param {Object} config - אובייקט תצורה
     */
    stringifyIni(config) {
        const lines = [];
        for (const [key, value] of Object.entries(config)) {
            lines.push(`${key}=${value}`);
        }
        return lines.join('\n');
    }
}

module.exports = ExtensionManager;