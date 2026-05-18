import React, { useState } from 'react';
import type { FullProfile } from '../../types';

// Flatten skills from any format into a displayable string array
function flattenSkills(skills: any): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills.map((s: any) => (typeof s === 'string' ? s : s?.name || s?.skill || '')).filter(Boolean);
  }
  if (typeof skills === 'string') {
    return skills.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (typeof skills === 'object') {
    const all: string[] = [];
    for (const category of Object.values(skills)) {
      if (Array.isArray(category)) {
        category.forEach((s: any) => {
          const name = typeof s === 'string' ? s : s?.name || s?.skill || '';
          if (name) all.push(name);
        });
      } else if (typeof category === 'string') {
        all.push(category);
      }
    }
    return all;
  }
  return [];
}

interface ProfileSectionProps {
  profile: FullProfile | null;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ profile }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (value: string | undefined, field: string) => {
    if (!value || value === '-') return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const fullName = profile 
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'User'
    : 'User';

  return (
    <div className="panel-section">
      {/* User Card */}
      <div className="user-card">
        <div className="user-avatar">
          <span>{getInitials(profile?.firstName, profile?.lastName)}</span>
        </div>
        <div className="user-info">
          <h3 className="user-name">{fullName}</h3>
          <p className="user-title">{profile?.title || profile?.headline || 'Add a title in your profile'}</p>
        </div>
        <button 
          className="btn secondary small"
          onClick={() => chrome.tabs.create({ url: 'http://localhost:3000/profile' })}
        >
          View Full
        </button>
      </div>

      {/* Quick Info */}
      <div className="info-grid">
        <InfoItem 
          label="Email"
          value={profile?.email}
          isCopied={copiedField === 'email'}
          onCopy={() => copyToClipboard(profile?.email, 'email')}
        />
        <InfoItem 
          label="Phone"
          value={profile?.phone}
          isCopied={copiedField === 'phone'}
          onCopy={() => copyToClipboard(profile?.phone, 'phone')}
        />
        <InfoItem 
          label="Location"
          value={profile?.location}
          isCopied={copiedField === 'location'}
          onCopy={() => copyToClipboard(profile?.location, 'location')}
        />
      </div>

      {/* Skills */}
      <div className="skills-section">
        <h4 className="section-label">Skills</h4>
        <div className="skills-list">
          {(() => {
            const skills = flattenSkills(profile?.skills);
            return skills.length > 0 ? (
              skills.slice(0, 8).map((skill: string, index: number) => (
                <span key={index} className="tag">{skill}</span>
              ))
            ) : (
              <span className="text-muted">No skills added</span>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

interface InfoItemProps {
  label: string;
  value?: string;
  isCopied: boolean;
  onCopy: () => void;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, isCopied, onCopy }) => (
  <div className="info-item">
    <span className="info-label">{label}</span>
    <div className="info-value-row">
      <span className="info-value">{value || '-'}</span>
      <button 
        className={`copy-btn ${isCopied ? 'copied' : ''}`}
        onClick={onCopy}
        disabled={!value || value === '-'}
        title="Copy to clipboard"
      >
        {isCopied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
      </button>
    </div>
  </div>
);
