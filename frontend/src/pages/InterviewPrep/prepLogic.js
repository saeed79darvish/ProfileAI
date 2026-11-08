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
export const POLL_LIMIT_MS = 240000;

/** True once polling has run past the limit. */
export const pollExpired = (startedAt, now = Date.now()) => now - startedAt >= POLL_LIMIT_MS;

/** How many of the four progress lines show as done after `elapsedMs` of waiting. */
export function progressStep(elapsedMs, lines = 4) {
  return Math.max(0, Math.min(lines - 1, Math.floor(elapsedMs / 25000)));
}

/** A likely company name from a job link on a common job board ("job-boards.greenhouse.io/glean/jobs/1" gives "Glean"), else "". */
export function companyFromUrl(url) {
  let u;
  try { u = new URL(url); } catch { return ''; }
  const host = u.hostname.toLowerCase();
  const first = u.pathname.split('/').filter(Boolean)[0] || '';
  let slug = '';
  if (/(^|\.)greenhouse\.io$|(^|\.)lever\.co$|(^|\.)ashbyhq\.com$|(^|\.)workable\.com$/.test(host)) slug = first;
  else if (/\.myworkdayjobs\.com$/.test(host)) slug = host.split('.')[0];
  slug = slug.replace(/[^a-z0-9-]/g, '');
  if (!slug || /^(jobs?|careers?|embed|apply|j|v1)$/.test(slug)) return '';
  return slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Discussion links from the API: only objects with a title and a safe http link. */
export function cleanDiscussions(list) {
  return (Array.isArray(list) ? list : [])
    .map((d) => ({ title: String(d?.title || '').trim(), url: String(d?.url || ''), site: String(d?.site || ''), date: d?.date || null, href: safeUrl(d?.url) }))
    .filter((d) => d.title && d.href)
    .slice(0, 6);
}

/** Colors for the small category tag on a question. Unknown categories get the neutral "Other" tag. */
const TAGS = {
  coding: { label: 'Coding', bg: '#e8f0ff', fg: '#2a56b8' },
  system_design: { label: 'System design', bg: '#efe8ff', fg: '#5b34b8' },
  behavioral: { label: 'Behavioral', bg: '#e5f6ec', fg: '#1f7a49' },
  role_specific: { label: 'Role specific', bg: '#fdf1e4', fg: '#8a4a08' },
  other: { label: 'Other', bg: '#ecedf3', fg: '#3b3e52' },
};
export function categoryTag(category) {
  return TAGS[KNOWN.has(category) ? category : 'other'];
}

/** "Oct 2026", or '' when the date is missing or invalid. */
export function shortMonthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Label for a source pill: "teamblind.com, Oct 2026" style, using the site (or title) and a short date. */
export function sourcePillLabel(s) {
  return [s?.site || s?.title, shortMonthYear(s?.date)].filter(Boolean).join(' · ');
}

/** The coverage chip in the header. Anything but thin or none counts as good. */
export function coverageChip(coverage) {
  return coverage === 'thin' || coverage === 'none'
    ? { label: 'Limited coverage', bg: '#fdf1e4', fg: '#8a4a08' }
    : { label: 'Good coverage', bg: '#e5f6ec', fg: '#1f7a49' };
}

/** First letter of the company, upper case, or '?'. */
export function companyInitial(name) {
  const m = String(name || '').trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

const LOGO_COLORS = ['#635bff', '#0f766e', '#c2410c', '#1d4ed8', '#9333ea', '#be185d', '#15803d', '#b45309'];
/** A stable logo square color for a company name. */
export function logoColor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LOGO_COLORS[h % LOGO_COLORS.length];
}

/** Which round is selected: the given index when valid, else the first. */
export function selectStep(rounds, index) {
  const n = Array.isArray(rounds) ? rounds.length : 0;
  return Number.isInteger(index) && index >= 0 && index < n ? index : 0;
}

/** Next step index for a key press in the stepper, or null when the key is not a stepper key. */
export function stepKeyTarget(key, index, count) {
  if (!(count > 0)) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** "Reported by N sources" for a round, from its sourceIds. */
export function roundReportedBy(r) {
  return reportedBy(r);
}

/** Questions to show now: the first `limit` unless everything is expanded. */
export function visibleQuestions(list, showAll, limit = 6) {
  const arr = Array.isArray(list) ? list : [];
  return showAll || arr.length <= limit ? arr : arr.slice(0, limit);
}

/** Label for the show more button, or '' when there is nothing more. */
export function showMoreLabel(total, shown) {
  const rest = Math.max(0, (total || 0) - (shown || 0));
  return rest ? `Show ${rest} more ${rest === 1 ? 'question' : 'questions'}` : '';
}

export const GAP_MARKER = 'Not in your profile:';

/** A resume probe is a gap when its basedOn starts with the gap marker. */
export function isGapProbe(p) {
  return typeof p?.basedOn === 'string' && p.basedOn.trim().toLowerCase().startsWith(GAP_MARKER.toLowerCase());
}

/** The basedOn text without the gap marker. */
export function gapDetail(basedOn) {
  const t = String(basedOn || '').trim();
  return t.toLowerCase().startsWith(GAP_MARKER.toLowerCase()) ? t.slice(GAP_MARKER.length).trim() : t;
}

/** Small site badge for a discussion, from its link host (falls back to the site text). */
export function discussionBadge(d) {
  let host = '';
  try { host = new URL(d?.href || d?.url).hostname.toLowerCase(); } catch { host = String(d?.site || '').toLowerCase(); }
  const is = (name) => host === name || host.endsWith(`.${name}`) || host.includes(name);
  if (is('reddit.com') || is('redd.it')) return { label: 'Reddit', bg: '#fff0e8', fg: '#b4430a' };
  if (is('leetcode.com') || is('leetcode.cn')) return { label: 'LeetCode', bg: '#fdf1e4', fg: '#8a4a08' };
  if (is('teamblind.com') || is('blind')) return { label: 'Blind', bg: '#e8f0ff', fg: '#2a56b8' };
  const bare = host.replace(/^www\./, '').split('.').filter(Boolean);
  const name = bare.length > 1 ? bare[bare.length - 2] : bare[0] || 'Web';
  return { label: name.charAt(0).toUpperCase() + name.slice(1), bg: '#ecedf3', fg: '#3b3e52' };
}

/**
 * The four plan steps for the right rail. `storyCount` is null until the stories section has reported,
 * in which case no story text is shown. Only research counts as done; the rest are the candidate's to do.
 */
export function planProgress({ sourceCount = 0, questionCount = 0, probeCount = 0, storyCount = null } = {}) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const q = [questionCount > 0 ? `${questionCount} reported` : '', probeCount > 0 ? `${probeCount} about your resume` : ''].filter(Boolean).join(', ');
  const steps = [
    { id: 'research', title: 'Research', detail: `${plural(sourceCount, 'source', 'sources')} read`, done: true },
    { id: 'questions', title: 'Look through the questions', detail: q, done: false },
    { id: 'stories', title: 'Build your stories', detail: Number.isInteger(storyCount) ? (storyCount ? `${storyCount} saved so far` : 'None saved yet') : '', done: false },
    { id: 'practice', title: 'Practice out loud', detail: 'Rehearse with the voice coach', done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, percent: Math.round((doneCount / steps.length) * 100) };
}

/** Saved stories as safe rows for the rail: only objects with a string title or theme. */
export function storyRows(stories) {
  if (!Array.isArray(stories)) return [];
  return stories
    .filter((s) => s && typeof s === 'object')
    .map((s, i) => ({ key: String(s.id ?? i), title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : 'Your story', theme: typeof s.theme === 'string' ? s.theme : '' }));
}
