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
  const mode: 'login' | 'register' = activeTab === 'create' ? 'register' : 'login';
  const { webSyncing, signInOnWeb, checkWebAuthOnce } = useWebSignIn(onAuthSync);

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

      <h2 className="auth-title">{activeTab === 'create' ? 'Create Your Account' : 'Welcome Back'}</h2>

      {/* Every path here hands off to ProfilleAI on the web — it keeps a
          single account form (with full password rules, terms, etc.) and
          syncs the resulting session back into the extension automatically. */}
      <GoogleSignInButton
        onAuthSync={onAuthSync}
        mode={mode}
      />

      <LinkedInSignInButton
        onAuthSync={onAuthSync}
        mode={mode}
      />

      <div className="auth-divider"><span>or use email</span></div>

      {/* Tabs */}
      <div className="auth-tabs">
        <button
          className={`auth-tab ${activeTab === 'signin' ? 'active' : ''}`}
          onClick={() => setActiveTab('signin')}
        >
          Sign In
        </button>
        <button
          className={`auth-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Account
        </button>
      </div>

      <button
        type="button"
        className="btn primary auth-submit"
        onClick={() => signInOnWeb(undefined, mode)}
        disabled={webSyncing}
      >
        {webSyncing
          ? 'Waiting…'
          : activeTab === 'create' ? 'Create account with email' : 'Sign in with email'}
      </button>

      {webSyncing && (
        <div className="auth-google-hint">
          Finish on the ProfilleAI tab we opened, it will sync back here automatically.{' '}
          <button type="button" className="link-btn" onClick={checkWebAuthOnce}>
            Check now
          </button>
        </div>
      )}
    </div>
  );
};
