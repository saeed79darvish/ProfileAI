// Thin wrapper around the in-house AnalyticsEvent log (see
// backend/models/AnalyticsEvent.js and POST /profiles/analytics-event).
// Fire-and-forget by design: instrumentation must never block or throw
// inside the flow it's measuring.
import { getCookieConsentValue } from 'react-cookie-consent';
import { profileAPI } from '../services/api';

const SESSION_KEY = 'profileai_analytics_session';
export const COOKIE_CONSENT_NAME = 'profileai_cookie_consent';

// Declining the cookie banner turns analytics off; no answer yet counts as on.
function analyticsDeclined() {
  try {
    return getCookieConsentValue(COOKIE_CONSENT_NAME) === 'false';
  } catch {
    return false;
  }
}

export function clearAnalyticsSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — nothing was kept.
  }
}

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function trackEvent(name, properties = {}) {
  if (analyticsDeclined()) return;
  try {
    profileAPI.trackAnalyticsEvent(name, properties, getSessionId()).catch(() => {});
  } catch {
    // localStorage / network unavailable — never let analytics break the UI.
  }
}
