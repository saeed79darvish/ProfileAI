import React from 'react';

// Credit required by the CC BY 4.0 license of the board directory the backend
// imports employer job boards from (backend/data/README.md). Keep it visible on
// every jobs list while any imported board is active.
const link = { color: 'inherit', textDecoration: 'underline' };

export default function SourcesCredit() {
  return (
    <p style={{ margin: '12px 16px 20px', fontSize: 11.5, lineHeight: 1.5, color: '#98A2B3', textAlign: 'center' }}>
      Jobs come straight from employers' own career pages. Some employers were found through the{' '}
      <a href="https://github.com/storesignalhq/ats-job-boards" target="_blank" rel="noopener noreferrer" style={link}>
        StoreSignal ATS job boards directory
      </a>
      , used under{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={link}>
        CC BY 4.0
      </a>
      .
    </p>
  );
}
