import React, { useState } from 'react';
import type { LinkedInProfileAnalysis } from '../../types';

interface LinkedInAnalyzerModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  analysis: LinkedInProfileAnalysis | null;
  error?: string | null;
  targetTitle?: string;
  onRefresh: () => void;
  onCopy?: (text: string) => void;
}

const scoreClass = (n: number) => (n >= 70 ? 'good' : n >= 50 ? 'medium' : 'low');
const verdictLabel = (v?: string) => {
  if (v === 'shortlist') return { text: 'Shortlist', tone: 'good' as const };
  if (v === 'maybe') return { text: 'Maybe', tone: 'medium' as const };
  if (v === 'pass') return { text: 'Pass', tone: 'low' as const };
  return { text: v || '—', tone: 'medium' as const };
};

export const LinkedInAnalyzerModal: React.FC<LinkedInAnalyzerModalProps> = ({
  open,
  onClose,
  loading,
  analysis,
  error,
  targetTitle,
  onRefresh,
  onCopy,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1600);
      onCopy?.(text);
    } catch {
      /* ignore — user can still select the text manually */
    }
  };

  const verdict = analysis ? verdictLabel(analysis.verdict) : null;

  return (
    <div className="modal-overlay" onClick={handleOverlay}>
      <div className="modal-container linkedin-analyzer-modal">
        <div className="modal-header">
          <div>
            <h3>LinkedIn Profile Analyzer</h3>
            <p className="smart-answers-subtitle">
              Recruiter's-eye view{targetTitle ? ` · target: ${targetTitle}` : ''}
            </p>
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="smart-answers-status">
              <div className="spinner" />
              <p>Reading the profile and grading it like a recruiter…</p>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <p>{error}</p>
              <button className="btn primary small" onClick={onRefresh} style={{ marginTop: 12 }}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && !analysis && (
            <div className="empty-state">
              <p>Open a LinkedIn profile (linkedin.com/in/…), then click Analyze.</p>
              <button className="btn primary small" onClick={onRefresh} style={{ marginTop: 12 }}>
                Run analysis
              </button>
            </div>
          )}

          {!loading && analysis && (
            <div className="linkedin-analysis-content">
              {/* Scores row */}
              <div className="li-scores-row">
                <div className={`li-score-tile ${scoreClass(analysis.overallScore)}`}>
                  <span className="li-score-num">{analysis.overallScore}</span>
                  <span className="li-score-lbl">Overall</span>
                </div>
                <div className={`li-score-tile ${scoreClass(analysis.recruiterFitScore)}`}>
                  <span className="li-score-num">{analysis.recruiterFitScore}</span>
                  <span className="li-score-lbl">Recruiter fit</span>
                </div>
                <div className={`li-score-tile ${scoreClass(analysis.searchVisibilityScore)}`}>
                  <span className="li-score-num">{analysis.searchVisibilityScore}</span>
                  <span className="li-score-lbl">Search visibility</span>
                </div>
              </div>

              {verdict && (
                <div className={`li-verdict li-verdict-${verdict.tone}`}>
                  <span className="li-verdict-lbl">Recruiter verdict</span>
                  <span className="li-verdict-val">{verdict.text}</span>
                </div>
              )}

              {analysis.summary && <p className="li-summary">{analysis.summary}</p>}

              {/* Priority fixes — surface first because it's the most actionable. */}
              {analysis.priorityFixes?.length > 0 && (
                <section className="li-section li-priority">
                  <h5 className="li-section-title accent">Do these first</h5>
                  <ol className="li-fix-list">
                    {analysis.priorityFixes.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Recruiter search visibility */}
              {analysis.recruiterSearch && (
                <section className="li-section">
                  <h5 className="li-section-title">LinkedIn Recruiter search</h5>
                  {analysis.recruiterSearch.presentKeywords?.length > 0 && (
                    <div className="li-kw-group">
                      <span className="li-kw-lbl">Found</span>
                      <div className="li-kw-chips">
                        {analysis.recruiterSearch.presentKeywords.map((k, i) => (
                          <span key={i} className="li-chip li-chip-good">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.recruiterSearch.missingKeywords?.length > 0 && (
                    <div className="li-kw-group">
                      <span className="li-kw-lbl">Missing</span>
                      <div className="li-kw-chips">
                        {analysis.recruiterSearch.missingKeywords.map((k, i) => (
                          <span key={i} className="li-chip li-chip-warn">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.recruiterSearch.recommendedKeywords?.length > 0 && (
                    <div className="li-kw-group">
                      <span className="li-kw-lbl">Own these</span>
                      <div className="li-kw-chips">
                        {analysis.recruiterSearch.recommendedKeywords.map((k, i) => (
                          <span key={i} className="li-chip">
                            {k}
                          </span>
                        ))}
                      </div>
                      <button
                        className="li-copy-btn"
                        onClick={() =>
                          copy(
                            analysis.recruiterSearch.recommendedKeywords.join(', '),
                            'kw-recommended',
                          )
                        }
                      >
                        {copiedKey === 'kw-recommended' ? 'Copied ✓' : 'Copy all'}
                      </button>
                    </div>
                  )}
                  {analysis.recruiterSearch.searchabilityTips?.length > 0 && (
                    <ul className="li-tip-list">
                      {analysis.recruiterSearch.searchabilityTips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Section-by-section breakdown */}
              {analysis.sections?.length > 0 && (
                <section className="li-section">
                  <h5 className="li-section-title">Section-by-section</h5>
                  <div className="li-section-cards">
                    {analysis.sections.map((s, i) => (
                      <div key={i} className="li-section-card">
                        <div className="li-section-card-header">
                          <span className="li-section-card-name">{s.name}</span>
                          <span className={`li-section-card-score ${scoreClass(s.score)}`}>
                            {s.score}
                          </span>
                        </div>
                        {s.findings?.length > 0 && (
                          <ul className="li-findings">
                            {s.findings.map((f, j) => (
                              <li key={j}>{f}</li>
                            ))}
                          </ul>
                        )}
                        {s.suggestion && (
                          <div className="li-suggestion">
                            <div className="li-suggestion-header">
                              <span className="li-suggestion-lbl">Suggested rewrite</span>
                              <button
                                className="li-copy-btn"
                                onClick={() => copy(s.suggestion || '', `sec-${i}`)}
                              >
                                {copiedKey === `sec-${i}` ? 'Copied ✓' : 'Copy'}
                              </button>
                            </div>
                            <p className="li-suggestion-body">{s.suggestion}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn secondary small" onClick={onRefresh} disabled={loading}>
            {loading ? 'Analyzing…' : 'Re-analyze'}
          </button>
          <button className="btn primary small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
