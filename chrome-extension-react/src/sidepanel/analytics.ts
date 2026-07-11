/**
 * Extension-side analytics wrapper.
 *
 * Fires the 5 named events the LinkedIn Profile Analyzer guest funnel needs:
 *   guest_analysis_started, guest_analysis_completed, teaser_viewed,
 *   email_submitted, signin_clicked_from_teaser
 *
 * Uses a stable per-install sessionId (persisted in chrome.storage.local) so
 * we can join events across a signed-out session and, later, correlate them
 * with the user record after conversion. Fire-and-forget: errors here MUST
 * NOT surface to the user.
 */

const SESSION_ID_KEY = 'profileaiAnalyticsSessionId';

let cachedSessionId: string | null = null;

const generateSessionId = () => {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
  } catch { /* ignore */ }
  // Fallback: reasonably-unique random string. Not cryptographic — that's OK.
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

const getSessionId = async (): Promise<string> => {
  if (cachedSessionId) return cachedSessionId;
  try {
    const { [SESSION_ID_KEY]: existing } = await chrome.storage.local.get(SESSION_ID_KEY);
    if (typeof existing === 'string' && existing) {
      cachedSessionId = existing;
      return existing;
    }
    const fresh = generateSessionId();
    await chrome.storage.local.set({ [SESSION_ID_KEY]: fresh });
    cachedSessionId = fresh;
    return fresh;
  } catch {
    // Storage unavailable — fall back to an in-memory id per lifecycle.
    if (!cachedSessionId) cachedSessionId = generateSessionId();
    return cachedSessionId;
  }
};

/**
 * Named events the LinkedIn Profile Analyzer guest funnel emits.
 * Keeping this a string-union prevents typos while allowing easy extension.
 */
export type AnalyticsEventName =
  | 'guest_analysis_started'
  | 'guest_analysis_completed'
  | 'teaser_viewed'
  | 'email_submitted'
  | 'signin_clicked_from_teaser';

/**
 * Fire one analytics event. Fire-and-forget — the returned promise resolves
 * without value and never rejects to the caller.
 */
export const emitAnalyticsEvent = async (
  name: AnalyticsEventName,
  properties: Record<string, any> = {}
): Promise<void> => {
  try {
    const sessionId = await getSessionId();
    await chrome.runtime.sendMessage({
      type: 'ANALYTICS_EVENT',
      data: { name, sessionId, properties },
    });
  } catch (err) {
    // Analytics failures MUST NOT surface to the user.
    // eslint-disable-next-line no-console
    console.debug('[ProfileAI] analytics drop:', (err as Error)?.message);
  }
};
