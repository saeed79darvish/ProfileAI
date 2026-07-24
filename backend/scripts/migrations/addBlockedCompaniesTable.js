/**
 * Boot step: create the BlockedCompanies table — the manual moderation lever
 * for scam / low-quality job postings. No automated scam detection exists in
 * this codebase; this gives an admin a way to (a) instantly purge a company's
 * existing boards + jobs and (b) stop it from ever being re-ingested, without
 * touching the discovery/sync pipeline that brings in new legitimate jobs.
 *
 * Idempotent — safe to re-run every boot.
 *
 * Run: node scripts/migrations/addBlockedCompaniesTable.js
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "BlockedCompanies" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "companyName" varchar(255) NOT NULL,
      "reason" text,
      "createdBy" uuid REFERENCES "Users"("id"),
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "blocked_companies_company_name_unique"
    ON "BlockedCompanies" ("companyName")
  `);

  console.log('✅ addBlockedCompaniesTable: BlockedCompanies ready.');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ addBlockedCompaniesTable failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
