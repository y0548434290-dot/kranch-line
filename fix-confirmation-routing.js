// תיקון ניתוב בשלוחות אישור: 1=go_to_folder=/0/3/1/2 (במקום 1=/0/3/1/2)
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-ניתוב-אישור-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    '0/3/1/1/1/1',  // בר אילן
    '0/3/1/1/1/2',  // רוממה
    '0/3/1/1/2/1',  // ר' עקיבא
    '0/3/1/1/2/2',  // עזרא
    '0/3/1/1/3',    // אשדוד
    '0/3/1/1/4',    // אלעד
    '0/3/1/1/5',    // בית שמש
    '0/3/1/1/6',    // ביתר עילית
    '0/3/1/1/7',    // חיפה
    '0/3/1/1/8'     // מודיעין עילית
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון ניתוב בשלוחות אישור: 1=go_to_folder=/0/3/1/2');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        log('✓ התחברתי ל-Yemot');

        for (const extPath of extensions) {
            log('');
            log(`──────── /${extPath} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...extPath.split('/'), 'ext.ini');
            const contents = fs.readFileSync(localFile, 'utf8');

            try {
                const uploadRes = await wrapper.uploadTextFile(`${extPath}/ext.ini`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
                const verify = await wrapper.getTextFile(`${extPath}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}, mtime=${verify?.file?.mtime}`);
                results.push({ path: extPath, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                log(`  ✗ ${e.message}`);
                results.push({ path: extPath, status: 'failed', error: e.message });
            }
        }

        log('');
        log('═══════════════════════════════════════════════════════════');
        log('סיכום:');
        log('═══════════════════════════════════════════════════════════');
        for (const r of results) {
            const icon = r.status === 'ok' ? '✓' : '✗';
            log(`${icon} /${r.path} — ${r.status}${r.size ? ` (${r.size} bytes)` : ''}`);
        }
        const okCount = results.filter(r => r.status === 'ok').length;
        log('');
        log(`✅ הצליחו: ${okCount}/${extensions.length}`);
    } catch (error) {
        log(`❌ ${error.message}`);
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
