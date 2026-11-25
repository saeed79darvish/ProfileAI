/**
 * Board import: turns a list of job boards we have heard of into boards we sync, safely and best first.
 *
 *   1. seed      every row of a list lands in BoardCandidates as 'pending' (or 'exists' when we already have it).
 *   2. validate  a few pending candidates per tick are asked of their system's public feed, slowly, and scored:
 *                US tech jobs count most, then US jobs. Gone, empty, agency, demo and no-US boards are rejected.
 *   3. promote   while ATSBoards has room under MAX_ACTIVE_BOARDS, the best validated candidates become boards.
 *                The regular sync then reads them like any other board.
 *
 * Growth is therefore set by one knob, MAX_ACTIVE_BOARDS: raise it and the next ticks fill the room with the
 * strongest boards in the list; leave it and nothing is added. Validation keeps running either way, so the list
 * is already scored when the room appears.
 *
 * Only systems our sync can read are accepted (greenhouse, ashby, lever).
 */

const fs = require('fs');
const path = require('path');
const { PLATFORMS, cleanSlug, techCounts, isUs, isDemoSlug, isAgencyName, displayName, jobsOf } = require('./boardHarvest');

const SUPPORTED = new Set(['greenhouse', 'ashby', 'lever']);
const UA = 'ProfilleAI-job-sync/1.0 (+https://www.profilleai.com)';
const STORESIGNAL_FILE = path.join(__dirname, '..', 'data', 'storesignal-boards.csv');
const MIN_TECH_WHILE_PENDING = 3;

/* ---------- pure helpers (tested without a network or database) ---------- */

/** RFC 4180 CSV to an array of objects keyed by the header row. Handles quoted commas, quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

/** Candidates from directory rows: supported systems only, cleaned slugs, no duplicates. */
function candidatesFromRows(rows, source) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const platform = String(r.ats || r.platform || '').toLowerCase();
    if (!SUPPORTED.has(platform)) continue;
    const boardToken = cleanSlug(r.slug || r.boardToken);
    if (!boardToken) continue;
    const key = `${platform}:${boardToken}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ platform, boardToken, name: (r.company_name || r.name || '').slice(0, 255) || null, source, sizeHint: parseInt(r.open_jobs || r.sizeHint, 10) || 0 });
  }
  return out;
}

/** The company name a feed reports, when it reports one (Greenhouse puts it on every job). */
function nameFromFeed(platform, payload) {
  if (platform === 'greenhouse' && payload && Array.isArray(payload.jobs)) {
    const n = payload.jobs.find((j) => j && j.company_name);
    if (n) return String(n.company_name).slice(0, 255);
  }
  return null;
}

/**
 * The verdict on one board from its feed. status 'validated' with a score, or 'rejected' with a reason.
 * Score: US tech jobs decide the order; plain US jobs only break ties, and count for at most 100. So a tech
 * company with 11 US tech roles goes ahead of a retailer with 5,000 store jobs, which still gets in once the
 * tech boards are added. Giant non-tech boards are the heaviest to sync and the least matched, so they wait.
 */
function judgeBoard({ platform, boardToken, name }, payload) {
  const jobs = jobsOf(platform, payload);
  const valid = platform === 'lever' ? Array.isArray(payload) : Boolean(payload && Array.isArray(payload.jobs));
  if (!valid) return { status: 'rejected', reason: 'not_a_board' };
  if (!jobs.length) return { status: 'rejected', reason: 'empty' };
  const counts = techCounts(platform, payload);
  const us = jobs.filter((j) => isUs(j.location)).length;
  const feedName = nameFromFeed(platform, payload) || name;
  if (isDemoSlug(boardToken)) return { status: 'rejected', reason: 'demo', jobs: jobs.length, us, tech: counts.tech, techUs: counts.techUs };
  if (isAgencyName(feedName) || isAgencyName(boardToken)) return { status: 'rejected', reason: 'agency', jobs: jobs.length, us, tech: counts.tech, techUs: counts.techUs };
  if (isReposter(feedName) || isReposter(boardToken)) return { status: 'rejected', reason: 'reposter', jobs: jobs.length, us, tech: counts.tech, techUs: counts.techUs };
  if (us === 0) return { status: 'rejected', reason: 'no_us', jobs: jobs.length, us, tech: counts.tech, techUs: counts.techUs };
  const score = Math.min(counts.techUs, 1000) * 10 + Math.min(us, 100);
  return { status: 'validated', name: feedName || displayName(boardToken), jobs: jobs.length, us, tech: counts.tech, techUs: counts.techUs, score };
}

/* Boards that repost other employers' jobs (aggregators) or are agencies by name. Their jobs are already on, or
   belong on, the employers' own boards, and they would duplicate them under the wrong company. */
const REPOSTER = /\b(jobgether|lensa|jooble|talentify|jobleads|remotehunter|jobright|hiringcafe|hiring cafe|jobot|careerbuilder|ziprecruiter|jobs via|agency)\b/i;
const isReposter = (nameOrSlug) => REPOSTER.test(String(nameOrSlug || '').replace(/[-_.]+/g, ' ')) || /agency$/i.test(String(nameOrSlug || ''));

/** How many boards to promote now: the room under the cap, at most one tick's batch. */
function roomToPromote(activeBoards, maxBoards, batch) {
  return Math.max(0, Math.min(batch, maxBoards - activeBoards));
}

/* ---------- network ---------- */

async function fetchFeed(platform, boardToken, fetchImpl = fetch) {
  const url = PLATFORMS[platform].feed(boardToken);
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (res.status === 404 || res.status === 410) return { gone: true };
  if (res.status === 429) { const e = new Error(`${platform} rate limited`); e.isRateLimit = true; throw e; }
  if (!res.ok) throw new Error(`${platform}/${boardToken}: HTTP ${res.status}`);
  return { payload: await res.json() };
}

/* ---------- database ---------- */

function db() { return require('../models').sequelize; }

let _tableReady = false;
async function ensureTable() {
  if (_tableReady) return;
  await require('../scripts/migrations/ensureBoardCandidatesTable').up();
  _tableReady = true;
}

/** Puts every candidate in the table once. Re-running adds only new rows. Returns how many were new. */
async function seedCandidates(candidates) {
  await ensureTable();
  const sequelize = db();
  let inserted = 0;
  for (let i = 0; i < candidates.length; i += 500) {
    const chunk = candidates.slice(i, i + 500);
    const values = [];
    const bind = [];
    chunk.forEach((c, j) => {
      const b = j * 5;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
      bind.push(c.platform, c.boardToken, c.name, c.source, c.sizeHint);
    });
    const [rows] = await sequelize.query(
      `INSERT INTO "BoardCandidates" (platform, "boardToken", name, source, "sizeHint")
       VALUES ${values.join(', ')}
       ON CONFLICT (platform, "boardToken") DO NOTHING
       RETURNING id`,
      { bind }
    );
    inserted += rows.length;
  }
  // Boards we already sync (or once synced) are not candidates.
  await sequelize.query(`
    UPDATE "BoardCandidates" c SET status = 'exists', "updatedAt" = now()
      FROM "ATSBoards" a
     WHERE c.status IN ('pending', 'validated')
       AND a.platform::text = c.platform AND a."boardToken" = c."boardToken"
  `);
  return inserted;
}

/** Seeds the StoreSignal directory when it has rows the table does not hold yet. */
async function seedStoreSignal(file = STORESIGNAL_FILE) {
  await ensureTable();
  const candidates = candidatesFromRows(parseCsv(fs.readFileSync(file, 'utf8')), 'storesignal');
  const [[{ n }]] = await db().query(`SELECT COUNT(*)::int AS n FROM "BoardCandidates" WHERE source = 'storesignal'`);
  if (n >= candidates.length) return { inserted: 0, total: candidates.length };
  return { inserted: await seedCandidates(candidates), total: candidates.length };
}

/**
 * Checks up to `limit` pending candidates, largest first, one request at a time with a pause between them
 * (Lever asks for about one a second). A rate limit stops the tick; the rest wait for the next one.
 */
async function validatePending({ limit = 30, pauseMs = 1000, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  await ensureTable();
  const sequelize = db();
  const [rows] = await sequelize.query(
    `SELECT id, platform, "boardToken", name FROM "BoardCandidates"
      WHERE status = 'pending' ORDER BY "sizeHint" DESC, id ASC LIMIT $1`,
    { bind: [limit] }
  );
  const tally = { checked: 0, validated: 0, rejected: 0, rateLimited: false };
  for (const c of rows) {
    let verdict;
    try {
      const feed = await fetchFeed(c.platform, c.boardToken, fetchImpl);
      verdict = feed.gone ? { status: 'rejected', reason: 'gone' } : judgeBoard(c, feed.payload);
    } catch (err) {
      if (err.isRateLimit) { tally.rateLimited = true; break; }
      // A network blip leaves it pending for a later tick rather than rejecting a real board.
      await sleep(pauseMs);
      continue;
    }
    await sequelize.query(
      `UPDATE "BoardCandidates"
          SET status = $2, reason = $3, name = COALESCE($4, name), jobs = $5, us = $6, tech = $7, "techUs" = $8,
              score = $9, "checkedAt" = now(), "updatedAt" = now()
        WHERE id = $1`,
      { bind: [c.id, verdict.status, verdict.reason || null, verdict.name || null, verdict.jobs ?? null, verdict.us ?? null, verdict.tech ?? null, verdict.techUs ?? null, verdict.score ?? null] }
    );
    tally.checked += 1;
    tally[verdict.status === 'validated' ? 'validated' : 'rejected'] += 1;
    await sleep(pauseMs);
  }
  return tally;
}

/** Promotes the best validated candidates into ATSBoards while there is room under the cap. */
async function promoteValidated({ maxBoards, batch = 25 } = {}) {
  await ensureTable();
  const { ATSBoard } = require('../models');
  const cap = maxBoards ?? parseInt(process.env.MAX_ACTIVE_BOARDS || '750', 10);
  const active = await ATSBoard.count({ where: { isActive: true } });
  const room = roomToPromote(active, cap, batch);
  if (!room) return { added: 0, active, cap };
  const sequelize = db();
  // While some candidates are still unchecked, the best of the rest is not known yet (checks run largest board
  // first, which are mostly non-tech). Until then only boards with real US tech hiring go in.
  const [[{ pending }]] = await sequelize.query(`SELECT COUNT(*)::int AS pending FROM "BoardCandidates" WHERE status = 'pending'`);
  const [rows] = await sequelize.query(
    `SELECT id, platform, "boardToken", name FROM "BoardCandidates"
      WHERE status = 'validated' ${pending > 0 ? `AND "techUs" >= ${MIN_TECH_WHILE_PENDING}` : ''}
      ORDER BY score DESC NULLS LAST, "sizeHint" DESC LIMIT $1`,
    { bind: [room] }
  );
  let added = 0;
  for (const c of rows) {
    let status = 'exists';
    try {
      const [, created] = await ATSBoard.findOrCreate({
        where: { platform: c.platform, boardToken: c.boardToken },
        defaults: { name: c.name || displayName(c.boardToken), isActive: true, isStartup: false },
      });
      if (created) { status = 'added'; added += 1; }
    } catch (err) {
      status = 'rejected';
      console.warn(`[BoardImport] could not add ${c.platform}/${c.boardToken}: ${err.message}`);
    }
    await sequelize.query(`UPDATE "BoardCandidates" SET status = $2, "updatedAt" = now() WHERE id = $1`, { bind: [c.id, status] });
  }
  return { added, active: active + added, cap };
}

/** Where the import stands, for logs and the admin view. */
async function importStatus() {
  await ensureTable();
  const [rows] = await db().query(`SELECT source, status, COUNT(*)::int AS n FROM "BoardCandidates" GROUP BY 1, 2 ORDER BY 1, 2`);
  return rows;
}

/** One cron tick: seed once, check a few, promote into any room. */
async function runBoardImportTick({ validateLimit, promoteBatch } = {}) {
  const seeded = await seedStoreSignal();
  const checked = await validatePending({ limit: validateLimit ?? parseInt(process.env.BOARD_IMPORT_VALIDATE_BATCH || '40', 10) });
  const promoted = await promoteValidated({ batch: promoteBatch ?? parseInt(process.env.BOARD_IMPORT_PROMOTE_BATCH || '25', 10) });
  return { seeded, checked, promoted };
}

module.exports = {
  parseCsv, candidatesFromRows, judgeBoard, nameFromFeed, roomToPromote,
  fetchFeed, seedCandidates, seedStoreSignal, validatePending, promoteValidated, importStatus, runBoardImportTick,
  SUPPORTED, STORESIGNAL_FILE,
};
