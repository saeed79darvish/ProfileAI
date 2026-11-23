/* ApplyPilot v2 · one place that turns raw queue rows into the
   plain-language buckets every screen shares, so Dashboard, Review and
   Sent can never disagree about where an application belongs. */

const CODE_RE = /verification code|security code|8-character|email code|enter the code/i;
const CHECK_RE = /captcha|security check|human|bot detect|cloudflare|challenge/i;
// The sender couldn't tell whether the form was submitted (timeout, crash).
const UNKNOWN_RE = /couldn.t confirm whether/i;

// Legal statements and personal circumstances: only the user answers these
// (mirrors backend/services/ats/sensitiveQuestions.js).
const SENSITIVE_RE = /debar|excluded by|\boig\b|sanction|convicted|conviction|felony|misdemeanor|criminal|pleaded guilty|arrest|family|relative|spouse|domestic partner|related to (anyone|someone|a current|an employee)|conflict of interest|government (official|employee)|politically exposed|non-?compete|non-?solicit|restrictive covenant|terminated|dismissed|fired from|asked to resign|security clearance|background check|drug (test|screen)|days a week|in the office|on-?site requirement|in-office requirement/i;
export const isSensitiveQuestion = (q) => SENSITIVE_RE.test(String(q || ''));

export function bucketOf(row) {
  const db = row?.dbStatus || row?.status;
  const err = String(row?.submissionError || '');
  if (db === 'rejected') return 'skipped';
  if (db === 'submitted') return 'sent';
  if (db === 'approved' || db === 'submitting') return 'applying';
  if (db === 'needs_attention' || db === 'failed' || db === 'error') {
    if (UNKNOWN_RE.test(err)) return 'unknown';
    if (CODE_RE.test(err)) return 'code';
    if (CHECK_RE.test(err) || db === 'failed' || db === 'error') return 'blocked';
    return 'question';
  }
  if (db === 'prepared') return 'ready';
  return 'preparing'; // scouting | pending | preparing
}

/* Can ApplyPilot submit this one itself? Greenhouse (including company
   careers pages that carry a gh_jid, which the backend maps to
   Greenhouse's hosted form), Lever and Ashby: yes. Everything else
   (Workday needs an account, Amazon needs a login, job boards link out)
   is finished by the user on the company's site. */
const AUTO_HOST_RE = /(greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)/i;
export function canAutoSend(row) {
  const url = String(row?.applicationUrl || row?.jobUrl || '');
  const provider = String(row?.atsProvider || '').toLowerCase();
  return AUTO_HOST_RE.test(url) || /[?&]gh_jid=/.test(url) || ['greenhouse', 'lever', 'ashby'].includes(provider);
}

export const REVIEW_BUCKETS = new Set(['question', 'ready', 'preparing']);
export const SENT_BUCKETS = new Set(['applying', 'code', 'blocked', 'unknown', 'sent']);
export const NEEDS_YOU = new Set(['question', 'code', 'blocked', 'unknown']);

export function splitQueue(queue) {
  const rows = Array.isArray(queue) ? queue : [];
  const by = { ready: [], preparing: [], question: [], code: [], blocked: [], unknown: [], applying: [], sent: [], skipped: [] };
  rows.forEach((r) => { by[bucketOf(r)].push(r); });
  return by;
}

export function scoutedTime(row) {
  return row?.scoutedAt || row?.updatedAt || null;
}

/* Rows the scout created for the same role at the same company in
   different locations are shown once, as "N locations". */
export function groupSameRole(rows) {
  const out = [];
  const seen = new Map();
  rows.forEach((r) => {
    const k = `${String(r.company || '').toLowerCase()}|${String(r.role || '').toLowerCase()}`;
    if (seen.has(k)) { seen.get(k).others.push(r); return; }
    const g = { ...r, others: [] };
    seen.set(k, g);
    out.push(g);
  });
  return out;
}

export function needsText(row) {
  const b = bucketOf(row);
  const err = String(row?.submissionError || '').trim();
  if (b === 'unknown') return { title: `${row.company}: did it go through?`, why: 'We couldn\u2019t confirm the result. Check your email for a confirmation, then tell us.', cta: 'Tell us', to: `/applypilot/sent/${row.id}` };
  if (b === 'code') return { title: `${row.company}: enter the email code`, why: 'The job site emailed you a code to confirm it’s you. Enter it to finish sending.', cta: 'Enter code', to: `/applypilot/sent/${row.id}` };
  if (b === 'blocked') return { title: `${row.company}: couldn’t finish sending`, why: err ? shorten(err) : 'The site stopped the application. Try again or finish it on their site.', cta: 'Fix it', to: `/applypilot/sent/${row.id}` };
  return { title: `${row.company}: a question only you can answer`, why: err ? shorten(err) : 'The form asks something your profile doesn’t say.', cta: 'Answer', to: `/applypilot/review/${row.id}` };
}

function shorten(s) {
  const t = s.replace(/\s+/g, ' ');
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}
