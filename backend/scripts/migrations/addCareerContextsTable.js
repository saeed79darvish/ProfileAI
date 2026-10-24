/**
 * Migration: create CareerContexts table
 *
 * Prod skips sequelize.sync (see server.js), so the CareerContext model
 * shipped without its table and every /api/career-context call failed with
 * a 500 ("relation CareerContexts does not exist"). Mirrors the model in
 * models/CareerContext.js.
 *
 * Safe to run on every boot — every statement uses IF NOT EXISTS.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('[CareerContexts] Ensuring table exists...');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "CareerContexts" (
      "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"        UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
      "target"        VARCHAR(200),
      "targetWhy"     TEXT,
      "targetBlocker" TEXT,
      "constraints"   JSONB NOT NULL DEFAULT '{}'::jsonb,
      "assessment"    JSONB,
      "summaries"     JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // One row per user; the service upserts on it.
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "career_contexts_user_id"
      ON "CareerContexts"("userId");
  `);

  console.log('[CareerContexts] ✓ Table ready');
}

module.exports = { up };

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
