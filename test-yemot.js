const YemotSystem = require('./src/yemot-system');
require('./env-loader');

/**
 * סקריפט בדיקה לחיבור אמיתי ל-Yemot ויצירת שלוחה ראשונה
 * הרץ עם: node test-yemot.js
 */
async function testYemotConnection() {
    console.log('🔄 מתחיל בדיקת חיבור ל-Yemot Hamashiach...\n');

    let yemotSystem;

    try {
        // אתחול המערכת
        console.log('📡 מאתחל מערכת Yemot...');
        yemotSystem = new YemotSystem();

        // בדיקת חיבור למסד נתונים
        console.log('🗄️  בודק חיבור למסד נתונים...');
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        await pool.query('SELECT 1');
        console.log('✅ חיבור למסד נתונים הצליח\n');

        await pool.end();

        // אתחול עם מסד נתונים
        await yemotSystem.initialize(pool);

        // בדיקת חיבור ל-Yemot
        console.log('🔗 בודק חיבור ל-Yemot API...');
        const session = await yemotSystem.yemotApi.getApi().get_session();
        console.log('✅ חיבור ל-Yemot הצליח!');
        console.log(`📊 מספר יחידות זמינות: ${session.responseData.units}\n`);

        // בדיקת Google Sheets
        console.log('📊 בודק חיבור ל-Google Sheets...');
        const sheetsTest = await yemotSystem.googleSheetsSync.sheets.spreadsheets.get({
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
        });
        console.log('✅ חיבור ל-Google Sheets הצליח!');
        console.log(`📋 שם הגיליון: ${sheetsTest.data.properties.title}\n`);

        // יצירת לקוח לבדיקה
        console.log('👤 יוצר לקוח לבדיקה...');
        const testCustomer = {
            id: 'test_' + Date.now(),
            phone: '0501234567',
            nameHebrew: 'לקוח בדיקה',
            cityId: null
        };

        await yemotSystem.createCustomer(testCustomer);
        console.log('✅ לקוח נוצר בהצלחה\n');

        // יצירת הזמנה לבדיקה
        console.log('📦 יוצר הזמנה לבדיקה...');
        const testOrder = {
            id: 'order_test_' + Date.now(),
            customerId: testCustomer.id,
            status: 'pending',
            items: [
                {
                    productId: 'test_product_1',
                    quantity: 2,
                    price: 25.00
                }
            ],
            total: 50.00,
            notes: 'הזמנת בדיקה'
        };

        const orderResult = await yemotSystem.createOrder(testOrder);
        console.log('✅ הזמנה נוצרה בהצלחה!');
        console.log(`🆔 מזהה הזמנה: ${orderResult.orderId}`);
        console.log(`🔢 מספר שלוחה: order_${orderResult.orderId}\n`);

        // בדיקת מבנה השלוחה שנוצרה
        console.log('🔍 בודק מבנה השלוחה שנוצרה...');
        const extensionStructure = await yemotSystem.extensionManager.getExtensionStructure(`order_${testOrder.id}`);
        console.log('✅ מבנה השלוחה:');
        console.log(JSON.stringify(extensionStructure, null, 2));

        // סנכרון עם Google Sheets
        console.log('\n📤 מסנכרן עם Google Sheets...');
        await yemotSystem.fullSync();
        console.log('✅ סנכרון הושלם\n');

        console.log('🎉 כל הבדיקות עברו בהצלחה!');
        console.log('\n📞 השלוחה זמינה כעת ב-Yemot:');
        console.log(`   מספר: order_${testOrder.id}`);
        console.log(`   תוכל להתקשר אליה לבדיקה`);

    } catch (error) {
        console.error('❌ שגיאה בבדיקה:', error.message);

        if (error.message.includes('שם משתמש או סיסמא שגויים')) {
            console.log('\n💡 פתרון: בדוק את שם המשתמש והסיסמה של Yemot ב-.env');
        } else if (error.message.includes('Google Sheets')) {
            console.log('\n💡 פתרון: בדוק את קובץ credentials.json ואת מזהה הגיליון');
        } else if (error.message.includes('PostgreSQL')) {
            console.log('\n💡 פתרון: בדוק את חיבור מסד הנתונים ב-.env');
        }

        process.exit(1);
    } finally {
        if (yemotSystem) {
            await yemotSystem.shutdown();
        }
    }
}

// הרצת הבדיקה
if (require.main === module) {
    testYemotConnection().catch(console.error);
}

module.exports = testYemotConnection;