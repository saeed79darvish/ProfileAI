/**
 * Migration: Add a GIN index on ExternalJob.skills for fast `@>` containment.
 *
 * Without this, the new `?skills=react,nodejs` filter on /external-jobs
 * would do a sequential scan and slow down dramatically as the corpus
 * grows. With the index, containment checks stay sub-millisecond.
 *
 * Uses jsonb_path_ops which is the right opclass for `@>` queries
 * specifically (smaller and faster than the default jsonb_ops).
 *
 * Idempotent — safe to re-run.
 *
 * Run: node scripts/migrations/addExternalJobSkillsIndex.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Adding GIN index on ExternalJobs.skills\n');
  try {
    console.log('📦 Step 1: Creating index "external_jobs_skills_gin"...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "external_jobs_skills_gin"
      ON "ExternalJobs" USING gin ("skills" jsonb_path_ops);
    `);
    console.log('   ✓ index created');
    console.log('\n✅ Migration completed successfully\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

async function down() {
  console.log('🔙 Reverting GIN index on ExternalJobs.skills\n');
  try {
    await sequelize.query(`DROP INDEX IF EXISTS "external_jobs_skills_gin";`);
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
