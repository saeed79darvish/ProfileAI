import React from 'react';
import type { JobInfo, FullProfile } from '../../types';
import type { ProfileProgress } from '../profileProgress';
import { JobContextBanner } from './JobContextBanner';
import { CONFIG } from '../../config';

interface ProfileSetupGuideProps {
  profile: FullProfile | null;
  currentJob: JobInfo | null;
  progress: ProfileProgress;
}

const ProgressRing: React.FC<{ percent: number }> = ({ percent }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="setup-ring">
      <svg viewBox="0 0 52 52">
        <circle className="ring-track" cx="26" cy="26" r={r} fill="none" strokeWidth="5" />
        <circle
          className="ring-arc"
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="ring-pct">{percent}%</span>
    </div>
  );
};

/**
 * Shown when the user is signed in but hasn't built a profile yet. Replaces the
 * empty profile/match UI with a guided, progress-driven setup flow.
 */
export const ProfileSetupGuide: React.FC<ProfileSetupGuideProps> = ({ profile, currentJob, progress }) => {
  const roleLabel = currentJob?.title?.trim() || 'this role';

  // A saved profile row exists (/profiles/me 404s otherwise, and the panel
  // stores null for that). Sending those users to the creation flow would ask
  // them to start over on work they've already saved — they want to edit.
  // Only genuinely profile-less accounts get the onboarding walkthrough.
  const hasSavedProfile = !!profile;
  const openProfile = () => {
    const path = hasSavedProfile ? '/profile/edit' : '/onboarding';
    chrome.tabs.create({ url: `${CONFIG.WEB_BASE}${path}?from=extension` });
  };

  return (
    <div className="main-content setup-guide">
      <JobContextBanner job={currentJob} />

      <div className="setup-progress-card">
        <ProgressRing percent={progress.percent} />
        <div className="spc-text">
          <h3>Profile is almost empty</h3>
          <p>Complete your profile to unlock match analysis, auto-fill &amp; AI cover letters for this job.</p>
        </div>
      </div>

      <div className="setup-cta-card">
        <h3>
          <svg viewBox="0 0 24 24" fill="currentColor" className="bolt">
            <path d="M13 2L3 14h6l-2 8 10-12h-6l2-8z" />
          </svg>
          3 minutes to unlock everything
        </h3>
        <p>
          Add your skills and title — ProfilleAI will instantly score your fit for <strong>{roleLabel}</strong>.
        </p>
        <button className="btn light full-width-btn" onClick={openProfile}>
          Complete my profile
        </button>
      </div>

      <div className="setup-checklist">
        <span className="checklist-label">Profile checklist</span>
        {progress.items.map((item) => (
          <button
            key={item.key}
            className={`checklist-item ${item.done ? 'done' : ''}`}
            onClick={item.done ? undefined : openProfile}
            disabled={item.done}
          >
            <span className="ci-dot">
              {item.done && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="ci-text">
              <span className="ci-label">{item.label}</span>
              {item.sublabel && <span className="ci-sub">{item.sublabel}</span>}
            </span>
            {!item.done && <span className="ci-arrow">›</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
