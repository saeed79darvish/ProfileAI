/**
 * Seed ATSBoard rows for YC-backed companies whose careers pages are
 * served by Greenhouse / Lever / Ashby — all platforms the existing
 * externalJobService.js fetchers already support.
 *
 * What it does:
 *   1. Pull the full YC company directory from its public Algolia index.
 *   2. For each company that has a website, probe the homepage and any
 *      obvious careers paths (/careers, /jobs, /about/careers) for direct
 *      anchor links to known ATS board URLs.
 *   3. Extract the platform + boardToken from any matches.
 *   4. Upsert into ATSBoard (idempotent — `findOrCreate` keyed on
 *      (platform, boardToken)). Existing entries are left alone.
 *
 * Run:
 *   node scripts/seedYcGreenhouseBoards.js
 *   node scripts/seedYcGreenhouseBoards.js --limit 100
 *   node scripts/seedYcGreenhouseBoards.js --dry-run
 *   node scripts/seedYcGreenhouseBoards.js --concurrency 5
 *   node scripts/seedYcGreenhouseBoards.js --batch top      # top YC batches
 *   node scripts/seedYcGreenhouseBoards.js --batch S24,W25  # specific batches
 *
 * Notes:
 *   - YC's company index is fetched via their Algolia search-only credentials
 *     which are publicly exposed in the ycombinator.com/companies bundle.
 *   - The script is HTTP-only (no headless browser). Many YC companies use
 *     SPA frameworks where the careers link lives in JS — those will be
 *     missed. Re-run periodically; the per-company probe is idempotent.
 *   - Designed for monthly cron use after the initial backfill.
 */

require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');

// ─── CLI args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = args[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const LIMIT = parseInt(arg('--limit', 0), 10) || 0;
const CONCURRENCY = parseInt(arg('--concurrency', 5), 10);
const DRY_RUN = !!arg('--dry-run', false);
const BATCH = arg('--batch', null);
const VERBOSE = !!arg('--verbose', false);

// ─── YC Algolia config ────────────────────────────────────────────────────
//
// Fetched from the public companies page once at startup so we don't
// hardcode credentials that YC may rotate. The page exposes them in a
// `<script>` tag as JSON config.

const YC_COMPANIES_URL = 'https://www.ycombinator.com/companies';

async function loadYcAlgoliaConfig() {
  const res = await fetch(YC_COMPANIES_URL, {
    headers: { 'User-Agent': 'ProfileAI/1.0 (job-aggregator; +https://profileai.com)' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    throw new Error(`Could not fetch ${YC_COMPANIES_URL} (HTTP ${res.status})`);
  }
  const html = await res.text();

  // Try a few patterns. YC's React bundle has shifted layout over time;
  // these patterns cover the most common embeds.
  const idMatch =
    html.match(/algolia[^"]*?"appId"\s*:\s*"([A-Z0-9]+)"/i) ||
    html.match(/"applicationID"\s*:\s*"([A-Z0-9]+)"/i) ||
    html.match(/algolia[_-]?app[_-]?id["'\s:=]+([A-Z0-9]{8,})/i);
  const keyMatch =
    html.match(/"apiKey"\s*:\s*"([a-f0-9]{20,})"/i) ||
    html.match(/"searchApiKey"\s*:\s*"([a-f0-9]{20,})"/i) ||
    html.match(/algolia[_-]?api[_-]?key["'\s:=]+([a-f0-9]{20,})/i);
  const indexMatch =
    html.match(/"indexName"\s*:\s*"(YCCompany[A-Za-z_]*)"/i) ||
    html.match(/(YCCompany_production)/);

  if (!idMatch || !keyMatch) {
    // Fallback: well-known public values used in YC's open-source examples.
    // If these stop working, the script will report 0 companies fetched and
    // the user can update them manually.
    console.warn('[YC] Could not parse Algolia config from HTML, using fallback values');
    return {
      appId: 'bl8jl7y0ll',
      apiKey: '4e4357b9893a2dd13f37c4f17cccfdba',
      indexName: indexMatch ? indexMatch[1] : 'YCCompany_production'
    };
  }

  return {
    appId: idMatch[1],
    apiKey: keyMatch[1],
    indexName: indexMatch ? indexMatch[1] : 'YCCompany_production'
  };
}

// ─── Pull all YC companies via Algolia ────────────────────────────────────

async function fetchAllYcCompanies({ appId, apiKey, indexName }) {
  const all = [];
  const HITS_PER_PAGE = 1000; // Algolia's max
  let page = 0;
  let nbPages = Infinity;

  // Optional batch filter (e.g. "S24,W25" or "top")
  let filters = '';
  if (BATCH && BATCH !== 'top') {
    const batches = String(BATCH).split(',').map(b => b.trim()).filter(Boolean);
    if (batches.length) {
      filters = batches.map(b => `batch:"${b}"`).join(' OR ');
    }
  }

  while (page < nbPages) {
    const body = {
      query: '',
      hitsPerPage: HITS_PER_PAGE,
      page,
      ...(filters ? { filters } : {}),
    };

    const res = await fetch(`https://${appId.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-API-Key': apiKey,
        'X-Algolia-Application-Id': appId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Algolia error ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    nbPages = data.nbPages || 1;
    all.push(...(data.hits || []));
    if (VERBOSE) console.log(`[YC] Page ${page + 1}/${nbPages}: ${data.hits?.length || 0} (running total: ${all.length})`);
    page++;
  }

  // YC's index normalizes website fields under different names depending on
  // index version — collect what we see.
  return all
    .map(c => ({
      name: c.name || c.companyName || null,
      slug: c.slug || c.url_slug || null,
      website: c.website || c.url || c.companyUrl || null,
      batch: c.batch || c.season || null,
      status: c.status || null,
    }))
    .filter(c => c.name && c.website && /^https?:\/\//i.test(c.website));
}

// ─── Per-website ATS detection ────────────────────────────────────────────

const ATS_PATTERNS = [
  // Greenhouse — both legacy boards.greenhouse.io and the newer job-boards.greenhouse.io
  { platform: 'greenhouse', rx: /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([a-z0-9_-]+)/i },
  // Greenhouse embed iframes
  { platform: 'greenhouse', rx: /https?:\/\/boards\.eu\.greenhouse\.io\/([a-z0-9_-]+)/i },
  // Lever
  { platform: 'lever', rx: /https?:\/\/jobs\.(?:lever\.co|leverdemo\.com)\/([a-z0-9_-]+)/i },
  // Ashby
  { platform: 'ashby', rx: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
  // Sometimes embedded as ashbyhq.com/companies/{slug}
  { platform: 'ashby', rx: /https?:\/\/(?:www\.)?ashbyhq\.com\/(?:companies\/)?([a-z0-9_-]+)\/?(?:$|[?#])/i },
];

// Common careers page paths to probe in addition to the homepage.
const CAREERS_PATHS = ['/', '/careers', '/jobs', '/careers/', '/jobs/', '/about/careers', '/company/careers'];

async function detectAtsForCompany(company) {
  const baseUrl = (() => {
    try { return new URL(company.website); } catch { return null; }
  })();
  if (!baseUrl) return [];

  // Probe homepage + a couple of careers paths in sequence; bail as soon as
  // we have one match (prefers Greenhouse over Lever over Ashby by virtue
  // of the ATS_PATTERNS order).
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
        headers: {
          'User-Agent': 'ProfileAI/1.0 (job-aggregator; +https://profileai.com)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      // Bail on responses that aren't HTML — saves bandwidth on PDFs / image redirects
      const ctype = res.headers.get('content-type') || '';
      if (!/html|xml/.test(ctype)) continue;
      html = await res.text();
    } catch {
      continue;
    }

    for (const { platform, rx } of ATS_PATTERNS) {
      const m = html.match(rx);
      if (m) {
        const token = m[1].toLowerCase();
        // Filter out obvious junk tokens.
        if (!/^[a-z0-9_-]{2,}$/.test(token)) continue;
        if (['index', 'jobs', 'careers', 'embed', 'js', 'css'].includes(token)) continue;
        const key = `${platform}:${token}`;
        if (!found.some(f => `${f.platform}:${f.boardToken}` === key)) {
          found.push({ platform, boardToken: token, sourceUrl: url });
        }
      }
    }
    if (found.length > 0) break; // first probe with hits wins
  }

  return found;
}

// ─── Concurrency limiter ──────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Seeding YC Greenhouse / Lever / Ashby boards\n');
  console.log(`   limit=${LIMIT || 'all'}  concurrency=${CONCURRENCY}  dry-run=${DRY_RUN}  batch=${BATCH || '*'}\n`);

  await sequelize.authenticate();
  console.log('Database connected.\n');

  console.log('Loading YC Algolia config…');
  const algoliaCfg = await loadYcAlgoliaConfig();
  console.log(`   index=${algoliaCfg.indexName}\n`);

  console.log('Fetching YC company directory…');
  let companies = await fetchAllYcCompanies(algoliaCfg);
  console.log(`   ${companies.length} companies with websites\n`);

  if (LIMIT > 0) companies = companies.slice(0, LIMIT);

  console.log(`Probing ${companies.length} websites for ATS endpoints…`);
  let probed = 0;
  const startedAt = Date.now();

  const results = await mapWithConcurrency(companies, CONCURRENCY, async (c) => {
    const matches = await detectAtsForCompany(c);
    probed++;
    if (probed % 25 === 0 || probed === companies.length) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      console.log(`   ${probed}/${companies.length} (${elapsed}s)`);
    }
    return { company: c, matches };
  });

  // Aggregate
  const counts = { greenhouse: 0, lever: 0, ashby: 0 };
  const toUpsert = [];
  for (const r of results) {
    if (!r || !r.matches || r.matches.length === 0) continue;
    for (const m of r.matches) {
      counts[m.platform] = (counts[m.platform] || 0) + 1;
      toUpsert.push({
        name: r.company.name,
        platform: m.platform,
        boardToken: m.boardToken,
      });
    }
  }

  console.log(`\nFound ATS boards: greenhouse=${counts.greenhouse}, lever=${counts.lever}, ashby=${counts.ashby}`);
  console.log(`Total board candidates (incl. dupes): ${toUpsert.length}`);

  if (DRY_RUN) {
    console.log('\n--dry-run, not writing to DB. Sample:');
    toUpsert.slice(0, 20).forEach(b => console.log(`   ${b.platform.padEnd(10)} ${b.boardToken.padEnd(30)} ${b.name}`));
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  for (const board of toUpsert) {
    const [, wasCreated] = await ATSBoard.findOrCreate({
      where: { platform: board.platform, boardToken: board.boardToken },
      defaults: { name: board.name, isActive: true }
    });
    if (wasCreated) {
      created++;
      if (VERBOSE) console.log(`   + ${board.platform}/${board.boardToken} (${board.name})`);
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done. Created ${created} new boards, ${skipped} already existed.`);
  console.log('   Tip: run `node scripts/seedATSBoards.js` to trigger an immediate sync,');
  console.log('   or wait for the 15-minute cron to pick them up.');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
