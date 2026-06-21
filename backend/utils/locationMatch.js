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
const METRO_ALIASES = [
  {
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
    triggers: ['new york', 'nyc', 'new york city'],
    match: ['new york', 'nyc', 'manhattan', 'brooklyn'],
  },
  {
    triggers: ['los angeles', 'la, ca', 'greater los angeles'],
    match: [
      'los angeles', 'santa monica', 'culver city', 'pasadena', 'el segundo',
      'burbank', 'venice, ca',
    ],
  },
  {
    triggers: ['seattle'],
    match: ['seattle', 'bellevue', 'redmond', 'kirkland'],
  },
  {
    triggers: ['boston'],
    match: ['boston', 'cambridge, ma', 'somerville', 'waltham'],
  },
  {
    triggers: ['austin'],
    match: ['austin'],
  },
  {
    triggers: ['washington', 'washington dc', 'dc metro', 'd.c.'],
    match: ['washington', 'arlington, va', 'alexandria, va', 'bethesda'],
  },
  {
    triggers: ['chicago'],
    match: ['chicago', 'evanston'],
  },
];

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

module.exports = { expandLocationAliases };
