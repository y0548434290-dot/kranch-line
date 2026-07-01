const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');
const fs = require('fs');
const path = require('path');

// יוצר לוג בעברית
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `תיקון-ext-ini-${new Date().toISOString().slice(0,10)}.log`);

function log(message) {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
}

function stringifyIni(config) {
    const lines = [];
    for (const [key, value] of Object.entries(config)) {
        lines.push(`${key}=${value}`);
    }
    return lines.join('\n');
}

// הגדרות נכונות לכל סוג שלוחה
const correctExtensions = [
    // תפריט ראשי
    {
        path: 'main',
        config: {
            title: 'תפריט ראשי - מערכת הזמנות עטיפות',
            type: 'menu',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'ברוכים הבאים למערכת הזמנות עטיפות מותאמות אישית. לחץ 1 להזמנה חדשה, 2 לבדיקת סטטוס, 0 לניהול.',
            option1: 'הזמנה חדשה',
            option1_action: 'ivr2:/orders/new',
            option2: 'בדיקת סטטוס',
            option2_action: 'ivr2:/status',
            option0: 'ניהול פנימי',
            option0_action: 'ivr2:/admin'
        }
    },
    // ניהול
    {
        path: 'admin',
        config: {
            title: 'ניהול פנימי',
            type: 'menu',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'כניסה לניהול פנימי. לחץ 1 לחזרה לתפריט הראשי.',
            option1: 'חזור לתפריט',
            option1_action: 'ivr2:/main'
        }
    },
    // תת-תפריט הזמנות
    {
        path: 'orders/new',
        config: {
            title: 'הזמנה חדשה',
            type: 'submenu',
            language: 'hebrew',
            direction: 'rtl',
            message: 'ברוכים הבאים למערכת הזמנות עטיפות.',
            next_step: 'ivr2:/orders/new/welcome'
        }
    },
    // הודעות
    {
        path: 'orders/new/welcome',
        config: {
            title: 'ברוכים הבאים',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'ברוכים הבאים למערכת הזמנות עטיפות מותאמות אישית. אנחנו שמחים שבחרת בנו.',
            next_step: 'ivr2:/orders/new/step_id'
        }
    },
    {
        path: 'orders/new/step_total',
        config: {
            title: 'סיכום הזמנה',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'סיכום ההזמנה שלך: משתנה בהתאם לנתונים. המערכת תקריא לך את הפרטים.',
            next_step: 'ivr2:/orders/new/step_confirm_order'
        }
    },
    {
        path: 'orders/new/step_success',
        config: {
            title: 'הזמנה הושלמה',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'הזמנתך התקבלה בהצלחה! מספר ההזמנה שלך הוא: משתנה. ניצור קשר בקרוב.',
            next_step: 'ivr2:/main'
        }
    },
    {
        path: 'status/step_result',
        config: {
            title: 'תוצאת סטטוס',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'סטטוס ההזמנה שלך: משתנה בהתאם לנתונים בשיטס. המערכת תקריא את הסטטוס עבורך.',
            next_step: 'ivr2:/main'
        }
    },
    // קבלת קלט
    {
        path: 'orders/new/step_id',
        config: {
            title: 'הקלדת זהות',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את מספר הזהות שלך, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_phone'
        }
    },
    {
        path: 'orders/new/step_phone',
        config: {
            title: 'הקלדת טלפון',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את מספר הטלפון שלך, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_phone_extra'
        }
    },
    {
        path: 'orders/new/step_phone_extra_input',
        config: {
            title: 'הקלדת טלפון נוסף',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את מספר הטלפון הנוסף, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_model'
        }
    },
    {
        path: 'orders/new/step_model',
        config: {
            title: 'בחירת דגם',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את קוד הדגם הרצוי, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_branch'
        }
    },
    {
        path: 'orders/new/step_quantities',
        config: {
            title: 'הזנת כמויות',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את הכמות הרצויה, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_personal_name'
        }
    },
    {
        path: 'orders/new/step_personal_name',
        config: {
            title: 'שם המזמין',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את שמך הפרטי, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_font_code'
        }
    },
    {
        path: 'orders/new/step_font_code',
        config: {
            title: 'קוד גופן',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את קוד הגופן הרצוי, ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_record_hebrew'
        }
    },
    {
        path: 'status/step_id',
        config: {
            title: 'הקלדת זהות לבדיקה',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אנא הקלד את מספר הזהות שלך כדי לברר את סטטוס ההזמנה, ובסיום לחץ 1.',
            next_step: 'ivr2:/status/step_result'
        }
    },
    // בחירות
    {
        path: 'orders/new/step_phone_extra',
        config: {
            title: 'טלפון נוסף',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'האם ברצונך להוסיף מספר טלפון נוסף? לחץ 1 כן, 2 לא.',
            option1: 'כן',
            option1_action: 'ivr2:/orders/new/step_phone_extra_input',
            option2: 'לא',
            option2_action: 'ivr2:/orders/new/step_model'
        }
    },
    {
        path: 'orders/new/step_name_lang',
        config: {
            title: 'בחירת שפה לשם',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'באיזו שפה ברצונך להקליט את השם? לחץ 1 עברית, 2 אנגלית.',
            option1: 'עברית',
            option1_action: 'ivr2:/orders/new/step_record_hebrew',
            option2: 'אנגלית',
            option2_action: 'ivr2:/orders/new/step_record_english'
        }
    },
    {
        path: 'orders/new/step_confirm_order',
        config: {
            title: 'אישור הזמנה',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'האם לאשר את ההזמנה? לחץ 1 לאישור, 2 לביטול.',
            option1: 'אישור',
            option1_action: 'ivr2:/orders/new/step_final_confirm',
            option2: 'ביטול',
            option2_action: 'ivr2:/main'
        }
    },
    {
        path: 'orders/new/step_final_confirm',
        config: {
            title: 'אישור סופי',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'אישור סופי להזמנה. לחץ 1 לאישור, 2 לביטול.',
            option1: 'אישור סופי',
            option1_action: 'ivr2:/orders/new/step_success',
            option2: 'ביטול',
            option2_action: 'ivr2:/main'
        }
    },
    // תת-תפריטים
    {
        path: 'orders/new/step_branch',
        config: {
            title: 'בחירת סניף',
            type: 'submenu',
            language: 'hebrew',
            direction: 'rtl',
            message: 'בחירת סניף האיסוף.',
            next_step: 'ivr2:/orders/new/step_quantities'
        }
    },
    {
        path: 'status',
        config: {
            title: 'בדיקת סטטוס',
            type: 'submenu',
            language: 'hebrew',
            direction: 'rtl',
            message: 'ברוכים הבאים לבדיקת סטטוס הזמנה.',
            next_step: 'ivr2:/status/step_id'
        }
    },
    // הקלטות
    {
        path: 'orders/new/step_record_hebrew',
        config: {
            title: 'הקלטת שם בעברית',
            type: 'recording',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'אנא הקלט את שמך בעברית אות אחר אות, ובסיום לחץ חד-כיווני (#).',
            next_step: 'ivr2:/orders/new/step_confirm_hebrew'
        }
    },
    {
        path: 'orders/new/step_record_english',
        config: {
            title: 'הקלטת שם באנגלית',
            type: 'recording',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'אנא הקלט את שמך באנגלית אות אחר אות, ובסיום לחץ חד-כיווני (#).',
            next_step: 'ivr2:/orders/new/step_confirm_english'
        }
    },
    // אישורים
    {
        path: 'orders/new/step_confirm_hebrew',
        config: {
            title: 'אישור הקלטה עברית',
            type: 'confirmation',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'האם ההקלטה נכונה? לחץ 1 לאישור, 2 להקלטה חוזרת.',
            option1: 'אישור',
            option1_action: 'ivr2:/orders/new/step_total',
            option2: 'הקלטה חוזרת',
            option2_action: 'ivr2:/orders/new/step_record_hebrew'
        }
    },
    {
        path: 'orders/new/step_confirm_english',
        config: {
            title: 'אישור הקלטה אנגלית',
            type: 'confirmation',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'האם ההקלטה נכונה? לחץ 1 לאישור, 2 להקלטה חוזרת.',
            option1: 'אישור',
            option1_action: 'ivr2:/orders/new/step_total',
            option2: 'הקלטה חוזרת',
            option2_action: 'ivr2:/orders/new/step_record_english'
        }
    }
];

async function fixExtension(api, extension) {
    try {
        log(`🔧 מתקן שלוחה: ${extension.path}`);

        // יצירת תוכן ext.ini נכון
        const iniContent = stringifyIni(extension.config);

        // העלאת ext.ini המתוקן
        await api.uploadTextFile(`${extension.path}/ext.ini`, iniContent);
        log(`✅ ext.ini מתוקן הועלה ל: ${extension.path}/ext.ini`);

        return { path: extension.path, success: true };
    } catch (error) {
        log(`❌ שגיאה בתיקון שלוחה ${extension.path}: ${error.message}`);
        return { path: extension.path, success: false, error: error.message };
    }
}

async function main() {
    log('═══════════════════════════════════════════════════════════════');
    log('🔧 התחלת תיקון ext.ini לכל השלוחות בימות המשיח');
    log('═══════════════════════════════════════════════════════════════');

    const api = new YemotApiWrapper();

    try {
        log('📱 התחברות ל-Yemot...');
        await api.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);
        log('✅ התחברות הצליחה');

        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const extension of correctExtensions) {
            const result = await fixExtension(api, extension);
            results.push(result);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        log('\n═══════════════════════════════════════════════════════════════');
        log('📊 סיכום התיקונים:');
        log('═══════════════════════════════════════════════════════════════');
        log(`📊 סה"כ שלוחות: ${results.length}`);
        log(`✅ שלוחות שתוקנו בהצלחה: ${successCount}`);
        log(`❌ שלוחות שנכשלו: ${failCount}`);

        if (failCount > 0) {
            log('\n❌ שלוחות שנכשלו:');
            for (const result of results) {
                if (!result.success) {
                    log(`  - ${result.path}: ${result.error}`);
                }
            }
        }

        log('\n🎉 תיקון ext.ini הושלם!');
        log('השלוחות כעת מוגדרות עם סוגי השלוחות הנכונים ופרמטרים מתאימים.');

    } catch (error) {
        log(`❌ שגיאה כללית: ${error.message}`);
        process.exit(1);
    }
}

main();
