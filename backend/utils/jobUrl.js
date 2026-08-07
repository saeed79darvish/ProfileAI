/**
 * Canonical job-URL normalization.
 *
 * The same posting reaches us with different URLs depending on the path taken:
 * the in-app "Apply" click records the job's `applyUrl`, while the Chrome
 * extension records whatever was in the address bar — usually the same page
 * plus utm_*, ref, gh_src or similar. Comparing raw URLs therefore treats one
 * application as two, which is why "Applied" badges and applied counts drifted.
 *
 * Rules:
 *   - Host and path lowercased; trailing slashes dropped.
 *   - Known tracking params removed; the REST are kept and sorted. Query params
 *     are deliberately NOT dropped wholesale — embedded Greenhouse boards
 *     identify the posting solely via `?gh_jid=`, so discarding the query would
 *     collapse every job on a careers page into one key.
 *
 * Returns null when the input isn't a parseable absolute URL, so callers can
 * decide whether to fall back to the raw string.
 *
 * This lives in its own module because the value is PERSISTED (as
 * ExternalApplications.normalizedJobUrl) and then matched against values
 * computed at request time. If the two ever disagreed, stored keys would stop
 * matching new lookups and duplicates would silently reappear — so there must
 * be exactly one implementation.
 */

const TRACKING_PARAM_RE =
  /^(utm_\w+|ref|referrer|source|src|gh_src|lever-source(\[\])?|fbclid|gclid|mc_cid|mc_eid|trk|trackingId)$/i;

function normalizeJobUrl(raw) {
  if (!raw) return null;
  try {
    const url = new URL(String(raw).trim());
    const params = [...url.searchParams.entries()]
      .filter(([k]) => !TRACKING_PARAM_RE.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin.toLowerCase()}${path.toLowerCase()}${params ? `?${params}` : ''}`;
  } catch {
    return null;
  }
}

module.exports = { normalizeJobUrl, TRACKING_PARAM_RE };
