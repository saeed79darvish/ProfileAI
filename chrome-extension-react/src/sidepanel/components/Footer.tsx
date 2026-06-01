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
      <span>ProfileAI v1.0.0</span>
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
