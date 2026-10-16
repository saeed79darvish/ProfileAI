/**
 * What a job-match score means, in one place.
 *
 * The number comes from /profiles/job-match: the posting's requirements read
 * and graded against the stored profile, the same score the extension shows.
 * The job list used to put "NN% · Excellent match" on cards from search
 * relevance — mostly whether the title contained the search words — so every
 * "Frontend Engineer" title read 100%. A card now shows this score or nothing.
 *
 * The bands describe what to do, not just how good it is: a 30-49 role is a
 * stretch that can be worth applying to, and saying so keeps a low-but-real
 * score from reading as "don't bother".
 */

export const MATCH_TIERS = [
  { min: 70, tier: 'strong', label: 'Strong match', advice: 'Apply.', color: '#027A48' },
  { min: 50, tier: 'good', label: 'Good match', advice: 'Apply, and tailor for the gaps.', color: '#6941C6' },
  { min: 30, tier: 'stretch', label: 'Stretch', advice: 'Worth applying if you can speak to the gaps.', color: '#B54708' },
  { min: 0, tier: 'longshot', label: 'Long shot', advice: 'A different kind of role from your background.', color: '#667085' },
];

/** The band for a score, or null when there is no score. */
export function matchTier(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return MATCH_TIERS.find((t) => score >= t.min) || MATCH_TIERS[MATCH_TIERS.length - 1];
}

/** Scores at or above this are known-good and lead the "Best match" list. */
export const KNOWN_GOOD_SCORE = 50;

/**
 * "Best match" order for a loaded page of jobs.
 *
 * Only some jobs have a real score. Known-good matches lead (best first),
 * jobs not scored yet keep the server's relevance order in the middle, and
 * known-poor matches go last — a real score outranks a guess in both
 * directions, and nothing unscored is pushed up or down by a number it
 * doesn't have.
 */
export function orderByMatch(jobs, scores) {
  const scoreOf = (job) => {
    const s = scores?.[job?.id]?.score;
    return typeof s === 'number' ? s : null;
  };
  const good = [];
  const unscored = [];
  const poor = [];
  for (const job of jobs || []) {
    const s = scoreOf(job);
    if (s === null) unscored.push(job);
    else if (s >= KNOWN_GOOD_SCORE) good.push(job);
    else poor.push(job);
  }
  const byScore = (a, b) => scoreOf(b) - scoreOf(a);
  return [...good.sort(byScore), ...unscored, ...poor.sort(byScore)];
}

/**
 * The lists a match view shows, from the server payload. Responsibilities
 * carry no weight in the score, so they aren't shown as gaps.
 */
export function matchLists(data) {
  const reqs = (Array.isArray(data?.requirements) ? data.requirements : []).filter(
    (r) => r && r.type !== 'responsibility' && r.requirement,
  );
  const knockouts = new Set((data?.blockers || []).map((b) => String(b.requirement).toLowerCase()));
  const pick = (coverage) => reqs.filter((r) => r.coverage === coverage);
  return {
    met: pick('strong'),
    partial: pick('partial'),
    gaps: pick('none').filter((r) => !knockouts.has(String(r.requirement).toLowerCase())),
    knockouts: data?.blockers || [],
  };
}
