// העלאת תהליך ההזמנה המלא לפי האפיון:
// פלאפון + זהות + מוקד (0/3/1/1) → אישור (0/3/1/1/X) → בחירתך נקלטה (0/3/1/2)
// → מספר דגם (0/3/1/3) → ספרים (0/3/1/4) → מחברות (0/3/1/5) → סיום (0/3/1/6)
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `העלאת-תהליך-הזמנה-מלא-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

// קבצי ext.ini לכל שלוחה
const extensions = [
    { path: '0/3/1/1',       note: 'recording_and_entering_data - פלאפון + זהות + מוקד' },
    { path: '0/3/1/1/1',     note: 'תפריט אזורי ירושלים (עודכן)' },
    { path: '0/3/1/1/2',     note: 'תפריט אזורי בני ברק (עודכן)' },
    { path: '0/3/1/1/1/1',   note: 'אישור: ירושלים בר אילן (עודכן)' },
    { path: '0/3/1/1/1/2',   note: 'אישור: ירושלים רוממה (עודכן)' },
    { path: '0/3/1/1/2/1',   note: 'אישור: בני ברק ר\' עקיבא (עודכן)' },
    { path: '0/3/1/1/2/2',   note: 'אישור: בני ברק עזרא (עודכן)' },
    { path: '0/3/1/1/3',     note: 'אישור: אשדוד (עודכן)' },
    { path: '0/3/1/1/4',     note: 'אישור: אלעד (עודכן)' },
    { path: '0/3/1/1/5',     note: 'אישור: בית שמש (עודכן)' },
    { path: '0/3/1/1/6',     note: 'אישור: ביתר עילית (עודכן)' },
    { path: '0/3/1/1/7',     note: 'אישור: חיפה (עודכן)' },
    { path: '0/3/1/1/8',     note: 'אישור: מודיעין עילית (עודכן)' },
    { path: '0/3/1/2',       note: 'בחירתך נקלטה בהצלחה (קוצר)' },
    { path: '0/3/1/3',       note: 'recording_and_entering_data - מספר דגם' },
    { path: '0/3/1/4',       note: 'recording_and_entering_data - כמות ספרים (חדש)' },
    { path: '0/3/1/5',       note: 'recording_and_entering_data - כמות מחברות (חדש)' },
    { path: '0/3/1/6',       note: 'הודעת סיום זמנית (חדש)' }
];

// קבצים נוספים: .tts ו-CheckGoTo
const extraFiles = [
    { extPath: '0/3/1/1', filename: '050.tts',                                  note: 'TTS: בקשת פלאפון' },
    { extPath: '0/3/1/1', filename: '051.tts',                                  note: 'TTS: בקשת זהות' },
    { extPath: '0/3/1/1', filename: '052.tts',                                  note: 'TTS: בחירת מוקד' },
    { extPath: '0/3/1/1', filename: 'RecordingAndEnteringDataCheckGoTo.ini',    note: 'ניתוב מוקד 1-8' },
    { extPath: '0/3/1/3', filename: '050.tts',                                  note: 'TTS: מספר דגם' },
    { extPath: '0/3/1/4', filename: '050.tts',                                  note: 'TTS: כמות ספרים' },
    { extPath: '0/3/1/5', filename: '050.tts',                                  note: 'TTS: כמות מחברות' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('העלאת תהליך הזמנה מלא: פלאפון + זהות + מוקד + דגם + ספרים + מחברות');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        log('✓ התחברתי ל-Yemot');

        // העלאת ext.ini לכל שלוחה
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

        // העלאת הקבצים הנוספים (.tts, CheckGoTo)
        log('');
        log('═══════════════════════════════════════════════════════════');
        log('העלאת קבצי .tts ו-CheckGoTo');
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
            } catch (e) {
                log(`  ✗ העלאה: ${e.message}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'upload-failed' });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${file.extPath}/${file.filename}`);
                log(`  ✓ אומת: size=${verify?.file?.size}`);
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'ok', size: verify?.file?.size });
            } catch (e) {
                results.push({ path: `${file.extPath}/${file.filename}`, status: 'verify-failed' });
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
