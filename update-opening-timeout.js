// הגדלת ההמתנה (timeout) בשלוחה הראשית /0 כך שיהיה רווח ארוך לפני
// השמעת timeout_message ("קו זה הוקם באמצעות ימות המשיח").
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const REMOTE = '0/ext.ini';
const NEW_TIMEOUT = 60; // שניות (במקום 30)

(async () => {
    const wrapper = new YemotApiWrapper();
    try {
        await wrapper.connect(
            process.env.YEMOT_USERNAME,
            process.env.YEMOT_PASSWORD,
            process.env.YEMOT_SERVER || 'ym'
        );

        const current = await wrapper.getTextFile(REMOTE);
        const contents = current?.contents || current?.responseData || '';
        if (!contents || !/timeout=\d+/.test(contents)) {
            throw new Error('לא נמצא timeout= בקובץ הקיים — לא משנים כלום');
        }

        // גיבוי
        const logsDir = path.join(__dirname, 'logs');
        fs.mkdirSync(logsDir, { recursive: true });
        const backup = path.join(logsDir, `ext-0-backup-timeout-${Date.now()}.ini`);
        fs.writeFileSync(backup, contents, 'utf8');
        console.log('גיבוי נשמר ב:', backup);

        const updated = contents.replace(/timeout=\d+/, `timeout=${NEW_TIMEOUT}`);
        if (updated === contents) {
            console.log('אין שינוי (הערך כבר תואם).');
            return;
        }

        const up = await wrapper.uploadTextFile(REMOTE, updated);
        console.log('תוצאת העלאה:', up?.message || JSON.stringify(up));

        const verify = await wrapper.getTextFile(REMOTE);
        const after = verify?.contents || verify?.responseData || '';
        const match = after.match(/timeout=\d+/);
        console.log('הערך לאחר העדכון:', match ? match[0] : '(לא נמצא)');
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})().catch((e) => {
    console.error('שגיאה:', e.message);
    process.exit(1);
});
