/**
 * What the Tailored resumes page reads off a saved tailored copy: where the
 * application stands, the gaps still open, the strengths, and the versions
 * of the same job. Pure, so the list and the detail always agree.
 */

export const STATUSES = [
  { id: 'tailored', label: 'Tailored' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function companyOf(tp) {
  return String(tp?.companyName || tp?.sourceMeta?.company || tp?.tailoredData?.company || '').trim();
}

/** The stored status, else what the record already shows. */
export function statusOf(tp) {
  const td = tp?.tailoredData || {};
  if (STATUSES.some((s) => s.id === td.trackStatus)) return td.trackStatus;
  if (td.interviewPrep) return 'interview';
  if (tp?.sourceMeta?.submittedAt) return 'applied';
  return 'tailored';
}

/** "A long gap sentence. With advice" as a short title and the rest. */
function splitGap(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (t.length <= 60) return { title: t, note: '' };
  const m = t.match(/^(.{8,60}?)(?:\s[—–-]\s|:\s|\.\s|;\s)(.+)$/);
  if (m) return { title: m[1].replace(/[.:;]$/, ''), note: m[2] };
  return { title: `${t.slice(0, 57).replace(/\s+\S*$/, '')}…`, note: t };
}

/**
 * The gaps still open on this copy, each with a short title, a note and a
 * tag: required / preferred when the Tailor flow recorded it, otherwise
 * what the tailoring found (partly shown, or not on the resume).
 */
export function gapsOf(tp) {
  const td = tp?.tailoredData || {};
  const severity = new Map((Array.isArray(tp?.skillGaps) ? tp.skillGaps : [])
    .filter((g) => g && g.skill)
    .map((g) => [norm(g.skill), g.severity]));
  const raw = Array.isArray(td.genuineGaps) && td.genuineGaps.length
    ? td.genuineGaps.map((g) => ({ ...splitGap(g.requirement), note: g.note || '', status: g.status }))
    : (td.matchAnalysis?.gaps || []).map((g) => (typeof g === 'string'
      ? splitGap(g)
      : { ...splitGap(g.skill || g.requirement), note: g.note || g.reason || '' }));
  const seen = new Set();
  return raw
    .filter((g) => g.title && !seen.has(norm(g.title)) && seen.add(norm(g.title)))
    .map((g) => {
      const sev = severity.get(norm(g.title));
      const tag = sev === 'critical' ? 'required'
        : sev ? 'preferred'
          : g.status === 'partially met' ? 'partial' : 'missing';
      return { ...g, tag };
    })
    .sort((a, b) => TAG_ORDER[a.tag] - TAG_ORDER[b.tag]);
}

const TAG_ORDER = { required: 0, missing: 1, preferred: 2, partial: 3 };

export const TAG_LABEL = { required: 'Required', preferred: 'Preferred', partial: 'Partly shown', missing: 'Not on resume' };

/** One line for a card: the required gaps when known, else all of them. */
export function gapLine(tp) {
  const gaps = gapsOf(tp);
  const required = gaps.filter((g) => g.tag === 'required').length;
  if (required) return { text: `${required} required gap${required === 1 ? '' : 's'}`, tone: 'bad' };
  if (gaps.length) return { text: `${gaps.length} gap${gaps.length === 1 ? '' : 's'} to address`, tone: 'warn' };
  return { text: 'No gaps found', tone: 'good' };
}

export function strengthsOf(tp) {
  return (tp?.tailoredData?.matchAnalysis?.strongMatches || []).filter((s) => typeof s === 'string' && s.trim());
}

export function alsoInJobOf(tp) {
  return (tp?.tailoredData?.matchAnalysis?.skillsToConfirm || [])
    .filter((s) => typeof s === 'string' && s.trim() && s.length <= 40)
    .slice(0, 8);
}

/**
 * Re-tailoring the same job keeps every copy; the list shows one card per
 * job with its versions, newest first.
 */
export function groupVersions(items) {
  const groups = new Map();
  const sorted = [...(items || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const tp of sorted) {
    const key = `${norm(companyOf(tp))}|${norm(tp.jobTitle)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tp);
  }
  return [...groups.values()].map((versions) => ({ id: versions[0].id, latest: versions[0], versions }));
}

export const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

const TILE_COLORS = ['#1f2233', '#3b6ff5', '#13151f', '#0f766e', '#7c3aed', '#b45309', '#be123c'];
export function tileColor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}
