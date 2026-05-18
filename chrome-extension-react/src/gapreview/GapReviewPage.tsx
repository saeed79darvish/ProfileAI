import React, { useState, useEffect, useMemo } from 'react';
import './gapreview.css';

interface Gap {
  skill: string;
  category: string;
  severity: 'critical' | 'important' | 'nice_to_have';
  type?: 'required' | 'nice_to_have';
  suggest_adding?: boolean;
  reason?: string;
  description: string;
  learningResource: string;
}

const gapTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  required: { label: 'Required', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  nice_to_have: { label: 'Nice to Have', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

const severityConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '🔴', label: 'Critical' },
  important: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡', label: 'Important' },
  nice_to_have: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '🔵', label: 'Nice to Have' },
};

const categoryLabels: Record<string, string> = {
  technical: '💻 Technical',
  experience: '📋 Experience',
  certification: '📜 Certifications',
  soft_skill: '🤝 Soft Skills',
  domain_knowledge: '🧠 Domain',
};

export const GapReviewPage: React.FC = () => {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [satisfiedAlternatives, setSatisfiedAlternatives] = useState<Gap[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [selections, setSelections] = useState<Record<number, 'accept' | 'skip'>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load gap data from chrome storage
    chrome.storage.local.get(['gapReviewData'], (result) => {
      if (result.gapReviewData) {
        setGaps(result.gapReviewData.gaps || []);
        setSatisfiedAlternatives(result.gapReviewData.satisfiedAlternatives || []);
        setJobTitle(result.gapReviewData.jobTitle || '');
        setCompany(result.gapReviewData.company || '');
      }
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const total = gaps.length;
    const accepted = Object.values(selections).filter((v) => v === 'accept').length;
    const skipped = Object.values(selections).filter((v) => v === 'skip').length;
    return { total, accepted, skipped, unreviewed: total - accepted - skipped };
  }, [gaps, selections]);

  const handleToggle = (index: number, action: 'accept' | 'skip') => {
    setSelections((prev) => {
      if (prev[index] === action) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: action };
    });
  };

  const handleContinue = async () => {
    setSubmitting(true);
    const acceptedGaps: string[] = [];
    const skippedGaps: string[] = [];
    const acceptedGapObjects: (Gap & { status: string })[] = [];

    gaps.forEach((gap, i) => {
      const selection = selections[i];
      if (selection === 'skip') {
        skippedGaps.push(gap.skill);
      } else {
        acceptedGaps.push(gap.skill);
        acceptedGapObjects.push({ ...gap, status: 'pending' });
      }
    });

    // Store result and signal completion
    await chrome.storage.local.set({
      gapReviewResult: {
        completed: true,
        acceptedGaps,
        skippedGaps,
        acceptedGapObjects,
      },
    });

    // Close this window
    window.close();
  };

  const handleCancel = async () => {
    await chrome.storage.local.set({
      gapReviewResult: { completed: false },
    });
    window.close();
  };

  if (loading) {
    return (
      <div className="grp-container">
        <div className="grp-loading">
          <div className="grp-spinner" />
          <p>Loading skill gaps...</p>
        </div>
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="grp-container">
        <div className="grp-empty">
          <p>No gaps to review.</p>
          <button className="grp-btn-cancel" onClick={handleCancel}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grp-container">
      {/* Header */}
      <div className="grp-header">
        <div className="grp-header-left">
          <div className="grp-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div className="grp-header-text">
            <h1 className="grp-title">Skill Gap Review</h1>
            {jobTitle && (
              <p className="grp-job-label">
                {jobTitle}{company ? `, ${company}` : ''}
              </p>
            )}
          </div>
        </div>
        <button className="grp-close-btn" onClick={handleCancel} title="Cancel">
          ✕
        </button>
      </div>

      <p className="grp-subtitle">
        Review gaps between your profile and this job. Accept gaps to add to your learning plan, or skip if you already have the skill.
      </p>

      {/* Stats Bar */}
      <div className="grp-stats-bar">
        <span className="grp-stat accept">✓ {stats.accepted} Accepted</span>
        <span className="grp-stat skip">⏭ {stats.skipped} Skipped</span>
        <span className="grp-stat remaining">○ {stats.unreviewed} Remaining</span>
      </div>

      {/* Quick Actions */}
      <div className="grp-quick-actions">
        <button
          className="grp-quick-btn accept"
          onClick={() => {
            const all: Record<number, 'accept'> = {};
            gaps.forEach((_, i) => (all[i] = 'accept'));
            setSelections(all);
          }}
        >
          Accept All
        </button>
        <button
          className="grp-quick-btn skip"
          onClick={() => {
            const all: Record<number, 'skip'> = {};
            gaps.forEach((_, i) => (all[i] = 'skip'));
            setSelections(all);
          }}
        >
          Skip All
        </button>
        <button className="grp-quick-btn reset" onClick={() => setSelections({})}>
          Reset
        </button>
      </div>

      {/* Gap List */}
      <div className="grp-gap-list">
        {gaps.map((gap, i) => {
          const config = severityConfig[gap.severity] || severityConfig.nice_to_have;
          const selected = selections[i];

          return (
            <div
              key={i}
              className={`grp-gap-item severity-${gap.severity} ${selected === 'accept' ? 'accepted' : selected === 'skip' ? 'skipped' : ''}`}
            >
              <div className="grp-gap-header">
                <span className={`grp-severity ${gap.severity}`}>
                  {config.icon} {config.label}
                </span>
                {gap.type && (
                  <span
                    className="grp-gap-type"
                    style={{
                      color: gapTypeConfig[gap.type]?.color || '#6b7280',
                      backgroundColor: gapTypeConfig[gap.type]?.bg || '#f3f4f6',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {gapTypeConfig[gap.type]?.label || gap.type}
                  </span>
                )}
                <span className="grp-category">{categoryLabels[gap.category] || gap.category}</span>
              </div>
              <div className="grp-gap-skill">{gap.skill}</div>
              <div className="grp-gap-desc">{gap.description}</div>
              {gap.reason && (
                <div className="grp-gap-reason" style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', marginBottom: '6px' }}>
                  💡 {gap.reason}
                </div>
              )}
              {gap.learningResource && (
                <div className="grp-gap-resource">
                  <span className="grp-resource-icon">💡</span>
                  {gap.learningResource}
                </div>
              )}
              <div className="grp-gap-actions">
                <button
                  className={`grp-action-btn accept ${selected === 'accept' ? 'active' : ''}`}
                  onClick={() => handleToggle(i, 'accept')}
                >
                  ✓ Accept Gap
                </button>
                <button
                  className={`grp-action-btn skip ${selected === 'skip' ? 'active' : ''}`}
                  onClick={() => handleToggle(i, 'skip')}
                >
                  ⏭ Skip
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Already Covered section */}
      {satisfiedAlternatives.length > 0 && (
        <div className="grp-covered-section" style={{ margin: '0 16px 16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#15803d', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✅ Already Covered ({satisfiedAlternatives.length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 8px' }}>
            These skills are mentioned in the job but you already satisfy the requirement through equivalent skills.
          </p>
          {satisfiedAlternatives.map((alt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.8rem' }}>
              <span style={{ color: '#16a34a' }}>✓</span>
              <strong>{alt.skill}</strong>
              <span style={{ color: '#6b7280' }}>{alt.reason || alt.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="grp-footer">
        <button className="grp-btn-continue" onClick={handleContinue} disabled={submitting}>
          {submitting ? 'Processing...' : 'Done Reviewing'}
        </button>
      </div>
    </div>
  );
};
