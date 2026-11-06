/**
 * Migration: CareerContexts.learnedAnswers.
 *
 * Answers the person gave on application forms, remembered so the same kind of
 * question is filled in next time. ADD COLUMN IF NOT EXISTS is additive and
 * idempotent: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    ALTER TABLE "CareerContexts"
      ADD COLUMN IF NOT EXISTS "learnedAnswers" JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  console.log('[CareerContexts] learnedAnswers column ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
