// הוספת שלוחות אישור אחרי בחירת מוקד + שלוחת "בחירתך נקלטה בהצלחה"
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `העלאת-שלוחות-אישור-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/3/1/2',     note: 'חדש: בחירתך נקלטה בהצלחה + המשך' },
    { path: '0/3/1/1/1',   note: 'עדכון: ירושלים - הוספת ניתוב 1=, 2=' },
    { path: '0/3/1/1/2',   note: 'עדכון: בני ברק - הוספת ניתוב 1=, 2=' },
    { path: '0/3/1/1/1/1', note: 'חדש: אישור אזור בר אילן' },
    { path: '0/3/1/1/1/2', note: 'חדש: אישור אזור רוממה' },
    { path: '0/3/1/1/2/1', note: 'חדש: אישור אזור רבי עקיבא' },
    { path: '0/3/1/1/2/2', note: 'חדש: אישור אזור עזרא' },
    { path: '0/3/1/1/3',   note: 'עדכון: אישור אשדוד רובע ז\'' },
    { path: '0/3/1/1/4',   note: 'עדכון: אישור אלעד' },
    { path: '0/3/1/1/5',   note: 'עדכון: אישור בית שמש רמה ב\'' },
    { path: '0/3/1/1/6',   note: 'עדכון: אישור ביתר עילית' },
    { path: '0/3/1/1/7',   note: 'עדכון: אישור חיפה' },
    { path: '0/3/1/1/8',   note: 'עדכון: אישור מודיעין עילית' }
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
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('יצירת שלוחות אישור מוקד + שלוחת "בחירתך נקלטה בהצלחה"');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(username, password, server);
        log('✓ התחברתי ל-Yemot');

        for (const ext of extensions) {
            log('');
            log(`──────── /${ext.path} — ${ext.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.path.split('/'), 'ext.ini');

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא: ${localFile}`);
                results.push({ path: ext.path, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');
            log(`קובץ מקומי: ${Buffer.byteLength(contents, 'utf8')} bytes`);

            try {
                const createRes = await wrapper.createExtension(`/${ext.path}`);
                log(`  UpdateExtension → ${createRes.message}`);
            } catch (e) {
                log(`  ⚠ ${e.message}`);
            }

            try {
                const uploadRes = await wrapper.uploadTextFile(`${ext.path}/ext.ini`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
            } catch (e) {
                log(`  ✗ העלאה נכשלה: ${e.message}`);
                results.push({ path: ext.path, status: 'upload-failed', error: e.message });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                const remoteSize = verify?.file?.size;
                log(`  ✓ אומת: size=${remoteSize}, mtime=${verify?.file?.mtime}`);
                results.push({ path: ext.path, status: 'ok', size: remoteSize });
            } catch (e) {
                results.push({ path: ext.path, status: 'verify-failed', error: e.message });
            }
        }

        log('');
        log('═══════════════════════════════════════════════════════════');
        log('סיכום:');
        log('═══════════════════════════════════════════════════════════');
        for (const r of results) {
            const icon = r.status === 'ok' ? '✓' : '✗';
            log(`${icon} /${r.path} — ${r.status}${r.size ? ` (${r.size} bytes)` : ''}${r.error ? ` — ${r.error}` : ''}`);
        }
        const okCount = results.filter(r => r.status === 'ok').length;
        log('');
        log(`✅ הצליחו: ${okCount}/${extensions.length}`);
    } catch (error) {
        log(`❌ שגיאה: ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
