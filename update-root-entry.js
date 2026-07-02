// הופך את שורש הקו (ivr2:/ext.ini) משלוחת go_to_folder לשער כניסה API
// שמפנה ל-/yemot/entry — שם מזוהה לקוח עם הודעה ממתינה (צנתוק).
// שימוש:
//   node update-root-entry.js                          → עדכון (עם גיבוי אוטומטי ל-logs/)
//   node update-root-entry.js --rollback logs/<קובץ>   → שחזור גיבוי כפי שהוא
require('./env-loader');
const fs = require('fs');
const path = require('path');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

const TARGET = 'ext.ini';
const ENTRY_URL = 'https://kranch-line.onrender.com/yemot/entry';

(async () => {
    const wrapper = new YemotApiWrapper();
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const rollbackIndex = process.argv.indexOf('--rollback');
    const rollbackFile = rollbackIndex !== -1 ? process.argv[rollbackIndex + 1] : null;
    if (rollbackIndex !== -1 && !rollbackFile) {
        console.error('שימוש: node update-root-entry.js --rollback logs/<קובץ גיבוי>');
        process.exit(1);
    }

    try {
        await wrapper.connect(
            process.env.YEMOT_USERNAME,
            process.env.YEMOT_PASSWORD,
            process.env.YEMOT_SERVER || 'ym'
        );

        if (rollbackFile) {
            const restored = fs.readFileSync(path.resolve(__dirname, rollbackFile), 'utf8');
            await wrapper.uploadTextFile(TARGET, restored);
            const verify = await wrapper.getTextFile(TARGET);
            const after = verify?.contents || verify?.responseData || '';
            console.log(`${after.trim() === restored.trim() ? '✓' : '✗'} השורש שוחזר מ-${rollbackFile}`);
            console.log(after.trim());
            return;
        }

        const current = await wrapper.getTextFile(TARGET);
        const contents = current?.contents || current?.responseData || '';
        if (!contents.includes('type=')) {
            throw new Error(`תוכן השורש לא נראה כמו ext.ini: ${JSON.stringify(contents).slice(0, 160)}`);
        }

        const backup = path.join(logsDir, `yemot-root-ext.ini-backup-${Date.now()}.ini`);
        fs.writeFileSync(backup, contents, 'utf8');

        // שומרים כל שורה קיימת (voice/rate וכו') חוץ מ-type ו-go_to_folder, ומוסיפים את הגדרות ה-API.
        const kept = contents
            .split(/\r?\n/)
            .filter((line) => {
                const clean = line.replace(/^﻿/, '').trim();
                return clean && !/^type=/.test(clean) && !/^go_to_folder=/.test(clean) && !/^api_/.test(clean);
            });

        const updated = [
            ...kept,
            'type=api',
            `api_link=${ENTRY_URL}`,
            'api_url_post=yes',
            'api_hangup_send=yes'
        ].join('\n') + '\n';

        await wrapper.uploadTextFile(TARGET, updated);

        const verify = await wrapper.getTextFile(TARGET);
        const after = verify?.contents || verify?.responseData || '';
        const ok = after.includes(`api_link=${ENTRY_URL}`) && /type=api/.test(after);
        console.log(`${ok ? '✓' : '✗'} שורש הקו הופנה ל-${ENTRY_URL} (גיבוי: ${path.basename(backup)})`);
        console.log(after.trim());
        if (!ok) {
            console.error(`לשחזור: node update-root-entry.js --rollback logs/${path.basename(backup)}`);
            process.exit(1);
        }
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})().catch((e) => {
    console.error('שגיאה:', e.message);
    process.exit(1);
});
