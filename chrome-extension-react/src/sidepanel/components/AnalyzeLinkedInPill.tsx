import React from 'react';

interface AnalyzeLinkedInPillProps {
  onClick: () => void;
  loading?: boolean;
  /** ms timestamp of an existing cached analysis for the current LinkedIn
   *  profile URL. When set, the pill flips to "view results" mode so the
   *  user knows they already analyzed this profile (and won't spend another
   *  credit by clicking). */
  analyzedAt?: number | null;
}

const formatAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
};

export const AnalyzeLinkedInPill: React.FC<AnalyzeLinkedInPillProps> = ({
  onClick,
  loading,
  analyzedAt,
}) => {
  const hasResult = !!analyzedAt && !loading;
  return (
    <button
      className={`profile-analyze-linkedin${hasResult ? ' analyzed' : ''}`}
      onClick={onClick}
      disabled={loading}
      title={
        hasResult
          ? 'You already analyzed this profile — opens the saved result. Re-analyze from inside if you want a fresh grade.'
          : 'Analyze this LinkedIn profile like a recruiter'
      }
    >
      <span className="pal-icon" aria-hidden>
        {loading ? (
          <div className="tailor-spinner small">
            <svg viewBox="0 0 36 36">
              <circle className="spinner-track" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
              <circle
                className="spinner-arc"
                cx="18"
                cy="18"
                r="15"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : hasResult ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
          </svg>
        )}
      </span>
      <span className="pal-text">
        <span className="pal-title">
          {loading
            ? 'Analyzing this profile…'
            : hasResult
              ? 'View LinkedIn analysis'
              : 'Analyze this LinkedIn profile'}
        </span>
        <span className="pal-sub">
          {loading
            ? 'Recruiter-POV grade + rewrites'
            : hasResult
              ? `Analyzed ${formatAgo(analyzedAt!)} · re-analyze inside`
              : 'Recruiter-POV grade + rewrites'}
        </span>
      </span>
      <svg className="pal-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};
