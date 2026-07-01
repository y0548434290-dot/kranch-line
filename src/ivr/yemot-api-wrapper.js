const YemotAPI = require('yemot-api');
const winston = require('winston');

/**
 * מודול YemotAPI - Wrapper סביב ספריית yemot-api
 * מנהל חיבור ל-Yemot ומספק ממשק אחיד
 */
class YemotApiWrapper {
    constructor() {
        this.api = null;
        this.isConnected = false;
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
                new winston.transports.File({ filename: 'logs/yemot-api.log' })
            ]
        });
    }

    /**
     * התחברות ל-Yemot
     * @param {string} username - שם משתמש Yemot
     * @param {string} password - סיסמה
     * @param {string} server - שרת Yemot (ברירת מחדל: ym)
     */
    async connect(username, password, server = 'ym') {
        try {
            this.logger.info('מתחבר ל-Yemot...');
            this.api = new YemotAPI();
            await this.api.connect(username, password);
            this.isConnected = true;
            this.logger.info('החיבור ל-Yemot הצליח');
            return true;
        } catch (error) {
            this.logger.error(`שגיאה בחיבור ל-Yemot: ${error.message}`);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * ביצוע פעולה עם טיפול בשגיאות
     * @param {Function} operation - הפעולה לביצוע
     * @param {string} operationName - שם הפעולה לתיעוד
     */
    async executeOperation(operation, operationName) {
        if (!this.isConnected) {
            throw new Error('לא מחובר ל-Yemot');
        }

        try {
            this.logger.info(`מתחיל ${operationName}...`);
            const result = await operation();
            this.logger.info(`${operationName} הושלם בהצלחה`);
            return result;
        } catch (error) {
            this.logger.error(`שגיאה ב-${operationName}: ${error.message}`);
            throw error;
        }
    }

    async getSession() {
        return this.executeOperation(() => this.api.exec('GetSession'), 'GetSession');
    }

    async createExtension(path) {
        return this.executeOperation(
            () => this.api.exec('UpdateExtension', { path: `ivr2:${path}` }),
            `UpdateExtension ${path}`
        );
    }

    async uploadTextFile(path, contents) {
        return this.executeOperation(
            () => this.api.exec('UploadTextFile', {
                what: `ivr2:/${path}`,
                contents
            }),
            `UploadTextFile ${path}`
        );
    }

    async getTextFile(path) {
        return this.executeOperation(
            () => this.api.exec('GetTextFile', {
                what: `ivr2:/${path}`
            }),
            `GetTextFile ${path}`
        );
    }

    async getIvrTree(path) {
        return this.executeOperation(
            () => this.api.exec('GetIvrTree', {
                path: `ivr2:${path}`
            }),
            `GetIvrTree ${path}`
        );
    }

    async create_ext(path, config = {}) {
        const result = await this.createExtension(path);
        return {
            extensionNumber: path,
            path,
            created: true,
            config
        };
    }

    async upload_txt_file(path, contents) {
        return this.uploadTextFile(path, contents);
    }

    async get_text_file(path) {
        return this.getTextFile(path);
    }

    async get_ivr_tree(path) {
        return this.getIvrTree(path);
    }

    async delete(paths) {
        const body = { action: 'delete' };

        if (Array.isArray(paths)) {
            paths.forEach((path, index) => {
                body[`what${index}`] = `ivr2:${path}`;
            });
        } else {
            body.what = `ivr2:${paths}`;
        }

        return this.executeOperation(() => this.api.exec('FileAction', body), `FileAction delete ${paths}`);
    }

    /**
     * התנתקות מ-Yemot
     */
    async disconnect() {
        if (this.api && this.isConnected) {
            try {
                if (typeof this.api.logout === 'function') {
                    await this.api.logout();
                }
                this.isConnected = false;
                this.logger.info('התנתקות מ-Yemot הצליחה');
            } catch (error) {
                this.logger.error(`שגיאה בהתנתקות: ${error.message}`);
            }
        }
    }

    /**
     * קבלת מופע ה-API
     */
    getApi() {
        return this;
    }
}

module.exports = YemotApiWrapper;