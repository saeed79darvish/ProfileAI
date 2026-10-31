// "They just signed in or signed up", for the profile page to open on the
// jobs that fit them (OnboardingMatches).
//
// Set wherever a session is created rather than passed through navigate():
// there are five ways in (email, Google and LinkedIn, on sign-in and on
// sign-up) and each navigates on its own. Short-lived, so a sign-in that
// went to a job link instead of the profile does not pop up on a visit an
// hour later.

const FRESH_SIGN_IN_KEY = 'profileai_fresh_sign_in';
const MAX_AGE_MS = 15 * 60 * 1000;

export function markFreshSignIn() {
  try {
    localStorage.setItem(FRESH_SIGN_IN_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: no pop-up this time.
  }
}

/** True once per sign-in: reading it clears it. */
export function takeFreshSignIn() {
  try {
    const at = Number(localStorage.getItem(FRESH_SIGN_IN_KEY));
    localStorage.removeItem(FRESH_SIGN_IN_KEY);
    return Number.isFinite(at) && at > 0 && Date.now() - at < MAX_AGE_MS;
  } catch {
    return false;
  }
}
