const {
    CITY_NAMES,
    AREA_NAMES,
    buildPickupLabel,
    buildProductsSummary,
    buildOrderSummaryText
} = require('./order-schema');
const { say, cityLine, areaLine, gradeLine } = require('./voice-lines');

async function handleOrderCall(call, sheets) {
    const order = {
        orderNumber: '',
        createdAt: nowInIsrael(),
        callId: call.callId,
        callerPhone: call.phone || '',
        email: '',
        orderSource: 'הזמנה טלפונית',
        status: 'ההזמנה התקבלה'
    };

    order.enteredPhone = await readConfirmedDigits(call, {
        prompt: say('ask_phone'),
        confirmLabel: say('confirm_phone'),
        options: {
            max_digits: 10,
            min_digits: 9,
            sec_wait: 15,
            typing_playback_mode: 'Phone'
        }
    });

    // שם משפחה — נשאל מכולם מיד אחרי הטלפון (לזיהוי ההזמנה). נשמר בעמודה נפרדת "שם משפחה"
    // ומתומלל אוטומטית כמו שאר ההקלטות, כך שאינו נדרס על ידי הקלטת השם האישי.
    order.lastNameRecording = await readConfirmedRecording(call, {
        prompt: say('ask_lastname')
    });

    while (true) {
        order.idNumber = await readConfirmedDigits(call, {
            prompt: say('ask_id'),
            confirmLabel: say('confirm_id'),
            options: {
                max_digits: 9,
                min_digits: 8,
                sec_wait: 15,
                typing_playback_mode: 'TeudatZehut'
            }
        });

        // בדיקה האם כבר קיימת הזמנה עם מספר תעודת זהות זה בגיליון "הזמנות"
        let existingOrder = null;
        try {
            existingOrder = await sheets.findOrderByNumber(order.idNumber);
        } catch (error) {
            // אם בדיקת הקיום נכשלה לא חוסמים את ההזמנה וממשיכים כרגיל
            console.error(`[order] Failed checking existing id ${order.idNumber}: ${error.message}`);
        }

        if (!existingOrder) {
            break;
        }

        await call.id_list_message([
            say('dup_id_1'),
            say('dup_id_2')
        ], {
            prependToNextAction: true
        });
    }
    order.orderNumber = order.idNumber;

    // בחירת מוקד האיסוף — אם הלקוחה מבקשת לשנות, חוזרים רק לשלב זה (לא לכל השיחה)
    order.pickupCityKey = '';
    order.pickupAreaKey = '';
    while (true) {
        const cityKey = await call.read([say('city_menu')], 'tap', {
            max_digits: 1,
            min_digits: 1,
            sec_wait: 20,
            digits_allowed: ['1', '2', '3', '4', '5', '6', '7', '8'],
            typing_playback_mode: 'No'
        });

        order.pickupCity = CITY_NAMES[parseInt(cityKey, 10)];
        order.pickupCityKey = cityKey;
        order.pickupArea = '';
        order.pickupAreaKey = '';

        if (AREA_NAMES[cityKey]) {
            const areas = AREA_NAMES[cityKey];
            const areaKey = await call.read([say(`area_menu_${cityKey}`)], 'tap', {
                max_digits: 1,
                min_digits: 1,
                sec_wait: 15,
                digits_allowed: Object.keys(areas),
                typing_playback_mode: 'No'
            });

            order.pickupArea = areas[areaKey];
            order.pickupAreaKey = areaKey;
        }

        order.pickupLabel = buildPickupLabel(order.pickupCity, order.pickupArea);
        // עמודה ממוזגת "עיר/אזור איסוף" (החליפה את "עיר איסוף"+"אזור איסוף" הנפרדות)
        order.pickupCityArea = order.pickupLabel;

        const pickupApproval = await call.read([
            say('pickup_confirm_label'),
            ...pickupVoice(order),
            say('approve_or_change')
        ], 'tap', {
            max_digits: 1,
            min_digits: 1,
            sec_wait: 10,
            digits_allowed: ['1', '2'],
            typing_playback_mode: 'No'
        });

        if (pickupApproval === '1') {
            break;
        }
    }

    order.productModel = await readConfirmedDigits(call, {
        prompt: say('ask_model'),
        confirmLabel: say('confirm_model'),
        playbackType: 'number',
        options: {
            max_digits: 10,
            min_digits: 1,
            sec_wait: 15,
            typing_playback_mode: 'Number'
        }
    });

    order.booksQuantity = await readConfirmedDigits(call, {
        prompt: say('ask_books'),
        confirmLabel: say('confirm_books'),
        playbackType: 'number',
        options: {
            max_digits: 3,
            min_digits: 1,
            sec_wait: 15,
            typing_playback_mode: 'Number'
        }
    });

    order.notebooksQuantity = await readConfirmedDigits(call, {
        prompt: say('ask_notebooks'),
        confirmLabel: say('confirm_notebooks'),
        playbackType: 'number',
        options: {
            max_digits: 3,
            min_digits: 1,
            sec_wait: 15,
            typing_playback_mode: 'Number'
        }
    });

    const wantsHebrewName = await readConfirmedChoice(call, {
        prompt: [say('ask_hebrew_name_choice')],
        options: {
            max_digits: 1,
            min_digits: 1,
            sec_wait: 15,
            digits_allowed: ['1', '2']
        },
        confirmLabel: say('choice_confirm_label'),
        valueToMessages: (value) => [value === '1' ? say('with_hebrew_name') : say('without_hebrew_name')]
    });

    order.wantsHebrewName = wantsHebrewName === '1' ? 'כן' : 'לא';
    order.hebrewNameRecording = '';
    order.classLabel = '';
    order.classLetter = '';
    order.classParallel = '';
    order.classGradeKey = '';
    order.hebrewFont = '';
    order.hasEnglishLetters = 'לא';
    order.englishLettersRecording = '';

    if (wantsHebrewName === '1') {
        order.hebrewNameRecording = await readConfirmedRecording(call, {
            prompt: say('ask_hebrew_name_rec')
        });

        // הוספת כיתה לשם האישי (אחרי איות השם בעברית)
        const wantsClass = await call.read([say('ask_add_class')], 'tap', {
            max_digits: 1,
            min_digits: 1,
            sec_wait: 15,
            digits_allowed: ['1', '2'],
            typing_playback_mode: 'No'
        });

        if (wantsClass === '1') {
            const personalClass = await readPersonalClass(call);
            order.classLetter = personalClass.letter;
            order.classParallel = personalClass.parallel;
            order.classLabel = personalClass.label;
            order.classGradeKey = personalClass.gradeKey;
        }

        order.hebrewFont = await readConfirmedDigits(call, {
            prompt: say('ask_hebrew_font'),
            confirmLabel: say('confirm_font'),
            playbackType: 'number',
            options: {
                max_digits: 2,
                min_digits: 1,
                sec_wait: 15,
                typing_playback_mode: 'Number'
            }
        });

        const hasEnglishLetters = await readConfirmedChoice(call, {
            prompt: [say('ask_english_letters_choice')],
            options: {
                max_digits: 1,
                min_digits: 1,
                sec_wait: 15,
                digits_allowed: ['1', '2']
            },
            confirmLabel: say('choice_confirm_label'),
            valueToMessages: (value) => [value === '1' ? say('has_english_letters') : say('no_english_letters')]
        });

        order.hasEnglishLetters = hasEnglishLetters === '1' ? 'כן' : 'לא';

        if (hasEnglishLetters === '1') {
            order.englishLettersRecording = await readConfirmedRecording(call, {
                prompt: say('ask_english_letters_rec')
            });
        }
    }

    // שאלת ספרי אנגלית נפתחת רק אם הוזמנו ספרים (אחרת אין מתוך מה להחליף)
    order.englishBooksQuantity = '0';
    if (parseInt(order.booksQuantity, 10) > 0) {
        order.englishBooksQuantity = await readConfirmedDigits(call, {
            prompt: say('ask_english_books'),
            confirmLabel: say('confirm_english_books'),
            playbackType: 'number',
            options: {
                max_digits: 3,
                min_digits: 1,
                sec_wait: 15,
                typing_playback_mode: 'Number'
            }
        });
    }

    // שאלת מחברות אנגלית נפתחת רק אם הוזמנו מחברות (אחרת אין מתוך מה להחליף)
    order.englishNotebooksQuantity = '0';
    if (parseInt(order.notebooksQuantity, 10) > 0) {
        order.englishNotebooksQuantity = await readConfirmedDigits(call, {
            prompt: say('ask_english_notebooks'),
            confirmLabel: say('confirm_english_notebooks'),
            playbackType: 'number',
            options: {
                max_digits: 3,
                min_digits: 1,
                sec_wait: 15,
                typing_playback_mode: 'Number'
            }
        });
    }

    order.wantsEnglishName = 'לא';
    order.englishNameLanguage = '';
    order.englishNameRecording = '';
    order.englishClassLabel = '';
    order.englishClassLetter = '';
    order.englishClassParallel = '';
    order.englishFont = '';

    // שאלת השם האישי לספרי/מחברות אנגלית נפתחת רק למי שבחרה עטיפה עם שם אישי בעברית.
    // אין אפשרות לשם אישי על ספרי/מחברות אנגלית בלבד (ללא שם בעברית).
    const hasEnglishProducts = parseInt(order.englishBooksQuantity, 10) > 0 || parseInt(order.englishNotebooksQuantity, 10) > 0;
    if (hasEnglishProducts && order.wantsHebrewName === 'כן') {
        const wantsEnglishName = await readConfirmedChoice(call, {
            prompt: [say('ask_english_name_choice')],
            options: {
                max_digits: 1,
                min_digits: 1,
                sec_wait: 15,
                digits_allowed: ['1', '2']
            },
            confirmLabel: say('choice_confirm_label'),
            valueToMessages: (value) => [value === '1' ? say('with_english_name') : say('without_english_name')]
        });

        order.wantsEnglishName = wantsEnglishName === '1' ? 'כן' : 'לא';

        if (wantsEnglishName === '1') {
            // שאלת השפה (עברית כמו בספרים העבריים / אנגלית) נפתחת רק למי שבחרה עטיפה עם שם בעברית,
            // כי "כמו בספרים העבריים" אפשרי רק כשיש שם בעברית.
            const englishNameLanguage = await readConfirmedChoice(call, {
                prompt: [say('ask_english_lang')],
                options: {
                    max_digits: 1,
                    min_digits: 1,
                    sec_wait: 15,
                    digits_allowed: ['1', '2']
                },
                confirmLabel: say('lang_confirm_label'),
                valueToMessages: (value) => [value === '1' ? say('lang_hebrew') : say('lang_english')]
            });

            order.englishNameLanguage = englishNameLanguage === '1' ? 'עברית' : 'אנגלית';

            if (englishNameLanguage === '2') {
                order.englishNameRecording = await readConfirmedRecording(call, {
                    prompt: say('ask_english_name_rec')
                });

                // כיתה לשם האנגלי — אוטומטית זהה לכיתה שנבחרה בעברית, ללא שאלה חוזרת.
                order.englishClassLetter = order.classLetter;
                order.englishClassParallel = order.classParallel;
                order.englishClassLabel = order.classLabel;
            }

            order.englishFont = await readConfirmedDigits(call, {
                prompt: say('ask_english_font'),
                confirmLabel: say('confirm_font'),
                playbackType: 'number',
                options: {
                    max_digits: 2,
                    min_digits: 1,
                    sec_wait: 15,
                    typing_playback_mode: 'Number'
                }
            });
        }
    }

    order.productsSummary = buildProductsSummary(order);
    order.quantitiesSummary = [
        `ספרים: ${order.booksQuantity}`,
        `מחברות: ${order.notebooksQuantity}`,
        `ספרי אנגלית: ${order.englishBooksQuantity}`,
        `מחברות אנגלית: ${order.englishNotebooksQuantity}`
    ].join(' | ');
    order.orderSummaryText = buildOrderSummaryText(order);
    order.totalPrice = computeOrderTotal(order);

    const approval = await call.read(buildSummaryMessages(order), 'tap', {
        max_digits: 1,
        min_digits: 1,
        sec_wait: 20,
        digits_allowed: ['1', '2']
    });

    // לתיקון — מתחילים את ההזמנה מחדש מההתחלה
    if (approval === '2') {
        return handleOrderCall(call, sheets);
    }

    if (approval !== '1') {
        return call.hangup();
    }

    order.approvedAt = nowInIsrael();
    console.log(`[order] Saving approved order ${order.orderNumber} for call ${order.callId}`);

    try {
        const savedRange = await sheets.saveApprovedOrder(order);
        console.log(`[order] Saved approved order ${order.orderNumber} to ${savedRange || 'Google Sheets'}`);
    } catch (error) {
        console.error(`[order] Failed saving order ${order.orderNumber}: ${error.stack || error.message || error}`);
        return call.id_list_message([
            say('save_error_1'),
            say('save_error_2')
        ]);
    }

    await call.id_list_message([
        say('success_1'),
        say('success_2')
    ], {
        prependToNextAction: true
    });

    return call.hangup();
}

async function handleStatusCall(call, sheets) {
    const orderNumber = await readConfirmedDigits(call, {
        prompt: say('ask_status_order'),
        confirmLabel: say('confirm_status_order'),
        playbackType: 'digits',
        options: {
            max_digits: 16,
            min_digits: 6,
            sec_wait: 15,
            typing_playback_mode: 'Number'
        }
    });

    const order = await sheets.findOrderByNumber(orderNumber);
    if (!order) {
        return call.id_list_message([
            say('status_not_found')
        ]);
    }

    await call.id_list_message([
        say('status_checking')
    ], {
        prependToNextAction: true
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // ערך הסטטוס עצמו מגיע מהגיליון (טקסט חופשי שמשתנה לפי מה שמקלידים),
    // ולכן הוא מושמע ב-TTS של ימות. שאר המלל בקו הוא אודיו אמיתי מוקלט מראש.
    await call.id_list_message([
        say('status_your_status'),
        { type: 'text', data: order.status || 'לא ידוע' }
    ], {
        prependToNextAction: true
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
    return call.hangup();
}

// שער הכניסה של הקו (שורש ext.ini מפנה לכאן): אם למתקשרת יש הודעה ממתינה
// (קיבלה צנתוק וטרם שמעה) — משמיעים את סטטוס ההזמנה שלה עם אפשרות חזרה,
// ואז ממשיכים לתפריט הראשי. לכל השאר — מעבר מיידי ושקוף לתפריט /0.
async function handleEntryCall(call, sheets, tzintuk) {
    const rowNumber = tzintuk.getPendingRow(call.phone); // מתקשרת חסויה/לא מוכרת → null
    if (!rowNumber) {
        return call.go_to_folder('/0');
    }

    // קריאה טרייה של תא הסטטוס — ההודעה היא מה שכתוב בגיליון ברגע השיחה.
    let statusText = '';
    try {
        const orders = await sheets.listOrdersWithRowNumbers();
        const order = orders.find((item) => item._rowNumber === rowNumber);
        statusText = String(order?.status || '').trim();
    } catch (error) {
        console.error(`[tzintuk] Entry status lookup failed: ${error.message}`);
        return call.go_to_folder('/0'); // תקלת גיליון לא חוסמת את הכניסה לקו
    }

    // מסמנים "הושמע" כבר עכשיו — גם ניתוק באמצע לא ישאיר את ההודעה תקועה בלולאה.
    tzintuk.markDelivered(call.phone).catch((error) => {
        console.error(`[tzintuk] markDelivered failed: ${error.message}`);
    });

    // ערך הסטטוס הוא טקסט חופשי מהגיליון ולכן מושמע ב-TTS של ימות (כמו בשלוחת הסטטוס).
    const messages = statusText
        ? [say('tzintuk_intro'), say('status_your_status'), { type: 'text', data: statusText }]
        : [say('tzintuk_intro'), say('tzintuk_no_status')];

    while (true) {
        const choice = await call.read([...messages, say('tzintuk_repeat_menu')], 'tap', {
            max_digits: 1,
            min_digits: 1,
            sec_wait: 10,
            digits_allowed: ['1', '2'],
            typing_playback_mode: 'No',
            allow_empty: true,
            empty_val: '2'
        });

        if (String(choice) !== '1') {
            break; // 2 או שתיקה → לתפריט הראשי
        }
    }

    return call.go_to_folder('/0');
}

async function readConfirmedDigits(call, { prompt, confirmLabel, options, playbackType = 'digits' }) {
    while (true) {
        const rawValue = await call.read([prompt], 'tap', {
            ...options,
            max_digits: typeof options.max_digits === 'number' ? options.max_digits + 1 : options.max_digits,
            typing_playback_mode: 'No'
        });
        const value = String(rawValue || '').replace(/#+$/, '');
        const playback = playbackType === 'number'
            ? { type: 'number', data: value }
            : { type: 'digits', data: value };

        const confirmation = await readConfirmationChoice(call, [
            confirmLabel,
            playback,
            say('approve_or_change')
        ]);

        if (confirmation === '1') {
            return value;
        }
    }
}

async function readConfirmedChoice(call, { prompt, options, confirmLabel, valueToMessages }) {
    while (true) {
        const value = await call.read(prompt, 'tap', options);
        const confirmation = await readConfirmationChoice(call, [
            confirmLabel,
            ...valueToMessages(value),
            say('approve_or_change')
        ]);

        if (confirmation === '1') {
            return value;
        }
    }
}

async function readConfirmedRecording(call, { prompt, maxLength = '60' }) {
    while (true) {
        const recordingPath = await call.read([prompt], 'record', {
            max_length: maxLength,
            no_confirm_menu: true
        });

        if (!recordingPath || typeof recordingPath !== 'string') {
            await call.id_list_message([
                say('rec_invalid')
            ], {
                prependToNextAction: true
            });
            continue;
        }

        const confirmation = await readConfirmationChoice(call, [
            say('rec_confirm_label'),
            { type: 'file', data: toYemotPlaybackPath(recordingPath) },
            say('rec_approve_or_redo')
        ]);

        if (confirmation === '1') {
            return recordingPath;
        }
    }
}

async function readConfirmationChoice(call, messages) {
    const baseOptions = {
        max_digits: 1,
        min_digits: 1,
        sec_wait: 10,
        digits_allowed: ['1', '2'],
        typing_playback_mode: 'No'
    };

    const confirmation = await call.read(messages, 'tap', {
        ...baseOptions,
        allow_empty: true,
        empty_val: ''
    });

    if (confirmation !== '') {
        return confirmation;
    }

    return call.read([
        say('approve_or_change')
    ], 'tap', baseOptions);
}

// קולטת כיתה לשם האישי: אות הכיתה (א'-י"ב) + מספר מקבילה (אופציונלי), עם אימות "בחרת כיתה ח'2"
const CLASS_GRADE_NAMES = {
    '1': 'א', '2': 'ב', '3': 'ג', '4': 'ד', '5': 'ה', '6': 'ו',
    '7': 'ז', '8': 'ח', '9': 'ט', '10': 'י', '11': 'יא', '12': 'יב'
};

async function readPersonalClass(call) {
    while (true) {
        let gradeKey = '';
        while (true) {
            const rawGrade = await call.read([say('ask_class_menu')], 'tap', {
                max_digits: 3,
                min_digits: 1,
                sec_wait: 15,
                typing_playback_mode: 'No'
            });

            gradeKey = String(rawGrade || '').replace(/#+$/, '');
            if (CLASS_GRADE_NAMES[gradeKey]) {
                break;
            }

            await call.id_list_message([
                say('class_invalid')
            ], { prependToNextAction: true });
        }

        const rawParallel = await call.read([say('ask_parallel')], 'tap', {
            max_digits: 3,
            min_digits: 1,
            sec_wait: 15,
            typing_playback_mode: 'No'
        });

        const parallel = String(rawParallel || '').replace(/#+$/, '');
        const parallelDisplay = (parallel && parallel !== '0') ? parallel : '';
        const letter = CLASS_GRADE_NAMES[gradeKey];

        const confirmMessages = [
            say('chose_class'),
            gradeLine(gradeKey)
        ];
        if (parallelDisplay) {
            confirmMessages.push({ type: 'number', data: parallelDisplay });
        }
        confirmMessages.push(say('approve_or_change'));

        const confirmation = await readConfirmationChoice(call, confirmMessages);
        if (confirmation === '1') {
            return {
                letter,
                parallel: parallelDisplay,
                gradeKey,
                label: parallelDisplay ? `${letter}'${parallelDisplay}` : `${letter}'`
            };
        }
    }
}

// בונה את רשימת הודעות השמע של מוקד האיסוף (עיר + אזור אופציונלי) מקבצי האודיו.
function pickupVoice(order) {
    const parts = [cityLine(order.pickupCityKey)];
    if (order.pickupAreaKey) {
        parts.push(areaLine(order.pickupCityKey, order.pickupAreaKey));
    }
    return parts;
}

function toYemotPlaybackPath(recordingPath) {
    const normalized = String(recordingPath || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\.wav$/i, '');

    if (!normalized) {
        return '';
    }

    return `/${normalized}`;
}

function buildSummaryMessages(order) {
    const messages = [
        say('summary_intro'),
        say('lbl_order_number'),
        { type: 'digits', data: order.orderNumber },
        say('lbl_phone'),
        { type: 'digits', data: order.enteredPhone },
        say('lbl_pickup'),
        ...pickupVoice(order),
        say('lbl_model'),
        { type: 'number', data: order.productModel },
        say('lbl_books'),
        { type: 'number', data: order.booksQuantity },
        say('lbl_notebooks'),
        { type: 'number', data: order.notebooksQuantity },
        say('lbl_english_books'),
        { type: 'number', data: order.englishBooksQuantity || '0' },
        say('lbl_english_notebooks'),
        { type: 'number', data: order.englishNotebooksQuantity || '0' }
    ];

    if (order.wantsHebrewName === 'כן') {
        messages.push(say('summary_hebrew_name_with'), { type: 'number', data: order.hebrewFont });
    } else {
        messages.push(say('summary_no_hebrew_name'));
    }

    if (order.classLabel) {
        // gradeLine כולל כבר את המילה "כיתה" (למשל "כיתה ח'")
        messages.push(gradeLine(order.classGradeKey));
        if (order.classParallel) {
            messages.push({ type: 'number', data: order.classParallel });
        }
    }

    if (order.hasEnglishLetters === 'כן') {
        messages.push(say('summary_also_english_letters'));
    }

    if (order.wantsEnglishName === 'כן') {
        messages.push(
            say('summary_english_name_lang'),
            order.englishNameLanguage === 'עברית' ? say('lang_hebrew') : say('lang_english'),
            say('summary_english_name_font'),
            { type: 'number', data: order.englishFont }
        );
    }

    messages.push(
        say('lbl_total'),
        { type: 'number', data: String(order.totalPrice || 0) },
        say('lbl_shekels')
    );

    messages.push(say('summary_approve'));
    return messages;
}

// חישוב סך הכל לתשלום (זהה לנוסחת הגיליון):
// (חבילות ספרים + מחברות) × 25 אם יש שם אישי בעברית, אחרת × 20, ועוד (ספרי + מחברות אנגלית) × 5
function computeOrderTotal(order) {
    const toInt = (value) => {
        const parsed = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    const books = toInt(order.booksQuantity);
    const notebooks = toInt(order.notebooksQuantity);
    const englishBooks = toInt(order.englishBooksQuantity);
    const englishNotebooks = toInt(order.englishNotebooksQuantity);
    const perPackage = order.wantsHebrewName === 'כן' ? 25 : 20;

    return (books + notebooks) * perPackage + (englishBooks + englishNotebooks) * 5;
}

function nowInIsrael() {
    return new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

module.exports = {
    handleOrderCall,
    handleStatusCall,
    handleEntryCall
};
