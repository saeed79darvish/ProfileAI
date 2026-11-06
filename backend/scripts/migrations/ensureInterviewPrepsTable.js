/**
 * Migration: InterviewPreps, the shared (company, role) research cache for
 * Interview prep. CREATE TABLE IF NOT EXISTS plus the unique index: safe on
 * every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "InterviewPreps" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "companyKey" varchar(255) NOT NULL,
      "roleKey" varchar(255) NOT NULL,
      "status" varchar(255) NOT NULL DEFAULT 'pending',
      "payload" jsonb,
      "error" text,
      "generatedAt" timestamptz,
      "expiresAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "interview_preps_company_role_unique"
    ON "InterviewPreps" ("companyKey", "roleKey")
  `);
  console.log('[InterviewPreps] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
