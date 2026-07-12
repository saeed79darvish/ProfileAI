import React, { useState } from 'react';
import { useWebSignIn } from './useWebSignIn';
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

export const AuthRequired: React.FC<AuthRequiredProps> = ({ onAuthSync, initialTab = 'signin', onBack }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (activeTab === 'signin') {
        if (!email || !password) {
          setError('Please fill in all fields');
          setSubmitting(false);
          return;
        }
        const result = await chrome.runtime.sendMessage({
          type: 'LOGIN_WITH_CREDENTIALS',
          data: { email, password },
        });
        if (result?.success) {
          onAuthSync?.();
        } else {
          setError(result?.error || 'Invalid email or password');
        }
      } else {
        if (!email || !password || !firstName || !lastName) {
          setError('Please fill in all fields');
          setSubmitting(false);
          return;
        }
        const result = await chrome.runtime.sendMessage({
          type: 'REGISTER',
          data: { email, password, firstName, lastName, role: 'candidate' },
        });
        if (result?.success) {
          onAuthSync?.();
        } else {
          setError(result?.error || 'Registration failed');
        }
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
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
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#authGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="url(#authGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="url(#authGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="authGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#7c3aed' }}/>
              <stop offset="100%" style={{ stopColor: '#8b5cf6' }}/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <h2 className="auth-title">Welcome Back</h2>

      {/* Recommended path: sign in on ProfilleAI (supports Google + keeps the
          web app and extension in sync for the full experience). */}
      <GoogleSignInButton
        onAuthSync={onAuthSync}
      />

      <LinkedInSignInButton
        onAuthSync={onAuthSync}
      />

      <div className="auth-divider"><span>or use email</span></div>

      {/* Tabs */}
      <div className="auth-tabs">
        <button
          className={`auth-tab ${activeTab === 'signin' ? 'active' : ''}`}
          onClick={() => { setActiveTab('signin'); setError(null); }}
        >
          Sign In
        </button>
        <button
          className={`auth-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => { setActiveTab('create'); setError(null); }}
        >
          Create Account
        </button>
      </div>

      {/* Form */}
      <form className="auth-form" onSubmit={handleSubmit}>
        {activeTab === 'create' && (
          <div className="auth-name-row">
            <div className="auth-field">
              <label>First Name</label>
              <input
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="auth-field">
              <label>Last Name</label>
              <input
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
        )}

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
              autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
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

        <button
          type="submit"
          className="btn primary auth-submit"
          disabled={submitting}
        >
          {submitting
            ? (activeTab === 'signin' ? 'Signing in...' : 'Creating account...')
            : (activeTab === 'signin' ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      {activeTab === 'create' && (
        <p className="auth-password-hint">
          Password: 8+ chars, uppercase, lowercase, number &amp; special character
        </p>
      )}
    </div>
  );
};
