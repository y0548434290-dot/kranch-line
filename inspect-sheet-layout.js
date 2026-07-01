require('./env-loader');

const OrdersSheetClient = require('./src/api-link/sheets-client');
const { ORDER_COLUMNS } = require('./src/api-link/order-schema');

async function main() {
    const client = new OrdersSheetClient();
    await client.initialize();

    const endColumn = client.columnLetter(ORDER_COLUMNS.length - 1);

    const headerResponse = await client.getSheetValues(`הזמנות!A1:${endColumn}1`);
    const headers = headerResponse.values?.[0] || [];

    console.log(`headers=${headers.length} expected=${ORDER_COLUMNS.length}`);
    headers.forEach((header, index) => {
        const expected = ORDER_COLUMNS[index]?.header || '';
        if (header !== expected) {
            console.log(`${client.columnLetter(index)} actual="${header}" expected="${expected}"`);
        }
    });

    const orders = await client.listOrdersWithRowNumbers();
    console.log(`orders=${orders.length}`);
    orders.slice(-5).forEach((order) => {
        console.log(JSON.stringify({
            row: order._rowNumber,
            orderNumber: order.orderNumber,
            phone: order.enteredPhone,
            idNumber: order.idNumber,
            city: order.pickupCity,
            model: order.productModel,
            books: order.booksQuantity,
            notebooks: order.notebooksQuantity,
            hebrewRecording: order.hebrewNameRecording,
            status: order.status
        }, null, 2));
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
