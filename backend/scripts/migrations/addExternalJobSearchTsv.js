/**
 * Migration: Add a generated tsvector column on ExternalJobs for weighted
 * full-text search, plus a GIN index.
 *
 * Why: the previous search used ILIKE on title/company/department only —
 * description was excluded because it produced too many loose matches.
 * Weighted ts_rank fixes that:
 *   - Title hits rank highest (weight A)
 *   - Company / department hits rank mid (weight B)
 *   - Description hits rank low (weight C)
 *
 * So a query like "MLOps" or "Stripe" hidden inside a JD body will surface,
 * but won't outrank a real title/company match.
 *
 * Idempotent — safe to re-run.
 *
 * Run: node scripts/migrations/addExternalJobSearchTsv.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Adding ExternalJobs.searchTsv (generated tsvector) + GIN index\n');
  try {
    console.log('📦 Step 1: Adding "searchTsv" generated column...');
    // PostgreSQL 12+ supports STORED generated columns.
    // setweight() needs a regconfig and tsvector inputs that are concatenated.
    // We coalesce each source field to '' so NULLs don't blow up the cast.
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
    console.log('   ✓ searchTsv column added (STORED, weighted A/B/C)');

    console.log('📦 Step 2: Creating GIN index "external_jobs_search_tsv_gin"...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_gin"
      ON "ExternalJobs" USING gin ("searchTsv");
    `);
    console.log('   ✓ index created');

    console.log('\n✅ Migration completed successfully\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

async function down() {
  console.log('🔙 Reverting ExternalJobs.searchTsv\n');
  try {
    await sequelize.query(`DROP INDEX IF EXISTS "external_jobs_search_tsv_gin";`);
    await sequelize.query(`ALTER TABLE "ExternalJobs" DROP COLUMN IF EXISTS "searchTsv";`);
    console.log('✅ Revert completed\n');
  } catch (error) {
    console.error('\n❌ Revert failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const direction = process.argv[2] === 'down' ? down : up;
  direction()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
