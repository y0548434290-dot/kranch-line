// בדיקת מצב שלוחות 0/3, 0/3/1, 0/3/2 בימות המשיח
require('./env-loader');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

(async () => {
    const wrapper = new YemotApiWrapper();
    try {
        await wrapper.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD, process.env.YEMOT_SERVER || 'ym');
        for (const p of ['0/3/ext.ini', '0/3/1/ext.ini', '0/3/2/ext.ini']) {
            try {
                const r = await wrapper.getTextFile(p);
                console.log(`${p}: exists=${r?.file?.exists}, size=${r?.file?.size || 0}, mtime=${r?.file?.mtime || '-'}`);
            } catch (e) {
                console.log(`${p}: ERROR ${e.message}`);
            }
        }
    } finally {
        try { await wrapper.disconnect(); } catch (_) {}
    }
})();
