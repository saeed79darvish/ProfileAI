import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config';
import type { JobInfo } from '../../types';
import { buildDownloadPayload } from '../downloadPayload';
import {
  STEPS,
  PROGRESS,
  REFINE_OPTIONS,
  REFINE_PLACEHOLDER,
  applyOverrides,
  buildChanges,
  buildCopy,
  buildGapSelections,
  buildPlan,
  buildRefineRequest,
  buildTailorSettings,
  confirmedRequirements,
  countKeywords,
  coverageCounts,
  coveredRequirements,
  defaultPages,
  displayAfterScore,
  initialKept,
  keptCount,
  label,
  limitCopy,
  noteFor,
  pickRefined,
  platformOf,
  progressIndex,
  questionsFor,
  rescoreLabels,
  resumeText,
  scoredRequirements,
  seniorityNote,
  stillMissing,
  toggleOption,
  type Answer,
  type Change,
  type LimitInfo,
  type MatchResult,
  type PlanSection,
} from '../tailorLogic';
import './tailorFlow.css';

/**
 * Tailor for a Job, in the side panel. One full-panel flow, four steps, the same
 * behaviour as the web app's JobTailorFlow.jsx:
 *
 *   Fit    - the match (free when the server has it cached) and each gap as a
 *            plain question: "I have this" (with one line of where) or "I don't".
 *            Only what the candidate confirms reaches the resume.
 *   Plan   - per section, the changes picked for this job; tap to adjust, say
 *            anything else, choose 1 or 2 pages.
 *   Review - tailoring runs as a background task (it can be hidden and the panel
 *            can be closed), then each changed section before and after, to
 *            keep, skip or refine with Ask AI. Saving updates the tailored copy.
 *   Apply  - download the resume, then record the application when it is sent.
 */

type Step = 'fit' | 'plan' | 'tailoring' | 'review' | 'apply';
type NotifyType = 'success' | 'warning' | 'info' | 'error';

export type TailorStatus = 'idle' | 'running' | 'ready';

/** A tailor task this panel instance did not start itself (restored from storage). */
export interface TailorRestore {
  status: 'running' | 'done' | 'error';
  startedAt: number;
  /** The task's own result: { success, tailored, savedId, afterScore, beforeScore } or a failure. */
  result?: any;
  error?: string;
  /** Changes on every new record, so the same record is applied once. */
  stamp: number;
}

interface TailorFlowProps {
  open: boolean;
  onClose: () => void;
  job: JobInfo | null;
  /** The tab URL the posting was read from: the key the record is saved under. */
  jobUrl: string;
  profile: any | null;
  /** A copy tailored earlier for this posting: opens at Apply. */
  initialCopy: any | null;
  restore: TailorRestore | null;
  onStatus: (status: TailorStatus) => void;
  onNotify: (message: string, type: NotifyType) => void;
  /** Bracket the tailor request so the panel does not also apply the mirrored task record. */
  onOpStart: () => void;
  onOpEnd: () => void;
}

interface Result {
  tailored: any;
  savedId: string | null;
  afterScore: number | null;
  beforeScore: number | null;
}

/** Sends a message to the service worker; never throws. */
async function send<T = any>(type: string, data?: unknown): Promise<T> {
  try {
    const res = await chrome.runtime.sendMessage({ type, data });
    return (res ?? { success: false, error: 'No response from the extension. Please try again.' }) as T;
  } catch (err) {
    return { success: false, error: (err as Error)?.message || 'The extension could not be reached.' } as unknown as T;
  }
}

const absoluteUrl = (u: string): string => (/^https?:/i.test(u) ? u : `${CONFIG.WEB_BASE}${u.startsWith('/') ? '' : '/'}${u}`);

const Check: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const Spinner: React.FC<{ small?: boolean }> = ({ small }) => <span className={`tf-spinner${small ? ' small' : ''}`} aria-hidden="true" />;

const Ring: React.FC<{ score: number }> = ({ score }) => {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${score}% match`} className="tf-ring">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--border-color)" strokeWidth="7" />
      <circle
        cx="38" cy="38" r={r} fill="none" stroke="var(--accent-secondary)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 38 38)"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text x="38" y="43" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--text-primary)">{score}%</text>
    </svg>
  );
};

const NoteInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  maxLength?: number;
  onEnter?: () => void;
}> = ({ value, onChange, placeholder, ariaLabel, maxLength = 300, onEnter }) => (
  <input
    className="tf-input"
    type="text"
    value={value}
    maxLength={maxLength}
    placeholder={placeholder}
    aria-label={ariaLabel}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
  />
);

export const TailorFlow: React.FC<TailorFlowProps> = ({
  open, onClose, job, jobUrl, profile, initialCopy, restore, onStatus, onNotify, onOpStart, onOpEnd,
}) => {
  const [step, setStep] = useState<Step>('fit');
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState<LimitInfo | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [proof, setProof] = useState<Record<string, string>>({});
  const [showCovered, setShowCovered] = useState(false);
  const [plan, setPlan] = useState<PlanSection[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<number>(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<string | null>(null);
  const [askText, setAskText] = useState('');
  const [refining, setRefining] = useState<string | null>(null);
  const [expandedBefore, setExpandedBefore] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [finalCopy, setFinalCopy] = useState<any | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [recording, setRecording] = useState(false);
  const [creditLabel, setCreditLabel] = useState('1 credit');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rescoreRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const company = job?.company || 'the company';
  const jobKey = `${jobUrl || ''}|${job?.title || ''}|${job?.company || ''}`;
  const jobKeyRef = useRef(jobKey);
  jobKeyRef.current = jobKey;
  /** Which posting the state in this component belongs to. */
  const stateKeyRef = useRef<string | null>(null);
  const stepRef = useRef<Step>('fit');
  stepRef.current = step;
  const resultRef = useRef<Result | null>(null);
  const appliedRestore = useRef<number | null>(null);
  resultRef.current = result;

  useEffect(() => {
    onStatus(step === 'tailoring' ? 'running' : step === 'review' && result ? 'ready' : 'idle');
  }, [step, result, onStatus]);

  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [step]);

  // One clock for the progress lines, derived from when the run began so a panel
  // reopened mid-run shows the right line instead of starting over.
  useEffect(() => {
    if (step !== 'tailoring') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const fail = useCallback((res: { error?: string; limit?: LimitInfo } | null | undefined, fallback: string) => {
    if (res?.limit) {
      setLimit(res.limit);
      return;
    }
    setError(res?.error || fallback);
  }, []);

  const loadMatch = useCallback(async () => {
    setMatch(null);
    setScore(null);
    setError('');
    setLimit(null);
    const res = await send<{ success: boolean; data?: MatchResult; error?: string; limit?: LimitInfo }>('JOB_FIT', {
      jobDescription: job?.description || '',
      jobTitle: job?.title,
    });
    if (jobKeyRef.current !== stateKeyRef.current) return;
    if (!res?.success || !res.data) {
      fail(res, 'Could not read this job. Please try again.');
      return;
    }
    setMatch(res.data);
    setScore(res.data.score);
  }, [job, fail]);

  const resetForJob = useCallback(() => {
    setStep('fit');
    setError('');
    setLimit(null);
    setAnswers({});
    setProof({});
    setPlan(null);
    setNotes({});
    setResult(null);
    setKept({});
    setOverrides({});
    setAsking(null);
    setFinalCopy(null);
    setDownloaded(false);
    setApplied(false);
    setNotYet(false);
    setShowCovered(false);
  }, []);

  // Opening: an existing copy goes straight to Apply; work in flight or a result
  // waiting at Review is picked up where it was; anything else starts over at Fit.
  useEffect(() => {
    if (!open || !job) return;
    // A restored task decides where the flow stands; starting over here would
    // read the match again for nothing.
    if (restore && appliedRestore.current !== restore.stamp) return;
    const sameJob = stateKeyRef.current === jobKey;
    stateKeyRef.current = jobKey;
    if (sameJob && (stepRef.current === 'tailoring' || (stepRef.current === 'review' && resultRef.current))) return;
    if (initialCopy) {
      setFinalCopy(initialCopy);
      setStep('apply');
      setDownloaded(false);
      setApplied(false);
      return;
    }
    if (sameJob && stepRef.current === 'apply') return;
    resetForJob();
    void loadMatch();
    void send<{ success: boolean; unlimited?: boolean }>('TAILOR_USAGE').then((r) => {
      if (r?.success) setCreditLabel(r.unlimited ? '' : '1 credit');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobKey]);

  const takeResult = useCallback((res: Result) => {
    const changes = buildChanges(profile || {}, res.tailored, res.tailored?._jobKeywords || []);
    setResult(res);
    setKept(initialKept(changes));
    setOverrides({});
    setAsking(null);
    setStep('review');
  }, [profile]);

  // A tailor task this instance did not start: the panel was closed, or reopened,
  // while it ran.
  useEffect(() => {
    if (!restore || appliedRestore.current === restore.stamp) return;
    appliedRestore.current = restore.stamp;
    if (!stateKeyRef.current) stateKeyRef.current = jobKeyRef.current;
    if (restore.status === 'running') {
      setStartedAt(restore.startedAt);
      setNow(Date.now());
      setStep('tailoring');
      return;
    }
    const res = restore.result;
    if (restore.status === 'done' && res?.success && res.tailored) {
      takeResult({
        tailored: res.tailored,
        savedId: res.savedId || null,
        afterScore: typeof res.afterScore === 'number' ? res.afterScore : null,
        beforeScore: typeof res.beforeScore === 'number' ? res.beforeScore : null,
      });
      return;
    }
    setStep(stepRef.current === 'tailoring' ? (plan ? 'plan' : 'fit') : stepRef.current);
    if (res?.limit) setLimit(res.limit);
    else setError(restore.error || res?.error || 'Tailoring failed. No credit was used. Please try again.');
  }, [restore, takeResult, plan]);

  // --- Fit -------------------------------------------------------------------

  const scored = useMemo(() => scoredRequirements(match), [match]);
  const covered = useMemo(() => coveredRequirements(match), [match]);
  const questions = useMemo(() => questionsFor(match), [match]);
  const yesReqs = useMemo(() => confirmedRequirements(questions, answers), [questions, answers]);
  const answeredCount = questions.filter((r) => answers[label(r)]).length;
  const gapCount = scored.length - covered.length;
  const note = seniorityNote(match, profile?.title);

  const answer = (r: { requirement?: string }, value: 'yes' | 'no') => {
    const key = String(r.requirement || '').trim();
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  };

  // The score follows the answers; the latest answer wins. Free arithmetic over
  // the match already read.
  const confirmedKey = yesReqs.map(label).join('\n');
  useEffect(() => {
    if (!match) return;
    const ticket = ++rescoreRef.current;
    if (!confirmedKey) {
      setScore(match.score);
      return;
    }
    void send<{ success: boolean; score?: number }>('JOB_FIT_RESCORE', {
      requirements: match.requirements,
      components: match.components,
      confirmed: confirmedKey.split('\n'),
    }).then((r) => {
      if (ticket === rescoreRef.current && r?.success && typeof r.score === 'number') setScore(r.score);
    });
  }, [confirmedKey, match]);

  const toPlan = () => {
    if (!plan) {
      const pageCount = defaultPages(profile);
      setPages(pageCount);
      setPlan(buildPlan({ profile, job, match, confirmed: yesReqs, pages: pageCount }));
    }
    setStep('plan');
  };

  const backToPlan = () => {
    if (!match) {
      setStep('fit');
      void loadMatch();
      return;
    }
    setStep('plan');
  };

  // --- Tailor ----------------------------------------------------------------

  const tailor = async () => {
    if (!match || !plan || !job) return;
    setError('');
    setLimit(null);
    setStep('tailoring');
    setStartedAt(Date.now());
    setNow(Date.now());
    const key = jobKeyRef.current;
    const confirmedLabels = yesReqs.map(label);
    onOpStart();
    const res = await send<any>('TAILOR_FLOW_RUN', {
      jobDescription: job.description || '',
      jobTitle: job.title,
      company: job.company,
      jobUrl,
      gapSelections: buildGapSelections(yesReqs, proof),
      tailorSettings: buildTailorSettings(plan, pages, notes),
      matchScore: score,
      skillGaps: stillMissing(match, answers),
      // The score once the gaps the candidate confirmed and the ones tailoring
      // can surface (partly shown, or related work) are covered.
      rescore: {
        requirements: match.requirements,
        components: match.components,
        confirmed: rescoreLabels(confirmedLabels, match.surfaceable),
      },
      beforeScore: match.score,
    });
    onOpEnd();
    if (jobKeyRef.current !== key) return;
    if (!res?.success || !res.tailored) {
      setStep('plan');
      fail(res, 'Tailoring failed. No credit was used. Please try again.');
      return;
    }
    takeResult({
      tailored: res.tailored,
      savedId: res.savedId || null,
      afterScore: typeof res.afterScore === 'number' ? res.afterScore : null,
      beforeScore: match.score,
    });
    if (!openRef.current) onNotify(`Your resume for ${job.title || 'this job'} is ready. Tap Tailor Profile to review it.`, 'success');
  };

  // --- Review ----------------------------------------------------------------

  const tailored = result?.tailored;
  const jobKeywords: string[] = useMemo(() => tailored?._jobKeywords || [], [tailored]);
  const changes: Change[] = useMemo(
    () => (tailored ? buildChanges(profile || {}, tailored, jobKeywords) : []),
    [tailored, profile, jobKeywords],
  );
  const shown = applyOverrides(changes, overrides);
  const nKept = keptCount(changes, kept);

  const currentCopy = () => buildCopy(tailored, profile, changes, kept, overrides);

  const refine = async (ch: Change, instruction: string) => {
    const text = String(instruction || '').trim();
    if (!text || refining) return;
    setRefining(ch.id);
    setError('');
    const req = buildRefineRequest(currentCopy(), ch, text, job?.title, company);
    const res = await send<{ success: boolean; data?: any; error?: string; limit?: LimitInfo }>('REGENERATE_SECTION', req);
    setRefining(null);
    if (!res?.success) {
      fail(res, 'Could not rewrite this section. Please try again.');
      return;
    }
    const next = pickRefined(res.data, ch);
    if (!next) {
      setError('The AI returned nothing for this section. Please try again.');
      return;
    }
    setOverrides((p) => ({ ...p, [ch.id]: next }));
    setKept((p) => ({ ...p, [ch.id]: true }));
    setAsking(null);
    setAskText('');
  };

  const afterShown = displayAfterScore(result?.afterScore, score, match?.score ?? result?.beforeScore);
  const beforeScore = match?.score ?? result?.beforeScore ?? null;
  const matchNow = afterShown ?? score ?? beforeScore;

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError('');
    const copy = currentCopy();
    const res = await send<{ success: boolean; id?: string | null; error?: string; limit?: LimitInfo }>('TAILORED_PROFILE_SAVE', {
      id: result.savedId,
      jobTitle: job?.title,
      companyName: job?.company,
      jobUrl,
      tailoredData: copy,
      matchScore: matchNow,
    });
    setSaving(false);
    if (!res?.success) {
      setError(res?.error || 'Could not save your tailored resume. Please try again.');
      return;
    }
    if (res.id && !result.savedId) setResult((r) => (r ? { ...r, savedId: res.id || null } : r));
    const stamped = { ...copy, jobTitle: job?.title, company: job?.company, matchScore: matchNow ?? undefined };
    setFinalCopy(stamped);
    setDownloaded(false);
    setApplied(false);
    setNotYet(false);
    setStep('apply');
    // The panel finds this again for the same posting and opens at Apply.
    if (jobUrl) {
      try {
        const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
        tailoredCache[jobUrl] = stamped;
        await chrome.storage.local.set({ tailoredCache });
      } catch { /* the saved copy on the server is the source of truth */ }
    }
  };

  // --- Apply -----------------------------------------------------------------

  const handleDownload = async () => {
    if (!finalCopy) return;
    setDownloading(true);
    setError('');
    try {
      const payload = buildDownloadPayload(finalCopy, profile);
      await chrome.storage.local.set({ pendingResumeDownload: payload });
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let shownOnPage = false;
      if (activeTab?.id != null) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { type: 'SHOW_DOWNLOAD_OVERLAY' });
          shownOnPage = true;
        } catch { /* a page the extension cannot reach: fall back to a tab */ }
      }
      if (!shownOnPage && chrome.tabs?.create) {
        await chrome.tabs.create({ url: `${CONFIG.WEB_BASE}/resume/download?ext=1`, active: true });
      }
      setDownloaded(true);
    } catch (err) {
      setError((err as Error).message || 'Could not open the download. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const confirmApplied = async () => {
    if (!job) return;
    setRecording(true);
    setError('');
    const res = await send<{ success: boolean; error?: string }>('SAVE_EXTERNAL_APPLICATION', {
      jobTitle: job.title || '',
      company: job.company || '',
      jobUrl: jobUrl || undefined,
      platform: platformOf(jobUrl),
      location: job.location,
      matchScore: matchNow ?? undefined,
      stage: 'applied',
      confirmedBy: 'user',
    });
    setRecording(false);
    if (res?.success) {
      setApplied(true);
      onNotify(`Recorded your application for ${job.title || 'this job'}.`, 'success');
    } else {
      setError(res?.error || 'Could not record your application. Please try again.');
    }
  };

  const tailorAgain = () => {
    setResult(null);
    setFinalCopy(null);
    setError('');
    setLimit(null);
    setDownloaded(false);
    setApplied(false);
    setStep('fit');
    if (!match) void loadMatch();
  };

  const finish = () => {
    setResult(null);
    setFinalCopy(null);
    setStep('fit');
    stateKeyRef.current = null;
    onClose();
  };

  if (!open) return null;

  // --- render ----------------------------------------------------------------

  const stepIndex = { fit: 0, plan: 1, tailoring: 2, review: 2, apply: 3 }[step];
  const initial = (job?.company?.trim()[0] || job?.title?.trim()[0] || '?').toUpperCase();

  const renderLimit = (l: LimitInfo) => {
    const copy = limitCopy(l);
    return (
      <div className="tf-limit" role="alert">
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
      </div>
    );
  };

  const renderFit = () => {
    if (!match) {
      if (error) {
        return (
          <>
            <p className="tf-error" role="alert">{error}</p>
            <button type="button" className="tf-btn secondary full" onClick={() => void loadMatch()}>Try again</button>
          </>
        );
      }
      return (
        <div className="tf-centered">
          <Spinner />
          <strong>Reading the job</strong>
          <span>Checking each requirement against your resume.</span>
        </div>
      );
    }
    return (
      <>
        {error && <p className="tf-error" role="alert">{error}</p>}
        <section className="tf-card tf-score">
          <Ring score={score ?? match.score} />
          <div className="tf-score-text">
            <strong>Your resume vs this job</strong>
            <span>
              {covered.length} requirement{covered.length === 1 ? '' : 's'} covered · {gapCount} gap{gapCount === 1 ? '' : 's'}
            </span>
          </div>
          {note && <div className="tf-warn">{note}</div>}
        </section>

        {covered.length > 0 && (
          <>
            <button type="button" className="tf-covered" aria-expanded={showCovered} onClick={() => setShowCovered((v) => !v)}>
              <Check size={16} />
              <span>{covered.length} requirement{covered.length === 1 ? '' : 's'} already covered</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={showCovered ? 'open' : ''} aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showCovered && (
              <ul className="tf-covered-list">
                {covered.map((r) => <li key={label(r)}><Check size={13} />{label(r)}</li>)}
              </ul>
            )}
          </>
        )}

        {questions.length > 0 ? (
          <>
            <h3 className="tf-h3">Do you have these?</h3>
            <p className="tf-hint">We only add what you confirm.</p>
            {questions.map((r) => {
              const key = label(r);
              const a = answers[key];
              return (
                <section key={key} className={`tf-card tf-q${a === 'yes' ? ' on' : ''}`}>
                  <div className="tf-row">
                    <h4>{key}</h4>
                    <span className={`tf-badge${r.hardness === 'must' ? ' must' : ''}`}>{r.hardness === 'must' ? 'Required' : 'Preferred'}</span>
                  </div>
                  <p className="tf-note">{noteFor(r)}</p>
                  <div className="tf-choice">
                    <button type="button" aria-pressed={a === 'yes'} onClick={() => answer(r, 'yes')}>
                      {a === 'yes' && <Check size={14} />}I have this
                    </button>
                    <button type="button" className="no" aria-pressed={a === 'no'} onClick={() => answer(r, 'no')}>I don&rsquo;t</button>
                  </div>
                  {a === 'yes' && (
                    <NoteInput
                      value={proof[key] || ''}
                      onChange={(v) => setProof((p) => ({ ...p, [key]: v }))}
                      placeholder="Where? One line, e.g. the role and what you did"
                      ariaLabel={`Where you have ${key}`}
                      maxLength={200}
                    />
                  )}
                </section>
              );
            })}
          </>
        ) : (
          <p className="tf-hint spaced">Nothing to ask: your resume already shows what this job asks for that a resume can show.</p>
        )}
      </>
    );
  };

  const renderPlan = () => {
    if (!plan) return null;
    return (
      <>
        {error && <p className="tf-error" role="alert">{error}</p>}
        <p className="tf-hint">Picked for this job from your match. Tap to adjust.</p>
        {plan.map((s) => {
          const n = s.options.filter((o) => o.on).length;
          return (
            <section key={s.key} className="tf-card">
              <div className="tf-row">
                <h4>{s.label}</h4>
                <span className="tf-count">{n} change{n === 1 ? '' : 's'}</span>
              </div>
              <div className="tf-chips">
                {s.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`tf-chip${o.on ? ' on' : ''}`}
                    aria-pressed={o.on}
                    onClick={() => setPlan((prev) => (prev ? toggleOption(prev, s.key, o.id) : prev))}
                  >
                    {o.on && <Check size={12} />}{o.label}
                  </button>
                ))}
              </div>
              <NoteInput
                value={notes[s.key] || ''}
                onChange={(v) => setNotes((p) => ({ ...p, [s.key]: v }))}
                placeholder={REFINE_PLACEHOLDER[s.key]}
                ariaLabel={`Anything else for ${s.label}`}
              />
            </section>
          );
        })}
        <section className="tf-card">
          <h4>Length</h4>
          <div className="tf-pages" role="group" aria-label="Resume length">
            {[1, 2].map((n) => (
              <button key={n} type="button" aria-pressed={pages === n} onClick={() => setPages(n)}>{n} page{n === 1 ? '' : 's'}</button>
            ))}
          </div>
        </section>
      </>
    );
  };

  const renderTailoring = () => {
    const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
    const progress = progressIndex(elapsed);
    return (
      <>
        <h3 className="tf-h3 first">Tailoring your resume...</h3>
        <p className="tf-hint">About a minute. You can hide this and keep working; we&rsquo;ll let you know when it&rsquo;s ready.</p>
        <ol className="tf-progress">
          {PROGRESS.map((name, i) => {
            const state = i < progress ? 'done' : i === progress ? 'active' : 'pending';
            return (
              <li key={name} data-state={state}>
                <span className="dot">{state === 'done' ? <Check size={13} /> : state === 'active' ? <Spinner small /> : null}</span>
                {name}
              </li>
            );
          })}
        </ol>
      </>
    );
  };

  const renderReview = () => {
    const copyText = resumeText(currentCopy());
    const kwBefore = countKeywords(jobKeywords, resumeText(profile || {}));
    const kwAfter = countKeywords(jobKeywords, copyText);
    const confirmedLabels = yesReqs.map(label);
    const cov = match ? coverageCounts(match, confirmedLabels, match.surfaceable || []) : null;
    return (
      <>
        {error && <p className="tf-error" role="alert">{error}</p>}
        <section className="tf-gain">
          <div>
            <div className="k">Match</div>
            <div className="v">{matchNow ?? '...'}{matchNow != null && <small>%</small>}</div>
            {beforeScore != null && <div className="was">was {beforeScore}%</div>}
          </div>
          {cov && (
            <div>
              <div className="k">Requirements</div>
              <div className="v">{cov.after}<small> / {cov.total}</small></div>
              <div className="was">was {cov.before}</div>
            </div>
          )}
          {jobKeywords.length > 0 && (
            <div>
              <div className="k">Keywords</div>
              <div className="v">{kwAfter}<small> / {jobKeywords.length}</small></div>
              <div className="was">was {kwBefore}</div>
            </div>
          )}
        </section>

        {shown.length === 0 && <p className="tf-hint">Your resume already reads well for this job, so the copy keeps your wording.</p>}
        {shown.map((ch) => {
          const isKept = !!kept[ch.id];
          const isOpen = asking === ch.id;
          const busy = refining === ch.id;
          const expanded = !!expandedBefore[ch.id];
          return (
            <section key={ch.id} className={`tf-change${isKept ? ' kept' : ''}`} data-change={ch.id}>
              <div className="head">
                <span className="label">{ch.label}</span>
                <button type="button" className={`tf-keep${isKept ? ' on' : ''}`} aria-pressed={isKept} onClick={() => setKept((p) => ({ ...p, [ch.id]: !p[ch.id] }))}>
                  {isKept ? <><Check size={12} />Keep</> : 'Skip'}
                </button>
              </div>
              {ch.before && (
                <>
                  <span className="tf-tag">Before</span>
                  <p className={`before${expanded ? ' expanded' : ''}`}>{ch.before}</p>
                  {ch.before.length > 160 && (
                    <button type="button" className="tf-link" onClick={() => setExpandedBefore((p) => ({ ...p, [ch.id]: !p[ch.id] }))}>
                      {expanded ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </>
              )}
              <span className="tf-tag after">After</span>
              <p className="after">{busy ? 'Rewriting...' : ch.after}</p>
              <div className="foot">
                <span className="why">{overrides[ch.id] !== undefined ? 'Rewritten with your request.' : ch.reason}</span>
                <button type="button" className={`tf-ask${isOpen ? ' open' : ''}`} disabled={busy} onClick={() => { setAsking(isOpen ? null : ch.id); setAskText(''); }}>
                  {isOpen ? 'Close' : 'Ask AI'}
                </button>
              </div>
              {isOpen && (
                <>
                  <div className="tf-ask-row">
                    <NoteInput
                      value={askText}
                      onChange={setAskText}
                      placeholder={REFINE_PLACEHOLDER[ch.section]}
                      ariaLabel={`What to change in ${ch.label}`}
                      onEnter={() => void refine(ch, askText)}
                    />
                    <button type="button" className="tf-send" aria-label="Rewrite this section" disabled={!askText.trim() || busy} onClick={() => void refine(ch, askText)}>
                      {busy ? <Spinner small /> : 'Rewrite'}
                    </button>
                  </div>
                  <div className="tf-chips">
                    {REFINE_OPTIONS[ch.section].map((q) => (
                      <button key={q} type="button" className="tf-chip" disabled={busy} onClick={() => void refine(ch, q)}>{q}</button>
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </>
    );
  };

  const renderApply = () => (
    <>
      {error && <p className="tf-error" role="alert">{error}</p>}
      <section className="tf-card tf-done">
        <div className="tf-done-icon"><Check size={20} /></div>
        <div>
          <strong>Your tailored resume is saved</strong>
          <span>
            For {job?.title || 'this job'} at {company}
            {matchNow != null ? `, ${matchNow}% match` : ''}. Find it any time under your tailored resumes.
          </span>
        </div>
      </section>

      <button type="button" className="tf-btn primary full" onClick={() => void handleDownload()} disabled={downloading || !finalCopy}>
        {downloading ? <><Spinner small />Opening...</> : downloaded ? 'Open download again' : 'Download tailored resume'}
      </button>
      {downloaded && <p className="tf-hint centered">The download window is open on the job page. Pick PDF or Word and save it.</p>}

      {jobUrl && (
        <section className="tf-card tf-applied">
          <h4>Did you apply?</h4>
          {applied ? (
            <p className="tf-note ok"><Check size={13} /> Recorded in your job tracker.</p>
          ) : (
            <>
              <p className="tf-note">This page is {company}&rsquo;s application. Once you have submitted it, tell us and we&rsquo;ll record it.</p>
              {notYet && <p className="tf-note">No problem. Tailor Profile on this job brings you back here to record it.</p>}
              <div className="tf-pair">
                <button type="button" className="tf-btn secondary" onClick={() => { setNotYet(true); setError(''); }} disabled={recording}>Not yet</button>
                <button type="button" className="tf-btn secondary strong" onClick={() => void confirmApplied()} disabled={recording}>
                  {recording ? <Spinner small /> : 'Yes, I applied'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );

  let footer: React.ReactNode = null;
  if (limit) {
    footer = (
      <>
        <button type="button" className="tf-btn secondary" onClick={() => { setLimit(null); if (!match) onClose(); }}>Close</button>
        <button type="button" className="tf-btn primary" onClick={() => { void chrome.tabs.create({ url: absoluteUrl(limit.buyMoreUrl) }); }}>See plans</button>
      </>
    );
  } else if (step === 'fit' && match) {
    footer = (
      <button type="button" className="tf-btn primary full" onClick={toPlan}>
        Continue{questions.length ? ` · ${answeredCount} of ${questions.length} answered` : ''}
      </button>
    );
  } else if (step === 'plan') {
    footer = (
      <>
        {result
          ? <button type="button" className="tf-btn secondary" onClick={() => setStep('review')}>Review</button>
          : <button type="button" className="tf-btn secondary" onClick={() => setStep('fit')}>Back</button>}
        <button type="button" className="tf-btn primary" onClick={() => void tailor()}>
          {result ? 'Tailor again' : 'Tailor resume'}{creditLabel ? ` · ${creditLabel}` : ''}
        </button>
      </>
    );
  } else if (step === 'tailoring') {
    footer = <button type="button" className="tf-btn secondary full" onClick={onClose}>Hide and keep working</button>;
  } else if (step === 'review') {
    footer = (
      <>
        <button type="button" className="tf-btn secondary" onClick={backToPlan} disabled={saving}>Back</button>
        <button type="button" className="tf-btn primary" onClick={() => void save()} disabled={saving || !!refining}>
          {saving ? <Spinner small /> : nKept ? `Save ${nKept} change${nKept === 1 ? '' : 's'}` : 'Save resume'}
        </button>
      </>
    );
  } else if (step === 'apply') {
    footer = (
      <>
        <button type="button" className="tf-btn secondary" onClick={tailorAgain}>Tailor again</button>
        <button type="button" className="tf-btn secondary strong" onClick={finish}>Done</button>
      </>
    );
  }

  return (
    <div className="tf-overlay" role="dialog" aria-modal="true" aria-label={`Tailor for ${job?.company || 'this job'}`}>
      <header className="tf-head">
        <div className="tf-job">
          <div className="tf-logo" aria-hidden="true">{initial}</div>
          <div className="tf-job-text">
            <strong title={job?.company || undefined}>Tailor for {job?.company || 'this job'}</strong>
            <span title={job?.title || undefined}>{job?.title || ''}</span>
          </div>
          <button type="button" className="tf-close" aria-label={step === 'tailoring' ? 'Hide' : 'Close'} onClick={step === 'apply' ? finish : onClose} disabled={saving}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ol className="tf-steps" aria-label="Steps">
          {STEPS.map((name, i) => (
            <li key={name} data-state={i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo'} aria-current={i === stepIndex ? 'step' : undefined}>
              <span className="n">{i < stepIndex ? <Check size={11} /> : i + 1}</span>
              <span className="name">{name}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="tf-body" ref={bodyRef}>
        {limit ? renderLimit(limit) : (
          <>
            {step === 'fit' && renderFit()}
            {step === 'plan' && renderPlan()}
            {step === 'tailoring' && renderTailoring()}
            {step === 'review' && tailored && renderReview()}
            {step === 'apply' && renderApply()}
          </>
        )}
      </div>

      {footer && <footer className="tf-foot">{footer}</footer>}
    </div>
  );
};
