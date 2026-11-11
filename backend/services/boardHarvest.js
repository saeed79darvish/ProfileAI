/**
 * Pure helpers for finding job boards at scale. Nothing here touches the network or the database.
 *
 * The idea: employers link to their public job board from their own sites and from the web, and the
 * Internet Archive keeps an index of those URLs. Every URL like jobs.ashbyhq.com/<company> names a board.
 * We collect those names, ask each system's public feed whether the board really has jobs, and keep the
 * boards that do. The feeds are the ones the systems publish for exactly this use.
 */

/** Systems whose public feed we can read today, with how to spot a board in a URL. */
const PLATFORMS = {
  greenhouse: {
    hosts: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
    feed: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
    fromUrl(url) {
      const m = /^https?:\/\/(?:job-)?boards\.greenhouse\.io\/([^/?#]+)(?:[^#]*[?&]for=([^&#]+))?/i.exec(url);
      if (!m) return null;
      return m[1].toLowerCase() === 'embed' ? (m[2] || null) : m[1];
    },
  },
  lever: {
    hosts: ['jobs.lever.co'],
    feed: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    fromUrl: (url) => (/^https?:\/\/jobs\.lever\.co\/([^/?#]+)/i.exec(url) || [])[1] || null,
  },
  ashby: {
    hosts: ['jobs.ashbyhq.com'],
    feed: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
    fromUrl: (url) => (/^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)/i.exec(url) || [])[1] || null,
  },
};

/* Path words that are pages, files or placeholders on those hosts, never a company. */
const RESERVED = new Set([
  'embed', 'api', 'static', 'assets', 'images', 'img', 'css', 'js', 'fonts', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'undefined', 'null',
  'company', 'companies', 'jobs', 'job', 'careers', 'login', 'signin', 'signup', 'search', 'about', 'privacy', 'terms', 'help', 'support',
  'index', 'index.html', 'test', 'demo', 'example', 'yourcompany', 'your-company', 'companyname', 'company-name', 'slug', 'new', 'all',
]);

/** A usable board name, or null for junk (tracking tokens, ids, encoded fragments, placeholders). */
function cleanSlug(raw) {
  let s;
  try { s = decodeURIComponent(String(raw || '')); } catch { return null; }
  s = s.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,60}$/.test(s)) return null;
  if (RESERVED.has(s)) return null;
  if (/^\d+$/.test(s)) return null; // job ids
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s)) return null; // uuids
  if (s.length >= 32 && !/[._-]/.test(s)) return null; // long random tokens
  if (/^[a-z0-9_-]{40,}$/.test(s)) return null; // long encoded fragments
  return s;
}

/** The board name in one archive URL for a platform, cleaned, or null. */
function slugFromUrl(platform, url) {
  const p = PLATFORMS[platform];
  if (!p) return null;
  return cleanSlug(p.fromUrl(String(url || '').trim()));
}

/** Unique board names from many archive URLs. */
function slugsFromUrls(platform, urls) {
  const out = new Set();
  for (const u of urls) { const s = slugFromUrl(platform, u); if (s) out.add(s); }
  return [...out];
}

const BAY_AREA = /\b(san francisco|south san francisco|bay area|san jose|palo alto|mountain view|menlo park|sunnyvale|oakland|santa clara|redwood city|san mateo|berkeley|fremont|cupertino|foster city|los altos|milpitas|emeryville|burlingame|san carlos|belmont|brisbane|alameda|walnut creek|pleasanton|los gatos|campbell|saratoga|san bruno|daly city)\b|\bsf\b/i;
const US_STATES = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const US_WORDS = /\b(united states|usa|u\.s\.|us remote|remote[ ,-]+us|america)\b|\(us\)|\bus[- ]based\b/i;

const isBayArea = (loc) => BAY_AREA.test(String(loc || ''));
const isUs = (loc) => US_WORDS.test(String(loc || '')) || US_STATES.test(String(loc || '')) || isBayArea(loc);

/** Location strings of a board's jobs, from each system's feed shape. */
function locationsOf(platform, payload) {
  if (platform === 'greenhouse') return (payload && Array.isArray(payload.jobs) ? payload.jobs : []).map((j) => (j.location && j.location.name) || '');
  if (platform === 'lever') return (Array.isArray(payload) ? payload : []).map((j) => (j.categories && j.categories.location) || '');
  if (platform === 'ashby') return (payload && Array.isArray(payload.jobs) ? payload.jobs : []).map((j) => [j.location, ...(Array.isArray(j.secondaryLocations) ? j.secondaryLocations.map((l) => l && l.location) : [])].filter(Boolean).join(' | '));
  return [];
}

/** How big a board is and how much of it is in the Bay Area and the US. null when the feed is not a board. */
function summarizeBoard(platform, payload) {
  const valid = platform === 'lever' ? Array.isArray(payload) : Boolean(payload && Array.isArray(payload.jobs));
  if (!valid) return null;
  const locs = locationsOf(platform, payload);
  return { jobs: locs.length, bayArea: locs.filter(isBayArea).length, us: locs.filter(isUs).length };
}

/** Name for a Greenhouse board from its feed, when the feed carries one; else the slug. */
const displayName = (slug) => slug.replace(/[-_.]+/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());

/* Boards that are not real employers: vendors' own demo and test accounts. */
const isDemoSlug = (slug) => /(^|[-_.])(test|demo|sandbox|example|sample|staging|qa|dummy|trial)([-_.0-9]|$)|^(lever|ashby|greenhouse)(test|demo|sandbox)/i.test(String(slug || ''));

/* Recruiting and staffing agencies post other companies' jobs under their own name. */
const AGENCY = /\b(staffing|recruit(?:ing|ment|ers?)?|talent\s+(?:solutions|partners|acquisition|stack|group|search)|executive\s+search|search\s+(?:firm|partners)|headhunt\w*|workforce\s+solutions|personnel|placement|resourcing|manpower|randstad|adecco|robert\s+half|kforce|insight\s+global|harnham|haystack|berkley\s+hunt|dynamism)\b/i;
const isAgencyName = (nameOrSlug) => AGENCY.test(String(nameOrSlug || '').replace(/[-_.]+/g, ' '));

/** 'A' Bay Area jobs, 'B' meaningful US presence, else null (not wanted yet). */
function tierOf(board) {
  if (!board || board.us <= 0) return null;
  if (board.bayArea > 0) return 'A';
  return board.us >= 5 ? 'B' : null;
}

/** The company name a board page gives itself: "Wayve Jobs" becomes "Wayve", "Zoox" stays. */
function nameFromTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
    .replace(/^(jobs|careers|work)\s+(at|with)\s+/i, '')
    .replace(/\s*[|\-\u2013\u2014:]\s*(jobs|careers|open positions|job board).*$/i, '')
    .replace(/\s+(jobs|careers|job board)$/i, '')
    .trim();
  return t && t.length <= 60 ? t : null;
}

/** Title and place of each job in a board's feed, from each system's shape. */
function jobsOf(platform, payload) {
  if (platform === 'greenhouse') return (payload && Array.isArray(payload.jobs) ? payload.jobs : []).map((j) => ({ title: j.title || '', location: (j.location && j.location.name) || '' }));
  if (platform === 'lever') return (Array.isArray(payload) ? payload : []).map((j) => ({ title: j.text || '', location: (j.categories && j.categories.location) || '' }));
  if (platform === 'ashby') return (payload && Array.isArray(payload.jobs) ? payload.jobs : []).map((j) => ({ title: j.title || '', location: [j.location, ...(Array.isArray(j.secondaryLocations) ? j.secondaryLocations.map((l) => l && l.location) : [])].filter(Boolean).join(' | ') }));
  return [];
}

/* Titles of tech-industry work: engineering and research, data and AI, security, infrastructure, product, design and technical sales. */
const TECH_TITLE = /\b(engineer(?:ing)?|developer|software|swe|sde|devops|sre|site reliability|data (?:scientist|engineer|analyst|platform|science)|machine learning|ml|ai|artificial intelligence|research scientist|research engineer|applied scientist|security|infrastructure|platform|backend|back-end|frontend|front-end|full[- ]?stack|mobile|ios|android|qa|test automation|firmware|embedded|hardware|silicon|asic|fpga|robotics|autonomy|perception|computer vision|nlp|product manager|technical program|product designer|ux|ui designer|solutions architect|sales engineer|forward deployed|cloud|database|network|architect|analytics|technical writer|developer advocate|information technology|it support)\b/i;
const isTechTitle = (title) => TECH_TITLE.test(String(title || ''));

/** How much of a board is tech work, overall, in the Bay Area and in the US. */
function techCounts(platform, payload) {
  const jobs = jobsOf(platform, payload);
  const tech = jobs.filter((j) => isTechTitle(j.title));
  return { jobs: jobs.length, tech: tech.length, techBay: tech.filter((j) => isBayArea(j.location)).length, techUs: tech.filter((j) => isUs(j.location)).length };
}

/** A board worth adding for a tech job search: real tech volume in the US. */
const isTechBoard = (c) => Boolean(c) && c.techUs >= 3 && (c.tech >= 5 || (c.jobs > 0 && c.tech / c.jobs >= 0.25));

module.exports = { jobsOf, isTechTitle, techCounts, isTechBoard, isDemoSlug, isAgencyName, tierOf, nameFromTitle, PLATFORMS, RESERVED, cleanSlug, slugFromUrl, slugsFromUrls, isBayArea, isUs, locationsOf, summarizeBoard, displayName };
