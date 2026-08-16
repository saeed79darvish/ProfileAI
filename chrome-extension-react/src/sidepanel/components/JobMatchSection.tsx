import React, { useState } from 'react';
import type { JobInfo, KeywordAnalysis } from '../../types';
import {
  rankMissingKeywords,
  predictBoostedScore,
  scoreVerdict,
  type Impact,
} from '../keywordInsights';

interface JobMatchSectionProps {
  currentJob: JobInfo | null;
  onAnalyze: () => void;
  keywordAnalysis?: KeywordAnalysis | null;
  isAnalyzing?: boolean;
  /** The AI second pass is still running over the instant local result. */
  isRefining?: boolean;
  onTailor?: () => void;
  isTailoring?: boolean;
  /** When a tailored result is showing, collapse to just the job row. */
  hasTailored?: boolean;
}

const impactLabel: Record<Impact, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low',
};

const JobRow: React.FC<{ job: JobInfo; onAnalyze: () => void; isAnalyzing?: boolean; analyzed: boolean }> = ({
  job,
  onAnalyze,
  isAnalyzing,
  analyzed,
}) => {
  const initial = (job.company?.trim()[0] || job.title?.trim()[0] || '?').toUpperCase();
  return (
    <div className="jm-job-row">
      <div className="jm-job-logo">{initial}</div>
      <div className="jm-job-meta">
        <span className="jm-job-title" title={job.title || undefined}>{job.title || 'Job posting'}</span>
        {job.company && <span className="jm-job-company">{job.company}</span>}
      </div>
      <button className="jm-reanalyze" onClick={onAnalyze} disabled={isAnalyzing}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        {isAnalyzing ? 'Analyzing…' : analyzed ? 'Re-analyze' : 'Analyze'}
      </button>
    </div>
  );
};

export const JobMatchSection: React.FC<JobMatchSectionProps> = ({
  currentJob,
  onAnalyze,
  keywordAnalysis,
  isAnalyzing,
  isRefining,
  onTailor,
  isTailoring,
  hasTailored,
}) => {
  const [showAllMissing, setShowAllMissing] = useState(false);

  if (!currentJob) {
    // Compact empty state — single row, no big icon block. Half the vertical
    // footprint of the old version. Always visible so the job workflow stays
    // one click away regardless of what page the user is on.
    return (
      <div className="panel-section job-match-section job-detect-compact">
        <div className="jd-compact-row">
          <svg
            className="jd-compact-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="jd-compact-text">Analyze current job page</span>
          <button
            className="btn primary small jd-compact-btn"
            onClick={onAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>
    );
  }

  const analyzed = !!keywordAnalysis;

  // When a tailored result is showing OR before any analysis, render the compact job row.
  if (hasTailored || !keywordAnalysis) {
    return (
      <div className="panel-section job-match-section">
        <JobRow job={currentJob} onAnalyze={onAnalyze} isAnalyzing={isAnalyzing} analyzed={analyzed} />
        {!hasTailored && !analyzed && (
          <button
            className="btn primary small full-width-btn"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            style={{ marginTop: 12 }}
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze job to see match'}
          </button>
        )}
      </div>
    );
  }

  const {
    matchScore,
    present,
    missing,
    totalKeywords,
    priorities,
    source,
    provisional,
    blockers,
    components,
    projectedScore,
    verdict: verdictLine,
  } = keywordAnalysis;
  const verdict = scoreVerdict(matchScore);
  const matchedCount = present.length;
  // Blockers are already the highest-impact missing requirements and get their
  // own section, so don't repeat them in the ranked list below.
  const blockerNames = new Set((blockers || []).map((b) => b.requirement.toLowerCase()));
  const ranked = rankMissingKeywords(
    missing.filter((m) => !blockerNames.has(m.toLowerCase())),
    priorities,
  );
  const visibleMissing = showAllMissing ? ranked : ranked.slice(0, 3);
  const hiddenMissing = ranked.length - visibleMissing.length;
  const boosted = predictBoostedScore(matchScore, projectedScore);
  const showBoost = !provisional && boosted > matchScore;

  const MATCHED_PREVIEW = 6;
  const visibleMatched = present.slice(0, MATCHED_PREVIEW);
  const hiddenMatched = present.length - visibleMatched.length;

  const missingSummary = missing.slice(0, 3).join(', ');

  return (
    <div className="panel-section job-match-section">
      <JobRow job={currentJob} onAnalyze={onAnalyze} isAnalyzing={isAnalyzing} analyzed />

      {/* Match card. The on-device pass compares vocabulary only — no title, no
          seniority, no evidence — so it shows what it found and withholds the
          number until the server has actually screened the candidate. */}
      <div className={`jm-match-card ${provisional ? 'pending' : verdict.level}`}>
        <div className="jm-score-big">
          <span className="jm-score-num">{provisional ? '—' : `${matchScore}%`}</span>
          <span className="jm-score-cap">Match</span>
        </div>
        <div className="jm-score-detail">
          {!provisional && (
            <span className={`jm-verdict ${verdict.level}`}>
              <span className="jm-verdict-dot" />
              {verdict.label}
            </span>
          )}
          {provisional ? (
            <p className="jm-progress-count">{totalKeywords} terms found in this posting</p>
          ) : (
            <div className="jm-progress-row">
              <span className="jm-progress-count">
                {matchedCount} / {totalKeywords} requirements
              </span>
              <div className="jm-progress-track">
                <div className="jm-progress-fill" style={{ width: `${Math.min(100, matchScore)}%` }} />
              </div>
              <span className="jm-progress-pct">{matchScore}%</span>
            </div>
          )}
          {/* Says which pass produced these numbers: the instant on-device
              scan, or the deeper AI read that replaces it moments later. */}
          <p className="jm-source-note">
            {isRefining
              ? 'Keyword scan done — scoring against your experience…'
              : source === 'ai'
                ? 'Scored against your title, experience and skills'
                : 'Keyword scan only — no score yet'}
          </p>
          {verdictLine && !provisional && <p className="jm-verdict-line">{verdictLine}</p>}
          {components && !provisional && components.cappedByBlockers && (
            <p className="jm-missing-summary">
              Score capped — this application would be filtered out before a human reads it.
            </p>
          )}
          {provisional && missing.length > 0 && (
            <p className="jm-missing-summary">
              {missing.length} term{missing.length === 1 ? '' : 's'} not in your profile
              {missingSummary && <> — {missingSummary}</>}
            </p>
          )}
        </div>
      </div>

      {/* ATS blockers — required, unevidenced, and of a kind a screen filters on */}
      {!!blockers?.length && (
        <div className="jm-kw-group">
          <h5 className="jm-kw-title missing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="13" />
              <line x1="12" y1="16" x2="12" y2="16" />
            </svg>
            Will fail screening ({blockers.length})
          </h5>
          <div className="jm-missing-list">
            {blockers.map((b) => (
              <div key={b.requirement} className="jm-missing-item blocker">
                <span className="jm-impact-dot high" />
                <div className="jm-blocker-text">
                  <span className="jm-missing-name">{b.requirement}</span>
                  <span className="jm-blocker-why">{b.why}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI boost predictor */}
      {showBoost && (
        <div className="jm-boost-card">
          <svg className="jm-boost-spark" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c.5 6 5.5 11 12 12-6.5 1-11.5 6-12 12-.5-6-5.5-11-12-12C6.5 11 11.5 6 12 0z" />
          </svg>
          <div className="jm-boost-text">
            <p className="jm-boost-title">Tailoring can reach <span className="jm-boost-pct">~{boosted}%</span></p>
            <p className="jm-boost-sub">
              By surfacing experience you already have but haven't worded to match. Gaps you
              can't evidence stay gaps.
            </p>
          </div>
        </div>
      )}

      {/* Matched keywords */}
      {matchedCount > 0 && (
        <div className="jm-kw-group">
          <h5 className="jm-kw-title matched">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {provisional ? `Found in your profile (${matchedCount})` : `Evidenced (${matchedCount})`}
          </h5>
          <div className="jm-chips">
            {visibleMatched.map((kw) => (
              <span key={kw} className="kw-chip matched">{kw}</span>
            ))}
            {hiddenMatched > 0 && <span className="kw-chip matched muted">+{hiddenMatched} more</span>}
          </div>
        </div>
      )}

      {/* Remaining gaps, ranked. Blockers are excluded — they're above. */}
      {ranked.length > 0 && (
        <div className="jm-kw-group">
          <h5 className="jm-kw-title missing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {provisional ? 'Terms not in your profile' : 'Gaps — ranked by impact'}
          </h5>
          <div className="jm-missing-list">
            {visibleMissing.map(({ keyword, impact }) => (
              <div key={keyword} className="jm-missing-item">
                <span className={`jm-impact-dot ${impact}`} />
                <span className="jm-missing-name">{keyword}</span>
                <span className={`jm-impact-tag ${impact}`}>{impactLabel[impact]}</span>
              </div>
            ))}
          </div>
          {hiddenMissing > 0 && (
            <button className="jm-show-more" onClick={() => setShowAllMissing(true)}>
              Show {hiddenMissing} more missing keyword{hiddenMissing === 1 ? '' : 's'}
            </button>
          )}
          {showAllMissing && ranked.length > 3 && (
            <button className="jm-show-more" onClick={() => setShowAllMissing(false)}>
              Show less
            </button>
          )}
        </div>
      )}

      {/* Primary CTA */}
      {onTailor && (
        <>
          <button className="jm-tailor-cta" onClick={onTailor} disabled={isTailoring}>
            {isTailoring ? (
              <>
                <span className="jm-cta-spinner" />
                Tailoring…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="jm-cta-spark">
                  <path d="M12 0c.5 6 5.5 11 12 12-6.5 1-11.5 6-12 12-.5-6-5.5-11-12-12C6.5 11 11.5 6 12 0z" />
                </svg>
                Tailor Profile for This Job
              </>
            )}
          </button>
          <p className="jm-tailor-note">AI rewrites your profile to match — safe, additive edits only</p>
        </>
      )}
    </div>
  );
};
