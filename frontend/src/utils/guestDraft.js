// Client-side-only storage for a profile built before registering. Never
// sent to the server until the visitor signs up — per the deferred-
// registration design, we don't persist guest PII in Postgres, so an
// abandoned draft costs nothing to store and nothing to clean up.
//
// Versioned so a future formData shape change degrades gracefully (treated
// as "no draft") instead of crashing the builder for a returning guest with
// a stale-shaped blob in localStorage.

const GUEST_PROFILE_DRAFT_KEY = 'profileai_guest_profile_draft';
const DRAFT_VERSION = 1;

export function saveGuestProfileDraft(formData) {
  try {
    localStorage.setItem(GUEST_PROFILE_DRAFT_KEY, JSON.stringify({
      version: DRAFT_VERSION,
      formData,
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    // Storage unavailable (private browsing, quota) — the visitor's edits
    // stay in React state for the current session; just can't survive reload.
    return false;
  }
}

export function loadGuestProfileDraft() {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== DRAFT_VERSION || !parsed.formData) {
      // Unknown/older shape — don't try to reconcile it, just drop it.
      localStorage.removeItem(GUEST_PROFILE_DRAFT_KEY);
      return null;
    }
    return parsed.formData;
  } catch {
    return null;
  }
}

export function hasGuestProfileDraft() {
  return loadGuestProfileDraft() !== null;
}

export function clearGuestProfileDraft() {
  try {
    localStorage.removeItem(GUEST_PROFILE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
