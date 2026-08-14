import React, { useState } from 'react';
import { CONFIG } from '../../config';
import { BrandIcon } from '../../components/BrandLogo';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LinkedInSignInButton } from './LinkedInSignInButton';

interface AuthRequiredProps {
  onAuthSync?: () => void;
  /** Which tab to open on first render. */
  initialTab?: AuthTab;
  /** When provided, shows a back arrow that returns to the intro screen. */
  onBack?: () => void;
}

type AuthTab = 'signin' | 'create';

// Registration + profile creation still happen on the web app (it owns the full
// sign-up form, password rules, terms, and the profile builder). Everything
// ELSE — sign-in via email, Google, or LinkedIn — now stays inside the panel.
function openOnWeb(path: string) {
  const url = `${CONFIG.WEB_BASE}${path}`;
  try {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', data: { url } });
  } catch {
    window.open(url, '_blank');
  }
}

export function openRegisterOnWeb() {
  openOnWeb('/register?from=extension');
}

/**
 * Where a brand-new user goes: the onboarding walkthrough, which introduces the
 * product and then hands off to the profile builder. Both routes are
 * guest-allowed on the web app, so they build the profile first and only
 * register at the end — asking for an account before they've seen any value is
 * what loses them.
 */
export function openProfileBuilderOnWeb() {
  openOnWeb('/onboarding?from=extension');
}

export const AuthRequired: React.FC<AuthRequiredProps> = ({ onAuthSync, initialTab = 'signin', onBack }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Please enter your email and password'); return; }
    setSubmitting(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'LOGIN_WITH_CREDENTIALS',
        data: { email, password },
      });
      if (result?.success) {
        onAuthSync?.();
      } else {
        setError(result?.error || 'Invalid email or password');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-required-container">
      {onBack && (
        <button type="button" className="auth-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}
      {/* Logo */}
      <div className="auth-logo-mark">
        <BrandIcon size={48} />
      </div>

      {activeTab === 'signin' ? (
        <>
          <h2 className="auth-title">Welcome Back</h2>

          {/* Social sign-in — runs in a native OAuth popup, stays in the panel. */}
          <GoogleSignInButton onAuthSync={onAuthSync} onNotRegistered={openRegisterOnWeb} />
          <LinkedInSignInButton onAuthSync={onAuthSync} onNotRegistered={openRegisterOnWeb} />

          <div className="auth-divider"><span>or use email</span></div>

          <form className="auth-form" onSubmit={handleEmailSignIn}>
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn primary auth-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="auth-password-hint">
            Don&apos;t have an account?{' '}
            <button type="button" className="link-btn" onClick={() => { setError(null); setActiveTab('create'); }}>
              Create one
            </button>
          </p>
        </>
      ) : (
        <>
          <h2 className="auth-title">Build Your Profile</h2>
          <p className="signed-out-sub">
            Your profile is what powers auto-fill, tailoring, and cover letters.
            Build it on ProfilleAI — no account needed to start — then come back
            and sign in here.
          </p>
          <button type="button" className="btn primary auth-submit" onClick={openProfileBuilderOnWeb}>
            Build my profile on ProfilleAI
          </button>
          <p className="auth-password-hint">
            Already have an account?{' '}
            <button type="button" className="link-btn" onClick={() => { setError(null); setActiveTab('signin'); }}>
              Sign in
            </button>
          </p>
        </>
      )}
    </div>
  );
};
