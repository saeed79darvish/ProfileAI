/**
 * "Common for this role": interview questions suggested for a role (and, when the person tailored a
 * resume for a job, that job's keywords and requirements), in three kinds: behavioral, technical
 * (knowledge and coding, grouped by area such as JavaScript or React) and system design.
 *
 * They are NOT reported by candidates, and the page says so. They are written once per prep and kind
 * and kept on the shared prep; a job's own keywords only change the cache key, never what is stored
 * about the person. The model is injected (runModel) so tests never touch the network.
 */
const crypto = require('crypto');
const { parseModelJson } = require('./interviewPrepService');
const { isRealQuestion } = require('./interviewPracticeService');

const TYPES = ['behavioral', 'technical', 'system_design'];
const COUNTS = { behavioral: 8, technical: 10, system_design: 6 };

/** Prose only: no em or en dashes, no arrow glyphs. */
function prose(value, max) {
  const t = String(value == null ? '' : value)
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*(?:<?-{2,}>|[←-⇿⟵-⟿⬀-⯿])\s*/g, ' ')
    .replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  return max ? t.slice(0, max).trim() : t;
}
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** What a tailored resume says about its job: the keywords and requirements, nothing about the person. */
function jobSignal(tailoredData) {
  const d = tailoredData && typeof tailoredData === 'object' ? tailoredData : {};
  const keywords = (Array.isArray(d._jobKeywords) ? d._jobKeywords : []).map((k) => prose(k, 40)).filter(Boolean).slice(0, 15);
  const requirements = (Array.isArray(d.requirementCoverage) ? d.requirementCoverage : [])
    .map((r) => prose(r && r.requirement, 160)).filter(Boolean).slice(0, 10);
  return { keywords, requirements };
}

/** A short stable key for a job signal, so the same job reuses the same suggestions. '' when there is none. */
function signalKey(signal) {
  const s = signal && (signal.keywords.length || signal.requirements.length) ? JSON.stringify([signal.keywords, signal.requirements]) : '';
  return s ? crypto.createHash('sha1').update(s).digest('hex').slice(0, 8) : '';
}

const SYSTEMS = {
  behavioral: `You are an interview coach. Suggest behavioral interview questions that are commonly asked for this role and level. Cover different themes (ownership, conflict, leading others, failure, impact, ambiguity). Each "area" is the theme in two or three words.`,
  technical: `You are an interview coach. Suggest technical interview questions commonly asked for this role and level: a mix of knowledge questions a person answers out loud ("What is the virtual DOM?") and coding tasks ("Implement a debounce function"). Group them by area that fits the role, for example for a frontend role: JavaScript, React, TypeScript, CSS and layout, Browser and performance, Testing; for a backend role: APIs, Databases, Concurrency, Testing. "area" is one of those, two or three words. "kind" is "code" for a coding task and "spoken" for a question answered out loud.`,
  system_design: `You are an interview coach. Suggest system design questions commonly asked for this role and level, sized to the level (a senior or staff person gets broader systems). Each "area" is the kind of system in two or three words, for example Frontend architecture, APIs and data, Scale and performance.`,
};

function buildPrompt({ prep, type, signal, existing }) {
  const role = prose(prep.role, 120) || 'software engineer';
  const company = prose(prep.company, 120);
  const level = prose(prep.level, 40);
  const lines = [`Role: ${role}${level ? `, level: ${level}` : ''}${company ? `, at ${company}` : ' (across companies)'}`];
  if (signal && signal.keywords.length) lines.push(`Technologies the job names: ${signal.keywords.join(', ')}`);
  if (signal && signal.requirements.length) lines.push(`Requirements in the job posting:\n- ${signal.requirements.join('\n- ')}`);
  if (existing.length) lines.push(`Already reported by candidates (do not repeat these):\n- ${existing.slice(0, 15).join('\n- ')}`);
  lines.push(`Write ${COUNTS[type]} questions.`);
  return lines.join('\n');
}

const SYSTEM_TAIL = `
Rules: each question is one real question or task a person could be asked, at most 220 characters. No invented facts about any company. No arrow characters, no em dashes, no markdown.
Return ONLY JSON: {"questions":[{"text":"","area":"","kind":"spoken"}]}`;

/** Questions cleaned: real questions only, no repeats of what was reported, ids that are safe in a URL. */
function cleanSuggested(parsed, { type, key, existing = [] }) {
  const list = parsed && Array.isArray(parsed.questions) ? parsed.questions : [];
  const seen = new Set(existing.map(norm));
  const out = [];
  for (const q of list) {
    const text = prose(q && q.text, 240);
    if (!text || !isRealQuestion(text) || seen.has(norm(text))) continue;
    seen.add(norm(text));
    const kind = type === 'technical' && q && q.kind === 'code' ? 'code' : 'spoken';
    out.push({ id: `sg-${type.replace('_', '')}-${key || 'role'}-${out.length + 1}`, text, area: prose(q && q.area, 40) || 'General', kind });
    if (out.length >= COUNTS[type]) break;
  }
  return out;
}

async function suggestQuestions({ prep = {}, type, signal = null, runModel }) {
  if (!TYPES.includes(type)) return [];
  const key = signalKey(signal);
  const existing = (Array.isArray(prep.questions) ? prep.questions : []).map((q) => q && q.text).filter(Boolean);
  let parsed = null;
  try { parsed = parseModelJson(await runModel({ system: SYSTEMS[type] + SYSTEM_TAIL, prompt: buildPrompt({ prep, type, signal, existing }), maxTokens: 1800 })); } catch { parsed = null; }
  return cleanSuggested(parsed, { type, key, existing });
}

/** Where a type's suggestions live on the prep payload. */
const cacheKey = (type, signal) => `${type}|${signalKey(signal) || 'role'}`;

/** Every suggested question stored on a prep payload, flat (to find one by id). */
function allSuggested(payload) {
  const s = payload && payload.suggested && typeof payload.suggested === 'object' ? payload.suggested : {};
  return Object.values(s).flat().filter((q) => q && typeof q.id === 'string');
}

module.exports = { TYPES, COUNTS, jobSignal, signalKey, suggestQuestions, cleanSuggested, cacheKey, allSuggested };
