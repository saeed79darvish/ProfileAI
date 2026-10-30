/**
 * How well a posting's place suits where a candidate lives, as a tier.
 *
 *   1  their metro ("San Mateo" for someone in San Francisco)
 *   2  remote, and open to their country
 *   3  elsewhere in their country
 *   0  somewhere they cannot work from
 *
 * Written for the coach's job card, which put "Software Engineer (Radar R&D)
 * in El Segundo" at the top for someone in San Francisco, then a posting
 * flagged remote whose location was "Budapest, Hungary". Remote is not one
 * place: "Remote - United States" and "Remote, Canada" are different jobs to
 * someone in California, and the location text is the only thing that says
 * which.
 *
 * Country detection is deliberately small: the United States (by state, code
 * or name), plus the country named last in a non-US location ("Berlin,
 * Germany"). A posting we cannot place is treated as not in their country,
 * which drops it rather than risk showing another country's job.
 */

const { expandLocationAliases } = require('./locationMatch');

const US_STATES = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado',
  ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho',
  il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
  me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina',
  nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee', tx: 'texas',
  ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington', wv: 'west virginia',
  wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
};
const US_STATE_CODES = new Set(Object.keys(US_STATES));
const US_STATE_NAMES = Object.values(US_STATES);
const US_NAMES = ['united states', 'usa', 'u.s.', 'america'];
// Regions a US candidate can work from when a remote posting names them.
const US_REGIONS = ['north america', 'americas', 'us', 'usa', 'u.s.', 'united states'];
const ANYWHERE = ['worldwide', 'anywhere', 'global'];

const REMOTE_RE = /\bremote\b|\banywhere\b|\bworldwide\b|\bwork from home\b|\bwfh\b/i;

const lower = (s) => String(s || '').toLowerCase();

/** "San Francisco, CA" and "Austin, Texas, United States" are in the US. */
function isUSPlace(text) {
  const t = lower(text);
  if (!t.trim()) return false;
  if (US_NAMES.some((n) => t.includes(n))) return true;
  if (/(^|[\s,(/-])us([\s,)/-]|$)/.test(t)) return true;
  if (US_STATE_NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(t))) return true;
  // A state code only counts after a comma ("Austin, TX"), so "IN" in a
  // sentence or "OR" between two places is not read as a state.
  const codes = t.match(/,\s*([a-z]{2})\b/g) || [];
  return codes.some((c) => US_STATE_CODES.has(c.replace(/[^a-z]/g, '')));
}

/** Their country: 'us', or the last part of a non-US place ("germany"). */
function candidateCountry(location) {
  if (!String(location || '').trim()) return null;
  if (isUSPlace(location)) return 'us';
  const parts = lower(location).split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/** True when a posting's text puts it in (or opens it to) that country. */
function inCountry(text, country) {
  const t = lower(text);
  if (!country) return false;
  if (country === 'us') {
    // Remote and nowhere else named: a US board's default.
    const named = t.replace(REMOTE_RE, ' ').replace(/[^a-z]/g, '');
    if (!named) return true;
    return isUSPlace(t) || US_REGIONS.some((r) => new RegExp(`(^|[^a-z])${r.replace('.', '\\.')}([^a-z]|$)`).test(t));
  }
  return t.includes(country);
}

const isRemote = (job) => job.locationType === 'remote' || REMOTE_RE.test(job.location || '');

/**
 * @param {string} candidateLocation where they live, as typed
 * @param {{ location?: string, locationType?: string }} job
 * @returns {0|1|2|3}
 */
function locationTier(candidateLocation, job) {
  const where = lower(job.location);
  const metro = expandLocationAliases(candidateLocation);
  const country = candidateCountry(candidateLocation);

  // No place given: remote first, everything else after.
  if (!metro.length) return isRemote(job) ? 2 : 3;

  if (metro.some((m) => where.includes(m))) return 1;
  if (isRemote(job)) {
    if (ANYWHERE.some((a) => where.includes(a))) return 2;
    return inCountry(where, country) ? 2 : 0;
  }
  return inCountry(where, country) ? 3 : 0;
}

/** The substrings that put a posting in their metro, for SQL. */
const metroTerms = (candidateLocation) => expandLocationAliases(candidateLocation);

module.exports = { locationTier, metroTerms, candidateCountry, isUSPlace };
