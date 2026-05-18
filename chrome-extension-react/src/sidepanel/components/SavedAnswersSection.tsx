import React from 'react';

interface SavedAnswersSectionProps {
  count: number;
  onManage: () => void;
}

export const SavedAnswersSection: React.FC<SavedAnswersSectionProps> = ({ count, onManage }) => {
  return (
    <div className="panel-section">
      <div className="section-header">
        <h4 className="section-title">Saved Answers</h4>
        <span className="badge">{count}</span>
      </div>
      <p className="section-desc">Custom answers are saved automatically and reused for similar questions.</p>
      <button className="btn secondary small" onClick={onManage}>
        Manage Answers
      </button>
    </div>
  );
};
