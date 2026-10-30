// Where to land once a profile built in the coach is published. Set by an
// entry point that sent someone to the coach for a reason (a job's AI tools),
// so they come back to that job, now scored, instead of their portfolio.
//
// localStorage rather than a URL param: the trip runs through sign-up, OAuth
// and sometimes an email link in a new tab. It expires so an abandoned
// attempt does not hijack a profile finished days later from somewhere else.

import { safeRedirect } from './safeRedirect';

const COACH_RETURN_KEY = 'profileai_coach_return';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function setCoachReturn(path) {
  const safe = safeRedirect(path);
  if (!safe) return;
  try {
    localStorage.setItem(COACH_RETURN_KEY, JSON.stringify({ path: safe, at: Date.now() }));
  } catch {
    // Storage unavailable: they land on their portfolio, as before.
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
