import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../../config';

/**
 * "Continue with Google" / sign-in-on-ProfilleAI flow.
 *
 * Google OAuth can't run inside the extension panel, so we open the ProfilleAI
 * web login (which supports Google + email) in a tab and poll for the session
 * to sync back into the extension via the background `SYNC_AUTH_FROM_WEB`
 * handler. Shared by the AuthRequired form and the SignedOut intro screens.
 */
export function useWebSignIn(onAuthSync?: () => void) {
  const [webSyncing, setWebSyncing] = useState(false);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  // Clean up timers if the component unmounts mid-sync.
  useEffect(() => () => stopPolling(), []);

  const checkWebAuthOnce = async (): Promise<boolean> => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SYNC_AUTH_FROM_WEB' });
      if (res?.isAuthenticated) {
        stopPolling();
        setWebSyncing(false);
        onAuthSync?.();
        return true;
      }
    } catch {
      /* ignore — tab may not be ready yet */
    }
    return false;
  };

  const signInOnWeb = async () => {
    setWebSyncing(true);
    const url = `${CONFIG.WEB_BASE}/login?from=extension`;
    try {
      // OPEN_WEB_LOGIN remembers the job page we came from so the background can
      // return us there once sign-in syncs back.
      await chrome.runtime.sendMessage({ type: 'OPEN_WEB_LOGIN', data: { url } });
    } catch {
      window.open(url, '_blank');
    }
    stopPolling();
    // Poll the web tab's session every few seconds until it's signed in.
    pollRef.current = setInterval(checkWebAuthOnce, 2500) as unknown as number;
    // Give up quietly after 3 minutes so we don't poll forever.
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setWebSyncing(false);
    }, 180000) as unknown as number;
  };

  return { webSyncing, signInOnWeb, checkWebAuthOnce };
}
