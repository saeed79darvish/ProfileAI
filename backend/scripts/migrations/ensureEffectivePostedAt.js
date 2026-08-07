/**
 * Blocking, deploy-safe migration for "ExternalJobs"."effectivePostedAt".
 *
 * WHY THIS IS SEPARATE FROM ensureExternalJobPerfSchema.js
 * -------------------------------------------------------
 * That guard is a BACKGROUND, best-effort optimizer: everything it creates is
 * an index, so the app is merely slower until it finishes. This migration is
 * different in kind — every jobs query FILTERS AND SORTS on effectivePostedAt,
 * so the app is *incorrect* until it finishes:
 *
 *   - Before ADD COLUMN lands, every /external-jobs query fails outright with
 *     "column does not exist" → the whole jobs page 500s.
 *   - After ADD COLUMN but before the backfill lands, the column is NULL, and
 *     `WHERE "effectivePostedAt" >= :cutoff` is false for NULL → the jobs page
 *     renders EMPTY over a full corpus.
 *
 * Neither window is acceptable on a deploy that goes straight to production, so
 * server.js AWAITS this before app.listen(). If it throws, boot fails and the
 * platform keeps the previous release serving traffic — which is the correct
 * outcome: better to not deploy than to deploy an empty jobs page.
 *
 * WHY THE BACKFILL IS BATCHED IN JS
 * ---------------------------------
 * Connections set `statement_timeout = 15s` (config/database.js afterConnect),
 * tuned for the read path. A single UPDATE over the whole corpus — or a
 * server-side DO $$ LOOP, which is ONE transaction no matter how it chunks
 * internally — blows that cap and gets cancelled, leaving most rows NULL. Since
 * a partially-backfilled column reads as an empty jobs page, a cancelled
 * backfill is indistinguishable from an outage. So the loop lives here in JS:
 * each batch is its own short transaction with a locally raised timeout, it
 * commits as it goes, and an interrupted run simply resumes on the next boot
 * (the WHERE clause is self-selecting).
 */

const sequelize = require('../../config/database');
const { withMigrationLock, LOCK_KEYS } = require('./_migrationLock');

// Rows per batch. Small enough that one UPDATE stays far inside the raised
// timeout even on the smallest managed instance, large enough that a ~70k-row
// corpus completes in a handful of round trips.
const BATCH_SIZE = 2000;
// Hard stop so a pathological state (e.g. a trigger fighting the UPDATE) can
// never spin forever and wedge boot. 200 × 2000 = 400k rows, far above corpus.
const MAX_BATCHES = 200;
// The write path needs more headroom than the 15s read cap.
const WRITE_TIMEOUT_MS = parseInt(process.env.SYNC_WRITE_TIMEOUT_MS || '120000', 10);

// The single definition of the column. Bounding the source's date by our own
// first sighting is the whole point — see the model comment on the field.
const EFFECTIVE_EXPR = `LEAST(COALESCE("postedAt", "createdAt"), "createdAt")`;

async function up(opts = {}) {
  // Serialised across processes: concurrent boots running this same DDL fail
  // with "tuple concurrently updated". See _migrationLock.js.
  return withMigrationLock(LOCK_KEYS.effectivePostedAt, () => _up(opts));
}

async function _up({ verbose = true } = {}) {
  const log = verbose ? console.log : () => {};
  log('🚀 Ensuring ExternalJobs.effectivePostedAt (blocking — jobs feed depends on it)…');

  // 1. The column. Nullable with no default, so this is catalog-only in
  //    PostgreSQL 11+ (no table rewrite). lock_timeout keeps us from queueing
  //    behind a long sync transaction and blocking every reader behind us.
  await sequelize.query(`
    SET lock_timeout = '10s';
    ALTER TABLE "ExternalJobs"
    ADD COLUMN IF NOT EXISTS "effectivePostedAt" TIMESTAMP WITH TIME ZONE;
  `);
  log('  ✓ column present');

  // 2. The trigger that keeps it correct for every future write.
  //    Deliberately NOT column-scoped (no `UPDATE OF ...`): syncBoard's
  //    ON CONFLICT DO UPDATE excludes postedAt/createdAt, so a column-scoped
  //    trigger would not fire on an upsert and the derived column would drift.
  //    A column list also creates a pg_depend entry that makes ALTER COLUMN on
  //    postedAt fail, which breaks sequelize.sync({alter:true}) on dev boot.
  await sequelize.query(`
    SET lock_timeout = '10s';
    CREATE OR REPLACE FUNCTION external_jobs_set_effective_posted_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."effectivePostedAt" := LEAST(
        COALESCE(NEW."postedAt", NEW."createdAt"),
        NEW."createdAt"
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS external_jobs_effective_posted_at_trg ON "ExternalJobs";
    CREATE TRIGGER external_jobs_effective_posted_at_trg
      BEFORE INSERT OR UPDATE
      ON "ExternalJobs"
      FOR EACH ROW
      EXECUTE FUNCTION external_jobs_set_effective_posted_at();
  `);
  log('  ✓ trigger installed');

  // 3. Backfill existing rows, committing per batch.
  let totalUpdated = 0;
  let batches = 0;
  for (; batches < MAX_BATCHES; batches++) {
    const updated = await sequelize.transaction(async (t) => {
      await sequelize.query(`SET LOCAL statement_timeout = ${WRITE_TIMEOUT_MS}`, { transaction: t });
      const [rows] = await sequelize.query(
        `WITH batch AS (
           SELECT id FROM "ExternalJobs"
            WHERE "effectivePostedAt" IS DISTINCT FROM ${EFFECTIVE_EXPR}
            LIMIT ${BATCH_SIZE}
         )
         UPDATE "ExternalJobs" ej
            SET "effectivePostedAt" =
                  LEAST(COALESCE(ej."postedAt", ej."createdAt"), ej."createdAt")
           FROM batch b
          WHERE ej.id = b.id
         RETURNING ej.id`,
        { transaction: t }
      );
      return Array.isArray(rows) ? rows.length : 0;
    });
    if (updated === 0) break;
    totalUpdated += updated;
    log(`  … backfilled ${totalUpdated} rows`);
  }
  if (batches >= MAX_BATCHES) {
    throw new Error(
      `effectivePostedAt backfill did not converge after ${MAX_BATCHES} batches ` +
      `(${totalUpdated} rows updated). Refusing to start with a partially ` +
      `backfilled column — the jobs feed would render empty.`
    );
  }
  log(`  ✓ backfill complete (${totalUpdated} row(s) updated)`);

  // 4. Verify. A single remaining NULL means some rows would silently drop out
  //    of every date-filtered query, so treat it as a hard failure rather than
  //    shipping a feed that is quietly missing jobs.
  const [[check]] = await sequelize.query(
    `SELECT COUNT(*) FILTER (WHERE "effectivePostedAt" IS NULL)::int AS nulls,
            COUNT(*) FILTER (WHERE "effectivePostedAt" IS DISTINCT FROM ${EFFECTIVE_EXPR})::int AS wrong
       FROM "ExternalJobs"`
  ).then(([r]) => [r]);
  if (check.nulls > 0 || check.wrong > 0) {
    throw new Error(
      `effectivePostedAt verification failed: ${check.nulls} NULL, ${check.wrong} incorrect.`
    );
  }
  log('  ✓ verified: every row has a correct effectivePostedAt');

  // 5. Supporting index for the recency-ordered candidate pool. Non-fatal: the
  //    feed is CORRECT without it, only slower, and the background perf-schema
  //    guard retries it on every boot. So a lock timeout here must not block a
  //    deploy.
  try {
    await sequelize.query(`
      SET lock_timeout = '10s';
      CREATE INDEX IF NOT EXISTS external_jobs_active_effective_posted_idx
      ON "ExternalJobs" ("effectivePostedAt" DESC NULLS LAST)
      WHERE "isActive" = TRUE;
    `);
    log('  ✓ recency index present');
  } catch (err) {
    console.warn(`  ⚠️  recency index deferred to background guard: ${err.message}`);
  }

  log('✅ effectivePostedAt ready.');
  return { backfilled: totalUpdated };
}

if (require.main === module) {
  require('dotenv').config();
  up()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((err) => { console.error('❌ ensureEffectivePostedAt failed:', err.message); process.exit(1); });
}

module.exports = { up, EFFECTIVE_EXPR };
