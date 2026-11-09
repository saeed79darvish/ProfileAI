/**
 * Migration: InterviewCodeAttempts, the reviewed answers to coding practice questions.
 * CREATE TABLE IF NOT EXISTS plus an index: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "InterviewCodeAttempts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "prepId" uuid NOT NULL,
      "question" text NOT NULL,
      "language" varchar(20) NOT NULL DEFAULT 'javascript',
      "code" text NOT NULL,
      "review" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "interview_code_user_prep"
    ON "InterviewCodeAttempts" ("userId", "prepId")
  `);
  console.log('[InterviewCodeAttempts] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
