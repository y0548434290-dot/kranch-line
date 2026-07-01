// הוספת זיהוי לפי תעודת זהות לשלוחת approvals
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const logFile = path.join(logsDir, `זיהוי-TZ-${today}.log`);

function log(msg) {
    const ts = new Date().toLocaleTimeString('he-IL');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    fs.appendFileSync(logFile, line + '\n');
}

(async () => {
    const wrapper = new YemotApiWrapper();

    try {
        log('═══════════════════════════════════════════════════════════');
        log('עדכון /0/3/1/17 - זיהוי לפי תעודת זהות');
        log('═══════════════════════════════════════════════════════════');

        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        log('✓ התחברתי ל-Yemot');

        const localFile = path.join(__dirname, 'ivr_build', '0', '3', '1', '17', 'ext.ini');
        const contents = fs.readFileSync(localFile, 'utf8');

        const uploadRes = await wrapper.uploadTextFile('0/3/1/17/ext.ini', contents);
        log(`UploadTextFile → ${uploadRes.message}`);

        const verify = await wrapper.getTextFile('0/3/1/17/ext.ini');
        log(`✓ אומת: size=${verify?.file?.size}, mtime=${verify?.file?.mtime}`);

        log('');
        log('✅ הסתיים');
    } catch (error) {
        log(`❌ ${error.message}`);
        process.exit(1);
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
