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
  /** Match score before tailoring (from the keyword analysis). */
  beforeScore?: number | null;
  /** Keywords that tailoring targeted (the previously-missing ones). */
  addedKeywords?: string[];
  /** Total keywords in the job, for the X/Y stat. */
  totalKeywords?: number | null;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onDismiss: () => void;
}

export const TailoredResults: React.FC<TailoredResultsProps> = ({
  tailoredProfile,
  profile,
  beforeScore,
  addedKeywords,
  totalKeywords,
  onNotification,
  onDismiss,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  const afterScore = tailoredProfile.matchScore || 0;
  const hasBefore = typeof beforeScore === 'number' && beforeScore > 0 && beforeScore < afterScore;
  const improvement = hasBefore ? afterScore - (beforeScore as number) : 0;

  const strongMatches = tailoredProfile.matchAnalysis?.strongMatches || tailoredProfile.highlights || [];
  const gapObjects = tailoredProfile._skillGaps || [];
  const longTermGaps = gapObjects.length > 0
    ? gapObjects.map((g) => g.skill)
    : (tailoredProfile.matchAnalysis?.gaps || tailoredProfile.suggestions || []);

  // Keywords added: prefer the explicitly-passed targeted list, fall back to strong matches.
  const added = (addedKeywords && addedKeywords.length > 0 ? addedKeywords : strongMatches).filter(Boolean);
  const changelog = tailoredProfile.changelog || [];
  const changeCount = changelog.length || added.length;

  // X/Y keywords covered after tailoring.
  const total = totalKeywords || 0;
  const coveredAfter = total > 0 ? Math.round((afterScore / 100) * total) : 0;

  const ADDED_PREVIEW = 7;
  const visibleAdded = added.slice(0, ADDED_PREVIEW);
  const hiddenAdded = added.length - visibleAdded.length;

  const handleDownload = async () => {
    setDownloading(true);
    try {
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

      await chrome.storage.local.set({ pendingResumeDownload: profileData });

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id != null) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_DOWNLOAD_OVERLAY' });
        } catch (err) {
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
      <button className="tailored-dismiss floating" onClick={onDismiss} title="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Success banner */}
      <div className="tr-success-pill">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <path d="M12 0c.5 6 5.5 11 12 12-6.5 1-11.5 6-12 12-.5-6-5.5-11-12-12C6.5 11 11.5 6 12 0z" />
        </svg>
        Resume tailored successfully
      </div>

      {/* Before → After */}
      <div className="tr-scores">
        {hasBefore && (
          <>
            <div className="tr-score before">
              <span className="tr-score-num">{beforeScore}%</span>
              <span className="tr-score-cap">Before</span>
            </div>
            <svg className="tr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
        <div className="tr-score after">
          <span className="tr-score-num">{afterScore}%</span>
          <span className="tr-score-cap">{hasBefore ? 'After tailoring' : 'Match'}</span>
        </div>
      </div>

      {hasBefore && (
        <div className="tr-improvement">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
          +{improvement}% match improvement
        </div>
      )}

      {/* Stats row */}
      <div className="tr-stats">
        {total > 0 && (
          <div className="tr-stat">
            <span className="tr-stat-num good">{coveredAfter}/{total}</span>
            <span className="tr-stat-label">Keywords</span>
          </div>
        )}
        <div className="tr-stat">
          <span className="tr-stat-num">{changeCount}</span>
          <span className="tr-stat-label">Changes</span>
        </div>
        {longTermGaps.length > 0 && (
          <div className="tr-stat">
            <span className="tr-stat-num warn">{longTermGaps.length}</span>
            <span className="tr-stat-label">Gaps left</span>
          </div>
        )}
        <div className="tr-stat">
          <span className="tr-stat-num good">Safe</span>
          <span className="tr-stat-label">Edit type</span>
        </div>
      </div>

      {/* Keywords added */}
      {added.length > 0 && (
        <div className="tr-kw-group">
          <h5 className="tr-kw-title added">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Keywords added by tailoring
          </h5>
          <div className="tr-chips">
            {visibleAdded.map((kw, i) => (
              <span key={`${kw}-${i}`} className="kw-chip matched">{kw}</span>
            ))}
            {hiddenAdded > 0 && <span className="kw-chip matched muted">+{hiddenAdded} more</span>}
          </div>
        </div>
      )}

      {/* Long-term gaps */}
      {longTermGaps.length > 0 && (
        <div className="tr-kw-group">
          <h5 className="tr-kw-title gaps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Still missing — long-term gaps
          </h5>
          <div className="tr-chips">
            {longTermGaps.slice(0, 6).map((g, i) => (
              <span key={`${g}-${i}`} className="kw-chip gap">{g}</span>
            ))}
          </div>
        </div>
      )}

      {/* Additive-only reassurance */}
      <div className="tr-additive-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>No existing content was removed — all changes are additive only.</span>
      </div>

      {/* Actions */}
      <button
        className={`tr-download-btn ${downloaded ? 'done' : ''}`}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloaded ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Downloaded!
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Tailored Resume
          </>
        )}
      </button>

      <button className={`tr-copy-btn ${copying ? 'copied' : ''}`} onClick={handleCopy}>
        {copying ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Summary
          </>
        )}
      </button>

      {/* What changed (expandable) */}
      {changelog.length > 0 && (
        <div className="tr-changes">
          <button className="tr-changes-toggle" onClick={() => setShowChanges((s) => !s)} aria-expanded={showChanges}>
            <span>✏️ What changed ({changelog.length} edit{changelog.length === 1 ? '' : 's'})</span>
            <svg className={`chevron ${showChanges ? 'expanded' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showChanges && (
            <div className="tr-changes-list">
              {changelog.map((entry, i) => (
                <div key={i} className="tr-change-item">
                  <span className={`tr-change-tag ${entry.action === 'auto_injected' ? 'auto' : 'edit'}`}>
                    {entry.section}
                  </span>
                  <span className="tr-change-detail">{entry.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
