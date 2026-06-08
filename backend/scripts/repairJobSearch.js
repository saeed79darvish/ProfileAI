/**
 * Repair: ensure ExternalJobs.searchTsv + its GIN index exist on prod.
 *
 * The boot migration (addExternalJobSearchTsv) builds a STORED generated
 * tsvector that includes the heavy `description` field for all ~13k rows in
 * a single ALTER. Under the default statement_timeout that ALTER (or the
 * subsequent CREATE INDEX) can be cancelled, leaving search unindexed — so
 * GET /external-jobs?search=... falls back to a per-row scan and times out.
 *
 * This script disables the statement timeout FOR THIS SESSION ONLY, then
 * creates the column and index idempotently. Run once in the Render shell:
 *
 *   node scripts/repairJobSearch.js
 */

const { sequelize } = require('../models');

async function main() {
  try {
    console.log('Disabling statement_timeout for this session...');
    await sequelize.query(`SET statement_timeout = 0`);

    console.log('Ensuring "searchTsv" generated column (this may take a while)...');
    await sequelize.query(`
      ALTER TABLE "ExternalJobs"
      ADD COLUMN IF NOT EXISTS "searchTsv" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(department, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      ) STORED;
    `);
    console.log('  ✓ column present');

    console.log('Ensuring GIN index "external_jobs_search_tsv_gin"...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_gin"
      ON "ExternalJobs" USING gin ("searchTsv");
    `);
    console.log('  ✓ index present');

    console.log('Running ANALYZE so the planner has fresh stats...');
    await sequelize.query(`ANALYZE "ExternalJobs"`);

    console.log('\n✅ Repair complete. Re-run scripts/diagnoseJobSearch.js to verify.');
  } catch (e) {
    console.error('\n❌ Repair failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
