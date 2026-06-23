/**
 * Boot step: ensure the canonical free ATS boards exist.
 *
 * Context: ATS boards were previously only inserted by the MANUAL
 * scripts/seedATSBoards.js, which the git-push → Render deploy flow never
 * runs. As a result, adding new company boards to the seed list had no effect
 * on production. This boot step closes that gap: it idempotently upserts every
 * free / no-auth board (greenhouse, lever, ashby, remoteok, wwr, hn_hiring)
 * from config/seedBoards.js using findOrCreate, so a plain `git push` lands
 * new boards in prod. The regular sync cron then ingests their jobs.
 *
 * Notes:
 *   - Only free platforms are ensured here. Keyed/paid platforms (jsearch,
 *     theirstack, adzuna) are skipped — they're managed via seedATSBoards.js
 *     where their ENUM values + keys are handled explicitly.
 *   - findOrCreate is keyed on (platform, boardToken); existing rows are left
 *     untouched (we never flip isActive or rename here).
 *   - No schema sync, no ENUM ALTER (these platform ENUM values already exist
 *     in prod). Purely additive row inserts → safe to run on every boot.
 *
 * Run: node scripts/migrations/ensureSeedBoards.js
 */

const { ATSBoard } = require('../../models');
const { SEED_BOARDS } = require('../../config/seedBoards');

// Free / no-auth platforms safe to ensure on every boot.
const FREE_PLATFORMS = new Set([
  'greenhouse',
  'lever',
  'ashby',
  'remoteok',
  'wwr',
  'hn_hiring',
]);

// A DB that is restarting/recovering rejects every connection. Detect it so we
// can bail out of the whole loop instead of hammering it ~114 more times (which
// only floods logs and slows the DB's recovery).
function isDbUnavailable(err) {
  const msg = (err && err.message ? err.message : '').toLowerCase();
  return (
    msg.includes('in recovery') ||
    msg.includes('not yet accepting connections') ||
    msg.includes('econnrefused') ||
    msg.includes('the database system is starting up') ||
    msg.includes('terminating connection')
  );
}

async function up() {
  const boards = SEED_BOARDS.filter((b) => FREE_PLATFORMS.has(b.platform));
  let created = 0;

  for (const board of boards) {
    try {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        defaults: { name: board.name, isActive: true },
      });
      if (wasCreated) {
        created++;
        console.log(`   + ${board.name} (${board.platform}/${board.boardToken})`);
      }
    } catch (err) {
      // If the DB itself is down/recovering, stop entirely — retrying the
      // remaining boards is pointless and harmful. Boot continues; the boards
      // already exist and will sync once the DB is back.
      if (isDbUnavailable(err)) {
        console.warn(`   ⚠️  ensureSeedBoards aborted: database unavailable (${err.message}). Skipping the rest; boards persist from a prior boot.`);
        return;
      }
      // One bad row must never block the rest (or boot).
      console.warn(`   ⚠️  ${board.platform}/${board.boardToken} ensure skipped: ${err.message}`);
    }
  }

  console.log(`✅ ensureSeedBoards: ${created} new board(s) created, ${boards.length - created} already existed.`);
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ ensureSeedBoards failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
