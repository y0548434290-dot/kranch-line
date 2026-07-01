require('./env-loader');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

(async () => {
    const wrapper = new YemotApiWrapper();

    try {
        await wrapper.connect(
            process.env.YEMOT_USERNAME,
            process.env.YEMOT_PASSWORD,
            process.env.YEMOT_SERVER || 'ym'
        );

        for (const path of ['0/3/1/ext.ini', '0/5/ext.ini']) {
            const result = await wrapper.getTextFile(path);
            const file = result?.file || {};
            console.log(`${path}: exists=${file.exists}, size=${file.size || 0}, mtime=${file.mtime || '-'}`);
        }
    } finally {
        try {
            await wrapper.disconnect();
        } catch (_) {}
    }
})().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
