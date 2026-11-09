/**
 * Pure helpers for the Questions page: two lists of the same research (newest first, and
 * most reported), a "say it out loud or write code" filter, and where each question goes to practice.
 */
import { filterQuestions, shortMonthYear, reportedBy } from './prepLogic.js';
import { questionKind } from './codeLogic.js';
import { focusScore } from './targeting.js';

export const TABS = [
  { id: 'recent', label: 'Recently reported' },
  { id: 'common', label: 'Common for this role' },
  { id: 'resume', label: 'About your resume' },
];
export const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'spoken', label: 'Say it out loud' },
  { id: 'code', label: 'Write code' },
];
const MAX_LIST = 12;
const time = (q) => { const t = q.mostRecent ? Date.parse(q.mostRecent) : NaN; return Number.isFinite(t) ? t : null; };
const count = (q) => (Array.isArray(q.sourceIds) ? q.sourceIds.length : 0);

/** The questions candidates really were asked, each tagged with how to practice it. */
export function allQuestions(prep) {
  return filterQuestions(prep && prep.questions, 'all').map((q) => ({ ...q, kind: questionKind(q) }));
}

/** Dated questions, newest first. Questions with no date are left out of this list. */
export function recentQuestions(prep, kind = 'all') {
  return applyKind(allQuestions(prep).filter((q) => time(q) !== null).sort((a, b) => time(b) - time(a) || count(b) - count(a)), kind).slice(0, MAX_LIST);
}

/** Most reported first. Among equally reported ones, those that match what the person is aiming at come first. */
export function commonQuestions(prep, focus = null, kind = 'all') {
  const list = allQuestions(prep).map((q, i) => ({ q, i, n: count(q), hit: focusScore(q.text, focus) }));
  list.sort((a, b) => b.n - a.n || b.hit - a.hit || a.i - b.i);
  return applyKind(list.map((e) => e.q), kind).slice(0, MAX_LIST);
}

export function applyKind(list, kind) {
  return kind === 'spoken' || kind === 'code' ? list.filter((q) => q.kind === kind) : list;
}

/** The tab to open first: recent when anything has a date, else common. */
export function defaultTab(prep) {
  return allQuestions(prep).some((q) => time(q) !== null) ? 'recent' : 'common';
}

/** Counts for the tab labels (unfiltered). */
export function tabCounts(prep) {
  return { recent: recentQuestions(prep).length, common: commonQuestions(prep).length };
}

/** "Reported Oct 2026 · 2 sources", or just "2 sources" when there is no date. */
export function questionMeta(q) {
  const when = shortMonthYear(q && q.mostRecent);
  const by = reportedBy(q).replace('Reported by ', '');
  return [when ? `Reported ${when}` : '', by].filter(Boolean).join(' · ');
}

/** Where practicing a question goes: the code editor for code questions, the voice coach for the rest. */
export function practiceRoute(prepId, q) {
  if (q && q.kind === 'code') return { path: `/interview-prep/code/${prepId}?question=${encodeURIComponent(q.text)}`, state: undefined, label: 'Practice this in the code editor' };
  return { path: `/interview-prep/practice/${prepId}`, state: { only: { text: q.text, kind: q.fromResume ? 'resume' : 'reported' } }, label: 'Practice this out loud' };
}

/** The "how to prepare" points already saved on the prep for a question id, or []. */
export function savedNotes(prep, id) {
  const n = prep && prep.preparation && prep.preparation[id];
  return Array.isArray(n) ? n.filter((x) => typeof x === 'string' && x.trim()) : [];
}

/** Resume probes as question cards: only those with a question text. */
export function probeCards(probes) {
  return (Array.isArray(probes) ? probes : [])
    .filter((p) => p && typeof p.question === 'string' && p.question.trim())
    .map((p, i) => ({ id: `r${i + 1}`, text: p.question.trim(), why: typeof p.why === 'string' ? p.why : '', basedOn: typeof p.basedOn === 'string' ? p.basedOn : '', kind: 'spoken', fromResume: true }));
}
