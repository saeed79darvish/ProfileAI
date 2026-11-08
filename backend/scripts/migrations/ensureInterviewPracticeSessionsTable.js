/**
 * Migration: InterviewPracticeSessions, the notes from a spoken practice run.
 * CREATE TABLE IF NOT EXISTS plus an index: safe on every boot. Text only.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "InterviewPracticeSessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "prepId" uuid NOT NULL,
      "startedAt" timestamptz,
      "seconds" integer,
      "notes" jsonb,
      "summary" text,
      "topTip" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "interview_practice_user_prep"
    ON "InterviewPracticeSessions" ("userId", "prepId")
  `);
  console.log('[InterviewPracticeSessions] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
