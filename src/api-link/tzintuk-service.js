const { yemotJsonRequest } = require('./yemot-recordings');

// שירות הצנתוקים: סורק את גיליון "הזמנות" לשורות שסומנו בעמודת "שלחי צנתוק",
// שולח צנתוק (RunTzintuk) לטלפון של ההזמנה, ומנהל מפת "הודעות ממתינות" בזיכרון
// שממנה שער הכניסה (/yemot/entry) מזהה לקוח שחוזר לקו.
// המפה בזיכרון בטוחה כי האפליקציה רצה כתהליך יחיד תמידי (Render, instance אחד);
// אחרי restart היא משוחזרת מהגיליון ב-poll הראשון (שורות "נשלח" שטרם "הושמע").

const STATUS_SENT_PREFIX = 'נשלח';
const STATUS_DELIVERED_PREFIX = 'הושמע';
const STATUS_ERROR_PREFIX = 'שגיאה';

class TzintukService {
    constructor(sheets) {
        this.sheets = sheets;
        this.pending = new Map(); // phoneKey -> Set<rowNumber>
        this.inProgress = false;
        this.inFlightRows = new Set();
        // שורות שכבר הושמעו בתהליך הנוכחי — מגן מפני מרוץ שבו poll שקרא את הגיליון
        // לפני שסימון "הושמע" נכתב, מחזיר למפה הודעה שכבר נמסרה.
        this.deliveredRows = new Set();
        this.timer = null;
    }

    // השוואת טלפונים חסינה: ספרות בלבד, בלי קידומת בינלאומית 972 ובלי אפסים מובילים —
    // כך "0548434290", "548434290" ו-"972548434290" מקבלים אותו מפתח.
    normalizePhoneKey(value) {
        return String(value == null ? '' : value)
            .replace(/\D/g, '')
            .replace(/^972/, '')
            .replace(/^0+/, '');
    }

    isChecked(value) {
        return value === true || /^true$/i.test(String(value || '').trim());
    }

    async sendTzintuk(phone) {
        const data = await yemotJsonRequest('RunTzintuk', {
            phones: phone,
            TzintukTimeOut: 16
        });

        if (data.responseStatus !== 'OK') {
            throw new Error(data.message || `RunTzintuk failed with status ${data.responseStatus}`);
        }

        return data;
    }

    addPending(phoneKey, rowNumber) {
        if (!phoneKey || !rowNumber) {
            return;
        }

        if (!this.pending.has(phoneKey)) {
            this.pending.set(phoneKey, new Set());
        }

        this.pending.get(phoneKey).add(rowNumber);
    }

    // השורה הגבוהה ביותר = ההזמנה החדשה ביותר (שורות רק מתווספות בסוף הגיליון).
    getPendingRow(phoneRaw) {
        const phoneKey = this.normalizePhoneKey(phoneRaw);
        if (!phoneKey || !this.pending.has(phoneKey)) {
            return null;
        }

        return Math.max(...this.pending.get(phoneKey));
    }

    async markDelivered(phoneRaw) {
        const phoneKey = this.normalizePhoneKey(phoneRaw);
        const rows = this.pending.get(phoneKey);
        if (!rows) {
            return;
        }

        this.pending.delete(phoneKey);
        const stamp = `${STATUS_DELIVERED_PREFIX} ${nowInIsrael()}`;
        for (const rowNumber of rows) {
            this.deliveredRows.add(rowNumber);
            try {
                await this.sheets.updateOrderCell(rowNumber, 'tzintukStatus', stamp);
            } catch (error) {
                console.error(`[tzintuk] Failed to mark row ${rowNumber} as delivered: ${error.message}`);
            }
        }
    }

    async poll() {
        if (this.inProgress) {
            return;
        }

        this.inProgress = true;
        try {
            const orders = await this.sheets.listOrdersWithRowNumbers();
            const freshPending = new Map();

            for (const order of orders) {
                if (!this.isChecked(order.tzintukRequested)) {
                    continue;
                }

                const rowNumber = order._rowNumber;
                const status = String(order.tzintukStatus || '').trim();
                const phoneKey = this.normalizePhoneKey(order.enteredPhone || order.callerPhone);

                if (status.startsWith(STATUS_DELIVERED_PREFIX) || status.startsWith(STATUS_ERROR_PREFIX)) {
                    continue;
                }

                if (status.startsWith(STATUS_SENT_PREFIX)) {
                    // שחזור המפה אחרי restart — נשלח אך טרם הושמע.
                    if (phoneKey && !this.deliveredRows.has(rowNumber)) {
                        if (!freshPending.has(phoneKey)) {
                            freshPending.set(phoneKey, new Set());
                        }
                        freshPending.get(phoneKey).add(rowNumber);
                    }
                    continue;
                }

                // שורה מסומנת בלי סטטוס — שליחת צנתוק חדשה.
                if (this.inFlightRows.has(rowNumber)) {
                    continue;
                }

                if (!phoneKey || phoneKey.length < 8 || phoneKey.length > 9) {
                    await this.writeStatus(rowNumber, `${STATUS_ERROR_PREFIX}: מספר טלפון לא תקין`);
                    continue;
                }

                this.inFlightRows.add(rowNumber);
                try {
                    const dialPhone = `0${phoneKey}`;
                    await this.sendTzintuk(dialPhone);
                    await this.writeStatus(rowNumber, `${STATUS_SENT_PREFIX} ${nowInIsrael()}`);
                    if (!freshPending.has(phoneKey)) {
                        freshPending.set(phoneKey, new Set());
                    }
                    freshPending.get(phoneKey).add(rowNumber);
                    console.log(`[tzintuk] Sent tzintuk to ${dialPhone} (row ${rowNumber})`);
                } catch (error) {
                    console.error(`[tzintuk] RunTzintuk failed for row ${rowNumber}: ${error.message}`);
                    await this.writeStatus(rowNumber, `${STATUS_ERROR_PREFIX}: ${error.message}`);
                } finally {
                    this.inFlightRows.delete(rowNumber);
                }
            }

            // המפה נבנית מחדש מהגיליון בכל סבב — כך ניקוי ידני של התא בגיליון גם מסיר מהמפה.
            this.pending = freshPending;
        } finally {
            this.inProgress = false;
        }
    }

    async writeStatus(rowNumber, value) {
        try {
            await this.sheets.updateOrderCell(rowNumber, 'tzintukStatus', value);
        } catch (error) {
            console.error(`[tzintuk] Failed to write status for row ${rowNumber}: ${error.message}`);
        }
    }

    start(intervalMs = 40000) {
        if (this.timer) {
            return;
        }

        this.poll().catch((error) => {
            console.error(`[tzintuk] Initial poll failed: ${error.message}`);
        });

        this.timer = setInterval(() => {
            this.poll().catch((error) => {
                console.error(`[tzintuk] Poll failed: ${error.message}`);
            });
        }, intervalMs);

        if (typeof this.timer.unref === 'function') {
            this.timer.unref();
        }

        console.log(`[tzintuk] Sheet poll started (${intervalMs}ms)`);
    }
}

function nowInIsrael() {
    return new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

module.exports = TzintukService;
