process.env.VERCEL = '1';
process.env.API_LINK_ENABLE_EMAIL_SYNC = 'no';
process.env.API_LINK_ENABLE_TRANSCRIPTION_SYNC = 'no';
require('./env-loader');
const OrdersSheetClient = require('./src/api-link/sheets-client');

(async () => {
    const c = new OrdersSheetClient();
    await c.initialize();
    const A = (await c.getSheetValues("הזמנות!A2:A1033")).values || [];
    const F = (await c.getSheetValues("הזמנות!F2:F1033")).values || [];

    const nonEmptyRows = [];
    for (let i = 0; i < A.length; i++) {
        const a = String((A[i] && A[i][0]) || '').trim();
        const f = String((F[i] && F[i][0]) || '').trim();
        if (a !== '' || f !== '') nonEmptyRows.push(i + 2); // sheet row number
    }
    console.log('total rows with data (A or F) between 2..1033:', nonEmptyRows.length);

    // contiguous block from top
    let contigEnd = 1;
    for (let r = 2; r <= 1033; r++) {
        if (nonEmptyRows.includes(r)) contigEnd = r; else break;
    }
    console.log('contiguous data block: rows 2..', contigEnd);

    // strays after the first gap
    const strays = nonEmptyRows.filter(r => r > contigEnd);
    console.log('stray rows AFTER the gap:', strays.length ? strays.join(', ') : '(none)');

    // show values around the bottom
    const bottom = (await c.getSheetValues("הזמנות!A1028:H1033")).values || [];
    console.log('rows 1028..1033 (A..H):');
    bottom.forEach((r, i) => console.log(`  row ${1028 + i}:`, JSON.stringify(r)));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
