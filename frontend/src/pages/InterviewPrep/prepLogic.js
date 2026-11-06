/**
 * Pure helpers for the Interview prep page.
 */

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'coding', label: 'Coding' },
  { id: 'system_design', label: 'System design' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'role_specific', label: 'Role specific' },
];

const KNOWN = new Set(CATEGORIES.map((c) => c.id).filter((id) => id !== 'all'));

/** Questions in the given category; 'all' keeps everything. Order is the server's. */
export function filterQuestions(questions, category) {
  const list = Array.isArray(questions) ? questions.filter((q) => q && q.text) : [];
  if (!category || category === 'all') return list;
  return list.filter((q) => (KNOWN.has(q.category) ? q.category : 'other') === category);
}

/** How many questions each chip would show. */
export function categoryCounts(questions) {
  const out = { all: 0 };
  for (const c of CATEGORIES) out[c.id] = 0;
  for (const q of filterQuestions(questions, 'all')) {
    out.all += 1;
    const k = KNOWN.has(q.category) ? q.category : null;
    if (k) out[k] += 1;
  }
  return out;
}

/** "March 2026", or '' when the date is missing or invalid. */
export function monthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "Reported by 1 source" / "Reported by 3 sources". */
export function reportedBy(q) {
  const n = Array.isArray(q?.sourceIds) ? q.sourceIds.length : 0;
  return `Reported by ${n} ${n === 1 ? 'source' : 'sources'}`;
}

/** Sources behind a question, in the order of its sourceIds, skipping unknown ids. */
export function sourcesFor(ids, sources) {
  const byId = new Map((Array.isArray(sources) ? sources : []).map((s) => [s.id, s]));
  return (Array.isArray(ids) ? ids : []).map((id) => byId.get(id)).filter(Boolean);
}

/** Only http(s) links become anchors. */
export function safeUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Sort guard: newest first by mostRecent, then more sources; stable otherwise. Only for use when the server gave no order. */
export function sortGuard(questions) {
  const list = filterQuestions(questions, 'all');
  const t = (q) => { const x = q.mostRecent ? Date.parse(q.mostRecent) : NaN; return Number.isFinite(x) ? x : -Infinity; };
  return list
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (t(b.q) - t(a.q)) || ((b.q.sourceIds?.length || 0) - (a.q.sourceIds?.length || 0)) || a.i - b.i)
    .map((x) => x.q);
}

export const POLL_MS = 3000;
export const POLL_LIMIT_MS = 90000;

/** True once polling has run past the limit. */
export const pollExpired = (startedAt, now = Date.now()) => now - startedAt >= POLL_LIMIT_MS;

/** How many of the four progress lines show as done after `elapsedMs` of waiting. */
export function progressStep(elapsedMs, lines = 4) {
  return Math.max(0, Math.min(lines - 1, Math.floor(elapsedMs / 7000)));
}
