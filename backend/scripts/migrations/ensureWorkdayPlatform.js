/**
 * Migration: let ATSBoards and ExternalJobs hold the 'workday' platform.
 * ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent, so it is safe on every boot. Must run before
 * any workday board is created (see ensureSeedBoards).
 */

const { sequelize } = require('../../models');

async function up() {
  for (const type of ['enum_ATSBoards_platform', 'enum_ExternalJobs_source']) {
    try {
      await sequelize.query(`ALTER TYPE "${type}" ADD VALUE IF NOT EXISTS 'workday'`);
    } catch (err) {
      // The type may not exist yet on a brand new database; the table is created with the value from the model then.
      console.warn(`[ensureWorkdayPlatform] ${type}: ${err.message}`);
    }
  }
  console.log("[ensureWorkdayPlatform] 'workday' platform ensured");
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
