import React from 'react';
import type { FullProfile } from '../../types';
import { CONFIG } from '../../config';
import { AnalyzeLinkedInPill } from './AnalyzeLinkedInPill';

interface ProfileSectionProps {
  profile: FullProfile | null;
  /** Whether the active tab is a linkedin.com/in/* page.
   *  Controls visibility of the "Analyze LinkedIn" affordance. */
  isOnLinkedInProfile?: boolean;
  onAnalyzeLinkedIn?: () => void;
  isAnalyzingLinkedIn?: boolean;
  /** ms timestamp of a cached analysis for the current tab's profile URL,
   *  or null when the profile hasn't been analyzed yet. */
  linkedInAnalyzedAt?: number | null;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  profile,
  isOnLinkedInProfile,
  onAnalyzeLinkedIn,
  isAnalyzingLinkedIn,
  linkedInAnalyzedAt,
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
        <AnalyzeLinkedInPill
          onClick={onAnalyzeLinkedIn!}
          loading={isAnalyzingLinkedIn}
          analyzedAt={linkedInAnalyzedAt}
        />
      )}
    </div>
  );
};
