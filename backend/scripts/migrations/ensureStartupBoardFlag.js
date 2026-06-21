/**
 * Boot step: add ATSBoards.isStartup and derive it from board provenance.
 *
 * Why: the "Startups" job filter used to treat `source IN (greenhouse, lever,
 * ashby, …)` as a startup signal. Greenhouse alone hosts ~22k jobs incl. big
 * names (Airbnb, Roblox, Datadog), so the filter was effectively a no-op
 * (~27k of 36k jobs passed). We instead flag the BOARD: boards discovered via
 * the YC / VC-portfolio crawl (services/startupBoardDiscovery.js) are genuine
 * startups; the hand-curated SEED_BOARDS list (config/seedBoards.js) is the
 * set of known, mostly-large companies.
 *
 * Derivation (idempotent — safe to re-run every boot):
 *   - isStartup = TRUE  for greenhouse/lever/ashby boards NOT in SEED_BOARDS
 *     (i.e. boards that could only have arrived via discovery).
 *   - isStartup = FALSE for every board in SEED_BOARDS (forced, in case a
 *     prior run or manual edit flipped it).
 *   - all other platforms (remoteok/wwr/jsearch/theirstack/adzuna/amazon/
 *     manual/hn_hiring) keep the column default FALSE — they are aggregators
 *     or hand-seeded, not per-company startup boards. hn_hiring is handled as
 *     an explicit OR-arm in the filter itself, not via this flag.
 *
 * The column add is `ADD COLUMN IF NOT EXISTS … DEFAULT false` — a constant
 * default, so PostgreSQL 11+ adds it as catalog-only metadata (no table
 * rewrite, no long lock). This is AWAITED at boot BEFORE the seed/discovery
 * board steps so the ATSBoard model's isStartup field never queries a column
 * that doesn't exist yet.
 *
 * Run: node scripts/migrations/ensureStartupBoardFlag.js
 */

const { sequelize } = require('../../models');
const { SEED_BOARDS } = require('../../config/seedBoards');

// Only these platforms are ever created by discovery, so only these can be
// auto-promoted to startup. Keeps aggregator boards (jsearch/theirstack/…)
// out of the Startups filter.
const DISCOVERY_PLATFORMS = ['greenhouse', 'lever', 'ashby'];

async function up() {
  // 1. Add the column (catalog-only; constant default → no rewrite).
  await sequelize.query(`
    ALTER TABLE "ATSBoards"
    ADD COLUMN IF NOT EXISTS "isStartup" boolean NOT NULL DEFAULT false
  `);

  // Parallel arrays of the curated (non-startup) seed boards. Passed as
  // positional `bind` params (NOT `replacements`): node-postgres binds a JS
  // array as a native Postgres array, so `$n::text[]` is a real array — whereas
  // Sequelize `replacements` would expand the array to a comma-separated quoted
  // list and break the CAST. unnest of the two parallel arrays reconstructs the
  // (platform, token) tuples for a set-membership probe.
  const seedPlatforms = SEED_BOARDS.map((b) => b.platform);
  const seedTokens = SEED_BOARDS.map((b) => b.boardToken);

  // 2. Promote discovery boards (greenhouse/lever/ashby NOT in the seed list).
  const [, promoteMeta] = await sequelize.query(
    `
    UPDATE "ATSBoards" ats
    SET "isStartup" = true
    WHERE ats.platform = ANY($1::text[])
      AND ats."isStartup" = false
      AND NOT EXISTS (
        SELECT 1
        FROM unnest($2::text[], $3::text[]) AS s(platform, token)
        WHERE s.platform = ats.platform
          AND s.token = ats."boardToken"
      )
    `,
    { bind: [DISCOVERY_PLATFORMS, seedPlatforms, seedTokens] }
  );

  // 3. Force every curated seed board back to non-startup (self-correcting).
  const [, demoteMeta] = await sequelize.query(
    `
    UPDATE "ATSBoards" ats
    SET "isStartup" = false
    WHERE ats."isStartup" = true
      AND EXISTS (
        SELECT 1
        FROM unnest($1::text[], $2::text[]) AS s(platform, token)
        WHERE s.platform = ats.platform
          AND s.token = ats."boardToken"
      )
    `,
    { bind: [seedPlatforms, seedTokens] }
  );

  const promoted = promoteMeta?.rowCount ?? 0;
  const demoted = demoteMeta?.rowCount ?? 0;
  console.log(
    `✅ ensureStartupBoardFlag: isStartup column ready; +${promoted} promoted, ${demoted} demoted to non-startup.`
  );
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ ensureStartupBoardFlag failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
