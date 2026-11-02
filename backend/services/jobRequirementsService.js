/**
 * Reads and stores each job's requirements (resume/jobRequirementsRead.js),
 * once per posting, shared by every user. Three ways in:
 *
 *   readAndStore(job)              one job, now: opening a job that has never
 *                                  been read waits for it (a Haiku call, ~2s)
 *   queueRead(jobIds)              jobs a user just saw in the list without a
 *                                  read: fire-and-forget, small and deduped, so
 *                                  their cards show a match on the next load
 *   backfillMissingJobRequirements the cron sweep, newest first, bounded per
 *                                  tick and per day
 *
 * Same discipline as the skill extractor: the attempt is stamped
 * (requirementsReadAt) whether or not anything came back, so nothing is paid
 * for twice, and an outage backs off instead of hammering.
 */

const { callAI } = require('./ai/core');
const { buildRequirementsReadPrompt, normalizeRequirementsRead } = require('./resume/jobRequirementsRead');

const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5';
const DAILY_CAP = parseInt(process.env.REQUIREMENTS_READ_DAILY_CAP || '20000', 10);

let _day = '';
let _readsToday = 0;
const underDailyCap = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _day) { _day = today; _readsToday = 0; }
  return _readsToday < DAILY_CAP;
};

function parse(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch (_) {
    const { repairTruncatedJSON } = require('./resumeParserService');
    try { return JSON.parse(repairTruncatedJSON(text) || 'null'); } catch (__) { return null; }
  }
}

/** The model's read of one posting, normalized; null when nothing usable. */
async function readRequirements(job) {
  if (!process.env.ANTHROPIC_API_KEY || !job) return null;
  const config = buildRequirementsReadPrompt(job);
  _readsToday += 1;
  const response = await callAI({
    model: HAIKU_MODEL,
    max_tokens: config.max_tokens,
    temperature: config.temperature,
    messages: [{ role: 'system', content: config.system }, { role: 'user', content: config.prompt }],
  });
  // ai/core returns the OpenAI-style shape.
  const raw = response?.choices?.[0]?.message?.content || '';
  return normalizeRequirementsRead(parse(raw));
}

async function store(jobId, read) {
  const sequelize = require('../config/database');
  await sequelize.query(
    `UPDATE "ExternalJobs" SET "requirementsRead" = $1::jsonb, "requirementsReadAt" = NOW() WHERE id = $2`,
    { bind: [read ? JSON.stringify(read) : null, jobId] }
  );
}

/**
 * Read one job now and store it. A failed call is not stamped, so it is
 * retried later; an empty read is, so it is not paid for again.
 */
async function readAndStore(job) {
  if (!job || !job.id) return null;
  if (!underDailyCap()) return null;
  const read = await readRequirements(job);
  await store(job.id, read);
  return read;
}

// ── List-time queue ────────────────────────────────────────────────────────
const _queued = new Set();
let _running = 0;
const QUEUE_CONCURRENCY = 2;
const QUEUE_MAX = 200;

/** Read these jobs in the background (ids only; rows are loaded here). */
function queueRead(jobIds = []) {
  for (const id of jobIds) {
    if (_queued.size >= QUEUE_MAX) break;
    if (id) _queued.add(String(id));
  }
  pump();
}

function pump() {
  while (_running < QUEUE_CONCURRENCY && _queued.size && underDailyCap()) {
    const id = _queued.values().next().value;
    _queued.delete(id);
    _running += 1;
    (async () => {
      try {
        const sequelize = require('../config/database');
        const [job] = await sequelize.query(
          `SELECT id, title, company, description, requirements FROM "ExternalJobs"
            WHERE id = $1 AND "requirementsReadAt" IS NULL`,
          { bind: [id], type: sequelize.constructor.QueryTypes.SELECT }
        );
        if (job) await readAndStore(job);
      } catch (err) {
        console.warn('[RequirementsRead] queued read failed:', err.message);
      } finally {
        _running -= 1;
        pump();
      }
    })();
  }
}

// ── Cron sweep ─────────────────────────────────────────────────────────────
let _inFlight = false;
let _skipUntil = 0;
let _outages = 0;
const OUTAGE_BASE_MS = 5 * 60 * 1000;
const OUTAGE_MAX_MS = 60 * 60 * 1000;

async function backfillMissingJobRequirements({ limit = 20, concurrency = 3 } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return { attempted: 0, read: 0, skipped: 'no-key' };
  if (_inFlight) return { attempted: 0, read: 0, skipped: 'in-flight' };
  if (Date.now() < _skipUntil) return { attempted: 0, read: 0, skipped: 'backoff' };
  if (!underDailyCap()) return { attempted: 0, read: 0, skipped: 'daily-cap' };
  _inFlight = true;
  const sequelize = require('../config/database');
  try {
    let rows;
    try {
      // Newest first: those are the jobs people see. The partial index
      // external_jobs_requirements_pending_idx covers exactly this predicate.
      rows = await sequelize.query(
        `SELECT id, title, company, description, requirements FROM "ExternalJobs"
          WHERE "isActive" = true AND "requirementsReadAt" IS NULL
          ORDER BY COALESCE("postedAt", "createdAt") DESC
          LIMIT $1`,
        { bind: [limit], type: sequelize.constructor.QueryTypes.SELECT }
      );
    } catch (dbErr) {
      // Includes the columns not existing yet while the boot schema step runs.
      _skipUntil = Date.now() + 60 * 1000;
      return { attempted: 0, read: 0, skipped: 'db-error', error: dbErr.message };
    }
    if (!rows.length) return { attempted: 0, read: 0 };

    let read = 0;
    let failed = 0;
    let idx = 0;
    const worker = async () => {
      while (idx < rows.length) {
        const job = rows[idx++];
        try {
          if (await readAndStore(job)) read++;
        } catch (_) {
          failed++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

    if (read === 0 && failed === rows.length) {
      _outages++;
      const backoff = Math.min(OUTAGE_BASE_MS * 2 ** (_outages - 1), OUTAGE_MAX_MS);
      _skipUntil = Date.now() + backoff;
      console.warn(`[RequirementsRead] whole batch failed, backing off ${Math.round(backoff / 60000)}m`);
    } else {
      _outages = 0;
    }
    return { attempted: rows.length, read, failed };
  } finally {
    _inFlight = false;
  }
}

module.exports = { readAndStore, queueRead, backfillMissingJobRequirements, readRequirements };
