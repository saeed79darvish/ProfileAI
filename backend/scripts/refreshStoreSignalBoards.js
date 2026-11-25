/**
 * Rebuilds data/storesignal-boards.csv from a fresh download of the StoreSignal directory.
 * The directory is CC BY 4.0: https://github.com/storesignalhq/ats-job-boards (credit "StoreSignal ATS job boards directory").
 *
 *   curl -sL -o /tmp/boards.csv https://raw.githubusercontent.com/storesignalhq/ats-job-boards/main/boards.csv
 *   node scripts/refreshStoreSignalBoards.js /tmp/boards.csv
 *
 * Commit the result; the cron worker seeds the new rows on its next tick and checks them before adding any.
 */
const fs = require('fs');
const { parseCsv, candidatesFromRows, STORESIGNAL_FILE } = require('../services/boardImport');

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/refreshStoreSignalBoards.js <boards.csv>'); process.exit(1); }
const rows = parseCsv(fs.readFileSync(src, 'utf8'));
const kept = candidatesFromRows(rows, 'storesignal');
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const out = ['ats,slug,company_name,open_jobs', ...kept.map((c) => [c.platform, c.boardToken, c.name || '', c.sizeHint].map(esc).join(','))].join('\n') + '\n';
fs.writeFileSync(STORESIGNAL_FILE, out);
console.log(`kept ${kept.length} of ${rows.length} boards (greenhouse, ashby, lever) in ${STORESIGNAL_FILE}`);
