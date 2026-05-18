import React, { useState } from 'react';
import { CONFIG } from '../../config';

interface TailoredResultsProps {
  tailoredProfile: {
    id?: string;
    summary?: string;
    skills?: string[];
    experience?: any[];
    matchScore?: number;
    matchAnalysis?: {
      strongMatches?: string[];
      gaps?: string[];
    };
    highlights?: string[];
    suggestions?: string[];
    jobTitle?: string;
    company?: string;
    title?: string;
    changelog?: Array<{
      section: string;
      action: string;
      detail: string;
    }>;
    _skillGaps?: Array<{
      skill: string;
      category: string;
      severity: string;
      description: string;
      learningResource: string;
      status: string;
    }>;
  };
  profile: {
    firstName?: string;
    lastName?: string;
    email?: string;
    title?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    summary?: string;
    skills?: string[];
    experience?: any[];
    education?: any[];
    certifications?: any[];
    projects?: any[];
  } | null;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onDismiss: () => void;
}

export const TailoredResults: React.FC<TailoredResultsProps> = ({
  tailoredProfile,
  profile,
  onNotification,
  onDismiss,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copying, setCopying] = useState(false);

  const matchScore = tailoredProfile.matchScore || 0;
  const strongMatches = tailoredProfile.matchAnalysis?.strongMatches || tailoredProfile.highlights || [];
  const gaps = tailoredProfile.matchAnalysis?.gaps || tailoredProfile.suggestions || [];

  const getScoreClass = () => {
    if (matchScore >= 70) return 'good';
    if (matchScore >= 50) return 'medium';
    return 'low';
  };

  const getScoreEmoji = () => {
    if (matchScore >= 80) return '🔥';
    if (matchScore >= 60) return '👍';
    return '⚡';
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Build the profile data we'll hand off to the web app's
      // /resume/download page (which renders the same ResumePreviewModal
      // used by the Jobs page — centered on screen, not in the side panel).
      const profileData = {
        firstName: profile?.firstName || '',
        lastName: profile?.lastName || '',
        email: profile?.email || '',
        title: profile?.title || tailoredProfile.title || '',
        phone: profile?.phone || '',
        location: profile?.location || '',
        linkedinUrl: profile?.linkedinUrl || '',
        githubUrl: profile?.githubUrl || '',
        portfolioUrl: profile?.portfolioUrl || '',
        summary: tailoredProfile.summary || profile?.summary || '',
        skills: tailoredProfile.skills || profile?.skills || [],
        experience: tailoredProfile.experience || profile?.experience || [],
        education: profile?.education || [],
        certifications: profile?.certifications || [],
        projects: profile?.projects || [],
        matchScore: tailoredProfile.matchScore,
        jobTitle: tailoredProfile.jobTitle,
        company: tailoredProfile.company,
      };

      // Stash for the content script to deliver to the download page.
      await chrome.storage.local.set({ pendingResumeDownload: profileData });

      // Inject the unified download modal as a fullscreen iframe overlay on
      // the user's CURRENT tab (e.g. the LinkedIn / Greenhouse / Workday job
      // page they are applying on). No new tab, no separate window.
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id != null) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_DOWNLOAD_OVERLAY' });
        } catch (err) {
          // Content script not present (e.g. chrome:// page or fresh install) —
          // fall back to opening the download page in a new tab.
          console.warn('[ProfileAI] Could not show overlay on active tab, opening tab instead', err);
          const url = `${CONFIG.WEB_BASE}/resume/download?ext=1`;
          if (chrome.tabs?.create) await chrome.tabs.create({ url, active: true });
        }
      }

      setDownloaded(true);
      onNotification('Opening download...', 'success');
      setTimeout(() => setDownloaded(false), 3000);
    } catch (error) {
      console.error('[ProfileAI] Download error:', error);
      onNotification((error as Error).message || 'Failed to open download', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    const summary = tailoredProfile.summary;
    if (!summary) {
      onNotification('No summary available to copy', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(summary);
      setCopying(true);
      onNotification('Summary copied to clipboard!', 'success');
      setTimeout(() => setCopying(false), 2000);
    } catch {
      onNotification('Failed to copy summary', 'error');
    }
  };

  return (
    <div className="panel-section tailored-results-section">
      <div className="section-header">
        <h4 className="section-title">✨ Tailored Resume</h4>
        <button className="tailored-dismiss" onClick={onDismiss} title="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Match Score */}
      {matchScore > 0 && (
        <div className="tailored-score-wrapper">
          <div className={`tailored-score-circle ${getScoreClass()}`}>
            <span className="tailored-score-number">{matchScore}%</span>
            <span className="tailored-score-label">Match</span>
          </div>
        </div>
      )}

      {/* Tailored For */}
      {tailoredProfile.jobTitle && (
        <p className="tailored-for-text">
          {getScoreEmoji()} Tailored for <strong>{tailoredProfile.jobTitle}</strong>
          {tailoredProfile.company && ` at ${tailoredProfile.company}`}
        </p>
      )}

      {/* Strong Matches */}
      {strongMatches.length > 0 && (
        <div className="tailored-highlights">
          <h5 className="tailored-list-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Strong Matches
          </h5>
          <ul className="tailored-list success">
            {strongMatches.slice(0, 4).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps / Learning Plan */}
      {tailoredProfile._skillGaps && tailoredProfile._skillGaps.length > 0 ? (
        <div className="tailored-gaps">
          <h5 className="tailored-list-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Learning Plan ({tailoredProfile._skillGaps.length} gaps)
          </h5>
          <div className="learning-plan-section">
            {tailoredProfile._skillGaps.map((gap, i) => (
              <div key={i} className="learning-plan-item">
                <span className="learning-plan-skill">
                  {gap.severity === 'critical' ? '🔴' : gap.severity === 'important' ? '🟡' : '🔵'} {gap.skill}
                </span>
                {gap.learningResource && (
                  <span className="learning-plan-resource" title={gap.learningResource}>💡</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : gaps.length > 0 ? (
        <div className="tailored-gaps">
          <h5 className="tailored-list-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Areas to Address
          </h5>
          <ul className="tailored-list warning">
            {gaps.slice(0, 4).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Changelog */}
      {tailoredProfile.changelog && tailoredProfile.changelog.length > 0 && (
        <div className="tailored-changelog">
          <h5 className="tailored-list-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Changes Made ({tailoredProfile.changelog.length})
          </h5>
          <div className="changelog-list">
            {tailoredProfile.changelog.map((entry, i) => (
              <div key={i} className="changelog-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px', fontSize: '0.8rem' }}>
                <span style={{
                  backgroundColor: entry.action === 'auto_injected' ? '#fef3c7' : '#dbeafe',
                  color: entry.action === 'auto_injected' ? '#92400e' : '#1e40af',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>{entry.section}</span>
                <span style={{ color: '#6b7280' }}>{entry.detail}</span>
              </div>
            ))}
            <p style={{ fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic', marginTop: '6px', marginBottom: 0 }}>
              ✅ No existing skills were replaced — only additions
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="tailored-actions">
        <button
          className={`tailored-btn primary ${downloaded ? 'success' : ''}`}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloaded ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Downloaded!</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Tailored Resume</span>
            </>
          )}
        </button>

        <button
          className={`tailored-btn secondary ${copying ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copying ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Summary</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
