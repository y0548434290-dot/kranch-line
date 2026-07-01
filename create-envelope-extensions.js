const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');
const fs = require('fs');
const path = require('path');

// יוצר לוג בעברית
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `שלב2-יצירת-שלוחות-${new Date().toISOString().slice(0,10)}.log`);

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

// הגדרת כל השלוחות
const mainExtensions = [
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
        },
        description: 'תפריט ראשי של המערכת'
    },
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
        },
        description: 'שלוחת ניהול פנימי'
    }
];

const orderExtensions = [
    {
        path: 'orders/new',
        config: {
            title: 'הזמנה חדשה - שלוחה 3.1',
            type: 'submenu',
            language: 'hebrew',
            direction: 'rtl',
            message: 'ברוכה הבאת ללקוחה למערכת הזמנות עטיפות.',
            next_step: 'ivr2:/orders/new/welcome'
        },
        description: 'מתחיל תהליך הזמנה חדשה'
    },
    {
        path: 'orders/new/welcome',
        config: {
            title: 'הודעה בדוקה',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'ברוכה הבאת ללקוחה אלמה למערכת הזמנות עטיאישית. אנחנו שמחים שבחרת בנו.',
            next_step: 'ivr2:/orders/new/step_id'
        },
        description: 'הודעת פתיחה ברוכה הבאה'
    },
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
        },
        description: 'הקלדת מספר זהות'
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
        },
        description: 'הקלדת מספר טלפון'
    },
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
        },
        description: 'בחירה: טלפון נוסף?'
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
            message: 'הקלד את מספר הטלפון הנוסף ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_model'
        },
        description: 'הקלדת טלפון נוסף'
    },
    {
        path: 'orders/new/step_model',
        config: {
            title: 'הקלדת דגם',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'הקלד את מספר הדגם של העטיפה וברסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_branch'
        },
        description: 'הקלדת מספר דגם'
    },
    {
        path: 'orders/new/step_branch',
        config: {
            title: 'בחירת מוקד',
            type: 'menu',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'בחר לאיזה מוקד ברצונך להזמין. לחץ 1-5 לבחירה.',
            option1: 'מוקד ירושלים',
            option1_action: 'ivr2:/orders/new/step_quantities',
            option2: 'מוקד תל אביב',
            option2_action: 'ivr2:/orders/new/step_quantities',
            option3: 'מוקד חיפה',
            option3_action: 'ivr2:/orders/new/step_quantities',
            option4: 'מוקד באר שבע',
            option4_action: 'ivr2:/orders/new/step_quantities',
            option5: 'מוקד נהריה',
            option5_action: 'ivr2:/orders/new/step_quantities'
        },
        description: 'בחירת מוקד משלוחה'
    },
    {
        path: 'orders/new/step_quantities',
        config: {
            title: 'הקלדת כמויות',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'הקלד את הכמויות: כמות ספרים, כמות מחברות, כמות ספרי אנגלית, ובסיום לחץ 1.',
            next_step: 'ivr2:/orders/new/step_personal_name'
        },
        description: 'הקלדת כמויות הזמנה'
    },
    {
        path: 'orders/new/step_personal_name',
        config: {
            title: 'שם אישי',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'האם ברצונך להוסיף שם אישי לעטיפות? לחץ 1 כן, 2 לא.',
            option1: 'כן',
            option1_action: 'ivr2:/orders/new/step_font_code',
            option2: 'לא',
            option2_action: 'ivr2:/orders/new/step_total'
        },
        description: 'בחירה: שם אישי?'
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
            message: 'הקלד את קוד הגופן הרצוי ובסיום לחץ 1 להמשך.',
            next_step: 'ivr2:/orders/new/step_record_hebrew'
        },
        description: 'הקלדת קוד גופן'
    },
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
        },
        description: 'הקלטת שם בעברית'
    },
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
            option1_action: 'ivr2:/orders/new/step_name_lang',
            option2: 'הקלטה חוזרת',
            option2_action: 'ivr2:/orders/new/step_record_hebrew'
        },
        description: 'אישור הקלטת שם עברי'
    },
    {
        path: 'orders/new/step_name_lang',
        config: {
            title: 'בחירת שפה',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'בדגם הנבחר, האם צריך שם גם בעברית או גם בעברית תרגום לאנגלית? לחץ 1 עברית בלבד, 2 גם אנגלית.',
            option1: 'עברית בלבד',
            option1_action: 'ivr2:/orders/new/step_total',
            option2: 'גם אנגלית',
            option2_action: 'ivr2:/orders/new/step_record_english'
        },
        description: 'בחירה: עברית או עברית+אנגלית?'
    },
    {
        path: 'orders/new/step_record_english',
        config: {
            title: 'הקלטת שם לעברית',
            type: 'recording',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'אנא הקלט את השם לעברית (לצורך תרגום) אות אחר אות, ובסיום לחץ חד-כיווני (#).',
            next_step: 'ivr2:/orders/new/step_confirm_english'
        },
        description: 'הקלטת שם לעברית'
    },
    {
        path: 'orders/new/step_confirm_english',
        config: {
            title: 'אישור הקלטה שנייה',
            type: 'confirmation',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'האם ההקלטה נכונה? לחץ 1 לאישור, 2 להקלטה חוזרת.',
            option1: 'אישור',
            option1_action: 'ivr2:/orders/new/step_total',
            option2: 'הקלטה חוזרת',
            option2_action: 'ivr2:/orders/new/step_record_english'
        },
        description: 'אישור הקלטה שנייה'
    },
    {
        path: 'orders/new/step_total',
        config: {
            title: 'הודעת סה"כ',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'סה"כ לתשלום: משתנה בהתאם ההזמנה. המערכת תשמיע את הסה"כ עבורך.',
            next_step: 'ivr2:/orders/new/step_confirm_order'
        },
        description: 'הודעת הסכום הסופי'
    },
    {
        path: 'orders/new/step_confirm_order',
        config: {
            title: 'הקלטת אישור הזמנה',
            type: 'recording',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'אנא הקלט אישור עבור ההזמנה הזו. המערכת תשמיע את כל פרטי ההזמנה, ובסיום לחץ חד-כיווני (#).',
            next_step: 'ivr2:/orders/new/step_final_confirm'
        },
        description: 'הקלטת אישור ההזמנה'
    },
    {
        path: 'orders/new/step_final_confirm',
        config: {
            title: 'אישור סופי',
            type: 'choice',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            message: 'זו ההזמנה הסופית שלך. לחץ 1 לאישור סופי, 2 לביטול וחזרה לתפריט הראשי.',
            option1: 'אישור סופי',
            option1_action: 'ivr2:/orders/new/step_success',
            option2: 'ביטול',
            option2_action: 'ivr2:/main'
        },
        description: 'אישור סופי או ביטול'
    },
    {
        path: 'orders/new/step_success',
        config: {
            title: 'הזמנה קבלה',
            type: 'message',
            language: 'hebrew',
            direction: 'rtl',
            message: 'הזמנתך התקבלה בהצלחה! תודה על בחירתך. שיחה נסגרה.',
            next_step: 'ivr2:/main'
        },
        description: 'הודעת סיום וקבלת הזמנה'
    }
];

const statusExtensions = [
    {
        path: 'status',
        config: {
            title: 'סטטוס הזמנה - שלוחה 5',
            type: 'submenu',
            language: 'hebrew',
            direction: 'rtl',
            message: 'בדיקת מצב ההזמנה שלך.',
            next_step: 'ivr2:/status/step_id'
        },
        description: 'מתחיל תהליך בדיקת סטטוס'
    },
    {
        path: 'status/step_id',
        config: {
            title: 'הקלדת זהות לסטטוס',
            type: 'input',
            language: 'hebrew',
            direction: 'rtl',
            timeout: 30,
            max_attempts: 3,
            message: 'הקלד את מספר הזהות שלך כדי לברר את סטטוס ההזמנה, ובסיום לחץ 1.',
            next_step: 'ivr2:/status/step_result'
        },
        description: 'הקלדת מספר זהות לבדיקה'
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
        },
        description: 'הודעת סטטוס ההזמנה'
    }
];

async function createExtension(api, extension) {
    try {
        log(`🔨 יוצר שלוחה: ${extension.path}`);
        await api.create_ext(extension.path);
        log(`✅ שלוחה נוצרה: ${extension.path}`);

        // העלאת ext.ini
        const iniContent = stringifyIni(extension.config);
        await api.upload_txt_file(`${extension.path}/ext.ini`, iniContent);
        log(`✅ ext.ini הועלה ל: ${extension.path}/ext.ini`);

        return { path: extension.path, success: true, description: extension.description };
    } catch (error) {
        log(`❌ שגיאה ביצירת שלוחה ${extension.path}: ${error.message}`);
        return { path: extension.path, success: false, error: error.message, description: extension.description };
    }
}

async function main() {
    log('═══════════════════════════════════════════════════════════════');
    log('🚀 התחלת שלב 2: יצירת שלוחות בימות המשיח');
    log('═══════════════════════════════════════════════════════════════');

    const api = new YemotApiWrapper();
    
    try {
        log('📱 התחברות ל-Yemot...');
        await api.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);
        log('✅ התחברות הצליחה');
    } catch (error) {
        log(`❌ שגיאה בהתחברות ל-Yemot: ${error.message}`);
        process.exit(1);
    }

    const results = {
        main: [],
        orders: [],
        status: [],
        total: 0,
        success: 0,
        failed: 0
    };

    // יצירת שלוחות ראשיות
    log('\n📌 שלב 1/3: יצירת שלוחות ראשיות');
    log('─────────────────────────────────────────────────────────────');
    for (const ext of mainExtensions) {
        const result = await createExtension(api, ext);
        results.main.push(result);
        results.total++;
        if (result.success) results.success++;
        else results.failed++;
    }

    // יצירת שלוחות הזמנה
    log('\n📌 שלב 2/3: יצירת שלוחות הזמנה');
    log('─────────────────────────────────────────────────────────────');
    for (const ext of orderExtensions) {
        const result = await createExtension(api, ext);
        results.orders.push(result);
        results.total++;
        if (result.success) results.success++;
        else results.failed++;
    }

    // יצירת שלוחות סטטוס
    log('\n📌 שלב 3/3: יצירת שלוחות סטטוס');
    log('─────────────────────────────────────────────────────────────');
    for (const ext of statusExtensions) {
        const result = await createExtension(api, ext);
        results.status.push(result);
        results.total++;
        if (result.success) results.success++;
        else results.failed++;
    }

    // סיכום
    log('\n═══════════════════════════════════════════════════════════════');
    log('📊 סיכום שלב 2');
    log('═══════════════════════════════════════════════════════════════');
    log(`📊 סה"כ שלוחות: ${results.total}`);
    log(`✅ שלוחות שנוצרו בהצלחה: ${results.success}`);
    log(`❌ שלוחות שנכשלו: ${results.failed}`);

    if (results.failed > 0) {
        log('\n⚠️  שלוחות שנכשלו:');
        [...results.main, ...results.orders, ...results.status]
            .filter(r => !r.success)
            .forEach(r => log(`  ❌ ${r.path}: ${r.error}`));
        process.exit(1);
    }

    log('\n✅ כל השלוחות נוצרו בהצלחה!');
    log('\nנתיבי Yemot:');
    [...results.main, ...results.orders, ...results.status]
        .filter(r => r.success)
        .forEach(r => log(`  ✓ ivr2:/${r.path}`));

    process.exit(0);
}

main().catch(error => {
    log(`❌ שגיאה קריטית: ${error.message}`);
    process.exit(1);
});
