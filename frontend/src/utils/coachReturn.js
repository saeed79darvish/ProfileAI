// Where to land once a profile built in the coach is published. Set by an
// entry point that sent someone to the coach for a reason (a job's AI tools),
// so they come back to that job, now scored, instead of their portfolio.
//
// localStorage rather than a URL param: the trip runs through sign-up, OAuth
// and sometimes an email link in a new tab. It expires so an abandoned
// attempt does not hijack a profile finished days later from somewhere else.

import { safeRedirect } from './safeRedirect.js';

const COACH_RETURN_KEY = 'profileai_coach_return';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Only short plain strings travel with the destination: it is shown back to
 *  the person in the coach, so it is bounded and never trusted as markup. */
const cleanMeta = (meta) => {
  if (!meta || typeof meta !== 'object') return undefined;
  const text = (v) => (typeof v === 'string' ? v.trim().slice(0, 120) : '');
  const title = text(meta.title);
  if (!title) return undefined;
  return { title, company: text(meta.company), tailor: meta.tailor === true };
};

/** Where a job opens in the jobs board, optionally straight into tailoring.
 *  The board reads these params for a signed-in visitor, so this is the same
 *  link the job-match digest email uses. */
export function jobReturnPath(jobId, { tailor = false } = {}) {
  return `/jobs?externalJobId=${encodeURIComponent(jobId)}${tailor ? '&tailor=1' : ''}`;
}

/** `meta` ({ title, company, tailor }) lets the coach say which job is waiting. */
export function setCoachReturn(path, meta) {
  const safe = safeRedirect(path);
  if (!safe) return;
  try {
    localStorage.setItem(COACH_RETURN_KEY, JSON.stringify({ path: safe, at: Date.now(), meta: cleanMeta(meta) }));
  } catch {
    // Storage unavailable: they land on their portfolio, as before.
  }
}

/** The job waiting for this person, without clearing it. */
export function peekCoachReturnMeta() {
  try {
    const { path, at, meta } = JSON.parse(localStorage.getItem(COACH_RETURN_KEY) || 'null') || {};
    if (!path || Date.now() - at > MAX_AGE_MS) return null;
    return cleanMeta(meta) || null;
  } catch {
    return null;
  }
}

/** The saved destination, once: reading it clears it. */
export function takeCoachReturn() {
  try {
    const raw = localStorage.getItem(COACH_RETURN_KEY);
    localStorage.removeItem(COACH_RETURN_KEY);
    const { path, at } = JSON.parse(raw || 'null') || {};
    if (!path || Date.now() - at > MAX_AGE_MS) return null;
    return safeRedirect(path);
  } catch {
    return null;
  }
}
