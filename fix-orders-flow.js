// תיקון 0/3/1/1: החלפה ל-type=menu פשוט + מחיקת קבצים מיותרים מ-Yemot
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-תהליך-הזמנה-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const filesToDelete = [
    '/0/3/1/1/050-SayTTS.ini',
    '/0/3/1/1/051-SayTTS.ini',
    '/0/3/1/1/052-SayTTS.ini',
    '/0/3/1/1/RecordingAndEnteringDataCheckGoTo.ini'
];

(async () => {
    const username = process.env.YEMOT_USERNAME;
    const password = process.env.YEMOT_PASSWORD;
    const server = process.env.YEMOT_SERVER || 'ym';

    if (!username || !password) {
        log('שגיאה: לא נמצאו פרטי התחברות ל-Yemot');
        process.exit(1);
    }

    const wrapper = new YemotApiWrapper();

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון 0/3/1/1: החלפה לתפריט פשוט + ניקוי קבצים מיותרים');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(username, password, server);
        log('✓ התחברתי ל-Yemot');

        // העלאת ext.ini החדש
        log('');
        log('──────── העלאת ext.ini המתוקן ────────');
        const localFile = path.join(__dirname, 'ivr_build', '0', '3', '1', '1', 'ext.ini');
        const contents = fs.readFileSync(localFile, 'utf8');
        log(`קובץ מקומי: ${localFile} (${Buffer.byteLength(contents, 'utf8')} bytes)`);
        log(`תוכן:`);
        log(contents.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).map(l => '  | ' + l).join('\n'));

        try {
            const uploadRes = await wrapper.uploadTextFile('0/3/1/1/ext.ini', contents);
            log(`  UploadTextFile → ${uploadRes.message}`);
        } catch (e) {
            log(`  ✗ העלאה נכשלה: ${e.message}`);
            process.exit(1);
        }

        try {
            const verify = await wrapper.getTextFile('0/3/1/1/ext.ini');
            log(`  ✓ אומת: size=${verify?.file?.size}, mtime=${verify?.file?.mtime}`);
        } catch (e) {
            log(`  ⚠ אימות נכשל: ${e.message}`);
        }

        // מחיקת הקבצים המיותרים
        log('');
        log('──────── מחיקת קבצי SayTTS ו-CheckGoTo המיותרים ────────');
        for (const filePath of filesToDelete) {
            try {
                const deleteRes = await wrapper.delete(filePath);
                log(`  ✓ נמחק: ${filePath} → ${deleteRes.message || JSON.stringify(deleteRes)}`);
            } catch (e) {
                log(`  ⚠ ${filePath}: ${e.message}`);
            }
        }

        log('');
        log('✅ התיקון הושלם. עכשיו 0/3/1/1 הוא תפריט בחירת מוקד פשוט.');
    } catch (error) {
        log(`❌ שגיאה כללית: ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
