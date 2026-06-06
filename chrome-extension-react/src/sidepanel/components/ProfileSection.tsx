import React from 'react';
import type { FullProfile } from '../../types';
import { CONFIG } from '../../config';

interface ProfileSectionProps {
  profile: FullProfile | null;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ profile }) => {
  const getInitials = (firstName?: string, lastName?: string): string => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const fullName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User'
    : 'User';

  return (
    <div className="panel-section profile-compact">
      <div className="user-card compact">
        <div className="user-avatar">
          <span>{getInitials(profile?.firstName, profile?.lastName)}</span>
        </div>
        <div className="user-info">
          <h3 className="user-name">{fullName}</h3>
          <p className="user-title">{profile?.title || profile?.headline || 'Add a title in your profile'}</p>
        </div>
        <button
          className="btn secondary small"
          onClick={() => chrome.tabs.create({ url: `${CONFIG.WEB_BASE}/profile` })}
        >
          View Full
        </button>
      </div>
    </div>
  );
};
