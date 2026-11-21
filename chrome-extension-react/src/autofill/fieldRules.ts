/**
 * Pure rules for Quick Fill's identity fields: which input is a city, a state or
 * a zip code, and what to put there from a one-line profile location.
 *
 * Plain TypeScript with no chrome or DOM APIs, so the content script can inline
 * it and the tests can run it as it is.
 */

/**
 * Words that contain a field word without meaning it. "ethnicity" holds "city",
 * "relocation" holds "location", "excellence" holds "cell", and the plain
 * substring patterns filled a person's city or location into those fields.
 * They are blanked out of an identifier before any pattern is tried.
 */
const FALSE_FRIENDS = /ethnicit(?:y|ies)|relocat\w*|excell\w*|\bintel(?!l)\w*|capacity|velocity|authenticity|electricity|publicity|simplicity|specificity|stationary|estate\b|statement|statistic\w*|united states|unit(?:ed)?\s*state/gi;

/** An identifier (name, id, label, placeholder ...) with the false friends removed. */
export function scrubIdentifier(text: string): string {
  return String(text || '').replace(FALSE_FRIENDS, ' ');
}

export type FieldType = 'city' | 'state' | 'zip';

/**
 * Patterns per field type, tested against each scrubbed identifier on its own.
 * Anchors matter here: a bare /state/ matches "statement" and "United States".
 */
export const FIELD_PATTERNS: Record<FieldType, string[]> = {
  city: [
    '(^|[^a-z]|current|home|your|my|mailing|billing|work|legal|address|candidate|residen\\w*)city([^a-z]|$)',
    '^town\\b', 'address.?level2', '\\blocality\\b',
  ],
  state: [
    '^state\\W*$', '^state[\\s/_-]', 'state.?(or|/)?.?province', 'province.?(or|/)?.?state',
    'address.?level1', '^province\\W*$', '^state_?code$',
  ],
  zip: [
    'zip.?code', 'postal.?code', 'post.?code', 'zipcode', 'postalcode',
    '(^|[^a-z])zip([^a-z]|$)', 'address.?level.?postal', 'postal',
  ],
};

const COMPILED = Object.fromEntries(
  (Object.keys(FIELD_PATTERNS) as FieldType[]).map((k) => [k, FIELD_PATTERNS[k].map((p) => new RegExp(p, 'i'))]),
) as Record<FieldType, RegExp[]>;

/** True when any identifier names this kind of field. */
export function isFieldType(type: FieldType, identifiers: string[]): boolean {
  const scrubbed = identifiers.map(scrubIdentifier);
  return scrubbed.some((id) => COMPILED[type].some((re) => re.test(id)));
}

/** Pattern strings as a content-script mapping wants them, already scrub-safe. */
export const patternsFor = (type: FieldType): string[] => FIELD_PATTERNS[type];

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming', DC: 'District of Columbia',
};
const STATE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

export interface ParsedLocation {
  /** "San Francisco" from "San Francisco, CA", or '' when the text has no clear city. */
  city: string;
  /** The state as written ("California" or "CA"), preferring the full name. */
  state: string;
  /** Two-letter US code, when the state is a US one. */
  stateCode: string;
  /** "United States" for a US place, else the last part of the text when it reads as a country. */
  country: string;
  /** A zip or postal code that the text itself contains. */
  zip: string;
}

const ZIP_RE = /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/;
const COUNTRY_WORDS = /^(united states|usa|u\.s\.a?\.?|us|united kingdom|uk|canada|india|germany|france|spain|italy|netherlands|ireland|australia|romania|poland|portugal|brazil|mexico|singapore|israel|sweden|norway|denmark|finland|switzerland|japan)$/i;

/**
 * Reads what a one-line location says. Only what is plainly there is returned:
 * "San Francisco, CA" gives a city and a state, never a zip, because a zip is
 * not in the text and guessing one is how a wrong address gets submitted.
 */
export function parseLocation(location: string | null | undefined): ParsedLocation {
  const empty: ParsedLocation = { city: '', state: '', stateCode: '', country: '', zip: '' };
  let text = String(location || '').trim();
  // "Remote" is a work arrangement, not a place to put in a city box.
  if (!text || /^(remote|anywhere|worldwide|flexible|global|hybrid|n\/a|none)$/i.test(text)) return empty;

  const zip = (text.match(ZIP_RE) || [''])[0];
  if (zip) text = text.replace(zip, ' ');
  const parts = text.split(',').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!parts.length) return { ...empty, zip };

  let city = '';
  let state = '';
  let stateCode = '';
  let country = '';

  // Walk from the end: country, then state, what is left first is the city.
  const rest = [...parts];
  const last = rest[rest.length - 1];
  if (rest.length > 1 && COUNTRY_WORDS.test(last)) {
    country = /^(usa|u\.s\.a?\.?|us)$/i.test(last) ? 'United States' : last;
    rest.pop();
  }
  const tail = rest[rest.length - 1];
  if (rest.length > 1 && tail) {
    // "CA", "CA 94107" (zip already removed), "California".
    const code = tail.replace(/\./g, '').toUpperCase();
    if (US_STATES[code]) {
      state = US_STATES[code]; stateCode = code; rest.pop();
    } else if (STATE_BY_NAME[tail.toLowerCase()]) {
      stateCode = STATE_BY_NAME[tail.toLowerCase()]; state = US_STATES[stateCode]; rest.pop();
    }
  }
  if (stateCode && !country) country = 'United States';
  // A lone "San Francisco", or "Bangalore, Karnataka": the first part is the city.
  city = rest[0] || '';
  if (rest.length === 1 && COUNTRY_WORDS.test(rest[0])) {
    country = rest[0]; city = '';
  }
  return { city, state, stateCode, country, zip };
}

/**
 * Questions whose answer is a fact about the person that only they can state: work
 * authorization, sponsorship, relocation, the office, start date, notice, pay, and how
 * they heard about the job. The rule code below used to answer these with defaults
 * ("authorized: Yes", "sponsorship: No", "relocate: Yes", "2 weeks", "Online"), which
 * put legal claims on an application whatever the person had said, and ahead of what
 * they had saved. Rules now leave them alone; the saved answer fills them, or they stay
 * empty for the person.
 */
const FACT_SHAPED = /authori[sz]ed|work authori[sz]ation|eligible to work|right to work|legally|sponsor|\bvisa\b|immigration|relocat|commut|on-?site|in[- ]office|days a week|\bhybrid\b|\bremote\b|work from home|start date|earliest start|available to start|when can you start|notice period|salary|compensation|pay (range|expectation)|how did you (hear|find|learn)|where did you (hear|find|learn)|referral source/i;
export const isFactShapedQuestion = (q: string): boolean => FACT_SHAPED.test(q);

