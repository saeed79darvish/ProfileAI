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

  // 4. Best-effort backfill, once. The URL comparison cannot use an index, so on
  //    the real job table it takes longer than the startup statement limit and
  //    used to time out (and rerun) on every boot. It now runs in the background
  //    with its own limit, and a comment on the column records that it finished.
  const [[marker]] = await sequelize.query(`
    SELECT col_description('"ExternalApplications"'::regclass, a.attnum) AS note
      FROM pg_attribute a
     WHERE a.attrelid = '"ExternalApplications"'::regclass AND a.attname = 'externalJobId'
  `);
  if (marker && marker.note === BACKFILL_MARKER) {
    console.log('✅ addExternalApplicationJobLink: ExternalApplications.externalJobId ready (backfill already done).');
    return;
  }
  console.log('✅ addExternalApplicationJobLink: ExternalApplications.externalJobId ready (backfill running in the background).');
  backfill().catch((err) => console.warn('⚠️  ExternalApplications job-link backfill will retry next boot:', err.message));
}

const BACKFILL_MARKER = 'backfilled';

/** Links existing rows to an active ExternalJob whose applyUrl/sourceUrl matches the stored jobUrl
 *  after light normalization (lowercase, strip trailing slash). Only fills NULLs; skips rows that
 *  would violate the unique index. Marks the column when it completes. */
async function backfill() {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("SET LOCAL statement_timeout = '180s'", { transaction });
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
    `, { transaction });
    await sequelize.query(`COMMENT ON COLUMN "ExternalApplications"."externalJobId" IS '${BACKFILL_MARKER}'`, { transaction });
    console.log(`✅ addExternalApplicationJobLink: backfill complete (+${meta?.rowCount ?? 0} linked).`);
  });
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ addExternalApplicationJobLink failed:', err);
      process.exit(1);
    });
}

module.exports = { up, backfill };
