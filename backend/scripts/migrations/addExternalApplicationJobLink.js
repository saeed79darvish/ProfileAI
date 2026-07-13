/**
 * Boot step: link ExternalApplications directly to ExternalJobs.
 *
 * Why: applications tracked from an in-app "Apply Now" click need an EXACT
 * pointer to the job so the "Applied" badge is reliable, rather than the fuzzy
 * normalized-jobUrl comparison used for extension/manual rows. Adds a nullable
 * externalJobId FK plus a PARTIAL unique index so record-on-click is idempotent
 * (one application per user+job) while leaving NULL-externalJobId extension rows
 * unconstrained.
 *
 * Idempotent — safe to re-run. Column add is nullable (catalog-only, no rewrite,
 * no long lock). The FK is added separately and guarded so a re-run doesn't
 * error on the existing constraint. Best-effort backfill links existing rows to
 * a matching active ExternalJob by normalized apply/source URL.
 *
 * Run: node scripts/migrations/addExternalApplicationJobLink.js
 */

const { sequelize } = require('../../models');

async function up() {
  // 1. Nullable column (catalog-only add).
  await sequelize.query(`
    ALTER TABLE "ExternalApplications"
    ADD COLUMN IF NOT EXISTS "externalJobId" uuid
  `);

  // 2. FK constraint (guarded — ADD CONSTRAINT has no IF NOT EXISTS pre-PG15).
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'external_applications_external_job_fk'
      ) THEN
        ALTER TABLE "ExternalApplications"
          ADD CONSTRAINT external_applications_external_job_fk
          FOREIGN KEY ("externalJobId") REFERENCES "ExternalJobs"("id")
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 3. Partial unique index (idempotent).
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "external_applications_user_external_job_unique"
    ON "ExternalApplications" ("userId", "externalJobId")
    WHERE "externalJobId" IS NOT NULL
  `);

  // 4. Best-effort backfill: link existing rows to an active ExternalJob whose
  //    applyUrl/sourceUrl matches the stored jobUrl after light normalization
  //    (lowercase, strip trailing slash). Only fills NULLs; skips rows that
  //    would violate the new unique index (a user already linked to that job).
  const [, meta] = await sequelize.query(`
    UPDATE "ExternalApplications" ea
       SET "externalJobId" = ej.id
      FROM "ExternalJobs" ej
     WHERE ea."externalJobId" IS NULL
       AND ea."jobUrl" IS NOT NULL
       AND rtrim(lower(ea."jobUrl"), '/') IN (
             rtrim(lower(ej."applyUrl"),  '/'),
             rtrim(lower(ej."sourceUrl"), '/')
           )
       AND NOT EXISTS (
             SELECT 1 FROM "ExternalApplications" e2
              WHERE e2."userId" = ea."userId"
                AND e2."externalJobId" = ej.id
           )
  `);

  console.log(`✅ addExternalApplicationJobLink: ExternalApplications.externalJobId ready (+${meta?.rowCount ?? 0} backfilled).`);
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ addExternalApplicationJobLink failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
