/**
 * Remembers that the person left for a company's application page, so that
 * when they come back to this tab we can ask right away whether they applied.
 * Pure helpers plus guarded localStorage access; every call is safe to make
 * where storage is blocked.
 */
export const DEPARTURE_KEY = 'profilleai.applyDeparture';
export const MIN_AWAY_MS = 60 * 1000;
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function save({ applicationId = null, jobId = null, title = '', company = '', applyUrl = '', listQuery = '', at = Date.now() } = {}) {
  try {
    const value = { applicationId: applicationId || null, jobId: jobId || null, title, company, applyUrl, listQuery, at };
    localStorage.setItem(DEPARTURE_KEY, JSON.stringify(value));
    return value;
  } catch (_) {
    return null;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(DEPARTURE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || typeof d.at !== 'number') return null;
    return d;
  } catch (_) {
    return null;
  }
}

export function clear() {
  try { localStorage.removeItem(DEPARTURE_KEY); } catch (_) { /* ignore */ }
}

/**
 * True when the person was away at least a minute and the departure is under
 * six hours old. hiddenForMs is how long this page was hidden (null on a fresh
 * page load, where the time since `at` is used instead).
 */
export function shouldAskOnReturn(departure, now = Date.now(), hiddenForMs = null) {
  if (!departure || typeof departure.at !== 'number') return false;
  const age = now - departure.at;
  if (age < 0 || age >= MAX_AGE_MS) return false;
  const away = typeof hiddenForMs === 'number' ? hiddenForMs : age;
  return away >= MIN_AWAY_MS;
}
