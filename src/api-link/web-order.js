const {
    CITY_NAMES,
    AREA_NAMES,
    buildPickupLabel,
    buildProductsSummary,
    buildOrderSummaryText
} = require('./order-schema');

function validateWebOrder(payload) {
    const errors = [];

    if (!/^\d{9,10}$/.test(String(payload.enteredPhone || ''))) {
        errors.push('מספר טלפון לא תקין');
    }

    if (!/^\d{8,9}$/.test(String(payload.idNumber || ''))) {
        errors.push('מספר תעודת זהות לא תקין');
    }

    if (!CITY_NAMES[payload.pickupCityKey]) {
        errors.push('יש לבחור מוקד איסוף');
    }

    if (!String(payload.productModel || '').trim()) {
        errors.push('יש להזין מספר דגם');
    }

    if (!/^\d+$/.test(String(payload.booksQuantity || ''))) {
        errors.push('כמות חבילות ספרים לא תקינה');
    }

    if (!/^\d+$/.test(String(payload.notebooksQuantity ?? ''))) {
        errors.push('כמות חבילות מחברות לא תקינה');
    }

    if (!/^\d+$/.test(String(payload.englishBooksQuantity ?? ''))) {
        errors.push('כמות ספרי אנגלית לא תקינה');
    }

    if (!/^\d+$/.test(String(payload.englishNotebooksQuantity ?? ''))) {
        errors.push('כמות מחברות אנגלית לא תקינה');
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email))) {
        errors.push('כתובת מייל לא תקינה');
    }

    const requiresArea = AREA_NAMES[payload.pickupCityKey];
    if (requiresArea && !requiresArea[payload.pickupAreaKey]) {
        errors.push('יש לבחור אזור איסוף');
    }

    return errors;
}

function createWebOrder(payload) {
    const pickupCity = CITY_NAMES[payload.pickupCityKey];
    const pickupArea = AREA_NAMES[payload.pickupCityKey]?.[payload.pickupAreaKey] || '';

    const order = {
        orderNumber: String(payload.idNumber || ''),
        createdAt: nowInIsrael(),
        approvedAt: nowInIsrael(),
        callId: `web-${Date.now()}`,
        callerPhone: '',
        enteredPhone: String(payload.enteredPhone || ''),
        idNumber: String(payload.idNumber || ''),
        email: String(payload.email || '').trim(),
        pickupCity,
        pickupArea,
        pickupLabel: buildPickupLabel(pickupCity, pickupArea),
        pickupCityArea: buildPickupLabel(pickupCity, pickupArea),
        productModel: String(payload.productModel || '').trim(),
        booksQuantity: String(payload.booksQuantity || '0'),
        notebooksQuantity: String(payload.notebooksQuantity || '0'),
        wantsHebrewName: payload.wantsHebrewName === '1' ? 'כן' : 'לא',
        hebrewNameRecording: String(payload.hebrewNameText || '').trim(),
        hebrewFont: String(payload.hebrewFont || '').trim(),
        hasEnglishLetters: payload.hasEnglishLetters === '1' ? 'כן' : 'לא',
        englishLettersRecording: String(payload.englishLettersText || '').trim(),
        englishBooksQuantity: String(payload.englishBooksQuantity || '0'),
        englishNotebooksQuantity: String(payload.englishNotebooksQuantity || '0'),
        wantsEnglishName: payload.wantsEnglishName === '1' ? 'כן' : 'לא',
        englishNameLanguage: payload.englishNameLanguage === '2' ? 'אנגלית' : payload.englishNameLanguage === '1' ? 'עברית' : '',
        englishNameRecording: String(payload.englishNameText || '').trim(),
        englishFont: String(payload.englishFont || '').trim(),
        orderSource: 'טופס ממוחשב',
        status: 'מוזמן'
    };

    order.productsSummary = buildProductsSummary(order);
    order.quantitiesSummary = [
        `ספרים: ${order.booksQuantity}`,
        `מחברות: ${order.notebooksQuantity}`,
        `ספרי אנגלית: ${order.englishBooksQuantity}`,
        `מחברות אנגלית: ${order.englishNotebooksQuantity}`
    ].join(' | ');
    order.orderSummaryText = buildOrderSummaryText(order);

    return order;
}

function nowInIsrael() {
    return new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

module.exports = {
    validateWebOrder,
    createWebOrder
};
