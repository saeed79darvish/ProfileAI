/**
 * Boot step: scrub SEARCH/LIST-page URLs off existing ExternalJobs rows.
 *
 * Why: JSearch stored `job_google_link` (a Google Jobs SEARCH page, not the
 * posting) as `sourceUrl`, so clicking such a job dropped the user on a generic
 * "jobs" list instead of the role — the "goes to another job list" bug. The
 * ingest normalizers now emit only real deep links (see sanitizeExternalUrl in
 * services/externalJobService.js), but rows written before that fix still carry
 * the bad URL. This one-time, idempotent pass:
 *   - sets sourceUrl = applyUrl where sourceUrl is a Google/Bing/DuckDuckGo
 *     search page but applyUrl is a usable link, and
 *   - nulls any remaining search-page URL in either column.
 *
 * Runs in the BACKGROUND at boot (not awaited); safe to re-run (the WHERE
 * clauses naturally exclude already-clean rows).
 *
 * Run: node scripts/migrations/cleanupListPageJobUrls.js
 */

const { sequelize } = require('../../models');

// Mirrors JOB_LIST_URL_PATTERNS in services/externalJobService.js. POSIX regex
// for Postgres `~*` (case-insensitive). Search-ENGINE hosts only — a generic
// "/search?" match would wrongly null legitimate ATS deep links.
const SEARCH_URL_REGEX = '(google\\.[a-z.]+/search|bing\\.com/search|duckduckgo\\.com/)';

async function up() {
  // 1. Prefer the real apply link when the source URL is a search page.
  const [, promote] = await sequelize.query(
    `UPDATE "ExternalJobs"
        SET "sourceUrl" = "applyUrl"
      WHERE "sourceUrl" ~* :re
        AND "applyUrl" IS NOT NULL
        AND "applyUrl" !~* :re`,
    { replacements: { re: SEARCH_URL_REGEX } }
  );

  // 2. Null any still-remaining search-page URLs in either column.
  const [, nullSource] = await sequelize.query(
    `UPDATE "ExternalJobs" SET "sourceUrl" = NULL WHERE "sourceUrl" ~* :re`,
    { replacements: { re: SEARCH_URL_REGEX } }
  );
  const [, nullApply] = await sequelize.query(
    `UPDATE "ExternalJobs" SET "applyUrl" = NULL WHERE "applyUrl" ~* :re`,
    { replacements: { re: SEARCH_URL_REGEX } }
  );

  const fixed = (promote?.rowCount ?? 0) + (nullSource?.rowCount ?? 0) + (nullApply?.rowCount ?? 0);
  console.log(`✅ cleanupListPageJobUrls: scrubbed list/search-page URLs (${promote?.rowCount ?? 0} promoted, ${nullSource?.rowCount ?? 0} sourceUrl nulled, ${nullApply?.rowCount ?? 0} applyUrl nulled).`);
  return fixed;
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ cleanupListPageJobUrls failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
