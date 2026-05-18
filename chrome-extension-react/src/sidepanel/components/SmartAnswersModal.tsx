import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { DetectedQuestion, SmartAnswer, JobInfo } from '../../types';

interface SmartAnswersModalProps {
  open: boolean;
  onClose: () => void;
  currentJob: JobInfo | null;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onAnswersGenerated?: (count?: number) => void;
}

type Status = 'detecting' | 'empty' | 'generating' | 'ready' | 'error';

export const SmartAnswersModal: React.FC<SmartAnswersModalProps> = ({
  open,
  onClose,
  currentJob,
  onNotification,
  onAnswersGenerated,
}) => {
  const [status, setStatus] = useState<Status>('detecting');
  const [questions, setQuestions] = useState<DetectedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, SmartAnswer>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const ranOnce = useRef(false);

  const runDetectAndAnswer = useCallback(async () => {
    setStatus('detecting');
    setErrorMsg('');
    try {
      // Ask content script to scan the active tab.
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const detectResp = await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_QUESTIONS' }).catch(() => null);
      const detected: DetectedQuestion[] = Array.isArray(detectResp?.questions) ? detectResp.questions : [];
      if (detected.length === 0) {
        setQuestions([]);
        setStatus('empty');
        return;
      }
      setQuestions(detected);

      // Initial state: each as loading.
      const initial: Record<string, SmartAnswer> = {};
      detected.forEach((q) => {
        initial[q.id] = {
          questionId: q.id,
          question: q.question,
          answer: '',
          source: 'ai',
          loading: true,
        };
      });
      setAnswers(initial);
      setStatus('generating');

      const resp = await chrome.runtime.sendMessage({
        type: 'GENERATE_SMART_ANSWERS',
        data: {
          questions: detected,
          jobInfo: currentJob,
          jobUrl: tab.url || '',
        },
      });

      if (!resp?.success) {
        throw new Error(resp?.error || 'Failed to generate answers');
      }

      // resp.results: Array<{ questionId, answer, source }>
      const next: Record<string, SmartAnswer> = { ...initial };
      (resp.results || []).forEach((r: any) => {
        next[r.questionId] = {
          questionId: r.questionId,
          question: next[r.questionId]?.question || r.question || '',
          answer: r.answer || '',
          source: r.source || 'ai',
          loading: false,
        };
      });
      setAnswers(next);
      setStatus('ready');
      onAnswersGenerated?.(detected.length);
    } catch (err) {
      console.warn('[ProfileAI] Smart answers failed', err);
      setErrorMsg((err as Error).message || 'Could not generate answers');
      setStatus('error');
    }
  }, [currentJob, onAnswersGenerated]);

  useEffect(() => {
    if (open && !ranOnce.current) {
      ranOnce.current = true;
      runDetectAndAnswer();
    }
    if (!open) {
      ranOnce.current = false;
    }
  }, [open, runDetectAndAnswer]);

  const handleCopy = useCallback(async (qid: string) => {
    const a = answers[qid];
    if (!a?.answer) return;
    try {
      await navigator.clipboard.writeText(a.answer);
      onNotification('Answer copied to clipboard', 'success');
    } catch {
      onNotification('Could not copy', 'error');
    }
  }, [answers, onNotification]);

  const handleInsert = useCallback(async (qid: string) => {
    const a = answers[qid];
    if (!a?.answer) return;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return;
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: 'INSERT_ANSWER',
        data: { questionId: qid, answer: a.answer },
      });
      if (resp?.success) {
        onNotification('Inserted into field', 'success');
      } else {
        onNotification('Could not find the field on the page — try Copy instead', 'warning');
      }
    } catch {
      onNotification('Could not reach the page — try Copy instead', 'warning');
    }
  }, [answers, onNotification]);

  const handleRegenerate = useCallback(async (qid: string) => {
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], loading: true, error: undefined } }));
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const resp = await chrome.runtime.sendMessage({
        type: 'GENERATE_SINGLE_ANSWER',
        data: {
          question: q,
          jobInfo: currentJob,
          jobUrl: tab?.url || '',
          forceRegenerate: true,
        },
      });
      if (!resp?.success) throw new Error(resp?.error || 'Regen failed');
      setAnswers((prev) => ({
        ...prev,
        [qid]: {
          ...prev[qid],
          answer: resp.answer || '',
          source: resp.source || 'ai',
          loading: false,
          edited: false,
        },
      }));
    } catch (err) {
      setAnswers((prev) => ({
        ...prev,
        [qid]: { ...prev[qid], loading: false, error: (err as Error).message || 'Regen failed' },
      }));
    }
  }, [questions, currentJob]);

  const handleEditChange = (qid: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { ...prev[qid], answer: value, edited: true },
    }));
  };

  const handleEditSave = async (qid: string) => {
    const a = answers[qid];
    if (!a) return;
    setEditingId(null);
    // Save user-edited version to saved answers so it sticks for next time.
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_ANSWER',
        data: { question: a.question, answer: a.answer },
      });
    } catch (_) {}
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container smart-answers-modal">
        <div className="modal-header">
          <div>
            <h3>Answer Questions</h3>
            {currentJob && (
              <p className="smart-answers-subtitle">
                {currentJob.title}{currentJob.company ? ` · ${currentJob.company}` : ''}
              </p>
            )}
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {status === 'detecting' && (
            <div className="smart-answers-status">
              <div className="spinner" />
              <p>Scanning the page for open-ended questions…</p>
            </div>
          )}

          {status === 'empty' && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p>No open-ended questions detected</p>
              <span>Open the application form (textareas, "tell us about…" prompts) and try again.</span>
              <button className="btn primary small" onClick={runDetectAndAnswer} style={{ marginTop: 12 }}>
                Scan Again
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="empty-state">
              <p>{errorMsg || 'Something went wrong'}</p>
              <button className="btn primary small" onClick={runDetectAndAnswer} style={{ marginTop: 12 }}>
                Retry
              </button>
            </div>
          )}

          {(status === 'generating' || status === 'ready') && (
            <div className="smart-answers-list">
              {status === 'generating' && (
                <p className="smart-answers-progress">
                  Generating tailored answers using your profile and the job context…
                </p>
              )}
              {questions.map((q) => {
                const a = answers[q.id];
                const isEditing = editingId === q.id;
                return (
                  <div key={q.id} className="smart-answer-item">
                    <div className="smart-answer-question">
                      {q.question}
                      {a?.source && a.source !== 'ai' && (
                        <span className={`smart-answer-source ${a.source}`}>
                          {a.source === 'cache' ? 'cached' : 'saved'}
                        </span>
                      )}
                    </div>

                    {a?.loading ? (
                      <div className="smart-answer-loading">
                        <div className="spinner" />
                        <span>Drafting…</span>
                      </div>
                    ) : a?.error ? (
                      <div className="smart-answer-error">
                        {a.error}
                        <button className="btn-link" onClick={() => handleRegenerate(q.id)}>Retry</button>
                      </div>
                    ) : isEditing ? (
                      <textarea
                        className="smart-answer-edit"
                        value={a?.answer || ''}
                        onChange={(e) => handleEditChange(q.id, e.target.value)}
                        rows={5}
                        autoFocus
                      />
                    ) : (
                      <div className="smart-answer-text">{a?.answer || '—'}</div>
                    )}

                    <div className="smart-answer-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-link" onClick={() => handleEditSave(q.id)}>Save</button>
                          <button className="btn-link" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-link"
                            disabled={!a?.answer || a?.loading}
                            onClick={() => handleCopy(q.id)}
                          >Copy</button>
                          <button
                            className="btn-link"
                            disabled={!a?.answer || a?.loading}
                            onClick={() => handleInsert(q.id)}
                          >Insert</button>
                          <button
                            className="btn-link"
                            disabled={!a?.answer || a?.loading}
                            onClick={() => setEditingId(q.id)}
                          >Edit</button>
                          <button
                            className="btn-link"
                            disabled={a?.loading}
                            onClick={() => handleRegenerate(q.id)}
                          >Regenerate</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="smart-answers-foot-note">
            Nothing is auto-submitted. Review each answer before pasting.
          </p>
          <button className="btn primary small" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};
