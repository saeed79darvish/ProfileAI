import React from 'react';
import type { JobInfo } from '../../types';

interface JobContextBannerProps {
  job: JobInfo | null;
}

/**
 * Compact "we know what job you're looking at" banner shown across every
 * panel state so the user immediately understands the extension is working.
 */
export const JobContextBanner: React.FC<JobContextBannerProps> = ({ job }) => {
  if (!job || (!job.title && !job.company)) {
    return (
      <div className="job-context-banner empty">
        <div className="jcb-logo empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <div className="jcb-text">
          <span className="jcb-title">No job detected</span>
          <span className="jcb-company">Open a job posting to get started</span>
        </div>
      </div>
    );
  }

  const company = job.company || 'Company';
  const initial = (company.trim()[0] || '?').toUpperCase();

  return (
    <div className="job-context-banner">
      <div className="jcb-logo">{initial}</div>
      <div className="jcb-text">
        <span className="jcb-title" title={job.title || undefined}>
          {job.title || 'Job posting'}
        </span>
        <span className="jcb-company">{company}</span>
      </div>
      <span className="jcb-badge">
        Job detected
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    </div>
  );
};
