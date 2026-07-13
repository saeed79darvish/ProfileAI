/**
 * Boot step: add sync-failure tracking to ATSBoards so we can expire "ghost"
 * jobs from boards that have gone dead (renamed / deleted / 404).
 *
 * Why: syncBoard only runs its "deactivate jobs that dropped out of the fetch"
 * step on a SUCCESSFUL sync. When a board starts erroring (Greenhouse 404 after
 * a company renames its board, Lever "board not found", a persistent fetch
 * failure) it returns early and its jobs stay isActive=true FOREVER — surfacing
 * postings that no longer exist. There was no signal to act on: ATSBoards only
 * stored the last `syncError` string, not how long a board had been failing.
 *
 * Adds two columns (both constant/nullable defaults → catalog-only, no rewrite,
 * no long lock):
 *   - consecutiveFailures INT  DEFAULT 0  — reset to 0 on every success,
 *     incremented on every failure. Drives the "this board is dead" decision.
 *   - lastSuccessfulSyncAt TIMESTAMPTZ    — last time the board synced cleanly.
 *     Lets a time-based rule ("no success in N days") complement the count.
 *
 * Idempotent — safe to re-run every boot. Backfills lastSuccessfulSyncAt from
 * the existing lastSyncAt for boards with no recorded error (best-effort: those
 * are the ones whose last sync we know succeeded).
 *
 * Run: node scripts/migrations/addBoardFailureTracking.js
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    ALTER TABLE "ATSBoards"
    ADD COLUMN IF NOT EXISTS "consecutiveFailures" integer NOT NULL DEFAULT 0
  `);
  await sequelize.query(`
    ALTER TABLE "ATSBoards"
    ADD COLUMN IF NOT EXISTS "lastSuccessfulSyncAt" timestamptz
  `);

  // Best-effort backfill: a board whose last sync recorded no error most likely
  // succeeded, so seed lastSuccessfulSyncAt from lastSyncAt. Only fills NULLs so
  // re-runs are no-ops once populated.
  await sequelize.query(`
    UPDATE "ATSBoards"
    SET "lastSuccessfulSyncAt" = "lastSyncAt"
    WHERE "lastSuccessfulSyncAt" IS NULL
      AND "lastSyncAt" IS NOT NULL
      AND "syncError" IS NULL
  `);

  console.log('✅ addBoardFailureTracking: ATSBoards.consecutiveFailures + lastSuccessfulSyncAt ready.');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ addBoardFailureTracking failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
