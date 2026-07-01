const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');
const logFile = path.join(logsDir, `שלב2-אימות-שלוחות-${new Date().toISOString().slice(0,10)}.log`);

function log(message) {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
}

async function verifyExtension(api, path) {
    try {
        const tree = await api.get_ivr_tree(path);
        const exists = tree && tree.responseStatus === 'OK';
        return { path, exists, status: tree?.responseStatus || 'unknown' };
    } catch (error) {
        return { path, exists: false, error: error.message };
    }
}

async function main() {
    log('═══════════════════════════════════════════════════════════════');
    log('🔍 התחלת אימות קיום שלוחות בימות המשיח');
    log('═══════════════════════════════════════════════════════════════');

    const api = new YemotApiWrapper();
    
    try {
        log('📱 התחברות ל-Yemot לאימות...');
        await api.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);
        log('✅ התחברות הצליחה');
    } catch (error) {
        log(`❌ שגיאה בהתחברות: ${error.message}`);
        process.exit(1);
    }

    const extensions = [
        'main',
        'admin',
        'orders/new',
        'orders/new/welcome',
        'orders/new/step_id',
        'orders/new/step_phone',
        'orders/new/step_phone_extra',
        'orders/new/step_phone_extra_input',
        'orders/new/step_model',
        'orders/new/step_branch',
        'orders/new/step_quantities',
        'orders/new/step_personal_name',
        'orders/new/step_font_code',
        'orders/new/step_record_hebrew',
        'orders/new/step_confirm_hebrew',
        'orders/new/step_name_lang',
        'orders/new/step_record_english',
        'orders/new/step_confirm_english',
        'orders/new/step_total',
        'orders/new/step_confirm_order',
        'orders/new/step_final_confirm',
        'orders/new/step_success',
        'status',
        'status/step_id',
        'status/step_result'
    ];

    log('\n🔎 בדיקת כל השלוחות:');
    log('─────────────────────────────────────────────────────────────');

    let verified = 0;
    let failed = 0;
    const failedExtensions = [];

    for (const ext of extensions) {
        const result = await verifyExtension(api, ext);
        if (result.exists) {
            log(`✅ אומתה: ${ext}`);
            verified++;
        } else {
            log(`❌ נכשלה: ${ext} - ${result.error || 'לא נמצאה'}`);
            failed++;
            failedExtensions.push(ext);
        }
    }

    log('\n═══════════════════════════════════════════════════════════════');
    log('📊 סיכום אימות');
    log('═══════════════════════════════════════════════════════════════');
    log(`📊 סה"כ שלוחות בדוקות: ${extensions.length}`);
    log(`✅ שלוחות שאומתו: ${verified}`);
    log(`❌ שלוחות שנכשלו: ${failed}`);

    if (failed > 0) {
        log('\n⚠️ שלוחות שנכשלו:');
        failedExtensions.forEach(ext => log(`  ❌ ${ext}`));
        process.exit(1);
    }

    log('\n🎉 כל השלוחות אומתו בהצלחה בימות המשיח!');
    process.exit(0);
}

main().catch(error => {
    log(`❌ שגיאה קריטית: ${error.message}`);
    process.exit(1);
});
