/**
 * Migration: ExternalApplications follow-up columns.
 *
 * A started application ('clicked' or 'in_progress') is not asked about at the
 * moment of download. It is asked about later, once, when the person is back.
 * These columns remember that we asked, when to ask again, and when the person
 * said they are not applying.
 *
 * ADD COLUMN IF NOT EXISTS is additive and idempotent: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    ALTER TABLE "ExternalApplications"
      ADD COLUMN IF NOT EXISTS "askedAt"       TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "snoozedUntil"  TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "dismissedAt"   TIMESTAMP WITH TIME ZONE;
  `);
  console.log('[ExternalApplications] follow-up columns ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
