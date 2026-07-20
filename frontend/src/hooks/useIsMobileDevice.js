// Detects an actual mobile OS (iOS/Android) via the user agent, not viewport
// width. Distinct from the responsive breakpoints in styles/breakpoints.js:
// a narrow desktop window still supports the Chrome extension, but a phone
// browser never will, regardless of how wide its viewport is.
const MOBILE_UA_RE = /iphone|ipad|ipod|android/i;

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;

  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') {
    return uaData.mobile;
  }

  return MOBILE_UA_RE.test(navigator.userAgent || '');
}

export default function useIsMobileDevice() {
  return isMobileDevice();
}
