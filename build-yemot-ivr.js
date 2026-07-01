const YemotApiWrapper = require('./src/ivr/yemot-api-wrapper');
require('./env-loader');

function stringifyIni(config) {
    const lines = [];
    for (const [key, value] of Object.entries(config)) {
        lines.push(`${key}=${value}`);
    }
    return lines.join('\n');
}

async function createExtension(api, path, extConfig, files = []) {
    console.log(`
📌 יוצר שלוחה: ${path}`);
    await api.create_ext(path);
    console.log(`✅ שלוחה נוצרה: ${path}`);

    const iniContent = stringifyIni(extConfig);
    await api.upload_txt_file(`${path}/ext.ini`, iniContent);
    console.log(`✅ ext.ini הועלה ל-${path}/ext.ini`);

    for (const file of files) {
        await api.upload_txt_file(`${path}/${file.name}`, file.content);
        console.log(`✅ קובץ הועלה ל-${path}/${file.name}`);
    }
}

async function main() {
    console.log('🚀 מתחיל בניית מבנה IVR מלא ב-Yemot...');

    const api = new YemotApiWrapper();
    await api.connect(process.env.YEMOT_USERNAME, process.env.YEMOT_PASSWORD);

    const cityList = [
        { code: 'jerusalem', name: 'ירושלים' },
        { code: 'tel_aviv', name: 'תל אביב' },
        { code: 'haifa', name: 'חיפה' },
        { code: 'beer_sheva', name: 'באר שבע' },
        { code: 'nahariya', name: 'נהריה' }
    ];

    const cityListContent = cityList.map(c => `${c.code}=${c.name}`).join('\n');

    const extensions = [
        {
            path: 'main',
            config: {
                type: 'menu',
                title: 'תפריט ראשי',
                message: 'ברוכים הבאים למערכת ההזמנות. לחץ 1 להזמנה, 2 לבדיקת סטטוס, 3 להודעות, 0 לניהול פנימי.',
                option1: 'ביצוע הזמנה',
                option1_action: 'ivr2:/orders',
                option2: 'בירור סטטוס הזמנה',
                option2_action: 'ivr2:/status',
                option3: 'הודעות ועדכונים',
                option3_action: 'ivr2:/messages',
                option0: 'ניהול פנימי',
                option0_action: 'ivr2:/admin',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                timeout_message: 'הזמן עבר. להתראות.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                {
                    name: 'welcome.txt',
                    content: 'ברוכים הבאים למערכת הזמנות ימות. בחר אפשרות בתפריט הראשי.'
                }
            ]
        },
        {
            path: 'orders',
            config: {
                type: 'menu',
                title: 'הזמנות',
                message: 'לחץ 1 להתחלת תהליך הזמנה, 9 לחזרה לתפריט הראשי.',
                option1: 'התחל הזמנה',
                option1_action: 'ivr2:/orders/step1',
                option9: 'חזור לתפריט הראשי',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                timeout_message: 'הזמן עבר. חזרה לתפריט הראשי.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                { name: 'cities.list', content: cityListContent },
                { name: 'order_instructions.txt', content: 'המערכת תדרוש פרטי הזמנה לפי השלבים הבאים.' }
            ]
        },
        {
            path: 'status',
            config: {
                type: 'menu',
                title: 'סטטוס הזמנה',
                message: 'לקבלת סטטוס הזמנה הקש 1 והקש 9 לחזרה לתפריט הראשי.',
                option1: 'בדיקת סטטוס',
                option1_action: 'ivr2:/status/check',
                option9: 'חזור לתפריט הראשי',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                timeout_message: 'הזמן עבר. התנתק.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                { name: 'status_instructions.txt', content: 'הזנת מספר הזמנה תאפשר בדיקת סטטוס.' }
            ]
        },
        {
            path: 'messages',
            config: {
                type: 'menu',
                title: 'הודעות ועדכונים',
                message: 'ברוכים הבאים להודעות ועדכונים. לחץ 1 להודעות אחרונות, 9 לחזרה.',
                option1: 'הודעות אחרונות',
                option1_action: 'ivr2:/messages/list',
                option9: 'חזור לתפריט הראשי',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                timeout_message: 'הזמן עבר. התנתק.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                { name: 'messages.txt', content: 'כאן תוצג רשימת עדכונים והודעות מערכת.' }
            ]
        },
        {
            path: 'admin',
            config: {
                type: 'menu',
                title: 'ניהול פנימי',
                message: 'כאן ניתן לפתוח מסך ניהול פנימי. לחץ 1 לדוחות, 9 לחזרה.',
                option1: 'דוחות מערכת',
                option1_action: 'ivr2:/admin/reports',
                option9: 'חזור לתפריט הראשי',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                timeout_message: 'הזמן עבר. חזרה לתפריט הראשי.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                { name: 'admin_notes.txt', content: 'גישה פנימית למערכת הניהול של ימות.' }
            ]
        }
    ];

    const steps = [
        {
            path: 'orders/step1',
            config: {
                type: 'menu',
                title: 'הזנת תעודת זהות',
                message: 'אנא הקש תעודת זהות ולאחר מכן לחץ 1 להמשך.',
                option1: 'המשך',
                option1_action: 'ivr2:/orders/step2',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        },
        {
            path: 'orders/step2',
            config: {
                type: 'menu',
                title: 'הזנת טלפון',
                message: 'הקש מספר טלפון ולאחר מכן לחץ 1 להמשך.',
                option1: 'המשך',
                option1_action: 'ivr2:/orders/step3',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        },
        {
            path: 'orders/step3',
            config: {
                type: 'menu',
                title: 'בחירת דגם',
                message: 'הקש מספר דגם ולאחר מכן לחץ 1 להמשך.',
                option1: 'המשך',
                option1_action: 'ivr2:/orders/step4',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        },
        {
            path: 'orders/step4',
            config: {
                type: 'menu',
                title: 'בחירת עיר',
                message: 'בחר עיר מתוך הרשימה ולחץ 1 להמשך.',
                option1: 'המשך',
                option1_action: 'ivr2:/orders/step5',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            },
            files: [
                { name: 'city_list.txt', content: cityListContent }
            ]
        },
        {
            path: 'orders/step5',
            config: {
                type: 'menu',
                title: 'כמות חבילות',
                message: 'הקש כמות חבילות ולאחר מכן לחץ 1 להמשך.',
                option1: 'המשך',
                option1_action: 'ivr2:/orders/step6',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        },
        {
            path: 'orders/step6',
            config: {
                type: 'menu',
                title: 'שם אישי',
                message: 'האם אתה רוצה שם אישי? לחץ 1 כן, 9 לא.',
                option1: 'כן',
                option1_action: 'ivr2:/orders/step7',
                option9: 'לא',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        },
        {
            path: 'orders/step7',
            config: {
                type: 'menu',
                title: 'הקלטת שם',
                message: 'הקלט את שמך או לחץ 9 לביטול וחזרה לתפריט הראשי.',
                option9: 'ביטול וחזרה לתפריט',
                option9_action: 'ivr2:/main',
                timeout: 30,
                max_attempts: 3,
                invalid_option_message: 'אפשרות לא תקינה. נסו שנית.',
                language: 'he',
                direction: 'rtl'
            }
        }
    ];

    for (const extension of extensions) {
        await createExtension(api, extension.path, extension.config, extension.files);
    }

    for (const step of steps) {
        await createExtension(api, step.path, step.config, step.files || []);
    }

    console.log('\n✅ מבנה IVR ב-Yemot נבנה בהצלחה!');
    console.log('📌 סיכום:');
    console.log(`- שלוחות ראשיות: ${extensions.length}`);
    console.log(`- שלוחות צעדים: ${steps.length}`);
    console.log(`- קבצים נוצרו והועלו בהצלחה`);

    process.exit(0);
}

main().catch(error => {
    console.error('❌ שגיאה בבניית מבנה IVR:', error.message || error);
    process.exit(1);
});