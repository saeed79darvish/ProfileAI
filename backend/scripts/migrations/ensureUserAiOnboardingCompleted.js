/**
 * Migration: Add Users.aiOnboardingCompleted column.
 *
 * Context: The User model declares aiOnboardingCompleted (BOOLEAN, default
 * false). The aiRateLimiter reads it to decide whether to apply the generous
 * "onboarding" AI tier for new candidates. Production skips sequelize.sync,
 * so without this migration `SELECT ... "aiOnboardingCompleted" ...` fails
 * with `column "aiOnboardingCompleted" does not exist` on EVERY User.find*
 * that includes model defaults — most visibly the /api/resume/preview
 * endpoint, which returned a 500 and left the mobile Download Resume modal
 * stuck on "Preview failed to load".
 *
 * ADD COLUMN IF NOT EXISTS is purely additive and idempotent, so it's safe
 * to run on every boot.
 *
 * Run: node scripts/migrations/ensureUserAiOnboardingCompleted.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Ensuring Users.aiOnboardingCompleted column exists\n');

  await sequelize.query(`
    ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "aiOnboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
  `);

  console.log('   ✓ Users.aiOnboardingCompleted ensured');
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
