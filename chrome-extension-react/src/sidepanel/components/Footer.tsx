import React from 'react';

interface FooterProps {
  onLogout: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onLogout }) => {
  const openPersonalization = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_ONBOARDING' });
  };

  return (
    <footer className="footer">
      {/* Read from the manifest, never hardcoded. A pinned "v1.0.0" sat here
          while the manifest said 1.0.8, so the panel could not tell anyone
          which build they were actually running — which is the first question
          asked whenever a fix "isn't working". */}
      <span>ProfilleAI v{chrome.runtime?.getManifest?.()?.version ?? '—'}</span>
      <button onClick={openPersonalization} className="footer-link" title="Edit your AI personalization settings">
        AI Settings
      </button>
      <a href="https://www.profilleai.com/extension" target="_blank" rel="noopener noreferrer">
        Help
      </a>
      <button onClick={onLogout}>Sign Out</button>
    </footer>
  );
};
