import { useCallback, useEffect, useState } from 'react';
import { subscriptionAPI } from '../services/api';

/**
 * Single source of truth for the candidate-facing AI credits indicator.
 *
 * Why this exists: every AI action (Enhance, AI Draft, Tailor, etc.) is
 * rate-limited server-side, but the UI used to silently consume credits
 * until the paywall popped — no counter, no warning. This hook lets any
 * surface display a live remaining count that re-fetches automatically
 * after each AI call, so the badge and the paywall always agree on the
 * same number.
 *
 * Wire-up:
 *   1. Mount <AICreditsBadge /> wherever you want the count visible.
 *   2. Successful AI calls already trigger an auto-refresh via the axios
 *      response interceptor in services/api.js (no per-caller wiring).
 *   3. For non-axios paths (workers, websockets) call notifyAICreditsUsed().
 *
 * @param {string} featureType  Defaults to 'profile_enhance' which covers
 *   the wizard's AI Draft + editor's Enhance / Resume parse. Pass another
 *   feature key (e.g. 'tailor_profile') to track that limit instead.
 */
const EVENT_NAME = 'profileai:ai-usage-updated';

/**
 * Fire-and-forget event hook for non-axios callers (or anywhere you want
 * to nudge the badge to re-fetch).
 */
export const notifyAICreditsUsed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (_) { /* test env / older browsers */ }
};

const useAICredits = (featureType = 'profile_enhance') => {
  const [state, setState] = useState({
    remaining: null,
    used: 0,
    limit: -1,
    isUnlimited: false,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await subscriptionAPI.getUsage();
      const feature = res?.data?.usage?.[featureType];
      if (!feature) {
        setState((p) => ({ ...p, loading: false, error: 'no-data' }));
        return;
      }
      // `-1` means unlimited in the backend's getUsageSummary contract.
      // Free tier has a weekly cap; we surface "this week" rather than
      // monthly because that's the tighter constraint candidates feel.
      const isUnlimited = feature.weeklyLimit === -1 || feature.weeklyRemaining === -1;
      setState({
        remaining: isUnlimited ? -1 : feature.weeklyRemaining,
        used: feature.week || 0,
        limit: feature.weeklyLimit,
        isUnlimited,
        loading: false,
        error: null,
      });
    } catch (err) {
      // Soft-fail: 401 during boot grace, 5xx, etc. shouldn't crash the
      // surface — just hide the badge until next refresh.
      setState((p) => ({ ...p, loading: false, error: err?.message || 'failed' }));
    }
  }, [featureType]);

  useEffect(() => {
    refresh();
    if (typeof window === 'undefined') return undefined;
    const handler = () => refresh();
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [refresh]);

  return { ...state, refresh };
};

export default useAICredits;
