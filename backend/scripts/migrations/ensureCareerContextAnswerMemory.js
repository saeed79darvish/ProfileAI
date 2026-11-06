/**
 * Migration: CareerContexts.answerFacts and CareerContexts.answerStories.
 *
 * The answer memory (what a person told us so we can answer application
 * questions for them) lives on the CareerContext row. Prod skips
 * sequelize.sync, so without these columns every career-context read would
 * fail once the model declares them.
 *
 * ADD COLUMN IF NOT EXISTS is additive and idempotent: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    ALTER TABLE "CareerContexts"
      ADD COLUMN IF NOT EXISTS "answerFacts"   JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "answerStories" JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  console.log('[CareerContexts] answer memory columns ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
