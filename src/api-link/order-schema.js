const { looksLikeRecordingReference } = require('./yemot-recordings');

// תמלול הקלטת שם המשפחה נחוץ רק כשהיא ההקלטה היחידה בהזמנה:
// כשיש הקלטת שם עברי / אותיות אנגלית / שם אנגלי — השם מגיע ממנה,
// ותמלול שם המשפחה מיותר (חוסך קריאות תמלול ובדיקות צוות).
const LASTNAME_SIBLING_RECORDING_KEYS = ['hebrewNameRecording', 'englishLettersRecording', 'englishNameRecording'];

function lastNameTranscriptionNeeded(order) {
    return !LASTNAME_SIBLING_RECORDING_KEYS.some((key) => looksLikeRecordingReference(order[key]));
}

const RECORDING_TRANSCRIPTION_FIELDS = {
    lastNameRecording: {
        transcriptKey: 'lastNameRecordingTranscript',
        normalizedKey: 'lastNameRecordingNormalized',
        finalKey: 'lastNameRecordingFinal',
        confidenceKey: 'lastNameRecordingConfidence',
        needsReviewKey: 'lastNameRecordingNeedsReview',
        statusKey: 'lastNameRecordingStatus',
        verificationStatusKey: 'lastNameRecordingVerificationStatus',
        errorKey: 'lastNameRecordingError'
    },
    hebrewNameRecording: {
        transcriptKey: 'hebrewNameRecordingTranscript',
        normalizedKey: 'hebrewNameRecordingNormalized',
        finalKey: 'hebrewNameRecordingFinal',
        confidenceKey: 'hebrewNameRecordingConfidence',
        needsReviewKey: 'hebrewNameRecordingNeedsReview',
        statusKey: 'hebrewNameRecordingStatus',
        verificationStatusKey: 'hebrewNameRecordingVerificationStatus',
        errorKey: 'hebrewNameRecordingError'
    },
    englishLettersRecording: {
        transcriptKey: 'englishLettersRecordingTranscript',
        normalizedKey: 'englishLettersRecordingNormalized',
        finalKey: 'englishLettersRecordingFinal',
        confidenceKey: 'englishLettersRecordingConfidence',
        needsReviewKey: 'englishLettersRecordingNeedsReview',
        statusKey: 'englishLettersRecordingStatus',
        verificationStatusKey: 'englishLettersRecordingVerificationStatus',
        errorKey: 'englishLettersRecordingError'
    },
    englishNameRecording: {
        transcriptKey: 'englishNameRecordingTranscript',
        normalizedKey: 'englishNameRecordingNormalized',
        finalKey: 'englishNameRecordingFinal',
        confidenceKey: 'englishNameRecordingConfidence',
        needsReviewKey: 'englishNameRecordingNeedsReview',
        statusKey: 'englishNameRecordingStatus',
        verificationStatusKey: 'englishNameRecordingVerificationStatus',
        errorKey: 'englishNameRecordingError'
    }
};

// סדר העמודות בגיליון "הזמנות" (פריסה חדשה 26.6.2026).
// הכתיבה לגיליון היא לפי שם הכותרת (header) — ה-headers כאן חייבים להיות זהים
// בדיוק לכותרות בגיליון. "סה\"כ לתשלום" ו"מייל אישור נשלח" אינם כאן בכוונה:
// הם מנוהלים ע"י סקריפט הטופס (נוסחת/חישוב סכום וסימון שליחת מייל) ולכן הטלפון
// משאיר אותם ריקים ולא דורס. השדות בסוף ("מושמטים") נשמרים לתאימות לאחור.
const ORDER_COLUMNS = [
    { key: 'createdAt', header: 'נוצר בתאריך' },
    { key: 'email', header: 'מייל' },
    { key: 'enteredPhone', header: 'טלפון שהוקש' },
    { key: 'lastNameRecordingFinal', header: 'שם משפחה' },
    { key: 'idNumber', header: 'תעודת זהות' },
    { key: 'pickupLabel', header: 'מוקד איסוף מלא' },
    { key: 'productModel', header: 'מספר דגם' },
    { key: 'booksQuantity', header: 'כמות חבילות ספרים' },
    { key: 'englishBooksQuantity', header: 'כמות חבילות ספרי אנגלית' },
    { key: 'notebooksQuantity', header: 'כמות חבילות מחברות' },
    { key: 'englishNotebooksQuantity', header: 'כמות חבילות מחברות אנגלית' },
    { key: 'wantsHebrewName', header: 'האם שם אישי?' },
    { key: 'hebrewNameRecordingFinal', header: 'שם עברי סופי מאושר' },
    { key: 'hebrewNameRecording', header: 'הקלטה עברית' },
    { key: 'hebrewNameRecordingNeedsReview', header: 'בדיקה עברית' },
    { key: 'classLabel', header: 'כיתה' },
    { key: 'hebrewFont', header: 'גופן עברי' },
    { key: 'englishLettersRecordingFinal', header: 'אותיות אנגלית סופי מאושר' },
    { key: 'englishLettersRecordingNeedsReview', header: 'בדיקה אותיות' },
    { key: 'englishLettersRecording', header: 'הקלטה אותיות' },
    { key: 'englishClassLabel', header: 'האם כיתה לאנגלית?' },
    { key: 'englishNameLanguage', header: 'שפת השם באנגלית' },
    { key: 'englishNameRecordingFinal', header: 'שם אנגלית סופי מאושר' },
    { key: 'englishNameRecordingNeedsReview', header: 'בדיקה אנגלית' },
    { key: 'englishNameRecording', header: 'הקלטה אנגלית' },
    { key: 'englishFont', header: 'גופן אנגלית' },
    { key: 'status', header: 'סטטוס' },
    { key: 'orderSource', header: 'מקור הזמנה' },
    { key: 'orderNumber', header: 'מספר הזמנה' },
    { key: 'pickupCityArea', header: 'עיר/אזור איסוף' },
    { key: 'approvedAt', header: 'אושר בתאריך' },
    { key: 'callerPhone', header: 'טלפון מזוהה' },
    // מושמטים — נשמרים בסוף (לא נמחקים)
    { key: 'hasEnglishLetters', header: 'יש אנגלית בדוגמה' },
    { key: 'wantsEnglishName', header: 'שם אישי לאנגלית' },
    { key: 'lastNameRecording', header: 'הקלטת שם משפחה' },
    { key: 'lastNameRecordingNeedsReview', header: 'בדיקה נדרשת שם משפחה' },
    // צנתוקים — סימון ✓ שולח צנתוק ללקוח; הסטטוס מנוהל ע"י tzintuk-service
    { key: 'tzintukRequested', header: 'שלחי צנתוק' },
    { key: 'tzintukStatus', header: 'סטטוס צנתוק' }
];

const CITY_NAMES = {
    1: 'ירושלים',
    2: 'בני ברק',
    3: "אשדוד רובע ז'",
    4: 'אלעד',
    5: 'בית שמש',
    6: 'ביתר עילית',
    7: 'חיפה',
    8: 'מודיעין עילית'
};

const AREA_NAMES = {
    1: {
        1: 'אזור בר אילן',
        2: 'אזור רוממה'
    },
    2: {
        1: 'אזור רבי עקיבא',
        2: 'אזור עזרא'
    },
    5: {
        1: "רמה ב'",
        2: "רמה ד'"
    }
};

function buildPickupLabel(city, area = '') {
    return area ? `${city} ${area}` : city;
}

function buildProductsSummary(order) {
    const parts = [
        `דגם ${order.productModel}`,
        `ספרים: ${order.booksQuantity || 0}`,
        `מחברות: ${order.notebooksQuantity || 0}`,
        `ספרי אנגלית: ${order.englishBooksQuantity || 0}`,
        `מחברות אנגלית: ${order.englishNotebooksQuantity || 0}`
    ];

    if (order.wantsHebrewName === 'כן') {
        parts.push(`שם עברי עם גופן ${order.hebrewFont || 'לא נבחר'}`);
    }

    if (order.classLabel) {
        parts.push(`כיתה ${order.classLabel}`);
    }

    if (order.hasEnglishLetters === 'כן') {
        parts.push('כולל אותיות באנגלית');
    }

    if (order.wantsEnglishName === 'כן') {
        parts.push(`שם באנגלית בשפה ${order.englishNameLanguage || 'לא נבחרה'} עם גופן ${order.englishFont || 'לא נבחר'}`);
    }

    return parts.join(' | ');
}

function buildOrderSummaryText(order) {
    return [
        `מספר הזמנה: ${order.orderNumber}`,
        `טלפון: ${order.enteredPhone}`,
        `תעודת זהות: ${order.idNumber}`,
        `מייל: ${order.email || ''}`,
        `מוקד: ${order.pickupLabel}`,
        `דגם: ${order.productModel}`,
        `חבילות ספרים: ${order.booksQuantity}`,
        `חבילות מחברות: ${order.notebooksQuantity}`,
        `חבילות ספרי אנגלית: ${order.englishBooksQuantity || 0}`,
        `חבילות מחברות אנגלית: ${order.englishNotebooksQuantity || 0}`,
        `שם אישי בעברית: ${order.wantsHebrewName}`,
        `שם אישי לאנגלית: ${order.wantsEnglishName}`,
        `מקור הזמנה: ${order.orderSource || ''}`
    ].join(' | ');
}

module.exports = {
    ORDER_COLUMNS,
    RECORDING_TRANSCRIPTION_FIELDS,
    lastNameTranscriptionNeeded,
    CITY_NAMES,
    AREA_NAMES,
    buildPickupLabel,
    buildProductsSummary,
    buildOrderSummaryText
};
