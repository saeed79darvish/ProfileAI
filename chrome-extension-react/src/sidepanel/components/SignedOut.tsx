import React, { useState } from 'react';
import type { JobInfo } from '../../types';
import type { ProfileSummary } from '../profileProgress';
import { formatLastActive } from '../profileProgress';
import { AuthRequired } from './AuthRequired';
import { JobContextBanner } from './JobContextBanner';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LinkedInSignInButton } from './LinkedInSignInButton';

interface SignedOutProps {
  currentJob: JobInfo | null;
  /** Persisted summary of a previously-loaded profile (returning user). */
  lastProfile: ProfileSummary | null;
  onAuthSync: () => void;
}

/**
 * Everything the user sees while signed out. Picks the right intro:
 *  - Returning user (we remember a profile) → "reconnect" screen.
 *  - Brand new user → value-prop screen.
 * Either CTA flips to the actual sign-in / create-account form.
 */
export const SignedOut: React.FC<SignedOutProps> = ({ currentJob, lastProfile, onAuthSync }) => {
  const [formTab, setFormTab] = useState<'signin' | 'create' | null>(null);

  if (formTab) {
    return (
      <div className="main-content signed-out">
        <AuthRequired
          initialTab={formTab}
          onBack={() => setFormTab(null)}
          onAuthSync={onAuthSync}
        />
      </div>
    );
  }

  const roleLabel = currentJob?.title?.trim() || 'this role';

  // ── State 3: returning user, has a profile, just needs to reconnect ──
  if (lastProfile) {
    return (
      <div className="main-content signed-out">
        <JobContextBanner job={currentJob} />

        <div className="reconnect-card">
          <div className="reconnect-lock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="signed-out-title">Your profile is ready to go</h2>
          <p className="signed-out-sub">
            Sign in to instantly score your fit for <strong>{roleLabel}</strong> and auto-fill your application.
          </p>

          <div className="reconnect-preview">
            <div className="rp-head">
              <div className="rp-avatar">{lastProfile.initial}</div>
              <div className="rp-meta">
                <span className="rp-name">{lastProfile.firstName || 'Your profile'}</span>
                {lastProfile.title && <span className="rp-title">{lastProfile.title}</span>}
              </div>
              <span className="rp-ready">Profile ready</span>
            </div>
            {lastProfile.skills.length > 0 && (
              <div className="rp-skills">
                {lastProfile.skills.map((s, i) => (
                  <span key={i} className="tag">{s}</span>
                ))}
              </div>
            )}
            <div className="rp-unlock">Sign in to unlock ↓</div>
          </div>

          <ul className="value-list">
            <li>Match score calculated instantly for this job</li>
            <li>Contact info ready to auto-fill</li>
            <li>Tailored cover letter in one click</li>
          </ul>

          <button className="btn success full-width-btn" onClick={() => setFormTab('signin')}>
            Sign in to see your match
          </button>
          <div className="auth-divider"><span>or</span></div>
          <GoogleSignInButton
            onAuthSync={onAuthSync}
            hint="Recommended. Sign in on ProfilleAI and we'll bring you right back here."
          />
          <LinkedInSignInButton
            onAuthSync={onAuthSync}
          />
          <p className="signed-out-alt">
            Don't have an account?{' '}
            <button className="link-btn" onClick={() => setFormTab('create')}>Create one free</button>
          </p>
        </div>

        <div className="reconnect-foot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
          <span>
            You were last active <strong>{formatLastActive(lastProfile.lastActive)}</strong>. Your profile
            strength is <strong className="strength">{lastProfile.strength}%</strong>. Sign in to finish it.
          </span>
        </div>
      </div>
    );
  }

  // State 1: brand new / unknown user, lead with the value prop
  return (
    <div className="main-content signed-out">
      <JobContextBanner job={currentJob} />

      <div className="value-card">
        <div className="value-spark">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c.5 6 5.5 11 12 12-6.5 1-11.5 6-12 12-.5-6-5.5-11-12-12C6.5 11 11.5 6 12 0z" />
          </svg>
        </div>

        <h2 className="signed-out-title">See your match score for this job</h2>
        <p className="signed-out-sub">
          Sign in to let ProfilleAI analyze <strong>{roleLabel}</strong> against your profile and auto-fill your application.
        </p>

        <ul className="value-list">
          <li>Instant match % against this job's requirements</li>
          <li>Auto-fill email, phone, location in one click</li>
          <li>AI-written cover letter tailored to this role</li>
          <li>ATS keyword gap analysis</li>
        </ul>

        <button className="btn primary full-width-btn" onClick={() => setFormTab('signin')}>
          Sign in to ProfilleAI
        </button>
        <button className="btn ghost full-width-btn" onClick={() => setFormTab('create')}>
          Create free account
        </button>

        <div className="auth-divider"><span>or</span></div>
        <GoogleSignInButton
          onAuthSync={onAuthSync}
          hint="Recommended. Sign in on ProfilleAI and we'll bring you right back here."
        />
        <LinkedInSignInButton
          onAuthSync={onAuthSync}
        />
      </div>

      <div className="preview-locked">
        <span className="preview-label">Preview. Unlock with your profile</span>
        <div className="preview-tiles">
          {[0, 1, 2].map((i) => (
            <div key={i} className="preview-tile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
