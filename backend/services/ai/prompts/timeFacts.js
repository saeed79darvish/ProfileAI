/**
 * timeFacts — dates and durations, worked out in code, for the coach prompts.
 *
 * None of the coach prompts used to say what today is, so the model filled
 * "2021 to now" in with its own sense of the present and told a five-year
 * engineer they had "about three years". Arithmetic on dates is exactly the
 * thing to keep out of a model: compute it here, hand over the numbers, and
 * tell it to quote them.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const isPresent = (value) => /^(present|current|now|ongoing|today)$/i.test(String(value || '').trim());

/** "2021", "2021-03", "2021-03-14", "Mar 2021", "March 2021" → { y, m } or null. */
const parseWhen = (value) => {
  const s = String(value || '').trim();
  if (!s) return null;
  let match = s.match(/^(\d{4})(?:[-/](\d{1,2}))?/);
  if (match) return { y: Number(match[1]), m: match[2] ? Number(match[2]) : null };
  match = s.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (match) {
    const idx = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase());
    return { y: Number(match[2]), m: idx >= 0 ? idx + 1 : null };
  }
  match = s.match(/\b(19|20)\d{2}\b/);
  return match ? { y: Number(match[0]), m: null } : null;
};

/**
 * Whole years between two dates, as a person would say it. With only years
 * known, 2021 to 2026 is five years — the honest reading of what they said.
 */
const yearsBetween = (from, to) => {
  if (!from || !to) return null;
  let years = to.y - from.y;
  if (from.m && to.m && to.m < from.m) years -= 1;
  return Math.max(0, years);
};

const today = (now = new Date()) => ({ y: now.getFullYear(), m: now.getMonth() + 1 });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The block every coach prompt carries. Includes today's date even when
 * there is nothing to compute, because "how long ago" questions come up in
 * conversation too.
 */
const timeFacts = (profile = {}, now = new Date()) => {
  const at = today(now);
  const lines = [`- Today is ${now.toISOString().slice(0, 10)}.`];

  for (const row of profile.experience || []) {
    if (!row) continue;
    const start = parseWhen(row.startDate);
    if (!start) continue;
    const ongoing = row.current || row.currentlyWorking || !row.endDate || isPresent(row.endDate);
    const end = ongoing ? at : parseWhen(row.endDate);
    const years = yearsBetween(start, end);
    if (years === null) continue;
    const name = [row.title, row.company].filter(Boolean).join(' at ') || 'a role';
    lines.push(`- ${name}: ${years < 1 ? 'under a year' : plural(years, 'year')}${ongoing ? ', and still there' : ''}.`);
  }

  for (const row of profile.education || []) {
    if (!row) continue;
    const end = parseWhen(row.endDate || row.graduationYear || row.year);
    if (!end || end.y > at.y) continue;
    const name = [row.degree, row.institution || row.school].filter(Boolean).join(', ') || 'their studies';
    lines.push(`- Finished ${name} in ${end.y}: ${plural(yearsBetween(end, at), 'year')} ago.`);
  }

  return `═══ DATES, ALREADY WORKED OUT ═══
${lines.join('\n')}
Quote these numbers exactly when you mention how long anything took or how long
ago it was. Never work a duration out yourself, and never round it.`;
};

module.exports = { timeFacts, parseWhen, yearsBetween };
