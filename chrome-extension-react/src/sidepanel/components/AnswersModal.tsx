import React, { useState, useEffect, useCallback } from 'react';
import { buildSavedRows, type LearnedItem, type SavedRow } from '../../answerMemory';
import { learnedList, learnedEdit, learnedDelete } from '../memoryApi';

interface AnswersModalProps {
  onClose: () => void;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

const PRIVACY_LINE = 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.';

export const AnswersModal: React.FC<AnswersModalProps> = ({ onClose, onNotification }) => {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [learned, setLearned] = useState<LearnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
    setLocal(savedAnswers || {});
    const r = await learnedList(true);
    if (r.ok) { setLearned(r.items); setLoadError(''); }
    else setLoadError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows: SavedRow[] = buildSavedRows(learned, local);

  const deleteRow = async (row: SavedRow) => {
    if (row.type === 'local') {
      const next = { ...local };
      delete next[row.id];
      await chrome.storage.local.set({ savedAnswers: next });
      setLocal(next);
      return;
    }
    setBusyId(row.id);
    const r = await learnedDelete(row.id);
    setBusyId(null);
    if (r.ok) setLearned((prev) => prev.filter((l) => l.id !== row.id));
    else onNotification(r.error || 'Could not delete that', 'error');
  };

  const startEdit = (row: SavedRow) => {
    setEditingId(row.id);
    setDraft(row.answer);
  };

  const saveEdit = async (row: SavedRow) => {
    const text = draft.trim();
    if (!text) return;
    if (row.type === 'local') {
      const next = { ...local, [row.id]: text };
      await chrome.storage.local.set({ savedAnswers: next });
      setLocal(next);
      setEditingId(null);
      return;
    }
    setBusyId(row.id);
    const r = await learnedEdit(row.id, text);
    setBusyId(null);
    if (r.ok) {
      setLearned((prev) => prev.map((l) => (l.id === row.id ? { ...l, ...(r.item || {}), answer: r.item?.answer || text } : l)));
      setEditingId(null);
    } else {
      onNotification(r.error, 'error');
    }
  };

  const clearLocal = async () => {
    if (confirm('Are you sure you want to delete the answers saved on this device?')) {
      await chrome.storage.local.remove(['savedAnswers']);
      setLocal({});
      onNotification('Answers saved on this device cleared', 'success');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h3>Saved Answers</h3>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            When you answer a question on an application, we remember it and fill it in for you the next time the same kind of question comes up, even when it is worded differently.
          </p>
          <p className="aq-privacy">{PRIVACY_LINE}</p>
          {loadError && <p className="aq-note">{loadError} Showing what is saved on this device.</p>}

          {loading ? (
            <div className="loading-answers">
              <div className="spinner" />
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <p>Nothing remembered yet</p>
              <span>Answer a dropdown or short question on an application and it shows up here. Next time, we fill it in and never ask you again.</span>
            </div>
          ) : (
            <div className="answers-list">
              {rows.map((row) => {
                const editing = editingId === row.id;
                const busy = busyId === row.id;
                return (
                  <div key={`${row.type}:${row.id}`} className="answer-item">
                    <div className="answer-question">{row.question}</div>
                    {editing ? (
                      <>
                        <input
                          className="aq-input"
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(row); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <div className="answer-actions">
                          <button className="aq-btn primary" disabled={busy || !draft.trim()} onClick={() => saveEdit(row)}>Save</button>
                          <button className="aq-btn" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="answer-text">{row.answer}</div>
                        {row.meta && <div className="answer-meta">{row.meta}</div>}
                        <div className="answer-actions">
                          <button className="aq-btn" disabled={busy} onClick={() => startEdit(row)}>Edit</button>
                          <button className="aq-btn" disabled={busy} onClick={() => deleteRow(row)} title="Delete this answer">Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn secondary small"
            onClick={clearLocal}
            disabled={Object.keys(local).length === 0}
          >
            Clear device answers
          </button>
          <button className="btn primary small" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
