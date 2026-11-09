/**
 * Pure helpers for the Questions page. Questions are split by kind (behavioral, coding and technical,
 * system design) and each kind has two parts: what candidates reported for this role, and common
 * questions suggested for the role. Nothing here calls the network.
 */
import { filterQuestions, shortMonthYear, reportedBy } from './prepLogic.js';
import { questionKind } from './codeLogic.js';

export const TYPE_TABS = [
  { id: 'behavioral', label: 'Behavioral', about: 'Stories about how you work, decide and handle people.' },
  { id: 'technical', label: 'Coding and technical', about: 'Knowledge questions you answer out loud, and coding tasks you write.' },
  { id: 'system_design', label: 'System design', about: 'Design a system and talk through the trade-offs.' },
];
export const TABS = [...TYPE_TABS, { id: 'resume', label: 'About your resume' }];

const DESIGN = /^(design|architect)\b|\bhow would you (design|architect)\b|\bsystem design\b/i;
const time = (q) => { const t = q.mostRecent ? Date.parse(q.mostRecent) : NaN; return Number.isFinite(t) ? t : null; };
const count = (q) => (Array.isArray(q.sourceIds) ? q.sourceIds.length : 0);

/** 'behavioral', 'system_design' or 'technical' (everything else: coding, React, JavaScript, role knowledge). */
export function questionType(q) {
  if (q && q.category === 'behavioral') return 'behavioral';
  if (q && (q.category === 'system_design' || DESIGN.test(String(q.text || '').trim()))) return 'system_design';
  return 'technical';
}

/** Real questions from the research, each tagged with its type and how to practice it. */
export function allQuestions(prep) {
  return filterQuestions(prep && prep.questions, 'all').map((q) => ({ ...q, type: questionType(q), kind: questionKind(q) }));
}

/**
 * The research questions of one type. Newest first when any has a date, otherwise most reported first.
 * `order` says which, so the page can say so instead of promising dates it does not have.
 */
export function reportedByType(prep, type) {
  const list = allQuestions(prep).filter((q) => q.type === type);
  const dated = list.some((q) => time(q) !== null);
  const sorted = list.map((q, i) => ({ q, i })).sort((a, b) => (dated
    ? (time(b.q) ?? -Infinity) - (time(a.q) ?? -Infinity) || count(b.q) - count(a.q) || a.i - b.i
    : count(b.q) - count(a.q) || a.i - b.i)).map((e) => e.q);
  return { list: sorted, order: dated ? 'newest' : 'most' };
}

/** How many reported questions each type has. */
export function reportedCounts(prep) {
  const out = { behavioral: 0, technical: 0, system_design: 0 };
  for (const q of allQuestions(prep)) out[q.type] += 1;
  return out;
}

/** The tab to open first: the type with the most reported questions, behavioral on a tie, else coding and technical. */
export function defaultTypeTab(prep) {
  const c = reportedCounts(prep);
  const best = TYPE_TABS.map((t) => t.id).sort((a, b) => c[b] - c[a])[0];
  return c[best] > 0 ? best : 'technical';
}

/** "Reported Oct 2026 · 2 sources", or just "2 sources" when there is no date. */
export function questionMeta(q) {
  const when = shortMonthYear(q && q.mostRecent);
  const by = reportedBy(q).replace('Reported by ', '');
  return [when ? `Reported ${when}` : '', by].filter(Boolean).join(' · ');
}

/** Suggested questions as the page shows them. Anything without text or an id is dropped. */
export function suggestedCards(list) {
  return (Array.isArray(list) ? list : [])
    .filter((q) => q && typeof q.id === 'string' && q.id && typeof q.text === 'string' && q.text.trim())
    .map((q) => ({ id: q.id, text: q.text.trim(), area: typeof q.area === 'string' && q.area.trim() ? q.area.trim() : 'General', kind: q.kind === 'code' ? 'code' : 'spoken', suggested: true }));
}

/** The areas present in a list of suggested questions, in the order they first appear. */
export function areasOf(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((q) => q.area).filter(Boolean))];
}

/** One area's questions, or all of them. */
export function inArea(list, area) {
  return !area ? list : list.filter((q) => q.area === area);
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
