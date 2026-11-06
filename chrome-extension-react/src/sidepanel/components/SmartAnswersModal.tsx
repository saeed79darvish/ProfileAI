import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MicCapture } from './MicCapture';
import type { DetectedQuestion, SmartAnswer, JobInfo } from '../../types';
import {
  deriveCardState, stateLabel, sourceLine, progressOf, progressLabel, wordStatus, matchFact,
  isSensitiveQuestion, canSaveFromOptions, saveDecision,
  youAnsweredLine, useSuggestionLabel, buildReviewList,
  type AnswerCatalog, type AnswerDetail, type NeedsFact, type LearnedFrom,
} from '../../answerMemory';
import { getCatalog, saveFact, learnedSave } from '../memoryApi';

/** A field Quick Fill filled from an earlier answer, as the page reports it. */
export interface ReusedQuestion {
  id: string;
  question: string;
  answer: string;
  options: string[];
  fieldType: 'select' | 'radio' | 'combobox';
  learnedId?: string;
  learnedFrom?: LearnedFrom;
}

/** One finished answer as the worker reports it. Older stored runs lack
 *  `detail`, and used a different `source` vocabulary, so both are read. */
interface ResultRow {
  questionId: string;
  question?: string;
  answer?: string;
  source?: string;
  detail?: AnswerDetail;
  cached?: 'job' | 'saved';
}

/** Snapshot of a generation that ran in the service worker, used to rebuild
 *  the modal when the panel was closed while it was working. */
export interface SmartAnswersRestore {
  questions: DetectedQuestion[];
  status: 'generating' | 'ready' | 'error';
  results?: ResultRow[];
  error?: string;
}

interface SmartAnswersModalProps {
  open: boolean;
  onClose: () => void;
  currentJob: JobInfo | null;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  onAnswersGenerated?: (count?: number) => void;
  /** Rehydration payload for a run this modal instance didn't start. When
   *  present the modal shows it instead of re-detecting (and re-billing). */
  restore?: SmartAnswersRestore | null;
  /** Show only dropdown and radio questions (opened after Quick Fill). */
  choicesOnly?: boolean;
  /** Fields Quick Fill filled from earlier answers, listed first with a Change button. */
  reused?: ReusedQuestion[];
  /** Bracket the batch request so the panel knows this instance is awaiting
   *  it and shouldn't also apply the mirrored result. */
  onOpStart?: () => void;
  onOpEnd?: () => void;
}

type Status = 'detecting' | 'empty' | 'generating' | 'ready' | 'error';
type Refine = 'shorter' | 'more_specific' | 'more_personal';

const REFINES: Array<{ id: Refine; label: string }> = [
  { id: 'shorter', label: 'Shorter' },
  { id: 'more_specific', label: 'More specific' },
  { id: 'more_personal', label: 'More personal' },
];

const PRIVACY_LINE = 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.';

const TEXT_TYPES = new Set(['textarea', 'longtext', 'contenteditable']);
const isTextQuestion = (q: DetectedQuestion) => TEXT_TYPES.has(q.fieldType);

function toCard(q: DetectedQuestion | undefined, r: ResultRow): SmartAnswer {
  const legacy = r.source === 'cache' ? 'job' : r.source === 'saved' ? 'saved' : undefined;
  const source = r.detail?.source || (['fact', 'story', 'profile', 'needs_you', 'learned'].includes(r.source || '') ? (r.source as AnswerDetail['source']) : 'ai');
  const answer = r.answer ?? r.detail?.answer ?? '';
  return {
    questionId: r.questionId,
    question: q?.question || r.question || '',
    answer,
    detail: r.detail ? { ...r.detail, answer } : { answer, source: answer ? source : 'needs_you' },
    cached: r.cached || legacy,
  };
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);

/** Inline quick answer for a question the memory cannot answer yet. */
const FactAsk: React.FC<{
  fact: NeedsFact;
  save: boolean;
  onToggleSave: (v: boolean) => void;
  onPick: (value: string, label: string) => void;
}> = ({ fact, save, onToggleSave, onPick }) => {
  const [text, setText] = useState('');
  const choices = fact.type === 'yesno'
    ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
    : fact.type === 'choice' ? (fact.choices || []) : [];
  return (
    <div className="aq-fact">
      <p className="aq-fact-ask">{fact.ask}</p>
      {choices.length > 0 ? (
        <div className="aq-choices">
          {choices.map((c) => (
            <button key={c.value} type="button" className="aq-choice" onClick={() => onPick(c.value, c.label)}>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="aq-text-row">
          <input
            className="aq-input"
            value={text}
            placeholder="Type your answer"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) onPick(text.trim(), text.trim()); }}
          />
          <button type="button" className="aq-choice primary" disabled={!text.trim()} onClick={() => onPick(text.trim(), text.trim())}>
            Use
          </button>
        </div>
      )}
      <label className="aq-toggle">
        <input type="checkbox" checked={save} onChange={(e) => onToggleSave(e.target.checked)} />
        <span>Save for next time</span>
      </label>
      {save && <p className="aq-privacy">{PRIVACY_LINE}</p>}
    </div>
  );
};

/** The form's own options as buttons, for a dropdown the memory cannot answer. */
const OptionAsk: React.FC<{
  options: string[];
  sensitive: boolean;
  canSave: boolean;
  save: boolean;
  onToggleSave: (v: boolean) => void;
  onPick: (option: string) => void;
  /** A stored answer that did not map to these options: one tap to try it. */
  suggestion?: string;
  onUseSuggestion?: () => void;
  /** Changing an answer that is already filled. */
  changing?: boolean;
  onCancel?: () => void;
}> = ({ options, sensitive, canSave, save, onToggleSave, onPick, suggestion, onUseSuggestion, changing, onCancel }) => (
  <div className="aq-fact">
    {suggestion && onUseSuggestion && (
      <button type="button" className="aq-choice primary aq-suggest" onClick={onUseSuggestion}>
        {useSuggestionLabel(suggestion)}
      </button>
    )}
    <p className="aq-fact-ask">
      {sensitive
        ? 'This one is yours to choose. We never save it or fill it for you.'
        : changing
          ? 'Choose another answer. It goes into the form and we will remember it.'
          : 'Choose your answer. It goes into the form as you pick it.'}
    </p>
    <div className="aq-choices">
      {options.map((o) => (
        <button key={o} type="button" className="aq-choice" onClick={() => onPick(o)}>{o}</button>
      ))}
    </div>
    {canSave && (
      <>
        <label className="aq-toggle">
          <input type="checkbox" checked={save} onChange={(e) => onToggleSave(e.target.checked)} />
          <span>Save for next time</span>
        </label>
        {save && <p className="aq-privacy">{PRIVACY_LINE}</p>}
      </>
    )}
    {onCancel && (
      <div className="aq-actions">
        <button type="button" className="aq-btn" onClick={onCancel}>Cancel</button>
      </div>
    )}
  </div>
);

export const SmartAnswersModal: React.FC<SmartAnswersModalProps> = ({
  open,
  onClose,
  currentJob,
  onNotification,
  onAnswersGenerated,
  restore = null,
  choicesOnly = false,
  reused = [],
  onOpStart,
  onOpEnd,
}) => {
  const [status, setStatus] = useState<Status>('detecting');
  const [questions, setQuestions] = useState<DetectedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, SmartAnswer>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [addText, setAddText] = useState<Record<string, string>>({});
  const [editDraft, setEditDraft] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [saveNext, setSaveNext] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [changeId, setChangeId] = useState<string | null>(null);
  const [reusedIds, setReusedIds] = useState<string[]>([]);
  const ranOnce = useRef(false);
  const highlightedId = useRef<string | null>(null);

  const setCard = useCallback((qid: string, patch: Partial<SmartAnswer>) => {
    setAnswers((prev) => (prev[qid] ? { ...prev, [qid]: { ...prev[qid], ...patch } } : prev));
  }, []);

  const highlight = useCallback(async (qid: string, on: boolean) => {
    if (on && highlightedId.current === qid) return;
    if (!on && highlightedId.current !== qid) return;
    highlightedId.current = on ? qid : null;
    try {
      const tabId = await activeTabId();
      if (tabId) await chrome.tabs.sendMessage(tabId, { type: 'HIGHLIGHT_FIELD', data: { questionId: qid, on } });
    } catch (_) { /* page not reachable: the card still works */ }
  }, []);

  const runDetectAndAnswer = useCallback(async () => {
    setStatus('detecting');
    setErrorMsg('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const [detectResp, catalog] = await Promise.all([
        chrome.tabs.sendMessage(tab.id, { type: 'DETECT_QUESTIONS' }).catch(() => null),
        getCatalog(),
      ]);
      const all: DetectedQuestion[] = Array.isArray(detectResp?.questions) ? detectResp.questions : [];
      // Text questions are drafted. A dropdown or radio group is answered from
      // the person's memory when it asks about a saved fact; every other one
      // that needs an answer is shown with its real options for the person.
      const detected = all.filter((q) => {
        if (isTextQuestion(q)) return !choicesOnly;
        const hasOptions = !!(q.options && q.options.length);
        return !!matchFact(q.question, catalog as AnswerCatalog | null)
          || (hasOptions && (!q.optional || isSensitiveQuestion(q.question)));
      });
      // Answers Quick Fill already put in from memory are listed first, and
      // nothing the person already answered is asked again.
      const reusedNow = choicesOnly ? reused : [];
      const reusedQs: DetectedQuestion[] = reusedNow.map((r, i) => ({
        id: r.id, question: r.question, fieldType: r.fieldType, options: r.options, optional: false, index: -1 - i,
      }));
      const reusedAnswers: Record<string, SmartAnswer> = {};
      reusedNow.forEach((r) => {
        reusedAnswers[r.id] = {
          questionId: r.id, question: r.question, answer: r.answer, done: true,
          detail: { answer: r.answer, source: 'learned', ...(r.learnedId ? { learnedId: r.learnedId } : {}), ...(r.learnedFrom ? { learnedFrom: r.learnedFrom } : {}) },
        };
      });
      const taken = new Set(reusedNow.map((r) => r.question.toLowerCase()));
      const fresh = detected.filter((q) => !taken.has(q.question.toLowerCase()));
      setReusedIds(reusedNow.map((r) => r.id));
      if (fresh.length === 0 && reusedQs.length === 0) {
        setQuestions([]);
        setStatus('empty');
        return;
      }
      if (fresh.length === 0) {
        setQuestions(reusedQs);
        setAnswers(reusedAnswers);
        setStatus('ready');
        onAnswersGenerated?.(reusedQs.length);
        return;
      }
      const detectedAll = [...reusedQs, ...fresh];
      setQuestions(detectedAll);

      const initial: Record<string, SmartAnswer> = { ...reusedAnswers };
      fresh.forEach((q) => {
        initial[q.id] = { questionId: q.id, question: q.question, answer: '', detail: { answer: '', source: 'ai' }, loading: true };
      });
      setAnswers(initial);
      setStatus('generating');

      onOpStart?.();
      let resp: any;
      try {
        resp = await chrome.runtime.sendMessage({
          type: 'GENERATE_SMART_ANSWERS',
          data: {
            questions: fresh.map((q) => ({
              id: q.id, question: q.question, fieldType: q.fieldType,
              options: q.options || null, optional: q.optional, wordHint: q.wordHint || null,
            })),
            jobInfo: currentJob,
            jobUrl: tab.url || '',
          },
        });
      } finally {
        onOpEnd?.();
      }

      if (!resp?.success) throw new Error(resp?.error || 'Failed to generate answers');

      const next: Record<string, SmartAnswer> = { ...initial };
      (resp.results || []).forEach((r: ResultRow) => {
        next[r.questionId] = toCard(fresh.find((q) => q.id === r.questionId), r);
      });
      Object.keys(next).forEach((k) => { next[k] = { ...next[k], loading: false }; });
      setAnswers(next);
      setStatus('ready');
      onAnswersGenerated?.(detectedAll.length);
    } catch (err) {
      console.warn('[ProfileAI] Smart answers failed', err);
      setErrorMsg((err as Error).message || 'Could not generate answers');
      setStatus('error');
    }
    // onOpStart/onOpEnd are deliberately not dependencies: the panel passes
    // fresh arrows on every render and they only touch a ref.
  }, [currentJob, onAnswersGenerated, choicesOnly, reused]);

  // Rehydrate from a background run. Declared BEFORE the auto-run effect so
  // `ranOnce` is already set by the time that one checks it, otherwise
  // reopening onto a finished run would fire a second (billed) generation.
  useEffect(() => {
    if (!open || !restore) return;
    ranOnce.current = true;
    setQuestions(restore.questions || []);
    if (restore.status === 'error') {
      setErrorMsg(restore.error || 'Could not generate answers');
      setStatus('error');
      return;
    }
    const next: Record<string, SmartAnswer> = {};
    (restore.questions || []).forEach((q) => {
      next[q.id] = { questionId: q.id, question: q.question, answer: '', detail: { answer: '', source: 'ai' }, loading: restore.status === 'generating' };
    });
    (restore.results || []).forEach((r) => {
      next[r.questionId] = toCard((restore.questions || []).find((q) => q.id === r.questionId), r);
    });
    setAnswers(next);
    setStatus(restore.status === 'generating' ? 'generating' : 'ready');
    if (restore.status === 'ready') onAnswersGenerated?.((restore.questions || []).length);
    // Only the payload itself may re-hydrate: depending on the callback would
    // rebuild (and wipe) the answers on every parent render.
  }, [open, restore]);

  useEffect(() => {
    if (open && !ranOnce.current) {
      ranOnce.current = true;
      runDetectAndAnswer();
    }
    if (!open) {
      ranOnce.current = false;
      setMenuId(null);
      setEditingId(null);
      setChangeId(null);
      if (highlightedId.current) void highlight(highlightedId.current, false);
    }
  }, [open, runDetectAndAnswer, highlight]);

  const insertInto = useCallback(async (qid: string, answer: string, choiceValue?: string, replace?: boolean): Promise<boolean> => {
    const tabId = await activeTabId();
    if (!tabId) return false;
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'INSERT_ANSWER', data: { questionId: qid, answer, choiceValue, replace } });
      return !!resp?.success;
    } catch {
      return false;
    }
  }, []);

  const handleUse = useCallback(async (qid: string) => {
    const a = answers[qid];
    if (!a?.answer) return;
    const ok = await insertInto(qid, a.answer, a.detail.choiceValue);
    if (ok) {
      setCard(qid, { done: true });
      onNotification('Filled in on the page', 'success');
    } else {
      onNotification('Could not fill that field. Copy the answer and paste it in.', 'warning');
    }
  }, [answers, insertInto, onNotification, setCard]);

  const readyIds = (): string[] => questions
    .map((q) => q.id)
    .filter((id) => {
      const a = answers[id];
      const q = questions.find((x) => x.id === id);
      if (!a || a.loading || a.done || !a.answer) return false;
      const s = deriveCardState({ detail: a.detail, answer: a.answer, edited: a.edited, optional: q?.optional });
      return s === 'ready' || s === 'ai';
    });

  const handleFillAll = useCallback(async () => {
    const ids = readyIds();
    let filled = 0;
    for (const id of ids) {
      const a = answers[id];
      if (await insertInto(id, a.answer, a.detail.choiceValue)) {
        filled++;
        setCard(id, { done: true });
      }
    }
    if (filled === ids.length) onNotification(`Filled ${filled} answer${filled === 1 ? '' : 's'}. Review them before you submit.`, 'success');
    else onNotification(`Filled ${filled} of ${ids.length}. Copy the rest from their cards.`, 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questions, insertInto, onNotification, setCard]);

  const handleCopy = useCallback(async (qid: string) => {
    setMenuId(null);
    const a = answers[qid];
    if (!a?.answer) return;
    try {
      await navigator.clipboard.writeText(a.answer);
      onNotification('Answer copied to clipboard', 'success');
    } catch {
      onNotification('Could not copy', 'error');
    }
  }, [answers, onNotification]);

  const handleRegenerate = useCallback(async (qid: string, instruction?: Refine, extraDetail?: string) => {
    setMenuId(null);
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    setCard(qid, { loading: true, error: undefined });
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const resp = await chrome.runtime.sendMessage({
        type: 'GENERATE_SINGLE_ANSWER',
        data: {
          question: { id: q.id, question: q.question, fieldType: q.fieldType, options: q.options || null, optional: q.optional, wordHint: q.wordHint || null },
          jobInfo: currentJob,
          jobUrl: tab?.url || '',
          forceRegenerate: true,
          instruction,
          extraDetail,
        },
      });
      if (!resp?.success) throw new Error(resp?.error || 'Could not write a new version');
      const detail: AnswerDetail = resp.detail || { answer: resp.answer || '', source: 'ai' };
      setCard(qid, { answer: resp.answer || detail.answer || '', detail, cached: undefined, loading: false, edited: false, done: false });
    } catch (err) {
      setCard(qid, { loading: false, error: (err as Error).message || 'Could not write a new version' });
    }
  }, [questions, currentJob, setCard]);

  const handleEditSave = async (qid: string) => {
    const a = answers[qid];
    if (!a) return;
    setEditingId(null);
    setCard(qid, { answer: editDraft, edited: true, done: false });
    // Keep the person's own wording for next time.
    try {
      await chrome.runtime.sendMessage({ type: 'SAVE_ANSWER', data: { question: a.question, answer: editDraft } });
    } catch (_) {}
  };

  /** Remember what the person chose, with the job it was chosen for. Quiet when nothing is kept. */
  const remember = useCallback(async (question: string, answer: string, kind: 'choice' | 'text', options?: string[]) => {
    return learnedSave({ question, answer, kind, options, company: currentJob?.company, jobTitle: currentJob?.title });
  }, [currentJob]);

  /** Change an answer that came from memory: fill the page, then update the stored item. */
  const handleChangePick = useCallback(async (qid: string, option: string) => {
    const q = questions.find((x) => x.id === qid);
    const a = answers[qid];
    if (!q || !a) return;
    setChangeId(null);
    setCard(qid, { loading: true, error: undefined });
    const ok = await insertInto(qid, option, undefined, true);
    const item = await remember(q.question, option, 'choice', q.options);
    const detail: AnswerDetail = {
      answer: option,
      source: 'learned',
      learnedId: item?.id || a.detail.learnedId,
      learnedFrom: { question: q.question, ...(currentJob?.company ? { company: currentJob.company } : {}), at: new Date().toISOString() },
    };
    setCard(qid, { loading: false, answer: option, detail, edited: false, done: ok });
    if (ok) onNotification('Changed, and we will remember it', 'success');
    else onNotification('Could not set that dropdown. Choose it on the page.', 'warning');
  }, [questions, answers, currentJob, insertInto, remember, onNotification, setCard]);

  /** One tap on a stored answer that did not map to the form's options. */
  const handleSuggestionUse = useCallback(async (qid: string, suggestion: string) => {
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    setCard(qid, { loading: true, error: undefined });
    const ok = await insertInto(qid, suggestion);
    if (ok) {
      setCard(qid, { loading: false, answer: suggestion, detail: { answer: suggestion, source: 'learned' }, edited: false, done: true });
      onNotification('Filled in on the page', 'success');
    } else {
      setCard(qid, { loading: false });
      onNotification('That is not one of this form\'s options. Choose one below.', 'warning');
    }
  }, [questions, insertInto, onNotification, setCard]);

  /** The person answered a question the memory did not cover. */
  const handleFactPick = useCallback(async (qid: string, fact: NeedsFact, value: string, label: string) => {
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    const save = saveNext[qid] !== false;
    setCard(qid, { loading: true, error: undefined });
    let detail: AnswerDetail = { answer: label, source: 'fact', factId: fact.id, choiceValue: value };
    if (save) {
      const saved = await saveFact(fact.id, value);
      if (saved) {
        // The server now knows the fact, so it can map it to this exact question.
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          const resp = await chrome.runtime.sendMessage({
            type: 'GENERATE_SINGLE_ANSWER',
            data: {
              question: { id: q.id, question: q.question, fieldType: q.fieldType, options: q.options || null, optional: q.optional, wordHint: q.wordHint || null },
              jobInfo: currentJob, jobUrl: tab?.url || '', forceRegenerate: true,
            },
          });
          if (resp?.success && resp.detail?.source === 'fact' && resp.detail.answer) detail = resp.detail;
        } catch (_) { /* keep the local answer */ }
      } else {
        onNotification('Could not save that for next time. Filling it in anyway.', 'warning');
      }
    }
    const ok = await insertInto(qid, detail.answer, detail.choiceValue);
    setCard(qid, { loading: false, answer: detail.answer, detail, edited: false, done: ok });
    if (save) void remember(q.question, label, fact.type === 'text' ? 'text' : 'choice', q.options);
    if (ok) onNotification(save ? 'Filled in and saved for next time' : 'Filled in on the page', 'success');
    else onNotification('Saved, but this field needs you. Choose it on the page.', 'warning');
  }, [questions, saveNext, currentJob, insertInto, remember, onNotification, setCard]);

  /** The person chose one of the form's real options. */
  const handleOptionPick = useCallback(async (qid: string, option: string) => {
    const q = questions.find((x) => x.id === qid);
    const a = answers[qid];
    if (!q || !a) return;
    const fact = a.detail.needsFact || null;
    const decision = saveNext[qid] !== false ? saveDecision(fact, q.question, option) : null;
    setCard(qid, { loading: true, error: undefined });
    let saved = false;
    if (decision) {
      saved = await saveFact(decision.factId, decision.value);
      if (!saved) onNotification('Could not save that for next time. Filling it in anyway.', 'warning');
    }
    const detail: AnswerDetail = { answer: option, source: 'fact', ...(fact ? { factId: fact.id } : {}) };
    const ok = await insertInto(qid, option);
    setCard(qid, { loading: false, answer: option, detail, edited: false, done: ok });
    if (saveNext[qid] !== false) void remember(q.question, option, 'choice', q.options);
    if (ok) onNotification(saved ? 'Filled in and saved for next time' : 'Filled in on the page', 'success');
    else onNotification('Could not set that dropdown. Choose it on the page.', 'warning');
  }, [questions, answers, saveNext, insertInto, remember, onNotification, setCard]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  const cards = questions.map((q) => {
    const a = answers[q.id];
    const state = a ? deriveCardState({ detail: a.detail, answer: a.answer, edited: a.edited, optional: q.optional, cached: !!a.cached }) : 'needs_you';
    return { q, a, state, id: q.id, fromMemory: reusedIds.includes(q.id) };
  });
  const ordered = buildReviewList(cards);
  const orderedCards = [...ordered.reused, ...ordered.rest];
  const showGroups = ordered.reused.length > 0;
  const progress = progressOf(cards.map((c) => ({ state: c.state, done: c.a?.done, loading: c.a?.loading })));
  const readyCount = status === 'ready' ? readyIds().length : 0;
  const pct = progress.total ? Math.round((progress.ready / progress.total) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container smart-answers-modal" onClick={() => setMenuId(null)}>
        <div className="modal-header">
          <div>
            <h3>{choicesOnly ? 'Choose your answers' : 'Answer Questions'}</h3>
            {currentJob && (
              <p className="smart-answers-subtitle">
                {currentJob.title}{currentJob.company ? ` at ${currentJob.company}` : ''}
              </p>
            )}
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {(status === 'ready' || status === 'generating') && questions.length > 0 && (
          <div className="aq-progress">
            <div className="aq-progress-top">
              <span className="aq-progress-label">
                {status === 'generating' ? `Drafting ${questions.length} answer${questions.length === 1 ? '' : 's'}` : progressLabel(progress)}
              </span>
              {status === 'ready' && progress.done > 0 && <span className="aq-progress-done">{progress.done} filled</span>}
            </div>
            <div className="aq-bar"><div className="aq-bar-fill" style={{ width: `${status === 'ready' ? pct : 0}%` }} /></div>
          </div>
        )}

        <div className="modal-body">
          {status === 'detecting' && (
            <div className="smart-answers-status">
              <div className="spinner" />
              <p>Looking for questions on this page</p>
            </div>
          )}

          {status === 'empty' && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p>No questions found yet</p>
              <span>Open the application form (text boxes, "tell us about" prompts, sponsorship or location dropdowns) and try again.</span>
              <button className="btn primary small" onClick={runDetectAndAnswer} style={{ marginTop: 12 }}>
                Scan again
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="empty-state">
              <p>{errorMsg || 'Something went wrong'}</p>
              <button className="btn primary small" onClick={runDetectAndAnswer} style={{ marginTop: 12 }}>
                Try again
              </button>
            </div>
          )}

          {(status === 'generating' || status === 'ready') && (
            <div className="aq-list">
              {orderedCards.map(({ q, a, state, fromMemory }, idx) => {
                if (!a) return null;
                const learned = a.detail.source === 'learned';
                const canChange = learned && !isTextQuestion(q) && !!(q.options && q.options.length);
                const text = isTextQuestion(q);
                const isEditing = editingId === q.id;
                const hasAnswer = !!a.answer.trim();
                const showAnswer = hasAnswer && state !== 'skipped';
                const ws = text && hasAnswer ? wordStatus(isEditing ? editDraft : a.answer, q.wordHint) : null;
                const heading = showGroups && idx === 0
                  ? 'Reused from your earlier answers'
                  : showGroups && idx === ordered.reused.length ? 'Still needs you' : '';
                return (
                  <React.Fragment key={q.id}>
                  {heading && <h4 className="aq-group-title">{heading}</h4>}
                  <div
                    className={`aq-card aq-${state}${a.done ? ' aq-filled' : ''}${fromMemory ? ' aq-reused' : ''}`}
                    onMouseEnter={() => highlight(q.id, true)}
                    onMouseLeave={() => highlight(q.id, false)}
                    onFocusCapture={() => highlight(q.id, true)}
                    onBlurCapture={() => highlight(q.id, false)}
                  >
                    <div className="aq-card-top">
                      <div className="aq-chips">
                        {a.loading ? (
                          <span className="aq-chip aq-chip-busy">Working</span>
                        ) : learned ? (
                          <span className="aq-chip aq-chip-learned">From your earlier answer</span>
                        ) : (
                          <span className={`aq-chip aq-chip-${state}`}>{stateLabel(state)}</span>
                        )}
                        {a.done && <span className="aq-chip aq-chip-done">Filled</span>}
                      </div>
                      {hasAnswer && !a.loading && (
                        <div className="aq-menu-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="aq-menu-btn"
                            aria-label="More actions"
                            aria-haspopup="menu"
                            aria-expanded={menuId === q.id}
                            onClick={() => setMenuId(menuId === q.id ? null : q.id)}
                          >
                            <DotsIcon />
                          </button>
                          {menuId === q.id && (
                            <div className="aq-menu" role="menu">
                              <button role="menuitem" onClick={() => handleCopy(q.id)}>Copy</button>
                              {text && <button role="menuitem" onClick={() => { setMenuId(null); setEditDraft(a.answer); setEditingId(q.id); }}>Edit</button>}
                              {text && <button role="menuitem" onClick={() => handleRegenerate(q.id)}>Regenerate</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="aq-question">{q.question}</div>
                    <div className="aq-source">
                      {learned && a.detail.learnedFrom
                        ? youAnsweredLine(a.detail.answer || a.answer, a.detail.learnedFrom)
                        : sourceLine(a.detail, !!a.cached, a.edited)}
                    </div>

                    {a.loading ? (
                      <div className="aq-loading"><div className="spinner" /><span>Drafting</span></div>
                    ) : a.error ? (
                      <div className="aq-error">
                        {a.error}
                        <button className="aq-link" onClick={() => handleRegenerate(q.id)}>Try again</button>
                      </div>
                    ) : isEditing ? (
                      <>
                        <textarea
                          className="aq-edit"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={6}
                          autoFocus
                        />
                        {ws && <div className={`aq-words aq-words-${ws.tone}`}>{ws.label}</div>}
                        <div className="aq-actions">
                          <button className="aq-btn primary" onClick={() => handleEditSave(q.id)}>Save</button>
                          <button className="aq-btn" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </>
                    ) : changeId === q.id && canChange ? (
                      <OptionAsk
                        options={q.options as string[]}
                        sensitive={false}
                        canSave={false}
                        save={false}
                        changing
                        onToggleSave={() => {}}
                        onPick={(o) => handleChangePick(q.id, o)}
                        onCancel={() => setChangeId(null)}
                      />
                    ) : (state === 'needs_you' || state === 'skipped') && !text && q.options && q.options.length > 0 ? (
                      <OptionAsk
                        options={q.options}
                        sensitive={isSensitiveQuestion(q.question)}
                        canSave={canSaveFromOptions(a.detail.needsFact || null, q.question, q.options)}
                        save={saveNext[q.id] !== false}
                        onToggleSave={(v) => setSaveNext((p) => ({ ...p, [q.id]: v }))}
                        onPick={(o) => handleOptionPick(q.id, o)}
                        suggestion={a.detail.suggestion}
                        onUseSuggestion={a.detail.suggestion ? () => handleSuggestionUse(q.id, a.detail.suggestion as string) : undefined}
                      />
                    ) : state === 'needs_you' && a.detail.needsFact ? (
                      <FactAsk
                        fact={a.detail.needsFact}
                        save={saveNext[q.id] !== false}
                        onToggleSave={(v) => setSaveNext((p) => ({ ...p, [q.id]: v }))}
                        onPick={(value, label) => handleFactPick(q.id, a.detail.needsFact as NeedsFact, value, label)}
                      />
                    ) : state === 'needs_you' ? (
                      <p className="aq-note">
                        {text
                          ? 'We could not write this one from your profile. Fill it in on the page, or ask for a draft.'
                          : 'This one is only yours to answer. Choose it on the page.'}
                        {text && <button className="aq-link" onClick={() => handleRegenerate(q.id)}>Draft it</button>}
                      </p>
                    ) : state === 'skipped' ? (
                      <p className="aq-note">Optional. Left blank.</p>
                    ) : showAnswer ? (
                      <>
                        <div className="aq-answer">{a.answer}</div>
                        {ws && <div className={`aq-words aq-words-${ws.tone}`}>{ws.label}</div>}
                        {text && (
                          <div className="aq-refine" role="group" aria-label="Refine this answer">
                            {REFINES.map((r) => (
                              <button key={r.id} className="aq-pill" onClick={() => handleRegenerate(q.id, r.id)}>{r.label}</button>
                            ))}
                            <button className="aq-pill aq-pill-voice" onClick={() => setAddOpen(addOpen === q.id ? null : q.id)}>
                              Ask AI
                            </button>
                          </div>
                        )}
                        {text && addOpen === q.id && (
                          <div className="aq-add">
                            <p className="aq-add-hint">Tell the AI what to change in this answer. Type it, or tap the mic and say it.</p>
                            <MicCapture label="Speak your request" onText={(t) => setAddText((p) => ({ ...p, [q.id]: `${p[q.id] || ''}${p[q.id] ? ' ' : ''}${t}` }))} />
                            <textarea
                              className="aq-edit"
                              rows={3}
                              placeholder="For example: add that I built Grafana dashboards for our billing platform, and make it a little warmer"
                              value={addText[q.id] || ''}
                              onChange={(e) => setAddText((p) => ({ ...p, [q.id]: e.target.value }))}
                            />
                            <div className="aq-actions">
                              <button
                                className="aq-btn primary"
                                disabled={!(addText[q.id] || '').trim()}
                                onClick={() => { const t = (addText[q.id] || '').trim(); setAddOpen(null); setAddText((p) => ({ ...p, [q.id]: '' })); handleRegenerate(q.id, undefined, t); }}
                              >
                                Rewrite
                              </button>
                              <button className="aq-btn" onClick={() => setAddOpen(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                        <div className="aq-actions">
                          <button className={`aq-btn primary${a.done ? ' is-done' : ''}`} onClick={() => handleUse(q.id)}>
                            {a.done ? 'Filled. Use again' : 'Use this'}
                          </button>
                          {canChange && <button className="aq-btn" onClick={() => setChangeId(q.id)}>Change</button>}
                        </div>
                        {learned && !canChange && !text && (
                          <p className="aq-note">To change it, choose another answer on the page. We will remember it.</p>
                        )}
                      </>
                    ) : null}
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer aq-footer">
          {status === 'ready' && (
            <button className="btn primary aq-fill-all" disabled={readyCount === 0} onClick={handleFillAll}>
              {readyCount > 0 ? `Fill all ready answers (${readyCount})` : 'Fill all ready answers'}
            </button>
          )}
          <p className="smart-answers-foot-note">
            Nothing is auto-submitted. You review everything before you apply.
          </p>
        </div>
      </div>
    </div>
  );
};
