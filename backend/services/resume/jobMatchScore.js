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
 *   score = 100 × coverage × roleFit × seniorityFactor × recencyFactor
 *
 * Everything except coverage MULTIPLIES. The score answers one question — how
 * much of what this posting asks for can the candidate actually evidence — and
 * the other three dimensions can only modulate that answer, never substitute
 * for it.
 *
 * That is a deliberate change from the earlier additive model
 * (0.55·must + 0.15·nice + 0.20·seniority + 0.10·recency), which had a floor
 * built into it: seniority and recency come back at or near 1.0 for almost
 * everybody, so a candidate who could evidence NOTHING still scored 35%, and
 * every real score inherited that lift. Multiplying puts a zero-coverage
 * application at zero, which is what the user needs to be told.
 *
 * Four things keep the number honest:
 *
 *   - Coverage drives the result. Meeting half the requirements scores about
 *     half, not "half plus the free points".
 *   - A dimension with nothing to measure is DROPPED and its weight shared out
 *     among the rest. Most postings have no "Preferred" section, and the old
 *     "empty set scores 1.0" rule handed those applications a free 15 points
 *     for having nothing to be judged on.
 *   - Requirements are weighted by type. "Strong communication skills" is a
 *     real line in a posting, but it is not the reason anyone gets screened
 *     out, and letting it carry the same weight as a named technology lets a
 *     values-heavy JD score like a qualified candidate. Responsibilities
 *     ("participate in on-call rotations") are duties rather than
 *     requirements and are excluded from the arithmetic entirely.
 *   - seniorityFit is computed from dates and stated minimums when the posting
 *     gives us a number, rather than asked for as a free-form 0-1 — which is
 *     exactly the "hand me a score" question models answer with 0.9 no matter
 *     what. The model's value is a fallback for postings that state no years.
 */

/** Relative weight of the two requirement classes within coverage. Preferred
 *  qualifications count, but a posting's Requirements section is the screen. */
const WEIGHTS = {
  must: 0.55,
  nice: 0.15,
};

/**
 * How far a mismatch on the modulating dimensions can pull the score down.
 *
 * A seniority mismatch is serious but not disqualifying on its own — at worst
 * it costs 30% of the score. Recency is a weaker signal and moves it 15%. Both
 * are floors rather than full multipliers so that one soft judgement can never
 * wipe out a genuinely well-evidenced match.
 */
const SENIORITY_FLOOR = 0.70;
const RECENCY_FLOOR = 0.85;

const modulate = (floor, value) => floor + (1 - floor) * clamp01(value);

/** Evidence strength for one requirement, as a fraction of full credit. */
const COVERAGE_CREDIT = {
  strong: 1,     // named in a title, or demonstrated in a current/recent role
  partial: 0.5,  // skills list only, or only in a role that ended years ago
  none: 0,
};

/**
 * How much one requirement counts, by what kind of thing it is.
 *
 * A screen rejects on skills, credentials, years and degrees. It does not
 * reject on "collaborates well", and nobody is filtered out for not having
 * done on-call — so a posting padded with those must not be able to lift or
 * sink the score the way a hard requirement does.
 */
const TYPE_WEIGHT = {
  skill: 1,
  experience_years: 1,
  credential: 1,
  education: 1,
  title: 1,
  domain: 0.75,
  soft: 0.25,
  responsibility: 0,
};

/** Unrecognised types are treated as ordinary requirements rather than dropped. */
const DEFAULT_TYPE_WEIGHT = 1;

const typeWeight = (type) => {
  const w = TYPE_WEIGHT[type];
  return typeof w === 'number' ? w : DEFAULT_TYPE_WEIGHT;
};

/** Requirements that carry no weight are shown but never scored. */
const isScored = (r) => typeWeight(r?.type) > 0;

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
 * Type-weighted coverage over a requirement set.
 *
 * Returns `ratio: null` when there is nothing to measure — no requirements, or
 * only unweighted ones. Null means "drop this dimension", NOT "full marks":
 * the absence of a preferred-qualifications section says nothing good about
 * the candidate, and crediting it was worth a free 15 points on most postings.
 */
function coverageOf(requirements) {
  let earned = 0;
  let weight = 0;
  let counted = 0;
  let strong = 0;
  let partial = 0;

  for (const r of Array.isArray(requirements) ? requirements : []) {
    const w = typeWeight(r?.type);
    if (w <= 0) continue;
    weight += w;
    earned += w * (COVERAGE_CREDIT[r?.coverage] ?? 0);
    counted += 1;
    if (r?.coverage === 'strong') strong += 1;
    else if (r?.coverage === 'partial') partial += 1;
  }

  if (weight === 0) return { ratio: null, counted: 0, strong: 0, partial: 0 };
  return { ratio: clamp01(earned / weight), counted, strong, partial };
}

/**
 * Weighted average over the dimensions we could actually measure.
 * Dimensions with a null value are dropped and their weight is redistributed
 * proportionally across the rest, so a missing dimension neither rewards nor
 * punishes — it just stops being part of the question.
 */
function weightedAverage(parts) {
  const live = parts.filter((p) => typeof p.value === 'number');
  const total = live.reduce((sum, p) => sum + p.weight, 0);
  if (total === 0) return 0;
  return live.reduce((sum, p) => sum + p.weight * p.value, 0) / total;
}

// --- seniority, derived rather than asked for --------------------------------

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Years of experience from the profile's own dates.
 *
 * Overlapping roles are merged rather than summed. The naive sum counts a
 * contract held alongside a staff job twice, and two years of double-counting
 * is enough to move someone a whole seniority band.
 *
 * Returns null when no role carries a parseable start date — we would rather
 * fall back to the model's read than score against a fabricated number.
 */
function candidateYears(experience) {
  if (!Array.isArray(experience) || experience.length === 0) return null;

  const now = Date.now();
  const spans = [];
  for (const role of experience) {
    const start = Date.parse(role?.startDate || '');
    if (!Number.isFinite(start)) continue;
    const rawEnd = role?.current ? now : Date.parse(role?.endDate || '');
    const end = Number.isFinite(rawEnd) ? Math.min(rawEnd, now) : now;
    if (end > start) spans.push([start, end]);
  }
  if (spans.length === 0) return null;

  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = spans[0][0];
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor);
    if (end > from) {
      covered += end - from;
      cursor = end;
    }
  }
  return covered / MS_PER_YEAR;
}

/**
 * The years minimum the posting states, if it states one.
 *
 * Reads the requirement text rather than trusting a separate field, because
 * "5+ years" is how postings actually express it. The highest stated minimum
 * wins: a JD asking for "8+ years engineering, 2+ years with Kubernetes" is
 * screening on the 8.
 */
function requiredYears(requirements) {
  let max = null;
  for (const r of Array.isArray(requirements) ? requirements : []) {
    const text = String(r?.requirement || '');
    // "5+ years", "5-8 years", "at least 5 years", "minimum of 5 years"
    const matches = text.matchAll(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*years?/gi);
    for (const m of matches) {
      const low = Number(m[1]);
      if (!Number.isFinite(low) || low <= 0 || low > 40) continue;
      if (max === null || low > max) max = low;
    }
  }
  return max;
}

/**
 * Seniority fit from the numbers, when the numbers exist.
 *
 * Over-qualification counts against the match. It is not a courtesy: a staff
 * engineer applying to a mid-level posting is routinely screened out, and a
 * score that calls it a perfect fit is lying to the user about what will
 * happen to the application.
 */
function seniorityFitFrom(years, required) {
  if (years === null || required === null) return null;
  const ratio = years / required;
  if (ratio >= 3) return 0.4;    // two-plus levels over
  if (ratio >= 2) return 0.7;    // a level over
  if (ratio >= 1) return 1;
  if (ratio >= 0.8) return 0.8;  // just under the stated bar, usually fine
  if (ratio >= 0.6) return 0.5;
  if (ratio >= 0.4) return 0.25;
  return 0.1;
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
 * @param {number} read.seniorityFit - 0..1, fallback only; used when the posting
 *                 states no years minimum or the profile carries no dates
 * @param {number} read.recency - 0..1, how current the matched skills are
 * @param {Object} [profile] - the candidate profile, for date-derived seniority
 */
function scoreJobMatch(read, profile = null) {
  const requirements = Array.isArray(read?.requirements) ? read.requirements : [];
  const must = requirements.filter((r) => r?.hardness === 'must');
  const nice = requirements.filter((r) => r?.hardness !== 'must');

  const mustCoverage = coverageOf(must);
  const niceCoverage = coverageOf(nice);
  const roleFit = clamp01(read?.roleFit);
  const recency = clamp01(read?.recency);

  const years = candidateYears(profile?.experience);
  const stated = requiredYears(requirements);
  const derivedSeniority = seniorityFitFrom(years, stated);
  const seniorityFit = derivedSeniority === null ? clamp01(read?.seniorityFit) : derivedSeniority;

  const coverage = weightedAverage([
    { weight: WEIGHTS.must, value: mustCoverage.ratio },
    { weight: WEIGHTS.nice, value: niceCoverage.ratio },
  ]);

  const modifiers =
    roleFit * modulate(SENIORITY_FLOOR, seniorityFit) * modulate(RECENCY_FLOOR, recency);

  const raw = Math.round(100 * coverage * modifiers);

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
  // rewrites a resume, it does not change what job family someone comes from,
  // and it cannot add years to a career.
  const projectedRequirements = requirements.map((r) =>
    isSurfaceable(r) ? { ...r, coverage: 'strong' } : r,
  );
  const projectedMust = coverageOf(projectedRequirements.filter((r) => r?.hardness === 'must'));
  const projectedNice = coverageOf(projectedRequirements.filter((r) => r?.hardness !== 'must'));
  const projectedCoverage = weightedAverage([
    { weight: WEIGHTS.must, value: projectedMust.ratio },
    { weight: WEIGHTS.nice, value: projectedNice.ratio },
  ]);
  const projectedBlockers = projectedRequirements.filter(
    (r) => r?.hardness === 'must' && r?.coverage === 'none' && SCREENABLE_TYPES.has(r?.type),
  );
  // Capped at 95: a rewrite closing every surfaceable gap still leaves the
  // parts of a screen a resume can't control. Promising 100% is a tell.
  const projectedRaw = Math.min(95, Math.round(100 * projectedCoverage * modifiers));
  const projectedScore = Math.max(
    score,
    projectedBlockers.length > 0 ? Math.min(projectedRaw, BLOCKED_SCORE_CAP) : projectedRaw,
  );

  const scored = requirements.filter(isScored);

  return {
    score,
    projectedScore,
    blockers,
    components: {
      roleFit: Number(roleFit.toFixed(2)),
      /** The share of the posting's weighted requirements the candidate can
       *  evidence. This is what the score is; everything else modulates it. */
      coverage: Number(coverage.toFixed(2)),
      // null here means "not part of this score" and the UI must not render it
      // as a zero.
      mustCoverage: mustCoverage.ratio === null ? null : Number(mustCoverage.ratio.toFixed(2)),
      niceCoverage: niceCoverage.ratio === null ? null : Number(niceCoverage.ratio.toFixed(2)),
      seniorityFit: Number(seniorityFit.toFixed(2)),
      recency: Number(recency.toFixed(2)),
      mustCount: mustCoverage.counted,
      niceCount: niceCoverage.counted,
      // Strong and partial are different claims — the panel shows them apart so
      // the headline count can't imply full evidence for half-credit matches.
      strongCount: mustCoverage.strong + niceCoverage.strong,
      partialCount: mustCoverage.partial + niceCoverage.partial,
      scoredCount: scored.length,
      /** Requirements read from the posting but excluded from the arithmetic
       *  (responsibilities), so the count beside the score adds up. */
      unscoredCount: requirements.length - scored.length,
      seniorityBasis: derivedSeniority === null ? 'model' : 'dates',
      candidateYears: years === null ? null : Number(years.toFixed(1)),
      requiredYears: stated,
      cappedByBlockers: blockers.length > 0 && raw > BLOCKED_SCORE_CAP,
    },
    surfaceable: requirements.filter(isSurfaceable).map((r) => r.requirement),
  };
}

module.exports = {
  scoreJobMatch,
  WEIGHTS,
  COVERAGE_CREDIT,
  TYPE_WEIGHT,
  SENIORITY_FLOOR,
  RECENCY_FLOOR,
  BLOCKED_SCORE_CAP,
  SCREENABLE_TYPES,
  // exported for tests
  candidateYears,
  requiredYears,
  seniorityFitFrom,
  coverageOf,
};
