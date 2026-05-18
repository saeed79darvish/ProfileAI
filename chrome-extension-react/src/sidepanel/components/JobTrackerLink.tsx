import React from 'react';
import { CONFIG } from '../../config';

export const JobTrackerLink: React.FC = () => {
  const openJobTracker = () => {
    chrome.tabs.create({ url: `${CONFIG.WEB_BASE}/jobs` });
  };

  return (
    <div className="panel-section">
      <button className="link-card" onClick={openJobTracker}>
        <div className="link-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="link-content">
          <span className="link-title">Browse Jobs</span>
          <span className="link-desc">Find opportunities on ProfileAI</span>
        </div>
        <svg className="link-arrow" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
};
