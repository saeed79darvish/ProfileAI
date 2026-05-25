// Lightweight pub/sub used to surface a "finish your profile first" banner
// whenever a candidate without a completed profile tries to navigate away
// from the onboarding flow. Both Navbar (preemptive, on click) and
// PrivateRoute (defensive, on render) dispatch the same event so the banner
// shows up consistently no matter how the navigation was initiated.

export const ONBOARDING_GATE_EVENT = 'profileai:onboarding-gate-blocked';

// Paths the candidate is allowed to visit before finishing their profile.
// Keep this in sync with PrivateRoute.ONBOARDING_ALLOWED_PREFIXES.
// Plain `startsWith` so sibling paths like /profile/create-form and
// /profile/preferences (the rest of the profile-creation flow) are
// covered without having to list every variant.
const ALLOWED_PREFIXES = [
  '/profile/create',
  '/profile/create-form',
  '/profile/preferences',
  '/onboarding',
  '/check-email',
  '/verify-email',
  '/terms',
  '/privacy',
  '/logout',
];

export function isOnboardingAllowedPath(pathname) {
  if (!pathname) return false;
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function shouldBlockNavigation(user, targetPath) {
  if (!user) return false;
  if (user.role !== 'candidate') return false;
  if (user.hasProfile === true) return false;
  return !isOnboardingAllowedPath(targetPath);
}

export function notifyOnboardingBlocked(targetPath) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_GATE_EVENT, { detail: { targetPath } })
    );
  } catch {
    // CustomEvent unavailable (very old browsers) — silently ignore; the
    // redirect will still happen, the user just won't see the toast.
  }
}
