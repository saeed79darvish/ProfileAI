// Thin wrapper around the in-house AnalyticsEvent log (see
// backend/models/AnalyticsEvent.js and POST /profiles/analytics-event).
// Fire-and-forget by design: instrumentation must never block or throw
// inside the flow it's measuring.
import { profileAPI } from '../services/api';

const SESSION_KEY = 'profileai_analytics_session';

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
  try {
    profileAPI.trackAnalyticsEvent(name, properties, getSessionId()).catch(() => {});
  } catch {
    // localStorage / network unavailable — never let analytics break the UI.
  }
}
