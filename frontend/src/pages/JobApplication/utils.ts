// Utils for JobApplication
import { MONTH_MAP } from './constants';

/**
 * Parse a date string like "January 2023" or "2023" into YYYY-MM-DD format.
 */
export const parseDateFromPeriod = (periodStr: string | null | undefined): string => {
  if (!periodStr) return '';

  const str = periodStr.trim();

  // Try to match "Month Year" format
  const monthYearMatch = str.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{4})$/i
  );
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    const year = monthYearMatch[2];
    return `${year}-${month}-01`;
  }

  // Try to match just year
  const yearMatch = str.match(/^(\d{4})$/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return '';
};

/**
 * Parse a period string like "Jan 2020 - Present" into start/end dates and current flag.
 */
export const parsePeriodDates = (
  period: string | null | undefined
): { startDate: string; endDate: string; current: boolean } => {
  if (!period) return { startDate: '', endDate: '', current: false };

  const lowerPeriod = period.toLowerCase();
  const isCurrent =
    lowerPeriod.includes('present') ||
    lowerPeriod.includes('current') ||
    lowerPeriod.includes('now');

  const parts = period.split(/\s*[-–—to]+\s*/i).map(p => p.trim());

  let startDate = '';
  let endDate = '';

  if (parts.length >= 1) {
    startDate = parseDateFromPeriod(parts[0]);
  }
  if (parts.length >= 2 && !isCurrent) {
    endDate = parseDateFromPeriod(parts[1]);
  }

  return { startDate, endDate, current: isCurrent };
};
