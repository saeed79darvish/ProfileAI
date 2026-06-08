/**
 * Diagnostic: why is GET /api/external-jobs?search=... slow / 500 on prod?
 *
 * Reports the exact state of the full-text search infra and the live query
 * plan, so we can tell whether the searchTsv column / GIN index exist and
 * whether the planner is using the index or falling back to a seq scan.
 *
 * Read-only. Safe to run anytime.
 *
 * Run (Render shell): node scripts/diagnoseJobSearch.js
 */

const { sequelize } = require('../models');

async function main() {
  const q = process.argv[2] || 'frontend';
  const line = (label, val) => console.log(`${label.padEnd(34)} ${val}`);

  try {
    const [toRows] = await sequelize.query(`SHOW statement_timeout`);
    line('statement_timeout', toRows[0]?.statement_timeout);

    const [cols] = await sequelize.query(`
      SELECT column_name, data_type, is_generated, generation_expression
      FROM information_schema.columns
      WHERE table_name = 'ExternalJobs' AND column_name = 'searchTsv'
    `);
    line('searchTsv column exists', cols.length > 0);
    if (cols.length > 0) {
      line('  is_generated', cols[0].is_generated);
    }

    const [idx] = await sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ExternalJobs' AND indexdef ILIKE '%searchTsv%'
    `);
    line('searchTsv GIN index(es)', idx.map(i => i.indexname).join(', ') || '(none)');

    const [countRows] = await sequelize.query(`
      SELECT
        count(*) FILTER (WHERE "isActive") AS active,
        count(*) AS total
      FROM "ExternalJobs"
    `);
    line('active jobs', countRows[0].active);
    line('total jobs', countRows[0].total);

    if (cols.length === 0) {
      console.log('\n⛔ searchTsv column is MISSING — this is why search is slow/500.');
      console.log('   Fix: run `node scripts/repairJobSearch.js`');
      process.exit(0);
    }

    // Live plan for the exact predicate the route uses.
    console.log('\n--- EXPLAIN ANALYZE (route search predicate) ---');
    const t0 = Date.now();
    const [plan] = await sequelize.query(`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT "ExternalJob".id
      FROM "ExternalJobs" AS "ExternalJob"
      WHERE "ExternalJob"."isActive" = true
        AND "ExternalJob"."searchTsv" @@ plainto_tsquery('english', $1)
        AND ts_rank_cd('{0,0,1,1}', "ExternalJob"."searchTsv", plainto_tsquery('english', $1)) > 0
      ORDER BY COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") DESC NULLS LAST
      LIMIT 20
    `, { bind: [q] });
    plan.forEach(r => console.log('   ' + r['QUERY PLAN']));
    line('\nwall time', `${Date.now() - t0} ms`);
  } catch (e) {
    console.error('\n❌ Diagnostic error:', e.message);
  } finally {
    await sequelize.close();
  }
}

main();
