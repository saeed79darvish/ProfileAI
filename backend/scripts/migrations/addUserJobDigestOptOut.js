/**
 * Migration: Add Users.jobDigestOptOut column.
 *
 * Context: The daily job-match digest email (services/jobDigestService.js)
 * excludes users who set jobDigestOptOut = true, and the public unsubscribe
 * link (GET /api/external-jobs/digest/unsubscribe) flips it. Production skips
 * sequelize.sync, so this additive column must be created explicitly.
 *
 * ADD COLUMN IF NOT EXISTS is purely additive and idempotent, so it's safe to
 * run on every boot.
 *
 * Run: node scripts/migrations/addUserJobDigestOptOut.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Ensuring Users.jobDigestOptOut column exists\n');

  await sequelize.query(`
    ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "jobDigestOptOut" BOOLEAN NOT NULL DEFAULT false;
  `);

  console.log('   ✓ Users.jobDigestOptOut ensured');
  console.log('\n✅ Done.');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
