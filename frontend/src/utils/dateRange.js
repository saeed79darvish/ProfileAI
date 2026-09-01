/**
 * Shared date helpers for Experience / Education / Project entries.
 *
 * The editor stores dates as ISO month strings ("YYYY-MM") for new entries,
 * but legacy data still includes free-text values like "May 2024", "2018",
 * "Jan 2015 - May 2018", or "Present". These helpers parse all three and
 * render a consistent output string.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const isPresentValue = (value) =>
  /^(present|current|now|ongoing)$/i.test(String(value || '').trim());

/** Convert any stored value to "YYYY-MM" suitable for <input type="month">. */
export const toIsoMonth = (value) => {
  if (!value) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (isPresentValue(s)) return '';
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // Full ISO date "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm..." → take the month prefix.
  const ymd = s.match(/^(\d{4})-(\d{2})-\d{2}(?:[T\s].*)?$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  // "YYYY/MM" or "YYYY/MM/DD"
  const slash = s.match(/^(\d{4})\/(\d{2})(?:\/\d{2})?$/);
  if (slash) return `${slash[1]}-${slash[2]}`;
  if (/^\d{4}$/.test(s)) return `${s}-01`;
  // "Jan 2024" / "January 2024"
  const m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === m[1].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
  }
  return '';
};

/** Format a single value as "MMM YYYY" (e.g. "Jan 2024"). Returns '' if unparsable. */
export const formatMonthYear = (value) => {
  if (!value) return '';
  if (isPresentValue(value)) return 'Present';

  // A bare year stays a bare year. This check has to come BEFORE toIsoMonth,
  // which maps "2022" to "2022-01" so that <input type="month"> has something
  // to show — correct for an input, wrong for display, because it renders as
  // "Jan 2022" and puts a month on the person's resume that they never gave.
  // (The unreachable copy of this check below the toIsoMonth call is what this
  // was originally trying to do.)
  const trimmed = String(value).trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  const iso = toIsoMonth(value);
  if (iso) {
    const [y, m] = iso.split('-');
    const idx = parseInt(m, 10) - 1;
    if (idx >= 0 && idx < 12) return `${MONTH_NAMES[idx]} ${y}`;
  }
  return trimmed;
};

/**
 * Format a start/end pair as "Jan 2015 – May 2018" (en-dash). Either side can
 * be empty; "Present"/missing end with start renders as "Jan 2024 – Present".
 */
export const formatDateRange = (startDate, endDate) => {
  const start = formatMonthYear(startDate);
  const end = isPresentValue(endDate) || (!endDate && start)
    ? 'Present'
    : formatMonthYear(endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
};

/**
 * Try to extract { startDate, endDate } from a legacy free-text "period" /
 * "year" string like "May 2024 - Present", "2015 - 2018", or "Jan 2020".
 * Returns null when the string can't be split confidently.
 */
export const parseLegacyPeriod = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Single year ("2018") becomes a one-off start year.
  if (/^\d{4}$/.test(s)) return { startDate: s, endDate: '' };

  // "Jan 2020" or "January 2020"
  if (/^[A-Za-z]+\s+\d{4}$/.test(s)) return { startDate: s, endDate: '' };

  // Range with separator: -, –, —, "to"
  const parts = s.split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length === 2) {
    const [a, b] = parts.map((p) => p.trim());
    return {
      startDate: a,
      endDate: isPresentValue(b) ? 'Present' : b,
    };
  }
  return null;
};
