// העלאת קובץ השמע של הפתיח לשלוחה הראשית /0 בימות
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotAPI = require('yemot-api');

const LOCAL_WAV = path.join(__dirname, 'opening-tts.wav');
const TARGET = 'ivr2:/0/001.wav'; // קובץ הפתיח בשלוחה הראשית

(async () => {
    const username = process.env.YEMOT_USERNAME;
    const password = process.env.YEMOT_PASSWORD;
    if (!username || !password) {
        console.error('חסרים פרטי התחברות ל-Yemot ב-.env');
        process.exit(1);
    }

    const wav = fs.readFileSync(LOCAL_WAV);
    console.log(`מעלה ${LOCAL_WAV} (${wav.length} bytes) אל ${TARGET}...`);

    const y = new YemotAPI();
    await y.connect(username, password);

    const res = await y.exec('UploadFile', {
        value: {
            value: wav,
            options: { filename: '001.wav', contentType: 'audio/wav' }
        },
        path: TARGET
    });
    console.log('תוצאת העלאה:', JSON.stringify(res));

    // אימות שהקובץ קיים בשלוחה /0
    const tree = await y.exec('GetIvrTree', { path: 'ivr2:/0' });
    console.log('עץ /0 לאחר העלאה:', JSON.stringify(tree).slice(0, 600));
})().catch((e) => {
    console.error('שגיאה:', e);
    process.exit(1);
});
