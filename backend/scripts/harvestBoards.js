/**
 * Finds job boards at scale and measures what they would add. READ ONLY: it reads public pages and public
 * job feeds, writes files under --out, and never touches the database or production.
 *
 *   node scripts/harvestBoards.js --platforms ashby,lever,greenhouse --pages 2 --out /tmp/harvest
 *   node scripts/harvestBoards.js --skip-harvest --out /tmp/harvest           # validate what is already collected
 *   node scripts/harvestBoards.js --names names.txt --out /tmp/harvest        # also try company names (one per line)
 *   node scripts/harvestBoards.js --report-only --out /tmp/harvest
 *
 * Stages (each resumable, state is kept in --out):
 *   1. harvest   the Internet Archive's URL index lists pages captured under each job-board host. The first path
 *                part of a URL like jobs.ashbyhq.com/<company>/... names a board. The index is sorted, so the host
 *                is read in shards by first letter, a few pages each.
 *   2. validate  each name is asked of the system's own public feed. Only boards that answer with a job list are kept.
 *   3. report    boards, jobs, and how many are in the Bay Area and the US, and which are not in our seed list yet.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PLATFORMS, slugsFromUrls, cleanSlug, summarizeBoard, displayName } = require('../services/boardHarvest');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const OUT = opt('--out', path.join(os.tmpdir(), 'board-harvest'));
const PLATFORM_LIST = (opt('--platforms', 'ashby,lever,greenhouse')).split(',').map((s) => s.trim()).filter((p) => PLATFORMS[p]);
const PAGES = Number(opt('--pages', 2));
const PAGE_LINES = Number(opt('--page-lines', 100000));
const HARVEST_CONCURRENCY = Number(opt('--harvest-concurrency', 3));
const VALIDATE_CONCURRENCY = Number(opt('--concurrency', 8));
const VALIDATE_LIMIT = Number(opt('--validate-limit', 0));
const NAMES_FILE = opt('--names', null);
const SHARDS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

fs.mkdirSync(OUT, { recursive: true });
const file = (n) => path.join(OUT, n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return d; } };
const writeJson = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function getText(url, timeout = 150000) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'ProfilleAI-board-research/1.0 (read-only)' } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
      return { status: res.status, text: await res.text() };
    } catch { await sleep(2000 * (attempt + 1)); }
  }
  return { status: 0, text: '' };
}

/* ---------- 1. harvest ---------- */

async function harvestShard(platform, host, shard, state) {
  const key = `${host}|${shard}`;
  const done = state.done[key] || { pages: 0, resume: null, finished: false };
  while (!done.finished && done.pages < PAGES) {
    let url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${host}/${shard}`)}&matchType=prefix&fl=original&collapse=urlkey&filter=statuscode:200&limit=${PAGE_LINES}&output=txt&showResumeKey=true`;
    if (done.resume) url += `&resumeKey=${encodeURIComponent(done.resume)}`;
    const { status, text } = await getText(url);
    if (status !== 200) { log(`  ${host}/${shard} page ${done.pages + 1}: HTTP ${status}, moving on`); break; }
    const lines = text.split('\n');
    const blank = lines.indexOf('');
    const urls = blank === -1 ? lines : lines.slice(0, blank);
    const resume = blank === -1 ? null : (lines.slice(blank + 1).find(Boolean) || null);
    for (const s of slugsFromUrls(platform, urls)) state.slugs[platform].add(s);
    done.pages += 1;
    done.resume = resume;
    if (!resume) done.finished = true;
    state.done[key] = done;
  }
  state.done[key] = done;
}

async function harvest() {
  const saved = readJson('harvest-state.json', null);
  const state = { done: saved ? saved.done : {}, slugs: {} };
  for (const p of PLATFORM_LIST) state.slugs[p] = new Set(saved && saved.slugs && saved.slugs[p] ? saved.slugs[p] : []);
  for (const platform of PLATFORM_LIST) {
    const jobs = [];
    for (const host of PLATFORMS[platform].hosts) for (const shard of SHARDS) jobs.push([host, shard]);
    log(`harvest ${platform}: ${jobs.length} shards, ${PAGES} page(s) each`);
    let next = 0; let completed = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const [host, shard] = jobs[next++];
        await harvestShard(platform, host, shard, state);
        completed += 1;
        if (completed % 6 === 0 || completed === jobs.length) {
          writeJson('harvest-state.json', { done: state.done, slugs: Object.fromEntries(Object.entries(state.slugs).map(([k, v]) => [k, [...v]])) });
          log(`  ${platform}: ${completed}/${jobs.length} shards, ${state.slugs[platform].size} names so far`);
        }
        await sleep(500);
      }
    };
    await Promise.all(Array.from({ length: HARVEST_CONCURRENCY }, worker));
  }
  writeJson('harvest-state.json', { done: state.done, slugs: Object.fromEntries(Object.entries(state.slugs).map(([k, v]) => [k, [...v]])) });
  return Object.fromEntries(Object.entries(state.slugs).map(([k, v]) => [k, [...v]]));
}

/* ---------- 2. validate ---------- */

function nameCandidates(name) {
  const b = String(name).toLowerCase().replace(/&/g, 'and').replace(/\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|labs)\b/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
  return [...new Set([b.replace(/ /g, ''), b.replace(/ /g, '-'), b.split(' ')[0]].map(cleanSlug).filter(Boolean))];
}

async function validate(candidates) {
  const jsonl = file('validated.jsonl');
  const seen = new Set();
  if (fs.existsSync(jsonl)) for (const line of fs.readFileSync(jsonl, 'utf8').split('\n')) { if (line) { const r = JSON.parse(line); seen.add(`${r.platform}|${r.slug}`); } }
  const todo = [];
  for (const [platform, slugs] of Object.entries(candidates)) for (const slug of slugs) if (!seen.has(`${platform}|${slug}`)) todo.push([platform, slug]);
  const limited = VALIDATE_LIMIT ? todo.slice(0, VALIDATE_LIMIT) : todo;
  log(`validate: ${limited.length} to check (${seen.size} already done)`);
  const out = fs.createWriteStream(jsonl, { flags: 'a' });
  let i = 0; let done = 0; let ok = 0;
  const worker = async () => {
    while (i < limited.length) {
      const [platform, slug] = limited[i++];
      const { status, text } = await getText(PLATFORMS[platform].feed(slug), 30000);
      let summary = null;
      if (status === 200) { try { summary = summarizeBoard(platform, JSON.parse(text)); } catch { summary = null; } }
      out.write(`${JSON.stringify({ platform, slug, ...(summary || { jobs: 0, bayArea: 0, us: 0, invalid: true }) })}\n`);
      done += 1; if (summary && summary.jobs > 0) ok += 1;
      if (done % 200 === 0) log(`  validated ${done}/${limited.length}, ${ok} boards with jobs`);
      await sleep(120);
    }
  };
  await Promise.all(Array.from({ length: VALIDATE_CONCURRENCY }, worker));
  await new Promise((r) => out.end(r));
}

/* ---------- 3. report ---------- */

function report() {
  const { SEED_BOARDS } = require('../config/seedBoards');
  const inSeed = new Set(SEED_BOARDS.map((b) => `${b.platform}|${String(b.boardToken || '').toLowerCase()}`));
  const rows = fs.existsSync(file('validated.jsonl')) ? fs.readFileSync(file('validated.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const boards = rows.filter((r) => !r.invalid && r.jobs > 0).map((r) => ({ ...r, name: displayName(r.slug), inSeed: inSeed.has(`${r.platform}|${r.slug}`) }));
  const summary = { checked: rows.length };
  for (const p of PLATFORM_LIST) {
    const b = boards.filter((x) => x.platform === p);
    summary[p] = { boards: b.length, jobs: b.reduce((s, x) => s + x.jobs, 0), bayAreaJobs: b.reduce((s, x) => s + x.bayArea, 0), usJobs: b.reduce((s, x) => s + x.us, 0), boardsWithBayAreaJobs: b.filter((x) => x.bayArea > 0).length, notInSeed: b.filter((x) => !x.inSeed).length };
  }
  summary.total = { boards: boards.length, jobs: boards.reduce((s, x) => s + x.jobs, 0), bayAreaJobs: boards.reduce((s, x) => s + x.bayArea, 0), usJobs: boards.reduce((s, x) => s + x.us, 0), boardsInSeed: boards.filter((x) => x.inSeed).length };
  writeJson('boards.json', boards);
  writeJson('summary.json', summary);
  const top = boards.filter((b) => b.bayArea > 0 && !b.inSeed).sort((a, b) => b.bayArea - a.bayArea).slice(0, 25);
  log('\nSUMMARY'); console.log(JSON.stringify(summary, null, 2));
  log('\nTop Bay Area boards not in our seed list:'); for (const b of top) console.log(`  ${b.platform.padEnd(11)} ${b.slug.padEnd(28)} ${String(b.jobs).padStart(5)} jobs, ${String(b.bayArea).padStart(4)} Bay Area, ${String(b.us).padStart(4)} US`);
  log(`\nFiles in ${OUT}: boards.json (every board with jobs), summary.json`);
}

(async () => {
  if (flag('--report-only')) { report(); return; }
  let candidates = {};
  if (!flag('--skip-harvest')) candidates = await harvest();
  else { const s = readJson('harvest-state.json', { slugs: {} }); candidates = s.slugs || {}; }
  if (NAMES_FILE) {
    const names = fs.readFileSync(NAMES_FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    for (const p of PLATFORM_LIST) candidates[p] = [...new Set([...(candidates[p] || []), ...names.flatMap(nameCandidates)])];
  }
  for (const p of Object.keys(candidates)) if (!PLATFORM_LIST.includes(p)) delete candidates[p];
  writeJson('candidates.json', candidates);
  log('candidates:', Object.fromEntries(Object.entries(candidates).map(([k, v]) => [k, v.length])));
  await validate(candidates);
  report();
})().catch((e) => { console.error(e); process.exit(1); });
