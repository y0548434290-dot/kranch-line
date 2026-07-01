// העלאת תתי-השלוחות 0/1, 0/2 וכל בניהן ל-Yemot
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `העלאת-תתי-שלוחות-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { folder: '0/1',   path: '0/1' },
    { folder: '0/2',   path: '0/2' },
    { folder: '0/1/1', path: '0/1/1' },
    { folder: '0/1/2', path: '0/1/2' },
    { folder: '0/2/1', path: '0/2/1' },
    { folder: '0/2/2', path: '0/2/2' }
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
        log('מתחיל תהליך יצירת והעלאת תתי-שלוחות תחת /0');
        log('═══════════════════════════════════════════════════════════');
        log(`משתמש: ${username} | שרת: ${server}`);

        await wrapper.connect(username, password, server);
        log('✓ התחברתי ל-Yemot');

        for (const ext of extensions) {
            log('');
            log(`──────── שלוחה /${ext.path} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.folder.split('/'), 'ext.ini');

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא קובץ מקומי: ${localFile}`);
                results.push({ path: ext.path, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');
            log(`קובץ מקומי: ${localFile}`);
            log(`תוכן (${Buffer.byteLength(contents, 'utf8')} bytes):`);
            log(contents.split('\n').map(l => '  | ' + l).join('\n'));

            // יצירת השלוחה (אם לא קיימת)
            log(`יוצר/מאמת שלוחה /${ext.path} ...`);
            try {
                const createRes = await wrapper.createExtension(`/${ext.path}`);
                log(`  → תוצאה: ${JSON.stringify(createRes)}`);
            } catch (e) {
                log(`  ⚠ שגיאה ביצירת שלוחה: ${e.message}`);
            }

            // העלאת ext.ini
            const remotePath = `${ext.path}/ext.ini`;
            log(`מעלה ${remotePath} ...`);
            try {
                const uploadRes = await wrapper.uploadTextFile(remotePath, contents);
                log(`  → ${JSON.stringify(uploadRes)}`);
            } catch (e) {
                log(`  ✗ שגיאה בהעלאה: ${e.message}`);
                results.push({ path: ext.path, status: 'upload-failed', error: e.message });
                continue;
            }

            // אימות שהקובץ נשמר
            try {
                const verify = await wrapper.getTextFile(remotePath);
                const remoteSize = verify?.file?.size;
                log(`  ✓ אומת: size=${remoteSize}, mtime=${verify?.file?.mtime}`);
                results.push({ path: ext.path, status: 'ok', size: remoteSize });
            } catch (e) {
                log(`  ⚠ שגיאה באימות: ${e.message}`);
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
