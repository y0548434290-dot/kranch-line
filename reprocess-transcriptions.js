require('./env-loader');

const OrdersSheetClient = require('./src/api-link/sheets-client');
const TranscriptionService = require('./src/api-link/transcription-service');
const { RECORDING_TRANSCRIPTION_FIELDS } = require('./src/api-link/order-schema');
const { looksLikeRecordingReference } = require('./src/api-link/yemot-recordings');

/**
 * איפוס ותמלול-מחדש של הקלטות קיימות בגיליון.
 *
 * רץ מקומית מול ה-.env (מוריד מימות עם התיקון הנקי, ומתמלל שוב דרך Google Speech).
 *
 * שימוש:
 *   node reprocess-transcriptions.js                 # מצב יבש: רק מציג מה יושפע (ברירת מחדל)
 *   node reprocess-transcriptions.js --apply         # מבצע בפועל על כל השורות הרלוונטיות
 *   node reprocess-transcriptions.js --apply --row=12   # מבצע על שורה אחת בלבד (אימות נקודתי)
 *   node reprocess-transcriptions.js --apply --limit=5  # מגביל את מספר השורות
 *
 * אזהרה: --apply כותב ל-Google Sheets ולמערכת ימות (production).
 */

function parseArgs(argv) {
    const args = { apply: false, row: null, limit: Infinity };
    for (const arg of argv.slice(2)) {
        if (arg === '--apply') args.apply = true;
        else if (arg.startsWith('--row=')) args.row = Number(arg.slice('--row='.length));
        else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    }
    return args;
}

// שדות התמלול שיש לאפס לכל הקלטה (כדי ש-orderNeedsTranscription יחזיר שוב true)
function clearedFieldsFor(fieldConfig) {
    return {
        [fieldConfig.statusKey]: '',
        [fieldConfig.transcriptKey]: '',
        [fieldConfig.normalizedKey]: '',
        [fieldConfig.finalKey]: '',
        [fieldConfig.confidenceKey]: '',
        [fieldConfig.needsReviewKey]: '',
        [fieldConfig.verificationStatusKey]: '',
        [fieldConfig.errorKey]: ''
    };
}

// אילו שדות הקלטה בשורה הזו דורשים תמלול-מחדש (יש נתיב הקלטה)
function recordingFieldsToReprocess(order) {
    return Object.entries(RECORDING_TRANSCRIPTION_FIELDS).filter(
        ([recordingKey]) => looksLikeRecordingReference(order[recordingKey])
    );
}

async function main() {
    const args = parseArgs(process.argv);
    const mode = args.apply ? 'ביצוע (--apply)' : 'מצב יבש (dry-run)';
    console.log(`🔁 תמלול-מחדש של הקלטות קיימות — ${mode}\n`);

    const sheets = new OrdersSheetClient();
    await sheets.initialize();
    const transcriptionService = new TranscriptionService();

    const orders = await sheets.listOrdersWithRowNumbers();
    let targets = orders.filter((order) => recordingFieldsToReprocess(order).length > 0);
    if (args.row) {
        targets = targets.filter((order) => order._rowNumber === args.row);
    }
    if (Number.isFinite(args.limit)) {
        targets = targets.slice(0, args.limit);
    }

    console.log(`📋 נמצאו ${targets.length} שורות עם הקלטות לתמלול-מחדש:`);
    for (const order of targets) {
        const fields = recordingFieldsToReprocess(order).map(([k]) => k).join(', ');
        console.log(`   • שורה ${order._rowNumber} (הזמנה ${order.orderNumber || '—'}): ${fields}`);
    }
    console.log('');

    if (!args.apply) {
        console.log('ℹ️  זהו מצב יבש — לא בוצע שום שינוי. להרצה בפועל הוסיפי --apply');
        return;
    }

    let ok = 0;
    let failed = 0;
    for (const order of targets) {
        // איפוס שדות התמלול בזיכרון, כדי ש-processOrder לא ידלג על שדות במצב 'completed'
        const resetPatch = {};
        recordingFieldsToReprocess(order).forEach(([, fieldConfig]) => {
            const cleared = clearedFieldsFor(fieldConfig);
            Object.assign(order, cleared);
            Object.assign(resetPatch, cleared);
        });

        try {
            console.log(`⏳ מתמלל מחדש שורה ${order._rowNumber} (הזמנה ${order.orderNumber || '—'})...`);
            await sheets.updateOrderFields(order._rowNumber, resetPatch);
            await transcriptionService.processOrder(sheets, order);
            ok += 1;
        } catch (error) {
            failed += 1;
            console.error(`   ❌ נכשל בשורה ${order._rowNumber}: ${error.message}`);
        }
    }

    console.log(`\n✅ הסתיים. הצליחו: ${ok}, נכשלו: ${failed}, סה"כ: ${targets.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
