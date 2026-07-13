/**
 * Quick diagnostic for the Jobs corpus. Run when "Posted N days ago" is
 * showing on every card or the 24h filter returns 0 — tells you whether
 * (a) the cron is wired, (b) which boards have errored, (c) what the
 * actual freshness distribution of the corpus is.
 *
 * Usage: cd backend && node scripts/diagnoseJobs.js
 */
require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ DB connected');
    console.log(`   ENABLE_EXTERNAL_JOBS_CRON = ${process.env.ENABLE_EXTERNAL_JOBS_CRON}`);
    console.log(`   NODE_ENV = ${process.env.NODE_ENV || '(unset)'}`);
    console.log('');

    // 1. Active jobs by source + newest age
    const bySource = await sequelize.query(
      `SELECT source, COUNT(*)::int as n,
              MAX(COALESCE("postedAt","createdAt")) as newest
         FROM "ExternalJobs" WHERE "isActive" = true
        GROUP BY source ORDER BY n DESC`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    console.log('JOBS BY SOURCE:');
    bySource.forEach(r => {
      const newestAge = r.newest ? Math.round((Date.now() - new Date(r.newest).getTime()) / 86400000) : null;
      console.log(`  ${r.source.padEnd(12)} ${String(r.n).padStart(6)} jobs   newest: ${newestAge}d ago`);
    });
    console.log('');

    // 2. Board status — which are erroring, which are stale
    const boards = await ATSBoard.findAll({
      attributes: ['name', 'platform', 'isActive', 'lastSyncAt', 'syncError'],
      raw: true,
      order: [['platform', 'ASC'], ['name', 'ASC']]
    });
    const active = boards.filter(b => b.isActive);
    const errored = boards.filter(b => b.syncError);
    const stale = active.filter(b => !b.lastSyncAt || (Date.now() - new Date(b.lastSyncAt).getTime()) > 6 * 3600000);
    console.log(`BOARDS: ${boards.length} total, ${active.length} active`);
    console.log(`  with errors: ${errored.length}`);
    console.log(`  stale (>6h or never synced): ${stale.length}`);
    if (errored.length) {
      console.log('  ERROR SAMPLE (first 8):');
      errored.slice(0, 8).forEach(b => console.log(`    ${b.platform}/${b.name}: ${(b.syncError || '').slice(0, 110)}`));
    }
    if (stale.length) {
      console.log('  STALE SAMPLE (first 8):');
      stale.slice(0, 8).forEach(b => {
        const ageH = b.lastSyncAt ? Math.round((Date.now() - new Date(b.lastSyncAt).getTime()) / 3600000) : 'never';
        console.log(`    ${b.platform}/${b.name}: ${typeof ageH === 'number' ? ageH + 'h ago' : ageH}`);
      });
    }
    console.log('');

    // 3. Freshness distribution
    const counts = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE("postedAt","createdAt") > NOW() - INTERVAL '24 hours')::int as h24,
         COUNT(*) FILTER (WHERE COALESCE("postedAt","createdAt") > NOW() - INTERVAL '3 days')::int as d3,
         COUNT(*) FILTER (WHERE COALESCE("postedAt","createdAt") > NOW() - INTERVAL '7 days')::int as d7,
         COUNT(*) FILTER (WHERE COALESCE("postedAt","createdAt") > NOW() - INTERVAL '30 days')::int as d30,
         COUNT(*)::int as total
       FROM "ExternalJobs" WHERE "isActive" = true`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    const c = counts[0];
    console.log('FRESHNESS (active jobs):');
    console.log(`  last 24h:  ${c.h24.toLocaleString()}`);
    console.log(`  last 3d:   ${c.d3.toLocaleString()}`);
    console.log(`  last 7d:   ${c.d7.toLocaleString()}`);
    console.log(`  last 30d:  ${c.d30.toLocaleString()}`);
    console.log(`  total:     ${c.total.toLocaleString()}`);
    console.log('');

    // 4. Disk usage — where the storage is actually going. This is the section
    //    to watch when the DB is filling up on Render. Reports total DB size,
    //    the ExternalJobs table split (heap / indexes / TOASTed metadata+html),
    //    active vs inactive row counts, how many rows the current prune/compact
    //    thresholds would reclaim, and the biggest boards by active-job count.
    const [dbSize] = await sequelize.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    const [tbl] = await sequelize.query(
      `SELECT
         pg_size_pretty(pg_total_relation_size('"ExternalJobs"'))                                    AS total,
         pg_size_pretty(pg_relation_size('"ExternalJobs"'))                                          AS heap,
         pg_size_pretty(pg_indexes_size('"ExternalJobs"'))                                           AS indexes,
         pg_size_pretty(pg_total_relation_size('"ExternalJobs"')
                        - pg_relation_size('"ExternalJobs"')
                        - pg_indexes_size('"ExternalJobs"'))                                         AS toast`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    const pruneDays = parseInt(process.env.PRUNE_INACTIVE_DAYS || '14', 10);
    const compactDays = parseInt(process.env.COMPACT_OLD_JOBS_DAYS || '7', 10);
    const [rowc] = await sequelize.query(
      `SELECT
         COUNT(*)::int                                                        AS total,
         COUNT(*) FILTER (WHERE "isActive")::int                              AS active,
         COUNT(*) FILTER (WHERE NOT "isActive")::int                         AS inactive,
         COUNT(*) FILTER (WHERE NOT "isActive"
           AND COALESCE("lastFetchedAt","updatedAt","createdAt")
               < NOW() - ($1 || ' days')::interval)::int                     AS prunable,
         COUNT(*) FILTER (WHERE ("descriptionHtml" IS NOT NULL OR "metadata" IS NOT NULL)
           AND COALESCE("postedAt","createdAt")
               < NOW() - ($2 || ' days')::interval)::int                     AS compactable
       FROM "ExternalJobs"`,
      { bind: [String(pruneDays), String(compactDays)], type: sequelize.constructor.QueryTypes.SELECT }
    );
    console.log('DISK:');
    console.log(`  database total:          ${dbSize.db_size}`);
    console.log(`  ExternalJobs total:      ${tbl.total}  (heap ${tbl.heap} / indexes ${tbl.indexes} / toast ${tbl.toast})`);
    console.log(`  rows:                    ${rowc.total.toLocaleString()} total  (${rowc.active.toLocaleString()} active, ${rowc.inactive.toLocaleString()} inactive)`);
    console.log(`  prunable now (>${pruneDays}d inactive):   ${rowc.prunable.toLocaleString()} rows`);
    console.log(`  compactable now (>${compactDays}d w/ html+meta): ${rowc.compactable.toLocaleString()} rows`);
    console.log('');

    const topBoards = await sequelize.query(
      `SELECT "boardToken", MAX(company) AS company, COUNT(*)::int AS n
         FROM "ExternalJobs" WHERE "isActive" = true
        GROUP BY "boardToken" ORDER BY n DESC LIMIT 12`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    console.log('BIGGEST BOARDS (active jobs):');
    topBoards.forEach(b => console.log(`  ${String(b.n).padStart(5)}  ${b.company} (${b.boardToken})`));
    console.log('');

    if (c.h24 === 0 && active.length > 0 && stale.length === active.length) {
      console.log('🚩 DIAGNOSIS: All boards are stale and 0 fresh jobs. The backend');
      console.log('   process is not running the cron — likely you set the env var');
      console.log('   AFTER the backend started. RESTART backend to pick it up.');
    } else if (c.h24 === 0 && errored.length > active.length / 2) {
      console.log('🚩 DIAGNOSIS: Most boards are erroring. Look at error messages above.');
      console.log('   Common: missing API keys (Adzuna, JSearch, TheirStack).');
    } else if (c.h24 === 0) {
      console.log('🚩 DIAGNOSIS: Cron is running but no source produced fresh jobs.');
      console.log('   Run: node -e "require(\'./services/externalJobService\').syncAllBoards().then(r => console.log(JSON.stringify(r, null, 2)))"');
    } else {
      console.log(`✓ Looks healthy — ${c.h24.toLocaleString()} jobs added in the last 24h.`);
    }

    process.exit(0);
  } catch (e) { console.error('✗', e.message); console.error(e.stack); process.exit(1); }
})();
