/**
 * Workday job boards. Many large employers publish their jobs through Workday, and the career page of each
 * one loads them from a public JSON address (no key, no login):
 *
 *   list:   POST https://<tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
 *   detail: GET  https://<tenant>.<wdN>.myworkdayjobs.com/wday/cxs/<tenant>/<site><externalPath>
 *
 * A board is named by one token, "tenant|wdN|site" (for example "nvidia|wd5|NVIDIAExternalCareerSite").
 *
 * This is the address the employer's own career page uses, not a documented API, so it can change without
 * notice. The reader therefore fails loudly (throws) on anything unexpected instead of returning an empty list:
 * an empty "successful" read would make the sync retire every job on the board.
 *
 * Cost control: the list is cheap (20 jobs a request) but each job's full text is one request. So the full text
 * is fetched only for US jobs we have not stored yet, a few hundred per sync; jobs we already hold reuse what we
 * stored. A busy board therefore fills in over a few syncs.
 *
 * The helpers that live in externalJobService (HTML to text, job type guesses) are passed in, so this file has
 * no import of that big module and tests need no database.
 */

const PAGE = 20;
const MAX_LIST = 2000; // Workday stops a list at 2,000 results
const TOKEN_RE = /^([a-z0-9][a-z0-9-]{0,60})\|(wd\d{1,3})\|([A-Za-z0-9._-]{1,120})$/i;

/** {tenant, wd, site} from "tenant|wdN|site", or null. */
function parseToken(token) {
  const m = TOKEN_RE.exec(String(token || '').trim());
  return m ? { tenant: m[1].toLowerCase(), wd: m[2].toLowerCase(), site: m[3] } : null;
}

const hostOf = (b) => `${b.tenant}.${b.wd}.myworkdayjobs.com`;
const listUrl = (b) => `https://${hostOf(b)}/wday/cxs/${b.tenant}/${encodeURIComponent(b.site)}/jobs`;
const detailUrl = (b, externalPath) => `https://${hostOf(b)}/wday/cxs/${b.tenant}/${encodeURIComponent(b.site)}${externalPath}`;
const publicUrl = (b, externalPath) => `https://${hostOf(b)}/${encodeURIComponent(b.site)}${externalPath}`;

const US_STATE = /(?:^|[\s,/-])(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:$|[\s,/-])/;
const STATE_NAMES = 'alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia';
const US_WORDS = new RegExp(`\\b(united states|usa|u\\.s\\.|us remote|remote[ ,-]+us)\\b|^us\\b|\\(us\\)|,\\s*(${STATE_NAMES})\\b`, 'i');
const COUNTRIES = 'india|germany|united kingdom|uk|canada|france|ireland|poland|spain|italy|netherlands|japan|china|singapore|australia|mexico|brazil|israel|romania|czech republic|czechia|sweden|switzerland|belgium|austria|denmark|norway|finland|portugal|hungary|bulgaria|greece|turkey|south korea|korea|taiwan|hong kong|malaysia|philippines|thailand|vietnam|indonesia|argentina|chile|colombia|costa rica|peru|south africa|nigeria|egypt|saudi arabia|united arab emirates|uae|new zealand|ukraine|serbia|croatia|lithuania|latvia|estonia|slovakia|slovenia|luxembourg|pakistan|bangladesh|sri lanka';
const OTHER_PLACE = new RegExp(`\\b(${COUNTRIES})\\b|,\\s*(ON|BC|AB|QC|MB|NS|NB|SK|NL|PE)\\b`, 'i');
const MULTI = /^\d+\s+locations?$/i;

/**
 * What a list row's place text says about the US: 'us', 'other', or 'unknown' (for example "4 Locations",
 * which only the job's detail can settle).
 */
function usOf(locationsText) {
  const t = String(locationsText || '').trim();
  if (!t) return 'unknown';
  if (MULTI.test(t)) return 'unknown';
  if (US_WORDS.test(t) || /^US\b/.test(t) || US_STATE.test(t)) return 'us';
  // A bare city ("Austin", "Dublin") says nothing either way; only a named other country or province is a clear no.
  return OTHER_PLACE.test(t) ? 'other' : 'unknown';
}

/**
 * The first place in a job's own address: "/job/India---Bangalore/Title_JR1" gives "India - Bangalore". Workday puts
 * the main location there even when the list row only says "2 Locations".
 */
function placeFromPath(externalPath) {
  const seg = String(externalPath || '').split('/')[2];
  return seg ? seg.split('---').map((part) => part.replace(/-/g, ' ').trim()).join(' - ') : '';
}

const NON_US_PLACE = new RegExp(`^(${COUNTRIES})\\b`, 'i');

/** What the first place in a job's address says: 'us', 'other' (clearly another country), or 'unknown'. */
function usFromPath(externalPath) {
  const place = placeFromPath(externalPath);
  if (!place) return 'unknown';
  if (/^(us|usa|united states)\b/i.test(place) || /^remote\b.*\b(us|usa)\b/i.test(place)) return 'us';
  if (NON_US_PLACE.test(place)) return 'other';
  return 'unknown';
}

/** The posting date from Workday's wording ("Posted Today", "Posted 3 Days Ago", "Posted 30+ Days Ago"), or null. */
function postedAtFromText(text, now = new Date()) {
  const t = String(text || '').toLowerCase();
  const day = (n) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
  if (/today/.test(t)) return day(0);
  if (/yesterday/.test(t)) return day(1);
  const m = /(\d+)\+?\s*days?/.exec(t);
  return m ? day(Number(m[1])) : null;
}

/** The job's own id: Workday's requisition id, else the end of its path. */
function idOf(posting) {
  const bullet = Array.isArray(posting.bulletFields) ? posting.bulletFields.find((b) => /^[A-Za-z]{0,4}[-_]?\d{3,}/.test(String(b))) : null;
  if (bullet) return String(bullet);
  const last = String(posting.externalPath || '').split('/').pop() || '';
  const m = /_([A-Za-z0-9-]+)$/.exec(last);
  return m ? m[1] : last || null;
}

function createWorkday(helpers) {
  // Jobs a detail showed to be outside the US, remembered while this process runs so they are not asked about every sync.
  const notUs = new Map();
  const { stripHtml, inferLocationType, normalizeEmploymentType, inferExperienceLevel, sanitizeExternalUrl } = helpers;

  /** One job record in our schema, from a list row plus (when we have it) the job's detail. */
  function normalize(board, token, posting, detail, stored, now = new Date()) {
    const info = (detail && detail.jobPostingInfo) || {};
    const locationText = [info.location || posting.locationsText, ...(Array.isArray(info.additionalLocations) ? info.additionalLocations : [])].filter(Boolean);
    const location = [...new Set(locationText)].join(' | ') || null;
    const descHtml = info.jobDescription || (stored && stored.descriptionHtml) || '';
    const description = info.jobDescription ? stripHtml(info.jobDescription) : ((stored && stored.description) || '');
    const url = sanitizeExternalUrl(info.externalUrl || publicUrl(board, posting.externalPath));
    const remote = String(info.remoteType || '').toLowerCase();
    return {
      externalId: idOf(posting),
      source: 'workday',
      boardToken: token,
      title: posting.title || info.title || 'Untitled',
      company: board.tenant, // replaced with the board's name by the sync
      location,
      locationType: remote.includes('remote') ? 'remote' : remote.includes('hybrid') ? 'hybrid' : inferLocationType(location, posting.title),
      employmentType: normalizeEmploymentType(info.timeType) || (stored && stored.employmentType) || null,
      experienceLevel: inferExperienceLevel(posting.title) || null,
      department: (stored && stored.department) || null,
      description,
      descriptionHtml: descHtml,
      requirements: (stored && stored.requirements) || null,
      skills: [],
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: 'USD',
      salaryPeriod: null,
      applyUrl: url,
      sourceUrl: url,
      postedAt: (info.startDate ? new Date(info.startDate) : null) || (stored && stored.postedAt) || postedAtFromText(posting.postedOn, now),
      isActive: true,
      lastFetchedAt: now,
      metadata: {},
    };
  }

  /**
   * Reads one board. existing: Map of externalId to the row we already store (description fields at least).
   * Returns normalized jobs; US only. Throws on anything unexpected.
   */
  async function fetchWorkdayJobs(token, { existing = new Map(), fetchImpl = fetch, maxNewDetails = 400, detailConcurrency = 6, listConcurrency = 3, retries = 3, retryMs = 1500, pauseMs = 80, now = new Date(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    const board = parseToken(token);
    if (!board) throw new Error(`Workday board token must look like tenant|wd5|Site, got "${token}"`);

    const call = async (url, init) => {
      let res;
      // A busy Workday answers 5xx for a moment; ask again a couple of times before giving up.
      for (let attempt = 0; ; attempt += 1) {
        try {
          res = await fetchImpl(url, { signal: AbortSignal.timeout(30000), ...init, headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; ProfilleAI job sync)', ...((init && init.headers) || {}) } });
        } catch (e) { if (attempt >= retries) throw e; await sleep(retryMs * (attempt + 1)); continue; }
        if (res.status >= 500 && attempt < retries) { await sleep(retryMs * (attempt + 1)); continue; }
        break;
      }
      if (!res.ok) { const err = new Error(`Workday ${board.tenant}: HTTP ${res.status}`); err.status = res.status; if (res.status === 429) err.isRateLimit = true; if (res.status === 404 || res.status === 422) err.isGone = true; throw err; }
      return res.json();
    };

    // 1. The list, newest first. The first page says how many there are; the rest are read a few at a time.
    const readPage = async (offset) => {
      const page = await call(listUrl(board), { method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: PAGE, offset, searchText: '' }) });
      if (!page || !Array.isArray(page.jobPostings)) throw new Error(`Workday ${board.tenant}: the list did not look like a job list`);
      return page;
    };
    const first = await readPage(0);
    const total = Number(first.total) || first.jobPostings.length;
    const pages = new Map([[0, first.jobPostings]]);
    const offsets = [];
    for (let o = PAGE; o < Math.min(total, MAX_LIST); o += PAGE) offsets.push(o);
    let nextOffset = 0;
    const pageWorker = async () => {
      while (nextOffset < offsets.length) {
        const o = offsets[nextOffset++];
        pages.set(o, (await readPage(o)).jobPostings);
        await sleep(pauseMs);
      }
    };
    await Promise.all(Array.from({ length: Math.min(listConcurrency, offsets.length) }, pageWorker));
    const postings = [];
    for (const o of [...pages.keys()].sort((x, y) => x - y)) for (const p of pages.get(o)) if (p && p.externalPath) postings.push(p);
    if (!postings.length) throw new Error(`Workday ${board.tenant}: no jobs came back, refusing to treat the board as empty`);

    // 2. Keep US jobs; settle the unclear ones ("4 Locations") from the detail below.
    const seen = new Set();
    const candidates = [];
    for (const p of postings) {
      const id = idOf(p);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      let where = usOf(p.locationsText);
      // "4 Locations": the job's address names its main place; a job whose main place is outside the US is dropped without a request.
      if (where === 'unknown') where = usFromPath(p.externalPath);
      if (where === 'other') continue;
      if (notUs.get(token) && notUs.get(token).has(id)) continue;
      candidates.push({ posting: p, id, where });
    }

    // 3. Jobs we hold reuse their stored text; new ones get their detail, up to the cap.
    const out = [];
    const fresh = [];
    for (const c of candidates) {
      const stored = existing.get(c.id);
      if (stored) out.push(normalize(board, token, c.posting, null, stored, now));
      else fresh.push(c);
    }
    const toFetch = fresh.slice(0, maxNewDetails);
    let next = 0;
    const worker = async () => {
      while (next < toFetch.length) {
        const c = toFetch[next++];
        let detail = null;
        try { detail = await call(detailUrl(board, c.posting.externalPath), { method: 'GET' }); } catch (e) { if (e.isRateLimit) throw e; detail = null; }
        const info = detail && detail.jobPostingInfo;
        // A job whose place was unclear is kept only when its detail says it is in the US.
        if (c.where === 'unknown') {
          const country = String((info && info.country && info.country.descriptor) || '').toLowerCase();
          const places = [info && info.location, ...((info && info.additionalLocations) || [])].join(' ');
          const isUs = /united states|usa/.test(country) || usOf(places) === 'us' || US_STATE.test(places);
          if (!isUs) { if (!notUs.has(token)) notUs.set(token, new Set()); notUs.get(token).add(c.id); continue; }
        }
        if (!info) continue; // no text yet; it will be picked up on a later sync
        out.push(normalize(board, token, c.posting, detail, null, now));
        await sleep(pauseMs);
      }
    };
    await Promise.all(Array.from({ length: detailConcurrency }, worker));

    return { jobs: out, total, listed: postings.length, usCandidates: candidates.length, newDetails: toFetch.length, deferred: Math.max(0, fresh.length - toFetch.length) };
  }

  return { fetchWorkdayJobs, normalize };
}

module.exports = { createWorkday, parseToken, usOf, placeFromPath, usFromPath, postedAtFromText, idOf, listUrl, detailUrl, publicUrl, PAGE, MAX_LIST };
