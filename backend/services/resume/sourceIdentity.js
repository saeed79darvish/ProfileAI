/**
 * Who a resume belongs to, and which role is which.
 *
 * Two failures this module exists for:
 *
 *  1. The uploaded resume text stored on an account can be a different person's
 *     (a sample resume from testing) or an old career. Tailoring treats that
 *     text as the source of truth, so the model returned another history and
 *     the candidate's real roles were merged into it. `resumeMatchesProfile`
 *     compares the employers named in the text with the structured profile and
 *     rejects text that does not describe the same career.
 *
 *  2. Roles were paired with the model's draft by array position. Position says
 *     nothing about which job a bullet belongs to. `sameCompany` pairs them by
 *     employer, and `periodOf` supplies dates from the profile.
 */

const SUFFIXES = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|the|group|holdings)\b/g;

/** "Amazon Web Services, Inc." -> "amazon web services" */
const companyKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9. ]+/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const initials = (key) => key.split(' ').filter(Boolean).map((w) => w[0]).join('');

/**
 * Do two employer names refer to the same company? Equal after cleanup, one
 * starting with the other ("Amazon" / "Amazon AWS"), or an acronym of the
 * other ("RH" / "Restoration Hardware").
 */
function sameCompany(a, b) {
  const x = companyKey(a), y = companyKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 3 && (long === short || long.startsWith(`${short} `))) return true;
  if (short.length >= 2 && short.length <= 5 && !short.includes(' ') && initials(long) === short) return true;
  return false;
}

/** Does the resume text mention this employer? */
function textMentionsCompany(text, company) {
  const hay = String(text || '').toLowerCase();
  const key = companyKey(company);
  if (!key) return false;
  const re = new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
  if (re.test(hay)) return true;
  // First word alone ("Amazon" for "Amazon AWS"), when it is distinctive.
  const first = key.split(' ')[0];
  if (first.length >= 4 && new RegExp(`(^|[^a-z0-9])${first}([^a-z0-9]|$)`).test(hay)) return true;
  // Acronym spelled out in the text ("RH" -> "Restoration Hardware").
  if (key.length >= 2 && key.length <= 5 && !key.includes(' ')) {
    const words = hay.match(/[a-z0-9]+/g) || [];
    for (let i = 0; i + key.length <= words.length; i++) {
      if (words.slice(i, i + key.length).map((w) => w[0]).join('') === key) return true;
    }
  }
  return false;
}

/**
 * Does this resume text describe the same career as the structured profile?
 * Passes when enough of the profile's employers appear in the text. A profile
 * with no employers has nothing to contradict the text, so it passes.
 *
 * @returns {{ matches: boolean, matched: string[], missing: string[] }}
 */
function resumeMatchesProfile(text, profile, { minShare = 0.34 } = {}) {
  const companies = (Array.isArray(profile && profile.experience) ? profile.experience : [])
    .map((e) => e && e.company)
    .filter((c) => c && String(c).trim());
  if (!companies.length) return { matches: true, matched: [], missing: [] };
  const matched = companies.filter((c) => textMentionsCompany(text, c));
  const missing = companies.filter((c) => !matched.includes(c));
  const share = matched.length / companies.length;
  return { matches: matched.length > 0 && share >= minShare, matched, missing };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-04-01" or "April 2025" -> "Apr 2025"; anything else is returned as written. */
function formatDate(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  let m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${MONTHS[Math.min(11, Math.max(0, Number(m[2]) - 1))]} ${m[1]}`;
  m = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/);
  if (m) {
    const idx = MONTHS.findIndex((mo) => m[1].toLowerCase().startsWith(mo.toLowerCase()));
    if (idx >= 0) return `${MONTHS[idx]} ${m[2]}`;
  }
  return v;
}

/** The dates of a profile role, from the profile only. Empty when it has none. */
function periodOf(role) {
  const o = role || {};
  if (o.period && String(o.period).trim()) return String(o.period).trim();
  if (o.duration && String(o.duration).trim()) return String(o.duration).trim();
  const start = formatDate(o.startDate);
  if (!start) return '';
  const end = o.current ? 'Present' : formatDate(o.endDate);
  return end ? `${start} - ${end}` : start;
}

module.exports = { sameCompany, companyKey, textMentionsCompany, resumeMatchesProfile, periodOf, formatDate };
