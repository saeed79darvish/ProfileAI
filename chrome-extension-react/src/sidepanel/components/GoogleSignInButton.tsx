import React, { useState } from 'react';
import { CONFIG } from '../../config';

interface GoogleSignInButtonProps {
  onAuthSync?: () => void;
  /** Called when Google auth succeeds but there's no ProfilleAI account yet. */
  onNotRegistered?: () => void;
  /** Hint text shown under the button when idle. */
  hint?: string;
}

/**
 * "Continue with Google" — runs Google OAuth in a native popup window via the
 * background's AUTH_GOOGLE_INTERACTIVE handler (chrome.identity.launchWebAuthFlow),
 * so sign-in completes without ever leaving the job page. No profilleai tab.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onAuthSync, onNotRegistered, hint }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!CONFIG.GOOGLE_CLIENT_ID) { setError('Google sign-in is not configured'); return; }
    setBusy(true); setError(null);
    try {
      const r = await chrome.runtime.sendMessage({ type: 'AUTH_GOOGLE_INTERACTIVE' });
      if (r?.success) onAuthSync?.();
      else if (r?.notRegistered) onNotRegistered?.();
      else if (!r?.cancelled) setError(r?.error || 'Google sign-in failed');
    } catch {
      setError('Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="auth-google-btn" onClick={handleClick} disabled={busy}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
        </svg>
        {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
      {error ? (
        <div className="auth-error">{error}</div>
      ) : hint ? (
        <p className="auth-google-hint">{hint}</p>
      ) : null}
    </>
  );
};
