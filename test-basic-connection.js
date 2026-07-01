const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
const ExtensionManager = require('./src/ivr/extension-manager');
const GoogleSheetsSync = require('./src/integrations/google-sheets-sync');
require('./env-loader');

async function testBasicConnection() {
    console.log('🔄 בדיקת חיבור בסיסית ל-Yemot ו-Google Sheets...');

    const yemotApi = new YemotApiWrapper();
    const googleSheetsSync = new GoogleSheetsSync();
    let extensionManager;

    try {
        // חיבור ל-Yemot
        console.log('📡 מחבר ל-Yemot...');
        await yemotApi.connect(
            process.env.YEMOT_USERNAME,
            process.env.YEMOT_PASSWORD,
            process.env.YEMOT_SERVER
        );
        console.log('✅ חיבור ל-Yemot בוצע בהצלחה');

        // יצירת שלוחה בסיסית
        extensionManager = new ExtensionManager(yemotApi);
        const extensionNumber = `test_connection_${Date.now()}`;
        console.log(`☎️  יוצר שלוחה בדיקה: ${extensionNumber}...`);

        await extensionManager.createExtension(extensionNumber, {
            type: 'menu',
            whiteList: false
        });
        console.log('✅ שלוחה נוצרה בהצלחה');

        // יצירת ext.ini בסיסי
        const extConfig = {
            type: 'menu',
            title: 'שלוחה לבדיקת חיבור Yemot',
            message: 'שלום, זו בדיקת חיבור. לחצו 1 לאישור, 2 לביטול.',
            option1: 'אישור',
            option1_action: 'confirm',
            option2: 'ביטול',
            option2_action: 'cancel',
            timeout: 20,
            max_attempts: 2,
            invalid_option_message: 'אפשרות לא תקינה. נסו שוב.',
            timeout_message: 'הזמן נגמר. להתראות.',
            language: 'he',
            direction: 'rtl'
        };

        console.log('📄 יוצר ext.ini בסיסי לשלוחה...');
        const iniContent = extensionManager.stringifyIni(extConfig);
        await yemotApi.getApi().upload_txt_file(`ivr2:/${extensionNumber}/ext.ini`, iniContent);
        console.log('✅ ext.ini הועלה בהצלחה');

        // בדיקת מבנה השלוחה
        console.log('🔍 בודק מבנה שלוחה ב-Yemot...');
        const structure = await extensionManager.getExtensionStructure(extensionNumber);
        console.log('✅ מבנה השלוחה התקבל:');
        console.log(JSON.stringify(structure, null, 2));

        // בדיקת חיבור ל-Google Sheets
        console.log('📊 מאתחל חיבור ל-Google Sheets...');
        await googleSheetsSync.initialize(
            process.env.GOOGLE_SHEETS_CREDENTIALS_PATH,
            process.env.GOOGLE_SHEETS_SPREADSHEET_ID
        );

        const sheetInfo = await googleSheetsSync.sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
        });
        console.log('✅ חיבור ל-Google Sheets הצליח!');
        console.log(`📋 שם הגיליון: ${sheetInfo.data.properties.title}`);

        console.log('\n🎉 בדיקת חיבור בסיסית הסתיימה בהצלחה!');
        console.log(`📞 שלוחה בדיקה מומלץ לשמור: ${extensionNumber}`);
    } catch (error) {
        console.error('❌ שגיאה בבדיקת חיבור בסיסית:', error.message);

        if (error.message.includes('login') || error.message.includes('שם משתמש') || error.message.includes('התחברות')) {
            console.log('💡 בדוק את שם המשתמש והסיסמה של Yemot ב-.env');
        } else if (error.message.includes('Google Sheets') || error.message.includes('spreadsheetId')) {
            console.log('💡 בדוק את קובץ ה-credentials של Google ואת מזהה הגיליון');
        }

        process.exit(1);
    } finally {
        try {
            await yemotApi.disconnect();
        } catch (disconnectError) {
            console.warn('⚠️ שגיאה בזמן התנתקות מ-Yemot:', disconnectError.message);
        }
    }
}

if (require.main === module) {
    testBasicConnection();
}

module.exports = testBasicConnection;
