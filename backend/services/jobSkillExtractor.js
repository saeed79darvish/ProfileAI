/**
 * Job Skill Extractor (Claude Haiku)
 *
 * Many ATS APIs return jobs without an explicit skills array (Greenhouse and
 * Adzuna in particular). The keyword ranker and the upcoming skill-chip
 * filter both work much better when ExternalJob.skills is populated.
 *
 * This service uses Claude Haiku to extract a normalized array of skill
 * tokens from a job's title + description. Cost: ~$0.0001 per job. A
 * one-time backfill of ~10k jobs costs roughly $1-2.
 *
 * Public surface:
 *   extractSkills(job)               — extract for one job, returns string[]
 *   extractAndPersist(job)           — extract and write to ExternalJob.skills
 */

const { callAI, safeParseJSON } = require('./ai/core');

const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You extract a normalized list of professional skills from a job posting.

Rules:
- Return ONLY a JSON array of lowercase skill strings, e.g. ["react","typescript","aws lambda","graphql"]
- No prose, no markdown, no code fences. Just the raw JSON array.
- Include hard skills (technologies, languages, frameworks, tools, certifications, methodologies) that the role REQUIRES or HEAVILY USES.
- Skip generic soft skills like "teamwork", "communication", "leadership" UNLESS they're a primary expectation of the role.
- Use canonical names: "javascript" not "JS", "kubernetes" not "k8s", "google cloud" not "gcp".
- Multi-word skills are fine: "react native", "machine learning", "design systems".
- Cap at 15 entries — pick the most distinctive ones.
- If the input clearly isn't a job posting, return [].`;

/**
 * Extract skills from a single job.
 * Returns an array of canonical skill strings (may be empty).
 * Never throws — returns [] on any failure so callers can default safely.
 */
async function extractSkills(job) {
  if (!job) return [];
  if (!process.env.ANTHROPIC_API_KEY) return [];

  // Build a compact text representation. Cap at ~3000 chars to keep tokens
  // (and cost) bounded — early portion of the JD usually has the skill cues.
  const parts = [];
  if (job.title) parts.push(`Title: ${job.title}`);
  if (job.company) parts.push(`Company: ${job.company}`);
  if (job.department) parts.push(`Department: ${job.department}`);
  if (job.experienceLevel) parts.push(`Level: ${job.experienceLevel}`);
  if (job.requirements) parts.push(`Requirements:\n${job.requirements.slice(0, 1500)}`);
  if (job.description) parts.push(`Description:\n${job.description.slice(0, 1800)}`);
  const text = parts.join('\n\n').slice(0, 4500);
  if (text.length < 30) return [];

  let raw;
  try {
    const response = await callAI({
      model: HAIKU_MODEL,
      max_tokens: 250,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ]
    });
    raw = response.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.warn('[SkillExtract] Haiku call failed:', err.message);
    return [];
  }

  // Tolerant parse: Haiku usually returns clean JSON, but recover from
  // accidental code fences or leading commentary.
  //
  // The third argument matters. It defaults to 'object', so when the model
  // wrapped its reply in a code fence the direct parse failed and the fallback
  // regex then hunted for `{...}` in a response that is always `[...]` — never
  // matching, logging "Failed to parse AI response" every single time, and
  // leaning on extractJsonArray below to recover. Correct on the happy path,
  // but it emitted a warning per job, which at backfill rates is thousands of
  // spurious log lines a day. Ask for an array and the normal path works.
  const arr = safeParseJSON(raw, null, 'array') || extractJsonArray(raw);
  if (!Array.isArray(arr)) return [];

  return normalizeSkills(arr);
}

function extractJsonArray(s) {
  if (!s) return null;
  const m = s.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function normalizeSkills(arr) {
  return arr
    .map(s => (typeof s === 'string' ? s : (s?.name || s?.skill || ''))
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '))
    .filter(s => s && s.length >= 2 && s.length <= 60)
    .filter((s, i, a) => a.indexOf(s) === i) // de-dupe
    .slice(0, 15);
}

/**
 * Extract skills for a job AND persist to ExternalJob.skills.
 * Skips jobs that already have a non-empty skills array unless `force`.
 */
async function extractAndPersist(job, { force = false } = {}) {
  if (!job || !job.id) return [];

  const existing = Array.isArray(job.skills) ? job.skills : [];
  if (!force && existing.length > 0) return existing;

  const skills = await extractSkills(job);

  try {
    // Use raw update through the model so JSON column write semantics are right
    // and any associations / hooks remain untouched.
    const { ExternalJob } = require('../models');
    // Stamp the ATTEMPT even when nothing was extracted. Previously an empty
    // result wrote nothing at all, which left the row indistinguishable from
    // "never tried" — so every backfill pass re-picked the same unextractable
    // jobs and paid for them again, and the sweep could never finish.
    const patch = { skillsExtractedAt: new Date() };
    if (skills.length > 0) patch.skills = skills;
    await ExternalJob.update(patch, { where: { id: job.id }, hooks: false });
  } catch (err) {
    console.warn(`[SkillExtract] Failed to persist skills for ${job.id}:`, err.message);
    return existing;
  }
  return skills.length > 0 ? skills : existing;
}

// ─── Background backfill ─────────────────────────────────────────────────────
//
// WHY THIS EXISTS
// Skill extraction used to happen ONLY inline during syncBoard, fire-and-forget,
// with unbounded concurrency across every new job in a board. During a discovery
// sweep that meant thousands of simultaneous Haiku calls; most were rate-limited
// or dropped, every failure was swallowed by a bare `.catch(() => fail++)`, and
// nothing ever revisited the job. The result measured in production: only ~10% of
// jobs posted this week had skills, 0% of older ones, and `react` appeared on 60
// of 71,815 jobs — which silently broke the ?skills= filter and the skill
// typeahead, since both read a column that is almost always empty.
//
// This replaces that with the same self-healing pattern the embedding backfill
// uses: a small, bounded, single-flight batch on an interval, newest jobs first,
// resumable across restarts, with a circuit breaker so an outage doesn't hammer
// a dead dependency. Extraction at ingest is removed in favour of this — one
// rate-limited path instead of a thundering herd during sync.
let _skillBackfillInFlight = false;
let _skillBackfillSkipUntil = 0;
let _skillBackfillOutages = 0;
const SKILL_OUTAGE_BASE_BACKOFF_MS = 5 * 60 * 1000;
const SKILL_OUTAGE_MAX_BACKOFF_MS = 60 * 60 * 1000;
const SKILL_DB_BACKOFF_MS = 60 * 1000;

async function backfillMissingJobSkills({ limit = 25, concurrency = 3 } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return { attempted: 0, extracted: 0, skipped: 'no-key' };
  if (_skillBackfillInFlight) return { attempted: 0, extracted: 0, skipped: 'in-flight' };
  if (Date.now() < _skillBackfillSkipUntil) return { attempted: 0, extracted: 0, skipped: 'backoff' };
  _skillBackfillInFlight = true;

  const sequelize = require('../config/database');
  try {
    let rows;
    try {
      // Newest first — those are the jobs users actually see. The partial index
      // external_jobs_skills_pending_idx covers this predicate exactly, so the
      // probe stays cheap once the backlog is drained.
      rows = await sequelize.query(
        `SELECT id, title, company, department, "experienceLevel", requirements, description, skills
           FROM "ExternalJobs"
          WHERE "isActive" = true AND "skillsExtractedAt" IS NULL
          ORDER BY COALESCE("postedAt", "createdAt") DESC
          LIMIT $1`,
        { bind: [limit], type: sequelize.constructor.QueryTypes.SELECT }
      );
    } catch (dbErr) {
      // Includes the case where skillsExtractedAt doesn't exist yet because the
      // background schema guard hasn't finished — back off briefly and retry.
      _skillBackfillSkipUntil = Date.now() + SKILL_DB_BACKOFF_MS;
      return { attempted: 0, extracted: 0, skipped: 'db-error', error: dbErr.message };
    }
    if (!rows.length) { _skillBackfillOutages = 0; return { attempted: 0, extracted: 0 }; }

    let extracted = 0;
    let failed = 0;
    let idx = 0;
    const worker = async () => {
      while (idx < rows.length) {
        const job = rows[idx++];
        try {
          const out = await extractAndPersist(job);
          if (Array.isArray(out) && out.length > 0) extracted++;
        } catch {
          failed++;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, rows.length) }, worker)
    );

    // Every single job in the batch failing is the signature of the API being
    // unreachable or the key being rejected, not of unextractable postings.
    if (extracted === 0 && failed === rows.length) {
      _skillBackfillOutages++;
      const backoff = Math.min(
        SKILL_OUTAGE_BASE_BACKOFF_MS * 2 ** (_skillBackfillOutages - 1),
        SKILL_OUTAGE_MAX_BACKOFF_MS
      );
      _skillBackfillSkipUntil = Date.now() + backoff;
      console.warn(`[SkillBackfill] whole batch failed — backing off ${Math.round(backoff / 60000)}m`);
    } else {
      _skillBackfillOutages = 0;
    }

    return { attempted: rows.length, extracted, failed };
  } finally {
    _skillBackfillInFlight = false;
  }
}

/** Remaining work, for the health endpoint / ops visibility. */
async function countPendingSkillExtraction() {
  const sequelize = require('../config/database');
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int AS pending
       FROM "ExternalJobs"
      WHERE "isActive" = true AND "skillsExtractedAt" IS NULL`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );
  return row?.pending ?? 0;
}

module.exports = {
  extractSkills,
  extractAndPersist,
  backfillMissingJobSkills,
  countPendingSkillExtraction,
};
