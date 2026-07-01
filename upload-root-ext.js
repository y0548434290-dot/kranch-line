// העלאת ext.ini של שלוחת השורש ל-Yemot
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `העלאת-שלוחת-שורש-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

(async () => {
    const username = process.env.YEMOT_USERNAME;
    const password = process.env.YEMOT_PASSWORD;
    const server = process.env.YEMOT_SERVER || 'ym';

    if (!username || !password) {
        log('שגיאה: לא נמצאו פרטי התחברות ל-Yemot בקובץ .env');
        process.exit(1);
    }

    const wrapper = new YemotApiWrapper();

    try {
        log('מתחיל תהליך העלאת ext.ini לשלוחת השורש /');
        log(`משתמש: ${username} | שרת: ${server}`);

        await wrapper.connect(username, password, server);
        log('התחברתי ל-Yemot בהצלחה');

        const localPath = path.join(__dirname, 'ivr_build', 'ext.ini');
        const contents = fs.readFileSync(localPath, 'utf8');
        log('תוכן ext.ini שיועלה:');
        log('────────────────────────────────────');
        log(contents);
        log('────────────────────────────────────');

        log('מנסה לקרוא את התוכן הקיים בשלוחת השורש (לפני דריסה)...');
        try {
            const existing = await wrapper.getTextFile('ext.ini');
            log(`תוכן קיים: ${JSON.stringify(existing)}`);
        } catch (e) {
            log(`לא נמצא תוכן קיים או שגיאה בקריאה: ${e.message}`);
        }

        log('מעלה את ext.ini לשלוחת השורש...');
        const uploadResult = await wrapper.uploadTextFile('ext.ini', contents);
        log(`תוצאת העלאה: ${JSON.stringify(uploadResult)}`);

        log('בודק שהקובץ נשמר...');
        const verify = await wrapper.getTextFile('ext.ini');
        log(`תוכן לאחר העלאה: ${JSON.stringify(verify)}`);

        log('✅ העלאה הסתיימה בהצלחה - שלוחת השורש מנתבת מיידית ל-/0');
    } catch (error) {
        log(`❌ שגיאה: ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
