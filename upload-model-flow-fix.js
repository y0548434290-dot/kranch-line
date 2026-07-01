// תיקון 0/3/1/2 - הוספת הוראה למספר הדגם לפני המעבר ל-/0/3/1/3
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-מספר-דגם-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/3/1/2', note: 'הוסיף הוראה למספר הדגם לפני המעבר' },
    { path: '0/3/1/3', note: 'נוקה - recording_and_entering_data עם defaults' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון 0/3/1/2 ו-0/3/1/3 - שלב מספר הדגם');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        log('✓ התחברתי ל-Yemot');

        for (const ext of extensions) {
            log('');
            log(`──────── /${ext.path} — ${ext.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.path.split('/'), 'ext.ini');
            const contents = fs.readFileSync(localFile, 'utf8');

            try {
                const uploadRes = await wrapper.uploadTextFile(`${ext.path}/ext.ini`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}, mtime=${verify?.file?.mtime}`);
                results.push({ path: ext.path, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                log(`  ✗ ${e.message}`);
                results.push({ path: ext.path, status: 'failed' });
            }
        }

        log('');
        log('סיכום:');
        for (const r of results) {
            const icon = r.status === 'ok' ? '✓' : '✗';
            log(`${icon} /${r.path} — ${r.status}${r.size ? ` (${r.size} bytes)` : ''}`);
        }
        log('');
        log('✅ הסתיים');
    } catch (error) {
        log(`❌ ${error.message}`);
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
