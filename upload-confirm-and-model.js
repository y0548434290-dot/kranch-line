// תיקון ניתוב אישור באמצעות תת-שלוחות type=go_to_folder + הוספת שלוחת מספר דגם
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `תיקון-ניתוב-ומספר-דגם-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

const extensions = [
    // עדכון 10 שלוחות אישור (משנה 1=go_to_folder=... ל-1=1)
    { path: '0/3/1/1/1/1', note: 'עדכון: בר אילן (1=1)' },
    { path: '0/3/1/1/1/2', note: 'עדכון: רוממה (1=1)' },
    { path: '0/3/1/1/2/1', note: 'עדכון: ר\' עקיבא (1=1)' },
    { path: '0/3/1/1/2/2', note: 'עדכון: עזרא (1=1)' },
    { path: '0/3/1/1/3',   note: 'עדכון: אשדוד (1=1)' },
    { path: '0/3/1/1/4',   note: 'עדכון: אלעד (1=1)' },
    { path: '0/3/1/1/5',   note: 'עדכון: בית שמש (1=1)' },
    { path: '0/3/1/1/6',   note: 'עדכון: ביתר עילית (1=1)' },
    { path: '0/3/1/1/7',   note: 'עדכון: חיפה (1=1)' },
    { path: '0/3/1/1/8',   note: 'עדכון: מודיעין עילית (1=1)' },
    // יצירת 10 תת-שלוחות רידיירקט (type=go_to_folder)
    { path: '0/3/1/1/1/1/1', note: 'חדש: רידיירקט מבר אילן ל-/0/3/1/2' },
    { path: '0/3/1/1/1/2/1', note: 'חדש: רידיירקט מרוממה' },
    { path: '0/3/1/1/2/1/1', note: 'חדש: רידיירקט מר\' עקיבא' },
    { path: '0/3/1/1/2/2/1', note: 'חדש: רידיירקט מעזרא' },
    { path: '0/3/1/1/3/1',   note: 'חדש: רידיירקט מאשדוד' },
    { path: '0/3/1/1/4/1',   note: 'חדש: רידיירקט מאלעד' },
    { path: '0/3/1/1/5/1',   note: 'חדש: רידיירקט מבית שמש' },
    { path: '0/3/1/1/6/1',   note: 'חדש: רידיירקט מביתר עילית' },
    { path: '0/3/1/1/7/1',   note: 'חדש: רידיירקט מחיפה' },
    { path: '0/3/1/1/8/1',   note: 'חדש: רידיירקט ממודיעין עילית' },
    // עדכון 0/3/1/2 ויצירת המשך התהליך
    { path: '0/3/1/2', note: 'עדכון: "בחירתך נקלטה בהצלחה" → מעבר אוטומטי ל-/0/3/1/3' },
    { path: '0/3/1/3', note: 'חדש: recording_and_entering_data למספר הדגם' },
    { path: '0/3/1/4', note: 'חדש: הודעת סיום זמנית' }
];

(async () => {
    const wrapper = new YemotApiWrapper();
    const results = [];

    try {
        log('═══════════════════════════════════════════════════════════');
        log('תיקון ניתוב אישור + הוספת שלוחת מספר הדגם');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
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
                results.push({ path: ext.path, status: 'upload-failed', error: e.message });
                continue;
            }

            try {
                const verify = await wrapper.getTextFile(`${ext.path}/ext.ini`);
                log(`  ✓ אומת: size=${verify?.file?.size}, mtime=${verify?.file?.mtime}`);
                results.push({ path: ext.path, status: 'ok', size: verify?.file?.size });
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
            log(`${icon} /${r.path} — ${r.status}${r.size ? ` (${r.size} bytes)` : ''}`);
        }
        const okCount = results.filter(r => r.status === 'ok').length;
        log('');
        log(`✅ הצליחו: ${okCount}/${extensions.length}`);
    } catch (error) {
        log(`❌ ${error.message}`);
        log(error.stack || '');
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
