// תיקון משך הקלטה (000-option ל-1-60) + הוספת שלבי אנגלית מלאים
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-הקלטה-ואנגלית-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    { path: '0/3/1/7',     note: 'תיקון: 000-option=1-60 (משך הקלטת שם בעברית)' },
    { path: '0/3/1/10',    note: 'תיקון: 000-option=1-60 (משך הקלטת אותיות אנגלית)' },
    { path: '0/3/1/11',    note: 'שינוי: סיום → כמות ספרי אנגלית' },
    { path: '0/3/1/12',    note: 'חדש: כמות מחברות אנגלית' },
    { path: '0/3/1/13',    note: 'חדש: תפריט "רוצה שם על האנגלית?"' },
    { path: '0/3/1/13/1',  note: 'חדש: רידיירקט (כן) ל-/0/3/1/14' },
    { path: '0/3/1/13/2',  note: 'חדש: רידיירקט (לא) ל-/0/3/1/17' },
    { path: '0/3/1/14',    note: 'חדש: תפריט "עברית או אנגלית?"' },
    { path: '0/3/1/14/1',  note: 'חדש: רידיירקט (עברית) ישירות לגופן' },
    { path: '0/3/1/14/2',  note: 'חדש: רידיירקט (אנגלית) להקלטה' },
    { path: '0/3/1/15',    note: 'חדש: הקלטת שם אישי באנגלית' },
    { path: '0/3/1/16',    note: 'חדש: גופן באנגלית' },
    { path: '0/3/1/17',    note: 'חדש: סיום זמני' }
];

const extraFiles = [
    { extPath: '0/3/1/11', filename: '050.tts', note: 'TTS: כמות ספרי אנגלית' },
    { extPath: '0/3/1/12', filename: '050.tts', note: 'TTS: כמות מחברות אנגלית' },
    { extPath: '0/3/1/15', filename: '000.tts', note: 'TTS: איות שם באנגלית' },
    { extPath: '0/3/1/16', filename: '050.tts', note: 'TTS: בחירת גופן באנגלית' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון משך הקלטה + הוספת שלבי אנגלית מלאים');
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
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                log(`  ✗ ${e.message}`);
                results.push({ path: `${ext.path}/ext.ini`, status: 'failed' });
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
