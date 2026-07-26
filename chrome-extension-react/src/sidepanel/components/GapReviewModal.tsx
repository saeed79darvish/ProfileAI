import React, { useState, useMemo } from 'react';

interface Gap {
  skill: string;
  category: string;
  severity: 'critical' | 'important' | 'nice_to_have';
  description: string;
  learningResource: string;
}

interface GapReviewModalProps {
  gaps: Gap[];
  onContinue: (selections: {
    acceptedGaps: string[];
    skippedGaps: string[];
    acceptedGapObjects: (Gap & { status: string; customPrompt?: string })[];
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

const severityConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#ef4444', bg: '#fef2f2', icon: '🔴', label: 'Critical' },
  important: { color: '#f59e0b', bg: '#fffbeb', icon: '🟡', label: 'Important' },
  nice_to_have: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', label: 'Nice to Have' },
};

const categoryLabels: Record<string, string> = {
  technical: '💻 Technical',
  experience: '📋 Experience',
  certification: '📜 Certifications',
  soft_skill: '🤝 Soft Skills',
  domain_knowledge: '🧠 Domain',
};

export const GapReviewModal: React.FC<GapReviewModalProps> = ({
  gaps,
  onContinue,
  onCancel,
  loading = false,
}) => {
  const [selections, setSelections] = useState<Record<number, 'accept' | 'skip'>>({});
  // Per-gap freeform instruction the AI should honor when weaving this gap in.
  const [gapPrompts, setGapPrompts] = useState<Record<number, string>>({});

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

  const handleContinue = () => {
    const acceptedGaps: string[] = [];
    const skippedGaps: string[] = [];
    const acceptedGapObjects: (Gap & { status: string; customPrompt?: string })[] = [];

    gaps.forEach((gap, i) => {
      const selection = selections[i];
      if (selection === 'skip') {
        skippedGaps.push(gap.skill);
      } else {
        acceptedGaps.push(gap.skill);
        acceptedGapObjects.push({ ...gap, status: 'pending', customPrompt: (gapPrompts[i] || '').trim() });
      }
    });

    onContinue({ acceptedGaps, skippedGaps, acceptedGapObjects });
  };

  return (
    <div className="gap-modal-overlay" onClick={onCancel}>
      <div className="gap-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="gap-modal-header">
          <div className="gap-modal-header-left">
            <div className="gap-modal-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3 className="gap-modal-title">Skill Gap Review</h3>
          </div>
          <button className="gap-modal-close" onClick={onCancel} title="Cancel" disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="gap-review-subtitle">
          Review gaps between your profile and this job. Accept gaps to add to your learning plan, or skip if you already have the skill.
        </p>

        {/* Stats Bar */}
        <div className="gap-stats-bar">
          <span className="gap-stat accept">✓ {stats.accepted} Accepted</span>
          <span className="gap-stat skip">⏭ {stats.skipped} Skipped</span>
          <span className="gap-stat remaining">○ {stats.unreviewed} Remaining</span>
        </div>

        {/* Quick Actions */}
        <div className="gap-quick-actions">
          <button
            className="gap-quick-btn accept"
            onClick={() => {
              const all: Record<number, 'accept'> = {};
              gaps.forEach((_, i) => (all[i] = 'accept'));
              setSelections(all);
            }}
          >
            Accept All
          </button>
          <button
            className="gap-quick-btn skip"
            onClick={() => {
              const all: Record<number, 'skip'> = {};
              gaps.forEach((_, i) => (all[i] = 'skip'));
              setSelections(all);
            }}
          >
            Skip All
          </button>
          <button className="gap-quick-btn reset" onClick={() => setSelections({})}>
            Reset
          </button>
        </div>

        {/* Gap List */}
        <div className="gap-list">
          {gaps.map((gap, i) => {
            const config = severityConfig[gap.severity] || severityConfig.nice_to_have;
            const selected = selections[i];

            return (
              <div
                key={i}
                className={`gap-item severity-${gap.severity} ${selected === 'accept' ? 'accepted' : selected === 'skip' ? 'skipped' : ''}`}
              >
                <div className="gap-item-header">
                  <span className={`gap-severity ${gap.severity}`}>
                    {config.icon} {config.label}
                  </span>
                  <span className="gap-category">{categoryLabels[gap.category] || gap.category}</span>
                </div>
                <div className="gap-item-skill">{gap.skill}</div>
                <div className="gap-item-desc">{gap.description}</div>
                {gap.learningResource && (
                  <div className="gap-item-resource">
                    <span className="gap-resource-icon">💡</span>
                    {gap.learningResource}
                  </div>
                )}
                <div className="gap-item-actions">
                  <button
                    className={`gap-action-btn accept ${selected === 'accept' ? 'active' : ''}`}
                    onClick={() => handleToggle(i, 'accept')}
                  >
                    ✓ Accept Gap
                  </button>
                  <button
                    className={`gap-action-btn skip ${selected === 'skip' ? 'active' : ''}`}
                    onClick={() => handleToggle(i, 'skip')}
                  >
                    ⏭ Skip
                  </button>
                </div>
                {selected !== 'skip' && (
                  <div className="gap-prompt-wrap">
                    <label className="gap-prompt-label" htmlFor={`gap-prompt-${i}`}>
                      Tell the AI how to handle this gap (optional)
                    </label>
                    <textarea
                      id={`gap-prompt-${i}`}
                      className="gap-prompt-input"
                      value={gapPrompts[i] || ''}
                      maxLength={300}
                      onChange={(e) => setGapPrompts((prev) => ({ ...prev, [i]: e.target.value }))}
                      placeholder={`e.g. Mention ${gap.skill} only in Skills, or frame it as "familiar with".`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="gap-review-footer">
          <button className="gap-continue-btn" onClick={handleContinue} disabled={loading}>
            {loading ? (
              <>
                <div className="gap-btn-spinner">
                  <svg viewBox="0 0 36 36" width="20" height="20">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                    <circle className="spinner-arc" cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                Tailoring your profile…
              </>
            ) : (
              'Done Reviewing'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
