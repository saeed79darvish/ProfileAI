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

// True for the application flow (…/apply) — these stay gated so we can
// prompt the candidate to finish their profile before applying / using AI.
function isJobApplyPath(pathname) {
  return (
    !!pathname &&
    pathname.startsWith('/jobs/') &&
    pathname.endsWith('/apply')
  );
}

export function isOnboardingAllowedPath(pathname) {
  if (!pathname) return false;
  // Let profile-less candidates browse the public jobs list and individual
  // job detail pages before creating a profile. The application flow
  // (…/apply) stays gated so we can nudge them to finish their profile.
  if (pathname === '/jobs' || (pathname.startsWith('/jobs/') && !isJobApplyPath(pathname))) {
    return true;
  }
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

// Context-aware copy for the onboarding gate banner. Applying to a job or
// using the AI tools is what we really want a profile for, so spell out the
// benefit instead of a generic "finish your profile" message.
export function onboardingBlockMessageFor(pathname) {
  if (isJobApplyPath(pathname)) {
    return 'Create your profile to apply for this job and unlock AI analytics & Resume Tailoring tools for a personalized experience.';
  }
  return 'Please finish creating your profile before navigating to other pages.';
}

export function shouldBlockNavigation(user, targetPath) {
  if (!user) return false;
  if (user.role !== 'candidate') return false;
  if (user.hasProfile === true) return false;
  return !isOnboardingAllowedPath(targetPath);
}

export function notifyOnboardingBlocked(targetPath, message) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_GATE_EVENT, {
        detail: { targetPath, message: message || onboardingBlockMessageFor(targetPath) },
      })
    );
  } catch {
    // CustomEvent unavailable (very old browsers) — silently ignore; the
    // redirect will still happen, the user just won't see the toast.
  }
}
