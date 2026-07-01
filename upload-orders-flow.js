// העלאת שלב 1 של תהליך ההזמנה: 0/3/1 + 0/3/1/1 (recording_and_entering_data) + ערים + קובצי TTS+CheckGoTo
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `העלאת-תהליך-הזמנה-שלב1-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

// שלוחות שדרושות יצירה/עדכון
const extensions = [
    { path: '0/3/1',     note: 'עדכון: הקדמה להזמנה' },
    { path: '0/3/1/1',   note: 'חדש: recording_and_entering_data - פלאפון/זהות/מוקד' },
    { path: '0/3/1/1/1', note: 'חדש: אזורי ירושלים' },
    { path: '0/3/1/1/2', note: 'חדש: אזורי בני ברק' },
    { path: '0/3/1/1/3', note: 'חדש: אשדוד (placeholder)' },
    { path: '0/3/1/1/4', note: 'חדש: אלעד (placeholder)' },
    { path: '0/3/1/1/5', note: 'חדש: בית שמש (placeholder)' },
    { path: '0/3/1/1/6', note: 'חדש: ביתר עילית (placeholder)' },
    { path: '0/3/1/1/7', note: 'חדש: חיפה (placeholder)' },
    { path: '0/3/1/1/8', note: 'חדש: מודיעין עילית (placeholder)' }
];

// קבצים נוספים בשלוחת 0/3/1/1 (לא ext.ini)
const extraFiles = [
    { extPath: '0/3/1/1', filename: '050-SayTTS.ini', note: 'TTS לפני פלאפון' },
    { extPath: '0/3/1/1', filename: '051-SayTTS.ini', note: 'TTS לפני זהות' },
    { extPath: '0/3/1/1', filename: '052-SayTTS.ini', note: 'TTS לפני בחירת מוקד' },
    { extPath: '0/3/1/1', filename: 'RecordingAndEnteringDataCheckGoTo.ini', note: 'ניתוב מוקד 1-8 → /0/3/1/1/X' }
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
        log('שלב 1 של תהליך ההזמנה: יצירת שלוחות 0/3/1/1 + ערים');
        log('═══════════════════════════════════════════════════════════');
        log(`משתמש: ${username} | שרת: ${server}`);

        await wrapper.connect(username, password, server);
        log('✓ התחברתי ל-Yemot');

        // העלאת ext.ini לכל שלוחה
        for (const ext of extensions) {
            log('');
            log(`──────── /${ext.path} — ${ext.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...ext.path.split('/'), 'ext.ini');

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא קובץ מקומי: ${localFile}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');
            log(`קובץ מקומי: ${localFile} (${Buffer.byteLength(contents, 'utf8')} bytes)`);

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
                results.push({ path: `${ext.path}/ext.ini`, status: 'upload-failed', error: e.message });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                const remoteSize = verify?.file?.size;
                log(`  ✓ אומת: size=${remoteSize}, mtime=${verify?.file?.mtime}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'ok', size: remoteSize });
            } catch (e) {
                results.push({ path: `${ext.path}/ext.ini`, status: 'verify-failed', error: e.message });
            }
        }

        // העלאת הקבצים הנוספים (SayTTS, CheckGoTo)
        log('');
        log('═══════════════════════════════════════════════════════════');
        log('העלאת קבצים נוספים בשלוחה 0/3/1/1');
        log('═══════════════════════════════════════════════════════════');

        for (const file of extraFiles) {
            log('');
            log(`──────── /${file.extPath}/${file.filename} — ${file.note} ────────`);
            const localFile = path.join(__dirname, 'ivr_build', ...file.extPath.split('/'), file.filename);

            if (!fs.existsSync(localFile)) {
                log(`✗ לא נמצא: ${localFile}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'missing-local' });
                continue;
            }

            const contents = fs.readFileSync(localFile, 'utf8');
            log(`קובץ מקומי: ${localFile} (${Buffer.byteLength(contents, 'utf8')} bytes)`);

            try {
                const uploadRes = await wrapper.uploadTextFile(`${file.extPath}/${file.filename}`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
            } catch (e) {
                log(`  ✗ העלאה נכשלה: ${e.message}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'upload-failed', error: e.message });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${file.extPath}/${file.filename}`);
                const remoteSize = verify?.file?.size;
                log(`  ✓ אומת: size=${remoteSize}, mtime=${verify?.file?.mtime}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'ok', size: remoteSize });
            } catch (e) {
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'verify-failed', error: e.message });
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
        log(`✅ הצליחו: ${okCount}/${results.length}`);
    } catch (error) {
        log(`❌ שגיאה כללית: ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
