// תיקון: 1) ניתוב "לא שם אישי" → ספרי אנגלית 2) שיפור סיכום ההזמנה
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-דלוג-שם-ושיפור-סיכום-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/3/1/6/2', note: 'תיקון: לא רוצה שם אישי → ישירות ל-/0/3/1/11 (ספרי אנגלית)' },
    { path: '0/3/1/17',  note: 'שיפור: סיכום מפורט יותר של כל הסעיפים שהוזנו' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון ניתוב + שיפור סיכום ההזמנה');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        log('✓ התחברתי ל-Yemot');

        for (const ext of extensions) {
            log('');
            log(`──────── /${ext.path}/ext.ini — ${ext.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.path.split('/'), 'ext.ini');

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא: ${localFile}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');

            try {
                const uploadRes = await wrapper.uploadTextFile(`${ext.path}/ext.ini`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                log(`  ✗ ${e.message}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'failed' });
            }
        }

        log('');
        log('סיכום:');
        for (const r of results) {
            const icon = r.status === 'ok' ? '✓' : '✗';
            log(`${icon} /${r.path} — ${r.status}${r.size ? ` (${r.size} bytes)` : ''}`);
        }
        const okCount = results.filter(r => r.status === 'ok').length;
        log('');
        log(`✅ הצליחו: ${okCount}/${results.length}`);
    } catch (error) {
        log(`❌ ${error.message}`);
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
