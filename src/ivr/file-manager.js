const YemotApiWrapper = require('./yemot-api-wrapper');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');

/**
 * מודול FileManager - ניהול קבצים ב-Yemot
 * אחראי על העלאה, הורדה וניהול קבצים
 */
class FileManager {
    constructor(yemotApi) {
        this.yemotApi = yemotApi;
        this.basePath = 'ivr2:/';
    }

    /**
     * העלאת קובץ אודיו
     * @param {string} remotePath - נתיב ב-Yemot
     * @param {string} localPath - נתיב מקומי לקובץ
     * @param {number} convertAudio - האם להמיר אודיו (0=לא, 1=כן)
     */
    async uploadAudioFile(remotePath, localPath, convertAudio = 0) {
        return await this.yemotApi.executeOperation(async () => {
            // קריאת הקובץ המקומי
            const fileBuffer = await fs.readFile(localPath);
            const fileName = path.basename(localPath);

            // הכנת אובייקט הקובץ
            const fileObject = {
                value: fileBuffer,
                options: {
                    filename: fileName,
                    contentType: this.getContentType(fileName)
                }
            };

            // העלאה ל-Yemot
            const fullRemotePath = `${this.basePath}${remotePath}`;
            await this.yemotApi.getApi().upload_file(fullRemotePath, fileObject, convertAudio);

            return {
                remotePath: fullRemotePath,
                localPath,
                uploaded: true
            };
        }, `העלאת קובץ אודיו ${remotePath}`);
    }

    /**
     * העלאת קובץ טקסט
     * @param {string} remotePath - נתיב ב-Yemot
     * @param {string} content - תוכן הקובץ
     */
    async uploadTextFile(remotePath, content) {
        return await this.yemotApi.executeOperation(async () => {
            const fullRemotePath = `${this.basePath}${remotePath}`;
            await this.yemotApi.getApi().upload_txt_file(fullRemotePath, content);

            return {
                remotePath: fullRemotePath,
                uploaded: true
            };
        }, `העלאת קובץ טקסט ${remotePath}`);
    }

    /**
     * הורדת קובץ
     * @param {string} remotePath - נתיב ב-Yemot
     * @param {string} localPath - נתיב מקומי לשמירה
     */
    async downloadFile(remotePath, localPath) {
        return await this.yemotApi.executeOperation(async () => {
            const fullRemotePath = `${this.basePath}${remotePath}`;
            const fileData = await this.yemotApi.getApi().download_file(fullRemotePath);

            // שמירה מקומית
            await fs.writeFile(localPath, fileData);

            return {
                remotePath: fullRemotePath,
                localPath,
                downloaded: true
            };
        }, `הורדת קובץ ${remotePath}`);
    }

    /**
     * יצירת קובץ אודיו מותאם אישית להזמנה
     * @param {Object} orderData - נתוני ההזמנה
     * @param {string} templatePath - נתיב לתבנית אודיו
     */
    async createPersonalizedAudio(orderData, templatePath) {
        const audioFileName = `order_${orderData.id}_welcome.wav`;
        const remotePath = `orders/${audioFileName}`;

        // כאן ניתן להשתמש ב-TTS או עריכת אודיו
        // לעת עתה, נעתיק קובץ תבנית
        const result = await this.uploadAudioFile(remotePath, templatePath);

        return {
            ...result,
            audioFileName
        };
    }

    /**
     * העלאת קבצי אודיו מרובים להזמנה
     * @param {Object} orderData - נתוני ההזמנה
     * @param {Array} audioFiles - רשימת קבצי אודיו
     */
    async uploadOrderAudioFiles(orderData, audioFiles) {
        const results = [];

        for (const audioFile of audioFiles) {
            const remotePath = `orders/order_${orderData.id}/${audioFile.name}`;
            const result = await this.uploadAudioFile(remotePath, audioFile.path);
            results.push(result);
        }

        return results;
    }

    /**
     * יצירת מבנה תיקיות להזמנה
     * @param {string} orderId - מזהה הזמנה
     */
    async createOrderDirectory(orderId) {
        // ב-Yemot, תיקיות נוצרות אוטומטית בהעלאת קבצים
        // ניתן ליצור קובץ dummy כדי לוודא יצירת התיקיה
        const dummyPath = `orders/order_${orderId}/.keep`;
        await this.uploadTextFile(dummyPath, '# תיקיית הזמנה');

        return {
            directory: `orders/order_${orderId}`,
            created: true
        };
    }

    /**
     * קבלת סוג תוכן לפי סיומת הקובץ
     * @param {string} fileName - שם הקובץ
     */
    getContentType(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.gsm': 'audio/gsm',
            '.txt': 'text/plain',
            '.ini': 'text/plain'
        };

        return contentTypes[ext] || 'application/octet-stream';
    }

    /**
     * בדיקת קיום קובץ
     * @param {string} remotePath - נתיב ב-Yemot
     */
    async fileExists(remotePath) {
        try {
            await this.yemotApi.getApi().get_text_file(`${this.basePath}${remotePath}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * קבלת רשימת קבצים בתיקיה
     * @param {string} directoryPath - נתיב התיקיה
     */
    async listDirectory(directoryPath) {
        return await this.yemotApi.executeOperation(async () => {
            const fullPath = `${this.basePath}${directoryPath}`;
            const files = await this.yemotApi.getApi().get_ivr_tree(fullPath);
            return files;
        }, `רשימת קבצים בתיקיה ${directoryPath}`);
    }

    /**
     * מחיקת קובץ
     * @param {string} remotePath - נתיב ב-Yemot
     */
    async deleteFile(remotePath) {
        return await this.yemotApi.executeOperation(async () => {
            const fullPath = `${this.basePath}${remotePath}`;
            await this.yemotApi.getApi().delete([fullPath]);
            return {
                remotePath: fullPath,
                deleted: true
            };
        }, `מחיקת קובץ ${remotePath}`);
    }
}

module.exports = FileManager;