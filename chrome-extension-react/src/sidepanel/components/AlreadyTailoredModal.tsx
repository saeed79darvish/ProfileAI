import React from 'react';
import './tailorFlow.css';

interface Props {
  open: boolean;
  jobTitle?: string;
  company?: string;
  /** '1 credit', or '' when tailoring is unlimited. */
  costLabel: string;
  onOpen: () => void;
  onStartOver: () => void;
  onCancel: () => void;
}

/**
 * Tailoring a job that already has a tailored copy. Opening that copy is free;
 * starting over costs a tailoring credit and says so. The same choice the web
 * app's AlreadyTailoredModal offers, so the extension and the job page agree.
 */
export const AlreadyTailoredModal: React.FC<Props> = ({ open, jobTitle, company, costLabel, onOpen, onStartOver, onCancel }) => {
  if (!open) return null;
  return (
    <div className="att-backdrop" role="presentation" onClick={onCancel}>
      <div className="att-card" role="dialog" aria-modal="true" aria-label="Already tailored" onClick={(e) => e.stopPropagation()}>
        <h3>Already tailored</h3>
        <p>
          You already have a resume tailored for <strong>{jobTitle || 'this job'}{company ? ` at ${company}` : ''}</strong>.
          Open it for free, or start over.
        </p>
        <div className="att-buttons">
          <button type="button" className="tf-btn primary full" onClick={onOpen}>Open my tailored resume</button>
          <button type="button" className="tf-btn secondary full" onClick={onStartOver}>
            Start over{costLabel ? ` · ${costLabel}` : ''}
          </button>
          <button type="button" className="att-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
