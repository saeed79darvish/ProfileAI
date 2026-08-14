/**
 * Shaping helpers for the /external-jobs LIST response.
 *
 * Kept out of the route module so the transform can be exercised directly
 * without standing up Express, Sequelize, or a database.
 */

/**
 * How much of each job's `description` the LIST response carries.
 *
 * Full descriptions average ~6.5KB. At 20 jobs a page that was 87% of a
 * ~160KB listing payload (measured against production), and Render meters
 * bandwidth on what leaves the API process — so the corpus was being billed
 * repeatedly to render cards that never display a description at all.
 *
 * We can't simply drop the field: the detail panel paints immediately from
 * the list payload on purpose, because waiting on a getById round-trip was a
 * user-visible "detail loads slowly" bug (see the auto-select effect in
 * frontend/src/pages/CandidateJobs/index.jsx). A snippet keeps that instant
 * paint while the client hydrates the full text in the background.
 *
 * 300 chars is roughly the two lines visible above the fold before the
 * hydrated copy swaps in.
 */
const LIST_DESCRIPTION_SNIPPET_CHARS = 300;

/**
 * Collapse an all-null `companyInfo` to null.
 *
 * Two of the three list paths build companyInfo from a LEFT JOIN that misses
 * for jobs not yet linked to a Companies row: the semantic path's
 * json_build_object returns {id: null, name: null, ...}, and Sequelize's
 * `nest: true` does the same for a raw include. Both are OBJECTS, so they are
 * truthy — and the client does `if (job.companyInfo)` before deciding whether
 * to fall back to company details mined into job.metadata. A truthy husk of
 * nulls therefore suppressed that fallback and rendered a blank company block.
 *
 * Normalizing here means every path emits either a populated object or null.
 */
function normalizeCompanyInfo(job) {
  const ci = job.companyInfo;
  if (!ci || typeof ci !== 'object') return job;
  const hasAnyValue = Object.values(ci).some((v) => v !== null && v !== undefined);
  if (hasAnyValue) return job;
  return { ...job, companyInfo: null };
}

/**
 * Trim `description` on every job in a list payload.
 *
 * MUST run at serialization time, never as a SQL-level LEFT(): relevance
 * scoring reads the whole description to mine skills and score matches (see
 * services/jobRelevanceService.js), so the ranker needs the full text even
 * though the response does not. Reading it from Postgres is app-internal and
 * costs no metered bandwidth; shipping it to the browser is what we avoid.
 *
 * Returns a NEW payload. Sequelize instances are converted via toJSON() and
 * never mutated, because the same instances are still referenced by the
 * ranking pool upstream.
 *
 * Jobs whose description already fits are returned unflagged, so the client
 * only pays for a hydration fetch when it actually holds a partial copy.
 *
 * @param {object} payload  A `{ jobs: [...], pagination: {...} }` envelope.
 * @returns {object}        The same envelope with descriptions trimmed.
 */
function truncateListDescriptions(payload) {
  if (!payload || !Array.isArray(payload.jobs)) return payload;
  return {
    ...payload,
    jobs: payload.jobs.map((job) => {
      const plain = normalizeCompanyInfo(
        typeof job?.toJSON === 'function' ? job.toJSON() : { ...job },
      );
      const desc = plain.description;
      if (typeof desc !== 'string' || desc.length <= LIST_DESCRIPTION_SNIPPET_CHARS) {
        return plain;
      }
      return {
        ...plain,
        description: desc.slice(0, LIST_DESCRIPTION_SNIPPET_CHARS),
        // Tells the client this copy is a preview, so it knows to hydrate
        // from GET /external-jobs/:id rather than treating it as complete.
        descriptionTruncated: true,
      };
    }),
  };
}

module.exports = {
  LIST_DESCRIPTION_SNIPPET_CHARS,
  truncateListDescriptions,
};
