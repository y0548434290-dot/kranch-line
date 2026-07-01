const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');

async function verifyExtensions(api, extensions) {
    const results = [];

    for (const path of extensions) {
        try {
            console.log(`🧪 בודק שלוחה: ${path}`);
            const tree = await api.get_ivr_tree(path);
            const exists = tree && tree.responseStatus === 'OK';
            results.push({ path, exists, tree });
            console.log(`✅ קיימת: ${path}`);
        } catch (error) {
            console.error(`❌ לא נמצאה שלוחה: ${path}`, error.message || error);
            results.push({ path, exists: false, error: error.message || error });
        }
    }

    return results;
}

async function main() {
    console.log('🔎 מתחיל אימות קיום שלוחות ב-Yemot...');
    const api = new YemotApiWrapper();
    await api.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);

    const expected = [
        'main',
        'orders',
        'status',
        'messages',
        'admin',
        'orders/step1',
        'orders/step2',
        'orders/step3',
        'orders/step4',
        'orders/step5',
        'orders/step6',
        'orders/step7'
    ];

    const results = await verifyExtensions(api, expected);

    const missing = results.filter(r => !r.exists);
    console.log('\n📋 סיכום אימות:');
    console.log(`- ${results.length} שלוחות נבדקו`);
    console.log(`- ${missing.length} שלוחות חסרות`);

    if (missing.length > 0) {
        missing.forEach(m => console.log(`  ✖ ${m.path}`));
        process.exit(1);
    }

    console.log('🎉 כל השלוחות קיימות ב-Yemot');
    process.exit(0);
}

main().catch(error => {
    console.error('❌ שגיאה באימות שלוחות:', error.message || error);
    process.exit(1);
});