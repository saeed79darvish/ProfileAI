/**
 * Pure helpers for judging a LinkedIn jobs export (from the Apify LinkedIn jobs scraper) before any of it
 * is built into the platform: how fresh it is, how complete, how many look like startups, and how much of it
 * we already have. Nothing here touches the network or the database.
 */

const norm = (t) => String(t || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9+#]+/g, ' ').trim();
const COMPANY_SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|gmbh|technologies|technology|labs|holdings)\b/g;
const companyKey = (c) => norm(c).replace(COMPANY_SUFFIX, ' ').replace(/\s+/g, ' ').trim();

const TITLE_STOP = new Set(['a', 'an', 'the', 'and', 'of', 'for', 'to', 'in', 'at', 'remote', 'hybrid', 'onsite', 'sr', 'jr']);
const titleTokens = (t) => new Set(norm(t).split(' ').filter((w) => w && !TITLE_STOP.has(w)));

/** True when two job titles are the same role: every word of the shorter one is in the longer one. */
function sameTitle(a, b) {
  const x = titleTokens(a); const y = titleTokens(b);
  if (!x.size || !y.size) return false;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size < 2) return big.size === small.size && [...small].every((w) => big.has(w));
  return [...small].every((w) => big.has(w));
}

/** Hours since a job was posted, from the first usable field, or null. */
function ageHours(job, now = Date.now()) {
  // "19 hours ago" is more exact than a date with no time, so it goes first.
  const rel0 = String(job.postedAtRelative || '').toLowerCase();
  const m0 = /(\d+)\s*(minute|hour|day|week|month)/.exec(rel0);
  if (m0) return Number(m0[1]) * { minute: 1 / 60, hour: 1, day: 24, week: 168, month: 720 }[m0[2]];
  for (const v of [job.postedAtTimestamp, job.postedAt]) {
    if (v == null || v === '') continue;
    const t = typeof v === 'number' ? (v > 1e12 ? v : v * 1000) : Date.parse(v);
    if (Number.isFinite(t)) return Math.max(0, (now - t) / 3600000);
  }
  const rel = String(job.postedAtRelative || '').toLowerCase();
  const m = /(\d+)\s*(minute|hour|day|week|month)/.exec(rel);
  if (m) return Number(m[1]) * { minute: 1 / 60, hour: 1, day: 24, week: 168, month: 720 }[m[2]];
  return null;
}

/** Company size as a number (the low end of a range like "11-50"), or null. */
function employees(job) {
  const v = job.companyEmployeesCount;
  if (typeof v === 'number') return v;
  const m = /(\d[\d,]*)/.exec(String(v || ''));
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const isStartupLike = (job) => { const n = employees(job); return n != null && n < 200; };
const hasApplyUrl = (job) => /^https?:\/\//i.test(String(job.applyUrl || ''));
const hasSalary = (job) => Boolean(String(job.salary || '').trim()) || (Array.isArray(job.salaryInfo) ? job.salaryInfo.some(Boolean) : Boolean(job.salaryInfo));

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** How the export looks on its own. */
function summarize(jobs, now = Date.now()) {
  const list = (Array.isArray(jobs) ? jobs : []).filter((j) => j && (j.title || j.companyName));
  const n = list.length;
  const ages = list.map((j) => ageHours(j, now));
  const known = ages.filter((a) => a !== null);
  const byLocation = {};
  for (const j of list) { const l = String(j.location || 'Unknown').split(',')[0].trim() || 'Unknown'; byLocation[l] = (byLocation[l] || 0) + 1; }
  return {
    jobs: n,
    uniqueIds: new Set(list.map((j) => j.id || j.link)).size,
    companies: new Set(list.map((j) => companyKey(j.companyName))).size,
    postedWithin24h: pct(known.filter((a) => a <= 24).length, n),
    postedWithin7d: pct(known.filter((a) => a <= 168).length, n),
    ageUnknown: pct(n - known.length, n),
    withApplyUrl: pct(list.filter(hasApplyUrl).length, n),
    withSalary: pct(list.filter(hasSalary).length, n),
    withDescription: pct(list.filter((j) => String(j.descriptionText || j.descriptionHtml || '').length > 200).length, n),
    medianDescriptionChars: median(list.map((j) => String(j.descriptionText || '').length)),
    startupLike: pct(list.filter(isStartupLike).length, n),
    sizeKnown: pct(list.filter((j) => employees(j) != null).length, n),
    topLocations: Object.entries(byLocation).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

/**
 * How much of the export we already have, given a lookup that returns our jobs for a company name.
 * lookup(companyName) -> [{ title, company }]. Counts a job as covered when we hold the same role at the same company.
 */
async function overlap(jobs, lookup, { maxCompanies = 60, pauseMs = 250 } = {}) {
  const list = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.title && j.companyName);
  const byCompany = new Map();
  for (const j of list) { const k = companyKey(j.companyName); if (!byCompany.has(k)) byCompany.set(k, []); byCompany.get(k).push(j); }
  const ranked = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, maxCompanies);
  let checked = 0; let covered = 0; let companiesWeHave = 0; let newStartupJobs = 0; let startupJobs = 0;
  for (const [key, theirs] of ranked) {
    const ours = (await lookup(theirs[0].companyName)).filter((o) => companyKey(o.company) === key);
    if (ours.length) companiesWeHave += 1;
    for (const j of theirs) {
      checked += 1;
      const have = ours.some((o) => sameTitle(o.title, j.title));
      if (have) covered += 1;
      if (isStartupLike(j)) { startupJobs += 1; if (!have) newStartupJobs += 1; }
    }
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return {
    companiesChecked: ranked.length, companiesWeAlreadyHave: companiesWeHave, companiesNewToUs: ranked.length - companiesWeHave,
    jobsChecked: checked, alreadyCovered: pct(covered, checked), newToUs: pct(checked - covered, checked),
    startupJobsChecked: startupJobs, startupJobsNewToUs: newStartupJobs,
  };
}

module.exports = { companyKey, sameTitle, ageHours, employees, isStartupLike, hasApplyUrl, hasSalary, summarize, overlap };
