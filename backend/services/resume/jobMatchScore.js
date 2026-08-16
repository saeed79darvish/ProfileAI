/**
 * Job Match Scoring
 *
 * The model's job is to READ (extract requirements, find evidence, judge role
 * family). The arithmetic happens here, in code, for three reasons:
 *   1. The score and the lists beside it can never disagree.
 *   2. A model asked for "a match percentage" anchors on 70-85 for everything;
 *      asked for per-requirement coverage it answers honestly.
 *   3. The weights are reviewable and tunable without touching a prompt.
 *
 * Scoring model:
 *   score = roleFit × (0.55·must + 0.15·nice + 0.20·seniority + 0.10·recency)
 *
 * roleFit MULTIPLIES rather than adds. A UI architect applying to a customer
 * marketing role shares plenty of vocabulary ("communication", "strategy") and
 * a purely additive model hands that back as ~30%. As a multiplier, a different
 * job family caps the whole result near the floor, which is the honest answer.
 */

const WEIGHTS = {
  must: 0.55,
  nice: 0.15,
  seniority: 0.20,
  recency: 0.10,
};

/** Evidence strength for one requirement, as a fraction of full credit. */
const COVERAGE_CREDIT = {
  strong: 1,     // named in a title, or demonstrated in a current/recent role
  partial: 0.5,  // skills list only, or only in a role that ended years ago
  none: 0,
};

/** Any score at or above this reads as "you're a plausible candidate". A
 *  posting the candidate is screened out of must not reach it, whatever the
 *  keyword overlap says. */
const BLOCKED_SCORE_CAP = 49;

const clamp01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/**
 * Requirements that an ATS or a recruiter screen can actually filter on.
 * "Strong communication skills" is a real requirement and a real gap, but no
 * screen has ever rejected a resume for it — calling it a blocker trains the
 * user to ignore the blocker list.
 */
const SCREENABLE_TYPES = new Set(['skill', 'credential', 'experience_years', 'title', 'education']);

/**
 * Weighted coverage over a requirement set.
 * Returns 1 when the set is empty — an absent requirement class must not drag
 * the score down (a JD with no stated "preferred" list isn't a 0% match on it).
 */
function coverageOf(requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return { ratio: 1, counted: 0 };
  }
  let earned = 0;
  for (const r of requirements) {
    earned += COVERAGE_CREDIT[r?.coverage] ?? 0;
  }
  return { ratio: clamp01(earned / requirements.length), counted: requirements.length };
}

/**
 * A gap tailoring can honestly close: the candidate HAS the experience, it just
 * isn't worded the way the posting words it. Surfacing those is exactly what
 * the tailoring prompt does. Requirements with no evidence at all are NOT in
 * this set — the tailoring prompt routes those to GENUINE GAPS rather than
 * inventing a bullet, so predicting them as closable would promise something
 * the product deliberately refuses to do.
 */
function isSurfaceable(r) {
  return r?.coverage === 'partial' || (r?.coverage === 'none' && r?.hasRelatedEvidence === true);
}

/**
 * @param {Object} read - the model's structured reading of JD vs profile
 * @param {Array}  read.requirements - {requirement, type, hardness, coverage, evidence, hasRelatedEvidence}
 * @param {number} read.roleFit - 0..1, same job family and track?
 * @param {number} read.seniorityFit - 0..1, level/years vs what the JD asks
 * @param {number} read.recency - 0..1, how current the matched skills are
 */
function scoreJobMatch(read) {
  const requirements = Array.isArray(read?.requirements) ? read.requirements : [];
  const must = requirements.filter((r) => r?.hardness === 'must');
  const nice = requirements.filter((r) => r?.hardness !== 'must');

  const mustCoverage = coverageOf(must);
  const niceCoverage = coverageOf(nice);
  const roleFit = clamp01(read?.roleFit);
  const seniorityFit = clamp01(read?.seniorityFit);
  const recency = clamp01(read?.recency);

  const weighted =
    WEIGHTS.must * mustCoverage.ratio +
    WEIGHTS.nice * niceCoverage.ratio +
    WEIGHTS.seniority * seniorityFit +
    WEIGHTS.recency * recency;

  const raw = Math.round(100 * roleFit * weighted);

  // Blockers: required, uncovered, and of a kind a screen actually filters on.
  const blockers = must
    .filter((r) => r?.coverage === 'none' && SCREENABLE_TYPES.has(r?.type))
    .map((r) => ({
      requirement: r.requirement,
      type: r.type,
      why: r.whyBlocking || 'Listed as required and absent from your profile.',
    }));

  const score = blockers.length > 0 ? Math.min(raw, BLOCKED_SCORE_CAP) : raw;

  // Honest projection: re-score with ONLY the surfaceable gaps closed. Every
  // other requirement stays exactly where it is, including role fit — tailoring
  // rewrites a resume, it does not change what job family someone comes from.
  const projectedRequirements = requirements.map((r) =>
    isSurfaceable(r) ? { ...r, coverage: 'strong' } : r,
  );
  const projectedMust = coverageOf(projectedRequirements.filter((r) => r?.hardness === 'must'));
  const projectedNice = coverageOf(projectedRequirements.filter((r) => r?.hardness !== 'must'));
  const projectedWeighted =
    WEIGHTS.must * projectedMust.ratio +
    WEIGHTS.nice * projectedNice.ratio +
    WEIGHTS.seniority * seniorityFit +
    WEIGHTS.recency * recency;
  const projectedBlockers = projectedRequirements.filter(
    (r) => r?.hardness === 'must' && r?.coverage === 'none' && SCREENABLE_TYPES.has(r?.type),
  );
  // Capped at 95: a rewrite closing every surfaceable gap still leaves the
  // parts of a screen a resume can't control. Promising 100% is a tell.
  const projectedRaw = Math.min(95, Math.round(100 * roleFit * projectedWeighted));
  const projectedScore = Math.max(
    score,
    projectedBlockers.length > 0 ? Math.min(projectedRaw, BLOCKED_SCORE_CAP) : projectedRaw,
  );

  return {
    score,
    projectedScore,
    blockers,
    components: {
      roleFit: Number(roleFit.toFixed(2)),
      mustCoverage: Number(mustCoverage.ratio.toFixed(2)),
      niceCoverage: Number(niceCoverage.ratio.toFixed(2)),
      seniorityFit: Number(seniorityFit.toFixed(2)),
      recency: Number(recency.toFixed(2)),
      mustCount: mustCoverage.counted,
      niceCount: niceCoverage.counted,
      cappedByBlockers: blockers.length > 0 && raw > BLOCKED_SCORE_CAP,
    },
    surfaceable: requirements.filter(isSurfaceable).map((r) => r.requirement),
  };
}

module.exports = { scoreJobMatch, WEIGHTS, COVERAGE_CREDIT, BLOCKED_SCORE_CAP, SCREENABLE_TYPES };
