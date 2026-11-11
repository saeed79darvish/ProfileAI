/**
 * Turns the harvester's raw boards into a clean, ranked list we could add. READ ONLY: it reads public pages and
 * production's public jobs search, writes files under --out, and never touches the database.
 *
 *   node scripts/cleanBoardList.js --out /tmp/harvest --tiers A
 *   node scripts/cleanBoardList.js --out /tmp/harvest --tiers A,B --check-production
 *   node scripts/cleanBoardList.js --out /tmp/harvest --emit-seed 500 --tier A     # print seed lines for the next 500 boards
 *
 * What it does with boards.json from harvestBoards.js:
 *   1. drops vendor demo/test boards and recruiting agencies, boards already in our seed list, and boards with no US jobs
 *   2. ranks the rest: tier A has Bay Area jobs, tier B has at least 5 US jobs
 *   3. gives each its real company name (Greenhouse names itself in its feed; Lever and Ashby in the page title)
 *   4. optionally asks production's public search whether we already hold that board's jobs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PLATFORMS, isDemoSlug, isAgencyName, tierOf, nameFromTitle, displayName, techCounts, isTechBoard } = require('../services/boardHarvest');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = opt('--out', path.join(os.tmpdir(), 'board-harvest'));
const TIERS = opt('--tiers', 'A').split(',').map((s) => s.trim().toUpperCase());
const CHECK_PROD = flag('--check-production');
const EMIT = Number(opt('--emit-seed', 0));
const EMIT_TIER = opt('--tier', 'A').toUpperCase();
const API = process.env.PILOT_COMPARE_API || 'https://api.profilleai.com/api/external-jobs';
const file = (n) => path.join(OUT, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function get(url, json = true) {
  for (let i = 0; i < 2; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'ProfilleAI-board-research/1.0 (read-only)' } });
      if (!res.ok) return null;
      return json ? await res.json() : await res.text();
    } catch { await sleep(800); }
  }
  return null;
}

async function resolveName(b) {
  if (b.platform === 'greenhouse') {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}`);
    if (d && d.name) return String(d.name).trim();
  } else {
    const html = await get(b.platform === 'lever' ? `https://jobs.lever.co/${encodeURIComponent(b.slug)}` : `https://jobs.ashbyhq.com/${encodeURIComponent(b.slug)}`, false);
    const m = html && /<title>([^<]*)<\/title>/i.exec(html);
    const name = m && nameFromTitle(m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
    if (name) return name;
  }
  return displayName(b.slug);
}

async function inProduction(b) {
  let d = await get(`${API}?search=${encodeURIComponent(b.name)}&limit=50`);
  if (!d) { await sleep(1500); d = await get(`${API}?search=${encodeURIComponent(b.name)}&limit=50`); }
  if (!d || !Array.isArray(d.jobs)) return null;
  return d.jobs.some((j) => String(j.boardToken || '').toLowerCase() === b.slug && j.source === b.platform);
}

async function pool(items, n, fn) {
  let i = 0; let done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); done += 1; if (done % 250 === 0) log(`  ${done}/${items.length}`); await sleep(100); }
  }));
}

/** Every board production already holds jobs for, read once from its public job list, slowly. Saved to prod-tokens.json. */
async function crawlProduction() {
  const seen = new Set();
  let page = 1; let pages = null; let waited = 0;
  while (pages === null || page <= pages) {
    const res = await fetch(`${API}?limit=100&page=${page}`, { signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (res && res.status === 429) { waited += 1; if (waited > 20) throw new Error('production keeps answering 429, stopping'); log(`  rate limited, waiting 60s (page ${page})`); await sleep(60000); continue; }
    if (!res || !res.ok) { log(`  page ${page}: HTTP ${res ? res.status : 'none'}, stopping`); break; }
    const d = await res.json();
    if (pages === null) pages = (d.pagination && d.pagination.pages) || 1;
    for (const j of d.jobs || []) if (j.boardToken && j.source) seen.add(`${j.source}|${String(j.boardToken).toLowerCase()}`);
    if (page % 20 === 0) log(`  page ${page}/${pages}, ${seen.size} boards so far`);
    page += 1; waited = 0;
    await sleep(1500);
  }
  fs.writeFileSync(file('prod-tokens.json'), JSON.stringify([...seen]));
  log(`production holds jobs for ${seen.size} boards`);
}

(async () => {
  if (flag('--crawl-production')) { await crawlProduction(); return; }
  if (EMIT) {
    const clean = JSON.parse(fs.readFileSync(file('clean.json'), 'utf8'));
    const pick = clean.filter((b) => b.tier === EMIT_TIER && b.inProduction !== true && !b.suspect).sort((a, b) => b.tech.techBay - a.tech.techBay || b.tech.techUs - a.tech.techUs).slice(0, EMIT);
    for (const b of pick) console.log(`  { name: ${JSON.stringify(b.name)}, platform: '${b.platform}', boardToken: '${b.slug}' },`);
    log(`${pick.length} seed lines (tier ${EMIT_TIER})`);
    return;
  }

  const boards = JSON.parse(fs.readFileSync(file('boards.json'), 'utf8'));
  const stats = { raw: boards.length, inSeed: 0, demo: 0, agencyBySlug: 0, noUs: 0 };
  let kept = [];
  for (const b of boards) {
    if (b.inSeed) { stats.inSeed += 1; continue; }
    if (isDemoSlug(b.slug)) { stats.demo += 1; continue; }
    if (isAgencyName(b.slug)) { stats.agencyBySlug += 1; continue; }
    const tier = tierOf(b);
    if (!tier) { stats.noUs += 1; continue; }
    if (TIERS.includes(tier)) kept.push({ ...b, tier });
  }
  log(`candidates in tiers ${TIERS.join(',')}: ${kept.length}`, stats);

  log('resolving company names');
  await pool(kept, 8, async (b) => { b.name = await resolveName(b); b.suspect = isAgencyName(b.name) || undefined; });
  const agencyByName = kept.filter((b) => b.suspect).length;
  kept = kept.filter((b) => !b.suspect);
  stats.agencyByName = agencyByName;

  log('counting tech jobs per board');
  await pool(kept, 8, async (b) => { const feed = await get(PLATFORMS[b.platform].feed(b.slug)); b.tech = feed ? techCounts(b.platform, feed) : null; });
  const beforeTech = kept.length;
  kept = kept.filter((b) => b.tech && isTechBoard(b.tech));
  stats.notTech = beforeTech - kept.length;

  if (CHECK_PROD) {
    if (fs.existsSync(file('prod-tokens.json'))) {
      const held = new Set(JSON.parse(fs.readFileSync(file('prod-tokens.json'), 'utf8')));
      for (const b of kept) b.inProduction = held.has(`${b.platform}|${b.slug}`);
      log(`production check from prod-tokens.json (${held.size} boards)`);
    } else {
      log('checking production one board at a time (slow; run --crawl-production first for a faster, exact check)');
      await pool(kept, 2, async (b) => { b.inProduction = await inProduction(b); await sleep(700); });
    }
  }

  fs.writeFileSync(file('clean.json'), JSON.stringify(kept));
  const sum = (f) => kept.reduce((s, b) => s + f(b), 0);
  const fresh = CHECK_PROD ? kept.filter((b) => b.inProduction !== true) : kept;
  const result = {
    filtered: stats,
    kept: kept.length,
    tierA: kept.filter((b) => b.tier === 'A').length,
    tierB: kept.filter((b) => b.tier === 'B').length,
    jobs: sum((b) => b.jobs), bayAreaJobs: sum((b) => b.bayArea), usJobs: sum((b) => b.us), techJobs: sum((b) => b.tech.tech), techBayAreaJobs: sum((b) => b.tech.techBay), techUsJobs: sum((b) => b.tech.techUs),
    ...(CHECK_PROD ? { alreadyInProduction: kept.filter((b) => b.inProduction === true).length, unknownProduction: kept.filter((b) => b.inProduction == null).length, newBoards: fresh.length, newTechBayAreaJobs: fresh.reduce((s, b) => s + b.tech.techBay, 0), newTechUsJobs: fresh.reduce((s, b) => s + b.tech.techUs, 0) } : {}),
  };
  fs.writeFileSync(file('clean-summary.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  log('top new boards by Bay Area jobs:');
  for (const b of fresh.sort((a, b) => b.tech.techBay - a.tech.techBay).slice(0, 30)) console.log(`  ${b.name.padEnd(34)} ${b.platform.padEnd(11)} ${String(b.tech.tech).padStart(4)} tech jobs  ${String(b.tech.techBay).padStart(4)} Bay Area  ${String(b.tech.techUs).padStart(4)} US`);
})().catch((e) => { console.error(e); process.exit(1); });
