import React from 'react';

interface QuickActionsProps {
  onSmartAnswers: () => void;
  onQuickFillBasics: () => void;
  onTailor: () => void;
  onCoverLetter: () => void;
  hasJob: boolean;
  isTailoring?: boolean;
  isDetecting?: boolean;
  detectedCount?: number;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onSmartAnswers,
  onQuickFillBasics,
  onTailor,
  onCoverLetter,
  isTailoring,
  isDetecting,
  detectedCount,
}) => {
  return (
    <div className="panel-section quick-actions">
      <div className="section-header">
        <h4 className="section-title">Quick Actions</h4>
      </div>

      {/* Headline action — Smart Answers (replaces autofill as primary) */}
      <button
        className="action-headline smart-answers-headline"
        onClick={onSmartAnswers}
        disabled={isDetecting}
        title="Find open-ended questions on this page and draft tailored answers"
      >
        <div className="headline-icon">
          {isDetecting ? (
            <div className="tailor-spinner small">
              <svg viewBox="0 0 36 36">
                <circle className="spinner-track" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
                <circle className="spinner-arc" cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="spinner-icon">✦</span>
            </div>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.4 6.5L21 11l-6.6 2.5L12 20l-2.4-6.5L3 11l6.6-2.5L12 2z" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="headline-text">
          <div className="headline-title">
            {isDetecting ? 'Scanning questions…' : 'Answer Questions'}
            {!isDetecting && typeof detectedCount === 'number' && detectedCount > 0 && (
              <span className="headline-badge">{detectedCount}</span>
            )}
          </div>
          <div className="headline-subtitle">
            AI drafts tailored answers for the hard, open-ended ones
          </div>
        </div>
        <svg className="headline-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Secondary grid */}
      <div className="actions-grid">
        <button
          className="action-btn secondary"
          onClick={onQuickFillBasics}
          title="Fill only reliable basics (name, email, phone, location, links). Skips selects and custom dropdowns."
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4V20H20V13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 15L20 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 4H20V9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Quick Fill Basics</span>
        </button>

        <button
          className={`action-btn secondary ${isTailoring ? 'tailoring-active' : ''}`}
          onClick={onTailor}
          disabled={isTailoring}
          title={isTailoring ? 'Tailoring in progress...' : 'Tailor your profile for this job'}
        >
          {isTailoring ? (
            <>
              <div className="tailor-spinner">
                <svg viewBox="0 0 36 36">
                  <circle className="spinner-track" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
                  <circle className="spinner-arc" cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="spinner-icon">✦</span>
              </div>
              <span>Tailoring…</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Tailor Profile</span>
            </>
          )}
        </button>

        <button
          className="action-btn tertiary"
          onClick={onCoverLetter}
          title="Generate a cover letter for this job"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Cover Letter</span>
        </button>
      </div>
    </div>
  );
};
