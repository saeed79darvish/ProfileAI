import React from 'react';
import type { FullProfile } from '../../types';
import { CONFIG } from '../../config';

interface ProfileSectionProps {
  profile: FullProfile | null;
  /** Whether the active tab is a linkedin.com/in/* page.
   *  Controls visibility of the "Analyze LinkedIn" affordance. */
  isOnLinkedInProfile?: boolean;
  onAnalyzeLinkedIn?: () => void;
  isAnalyzingLinkedIn?: boolean;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  profile,
  isOnLinkedInProfile,
  onAnalyzeLinkedIn,
  isAnalyzingLinkedIn,
}) => {
  const getInitials = (firstName?: string, lastName?: string): string => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const fullName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User'
    : 'User';

  const showLinkedIn = !!(isOnLinkedInProfile && onAnalyzeLinkedIn);

  return (
    <div className="panel-section profile-compact">
      <div className="user-card compact">
        <div className="user-avatar">
          <span>{getInitials(profile?.firstName, profile?.lastName)}</span>
        </div>
        <div className="user-info">
          <h3 className="user-name">{fullName}</h3>
          <p className="user-title">
            {profile?.title || profile?.headline || 'Add a title in your profile'}
          </p>
        </div>
        <button
          className="btn secondary small"
          onClick={() => chrome.tabs.create({ url: `${CONFIG.WEB_BASE}/profile` })}
        >
          View Full
        </button>
      </div>

      {showLinkedIn && (
        <button
          className="profile-analyze-linkedin"
          onClick={onAnalyzeLinkedIn}
          disabled={isAnalyzingLinkedIn}
          title="Analyze this LinkedIn profile like a recruiter"
        >
          <span className="pal-icon" aria-hidden>
            {isAnalyzingLinkedIn ? (
              <div className="tailor-spinner small">
                <svg viewBox="0 0 36 36">
                  <circle className="spinner-track" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
                  <circle
                    className="spinner-arc"
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
              </svg>
            )}
          </span>
          <span className="pal-text">
            <span className="pal-title">
              {isAnalyzingLinkedIn ? 'Analyzing this profile…' : 'Analyze this LinkedIn profile'}
            </span>
            <span className="pal-sub">Recruiter-POV grade + rewrites</span>
          </span>
          <svg className="pal-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
};
