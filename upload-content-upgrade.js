// שדרוג תוכן השלוחות 0/1/1, 0/1/2, 0/2/1, 0/2/2 - תוכן סופי + ניתוק אחרי 3 שניות
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `שדרוג-תוכן-שלוחות-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/1/1', note: 'תוכן ברכה + ניתוק 3 שניות' },
    { path: '0/1/2', note: 'רשימת מוקדים מלאה + ניתוק 3 שניות' },
    { path: '0/2/1', note: 'הקראת מייל הפוך + ניתוק 3 שניות' },
    { path: '0/2/2', note: 'תפריט ערים + ניתוק 3 שניות' }
];

(async () => {
    const username = process.env.YEMOT_USERNAME;
    const password = process.env.YEMOT_PASSWORD;
    const server = process.env.YEMOT_SERVER || 'ym';

    if (!username || !password) {
        log('שגיאה: לא נמצאו פרטי התחברות ל-Yemot בקובץ .env');
        process.exit(1);
    }

    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('שדרוג תוכן 4 שלוחות עם תוכן סופי והוספת ניתוק אוטומטי');
        log('═══════════════════════════════════════════════════════════');
        log(`משתמש: ${username} | שרת: ${server}`);

        await wrapper.connect(username, password, server);
        log('✓ התחברתי ל-Yemot');

        for (const ext of extensions) {
            log('');
            log(`──────── /${ext.path} — ${ext.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.path.split('/'), 'ext.ini');

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא קובץ מקומי: ${localFile}`);
                results.push({ path: ext.path, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');
            log(`קובץ מקומי: ${localFile} (${Buffer.byteLength(contents, 'utf8')} bytes)`);

            const preview = contents.split('\n')
                .filter(l => l.trim() && !l.trim().startsWith('#'))
                .map(l => '  | ' + l).join('\n');
            log(`מפתחות:\n${preview}`);

            // קריאת תוכן קיים
            try {
                const existing = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                if (existing?.file?.exists) {
                    log(`  קיים בימות: ${existing.file.size} bytes (${existing.file.mtime}) — יידרס`);
                }
            } catch (_) {}

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
        log(`❌ שגיאה כללית: ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
