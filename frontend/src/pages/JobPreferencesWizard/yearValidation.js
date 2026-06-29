/**
 * Year validation for the wizard's Education step.
 *
 * Education years in the wizard are free-text inputs (the editor uses an
 * <input type="month"> picker later). To prevent garbage like "abcd" or
 * "9999" from being persisted we require a 4-digit integer within a
 * candidate-plausible range, and enforce end >= start when both are set.
 *
 * Years are still optional — empty input is accepted at this layer; the
 * wizard's "Skip for now" affordance and the optional nature of the
 * Education step depend on that.
 */

// Lower bound: keeps things sane while still allowing late-career
// candidates' early education to fit comfortably.
export const MIN_YEAR = 1950;

// Upper bound: current year + this many. Big enough that long-track
// expected graduation dates (PhDs, part-time programs) still fit.
const FUTURE_YEARS_ALLOWED = 7;

/**
 * Maximum acceptable year given a clock. Parameterised on `now` so tests
 * are deterministic and don't break on Jan 1st.
 *
 * @param {Date} [now]
 */
export const getMaxYear = (now = new Date()) =>
  now.getFullYear() + FUTURE_YEARS_ALLOWED;

/**
 * Validate a single year value.
 *
 *  - Empty → '' (acceptable; education is optional).
 *  - Anything other than exactly 4 digits → "must be a 4-digit year".
 *  - Out of [MIN_YEAR, getMaxYear()] → "must be between …".
 *
 * @param {unknown} value
 * @param {{ fieldLabel?: string, now?: Date }} [opts]
 * @returns {string} error message for UI, or '' if acceptable
 */
export const validateYear = (value, opts = {}) => {
  const { fieldLabel = 'Year', now } = opts;
  const raw = (value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (!/^\d{4}$/.test(raw)) {
    return `${fieldLabel} must be a 4-digit year (e.g., 2024).`;
  }
  const year = parseInt(raw, 10);
  const max = getMaxYear(now);
  if (year < MIN_YEAR || year > max) {
    return `${fieldLabel} must be between ${MIN_YEAR} and ${max}.`;
  }
  return '';
};

/**
 * Cross-field rule: end year must be on or after start year when both are
 * present. The returned message is targeted at the END field; consumers
 * should surface it under the end year input.
 *
 * If either side fails the basic shape check, returns '' so the
 * per-field validator can own the messaging without duplicating it here.
 *
 * @param {unknown} startValue
 * @param {unknown} endValue
 * @returns {string}
 */
export const validateYearRange = (startValue, endValue) => {
  const start = (startValue == null ? '' : String(startValue)).trim();
  const end = (endValue == null ? '' : String(endValue)).trim();
  if (!start || !end) return '';
  if (!/^\d{4}$/.test(start) || !/^\d{4}$/.test(end)) return '';
  if (parseInt(end, 10) < parseInt(start, 10)) {
    return 'End year must be on or after start year.';
  }
  return '';
};
