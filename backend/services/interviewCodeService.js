/**
 * Code practice for an interview prep: the candidate writes an answer to a coding question in a
 * plain editor (nothing is run) and gets a review: what worked, what to fix, an improved version.
 * The model is injected (runModel) so tests never touch the network.
 *
 * Honesty rules live in the prompt and in code: the review never claims the code was run, prose
 * fields are cleaned of dashes and arrows, but the improved code is left exactly as written
 * because "=>" and "->" are real syntax.
 */
const { parseModelJson } = require('./interviewPrepService');

const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'csharp', 'other'];
const MAX_CODE_CHARS = 8000;
const MIN_CODE_CHARS = 10;
const VERDICTS = ['strong', 'good', 'needs_work'];

const DASH_RE = /\s*[—–]\s*/g;
const ARROW_RE = /\s*(?:<?-{2,}>|[←-⇿⟵-⟿⬀-⯿])\s*/g;
/** Prose only: no em or en dashes, no arrow glyphs. Never used on code. */
function prose(value, max) {
  const t = String(value == null ? '' : value).replace(DASH_RE, ', ').replace(ARROW_RE, ' ').replace(/,\s*,/g, ',').replace(/[ \t]{2,}/g, ' ').trim();
  return max ? t.slice(0, max).trim() : t;
}

const cleanLanguage = (v) => (LANGUAGES.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'javascript');

/** The code the candidate typed, trimmed of trailing space and capped, or '' when there is too little to review. */
function cleanCode(code) {
  const t = String(code == null ? '' : code).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/^\n+|\s+$/g, '');
  return t.length < MIN_CODE_CHARS ? '' : t.slice(0, MAX_CODE_CHARS);
}

const SYSTEM = `You are a senior engineer reviewing a candidate's answer to an interview coding question. The candidate typed the code in a plain editor. It was NOT run, so never say it passed or failed tests; reason about it by reading it.
Judge: does it solve the question, is it correct on normal input and on edge cases (empty input, one item, duplicates, very large input), time and space complexity, naming and clarity. Be specific and kind: quote the line or name the variable you mean.
Rules:
- Base every point on the code you were given. Do not invent requirements.
- "improved" is a complete, working version in the same language that keeps the candidate's approach and style where it was sound, and fixes what you listed. If their code is already strong, return it with only small clarity edits.
- No arrow characters and no em dashes in any text field. (Code may use => and ->.)
- Keep it short: at most 3 items in "worked", 4 in "issues", 3 in "tips".
Return ONLY JSON: {"verdict":"strong|good|needs_work","summary":"two sentences","worked":["..."],"issues":[{"what":"the problem, naming the line or case","fix":"how to fix it"}],"complexity":"one sentence on time and space","tips":["one thing to say out loud or practice next"],"improved":"the full improved code"}`;

function cleanReview(parsed, fallbackCode = '') {
  const p = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  if (!p) return null;
  const list = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => prose(typeof x === 'string' ? x : '', max)).filter(Boolean).slice(0, n);
  const issues = (Array.isArray(p.issues) ? p.issues : []).map((i) => ({
    what: prose(i && i.what, 300), fix: prose(i && i.fix, 400),
  })).filter((i) => i.what).slice(0, 4);
  const summary = prose(p.summary, 500);
  if (!summary && !issues.length) return null;
  const improved = typeof p.improved === 'string' ? p.improved.replace(/\r\n/g, '\n').replace(/^```[a-z]*\n?|\n?```$/gi, '').trimEnd().slice(0, MAX_CODE_CHARS) : '';
  return {
    verdict: VERDICTS.includes(p.verdict) ? p.verdict : 'good',
    summary,
    worked: list(p.worked, 3, 300),
    issues,
    complexity: prose(p.complexity, 300),
    tips: list(p.tips, 3, 300),
    improved: improved || fallbackCode,
  };
}

/** Reviews one answer. Throws {status: 422} when the model gives nothing usable. */
async function reviewCode({ prep = {}, question, language, code, runModel }) {
  const lang = cleanLanguage(language);
  const q = prose(question, 400);
  const src = cleanCode(code);
  if (!q) { const e = new Error('A question is required.'); e.status = 400; e.code = 'invalid_request'; throw e; }
  if (!src) { const e = new Error('Write some code first.'); e.status = 400; e.code = 'invalid_request'; throw e; }
  const role = prose(prep.role, 120);
  const company = prose(prep.company, 120);
  const prompt = [
    `Interview target: ${role || 'a software role'}${company ? ` at ${company}` : ''}.`,
    `Question: ${q}`,
    `Language: ${lang}`,
    'Candidate code:',
    '```',
    src,
    '```',
  ].join('\n');
  let parsed = null;
  try { parsed = parseModelJson(await runModel({ system: SYSTEM, prompt, maxTokens: 3500 })); } catch { parsed = null; }
  const review = cleanReview(parsed, src);
  if (!review) { const e = new Error('We could not review that just now. Please try again.'); e.status = 422; e.code = 'review_failed'; throw e; }
  return { review, language: lang, code: src, question: q };
}

module.exports = { reviewCode, cleanReview, cleanCode, cleanLanguage, LANGUAGES, MAX_CODE_CHARS };
