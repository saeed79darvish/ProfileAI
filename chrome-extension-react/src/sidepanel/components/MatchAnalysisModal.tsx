import React from 'react';
import type { MatchAnalysis, JobInfo } from '../../types';

interface MatchAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  analysis: MatchAnalysis | null;
  currentJob: JobInfo | null;
  onRefresh: () => void;
}

export const MatchAnalysisModal: React.FC<MatchAnalysisModalProps> = ({
  open,
  onClose,
  loading,
  analysis,
  currentJob,
  onRefresh,
}) => {
  if (!open) return null;

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const score = analysis?.matchScore ?? 0;
  const scoreClass = score >= 70 ? 'good' : score >= 50 ? 'medium' : 'low';

  return (
    <div className="modal-overlay" onClick={handleOverlay}>
      <div className="modal-container match-analysis-modal">
        <div className="modal-header">
          <div>
            <h3>Job Match Analysis</h3>
            {currentJob && (
              <p className="smart-answers-subtitle">
                {currentJob.title}{currentJob.company ? ` · ${currentJob.company}` : ''}
              </p>
            )}
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="smart-answers-status">
              <div className="spinner" />
              <p>Analyzing how your profile matches this role…</p>
            </div>
          )}

          {!loading && !analysis && (
            <div className="empty-state">
              <p>No analysis available yet.</p>
              <button className="btn primary small" onClick={onRefresh} style={{ marginTop: 12 }}>
                Run Analysis
              </button>
            </div>
          )}

          {!loading && analysis && (
            <div className="match-analysis-content">
              <div className="match-score-row">
                <div className={`match-score-pill ${scoreClass}`}>
                  <span className="match-score-num">{analysis.matchScore}%</span>
                  <span className="match-score-lbl">Match</span>
                </div>
                {analysis.summary && (
                  <p className="match-summary">{analysis.summary}</p>
                )}
              </div>

              {analysis.alignments?.length > 0 && (
                <section className="match-section">
                  <h5 className="match-section-title good">Strongest alignments</h5>
                  <ul className="match-list">
                    {analysis.alignments.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              )}

              {analysis.gaps?.length > 0 && (
                <section className="match-section">
                  <h5 className="match-section-title warn">Gaps to address</h5>
                  <ul className="match-list">
                    {analysis.gaps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              )}

              {analysis.talkingPoints?.length > 0 && (
                <section className="match-section">
                  <h5 className="match-section-title accent">Suggested talking points</h5>
                  <ul className="match-list">
                    {analysis.talkingPoints.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn secondary small" onClick={onRefresh} disabled={loading}>
            {loading ? 'Analyzing…' : 'Re-analyze'}
          </button>
          <button className="btn primary small" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
