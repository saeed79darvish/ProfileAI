/**
 * Migration: UserInterviewPreps, each user's history of interview preps.
 * CREATE TABLE IF NOT EXISTS plus the unique index: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "UserInterviewPreps" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "prepId" uuid NOT NULL,
      "tailoredProfileId" uuid,
      "source" varchar(255),
      "label" varchar(255),
      "lastOpenedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_interview_preps_user_prep_unique"
    ON "UserInterviewPreps" ("userId", "prepId")
  `);
  console.log('[UserInterviewPreps] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
