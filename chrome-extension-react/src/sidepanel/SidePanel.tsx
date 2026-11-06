import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { SignedOut } from './components/SignedOut';
import { ProfileSetupGuide } from './components/ProfileSetupGuide';
import { ProfileSection } from './components/ProfileSection';
import { JobMatchSection } from './components/JobMatchSection';
import { QuickActions } from './components/QuickActions';
import { SavedAnswersSection } from './components/SavedAnswersSection';
import { AnswersModal } from './components/AnswersModal';
import { JobTrackerLink } from './components/JobTrackerLink';
import { Footer } from './components/Footer';
import { AutofillSettings, getAutofillMode } from './components/AutofillSettings';
import { PromoCodeRedeem } from './components/PromoCodeRedeem';
import { Notification, NotificationProps } from './components/Notification';
import { CoverLetterModal } from './components/CoverLetterModal';
import { SmartAnswersModal, type SmartAnswersRestore, type ReusedQuestion } from './components/SmartAnswersModal';
import { reusedToast, buildSavedRows } from '../answerMemory';
import { learnedList } from './memoryApi';
import { AddExperienceModal } from './components/AddExperienceModal';
import { MatchAnalysisModal } from './components/MatchAnalysisModal';
import { PendingApplicationCard } from './components/PendingApplicationCard';
import { TailorFlow, type TailorRestore, type TailorStatus } from './components/TailorFlow';
import { computeProfileProgress, buildProfileSummary, type ProfileSummary } from './profileProgress';
import type { FullProfile, JobInfo, AuthState, KeywordAnalysis } from '../types';
import { BrandIcon, BrandLogo } from '../components/BrandLogo';
import {
  BG_TASKS_KEY,
  TASK_AUTO_SURFACE_MS,
  clearTaskBadge,
  isTaskStale,
  jobTaskKey,
  markBgTaskSeen,
  readBgTasks,
  type BgTaskKind,
  type BgTaskRecord,
} from '../tasks';

/** How long the Analyze-button hint stays up. The toast's 3s is tuned for
 *  "saved", not for a sentence the user has to act on. */
const ANALYZE_HINT_TIMEOUT_MS = 9000;

export const SidePanel: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
  });
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [lastProfile, setLastProfile] = useState<ProfileSummary | null>(null);
  /** This browser has had a signed-in session at some point (i.e. has an account). */
  const [hasAccount, setHasAccount] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [answersCount, setAnswersCount] = useState(0);
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [reusedQuestions, setReusedQuestions] = useState<ReusedQuestion[]>([]);
  const [notification, setNotification] = useState<NotificationProps | null>(null);
  /**
   * Why the last Analyze click came back empty, shown against the button that
   * produced it. Wrapped in an object so clicking Analyze onto the same error
   * twice is a new value and restarts the dismiss timer, which a bare string
   * would not.
   */
  const [analyzeHint, setAnalyzeHint] = useState<{ message: string } | null>(null);
  /** Committed value of currentJob, readable from callbacks that must not take
   *  it as a dependency. Decides whether an analyze error belongs on the
   *  Analyze button or in the toast. */
  const currentJobRef = useRef<JobInfo | null>(null);
  /**
   * The posting a tailor run is actually committed to, together with the tab
   * URL it was read from.
   *
   * `currentJob` is a mirror of whatever was last written to storage and can
   * belong to a job the user has since clicked away from. Tailoring used to
   * send it straight to the API — only refreshing when it was absent — so a
   * stale mirror produced a resume perfectly tailored to the wrong posting,
   * with nothing anywhere in the response able to detect that. Every tailor
   * run now re-reads the page first and pins the result here with its URL, and
   * the URL is re-checked at the moment of sending.
   */
  const verifiedJobRef = useRef<{ job: JobInfo; url: string } | null>(null);
  /**
   * The posting the tailor flow is committed to, with the tab URL it was read
   * from. Kept while the flow is hidden so a run in progress still has its job.
   */
  const [flowJob, setFlowJob] = useState<{ job: JobInfo; url: string } | null>(null);
  const [showTailorFlow, setShowTailorFlow] = useState(false);
  /** A copy tailored earlier for this posting: the flow opens at Apply. */
  const [flowCopy, setFlowCopy] = useState<any | null>(null);
  /** A tailor task that did not start in this panel instance. */
  const [tailorRestore, setTailorRestore] = useState<TailorRestore | null>(null);
  const [tailorStatus, setTailorStatus] = useState<TailorStatus>('idle');
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  // Cover-letter generation that belongs to a background task rather than to
  // this panel instance — set when we reopen on top of a run that is still
  // going, or that finished while the panel was closed.
  const [coverLetterGenerating, setCoverLetterGenerating] = useState(false);
  const [coverLetterInjected, setCoverLetterInjected] = useState<{ text: string; ts: number } | null>(null);
  const [smartAnswersRestore, setSmartAnswersRestore] = useState<SmartAnswersRestore | null>(null);
  const [showSmartAnswers, setShowSmartAnswers] = useState(false);
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [choicesOnly, setChoicesOnly] = useState(false);
  const [isDetectingQuestions, setIsDetectingQuestions] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);
  const [showMatchAnalysis, setShowMatchAnalysis] = useState(false);
  const [matchAnalysis, setMatchAnalysis] = useState<import('../types').MatchAnalysis | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // --- background-task plumbing --------------------------------------------
  // Long operations run in the service worker as durable tasks (see src/tasks.ts)
  // so closing the panel no longer kills them. Two refs keep the storage mirror
  // from fighting with the panel's own await:
  //   activeOps  — kinds this panel instance started and is still awaiting, so
  //                the mirrored outcome isn't applied (and notified) twice;
  //   appliedTasks — the last record version we surfaced per task id.
  const activeOpsRef = useRef<Map<BgTaskKind, number>>(new Map());
  const appliedTasksRef = useRef<Map<string, number>>(new Map());
  const beginOp = useCallback((kind: BgTaskKind) => {
    activeOpsRef.current.set(kind, (activeOpsRef.current.get(kind) || 0) + 1);
  }, []);
  const endOp = useCallback((kind: BgTaskKind) => {
    // Ownership is released on a delay: the storage mirror flipping to 'done'
    // and the sendMessage response race each other, and whichever arrives
    // second must not re-apply an outcome the first already handled.
    window.setTimeout(() => {
      const next = (activeOpsRef.current.get(kind) || 1) - 1;
      if (next <= 0) activeOpsRef.current.delete(kind);
      else activeOpsRef.current.set(kind, next);
    }, 2000);
  }, []);
  const ownsOp = useCallback(
    (kind: BgTaskKind) => (activeOpsRef.current.get(kind) || 0) > 0,
    [],
  );
  /** Awaits a request this panel instance owns end-to-end. */
  const runOwnedOp = useCallback(async <T,>(kind: BgTaskKind, run: () => Promise<T>): Promise<T> => {
    beginOp(kind);
    try {
      return await run();
    } finally {
      endOp(kind);
    }
  }, [beginOp, endOp]);

  // Load auth and profile on mount
  useEffect(() => {
    loadAuthAndProfile();
    loadJobInfo();
    loadAnswersCount();
    // Restore the returning-user summary so the reconnect screen can show
    // before/without a fresh login. `hasSignedInBefore` (set on every sign-in,
    // never cleared on sign-out) and `extSignedOut` tell the signed-out screen
    // whether this person already has an account — if they do we ask them to
    // sign in, otherwise we send them to build a profile first.
    chrome.storage.local.get([
      'lastProfileSummary',
      'hasSignedInBefore',
      'extSignedOut',
    ]).then(({ lastProfileSummary, hasSignedInBefore, extSignedOut }) => {
      if (lastProfileSummary) setLastProfile(lastProfileSummary as ProfileSummary);
      if (hasSignedInBefore || extSignedOut) setHasAccount(true);
    }).catch(() => {});

    // Tailoring, cover letters, analyses and the rest are recovered generically
    // from the background-task registry — see the effect further down.

    // Re-fetch job info when the active tab navigates (SPA support)
    const onTabUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url || changeInfo.status === 'complete') {
        // Small delay to let SPA content render, then poll
        setTimeout(() => loadJobInfoWithRetry(), 600);
      }
      // The hint describes the page that was open when Analyze was clicked, so
      // a navigation retires it — right or wrong, it is about somewhere else.
      if (changeInfo.url) setAnalyzeHint(null);
    };
    const onTabActivated = () => {
      setTimeout(() => loadJobInfoWithRetry(), 300);
      setAnalyzeHint(null);
    };
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onActivated.addListener(onTabActivated);

    // Listen for storage changes — the content script writes job info reactively.
    const onStorageChanged = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if ('currentJobInfo' in changes) {
        const job = changes.currentJobInfo.newValue;
        if (job && (job.title || job.company)) {
          console.log('[ProfileAI SidePanel] Got job from storage change:', job.title);
          setCurrentJob(job);
        } else {
          // Storage was cleared (non-job page detected by background). Drop
          // any stale job we were showing so the panel doesn't display a
          // phantom job card scraped from a previous tab.
          setCurrentJob(null);
        }
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);

    // Start a background polling for job info (covers cases where storage was written
    // before listener was registered, or tab message fails from iframe/side panel context)
    let pollCount = 0;
    const maxPolls = 8;
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        return;
      }
      // Only poll if we don't have a job yet
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_JOB_INFO_RELAY' });
        if (response && (response.title || response.company)) {
          setCurrentJob((prev: JobInfo | null) => {
            if (!prev) {
              console.log('[ProfileAI SidePanel] Got job from poll relay:', response.title);
              return response;
            }
            return prev;
          });
          clearInterval(pollInterval);
        }
      } catch (_) {}
    }, 2000);

    return () => {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      clearInterval(pollInterval);
    };
  }, []);

  const loadAuthAndProfile = async () => {
    try {
      setLoading(true);
      
      // First try to get existing auth
      let authData = await chrome.runtime.sendMessage({ type: 'GET_AUTH' });
      
      // If not authenticated, try to sync from web app
      if (!authData?.token) {
        console.log('[ProfileAI] No auth found, trying to sync from web app...');
        authData = await chrome.runtime.sendMessage({ type: 'SYNC_AUTH_FROM_WEB' });
      }
      
      if (authData?.token && authData?.user) {
        setAuthState({
          isAuthenticated: true,
          token: authData.token,
          user: authData.user,
        });

        // Load profile
        const profileResponse = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
        const profileData = profileResponse?.profile || profileResponse?.data;
        
        if (profileData) {
          // Merge user data into profile
          const merged: FullProfile = {
            ...profileData,
            firstName: authData.user.firstName,
            lastName: authData.user.lastName,
            email: authData.user.email,
          };
          setProfile(merged);

          // Persist a lightweight summary so a returning (signed-out) user gets
          // the reconnect screen instead of a blank form.
          const summary = buildProfileSummary(merged, authData.user);
          if (summary) {
            setLastProfile(summary);
            chrome.storage.local.set({ lastProfileSummary: summary }).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.error('[ProfileAI] Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJobInfo = async () => {
    let job: JobInfo | null = null;

    // Method 1 (most reliable): Ask the background script to relay from content script + storage
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_JOB_INFO_RELAY' });
      if (response && (response.title || response.company)) {
        job = response;
        console.log('[ProfileAI SidePanel] Got job from background relay:', job!.title);
      }
    } catch (e) {
      console.log('[ProfileAI SidePanel] Background relay failed:', e);
    }

    // Method 2: Read directly from storage
    if (!job) {
      try {
        const stored = await chrome.storage.local.get(['currentJobInfo', 'currentJobUrl']);
        if (stored.currentJobInfo && (stored.currentJobInfo.title || stored.currentJobInfo.company)) {
          job = stored.currentJobInfo;
          console.log('[ProfileAI SidePanel] Got job from storage:', job!.title);
        }
      } catch (e) {
        console.log('[ProfileAI SidePanel] Storage read failed:', e);
      }
    }

    // Method 3: Direct tab message (works in native side panel context)
    if (!job) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.id) {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
          if (response?.title || response?.company) {
            job = response;
            console.log('[ProfileAI SidePanel] Got job from direct tab message:', job!.title);
          }
        }
      } catch (e) {
        console.log('[ProfileAI SidePanel] Direct tab message failed:', e);
      }
    }

    if (job) {
      setCurrentJob(job);
    } else {
      console.log('[ProfileAI SidePanel] No job found after all methods');
      setCurrentJob(null);
    }
  };

  // Retry wrapper that keeps trying via background relay
  const loadJobInfoWithRetry = async () => {
    await loadJobInfo();
    setTimeout(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_JOB_INFO_RELAY' });
        if (response && (response.title || response.company)) {
          setCurrentJob((prev: JobInfo | null) => {
            if (!prev) {
              console.log('[ProfileAI SidePanel] Got job from delayed relay:', response.title);
              return response;
            }
            return prev;
          });
        }
      } catch (_) {}
    }, 2500);
  };

  const loadAnswersCount = async () => {
    const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
    const learned = await learnedList();
    setAnswersCount(buildSavedRows(learned.ok ? learned.items : [], savedAnswers || {}).length);
  };

  const handleRefresh = useCallback(async () => {
    await loadAuthAndProfile();
    await loadJobInfo();
    showNotification('Refreshed!', 'success');
  }, []);

  const handleLogout = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    setAuthState({ isAuthenticated: false, token: null, user: null });
    setProfile(null);
  }, []);

  const handleAutofill = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.id) {
        const autofillMode = await getAutofillMode();
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TRIGGER_AUTOFILL',
          data: profile,
          autofillMode,
          // NEW: conservative mode — fills only reliable text basics. Skips selects, custom dropdowns,
          // checkboxes, radios — which are unreliable on React-rendered ATSes.
          basicsOnly: true,
        });
        showNotification('Filled the basics, review the rest before submitting', 'success');
      }
    } catch (error) {
      showNotification('Please refresh the page and try again', 'warning');
    }
  }, [profile]);

  // Quick Fill leaves required dropdowns it has no saved fact for. Show them,
  // with their real options, in the Answer Questions screen (choices only, so
  // nothing is drafted or billed).
  useEffect(() => {
    const listener = (message: any) => {
      if (message?.type !== 'QUICKFILL_NEEDS_CHOICES') return;
      const n = Number(message.data?.count) || 0;
      const reusedList: ReusedQuestion[] = Array.isArray(message.data?.reused) ? message.data.reused : [];
      if (n <= 0 && reusedList.length === 0) return;
      if (reusedList.length > 0) showNotification(reusedToast(reusedList.length), 'info');
      else showNotification(`${n} dropdown${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your choice`, 'info');
      // Quick Fill can report twice (a second pass finds the dropdowns already filled and
      // reports none), so what was already reported is kept, not replaced.
      setReusedQuestions((prev) => {
        if (reusedList.length === 0) return prev;
        const seen = new Set(prev.map((r) => r.question));
        return [...prev, ...reusedList.filter((r) => !seen.has(r.question))];
      });
      setSmartAnswersRestore(null);
      setChoicesOnly(true);
      setShowSmartAnswers(false);
      window.setTimeout(() => setShowSmartAnswers(true), 50);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleSmartAnswers = useCallback(async () => {
    setIsDetectingQuestions(true);
    try {
      // Make sure we have job info first.
      if (!currentJob) {
        try {
          const r = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' });
          if (r?.jobInfo && (r.jobInfo.title || r.jobInfo.company)) {
            setCurrentJob(r.jobInfo);
          }
        } catch (_) {}
      }
      // Open the modal — it will run detect + answer when opened.
      setChoicesOnly(false);
      setShowSmartAnswers(true);
    } finally {
      setIsDetectingQuestions(false);
    }
  }, [currentJob]);

  /**
   * Read the posting in front of the user right now and pin it for this run.
   *
   * Always re-reads — it does not short-circuit on `currentJob` being set,
   * which is the behaviour that let a stale mirror reach the API. The read is
   * on-device (DOM scrape plus the local keyword scan), so there is no credit
   * and no AI call to save by skipping it.
   *
   * The tab URL is captured in the same breath as the posting so that
   * everything keyed by URL later — the retailor cache, the saved record, the
   * background task key — refers to the page the text actually came from,
   * rather than to whatever tab happens to be focused when the run finishes.
   */
  const readJobForRun = useCallback(async (): Promise<{ job: JobInfo; url: string } | null> => {
    let url = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      url = tab?.url || '';
    } catch (_) {}

    let job: JobInfo | null = null;
    try {
      const response = await runOwnedOp('keywords', () => chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' }));
      if (response?.jobInfo && (response.jobInfo.title || response.jobInfo.company || response.jobInfo.description)) {
        job = response.jobInfo;
        if (response?.success && response?.keywords) setKeywordAnalysis(response.keywords);
      }
    } catch (_) {}

    if (!job) {
      try {
        const relay = await chrome.runtime.sendMessage({ type: 'GET_JOB_INFO_RELAY' });
        if (relay && (relay.title || relay.company || relay.description)) job = relay;
      } catch (_) {}
    }

    if (!job) return null;

    setCurrentJob(job);
    const pinned = { job, url };
    verifiedJobRef.current = pinned;
    console.log('[ProfileAI SidePanel] Pinned job for this run:', job.title, '| desc chars:', job.description?.length || 0, '|', url);
    return pinned;
  }, []);

  const handleAnalyzeMatch = useCallback(async () => {
    setShowMatchAnalysis(true);
    setMatchLoading(true);
    beginOp('match');
    try {
      // Re-read the page rather than trusting `currentJob`, which mirrors
      // storage and can describe a posting the user has clicked away from.
      // Same reason as handleTailor: the read is on-device and free.
      const job = (await readJobForRun())?.job || currentJob;
      const resp = await chrome.runtime.sendMessage({
        type: 'ANALYZE_MATCH',
        data: {
          jobTitle: job?.title,
          company: job?.company,
          jobDescription: job?.description || '',
        },
      });
      if (resp?.success && resp?.analysis) {
        setMatchAnalysis(resp.analysis);
      } else {
        showNotification(resp?.error || 'Could not analyze match', 'error');
      }
    } catch (e) {
      showNotification((e as Error).message || 'Match analysis failed', 'error');
    } finally {
      endOp('match');
      setMatchLoading(false);
    }
  }, [currentJob, readJobForRun]);

  const handleTailor = useCallback(async () => {
    // Re-read the page unconditionally. This used to refresh only when there
    // was no job at all, so a `currentJob` left over from a posting the user
    // had clicked away from was tailored against verbatim.
    const pinned = await readJobForRun();

    if (!pinned) {
      showNotification('Could not detect job info on this page', 'warning');
      return;
    }

    // A run hidden earlier, or a finished one waiting at Review, for this same
    // posting: reopen it rather than starting over.
    if (tailorStatus !== 'idle' && flowJob && flowJob.url === pinned.url) {
      setShowTailorFlow(true);
      return;
    }

    if (!(pinned.job.description || '').trim()) {
      showNotification('Could not read the job description on this page. Scroll the posting into view and try again.', 'warning');
      return;
    }

    // A copy tailored before for this posting (keyed by the URL the posting was
    // read from) opens at Apply, like the web flow's saved copy.
    let cached: any = null;
    try {
      if (pinned.url) {
        const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
        cached = tailoredCache[pinned.url] || null;
      }
    } catch (_) {}

    setFlowCopy(cached);
    setFlowJob(pinned);
    setShowTailorFlow(true);
  }, [readJobForRun, tailorStatus, flowJob]);

  const handleAnalyzeKeywords = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalyzeHint(null);
    beginOp('keywords');
    try {
      // ANALYZE_JOB_PAGE reads the page and, with `score`, runs the AI match
      // read on it — the one score the card shows.
      const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE', data: { score: true } });

      // Update the job card with fresh info (accept if it has description, title, or company)
      if (response?.jobInfo && (response.jobInfo.title || response.jobInfo.company || response.jobInfo.description)) {
        setCurrentJob(response.jobInfo);
      }

      if (response?.success && response?.keywords) {
        setKeywordAnalysis(response.keywords);
        // No toast: the card itself carries the result, and a "matched N of M"
        // banner would announce a count the card deliberately breaks apart into
        // evidenced / partial / gaps.
      } else {
        throw new Error(response?.error || 'Analysis failed');
      }
    } catch (error) {
      const message = (error as Error).message || 'Keyword analysis failed';
      // With no job on screen the failure has a button to point at, and the
      // empty state is exactly where "this isn't a job posting" makes sense.
      // Once a job card is showing, that anchor is gone and the toast is still
      // the only place the message fits.
      if (currentJobRef.current) showNotification(message, 'error');
      else setAnalyzeHint({ message });
    } finally {
      endOp('keywords');
      setIsAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    currentJobRef.current = currentJob;
    // A job arrived — whatever the previous click failed to find is now moot.
    if (currentJob) setAnalyzeHint(null);
  }, [currentJob]);

  /**
   * The hint answers a click, so it outlasts the 3s toast by a wide margin —
   * long enough to read the sentence, look at the page it is talking about,
   * and look back. It also takes Escape and its own close button, because an
   * explanation the user has already read should go when they say so rather
   * than sit there for the rest of the countdown.
   */
  useEffect(() => {
    if (!analyzeHint) return;
    const timer = setTimeout(() => setAnalyzeHint(null), ANALYZE_HINT_TIMEOUT_MS);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnalyzeHint(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [analyzeHint]);

  const showNotification = (message: string, type: 'success' | 'warning' | 'info' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCoverLetter = useCallback(async () => {
    // Re-read the page, same as tailoring: a cover letter written against the
    // posting the user was looking at a minute ago is as wrong as a resume.
    const pinned = await readJobForRun();
    if (!pinned) {
      showNotification('Could not detect job info on this page', 'warning');
      return;
    }
    setShowCoverLetterModal(true);
  }, [readJobForRun]);

  const generateCoverLetter = useCallback(async (tone: string, length: string): Promise<string | null> => {
    // The posting pinned when the modal opened — not the live mirror, and not
    // whichever tab is focused by the time the user picks a tone.
    const pinnedJob = verifiedJobRef.current?.job || currentJob;
    if (!pinnedJob) return null;
    // The background caches the finished letter under this URL, so a panel
    // that reopens after the run finishes still finds it.
    const jobUrl = verifiedJobRef.current?.url || '';
    beginOp('coverLetter');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        data: {
          jobTitle: pinnedJob.title,
          company: pinnedJob.company,
          jobDescription: pinnedJob.description || '',
          jobUrl,
          tone,
          length,
        },
      });
      if (response?.success && response?.coverLetter) {
        showNotification('Cover letter generated!', 'success');
        return response.coverLetter;
      }
      throw new Error(response?.error || 'Generation failed');
    } catch (error) {
      showNotification((error as Error).message || 'Failed to generate cover letter', 'error');
      return null;
    } finally {
      endOp('coverLetter');
    }
  }, [currentJob]);

  // --- background-task restore ---------------------------------------------

  /**
   * Mirrors one task record into panel state. Runs both for records found at
   * mount (the work happened while the panel was closed) and for later changes
   * to the registry (the work finished with the panel open but nothing in this
   * instance awaiting it).
   */
  const applyTaskRecord = useCallback(async (rec: BgTaskRecord) => {
    const running = rec.status === 'running';
    const res: any = rec.result;
    // A runner that resolved with { success: false } is a finished task
    // carrying a user-facing error, not a crash — both read the same here.
    const failure = rec.status === 'error'
      ? (rec.error || 'That run did not finish')
      : (res && res.success === false ? (res.error || 'That run did not finish') : null);

    switch (rec.kind) {
      case 'tailor': {
        // Only runs started by the tailor flow; a record from an older build has
        // another shape and nothing to restore.
        if (!rec.meta?.flow) return;
        const url = String(rec.meta?.jobUrl || '');
        setFlowJob((prev) => prev && prev.url === url ? prev : {
          url,
          job: currentJobRef.current || {
            title: String(rec.meta?.jobTitle || ''),
            company: String(rec.meta?.company || ''),
            description: '',
          },
        });
        setFlowCopy(null);
        setTailorRestore({
          status: running ? 'running' : failure ? 'error' : 'done',
          startedAt: rec.startedAt,
          result: res,
          error: failure || undefined,
          stamp: rec.updatedAt,
        });
        setShowTailorFlow(true);
        return;
      }

      case 'keywords': {
        setIsAnalyzing(running);
        if (running || failure) return;
        if (res?.jobInfo && (res.jobInfo.title || res.jobInfo.company || res.jobInfo.description)) {
          setCurrentJob(res.jobInfo);
        }
        if (res?.keywords) setKeywordAnalysis(res.keywords);
        return;
      }

      case 'match': {
        setShowMatchAnalysis(true);
        setMatchLoading(running);
        if (running) return;
        if (failure) {
          showNotification(failure, 'error');
          return;
        }
        if (res?.analysis) setMatchAnalysis(res.analysis);
        return;
      }

      case 'coverLetter': {
        setShowCoverLetterModal(true);
        setCoverLetterGenerating(running);
        if (running) return;
        if (failure) {
          showNotification(failure, 'error');
          return;
        }
        if (res?.coverLetter) {
          setCoverLetterInjected({ text: res.coverLetter, ts: rec.updatedAt });
          showNotification('Your cover letter is ready.', 'success');
        }
        return;
      }

      case 'smartAnswers': {
        const questions = (rec.meta?.questions as any[]) || [];
        setShowSmartAnswers(true);
        if (running) {
          setSmartAnswersRestore({ questions, status: 'generating' });
          return;
        }
        if (failure) {
          setSmartAnswersRestore({ questions, status: 'error', error: failure });
          return;
        }
        setSmartAnswersRestore({ questions, status: 'ready', results: res?.results || [] });
        return;
      }

      default:
        // 'singleAnswer' and anything newer than this panel build: no UI to
        // restore, the task still runs to completion in the worker.
        return;
    }
  }, []);

  /**
   * Whether a record belongs to the page the user is looking at right now.
   * Every job-scoped task is keyed by page, so a tailor started on job A never
   * gets restored on top of job B — it waits until they navigate back.
   */
  const taskMatchesTab = useCallback((rec: BgTaskRecord, tabKey: string): boolean => {
    if (!tabKey || !rec.key || rec.key === 'default') return true;
    return rec.key === tabKey;
  }, []);

  /** Whether this record still has something the user hasn't been shown. */
  const shouldApplyTask = useCallback((rec: BgTaskRecord): boolean => {
    if (!rec?.kind || !rec.id) return false;
    if (rec.kind === 'singleAnswer') return false;
    if (appliedTasksRef.current.get(rec.id) === rec.updatedAt) return false;
    if (rec.status === 'running') return !isTaskStale(rec);
    if (rec.seenAt) return false;
    // Something that finished long ago shouldn't jump back into the user's
    // face the next time they open the panel.
    return Date.now() - (rec.updatedAt || 0) < TASK_AUTO_SURFACE_MS;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const currentTabKey = async (): Promise<string> => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        return jobTaskKey({ jobUrl: tab?.url || '' });
      } catch {
        return '';
      }
    };

    const consider = async (tasks: Record<string, BgTaskRecord>) => {
      const tabKey = await currentTabKey();
      if (cancelled) return;
      const records = Object.values(tasks || {})
        .filter(Boolean)
        .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
      let applied = 0;
      for (const rec of records) {
        if (cancelled) return;
        if (!shouldApplyTask(rec)) continue;
        // Not this page's work. Left untouched rather than consumed, so it
        // still surfaces if the user navigates back to it.
        if (!taskMatchesTab(rec, tabKey)) continue;
        // This panel started the operation and is awaiting the response
        // itself — mark the outcome consumed so it isn't replayed on the next
        // open, but let the awaiting handler do the UI work.
        if (ownsOp(rec.kind)) {
          appliedTasksRef.current.set(rec.id, rec.updatedAt);
          if (rec.status !== 'running') void markBgTaskSeen(rec.id);
          continue;
        }
        appliedTasksRef.current.set(rec.id, rec.updatedAt);
        await applyTaskRecord(rec);
        if (rec.status !== 'running') void markBgTaskSeen(rec.id);
        applied += 1;
      }
      // The badge means "something finished that you haven't seen" — only
      // drop it once we've actually put that something on screen.
      if (applied > 0) void clearTaskBadge();
    };

    const refresh = () => {
      readBgTasks().then((tasks) => { void consider(tasks); }).catch(() => {});
    };

    // Work that ran while the panel was closed.
    refresh();

    const onTasksChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local' || !(BG_TASKS_KEY in changes)) return;
      void consider((changes[BG_TASKS_KEY].newValue as Record<string, BgTaskRecord>) || {});
    };
    // Navigating back to the page a task belongs to is what makes its result
    // relevant again, so re-check on tab switches and URL changes too.
    const onTabActivated = () => refresh();
    const onTabUpdated = (_id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url) refresh();
    };
    chrome.storage.onChanged.addListener(onTasksChanged);
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onTasksChanged);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [applyTaskRecord, shouldApplyTask, taskMatchesTab, ownsOp]);

  if (loading) {
    return (
      <div className="app loading-state">
        <div className="loading-spinner">
          <BrandIcon size={48} />
          <div className="spinner" />
        </div>
        <div className="loading-logo">
          <BrandLogo iconSize={28} fontSize={18} />
        </div>
      </div>
    );
  }

  const profileProgress = computeProfileProgress(profile);

  return (
    <div className="app">
      <Header onRefresh={handleRefresh} />
      
      {!authState.isAuthenticated ? (
        <>
          <SignedOut
            currentJob={currentJob}
            lastProfile={lastProfile}
            hasAccount={hasAccount}
            onAuthSync={loadAuthAndProfile}
          />
        </>
      ) : !profileProgress.hasMinimumProfile ? (
        <>
          <ProfileSetupGuide
            profile={profile}
            currentJob={currentJob}
            progress={profileProgress}
          />
          <Footer onLogout={handleLogout} />
        </>
      ) : (
        <>
          <div className="main-content">
            <PendingApplicationCard currentUrl={currentJob?.url} />

            <ProfileSection profile={profile} />
            
            <JobMatchSection 
              currentJob={currentJob} 
              onAnalyze={handleAnalyzeKeywords}
              analyzeHint={analyzeHint?.message ?? null}
              onDismissAnalyzeHint={() => setAnalyzeHint(null)}
              keywordAnalysis={keywordAnalysis}
              isAnalyzing={isAnalyzing}
              onTailor={handleTailor}
              tailorStatus={tailorStatus}
            />
            
            <QuickActions 
              onSmartAnswers={handleSmartAnswers}
              onQuickFillBasics={handleAutofill}
              onTailor={handleTailor}
              onCoverLetter={handleCoverLetter}
              onAddExperience={() => setShowAddExperience(true)}
              hasJob={!!currentJob}
              tailorStatus={tailorStatus}
              isDetecting={isDetectingQuestions}
              detectedCount={detectedCount}
            />

            <AutofillSettings />

            <SavedAnswersSection 
              count={answersCount}
              onManage={() => setShowAnswersModal(true)}
            />
            
            <JobTrackerLink />
            
            <PromoCodeRedeem
              onSuccess={(msg) => showNotification(msg, 'success')}
              onError={(msg) => showNotification(msg, 'error')}
            />
          </div>
          
          <Footer onLogout={handleLogout} />
        </>
      )}
      
      {showAnswersModal && (
        <AnswersModal 
          onClose={() => {
            setShowAnswersModal(false);
            loadAnswersCount();
          }}
          onNotification={showNotification}
        />
      )}

      <TailorFlow
        open={showTailorFlow && !!flowJob}
        onClose={() => setShowTailorFlow(false)}
        job={flowJob?.job || null}
        jobUrl={flowJob?.url || ''}
        profile={profile}
        initialCopy={flowCopy}
        restore={tailorRestore}
        onStatus={setTailorStatus}
        onNotify={showNotification}
        onOpStart={() => beginOp('tailor')}
        onOpEnd={() => endOp('tailor')}
      />

      {showCoverLetterModal && (
        <CoverLetterModal
          open={showCoverLetterModal}
          onClose={() => {
            setShowCoverLetterModal(false);
            setCoverLetterGenerating(false);
            setCoverLetterInjected(null);
          }}
          jobTitle={currentJob?.title}
          company={currentJob?.company}
          onGenerate={generateCoverLetter}
          onNotification={showNotification}
          backgroundGenerating={coverLetterGenerating}
          backgroundLetter={coverLetterInjected}
        />
      )}

      <SmartAnswersModal
        open={showSmartAnswers}
        onClose={() => {
          setShowSmartAnswers(false);
          setSmartAnswersRestore(null);
          loadAnswersCount();
        }}
        currentJob={currentJob}
        onNotification={showNotification}
        onAnswersGenerated={(count?: number) => {
          if (typeof count === 'number') setDetectedCount(count);
          loadAnswersCount();
        }}
        restore={smartAnswersRestore}
        choicesOnly={choicesOnly}
        reused={reusedQuestions}
        onOpStart={() => beginOp('smartAnswers')}
        onOpEnd={() => endOp('smartAnswers')}
      />

      <AddExperienceModal open={showAddExperience} onClose={() => setShowAddExperience(false)} />

      <MatchAnalysisModal
        open={showMatchAnalysis}
        onClose={() => setShowMatchAnalysis(false)}
        loading={matchLoading}
        analysis={matchAnalysis}
        currentJob={currentJob}
        onRefresh={handleAnalyzeMatch}
      />

      
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type}
        />
      )}
    </div>
  );
};
