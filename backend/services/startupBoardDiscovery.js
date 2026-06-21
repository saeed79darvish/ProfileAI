/**
 * Startup board discovery service.
 *
 * Reusable core (extracted from scripts/seedYcGreenhouseBoards.js) for finding
 * the Greenhouse / Lever / Ashby boards of startups — primarily the Y Combinator
 * company directory — and upserting them into ATSBoard. Used by:
 *   - scripts/seedYcGreenhouseBoards.js        (manual CLI)
 *   - scripts/migrations/ensureStartupBoards.js (gated boot bootstrap)
 *   - workers/cronWorker.js                     (weekly refresh)
 *
 * All three platforms are already supported by externalJobService fetchers, so
 * a discovered board is immediately syncable by the regular cron sweep.
 *
 * HTTP-only (no headless browser): SPA careers pages that inject the ATS link
 * via JS are missed, so this is meant to run periodically — every pass is
 * idempotent (findOrCreate keyed on platform+boardToken).
 */

const { ATSBoard } = require('../models');

const UA = 'ProfileAI/1.0 (job-aggregator; +https://profileai.com)';
const YC_COMPANIES_URL = 'https://www.ycombinator.com/companies';

// ─── YC Algolia config ──────────────────────────────────────────────────────

async function loadYcAlgoliaConfig() {
  const res = await fetch(YC_COMPANIES_URL, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Could not fetch ${YC_COMPANIES_URL} (HTTP ${res.status})`);
  const html = await res.text();

  // YC's companies page embeds the search creds inline as
  //   AlgoliaOpts = {"app":"45BWZJ1SGC","key":"<securedApiKey>", ...}
  // The key is a *secured* (scoped, possibly time-limited) Algolia API key, so
  // we always parse it fresh from the live page rather than hardcoding it.
  let app = null;
  let key = null;
  let indexName = 'YCCompany_production';

  const optsMatch = html.match(/AlgoliaOpts\s*=\s*(\{.*?\})/s);
  if (optsMatch) {
    app = (optsMatch[1].match(/"app"\s*:\s*"([^"]+)"/) || [])[1] || null;
    key = (optsMatch[1].match(/"key"\s*:\s*"([^"]+)"/) || [])[1] || null;
  }

  // Legacy / alternate embeds (kept as a secondary parse path).
  if (!app) {
    app =
      (html.match(/algolia[^"]*?"appId"\s*:\s*"([A-Z0-9]+)"/i) || [])[1] ||
      (html.match(/"applicationID"\s*:\s*"([A-Z0-9]+)"/i) || [])[1] ||
      null;
  }
  if (!key) {
    key =
      (html.match(/"apiKey"\s*:\s*"([a-f0-9]{20,})"/i) || [])[1] ||
      (html.match(/"searchApiKey"\s*:\s*"([a-f0-9]{20,})"/i) || [])[1] ||
      null;
  }
  const idxMatch = html.match(/(YCCompany[A-Za-z_]*production)/);
  if (idxMatch) indexName = idxMatch[1];

  if (!app || !key) {
    throw new Error('Could not parse YC Algolia credentials from companies page (layout changed)');
  }
  return { appId: app, apiKey: key, indexName };
}

async function fetchAllYcCompanies({ appId, apiKey, indexName }, { batch = null, max = 0 } = {}) {
  const all = [];
  const HITS_PER_PAGE = 1000;
  let page = 0;
  let nbPages = Infinity;

  let filters = '';
  if (batch && batch !== 'top') {
    const batches = String(batch).split(',').map((b) => b.trim()).filter(Boolean);
    if (batches.length) filters = batches.map((b) => `batch:"${b}"`).join(' OR ');
  }

  while (page < nbPages) {
    const body = { query: '', hitsPerPage: HITS_PER_PAGE, page, ...(filters ? { filters } : {}) };
    const res = await fetch(
      `https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Algolia-API-Key': apiKey,
          'X-Algolia-Application-Id': appId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Algolia error ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    nbPages = data.nbPages || 1;
    all.push(...(data.hits || []));
    page++;
    if (max > 0 && all.length >= max) break;
  }

  return all
    .map((c) => ({
      name: c.name || c.companyName || null,
      website: c.website || c.url || c.companyUrl || null,
    }))
    .filter((c) => c.name && c.website && /^https?:\/\//i.test(c.website));
}

// ─── Per-website ATS detection ────────────────────────────────────────────

const ATS_PATTERNS = [
  { platform: 'greenhouse', rx: /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9_-]+)/i },
  { platform: 'greenhouse', rx: /https?:\/\/boards\.eu\.greenhouse\.io\/([a-z0-9_-]+)/i },
  { platform: 'lever', rx: /https?:\/\/jobs\.(?:lever\.co|leverdemo\.com)\/([a-z0-9_-]+)/i },
  { platform: 'ashby', rx: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
  { platform: 'ashby', rx: /https?:\/\/(?:www\.)?ashbyhq\.com\/(?:companies\/)?([a-z0-9_-]+)\/?(?:$|[?#])/i },
];
const CAREERS_PATHS = ['/', '/careers', '/jobs', '/careers/', '/jobs/', '/about/careers', '/company/careers'];
const JUNK_TOKENS = new Set(['index', 'jobs', 'careers', 'embed', 'js', 'css']);

async function detectAtsForCompany(company) {
  let baseUrl;
  try { baseUrl = new URL(company.website); } catch { return []; }

  const seen = new Set();
  const found = [];

  for (const path of CAREERS_PATHS) {
    let url;
    try { url = new URL(path, baseUrl).toString(); } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url);

    let html;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const ctype = res.headers.get('content-type') || '';
      if (!/html|xml/.test(ctype)) continue;
      html = await res.text();
    } catch {
      continue;
    }

    for (const { platform, rx } of ATS_PATTERNS) {
      const m = html.match(rx);
      if (!m) continue;
      const token = m[1].toLowerCase();
      if (!/^[a-z0-9_-]{2,}$/.test(token) || JUNK_TOKENS.has(token)) continue;
      const key = `${platform}:${token}`;
      if (!found.some((f) => `${f.platform}:${f.boardToken}` === key)) {
        found.push({ platform, boardToken: token });
      }
    }
    if (found.length > 0) break;
  }
  return found;
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await fn(items[idx], idx); }
      catch (err) { results[idx] = { error: err.message }; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── YC directory discovery ───────────────────────────────────────────────

/**
 * Discover Greenhouse / Lever / Ashby boards from the Y Combinator company
 * directory by probing each company's careers page.
 *
 * @param {object}  opts
 * @param {number}  opts.limit        Max companies to probe (0 = all).
 * @param {number}  opts.concurrency  Parallel website probes (default 5).
 * @param {string}  opts.batch        YC batch filter, e.g. "S24,W25" (optional).
 * @param {boolean} opts.dryRun       Detect but don't write.
 * @returns {{ created:number, skipped:number, counts:object, probed:number }}
 */
async function discoverYcBoards({ limit = 0, concurrency = 5, batch = null, dryRun = false } = {}) {
  const algoliaCfg = await loadYcAlgoliaConfig();
  let companies = await fetchAllYcCompanies(algoliaCfg, { batch, max: limit });
  if (limit > 0) companies = companies.slice(0, limit);

  const results = await mapWithConcurrency(companies, concurrency, async (c) => ({
    company: c,
    matches: await detectAtsForCompany(c),
  }));

  const counts = { greenhouse: 0, lever: 0, ashby: 0 };
  const toUpsert = [];
  const dedupe = new Set();
  for (const r of results) {
    if (!r || !r.matches || r.matches.length === 0) continue;
    for (const m of r.matches) {
      const key = `${m.platform}:${m.boardToken}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      counts[m.platform] = (counts[m.platform] || 0) + 1;
      toUpsert.push({ name: r.company.name, platform: m.platform, boardToken: m.boardToken });
    }
  }

  if (dryRun) return { created: 0, skipped: 0, counts, probed: companies.length, candidates: toUpsert };

  let created = 0;
  let skipped = 0;
  for (const board of toUpsert) {
    try {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        // isStartup: true — every board this crawler creates is, by
        // definition, a startup (YC / VC-portfolio company). Existing
        // discovery boards are promoted by ensureStartupBoardFlag.js.
        defaults: { name: board.name, isActive: true, isStartup: true },
      });
      if (wasCreated) created++; else skipped++;
    } catch {
      // ignore individual upsert failures (e.g. token collisions)
    }
  }
  return { created, skipped, counts, probed: companies.length };
}

// ─── Getro VC-network discovery ───────────────────────────────────────────
//
// Getro (getro.com) powers the talent/job boards for most VC & accelerator
// portfolios (a16z, Sequoia, etc.). Each portfolio is a numeric "collection".
// Its public search API returns jobs whose `url` links straight to the
// company's Greenhouse/Lever/Ashby board — so we mine those URLs to discover
// canonical ATS boards (which the existing fetchers then sync). This yields
// the company's real, full board rather than just the roles surfaced on the
// VC site, and dedupes automatically against boards we already track.

const GETRO_ATS_PATTERNS = [
  { platform: 'greenhouse', rx: /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9_-]+)/i },
  { platform: 'greenhouse', rx: /https?:\/\/boards\.eu\.greenhouse\.io\/([a-z0-9_-]+)/i },
  { platform: 'lever', rx: /https?:\/\/jobs\.lever\.co\/([a-z0-9_-]+)/i },
  { platform: 'ashby', rx: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
];

async function fetchGetroCollectionJobs(collectionId, page) {
  try {
    const res = await fetch(
      `https://api.getro.com/api/v2/collections/${collectionId}/search/jobs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ page, query: '' }),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results && data.results.jobs) || null;
  } catch {
    return null;
  }
}

/**
 * Discover Greenhouse / Lever / Ashby boards from Getro VC-portfolio networks.
 *
 * Scans Getro collection ids in [startId, endId], extracts the ATS board
 * token from each job's link, and upserts the unique boards into ATSBoard.
 *
 * @param {object}  opts
 * @param {number}  opts.startId   First collection id to scan (default 1).
 * @param {number}  opts.endId     Last collection id to scan (default 400).
 * @param {number}  opts.pages     Pages to sample per collection (default 2).
 * @param {boolean} opts.dryRun    Detect but don't write.
 * @returns {{ created:number, skipped:number, counts:object, networks:number, candidates?:Array }}
 */
async function discoverGetroBoards({ startId = 1, endId = 400, pages = 2, dryRun = false } = {}) {
  const counts = { greenhouse: 0, lever: 0, ashby: 0 };
  const dedupe = new Map(); // "platform:token" -> orgName
  let networks = 0;

  for (let id = startId; id <= endId; id++) {
    const first = await fetchGetroCollectionJobs(id, 0);
    if (!first || !first.length) continue;
    networks++;

    for (let pg = 0; pg < pages; pg++) {
      const jobs = pg === 0 ? first : await fetchGetroCollectionJobs(id, pg);
      if (!jobs || !jobs.length) break;
      for (const job of jobs) {
        const url = job.url || '';
        for (const { platform, rx } of GETRO_ATS_PATTERNS) {
          const m = url.match(rx);
          if (!m) continue;
          const token = m[1].toLowerCase();
          if (!/^[a-z0-9_-]{2,}$/.test(token) || JUNK_TOKENS.has(token)) continue;
          const key = `${platform}:${token}`;
          if (!dedupe.has(key)) {
            dedupe.set(key, (job.organization && job.organization.name) || token);
            counts[platform] = (counts[platform] || 0) + 1;
          }
        }
      }
    }
  }

  const toUpsert = [...dedupe.entries()].map(([key, name]) => {
    const [platform, boardToken] = key.split(':');
    return { platform, boardToken, name };
  });

  if (dryRun) return { created: 0, skipped: 0, counts, networks, candidates: toUpsert };

  let created = 0;
  let skipped = 0;
  for (const board of toUpsert) {
    try {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        // isStartup: true — every board this crawler creates is, by
        // definition, a startup (YC / VC-portfolio company). Existing
        // discovery boards are promoted by ensureStartupBoardFlag.js.
        defaults: { name: board.name, isActive: true, isStartup: true },
      });
      if (wasCreated) created++; else skipped++;
    } catch {
      // ignore individual upsert failures
    }
  }
  return { created, skipped, counts, networks };
}

module.exports = {
  discoverYcBoards,
  discoverGetroBoards,
  // exported for reuse/testing
  loadYcAlgoliaConfig,
  fetchAllYcCompanies,
  detectAtsForCompany,
  mapWithConcurrency,
};
