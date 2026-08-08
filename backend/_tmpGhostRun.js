require('dotenv').config();
const s = require('./config/database');
const { scanGhostJobs, getGhostStats } = require('./services/ghostJobDetector');
(async () => {
  const t0 = Date.now();
  const r = await scanGhostJobs();
  console.log(`scanned ${r.scanned} listings in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log('stats:', JSON.stringify(await getGhostStats()), '\n');

  const [top] = await s.query(`
    SELECT title, company, "ghostScore" sc, "ghostReasons" why,
           EXTRACT(DAY FROM NOW()-"createdAt")::int days
      FROM "ExternalJobs" WHERE "isActive"=true AND "ghostScore" >= 50
     ORDER BY "ghostScore" DESC LIMIT 8`);
  console.log('FLAGGED (score >= 50):');
  top.forEach(r => console.log(`  ${String(r.sc).padStart(3)}  ${String(r.days).padStart(3)}d  ${(r.title||'').slice(0,42).padEnd(44)} ${JSON.stringify(r.why)}`));

  const [mid] = await s.query(`
    SELECT title, "ghostScore" sc, "ghostReasons" why FROM "ExternalJobs"
     WHERE "isActive"=true AND "ghostScore" BETWEEN 25 AND 49 ORDER BY random() LIMIT 4`);
  console.log('\nAGING (25-49, demoted but not flagged):');
  mid.forEach(r => console.log(`  ${String(r.sc).padStart(3)}  ${(r.title||'').slice(0,42).padEnd(44)} ${JSON.stringify(r.why)}`));

  const [clean] = await s.query(`
    SELECT title, "ghostScore" sc FROM "ExternalJobs"
     WHERE "isActive"=true AND "ghostScore" = 0 ORDER BY random() LIMIT 3`);
  console.log('\nCLEAN (score 0) — sanity check we are not flagging everything:');
  clean.forEach(r => console.log(`  ${String(r.sc).padStart(3)}  ${(r.title||'').slice(0,50)}`));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
