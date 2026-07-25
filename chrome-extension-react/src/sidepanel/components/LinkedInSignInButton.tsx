import React from 'react';
import { useWebSignIn } from './useWebSignIn';

interface LinkedInSignInButtonProps {
  onAuthSync?: () => void;
  /** Hint text shown under the button when not actively syncing. */
  hint?: string;
  /** 'register' routes to the web sign-up page instead of sign-in. */
  mode?: 'login' | 'register';
}

/**
 * "Continue with LinkedIn" button. Opens the ProfilleAI web login/register with
 * a `provider=linkedin` hint so the page can auto-kick off LinkedIn OAuth,
 * then syncs the session back into the extension the same way the Google
 * button does. LinkedIn OAuth itself can't run inside a Chrome extension
 * popup (LinkedIn blocks chrome-extension:// redirects), so we offload the
 * whole OAuth roundtrip to the web app.
 */
export const LinkedInSignInButton: React.FC<LinkedInSignInButtonProps> = ({ onAuthSync, hint, mode = 'login' }) => {
  const { webSyncing, signInOnWeb, checkWebAuthOnce } = useWebSignIn(onAuthSync);

  const handleClick = () => {
    // Pass provider=linkedin so the web page can auto-trigger LinkedIn
    // OAuth. useWebSignIn's default URL already includes ?from=extension,
    // so we tack our hint on via chrome.storage as a fallback in case the
    // web app doesn't yet accept the querystring hint.
    try {
      chrome.storage.local.set({ pendingAuthProvider: 'linkedin' });
    } catch { /* ignore */ }
    void signInOnWeb('linkedin', mode);
  };

  return (
    <>
      <button
        type="button"
        className="auth-linkedin-btn"
        onClick={handleClick}
        disabled={webSyncing}
      >
        <span className="auth-linkedin-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#0a66c2"
              d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"
            />
          </svg>
        </span>
        {webSyncing ? 'Waiting for sign-in…' : mode === 'register' ? 'Sign up with LinkedIn' : 'Continue with LinkedIn'}
      </button>
      {webSyncing ? (
        <div className="auth-linkedin-hint">
          Finish signing in on the ProfilleAI tab we opened, it will sync back here automatically.{' '}
          <button type="button" className="link-btn" onClick={checkWebAuthOnce}>
            Check now
          </button>
        </div>
      ) : hint ? (
        <p className="auth-linkedin-hint">{hint}</p>
      ) : null}
    </>
  );
};
