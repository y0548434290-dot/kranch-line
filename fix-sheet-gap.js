// Backs up the full orders sheet, then verifies the gap rows (16..1028) are empty.
// Pass "--delete" to actually remove the empty gap (deletes rows 16..1028, shifting the
// bottom strays up so all data becomes contiguous).
process.env.VERCEL = '1';
process.env.API_LINK_ENABLE_EMAIL_SYNC = 'no';
process.env.API_LINK_ENABLE_TRANSCRIPTION_SYNC = 'no';
require('./env-loader');
const fs = require('fs');
const path = require('path');
const OrdersSheetClient = require('./src/api-link/sheets-client');

const DO_DELETE = process.argv.includes('--delete');
const GAP_START_ROW = 16;   // first empty row (1-based)
const GAP_END_ROW = 1028;   // last empty row (1-based)

(async () => {
    const c = new OrdersSheetClient();
    await c.initialize();

    // 1) backup everything
    const all = await c.getSheetValues("הזמנות!A1:AK1033");
    const backupPath = path.join(__dirname, '..', `sheet-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(all.values || [], null, 2), 'utf8');
    console.log('Backup saved:', backupPath, '(rows:', (all.values || []).length, ')');

    // 2) verify the gap is empty across ALL columns
    const gap = await c.getSheetValues(`הזמנות!A${GAP_START_ROW}:AK${GAP_END_ROW}`);
    const rows = gap.values || [];
    let nonEmpty = [];
    rows.forEach((r, i) => {
        if (r.some((cell) => String(cell || '').trim() !== '')) nonEmpty.push(GAP_START_ROW + i);
    });
    console.log(`gap rows ${GAP_START_ROW}..${GAP_END_ROW}: ${nonEmpty.length === 0 ? 'ALL EMPTY ✓' : 'NON-EMPTY at ' + nonEmpty.join(',')}`);

    if (!DO_DELETE) {
        console.log('Dry run only. Re-run with --delete to remove the gap.');
        return;
    }
    if (nonEmpty.length > 0) {
        console.log('ABORT: gap is not empty, refusing to delete.');
        process.exit(1);
    }

    // 3) delete the empty gap rows (0-based startIndex inclusive, endIndex exclusive)
    await c.googleSheetsRequest(':batchUpdate', {
        method: 'POST',
        body: {
            requests: [{
                deleteDimension: {
                    range: { sheetId: 0, dimension: 'ROWS', startIndex: GAP_START_ROW - 1, endIndex: GAP_END_ROW }
                }
            }]
        }
    });
    console.log(`Deleted rows ${GAP_START_ROW}..${GAP_END_ROW}.`);

    // 4) verify result
    const after = await c.getSheetValues("הזמנות!A1:A40");
    const av = after.values || [];
    let last = 0; for (let i = av.length - 1; i >= 0; i--) { if (String((av[i] && av[i][0]) || '').trim() !== '') { last = i + 1; break; } }
    console.log('after: last non-empty row in A =', last, '(should be ~20, contiguous)');
    av.forEach((r, i) => { if (String(r[0] || '').trim() !== '') console.log(`  row ${i + 1}: ${r[0]}`); });
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
