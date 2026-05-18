import React from 'react';
import type { JobInfo } from '../../types';

interface KeywordAnalysis {
  matchScore: number;
  present: string[];
  missing: string[];
  totalKeywords: number;
}

interface JobMatchSectionProps {
  currentJob: JobInfo | null;
  onAnalyze: () => void;
  keywordAnalysis?: KeywordAnalysis | null;
  isAnalyzing?: boolean;
}

export const JobMatchSection: React.FC<JobMatchSectionProps> = ({ currentJob, onAnalyze, keywordAnalysis, isAnalyzing }) => {
  if (!currentJob) {
    return (
      <div className="panel-section job-match-section">
        <div className="job-detect-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <p>On a job page? Click below to analyze it.</p>
          <button
            className="btn primary small"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            style={{ marginTop: '8px' }}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze This Job'}
          </button>
        </div>
      </div>
    );
  }

  const getScoreClass = (score: number) => {
    if (score >= 70) return 'good';
    if (score >= 50) return 'medium';
    return 'low';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 80) return '🔥 Excellent';
    if (score >= 60) return '👍 Good';
    return '⚡ Needs work';
  };

  return (
    <div className="panel-section job-match-section">
      <div className="section-header">
        <h4 className="section-title">Current Job</h4>
        <button
          className="btn secondary small"
          onClick={onAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : keywordAnalysis ? 'Re-analyze' : 'Analyze job to see match'}
        </button>
      </div>
      
      <div className="job-card">
        <h5 className="job-title">{currentJob.title}</h5>
        <p className="job-company">{currentJob.company}</p>
        {currentJob.location && (
          <span className="job-location">{currentJob.location}</span>
        )}
      </div>

      {keywordAnalysis && (
        <div className="keyword-results">
          {/* Score Ring */}
          <div className="keyword-score-wrapper">
            <div className={`keyword-score-ring ${getScoreClass(keywordAnalysis.matchScore)}`}>
              <svg viewBox="0 0 120 120" width="100" height="100">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(keywordAnalysis.matchScore / 100) * 327} 327`}
                  transform="rotate(-90 60 60)"
                  className="keyword-score-arc"
                />
              </svg>
              <div className="keyword-score-text">
                <span className="keyword-score-number">{keywordAnalysis.matchScore}%</span>
                <span className="keyword-score-label">Match</span>
              </div>
            </div>
            <p className="keyword-score-summary">
              {keywordAnalysis.present.length} of {keywordAnalysis.totalKeywords} keywords matched
            </p>
            <p className="keyword-score-quality">{getScoreEmoji(keywordAnalysis.matchScore)}</p>
          </div>

          {/* Present Keywords */}
          {keywordAnalysis.present.length > 0 && (
            <div className="keyword-group">
              <h5 className="keyword-group-title present-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                In Your Profile
              </h5>
              <div className="keyword-tags">
                {keywordAnalysis.present.map((kw) => (
                  <span key={kw} className="keyword-tag present">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Keywords */}
          {keywordAnalysis.missing.length > 0 && (
            <div className="keyword-group">
              <h5 className="keyword-group-title missing-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Missing Keywords
              </h5>
              <div className="keyword-tags">
                {keywordAnalysis.missing.map((kw) => (
                  <span key={kw} className="keyword-tag missing">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
