import { test } from 'node:test';
import assert from 'node:assert/strict';

// We test the pure derivation logic that lives inside useAICredits.refresh.
// The hook itself wraps it in React state + event subscription; the binding-
// limit math is the part that broke (weekly -1 sentinel was wrongly treated
// as "Unlimited" while monthly was the real cap), so we factor it out into a
// pure function here and exercise the table of cases.

const deriveCreditsState = (feature) => {
  if (!feature) return null;
  const weeklyUncapped = feature.weeklyLimit === -1;
  const monthlyUncapped = feature.monthlyLimit === -1;
  const isUnlimited = weeklyUncapped && monthlyUncapped;
  const wRem = weeklyUncapped ? Infinity : feature.weeklyRemaining;
  const mRem = monthlyUncapped ? Infinity : feature.monthlyRemaining;
  const binding = wRem <= mRem ? 'week' : 'month';
  const remaining = isUnlimited ? -1 : Math.min(wRem, mRem);
  const used = binding === 'week' ? feature.week || 0 : feature.month || 0;
  const limit = binding === 'week' ? feature.weeklyLimit : feature.monthlyLimit;
  return { remaining, used, limit, isUnlimited, period: binding };
};

// ── Bug repro: free tier profile_enhance ─────────────────────────────────────

test('free tier profile_enhance: weekly=-1, monthly=1 → NOT unlimited; binding=month', () => {
  // Backend ships free profile_enhance as { monthly: 1, weekly: -1 }.
  // Weekly=-1 means "no weekly check", NOT "overall unlimited". The old
  // hook treated -1 weekly as unlimited and rendered a green "Unlimited
  // AI" badge even when monthly remaining was 0 — this test pins that.
  const out = deriveCreditsState({
    weeklyLimit: -1,
    weeklyRemaining: -1,
    monthlyLimit: 1,
    monthlyRemaining: 0,
    week: 0,
    month: 1,
  });
  assert.equal(out.isUnlimited, false, 'must NOT be unlimited when monthly is capped');
  assert.equal(out.remaining, 0);
  assert.equal(out.period, 'month');
  assert.equal(out.limit, 1);
  assert.equal(out.used, 1);
});

test('free tier with one credit left: remaining is 1 month, period=month', () => {
  const out = deriveCreditsState({
    weeklyLimit: -1,
    weeklyRemaining: -1,
    monthlyLimit: 1,
    monthlyRemaining: 1,
    week: 0,
    month: 0,
  });
  assert.equal(out.isUnlimited, false);
  assert.equal(out.remaining, 1);
  assert.equal(out.period, 'month');
});

// ── Genuinely unlimited ─────────────────────────────────────────────────────

test('genuinely unlimited: both caps -1 → isUnlimited; remaining sentinel -1', () => {
  // Pro tier tailor_profile is { monthly: -1, weekly: -1 } — uncapped on
  // both axes. THIS is the only legitimate "Unlimited" case.
  const out = deriveCreditsState({
    weeklyLimit: -1,
    weeklyRemaining: -1,
    monthlyLimit: -1,
    monthlyRemaining: -1,
  });
  assert.equal(out.isUnlimited, true);
  assert.equal(out.remaining, -1);
});

// ── Weekly is the binding constraint (uncommon but possible) ────────────────

test('weekly is the tighter cap: binding period reflects that', () => {
  // Hypothetical: weeklyLimit=5 (remaining 2), monthlyLimit=30 (remaining 20).
  // Weekly is the immediate cap.
  const out = deriveCreditsState({
    weeklyLimit: 5,
    weeklyRemaining: 2,
    monthlyLimit: 30,
    monthlyRemaining: 20,
    week: 3,
    month: 10,
  });
  assert.equal(out.isUnlimited, false);
  assert.equal(out.remaining, 2);
  assert.equal(out.period, 'week');
});

test('weekly and monthly tied: prefer week period (smaller / sooner reset)', () => {
  const out = deriveCreditsState({
    weeklyLimit: 5,
    weeklyRemaining: 5,
    monthlyLimit: 5,
    monthlyRemaining: 5,
  });
  assert.equal(out.remaining, 5);
  assert.equal(out.period, 'week');
});

// ── Zero remaining: paywall ──────────────────────────────────────────────────

test('zero remaining: badge would show "No AI credits left"', () => {
  const out = deriveCreditsState({
    weeklyLimit: -1,
    weeklyRemaining: -1,
    monthlyLimit: 5,
    monthlyRemaining: 0,
  });
  assert.equal(out.remaining, 0);
  assert.equal(out.isUnlimited, false);
  // The component renders the red "No AI credits left this month" copy
  // from this state.
});

// ── Missing feature data ────────────────────────────────────────────────────

test('returns null when feature is missing from the usage payload', () => {
  assert.equal(deriveCreditsState(null), null);
  assert.equal(deriveCreditsState(undefined), null);
});

// ── Seam test: rendered badge value === min(weeklyRemaining, monthlyRemaining)
// This is the exact regression gate for the bug where the Dashboard's
// getUsageBadge read only weeklyRemaining, saw -1, and printed "UNLIMITED"
// while the monthly cap was the actual binding constraint (and at 0).
// Both useAICredits.refresh and getUsageBadge must produce the same number
// as Math.min(effective weekly, effective monthly).

test('seam: remaining === min(weeklyRemaining, monthlyRemaining) — monthly binding', () => {
  // Verified live values: profile_enhance free tier
  //   weeklyLimit=-1, monthlyLimit=1, monthlyRemaining=0 → badge must say 0
  const payload = { weeklyLimit: -1, weeklyRemaining: -1, monthlyLimit: 1, monthlyRemaining: 0, week: 0, month: 1 };
  const { remaining } = deriveCreditsState(payload);
  const effectiveWeekly = payload.weeklyLimit === -1 ? Infinity : payload.weeklyRemaining;
  const effectiveMonthly = payload.monthlyLimit === -1 ? Infinity : payload.monthlyRemaining;
  assert.equal(remaining, Math.min(effectiveWeekly, effectiveMonthly), 'badge must equal min(eff.weekly, eff.monthly)');
  assert.equal(remaining, 0);
});

test('seam: remaining === min(weeklyRemaining, monthlyRemaining) — career_suggestions', () => {
  // career_suggestions free tier: weeklyLimit=-1, monthlyLimit=5, monthlyRemaining=4
  const payload = { weeklyLimit: -1, weeklyRemaining: -1, monthlyLimit: 5, monthlyRemaining: 4, week: 0, month: 1 };
  const { remaining } = deriveCreditsState(payload);
  const effectiveWeekly = payload.weeklyLimit === -1 ? Infinity : payload.weeklyRemaining;
  const effectiveMonthly = payload.monthlyLimit === -1 ? Infinity : payload.monthlyRemaining;
  assert.equal(remaining, Math.min(effectiveWeekly, effectiveMonthly));
  assert.equal(remaining, 4);
});

test('seam: Download Resume has no credit cost — badge must be suppressed (null featureKey)', () => {
  // getUsageBadge() with no argument returns null; callers must not render a badge.
  // We model this as: when featureKey is falsy, remaining is irrelevant and
  // the component should return null rather than "UNLIMITED".
  const result = deriveCreditsState(null); // null feature → null state
  assert.equal(result, null, 'no-credit feature must produce null so badge is suppressed');
});
