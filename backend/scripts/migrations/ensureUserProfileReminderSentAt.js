/**
 * Migration: Add Users.profileReminderSentAt column.
 *
 * Context: services/profileReminderService.js emails a candidate once, a day
 * after signing up, if they still have no profile. This column records that
 * the email went out so it is never sent twice. Production skips
 * sequelize.sync, so this additive column must be created explicitly.
 *
 * ADD COLUMN IF NOT EXISTS is purely additive and idempotent, so it's safe to
 * run on every boot.
 *
 * Run: node scripts/migrations/ensureUserProfileReminderSentAt.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Ensuring Users.profileReminderSentAt column exists\n');

  await sequelize.query(`
    ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "profileReminderSentAt" TIMESTAMP WITH TIME ZONE;
  `);

  console.log('   ✓ Users.profileReminderSentAt ensured');
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
