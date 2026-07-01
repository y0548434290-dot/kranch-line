require('./env-loader');
const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');

(async () => {
    const wrapper = new YemotApiWrapper();
    const paths = [
        'ext.ini',
        '0/ext.ini',
        '0/3/ext.ini',
        '0/3/1/ext.ini',
        '0/5/ext.ini',
        '3/ext.ini',
        '3/1/ext.ini',
        '5/ext.ini'
    ];

    try {
        await wrapper.connect(
            process.env.YEMOT_USERNAME,
            process.env.YEMOT_PASSWORD,
            process.env.YEMOT_SERVER || 'ym'
        );

        for (const path of paths) {
            try {
                const result = await wrapper.getTextFile(path);
                console.log(`--- ${path} ---`);
                console.log(result?.contents || result?.responseData || JSON.stringify(result));
            } catch (error) {
                console.log(`--- ${path} ---`);
                console.log(`ERROR: ${error.message}`);
            }
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
