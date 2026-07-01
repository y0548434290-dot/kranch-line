require('./env-loader');

const { analyzeWavBuffer } = require('./src/api-link/audio-utils');
const { downloadRecording, getIvrTree, normalizeRecordingPath } = require('./src/api-link/yemot-recordings');

/**
 * סקריפט דיאגנוסטי (קריאה בלבד) לחקירת אחסון הקלטות בימות.
 * אינו משנה דבר בימות או בגיליון.
 *
 * שימוש:
 *   node inspect-recording.js [נתיב-הקלטה]
 * דוגמה:
 *   node inspect-recording.js 0/3/1/025.wav
 */

function parentFolder(normalizedPath) {
    const idx = normalizedPath.lastIndexOf('/');
    return idx === -1 ? '' : normalizedPath.slice(0, idx);
}

async function main() {
    const inputPath = process.argv[2] || '0/3/1/025.wav';
    const normalizedPath = normalizeRecordingPath(inputPath);
    const folder = parentFolder(normalizedPath);

    console.log('🔍 חקירת אחסון הקלטה בימות (קריאה בלבד)');
    console.log(`   נתיב מקורי:  ${inputPath}`);
    console.log(`   נתיב מנורמל: ${normalizedPath}`);
    console.log(`   תיקיית אב:   ${folder || '(שורש)'}\n`);

    if (!process.env.YEMOT_USERNAME || !process.env.YEMOT_PASSWORD) {
        console.error('❌ חסרים פרטי התחברות לימות ב-.env (YEMOT_USERNAME / YEMOT_PASSWORD)');
        process.exit(1);
    }

    try {
        console.log(`📂 GetIvrTree על ivr2:${folder} :`);
        const tree = await getIvrTree(folder);
        console.log(JSON.stringify(tree, null, 2));
        console.log('');
    } catch (error) {
        console.error(`⚠️  GetIvrTree נכשל: ${error.message}\n`);
    }

    try {
        console.log('⬇️  מוריד את הקובץ דרך downloadRecording המתוקן ומנתח...');
        const recording = await downloadRecording(normalizedPath);
        const report = analyzeWavBuffer(recording.buffer);
        console.log(`   שם קובץ: ${recording.fileName}`);
        console.log(JSON.stringify(report, null, 2));

        if (report.isRiff) {
            console.log('\n📊 סיכום שלמות:');
            console.log(`   • byte-rate ${report.byteRateOk ? 'תקין ✅' : 'שגוי ❌'} (${report.byteRate} מול ${report.expectedByteRate} צפוי)`);
            console.log(`   • גודל data ${report.dataSizeOk ? 'תואם ✅' : 'לא תואם ❌'} (מוצהר ${report.dataDeclaredSize} / זמין ${report.dataAvailable})`);
            console.log(`   • שיעור בייטי 0xFD: ${report.fdRatioPct}% ${report.fdRatioPct > 20 ? '(גבוה - סימן לפגימה) ❌' : '(תקין) ✅'}`);
            if (report.durationSec) {
                console.log(`   • משך משוער: ${report.durationSec} שניות`);
            }
        }
    } catch (error) {
        console.error(`❌ הורדה/ניתוח נכשלו: ${error.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
