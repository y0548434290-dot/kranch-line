// תיקון מספר אישור + הוספת שלבי שם אישי וגופן בעברית
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `הוספת-שם-וגופן-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/3/1/1',   note: 'תיקון: say_approval_number' },
    { path: '0/3/1/3',   note: 'תיקון: say_approval_number' },
    { path: '0/3/1/4',   note: 'תיקון: say_approval_number' },
    { path: '0/3/1/5',   note: 'תיקון: say_approval_number + end_goto לשם אישי' },
    { path: '0/3/1/6',   note: 'חדש: תפריט "רוצה עטיפה עם שם אישי?"' },
    { path: '0/3/1/6/1', note: 'חדש: רידיירקט (כן) ל-/0/3/1/7' },
    { path: '0/3/1/6/2', note: 'חדש: רידיירקט (לא) ל-/0/3/1/9' },
    { path: '0/3/1/7',   note: 'חדש: recording_and_entering_data - הקלטת שם בעברית' },
    { path: '0/3/1/8',   note: 'חדש: recording_and_entering_data - בחירת גופן' },
    { path: '0/3/1/9',   note: 'חדש: הודעת סיום זמנית' }
];

const extraFiles = [
    { extPath: '0/3/1/7', filename: '000.tts', note: 'TTS: איות שם בעברית' },
    { extPath: '0/3/1/8', filename: '050.tts', note: 'TTS: בחירת גופן' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון מספר אישור + הוספת שלבי שם אישי + גופן');
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
                const createRes = await wrapper.createExtension(`/${ext.path}`);
                log(`  UpdateExtension → ${createRes.message}`);
            } catch (e) {
                log(`  ⚠ ${e.message}`);
            }

            try {
                const uploadRes = await wrapper.uploadTextFile(`${ext.path}/ext.ini`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
            } catch (e) {
                log(`  ✗ העלאה: ${e.message}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'upload-failed' });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                results.push({ path: `${ext.path}/ext.ini`, status: 'verify-failed' });
            }
        }

        log('');
        log('═══════════════════════════════════════════════════════════');
        log('העלאת קבצי .tts');
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

            try {
                const uploadRes = await wrapper.uploadTextFile(`${file.extPath}/${file.filename}`, contents);
                log(`  UploadTextFile → ${uploadRes.message}`);
                const verify = await wrapper.getTextFile(`${file.extPath}/${file.filename}`);
                log(`  ✓ אומת: size=${verify?.file?.size}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                log(`  ✗ ${e.message}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'failed' });
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
        log(`✅ הצליחו: ${okCount}/${results.length}`);
    } catch (error) {
        log(`❌ ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
