/**
 * Builds and caches each job's structured description
 * (jobDescriptionStructure.js) on ExternalJobs.descriptionStructured.
 *
 *   structuredFor(job)   the detail route: the cached structure when it is
 *                        current, else built now in code (~1ms) and stored
 *                        without waiting on the write
 *
 * Built on first open rather than at sync: sync writes every job on every
 * pass on the one web dyno, and most jobs are never opened. The cache is keyed
 * by a hash of the source text, so a resync that changes the posting rebuilds
 * it and one that doesn't costs nothing.
 *
 * Postings with no usable headings are queued for a Haiku split (anchors
 * only, see applyAiSplit). It runs in the background, so the page never waits
 * on it; the next open shows the better split. Bounded per day, and the
 * attempt is stamped on the structure (aiTriedAt) so no posting is paid for
 * twice.
 */

const { callAI } = require('./ai/core');
const {
  structureDescription, needsAiSplit, isCurrent, plainTextFor, buildSplitPrompt, applyAiSplit,
} = require('./jobDescriptionStructure');

const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5';
const DAILY_CAP = parseInt(process.env.JD_SPLIT_DAILY_CAP || '1500', 10);

let _day = '';
let _splitsToday = 0;
const underDailyCap = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _day) { _day = today; _splitsToday = 0; }
  return _splitsToday < DAILY_CAP;
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

async function store(jobId, structured) {
  const sequelize = require('../config/database');
  await sequelize.query(
    `UPDATE "ExternalJobs" SET "descriptionStructured" = $1::jsonb WHERE id = $2`,
    { bind: [JSON.stringify(structured), jobId] }
  );
}

/** The job's structured description, built and cached on first use. */
function structuredFor(job) {
  if (!job || !job.id) return null;
  const cached = job.descriptionStructured;
  if (isCurrent(cached, job)) {
    if (cached.method === 'rules' && !cached.aiTriedAt && needsAiSplit(cached)) queueSplit(job.id);
    return cached;
  }
  const built = structureDescription(job);
  if (!built) return null;
  store(job.id, built).catch((err) => console.warn('[JDStructure] store failed:', err.message));
  if (needsAiSplit(built)) queueSplit(job.id);
  return built;
}

// ── Background AI split ────────────────────────────────────────────────────
const _queued = new Set();
let _running = 0;
const QUEUE_CONCURRENCY = 2;
const QUEUE_MAX = 100;

function queueSplit(jobId) {
  if (!process.env.ANTHROPIC_API_KEY || _queued.size >= QUEUE_MAX) return;
  _queued.add(String(jobId));
  pump();
}

function pump() {
  while (_running < QUEUE_CONCURRENCY && _queued.size && underDailyCap()) {
    const id = _queued.values().next().value;
    _queued.delete(id);
    _running += 1;
    splitAndStore(id)
      .catch((err) => console.warn('[JDStructure] AI split failed:', err.message))
      .finally(() => { _running -= 1; pump(); });
  }
}

async function splitAndStore(id) {
  const sequelize = require('../config/database');
  const [job] = await sequelize.query(
    `SELECT id, title, company, location, "locationType", description, "descriptionHtml",
            "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod", "descriptionStructured"
       FROM "ExternalJobs" WHERE id = $1`,
    { bind: [id], type: sequelize.constructor.QueryTypes.SELECT }
  );
  const current = job && job.descriptionStructured;
  if (!current || current.method !== 'rules' || current.aiTriedAt) return;

  const text = plainTextFor(job);
  const config = buildSplitPrompt(job, text);
  _splitsToday += 1;
  let split = null;
  try {
    const response = await callAI({
      model: HAIKU_MODEL,
      max_tokens: config.max_tokens,
      messages: [{ role: 'system', content: config.system }, { role: 'user', content: config.prompt }],
    });
    split = applyAiSplit(parse(response?.choices?.[0]?.message?.content), job, text);
  } catch (err) {
    // An outage is not stamped, so the job is retried on a later open.
    console.warn('[JDStructure] AI split call failed:', err.message);
    return;
  }
  const aiTriedAt = new Date().toISOString();
  await store(id, split ? { ...split, aiTriedAt } : { ...current, aiTriedAt });
}

module.exports = { structuredFor };
