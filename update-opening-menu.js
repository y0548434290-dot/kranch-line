// עדכון שלוחת התפריט הראשית /0 כך שתשמיע את הקלטת הפתיח (001.wav)
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotAPI = require('yemot-api');

const LOCAL_EXT = path.join(__dirname, 'ivr_build', '0', 'ext.ini');
const REMOTE = 'ivr2:/0/ext.ini';
const BACKUP = path.join(__dirname, 'logs', `ext-0-backup-${Date.now()}.ini`);

(async () => {
    const y = new YemotAPI();
    await y.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);

    // 1) גיבוי הגרסה הקיימת בימות
    const current = await y.exec('GetTextFile', { what: REMOTE });
    const currentContents = current && current.contents ? current.contents : JSON.stringify(current);
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    fs.writeFileSync(BACKUP, currentContents, 'utf8');
    console.log('גיבוי נשמר ב:', BACKUP);
    console.log('--- תוכן קיים (לפני) ---');
    console.log(currentContents);

    // 2) העלאת הגרסה החדשה
    const newContents = fs.readFileSync(LOCAL_EXT, 'utf8');
    const up = await y.exec('UploadTextFile', { what: REMOTE, contents: newContents });
    console.log('--- תוצאת העלאה ---');
    console.log(JSON.stringify(up));

    // 3) אימות
    const verify = await y.exec('GetTextFile', { what: REMOTE });
    console.log('--- תוכן לאחר העלאה ---');
    console.log(verify && verify.contents ? verify.contents : JSON.stringify(verify));
})().catch((e) => {
    console.error('שגיאה:', e);
    process.exit(1);
});
