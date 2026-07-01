require('./env-loader');

const OrdersSheetClient = require('./src/api-link/sheets-client');
const { RECORDING_TRANSCRIPTION_FIELDS } = require('./src/api-link/order-schema');
const { looksLikeRecordingReference } = require('./src/api-link/yemot-recordings');

async function main() {
    const sheets = new OrdersSheetClient();
    await sheets.initialize();

    const orders = await sheets.listOrdersWithRowNumbers();
    for (const order of orders) {
        const fields = Object.entries(RECORDING_TRANSCRIPTION_FIELDS).filter(([recordingKey]) =>
            looksLikeRecordingReference(order[recordingKey])
        );

        if (fields.length === 0) {
            continue;
        }

        const summary = fields.map(([recordingKey, fieldConfig]) => {
            const status = order[fieldConfig.statusKey] || '';
            const review = order[fieldConfig.needsReviewKey] ? ` review=${order[fieldConfig.needsReviewKey]}` : '';
            const error = order[fieldConfig.errorKey] ? ' ERROR' : '';
            return `${recordingKey}:${status}${review}${error}`;
        });

        console.log(`row ${order._rowNumber} order ${order.orderNumber || '-'} ${summary.join(' | ')}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
