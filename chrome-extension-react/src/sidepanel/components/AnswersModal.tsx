import React, { useState, useEffect } from 'react';

interface AnswersModalProps {
  onClose: () => void;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export const AnswersModal: React.FC<AnswersModalProps> = ({ onClose, onNotification }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnswers();
  }, []);

  const loadAnswers = async () => {
    setLoading(true);
    const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
    setAnswers(savedAnswers || {});
    setLoading(false);
  };

  const deleteAnswer = async (question: string) => {
    const newAnswers = { ...answers };
    delete newAnswers[question];
    await chrome.storage.local.set({ savedAnswers: newAnswers });
    setAnswers(newAnswers);
  };

  const clearAllAnswers = async () => {
    if (confirm('Are you sure you want to delete all saved answers?')) {
      await chrome.storage.local.remove(['savedAnswers']);
      setAnswers({});
      onNotification('All answers cleared', 'success');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const entries = Object.entries(answers);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>Saved Answers</h3>
          <button className="btn-icon modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-desc">Your saved answers are reused automatically for similar questions.</p>
          
          {loading ? (
            <div className="loading-answers">
              <div className="spinner" />
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <p>No saved answers yet</p>
              <span>Answers will appear here after you fill out application forms.</span>
            </div>
          ) : (
            <div className="answers-list">
              {entries.map(([question, answer]) => (
                <div key={question} className="answer-item">
                  <div className="answer-question">{question}</div>
                  <div className="answer-text">{answer}</div>
                  <div className="answer-actions">
                    <button 
                      className="answer-delete" 
                      onClick={() => deleteAnswer(question)}
                      title="Delete this answer"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn secondary small" 
            onClick={clearAllAnswers}
            disabled={entries.length === 0}
          >
            Clear All
          </button>
          <button className="btn primary small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
