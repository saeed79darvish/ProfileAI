/**
 * Location matching for the /external-jobs location filter.
 *
 * WHY THIS EXISTS
 * ---------------
 * Jobs store free-text locations exactly as the source board spells them:
 * "San Mateo, CA United States", "Foster City, CA", "San Jose, California",
 * "Remote - United States", "San Francisco, CA; New York, NY", etc.
 *
 * A naive `location ILIKE '%San Francisco%'` only catches the literal
 * "San Francisco" rows and silently drops every other Bay-Area posting — so a
 * candidate filtering by "San Francisco" saw ~6 of the ~51 frontend roles that
 * are actually in/around SF (the San Mateo / Foster City / San Jose / Bay Area
 * ones were excluded). This expands a recognized major hub to the substrings
 * that cover its real commute metro, so the filter behaves the way a candidate
 * expects ("show me SF-area jobs", not "rows whose text literally says SF").
 *
 * Unknown locations fall through to a single substring match (old behavior).
 */

// Each entry maps a set of trigger spellings (what the user might type / what
// the profile seeds) to the substrings that should all be OR-matched against
// the job's location text. Keep substrings lowercase; matching is case-folded.
//
// `canonical` is the single human label the location filter dropdown collapses
// every member spelling into (e.g. "San Mateo, CA" and "San Jose, California"
// both display under "San Francisco Bay Area"). Each canonical label MUST itself
// contain one of its own `triggers` so that selecting it round-trips back
// through expandLocationAliases to the full metro.
const METRO_ALIASES = [
  {
    canonical: 'San Francisco Bay Area',
    triggers: ['san francisco', 'sf bay', 'bay area', 'silicon valley'],
    match: [
      'san francisco', 'sf bay', 'bay area', 'silicon valley',
      'south san francisco', 'san mateo', 'foster city', 'redwood city',
      'menlo park', 'palo alto', 'mountain view', 'sunnyvale', 'santa clara',
      'san jose', 'cupertino', 'milpitas', 'oakland', 'emeryville',
      'berkeley', 'alameda', 'burlingame', 'belmont',
    ],
  },
  {
    canonical: 'New York City',
    triggers: ['new york', 'nyc', 'new york city'],
    match: ['new york', 'nyc', 'manhattan', 'brooklyn'],
  },
  {
    canonical: 'Los Angeles',
    triggers: ['los angeles', 'la, ca', 'greater los angeles'],
    match: [
      'los angeles', 'santa monica', 'culver city', 'pasadena', 'el segundo',
      'burbank', 'venice, ca',
    ],
  },
  {
    canonical: 'Seattle',
    triggers: ['seattle'],
    match: ['seattle', 'bellevue', 'redmond', 'kirkland'],
  },
  {
    canonical: 'Boston',
    triggers: ['boston'],
    match: ['boston', 'cambridge, ma', 'somerville', 'waltham'],
  },
  {
    canonical: 'Austin',
    triggers: ['austin'],
    match: ['austin'],
  },
  {
    canonical: 'Washington, D.C.',
    triggers: ['washington', 'washington dc', 'dc metro', 'd.c.'],
    match: ['washington', 'arlington, va', 'alexandria, va', 'bethesda'],
  },
  {
    canonical: 'Chicago',
    triggers: ['chicago'],
    match: ['chicago', 'evanston'],
  },
  {
    canonical: 'San Diego',
    triggers: ['san diego'],
    match: ['san diego'],
  },
  {
    canonical: 'Denver',
    triggers: ['denver'],
    match: ['denver', 'boulder, co'],
  },
  {
    canonical: 'Atlanta',
    triggers: ['atlanta'],
    match: ['atlanta'],
  },
  {
    canonical: 'Dallas',
    triggers: ['dallas'],
    match: ['dallas', 'fort worth', 'plano, tx', 'irving, tx'],
  },
  {
    canonical: 'Toronto',
    triggers: ['toronto'],
    match: ['toronto', 'mississauga', 'ontario, canada'],
  },
  {
    canonical: 'London',
    triggers: ['london'],
    match: ['london'],
  },
];

// Free-text markers that mean "not tied to a physical office". Collapsed into a
// single "Remote" bucket in the dropdown.
const REMOTE_TRIGGERS = ['remote', 'anywhere', 'work from home', 'distributed', 'wfh'];

/**
 * Expand a free-text location into the list of lowercase substrings that should
 * be OR-matched. For a recognized metro this returns the whole commute area;
 * for anything else it returns just the normalized input (single-substring,
 * i.e. unchanged behavior).
 *
 * @param {string} location raw user/profile location
 * @returns {string[]} non-empty list of lowercase substrings to OR-match
 */
function expandLocationAliases(location) {
  const raw = String(location || '').trim().toLowerCase();
  if (!raw) return [];
  for (const entry of METRO_ALIASES) {
    if (entry.triggers.some(t => raw.includes(t))) {
      return entry.match;
    }
  }
  return [raw];
}

/**
 * Collapse a raw, free-text job location into a single canonical label for the
 * location-filter dropdown. Many boards spell the same place a dozen ways
 * ("San Francisco", "San Francisco, CA", "San Mateo, CA United States", ...);
 * this folds them all into one option ("San Francisco Bay Area") so the dropdown
 * shows a handful of meaningful metros instead of hundreds of near-duplicates.
 *
 * Resolution order:
 *   1. Recognized metro (matches any METRO_ALIASES.match substring) → canonical.
 *   2. Remote marker with no recognized metro → "Remote".
 *   3. Anything else → the original string, trimmed (unchanged behavior).
 *
 * @param {string} location raw job location text
 * @returns {string|null} canonical label, or null for empty input
 */
function canonicalizeLocation(location) {
  const trimmed = String(location || '').trim();
  if (!trimmed) return null;
  const raw = trimmed.toLowerCase();

  for (const entry of METRO_ALIASES) {
    if (entry.match.some(m => raw.includes(m))) {
      return entry.canonical;
    }
  }

  if (REMOTE_TRIGGERS.some(t => raw.includes(t))) {
    return 'Remote';
  }

  return trimmed;
}

module.exports = { expandLocationAliases, canonicalizeLocation };
