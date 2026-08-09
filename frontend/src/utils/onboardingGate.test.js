import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isOnboardingAllowedPath,
  shouldBlockNavigation,
  onboardingBlockMessageFor,
  isVerificationExemptPath,
} from './onboardingGate.js';

// ── isOnboardingAllowedPath ──────────────────────────────────────────────────

test('isOnboardingAllowedPath: /profile is allowed (Dashboard self-fetches profile)', () => {
  // Regression lock for the cold-load redirect bug: PrivateRoute must NOT
  // bounce a candidate off /profile based on stale user.hasProfile.
  // Dashboard fetches the actual profile from the server on mount and
  // redirects on a confirmed 404 itself.
  assert.equal(isOnboardingAllowedPath('/profile'), true);
});

test('isOnboardingAllowedPath: /profile/edit is allowed (ProfileForm self-fetches profile)', () => {
  assert.equal(isOnboardingAllowedPath('/profile/edit'), true);
});

test('isOnboardingAllowedPath: existing onboarding-flow paths still allowed', () => {
  assert.equal(isOnboardingAllowedPath('/profile/create'), true);
  assert.equal(isOnboardingAllowedPath('/profile/create-form'), true);
  assert.equal(isOnboardingAllowedPath('/profile/preferences'), true);
  assert.equal(isOnboardingAllowedPath('/onboarding'), true);
  assert.equal(isOnboardingAllowedPath('/check-email'), true);
  assert.equal(isOnboardingAllowedPath('/verify-email'), true);
});

test('isOnboardingAllowedPath: legal pages are allowed', () => {
  assert.equal(isOnboardingAllowedPath('/terms'), true);
  assert.equal(isOnboardingAllowedPath('/privacy'), true);
});

test('isOnboardingAllowedPath: jobs browsing is allowed; apply flow is gated', () => {
  assert.equal(isOnboardingAllowedPath('/jobs'), true);
  assert.equal(isOnboardingAllowedPath('/jobs/abc123'), true);
  assert.equal(isOnboardingAllowedPath('/jobs/abc123/apply'), false);
});

test('isOnboardingAllowedPath: unrelated paths are gated', () => {
  assert.equal(isOnboardingAllowedPath('/feed'), false);
  assert.equal(isOnboardingAllowedPath('/settings'), false);
  assert.equal(isOnboardingAllowedPath('/admin'), false);
  assert.equal(isOnboardingAllowedPath('/recruiter/dashboard'), false);
});

test('isOnboardingAllowedPath: empty / null pathname returns false', () => {
  assert.equal(isOnboardingAllowedPath(''), false);
  assert.equal(isOnboardingAllowedPath(null), false);
  assert.equal(isOnboardingAllowedPath(undefined), false);
});

test('isOnboardingAllowedPath: /profile as an exact match does NOT leak to /profile/anything', () => {
  // EXACT_ALLOWED uses .includes() — but startsWith via ALLOWED_PREFIXES
  // could still match. Sanity-check that an unlisted sibling doesn't
  // accidentally bypass the gate.
  assert.equal(isOnboardingAllowedPath('/profile/something-unknown'), false);
});

// ── shouldBlockNavigation ────────────────────────────────────────────────────

test('shouldBlockNavigation: profile-less candidate visiting /profile is NOT blocked', () => {
  const user = { role: 'candidate', hasProfile: false };
  assert.equal(shouldBlockNavigation(user, '/profile'), false);
  assert.equal(shouldBlockNavigation(user, '/profile/edit'), false);
});

test('shouldBlockNavigation: profile-less candidate visiting /feed IS blocked', () => {
  const user = { role: 'candidate', hasProfile: false };
  assert.equal(shouldBlockNavigation(user, '/feed'), true);
});

test('shouldBlockNavigation: candidate with a profile is never blocked', () => {
  const user = { role: 'candidate', hasProfile: true };
  assert.equal(shouldBlockNavigation(user, '/feed'), false);
  assert.equal(shouldBlockNavigation(user, '/anywhere'), false);
});

test('shouldBlockNavigation: recruiters / admins are not gated', () => {
  assert.equal(shouldBlockNavigation({ role: 'recruiter', hasProfile: false }, '/feed'), false);
  assert.equal(shouldBlockNavigation({ role: 'admin', hasProfile: false }, '/admin'), false);
});

test('shouldBlockNavigation: missing user returns false (handled by separate auth check)', () => {
  assert.equal(shouldBlockNavigation(null, '/profile'), false);
  assert.equal(shouldBlockNavigation(undefined, '/feed'), false);
});

test('shouldBlockNavigation: hasProfile undefined still blocks gated paths', () => {
  // Stale localStorage from a pre-`hasProfile` build. The user may or may
  // not have a profile server-side; the destination decides. For gated
  // paths we still block — the dest could be anything (settings etc.).
  const user = { role: 'candidate', hasProfile: undefined };
  assert.equal(shouldBlockNavigation(user, '/feed'), true);
});

// ── onboardingBlockMessageFor ────────────────────────────────────────────────

test('onboardingBlockMessageFor: apply path gets the AI-tools framing', () => {
  const msg = onboardingBlockMessageFor('/jobs/abc/apply');
  assert.match(msg, /apply/i);
});

test('onboardingBlockMessageFor: arbitrary path gets the default copy', () => {
  const msg = onboardingBlockMessageFor('/feed');
  assert.match(msg, /finish creating your profile/i);
});

// ── isVerificationExemptPath ─────────────────────────────────────────────────

test('isVerificationExemptPath: profile-building and account paths are exempt', () => {
  assert.equal(isVerificationExemptPath('/profile'), true);
  assert.equal(isVerificationExemptPath('/profile/edit'), true);
  assert.equal(isVerificationExemptPath('/profile/create'), true);
  assert.equal(isVerificationExemptPath('/profile/create-form'), true);
  assert.equal(isVerificationExemptPath('/profile/preferences'), true);
  assert.equal(isVerificationExemptPath('/onboarding'), true);
  assert.equal(isVerificationExemptPath('/recruiter/onboarding'), true);
  assert.equal(isVerificationExemptPath('/recruiter/profile'), true);
  assert.equal(isVerificationExemptPath('/check-email'), true);
  assert.equal(isVerificationExemptPath('/verify-email/abc123'), true);
});

test('isVerificationExemptPath: jobs browsing is NOT exempt (backend /recommended still 403s)', () => {
  // Unlike isOnboardingAllowedPath, job browsing is deliberately excluded —
  // exempting the page but not the data it fetches would just move the
  // "verify your email" wall one click deeper instead of removing it.
  assert.equal(isVerificationExemptPath('/jobs'), false);
  assert.equal(isVerificationExemptPath('/jobs/abc123'), false);
  assert.equal(isVerificationExemptPath('/jobs/abc123/apply'), false);
});

test('isVerificationExemptPath: unrelated paths are gated', () => {
  assert.equal(isVerificationExemptPath('/feed'), false);
  assert.equal(isVerificationExemptPath('/recruiter/dashboard'), false);
  assert.equal(isVerificationExemptPath('/admin'), false);
});

test('isVerificationExemptPath: empty / null pathname returns false', () => {
  assert.equal(isVerificationExemptPath(''), false);
  assert.equal(isVerificationExemptPath(null), false);
  assert.equal(isVerificationExemptPath(undefined), false);
});
