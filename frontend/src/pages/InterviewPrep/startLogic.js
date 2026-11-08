/**
 * Pure helpers for the Interview prep start page and the prep-id mode of the prep page.
 */
import { monthYear } from './prepLogic.js';

export const LEVELS = [
  { id: 'intern', label: 'Intern' },
  { id: 'junior', label: 'Junior' },
  { id: 'mid', label: 'Mid' },
  { id: 'senior', label: 'Senior' },
  { id: 'staff', label: 'Staff' },
  { id: 'principal', label: 'Principal' },
  { id: 'manager', label: 'Manager' },
];
export const DEFAULT_LEVEL = 'senior';

const str = (v) => String(v == null ? '' : typeof v === 'object' ? '' : v).trim();

/** Display label for a level id, '' when unknown. */
export function levelLabel(id) {
  const k = str(id).toLowerCase();
  return LEVELS.find((l) => l.id === k)?.label || '';
}

/** Map free text from the parser ("Senior", "sr", "Staff Engineer") to a level id, '' when nothing fits. */
export function normalizeLevel(raw) {
  const t = str(raw).toLowerCase();
  if (!t) return '';
  const exact = LEVELS.find((l) => l.id === t || l.label.toLowerCase() === t);
  if (exact) return exact.id;
  if (/\b(intern|internship)\b/.test(t)) return 'intern';
  if (/\b(principal|distinguished)\b/.test(t)) return 'principal';
  if (/\bstaff\b/.test(t)) return 'staff';
  if (/\b(manager|director|head of|lead)\b/.test(t)) return 'manager';
  if (/\b(senior|sr)\b/.test(t)) return 'senior';
  if (/\b(junior|jr|entry|graduate|associate)\b/.test(t)) return 'junior';
  if (/\b(mid|middle|intermediate)\b/.test(t)) return 'mid';
  return '';
}

/** Only paid plans (and admins) get research, the same rule as the tab card on the resume page. */
export function isPaidUser(user) {
  return ['pro', 'pro_plus'].includes(user?.subscriptionTier) || user?.role === 'admin';
}

/** The "I have a job" box: whether it holds a link or a description. Returns { ok, url, text, error }. */
export function validateJobInput(input) {
  const v = str(input);
  if (!v) return { ok: false, error: 'Paste a job link or the job description first.' };
  const isLink = /^https?:\/\/\S+$/i.test(v);
  if (!isLink && v.length < 40) return { ok: false, error: 'That is a bit short. Paste the full job description, or a link to the job.' };
  return isLink ? { ok: true, url: v, text: '' } : { ok: true, url: '', text: v };
}

/** The parse-job request body for validated input. */
export function parseJobBody(check) {
  return check.url ? { url: check.url } : { text: check.text };
}

/** Make the parsed job safe for the confirm card: strings only, level as an id. */
export function normalizeJob(job) {
  const j = job && typeof job === 'object' ? job : {};
  return {
    company: str(j.company),
    role: str(j.jobTitle || j.role),
    level: normalizeLevel(j.level),
    summary: str(j.summary),
    source: j.source === 'link' ? 'link' : 'text',
  };
}

/** Confirm card: company is required, so is the role. Returns { ok, errors }. */
export function validateConfirm(f) {
  const errors = {};
  if (!str(f?.company)) errors.company = 'Add the company so we can research it.';
  if (!str(f?.role)) errors.role = 'Add the role.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** POST body for starting from a confirmed job. */
export function jobStartBody(f, source) {
  const body = { company: str(f.company), jobTitle: str(f.role), source: source === 'link' ? 'link' : 'text' };
  const level = normalizeLevel(f.level);
  if (level) body.level = level;
  return body;
}

/** Role-level form: role and level are required, company is optional. */
export function validateRoleForm(f) {
  const errors = {};
  if (!str(f?.role)) errors.role = 'Tell us the role, for example Full stack frontend developer.';
  if (!normalizeLevel(f?.level)) errors.level = 'Pick a level.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** POST body for a role-level prep. Company stays '' when none was given. */
export function roleStartBody(f) {
  return { company: str(f.company), jobTitle: str(f.role), level: normalizeLevel(f.level), source: 'role' };
}

/** Tailored resume rows for the picker: company, title, date. Newest first, active only. */
export function tailoredRows(list) {
  const items = Array.isArray(list) ? list : [];
  return items
    .filter((tp) => tp && tp.id && tp.isActive !== false)
    .map((tp) => ({
      id: tp.id,
      company: str(tp.companyName || tp.sourceMeta?.company || tp.tailoredData?.company),
      title: str(tp.jobTitle),
      date: tp.createdAt || tp.updatedAt || null,
    }))
    .filter((r) => r.company || r.title)
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

/** One "Your preps" row. */
export function prepRow(p) {
  const scopeRole = p?.scope === 'role';
  const role = str(p?.role);
  const company = str(p?.company);
  const title = scopeRole || !company ? role || 'Interview prep' : company;
  const sub = [];
  if (!scopeRole && company && role) sub.push(role);
  if (scopeRole) {
    sub.push('Across companies');
    const lv = levelLabel(p?.level);
    if (lv) sub.push(lv);
  }
  const when = monthYear(p?.generatedAt);
  const n = Number.isFinite(Number(p?.storyCount)) ? Number(p.storyCount) : 0;
  return {
    id: p?.id,
    title,
    sub: sub.join(', '),
    researched: when ? `Researched ${when}` : '',
    stories: `${n} ${n === 1 ? 'story' : 'stories'}`,
    pending: p?.status === 'pending',
  };
}

/** Preps worth listing: they need an id; newest activity first. */
export function prepRows(list) {
  const items = (Array.isArray(list) ? list : []).filter((p) => p && p.id);
  const t = (p) => Date.parse(p.lastOpenedAt || p.generatedAt) || 0;
  return items.slice().sort((a, b) => t(b) - t(a)).map(prepRow);
}

/**
 * What an API failure means for the UI.
 * kinds: unreadable | upgrade | limit | unavailable | invalid | failed
 */
export function apiErrorState(e) {
  const status = e?.response?.status;
  const d = e?.response?.data || {};
  const message = str(d.message || d.error);
  if (status === 422 && d.code === 'unreadable') return { kind: 'unreadable', message: message || 'We could not read that job. Paste the job description instead.' };
  if (status === 503 && d.code === 'search_not_configured') return { kind: 'unavailable', message: '' };
  if ([403, 429].includes(status) && (d.upgradeRequired || d.code === 'upgrade_required' || d.feature === 'interview_prep')) {
    return { kind: d.upgradeRequired || d.code === 'upgrade_required' ? 'upgrade' : 'limit', message: '' };
  }
  if (status === 400) return { kind: 'invalid', message: message || 'Please check the details and try again.' };
  return { kind: 'failed', message };
}

/** The prep page runs in prep id mode when the route has :prepId and no :tailoredId. */
export function isPrepIdMode(params) {
  return Boolean(params?.prepId) && !params?.tailoredId;
}

/** Heading for a loaded prep in prep id mode. */
export function prepHeading(prep) {
  const company = str(prep?.company);
  const role = str(prep?.role);
  const acrossCompanies = prep?.scope === 'role' || !company;
  return {
    title: acrossCompanies ? (role ? `Interview prep: ${role}` : 'Interview prep') : `Interview prep: ${company}`,
    role: acrossCompanies ? '' : role,
    acrossCompanies,
  };
}

/** Body for the Refresh research call in prep id mode. */
export function refreshBody(prep) {
  const body = { company: str(prep?.company), jobTitle: str(prep?.role), refresh: true };
  const level = normalizeLevel(prep?.level);
  if (level) body.level = level;
  if (prep?.scope === 'role') body.source = 'role';
  return body;
}
