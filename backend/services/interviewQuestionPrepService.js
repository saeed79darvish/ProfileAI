/**
 * "How to prepare" for one reported interview question: three short, concrete points a person can act on.
 * Generic to the question and role (not to a person), so it is written once and kept on the shared prep.
 * The model is injected (runModel) so tests never touch the network.
 */
const { parseModelJson } = require('./interviewPrepService');

/** Prose only: no em or en dashes, no arrow glyphs. */
function prose(value, max) {
  const t = String(value == null ? '' : value)
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*(?:<?-{2,}>|[←-⇿⟵-⟿⬀-⯿])\s*/g, ' ')
    .replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  return max ? t.slice(0, max).trim() : t;
}

const SYSTEM = `You are an interview coach. You get one interview question that candidates reported, and the role it was reported for. Write exactly 3 short points on how to prepare to answer it well.
Each point is one plain sentence of at most 150 characters, concrete and actionable: what to know, what to say or show, what to avoid. For a coding question, say what to write first and what to mention out loud. For a behavioral question, say what kind of story to pick and what to end on.
Rules: no invented facts about any company, no statistics, no arrow characters, no em dashes, no markdown.
Return ONLY JSON: {"prepare":["...","...","..."]}`;

/** Three cleaned points, or an empty list when the model gave nothing usable. */
function cleanPrepare(parsed) {
  const list = parsed && Array.isArray(parsed.prepare) ? parsed.prepare : [];
  return list.map((p) => prose(typeof p === 'string' ? p : '', 200)).filter((p) => p.length >= 10).slice(0, 3);
}

async function prepareQuestion({ prep = {}, question, runModel }) {
  const text = prose(question && question.text, 400);
  if (!text) return [];
  const role = prose(prep.role, 120);
  const company = prose(prep.company, 120);
  const prompt = `Role: ${role || 'software role'}${company ? ` at ${company}` : ''}\nQuestion: ${text}`;
  let parsed = null;
  try { parsed = parseModelJson(await runModel({ system: SYSTEM, prompt, maxTokens: 600 })); } catch { parsed = null; }
  return cleanPrepare(parsed);
}

module.exports = { prepareQuestion, cleanPrepare };
