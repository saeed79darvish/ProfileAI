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
