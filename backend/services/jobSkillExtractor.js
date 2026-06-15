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
  const arr = safeParseJSON(raw, null) || extractJsonArray(raw);
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
  if (skills.length === 0) return existing;

  try {
    // Use raw update through the model so JSON column write semantics are right
    // and any associations / hooks remain untouched.
    const { ExternalJob } = require('../models');
    await ExternalJob.update(
      { skills },
      { where: { id: job.id }, hooks: false }
    );
  } catch (err) {
    console.warn(`[SkillExtract] Failed to persist skills for ${job.id}:`, err.message);
    return existing;
  }
  return skills;
}

module.exports = {
  extractSkills,
  extractAndPersist,
};
