/**
 * Boot step: the BoardCandidates table, the waiting room for job boards we have heard of but not added yet.
 *
 * A candidate comes from a list (today the StoreSignal directory; later Common Crawl, the extension, careers
 * pages). Each one is checked against its system's public feed, scored by how many US and US tech jobs it has,
 * and only then promoted into ATSBoards, best first, while there is room under MAX_ACTIVE_BOARDS. Keeping them
 * apart means a list of thousands of boards never lands on the sync all at once.
 *
 * status: pending (not checked yet), validated (checked, waiting for room), added (now an ATSBoard),
 *         exists (we already had it), rejected (gone, empty, agency, demo, or no US jobs; see reason).
 *
 * Idempotent; safe to run on every boot and from the cron worker.
 * Run: node scripts/migrations/ensureBoardCandidatesTable.js
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "BoardCandidates" (
      id            bigserial PRIMARY KEY,
      platform      varchar(32)  NOT NULL,
      "boardToken"  varchar(255) NOT NULL,
      name          varchar(255),
      source        varchar(32)  NOT NULL,
      "sizeHint"    integer      NOT NULL DEFAULT 0,
      status        varchar(16)  NOT NULL DEFAULT 'pending',
      reason        varchar(64),
      jobs          integer,
      us            integer,
      tech          integer,
      "techUs"      integer,
      score         integer,
      "checkedAt"   timestamptz,
      "createdAt"   timestamptz  NOT NULL DEFAULT now(),
      "updatedAt"   timestamptz  NOT NULL DEFAULT now(),
      UNIQUE (platform, "boardToken")
    )
  `);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "BoardCandidates_status_score" ON "BoardCandidates" (status, score DESC NULLS LAST)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "BoardCandidates_status_size" ON "BoardCandidates" (status, "sizeHint" DESC)`);
}

if (require.main === module) {
  up()
    .then(() => { console.log('✅ ensureBoardCandidatesTable: ready.'); process.exit(0); })
    .catch((err) => { console.error('❌ ensureBoardCandidatesTable failed:', err); process.exit(1); });
}

module.exports = { up };
