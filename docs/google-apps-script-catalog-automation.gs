const SPREADSHEET_ID = '1CibJ78-4RMjoui1K0KWM-QTHCGQDGfk3g9b7eiCD6dI';
const SHEET_NAME = 'הזמנות';

// ── תיקיות דרייב (מזוהות לפי שם, לא לפי מזהה) ─────────────────────────────
// "קטלוג"          → הקובץ/הקבצים שאליהם מפנה כפתור "קטלוג עטיפות 2027" (קישור)
// "קטלוג לחסומות"  → הקובץ/הקבצים שיישלחו כקובץ מצורף למי שלחצה "חסומה? לחצי כאן"
const CATALOG_FOLDER_NAME = 'קטלוג';
const BLOCKED_FOLDER_NAME = 'קטלוג לחסומות';

// טופס ההזמנה (Google Form הרשמי של קראנץ)
const ORDER_FORM_URL = 'https://forms.gle/d3FViWsbo9kFa8YPA';

const FROM_NAME = 'קראנץ עטיפות';
const CAMPAIGN_SUBJECT = 'הפתענו!! קטלוג עטיפות קראנץ. שווה להציץ!!! יש מה לראות 😃😃😃';
const BLOCKED_REPLY_SUBJECT = 'קטלוג עטיפות קראנץ - הקובץ מצורף כאן 📎';
const MARKETING_SENT_HEADER = 'מייל קטלוג נשלח';
const MARKETING_STATUS_HEADER = 'סטטוס מייל קטלוג';
const PROCESSED_LABEL_NAME = 'kranch-catalog-blocked-processed';

// לוגו קראנץ (PNG שקוף מוטמע — ללא תלות בדרייב, כמו במייל האישור)
const LOGO_DATA_URI = 'data:image/png;base64,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';

// ── כניסה ראשית ──────────────────────────────────────────────────────────
function runCatalogAutomation() {
  ensureCatalogHeaders_();
  sendCatalogCampaignEmails_();
  processBlockedCatalogRequests_();
}

// ── בדיקה בטוחה: שולח את מייל הקטלוג רק אלייך (לא נוגע בגיליון ולא בלקוחות) ──
// הריצי את זה קודם! זה גם יבקש את ההרשאות וגם יראה לך שהקישור לתיקיית "קטלוג" עובד.
function testCatalogEmailToMe() {
  const testEmail = Session.getEffectiveUser().getEmail(); // אפשר להחליף לכתובת אחרת לבדיקה
  const catalog = getCatalogInfo_();
  const blockedMailto = buildBlockedMailto_();
  GmailApp.sendEmail(testEmail, CAMPAIGN_SUBJECT, buildCatalogCampaignText_(catalog), {
    htmlBody: buildCatalogCampaignHtml_(catalog, blockedMailto),
    name: FROM_NAME
  });
  Logger.log(`נשלח מייל בדיקה אל ${testEmail}. קבצים בתיקיית "קטלוג": ${catalog.count}.`);
}

// ── בדיקה בטוחה: שולח אלייך את הקבצים מהתיקייה "קטלוג לחסומות" (כמו לחיצה על "חסומה?") ──
function testBlockedReplyToMe() {
  const testEmail = Session.getEffectiveUser().getEmail();
  const files = getBlockedCatalogFiles_();
  Logger.log(`קבצים בתיקיית "קטלוג לחסומות": ${files.length}.`);
  if (files.length) {
    sendBlockedCatalogFiles_(testEmail, files);
  }
}

function setupCatalogAutomationTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'runCatalogAutomation') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runCatalogAutomation')
    .timeBased()
    .everyMinutes(5)
    .create();
}

// ── שליחת מייל הקטלוג לכל השורות בגיליון ──────────────────────────────────
function sendCatalogCampaignEmails_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return;
  }

  const headers = values[0];
  const emailIndex = headers.indexOf('מייל');
  const sentIndex = headers.indexOf(MARKETING_SENT_HEADER);
  const statusIndex = headers.indexOf(MARKETING_STATUS_HEADER);

  if (emailIndex === -1 || sentIndex === -1 || statusIndex === -1) {
    throw new Error('חסרות כותרות נדרשות בגיליון עבור אוטומציית הקטלוג.');
  }

  // מחושב פעם אחת לכל הריצה: קישור הקטלוג ("קטלוג עטיפות 2027") ותיבת ה"חסומה"
  const catalog = getCatalogInfo_();
  const blockedMailto = buildBlockedMailto_();

  for (let row = 1; row < values.length; row += 1) {
    const rowValues = values[row];
    const email = String(rowValues[emailIndex] || '').trim();
    const alreadySent = String(rowValues[sentIndex] || '').trim();

    if (!email || alreadySent) {
      continue;
    }

    try {
      GmailApp.sendEmail(email, CAMPAIGN_SUBJECT, buildCatalogCampaignText_(catalog), {
        htmlBody: buildCatalogCampaignHtml_(catalog, blockedMailto),
        name: FROM_NAME
      });

      sheet.getRange(row + 1, sentIndex + 1).setValue(new Date());
      sheet.getRange(row + 1, statusIndex + 1).setValue('נשלח');
    } catch (error) {
      sheet.getRange(row + 1, statusIndex + 1).setValue(`שגיאה: ${error.message}`);
    }
  }
}

// ── טיפול בלחיצות "חסומה? לחצי כאן" (מייל נכנס עם נושא "חסום") ──────────────
function processBlockedCatalogRequests_() {
  const label = getOrCreateLabel_(PROCESSED_LABEL_NAME);
  const threads = GmailApp.search('in:inbox is:unread subject:חסום newer_than:30d');
  if (!threads.length) {
    return;
  }

  // כל הקבצים מתוך התיקייה "קטלוג לחסומות" (ממוינים לפי שם, סדר יציב)
  const files = getBlockedCatalogFiles_();
  if (!files.length) {
    // אין קבצים בתיקייה — לא שולחים כלום, לא מסמנים, כדי לא לאבד בקשות
    return;
  }

  threads.forEach((thread) => {
    if (thread.getLabels().some((item) => item.getName() === PROCESSED_LABEL_NAME)) {
      return;
    }

    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];
    const recipient = extractEmailAddress_(latestMessage.getFrom());
    if (!recipient) {
      thread.addLabel(label);
      thread.markRead();
      return;
    }

    sendBlockedCatalogFiles_(recipient, files);

    thread.addLabel(label);
    thread.markRead();
  });
}

// שולח את קבצי "קטלוג לחסומות":
//  • קובץ אחד  → מייל אחד עם הקובץ המצורף
//  • 2-3 קבצים → מיילים משורשרים, קובץ אחד בכל מייל, אחד אחרי השני
function sendBlockedCatalogFiles_(recipient, files) {
  const total = files.length;

  if (total === 1) {
    const file = files[0];
    GmailApp.sendEmail(recipient, BLOCKED_REPLY_SUBJECT, buildBlockedReplyText_(1, 1), {
      htmlBody: buildBlockedReplyHtml_(1, 1),
      attachments: [file.getBlob().setName(file.getName())],
      name: FROM_NAME
    });
    return;
  }

  for (let i = 0; i < total; i += 1) {
    const file = files[i];
    const subject = `${BLOCKED_REPLY_SUBJECT} (${i + 1}/${total})`;
    GmailApp.sendEmail(recipient, subject, buildBlockedReplyText_(i + 1, total), {
      htmlBody: buildBlockedReplyHtml_(i + 1, total),
      attachments: [file.getBlob().setName(file.getName())],
      name: FROM_NAME
    });
    Utilities.sleep(1500); // שהות קטנה כדי שהמיילים יגיעו בסדר, אחד אחרי השני
  }
}

// ── עזרי דרייב ───────────────────────────────────────────────────────────
function getFolderByName_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (!folders.hasNext()) {
    throw new Error(`לא נמצאה תיקייה בשם "${name}" בדרייב (ודאי שהיא קיימת ומשותפת לחשבון שמריץ את הסקריפט).`);
  }
  return folders.next();
}

function listFolderFilesSorted_(folder) {
  const iterator = folder.getFiles();
  const files = [];
  while (iterator.hasNext()) {
    files.push(iterator.next());
  }
  files.sort((a, b) => a.getName().localeCompare(b.getName(), 'he'));
  return files;
}

function getBlockedCatalogFiles_() {
  return listFolderFilesSorted_(getFolderByName_(BLOCKED_FOLDER_NAME));
}

// קישור עבור "קטלוג עטיפות 2027":
//  • קובץ אחד בתיקייה → קישור ישיר לקובץ
//  • יותר מקובץ אחד   → קישור לתיקייה (מציג את כל הקבצים) + רשימת קישורים לכל קובץ
function getCatalogInfo_() {
  const folder = getFolderByName_(CATALOG_FOLDER_NAME);
  const files = listFolderFilesSorted_(folder);
  const links = files.map((file) => ({ name: file.getName(), url: file.getUrl() }));
  const folderUrl = folder.getUrl();
  const mainLink = files.length === 1 ? files[0].getUrl() : folderUrl;
  return { mainLink, links, folderUrl, count: files.length };
}

function buildBlockedMailto_() {
  const inbox = Session.getEffectiveUser().getEmail();
  const body = 'שלחתי בקשה לקבל את קטלוג העטיפות כקובץ מצורף. תודה!';
  return `mailto:${inbox}?subject=${encodeURIComponent('חסום')}&body=${encodeURIComponent(body)}`;
}

// ── כותרות בגיליון ───────────────────────────────────────────────────────
function ensureCatalogHeaders_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const missing = [MARKETING_SENT_HEADER, MARKETING_STATUS_HEADER].filter((header) => !headers.includes(header));

  if (!missing.length) {
    return;
  }

  sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
}

// ── עיצוב מייל הקטלוג ─────────────────────────────────────────────────────
function buildCatalogCampaignHtml_(catalog, blockedMailto) {
  // רשימת קישורים נפרדים לכל קובץ (רק כשיש יותר מקובץ אחד בתיקיית "קטלוג")
  let extraLinks = '';
  if (catalog.count > 1) {
    const items = catalog.links.map((link, i) => (
      `<a href="${link.url}" style="color:#b95579;text-decoration:none;font-weight:700">קובץ ${i + 1}: ${link.name}</a>`
    )).join('<br>');
    extraLinks = `<div style="margin-top:12px;font-size:14px;line-height:2;color:#8b7166">${items}</div>`;
  }

  return `
  <div dir="rtl" style="margin:0;background:#f1eef2;padding:24px 12px;font-family:Arial,'Noto Sans Hebrew',Helvetica,sans-serif;">
    <table align="center" width="600" style="max-width:600px;width:100%;border-collapse:collapse;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.10);">
      <tr>
        <td style="background:linear-gradient(135deg,#EA63A0 0%,#F9AECB 100%);padding:18px 28px 30px;">
          <div style="text-align:right;color:#fff;font-size:13px;font-weight:bold;opacity:.9;">בס"ד</div>
          <div style="text-align:center;">
            <img src="${LOGO_DATA_URI}" alt="קראנץ" style="width:240px;max-width:72%;height:auto;display:inline-block;">
          </div>
          <div style="color:#fff;font-size:25px;font-weight:800;text-align:center;margin-top:14px;">קטלוג עטיפות 2027 🎉</div>
          <div style="color:#fff0f6;font-size:15px;text-align:center;margin-top:6px;">הפתענו!! שווה להציץ — יש מה לראות 😃😃😃</div>
        </td>
      </tr>

      <tr>
        <td style="padding:26px 30px 6px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#333;margin-bottom:8px;">שווה להציץ! יש מה לראות :)</div>
          <div style="font-size:16px;color:#6f5a51;line-height:1.9;">
            עשרות דוגמאות חדישות, מקוריות וייחודיות <b>(מחכות לך)</b><br>
            בקטלוג עטיפות 2027 שלנו.
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:18px 30px 6px;text-align:center;">
          <a href="${catalog.mainLink}" style="display:inline-block;padding:16px 40px;border-radius:16px;text-decoration:none;font-weight:800;font-size:18px;background:linear-gradient(135deg,#E5388A,#F9AECB);color:#fff;box-shadow:0 12px 26px rgba(229,56,138,0.32);">📖 קטלוג עטיפות 2027</a>
          ${extraLinks}
        </td>
      </tr>

      <tr>
        <td style="padding:16px 30px 6px;">
          <div style="background:#fbe9f1;border:1px dashed #eaa8c6;border-radius:14px;padding:16px 18px;text-align:center;">
            <div style="font-size:14px;color:#8a4a6b;">לא נפתח לך הקישור? האינטרנט חסום?</div>
            <div style="margin-top:8px;">
              <a href="${blockedMailto}" style="display:inline-block;padding:12px 30px;border-radius:14px;text-decoration:none;font-weight:800;font-size:16px;background:#fff;border:2px solid #E5388A;color:#E5388A;">חסומה? לחצי כאן 📎</a>
            </div>
            <div style="font-size:12px;color:#a9788a;margin-top:8px;">לחיצה תשלח לנו בקשה — ונחזיר לך את הקטלוג ישירות למייל, כקובץ מצורף (בלי קישורים)</div>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 30px 6px;text-align:center;">
          <div style="font-size:17px;font-weight:700;color:#333;line-height:1.8;">מוזמנת לבחור את העטיפה המושלמת בשבילך!!!!!</div>
          <div style="font-size:15px;color:#6f5a51;margin-top:10px;">כאן תוכלי להזמין בצורה קלה, מהירה ומדויקת!</div>
          <div style="margin-top:14px;">
            <a href="${ORDER_FORM_URL}" style="display:inline-block;padding:14px 36px;border-radius:16px;text-decoration:none;font-weight:800;font-size:17px;background:linear-gradient(135deg,#34BFA3,#7ad9c4);color:#fff;box-shadow:0 12px 26px rgba(52,191,163,0.30);">📝 להזמנה מהירה</a>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 30px 10px;text-align:center;">
          <div style="background:#fdeef5;border-radius:14px;padding:16px;">
            <div style="font-size:13px;color:#777;">לעדכונים שוטפים בקו שלנו</div>
            <div style="font-size:30px;font-weight:bold;color:#E5388A;letter-spacing:1px;direction:ltr;">077-9709807</div>
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:6px 30px 16px;text-align:center;font-size:15px;color:#8b7166;">קיץ בריא — קראנץ עטיפות ☀️</td>
      </tr>

      <tr>
        <td style="background:#34BFA3;padding:16px;text-align:center;">
          <div style="color:#fff;font-size:16px;font-weight:bold;">קראנץ עטיפות</div>
          <div style="color:#d7f5ec;font-size:12px;margin-top:2px;">עטיפה בטעם :)</div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

function buildCatalogCampaignText_(catalog) {
  const lines = [
    'הפתענו!! קטלוג עטיפות קראנץ. שווה להציץ!!! יש מה לראות 😃😃😃',
    '',
    'שווה להציץ! יש מה לראות :)',
    'עשרות דוגמאות חדישות, מקוריות וייחודיות (מחכות לך)',
    'בקטלוג עטיפות 2027:',
    catalog.mainLink
  ];

  if (catalog.count > 1) {
    catalog.links.forEach((link, i) => lines.push(`קובץ ${i + 1} (${link.name}): ${link.url}`));
  }

  lines.push(
    '',
    'חסומה? שלחי לנו מייל חדש ובשורת הנושא כתבי: חסום — ונחזיר לך את הקטלוג כקובץ מצורף.',
    '',
    'מוזמנת לבחור את העטיפה המושלמת בשבילך!!!!!',
    'כאן תוכלי להזמין בצורה קלה, מהירה ומדויקת:',
    ORDER_FORM_URL,
    '',
    'לעדכונים שוטפים בקו שלנו: 077-9709807',
    'קיץ בריא — קראנץ עטיפות.'
  );

  return lines.join('\n');
}

// ── עיצוב מייל התשובה למי שלחצה "חסומה? לחצי כאן" ──────────────────────────
function buildBlockedReplyHtml_(index, total) {
  const counter = total > 1
    ? `<div style="font-size:13px;color:#b55a7b;font-weight:700;margin-top:6px;">קובץ ${index} מתוך ${total}</div>`
    : '';

  return `
  <div dir="rtl" style="margin:0;background:#f1eef2;padding:24px 12px;font-family:Arial,'Noto Sans Hebrew',Helvetica,sans-serif;">
    <table align="center" width="560" style="max-width:560px;width:100%;border-collapse:collapse;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.10);">
      <tr>
        <td style="background:linear-gradient(135deg,#EA63A0 0%,#F9AECB 100%);padding:18px 28px 24px;text-align:center;">
          <div style="text-align:right;color:#fff;font-size:13px;font-weight:bold;opacity:.9;">בס"ד</div>
          <img src="${LOGO_DATA_URI}" alt="קראנץ" style="width:200px;max-width:66%;height:auto;display:inline-block;margin-top:4px;">
          <div style="color:#fff;font-size:22px;font-weight:800;margin-top:12px;">הקטלוג מצורף כאן 📎</div>
          ${counter}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 8px;text-align:center;font-size:16px;color:#6f5a51;line-height:1.9;">
          צירפנו את קטלוג עטיפות קראנץ ישירות למייל הזה,<br>
          כדי שיהיה לך נוח לפתוח אותו גם אם הקישור חסום.
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px;text-align:center;font-size:15px;color:#8b7166;">
          מאחלות לך בחירה קלה ומדויקת 💕<br>
          קיץ בריא — קראנץ עטיפות.
        </td>
      </tr>
      <tr>
        <td style="background:#34BFA3;padding:14px;text-align:center;">
          <div style="color:#fff;font-size:15px;font-weight:bold;">קראנץ עטיפות · 077-9709807</div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

function buildBlockedReplyText_(index, total) {
  const counter = total > 1 ? ` (קובץ ${index} מתוך ${total})` : '';
  return [
    `צירפנו את קטלוג עטיפות קראנץ כקובץ מצורף למייל הזה${counter}.`,
    'כדי שיהיה לך נוח לפתוח אותו גם אם הקישור חסום.',
    '',
    'קיץ בריא — קראנץ עטיפות. 077-9709807'
  ].join('\n');
}

// ── עזרים כלליים ─────────────────────────────────────────────────────────
function extractEmailAddress_(rawValue) {
  const match = String(rawValue || '').match(/<([^>]+)>/);
  if (match) {
    return match[1].trim();
  }

  const plain = String(rawValue || '').trim();
  return plain.includes('@') ? plain : '';
}

function getOrCreateLabel_(labelName) {
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}
