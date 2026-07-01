const fs = require('fs');
const path = require('path');

let cachedLogoDataUri = null;

async function sendOrderConfirmationEmail(order) {
    if (!order.email) {
        return { sent: false, reason: 'missing-email' };
    }

    if (!process.env.RESEND_API_KEY || !process.env.ORDER_EMAIL_FROM) {
        console.log(`[mail] Skipping confirmation for ${order.orderNumber}: missing RESEND_API_KEY or ORDER_EMAIL_FROM`);
        return { sent: false, reason: 'missing-config' };
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: process.env.ORDER_EMAIL_FROM,
            to: [order.email],
            subject: `אישור הזמנה - ${order.orderNumber}`,
            html: buildEmailHtml(order)
        })
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    return { sent: true, provider: 'resend', id: data.id || '' };
}

function buildEmailHtml(order) {
    const status = order.status || 'התקבלה';
    const logoMarkup = buildLogoMarkup();
    const summaryRows = [
        { label: 'מספר הזמנה', value: order.orderNumber },
        { label: 'סטטוס', value: status },
        { label: 'מוקד איסוף', value: order.pickupLabel },
        { label: 'טלפון', value: order.enteredPhone },
        { label: 'תעודת זהות', value: order.idNumber },
        { label: 'דגם', value: order.productModel },
        { label: 'כיתה', value: order.classLabel }
    ].filter((item) => item.value);

    const quantityCards = [
        { label: 'חבילות ספרים', value: order.booksQuantity || '0' },
        { label: 'חבילות מחברות', value: order.notebooksQuantity || '0' },
        { label: 'ספרי אנגלית', value: order.englishBooksQuantity || '0' },
        { label: 'מחברות אנגלית', value: order.englishNotebooksQuantity || '0' }
    ];

    const personalization = buildPersonalizationList(order);

    return `
        <div dir="rtl" style="margin:0;padding:32px 16px;background:linear-gradient(180deg,#fff8f1 0%,#fffdfb 100%);font-family:Arial,'Noto Sans Hebrew',sans-serif;color:#3b2c25">
            <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #f0d9cb;border-radius:30px;overflow:hidden;box-shadow:0 22px 56px rgba(170,118,105,0.12)">
                <div style="padding:32px;background:radial-gradient(circle at top right,rgba(212,106,140,0.16),transparent 32%),radial-gradient(circle at bottom left,rgba(239,178,113,0.18),transparent 28%),linear-gradient(135deg,#fff8f4 0%,#fff4ea 100%)">
                    <div style="display:flex;align-items:center;gap:16px;justify-content:space-between;flex-wrap:wrap">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:#b55a7b;margin-bottom:10px">קראנץ</div>
                            <div style="font-size:28px;font-weight:800;line-height:1.2;margin-bottom:10px">ההזמנה שלך התקבלה בהצלחה</div>
                            <div style="font-size:16px;line-height:1.8;color:#7b6258">ריכזנו עבורך כאן את פרטי ההזמנה, לפי הבחירות והכמויות שנשמרו עבורך.</div>
                        </div>
                        ${logoMarkup}
                    </div>
                </div>
                <div style="padding:28px 32px 18px">
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
                        ${summaryRows.map((item) => `
                            <div style="padding:14px 16px;border-radius:18px;background:#fffaf6;border:1px solid #f3dfd4">
                                <div style="font-size:13px;color:#9b7b6f;margin-bottom:6px">${escapeHtml(item.label)}</div>
                                <div style="font-size:17px;font-weight:700;color:#44312a">${escapeHtml(item.value)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="padding:0 32px 12px">
                    <div style="font-size:21px;font-weight:800;margin-bottom:14px">פירוט הכמויות</div>
                    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
                        ${quantityCards.map((item) => `
                            <div style="padding:16px 12px;border-radius:20px;background:linear-gradient(180deg,#fff7f0,#fffdfb);border:1px solid #f3dfd4;text-align:center">
                                <div style="font-size:14px;color:#8f7066;margin-bottom:8px">${escapeHtml(item.label)}</div>
                                <div style="font-size:24px;font-weight:800;color:#c0587d">${escapeHtml(item.value)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div style="padding:12px 32px 0">
                    <div style="border-radius:24px;background:#fffaf6;border:1px solid #f3dfd4;padding:20px 22px">
                        <div style="font-size:21px;font-weight:800;margin-bottom:12px">התאמות אישיות שנבחרו</div>
                        ${personalization.length > 0 ? `
                            <ul style="margin:0;padding:0 18px 0 0;color:#5a473e;line-height:1.95">
                                ${personalization.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                            </ul>
                        ` : `
                            <div style="color:#7f665d;line-height:1.8">לא נבחרו התאמות אישיות מיוחדות להזמנה זו.</div>
                        `}
                    </div>
                </div>
                <div style="padding:20px 32px 32px">
                    <div style="border-radius:24px;background:linear-gradient(135deg,#fff2ec,#fff9f4);border:1px solid #f0ddd1;padding:20px 22px">
                        <div style="font-size:18px;font-weight:800;margin-bottom:8px">סיכום הזמנה מלא</div>
                        <div style="color:#6f5a51;line-height:1.9">${escapeHtml(order.orderSummaryText || order.productsSummary || '')}</div>
                    </div>
                    <div style="margin-top:18px;font-size:14px;color:#8b7166;line-height:1.8">
                        תודה שבחרת בקראנץ. ניתן לעקוב אחר ההזמנה גם דרך המערכת הטלפונית.
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildPersonalizationList(order) {
    const items = [];

    if (order.wantsHebrewName === 'כן') {
        const classText = order.classLabel ? `, כיתה ${order.classLabel}` : '';
        items.push(`שם אישי בעברית: ${order.hebrewNameRecording || 'נבחר'}${order.hebrewFont ? `, גופן ${order.hebrewFont}` : ''}${classText}`);
    }

    if (order.hasEnglishLetters === 'כן') {
        items.push(`אותיות באנגלית בדוגמה: ${order.englishLettersRecording || 'כן'}`);
    }

    if (order.wantsEnglishName === 'כן') {
        const language = order.englishNameLanguage || 'לא צוין';
        const nameText = order.englishNameRecording || 'נבחר שם אישי';
        const fontText = order.englishFont ? `, גופן ${order.englishFont}` : '';
        const classText = order.englishClassLabel ? `, כיתה ${order.englishClassLabel}` : '';
        items.push(`שם אישי עבור ספרי אנגלית: ${nameText}, שפה ${language}${fontText}${classText}`);
    }

    if (order.productsSummary) {
        items.push(`מוצרים שנבחרו: ${order.productsSummary}`);
    }

    return items;
}

function buildLogoMarkup() {
    const logoDataUri = getLogoDataUri();

    if (logoDataUri) {
        return `<img src="${logoDataUri}" alt="לוגו קראנץ" style="width:124px;height:124px;object-fit:cover;border-radius:28px;box-shadow:0 16px 34px rgba(185,79,114,0.16)">`;
    }

    return `
        <div style="width:124px;height:124px;border-radius:28px;background:linear-gradient(135deg,#d46a8c,#efb271);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;box-shadow:0 16px 34px rgba(185,79,114,0.16)">
            קראנץ
        </div>
    `;
}

function getLogoDataUri() {
    if (cachedLogoDataUri !== null) {
        return cachedLogoDataUri;
    }

    const logoPath = path.join(__dirname, 'public', 'kranch-logo.jpg');
    if (!fs.existsSync(logoPath)) {
        cachedLogoDataUri = '';
        return cachedLogoDataUri;
    }

    const base64 = fs.readFileSync(logoPath).toString('base64');
    cachedLogoDataUri = `data:image/jpeg;base64,${base64}`;
    return cachedLogoDataUri;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    sendOrderConfirmationEmail
};
