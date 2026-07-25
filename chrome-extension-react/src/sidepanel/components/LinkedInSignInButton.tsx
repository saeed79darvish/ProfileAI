import React, { useState } from 'react';
import { CONFIG } from '../../config';

interface LinkedInSignInButtonProps {
  onAuthSync?: () => void;
  /** Called when LinkedIn identity is valid but there's no ProfilleAI account. */
  onNotRegistered?: () => void;
  /** Hint text shown under the button when idle. */
  hint?: string;
}

/**
 * "Continue with LinkedIn" — runs LinkedIn OAuth in a native popup window via the
 * background's AUTH_LINKEDIN_INTERACTIVE handler (chrome.identity.launchWebAuthFlow),
 * exchanging the auth code with our backend. Hidden entirely until a LinkedIn
 * client id is configured (CONFIG.LINKEDIN_CLIENT_ID) and the extension's
 * chromiumapp.org redirect URL is registered in the LinkedIn app.
 */
export const LinkedInSignInButton: React.FC<LinkedInSignInButtonProps> = ({ onAuthSync, onNotRegistered, hint }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not provisioned yet — don't show a button that can't work.
  if (!CONFIG.LINKEDIN_CLIENT_ID) return null;

  const handleClick = async () => {
    setBusy(true); setError(null);
    try {
      const r = await chrome.runtime.sendMessage({ type: 'AUTH_LINKEDIN_INTERACTIVE' });
      if (r?.success) onAuthSync?.();
      else if (r?.notRegistered) onNotRegistered?.();
      else if (!r?.cancelled) setError(r?.error || 'LinkedIn sign-in failed');
    } catch {
      setError('LinkedIn sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="auth-linkedin-btn" onClick={handleClick} disabled={busy}>
        <span className="auth-linkedin-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#0a66c2"
              d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"
            />
          </svg>
        </span>
        {busy ? 'Signing in…' : 'Continue with LinkedIn'}
      </button>
      {error ? (
        <div className="auth-error">{error}</div>
      ) : hint ? (
        <p className="auth-linkedin-hint">{hint}</p>
      ) : null}
    </>
  );
};
