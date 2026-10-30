// The jobs the coach showed a guest at the end of the conversation, kept so
// the first screen after sign-up opens on those same jobs, now scored,
// instead of a different list. See OnboardingMatches.
//
// localStorage for the same reason as coachReturn: the trip runs through
// sign-up, OAuth and sometimes an email link in a new tab. It expires so a
// list from an abandoned attempt does not greet someone days later.

const COACH_PICKS_KEY = 'profileai_coach_picks';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function setCoachPicks(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) return;
  try {
    localStorage.setItem(COACH_PICKS_KEY, JSON.stringify({ jobs, at: Date.now() }));
  } catch {
    // Storage unavailable: the pop-up shows the feed's matches, as before.
  }
}

/** The saved picks, once: reading them clears them. */
export function takeCoachPicks() {
  try {
    const raw = localStorage.getItem(COACH_PICKS_KEY);
    localStorage.removeItem(COACH_PICKS_KEY);
    const { jobs, at } = JSON.parse(raw || 'null') || {};
    if (!Array.isArray(jobs) || !jobs.length || Date.now() - at > MAX_AGE_MS) return [];
    return jobs.filter((j) => j && j.id && j.title);
  } catch {
    return [];
  }
}
