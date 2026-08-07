/**
 * Apply-tracking state machine: schema for distinguishing INTENT from a real
 * application.
 *
 * THE PROBLEM
 * -----------
 * "Applied" used to mean three very different things, all written as
 * status='applied':
 *   1. The user tapped "Apply Now" on a job card. We then opened the company's
 *      ATS in a new tab and never learned what happened next. This is INTENT.
 *   2. The Chrome extension AUTOFILLED a form. The user may well have closed
 *      the tab straight after. This is progress, not proof.
 *   3. ApplyPilot actually submitted to the ATS, or the user told us they
 *      applied. This is the only tier that is genuinely an application.
 *
 * Counting all three as "applied" inflates every applied count and badges jobs
 * the user never actually applied to. This migration adds the vocabulary to
 * tell them apart; applicationTrackingService.js enforces the transitions.
 *
 * WHAT IT ADDS
 * ------------
 *   - status gains 'clicked' and 'in_progress', BELOW 'applied' in the ladder.
 *   - confirmedBy   — which signal justified the current stage, so we can audit
 *                     ("click", "extension_submit", "applypilot", "user", ...).
 *   - confirmedAt   — when the row reached its current stage.
 *   - normalizedJobUrl — jobUrl with tracking params stripped and ordering made
 *                     canonical. The extension writes whatever URL the browser
 *                     had; the in-app click writes the job's applyUrl. Those
 *                     differ by utm_* / ref / gh_src for the SAME posting, so
 *                     the existing unique index on the RAW (userId, jobUrl)
 *                     never collapsed them and one application could occupy two
 *                     rows. Matching on the normalized value fixes that.
 *
 * SAFETY NOTES FOR A DEPLOY THAT GOES STRAIGHT TO PRODUCTION
 * ----------------------------------------------------------
 *   - Purely additive. No existing row changes status, so nothing a user can
 *     currently see moves. Rows written before this deploy are stamped
 *     confirmedBy='legacy_pre_state_machine' precisely BECAUSE we cannot tell
 *     retroactively whether they were real applications or just clicks —
 *     labelling them honestly is better than guessing.
 *   - The normalizedJobUrl index is intentionally NON-unique. Existing data may
 *     already contain rows that collide once normalized (that is the bug being
 *     fixed), so a unique index could fail the migration and, since server.js
 *     awaits this, block the whole deploy. Deduplication is enforced in the
 *     service layer instead, where it can merge rather than reject.
 *   - ALTER TYPE ... ADD VALUE is committed on its own before anything reads
 *     the new labels: PostgreSQL forbids using an enum value in the same
 *     transaction that added it.
 */

const sequelize = require('../../config/database');
const { normalizeJobUrl } = require('../../utils/jobUrl');

const BATCH_SIZE = 2000;
const MAX_BATCHES = 200;
const WRITE_TIMEOUT_MS = parseInt(process.env.SYNC_WRITE_TIMEOUT_MS || '120000', 10);

async function up({ verbose = true } = {}) {
  const log = verbose ? console.log : () => {};
  log('🚀 Ensuring ExternalApplications apply-tracking states…');

  // 1. New enum labels. Each ADD VALUE is its own statement/transaction so the
  //    labels are committed and usable by the statements that follow.
  for (const label of ['clicked', 'in_progress']) {
    await sequelize.query(
      `ALTER TYPE "enum_ExternalApplications_status" ADD VALUE IF NOT EXISTS '${label}'`
    );
  }
  log('  ✓ status enum has clicked + in_progress');

  // 2. Provenance columns. Nullable, no default → catalog-only, no rewrite.
  await sequelize.query(`
    SET lock_timeout = '10s';
    ALTER TABLE "ExternalApplications"
      ADD COLUMN IF NOT EXISTS "confirmedBy" VARCHAR(40),
      ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "normalizedJobUrl" TEXT;
  `);
  log('  ✓ confirmedBy / confirmedAt / normalizedJobUrl present');

  // 3. Stamp pre-existing rows. We genuinely do not know which of these were
  //    real applications, so they keep status='applied' (never demote data a
  //    user already sees) but are marked as un-verifiable for analytics.
  const [, legacyMeta] = await sequelize.query(`
    UPDATE "ExternalApplications"
       SET "confirmedBy" = 'legacy_pre_state_machine',
           "confirmedAt" = COALESCE("appliedAt", "createdAt")
     WHERE "confirmedBy" IS NULL
  `);
  log(`  ✓ stamped ${legacyMeta?.rowCount ?? 0} pre-existing row(s) as legacy`);

  // 4. Backfill normalizedJobUrl. Normalization lives in JS (shared with the
  //    request path so both sides agree byte-for-byte), so this reads a batch,
  //    computes, and writes it back. Batched in separate transactions — the
  //    15s statement_timeout every connection carries would cancel a
  //    whole-table update part-way.
  let normalized = 0;
  let batches = 0;
  for (; batches < MAX_BATCHES; batches++) {
    const [rows] = await sequelize.query(
      `SELECT id, "jobUrl" FROM "ExternalApplications"
        WHERE "jobUrl" IS NOT NULL AND "normalizedJobUrl" IS NULL
        LIMIT ${BATCH_SIZE}`
    );
    if (!rows.length) break;

    const ids = [];
    const values = [];
    for (const r of rows) {
      const key = normalizeJobUrl(r.jobUrl);
      // Unparseable URL: fall back to the raw value so the row still gets a
      // stable matching key rather than staying NULL forever and being
      // re-selected by this loop on every boot.
      ids.push(r.id);
      values.push(key || r.jobUrl);
    }

    await sequelize.transaction(async (t) => {
      await sequelize.query(`SET LOCAL statement_timeout = ${WRITE_TIMEOUT_MS}`, { transaction: t });
      await sequelize.query(
        `UPDATE "ExternalApplications" ea
            SET "normalizedJobUrl" = v.norm
           FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS norm) AS v
          WHERE ea.id = v.id`,
        { bind: [ids, values], transaction: t }
      );
    });
    normalized += rows.length;
  }
  if (batches >= MAX_BATCHES) {
    throw new Error(`normalizedJobUrl backfill did not converge after ${MAX_BATCHES} batches`);
  }
  log(`  ✓ normalized ${normalized} job URL(s)`);

  // 5. Lookup index for the service-layer dedup. Non-unique on purpose — see
  //    the safety notes above.
  await sequelize.query(`
    SET lock_timeout = '10s';
    CREATE INDEX IF NOT EXISTS external_applications_user_normalized_url_idx
    ON "ExternalApplications" ("userId", "normalizedJobUrl");
  `);
  log('  ✓ (userId, normalizedJobUrl) index present');

  log('✅ apply-tracking states ready.');
  return { legacyStamped: legacyMeta?.rowCount ?? 0, normalized };
}

if (require.main === module) {
  require('dotenv').config();
  up()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((err) => { console.error('❌ ensureApplyTrackingStates failed:', err.message); process.exit(1); });
}

module.exports = { up };
