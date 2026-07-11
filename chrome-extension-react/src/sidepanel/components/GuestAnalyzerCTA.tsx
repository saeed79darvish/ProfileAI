import React from 'react';

interface GuestAnalyzerCTAProps {
  onClick: () => void;
  loading?: boolean;
}

/**
 * Signed-out entry card for the LinkedIn Profile Analyzer.
 * Sits above the pill on any linkedin.com/in/* tab when the user isn't
 * signed in. This is the acquisition surface — it MUST NOT route to sign-in
 * (that's what the fallback pill already did before). Clicking runs the
 * guest analyzer directly.
 */
export const GuestAnalyzerCTA: React.FC<GuestAnalyzerCTAProps> = ({ onClick, loading }) => {
  return (
    <div className="guest-analyzer-cta">
      <div className="gac-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3l1.9 5.2L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.8L12 3z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="gac-copy">
        <div className="gac-title">See your profile the way recruiters do</div>
        <div className="gac-sub">Free instant analysis — no account needed</div>
      </div>
      <button
        type="button"
        className="gac-cta"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? 'Analyzing…' : 'Analyze my profile'}
      </button>
    </div>
  );
};
