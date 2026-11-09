/**
 * Pure helpers for Code practice: which questions belong in the editor, the editor's Tab key,
 * and the saved attempts. Nothing here runs the candidate's code.
 */
import { isRealQuestion } from './prepLogic.js';

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C#' },
  { id: 'other', label: 'Other' },
];
export const MIN_CODE = 10;
export const MAX_CODE = 8000;

const CODE_VERBS = /^(write|implement|code|build|create|reverse|merge|sort|given|find|solve|convert|flatten|debounce|throttle|parse|validate|compute|count|remove|add|detect|check|return|fix|refactor|optimi[sz]e)\b/i;
const EXPLAIN = /^(what|why|how|when|where|which|who|can you explain|explain|describe|tell|walk|compare|difference|do you|have you|talk)\b/i;

/** 'code' when the question is answered by writing code; everything you can say out loud is 'spoken'. Mirrors the server. */
export function questionKind(q) {
  const text = String((q && q.text) || '').replace(/\s+/g, ' ').trim();
  const category = q && q.category;
  if (category === 'behavioral' || category === 'system_design') return 'spoken';
  if (CODE_VERBS.test(text)) return 'code';
  if (EXPLAIN.test(text)) return 'spoken';
  return category === 'coding' ? 'code' : 'spoken';
}

/** The prep's coding questions, as {id, text}, in the server's order. */
export function codeQuestions(prep) {
  const seen = new Set();
  const out = [];
  for (const q of Array.isArray(prep && prep.questions) ? prep.questions : []) {
    if (!q || typeof q.text !== 'string' || !isRealQuestion(q.text) || questionKind(q) !== 'code') continue;
    const text = q.text.replace(/\s+/g, ' ').replace(/\s*\((?:reported|asked|seen|mentioned)[^)]*\)\s*\.?\s*$/i, '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `c${out.length + 1}`, text });
  }
  return out;
}

/** Tab inserts two spaces instead of leaving the editor. Returns the new value and caret, or null for any other key. */
export function applyTab(value, start, end, shift = false) {
  const v = String(value ?? '');
  const s = Math.max(0, Math.min(start ?? 0, v.length));
  const e = Math.max(s, Math.min(end ?? s, v.length));
  if (!shift) return { value: `${v.slice(0, s)}  ${v.slice(e)}`, start: s + 2, end: s + 2 };
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;
  if (v.slice(lineStart, lineStart + 2) === '  ') {
    return { value: v.slice(0, lineStart) + v.slice(lineStart + 2), start: Math.max(lineStart, s - 2), end: Math.max(lineStart, e - 2) };
  }
  return { value: v, start: s, end: e };
}

export const canReview = (question, code) => String(question || '').trim().length > 0 && String(code || '').trim().length >= MIN_CODE;

export const reviewBody = ({ question, language, code }) => ({
  question: String(question || '').trim().slice(0, 400),
  language: LANGUAGES.some((l) => l.id === language) ? language : 'javascript',
  code: String(code || '').slice(0, MAX_CODE),
});

const VERDICTS = {
  strong: { label: 'Strong answer', bg: '#e5f6ec', fg: '#1f7a49' },
  good: { label: 'Good start', bg: '#e8f0ff', fg: '#2a56b8' },
  needs_work: { label: 'Needs work', bg: '#fdf1e4', fg: '#8a4a08' },
};
export const verdictTag = (v) => VERDICTS[v] || VERDICTS.good;

const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

/** A saved attempt as the page shows it. Anything malformed becomes an empty review, never a crash. */
export function cleanAttempt(a) {
  if (!a || typeof a !== 'object' || typeof a.code !== 'string') return null;
  const r = a.review && typeof a.review === 'object' ? a.review : {};
  return {
    id: String(a.id || ''),
    question: String(a.question || ''),
    language: LANGUAGES.some((l) => l.id === a.language) ? a.language : 'javascript',
    code: a.code,
    createdAt: a.createdAt || null,
    review: {
      verdict: r.verdict, summary: String(r.summary || ''), worked: strs(r.worked),
      issues: (Array.isArray(r.issues) ? r.issues : []).filter((i) => i && typeof i.what === 'string' && i.what).map((i) => ({ what: i.what, fix: String(i.fix || '') })),
      complexity: String(r.complexity || ''), tips: strs(r.tips), improved: String(r.improved || ''),
    },
  };
}

export const cleanAttempts = (list) => (Array.isArray(list) ? list.map(cleanAttempt).filter(Boolean) : []);

/** Attempts for one question, newest first (the server's order). */
export const attemptsFor = (attempts, question) => {
  const key = String(question || '').trim().toLowerCase();
  return (Array.isArray(attempts) ? attempts : []).filter((a) => a.question.trim().toLowerCase() === key);
};

/** "3 attempts" / "1 attempt". */
export const attemptsLabel = (n) => `${n} ${n === 1 ? 'attempt' : 'attempts'}`;

/** Copy for a failed review request. */
export function reviewError(e) {
  const status = e?.response?.status;
  const d = e?.response?.data || {};
  if (status === 403 && (d.code === 'upgrade_required' || d.upgradeRequired)) return { kind: 'upgrade', title: 'Code practice is part of Pro', body: 'Pro and Pro Plus review your code like an interviewer would, and keep every attempt.', plans: true };
  if (status === 429) return { kind: 'limit', title: 'You have used this month’s reviews', body: typeof d.message === 'string' && d.message ? d.message : 'Your allowance renews next month. Pro Plus includes more.', plans: true };
  if (status === 400) return { kind: 'invalid', title: 'Write a little more first', body: typeof d.message === 'string' && d.message ? d.message : 'Add some code, then ask for a review.', plans: false };
  return { kind: 'failed', title: 'We could not review that', body: typeof d.message === 'string' && d.message ? d.message : 'Something went wrong. Please try again.', plans: false };
}
