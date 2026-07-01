require('./env-loader');

const OrdersSheetClient = require('./src/api-link/sheets-client');
const { ORDER_COLUMNS } = require('./src/api-link/order-schema');

const SHEET_NAME = 'הזמנות';

async function main() {
    const client = new OrdersSheetClient();
    await client.initialize();

    const metadata = await client.googleSheetsRequest('', {
        query: {
            fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))'
        }
    });
    const sheet = (metadata.sheets || []).find((item) => item.properties?.title === SHEET_NAME);
    if (!sheet) {
        throw new Error(`Sheet "${SHEET_NAME}" was not found.`);
    }

    const currentColumnCount = Number(sheet.properties.gridProperties.columnCount || ORDER_COLUMNS.length);
    const currentRowCount = Number(sheet.properties.gridProperties.rowCount || 1000);
    const currentEndColumn = client.columnLetter(currentColumnCount - 1);
    const desiredEndColumn = client.columnLetter(ORDER_COLUMNS.length - 1);
    const response = await client.getSheetValues(`${SHEET_NAME}!A1:${currentEndColumn}${currentRowCount}`);
    const rows = response.values || [];
    const currentHeaders = rows[0] || [];
    const desiredHeaders = ORDER_COLUMNS.map((column) => column.header);

    const headerIndexes = new Map();
    currentHeaders.forEach((header, index) => {
        const normalized = String(header || '').trim();
        if (!normalized || headerIndexes.has(normalized)) {
            return;
        }
        headerIndexes.set(normalized, index);
    });

    const cleanedRows = rows.map((row, rowIndex) => {
        if (rowIndex === 0) {
            return desiredHeaders;
        }

        return desiredHeaders.map((header) => {
            const sourceIndex = headerIndexes.get(header);
            return typeof sourceIndex === 'number' ? row[sourceIndex] || '' : '';
        });
    });

    if (cleanedRows.length === 0) {
        cleanedRows.push(desiredHeaders);
    }

    await client.ensureSheetColumnCapacity(ORDER_COLUMNS.length);
    await client.updateSheetValues(`${SHEET_NAME}!A1:${desiredEndColumn}${cleanedRows.length}`, cleanedRows, {
        valueInputOption: 'RAW'
    });

    if (currentColumnCount > ORDER_COLUMNS.length) {
        await client.googleSheetsRequest(':batchUpdate', {
            method: 'POST',
            body: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: ORDER_COLUMNS.length,
                                endIndex: currentColumnCount
                            }
                        }
                    }
                ]
            }
        });
    }

    console.log(`Cleaned sheet columns: ${currentColumnCount} -> ${ORDER_COLUMNS.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
