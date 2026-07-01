const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');
const fs = require('fs');
const path = require('path');

// יוצר לוג בעברית
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `תיקון-ext-ini-נכון-${new Date().toISOString().slice(0,10)}.log`);

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

// הגדרות נכונות לפי תקני Yemot האמיתיים
const correctExtensions = [
    // תפריט ראשי
    {
        path: 'main',
        config: {
            type: 'menu'
        }
    },
    // ניהול
    {
        path: 'admin',
        config: {
            type: 'menu',
            title: 'ניהול פנימי',
            message: 'כניסה לניהול פנימי. לחץ 1 לחזרה לתפריט הראשי.',
            option1: 'חזור לתפריט',
            option1_action: 'go_to_folder',
            option1_value: '/main'
        }
    },
    // תת-תפריט הזמנות - המרה ל-menu
    {
        path: 'orders/new',
        config: {
            type: 'menu',
            title: 'הזמנה חדשה',
            message: 'ברוכים הבאים למערכת הזמנות עטיפות.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/welcome'
        }
    },
    // הודעת ברכה - המרה ל-playfile
    {
        path: 'orders/new/welcome',
        config: {
            type: 'playfile',
            title: 'ברוכים הבאים',
            message: 'ברוכים הבאים למערכת הזמנות עטיפות מותאמות אישית. אנחנו שמחים שבחרת בנו.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_id'
        }
    },
    // סיכום הזמנה - המרה ל-playfile
    {
        path: 'orders/new/step_total',
        config: {
            type: 'playfile',
            title: 'סיכום הזמנה',
            message: 'סיכום ההזמנה שלך: משתנה בהתאם לנתונים. המערכת תקריא לך את הפרטים.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_confirm_order'
        }
    },
    // הזמנה הושלמה - המרה ל-playfile
    {
        path: 'orders/new/step_success',
        config: {
            type: 'playfile',
            title: 'הזמנה הושלמה',
            message: 'הזמנתך התקבלה בהצלחה! מספר ההזמנה שלך הוא: משתנה. ניצור קשר בקרוב.',
            option1: 'סיום',
            option1_action: 'go_to_folder',
            option1_value: '/main'
        }
    },
    // תוצאת סטטוס - המרה ל-playfile
    {
        path: 'status/step_result',
        config: {
            type: 'playfile',
            title: 'תוצאת סטטוס',
            message: 'סטטוס ההזמנה שלך: משתנה בהתאם לנתונים בשיטס. המערכת תקריא את הסטטוס עבורך.',
            option1: 'סיום',
            option1_action: 'go_to_folder',
            option1_value: '/main'
        }
    },
    // קבלת זהות - המרה ל-api_link
    {
        path: 'orders/new/step_id',
        config: {
            type: 'api_link',
            title: 'הקלדת זהות',
            api_link: 'https://your-google-apps-script-url/exec?action=validate_id',
            message: 'אנא הקלד את מספר הזהות שלך, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_phone'
        }
    },
    // קבלת טלפון - המרה ל-api_link
    {
        path: 'orders/new/step_phone',
        config: {
            type: 'api_link',
            title: 'הקלדת טלפון',
            api_link: 'https://your-google-apps-script-url/exec?action=save_phone',
            message: 'אנא הקלד את מספר הטלפון שלך, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_phone_extra'
        }
    },
    // קבלת טלפון נוסף - המרה ל-api_link
    {
        path: 'orders/new/step_phone_extra_input',
        config: {
            type: 'api_link',
            title: 'הקלדת טלפון נוסף',
            api_link: 'https://your-google-apps-script-url/exec?action=save_extra_phone',
            message: 'אנא הקלד את מספר הטלפון הנוסף, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_model'
        }
    },
    // בחירת דגם - המרה ל-api_link
    {
        path: 'orders/new/step_model',
        config: {
            type: 'api_link',
            title: 'בחירת דגם',
            api_link: 'https://your-google-apps-script-url/exec?action=save_model',
            message: 'אנא הקלד את קוד הדגם הרצוי, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_branch'
        }
    },
    // הזנת כמויות - המרה ל-api_link
    {
        path: 'orders/new/step_quantities',
        config: {
            type: 'api_link',
            title: 'הזנת כמויות',
            api_link: 'https://your-google-apps-script-url/exec?action=save_quantity',
            message: 'אנא הקלד את הכמות הרצויה, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_personal_name'
        }
    },
    // שם המזמין - המרה ל-api_link
    {
        path: 'orders/new/step_personal_name',
        config: {
            type: 'api_link',
            title: 'שם המזמין',
            api_link: 'https://your-google-apps-script-url/exec?action=save_name',
            message: 'אנא הקלד את שמך הפרטי, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_font_code'
        }
    },
    // קוד גופן - המרה ל-api_link
    {
        path: 'orders/new/step_font_code',
        config: {
            type: 'api_link',
            title: 'קוד גופן',
            api_link: 'https://your-google-apps-script-url/exec?action=save_font',
            message: 'אנא הקלד את קוד הגופן הרצוי, ובסיום לחץ 1 להמשך.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_record_hebrew'
        }
    },
    // הקלדת זהות לבדיקה - המרה ל-api_link
    {
        path: 'status/step_id',
        config: {
            type: 'api_link',
            title: 'הקלדת זהות לבדיקה',
            api_link: 'https://your-google-apps-script-url/exec?action=check_status',
            message: 'אנא הקלד את מספר הזהות שלך כדי לברר את סטטוס ההזמנה, ובסיום לחץ 1.',
            option1: 'בדיקה',
            option1_action: 'go_to_folder',
            option1_value: '/status/step_result'
        }
    },
    // בחירת טלפון נוסף - המרה ל-menu
    {
        path: 'orders/new/step_phone_extra',
        config: {
            type: 'menu',
            title: 'טלפון נוסף',
            message: 'האם ברצונך להוסיף מספר טלפון נוסף? לחץ 1 כן, 2 לא.',
            option1: 'כן',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_phone_extra_input',
            option2: 'לא',
            option2_action: 'go_to_folder',
            option2_value: '/orders/new/step_model'
        }
    },
    // בחירת שפה לשם - המרה ל-menu
    {
        path: 'orders/new/step_name_lang',
        config: {
            type: 'menu',
            title: 'בחירת שפה לשם',
            message: 'באיזו שפה ברצונך להקליט את השם? לחץ 1 עברית, 2 אנגלית.',
            option1: 'עברית',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_record_hebrew',
            option2: 'אנגלית',
            option2_action: 'go_to_folder',
            option2_value: '/orders/new/step_record_english'
        }
    },
    // אישור הזמנה - המרה ל-menu
    {
        path: 'orders/new/step_confirm_order',
        config: {
            type: 'menu',
            title: 'אישור הזמנה',
            message: 'האם לאשר את ההזמנה? לחץ 1 לאישור, 2 לביטול.',
            option1: 'אישור',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_final_confirm',
            option2: 'ביטול',
            option2_action: 'go_to_folder',
            option2_value: '/main'
        }
    },
    // אישור סופי - המרה ל-menu
    {
        path: 'orders/new/step_final_confirm',
        config: {
            type: 'menu',
            title: 'אישור סופי',
            message: 'אישור סופי להזמנה. לחץ 1 לאישור, 2 לביטול.',
            option1: 'אישור סופי',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_success',
            option2: 'ביטול',
            option2_action: 'go_to_folder',
            option2_value: '/main'
        }
    },
    // בחירת סניף - המרה ל-menu
    {
        path: 'orders/new/step_branch',
        config: {
            type: 'menu',
            title: 'בחירת סניף',
            message: 'בחירת סניף האיסוף.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_quantities'
        }
    },
    // בדיקת סטטוס - המרה ל-menu
    {
        path: 'status',
        config: {
            type: 'menu',
            title: 'בדיקת סטטוס',
            message: 'ברוכים הבאים לבדיקת סטטוס הזמנה.',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/status/step_id'
        }
    },
    // הקלטת שם בעברית - המרה ל-record
    {
        path: 'orders/new/step_record_hebrew',
        config: {
            type: 'record',
            title: 'הקלטת שם בעברית',
            message: 'אנא הקלט את שמך בעברית אות אחר אות, ובסיום לחץ חד-כיווני (#).',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_confirm_hebrew'
        }
    },
    // הקלטת שם באנגלית - המרה ל-record
    {
        path: 'orders/new/step_record_english',
        config: {
            type: 'record',
            title: 'הקלטת שם באנגלית',
            message: 'אנא הקלט את שמך באנגלית אות אחר אות, ובסיום לחץ חד-כיווני (#).',
            option1: 'המשך',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_confirm_english'
        }
    },
    // אישור הקלטה עברית - המרה ל-menu
    {
        path: 'orders/new/step_confirm_hebrew',
        config: {
            type: 'menu',
            title: 'אישור הקלטה עברית',
            message: 'האם ההקלטה נכונה? לחץ 1 לאישור, 2 להקלטה חוזרת.',
            option1: 'אישור',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_total',
            option2: 'הקלטה חוזרת',
            option2_action: 'go_to_folder',
            option2_value: '/orders/new/step_record_hebrew'
        }
    },
    // אישור הקלטה אנגלית - המרה ל-menu
    {
        path: 'orders/new/step_confirm_english',
        config: {
            type: 'menu',
            title: 'אישור הקלטה אנגלית',
            message: 'האם ההקלטה נכונה? לחץ 1 לאישור, 2 להקלטה חוזרת.',
            option1: 'אישור',
            option1_action: 'go_to_folder',
            option1_value: '/orders/new/step_total',
            option2: 'הקלטה חוזרת',
            option2_action: 'go_to_folder',
            option2_value: '/orders/new/step_record_english'
        }
    }
];

log('🔍 תצוגה מקדימה של ext.ini לתיקון:');
log('═══════════════════════════════════════════════════════════════\n');

// הצגת main
const mainConfig = correctExtensions.find(ext => ext.path === 'main');
log('📄 ext.ini עבור main:');
log('─────────────────────────────────────────────────────────────');
log(stringifyIni(mainConfig.config));
log('─────────────────────────────────────────────────────────────\n');

// הצגת input לדוגמה
const inputConfig = correctExtensions.find(ext => ext.path === 'orders/new/step_id');
log('📄 ext.ini עבור input לדוגמה (step_id):');
log('─────────────────────────────────────────────────────────────');
log(stringifyIni(inputConfig.config));
log('─────────────────────────────────────────────────────────────\n');

log('⏳ ממתין לאישור לפני העלאה ל-Yemot...');
log('אנא בדוק את התוכן ואשר שהוא נכון לפי תקני Yemot האמיתיים.');
