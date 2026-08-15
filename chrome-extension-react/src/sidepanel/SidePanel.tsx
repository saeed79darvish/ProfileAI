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
import { TailoredResults } from './components/TailoredResults';
import { AutofillSettings, getAutofillMode } from './components/AutofillSettings';
import { PromoCodeRedeem } from './components/PromoCodeRedeem';
import { Notification, NotificationProps } from './components/Notification';
import { CoverLetterModal } from './components/CoverLetterModal';
import { SmartAnswersModal, type SmartAnswersRestore } from './components/SmartAnswersModal';
import { MatchAnalysisModal } from './components/MatchAnalysisModal';
import { LinkedInAnalyzerModal } from './components/LinkedInAnalyzerModal';
import { AnalyzeLinkedInPill } from './components/AnalyzeLinkedInPill';
import { AnalyzerGoalPicker } from './components/AnalyzerGoalPicker';
import { useWebSignIn } from './components/useWebSignIn';
import { emitAnalyticsEvent } from './analytics';
import { TailorSettingsModal, TailorSettings } from './components/TailorSettingsModal';
import { TailoringProgress } from './components/TailoringProgress';
import { GapReviewModal } from './components/GapReviewModal';
import { computeProfileProgress, buildProfileSummary, type ProfileSummary } from './profileProgress';
import type { FullProfile, JobInfo, AuthState, LinkedInProfileAnalysis } from '../types';
import { BrandIcon, BrandLogo } from '../components/BrandLogo';
import {
  BG_TASKS_KEY,
  TASK_AUTO_SURFACE_MS,
  clearBgTask,
  clearTaskBadge,
  isTaskStale,
  jobTaskKey,
  markBgTaskSeen,
  readBgTasks,
  type BgTaskKind,
  type BgTaskRecord,
} from '../tasks';

// --- LinkedIn analysis cache helpers (shared by detector + analyzer) --------
const LI_CACHE_KEY = 'linkedInAnalysisCache';
const LI_CACHE_MAX_ENTRIES = 20;
const LI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Normalized target-title slug used in the cache key. Empty / null becomes
 *  'inferred' so guest + goal-picker "let AI infer" analyses share their
 *  own bucket instead of colliding with a specific-role analysis of the
 *  same profile. Mirrors the backend's normalisation exactly so client and
 *  server caches see the same rows. */
const normalizeTargetTitleForKey = (t: string | null | undefined): string => {
  if (t == null) return 'inferred';
  const s = String(t).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '');
  return s || 'inferred';
};

/** Normalized cache key for a LinkedIn profile URL + target title.
 *  Returns null when the URL isn't a /in/ profile page.
 *
 *  Old shape was `${origin}${pathname}` (URL only). That collided across
 *  targets: if you first analysed profile X as "Senior Frontend Engineer"
 *  then re-analysed for "VP of ML", the second click hit the URL-only cache
 *  and returned the Frontend analysis. Including target in the key gives
 *  each (profile, target) tuple its own row. */
const linkedInCacheKey = (
  url: string | undefined | null,
  targetTitle?: string | null,
): string | null => {
  if (!url || !/linkedin\.com\/in\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}::${normalizeTargetTitleForKey(targetTitle)}`;
  } catch {
    return null;
  }
};

/** URL-only prefix used by readAnyLinkedInCacheForUrl below. Every
 *  target-specific key starts with this. */
const linkedInUrlPrefix = (url: string | undefined | null): string | null => {
  if (!url || !/linkedin\.com\/in\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}::`;
  } catch {
    return null;
  }
};

/** Returns the cached entry for a (profile URL, target) pair, or null. */
const readLinkedInCache = async (
  cacheKeyUrl: string,
): Promise<{ analysis: LinkedInProfileAnalysis; targetTitle?: string; cachedAt: number } | null> => {
  try {
    const { [LI_CACHE_KEY]: cache = {} } = await chrome.storage.local.get(LI_CACHE_KEY);
    const hit = cache?.[cacheKeyUrl];
    if (hit?.analysis && hit?.cachedAt && Date.now() - hit.cachedAt < LI_CACHE_TTL_MS) {
      return hit;
    }
  } catch {
    /* treat as no cache */
  }
  return null;
};

/** Writes an analysis into the client cache, evicting the oldest entries past
 *  the cap. Shared by the live analyze path and the background-task restore
 *  path so both leave the "analyzed X ago" pill in the same state. */
const writeLinkedInCache = async (
  cacheKeyUrl: string,
  analysis: LinkedInProfileAnalysis,
  targetTitle: string | undefined,
  cachedAt: number,
): Promise<void> => {
  try {
    const { [LI_CACHE_KEY]: cache = {} } = await chrome.storage.local.get(LI_CACHE_KEY);
    const next: Record<string, any> = { ...cache };
    next[cacheKeyUrl] = { analysis, targetTitle, cachedAt };
    const entries = Object.entries(next) as Array<[string, { cachedAt: number }]>;
    if (entries.length > LI_CACHE_MAX_ENTRIES) {
      entries.sort((a, b) => (b[1]?.cachedAt || 0) - (a[1]?.cachedAt || 0));
      const trimmed: Record<string, any> = {};
      entries.slice(0, LI_CACHE_MAX_ENTRIES).forEach(([k, v]) => (trimmed[k] = v));
      await chrome.storage.local.set({ [LI_CACHE_KEY]: trimmed });
    } else {
      await chrome.storage.local.set({ [LI_CACHE_KEY]: next });
    }
  } catch {
    /* non-fatal — the result is still shown, just not cached */
  }
};

/** Returns the MOST RECENT cached entry for a profile URL, regardless of
 *  target. Used by the pill indicator ("analyzed X ago") which shouldn't
 *  care which target was used — any prior analysis of this profile counts. */
const readAnyLinkedInCacheForUrl = async (
  urlPrefix: string,
): Promise<{ analysis: LinkedInProfileAnalysis; targetTitle?: string; cachedAt: number } | null> => {
  try {
    const { [LI_CACHE_KEY]: cache = {} } = await chrome.storage.local.get(LI_CACHE_KEY);
    if (!cache || typeof cache !== 'object') return null;
    let best: { analysis: LinkedInProfileAnalysis; targetTitle?: string; cachedAt: number } | null = null;
    for (const [key, value] of Object.entries(cache)) {
      if (!key.startsWith(urlPrefix)) continue;
      const hit = value as any;
      if (!hit?.analysis || !hit?.cachedAt) continue;
      if (Date.now() - hit.cachedAt >= LI_CACHE_TTL_MS) continue;
      if (!best || hit.cachedAt > best.cachedAt) best = hit;
    }
    return best;
  } catch {
    return null;
  }
};

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
  const [notification, setNotification] = useState<NotificationProps | null>(null);
  const [tailoredProfile, setTailoredProfile] = useState<any | null>(null);
  const [isTailoring, setIsTailoring] = useState(false);
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [retailorConfirm, setRetailorConfirm] = useState<{ jobUrl: string; jobTitle: string; company: string } | null>(null);
  const [keywordAnalysis, setKeywordAnalysis] = useState<{ matchScore: number; present: string[]; missing: string[]; totalKeywords: number } | null>(null);
  // Snapshot of the keyword analysis captured when tailoring starts, so the
  // tailored result can show an honest before → after comparison.
  const [preTailorSnapshot, setPreTailorSnapshot] = useState<{ score: number; missing: string[]; total: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  // Cover-letter generation that belongs to a background task rather than to
  // this panel instance — set when we reopen on top of a run that is still
  // going, or that finished while the panel was closed.
  const [coverLetterGenerating, setCoverLetterGenerating] = useState(false);
  const [coverLetterInjected, setCoverLetterInjected] = useState<{ text: string; ts: number } | null>(null);
  const [smartAnswersRestore, setSmartAnswersRestore] = useState<SmartAnswersRestore | null>(null);
  const [showTailorSettings, setShowTailorSettings] = useState(false);
  const [tailorSettings, setTailorSettings] = useState<TailorSettings | null>(null);
  const [showSmartAnswers, setShowSmartAnswers] = useState(false);
  const [isDetectingQuestions, setIsDetectingQuestions] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);
  const [showMatchAnalysis, setShowMatchAnalysis] = useState(false);
  const [matchAnalysis, setMatchAnalysis] = useState<import('../types').MatchAnalysis | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  // LinkedIn Profile Analyzer state
  const [isOnLinkedInProfile, setIsOnLinkedInProfile] = useState(false);
  const [showLinkedInAnalyzer, setShowLinkedInAnalyzer] = useState(false);
  const [linkedInAnalysis, setLinkedInAnalysis] = useState<LinkedInProfileAnalysis | null>(null);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [linkedInErrorCode, setLinkedInErrorCode] = useState<string | null>(null);
  const [linkedInTargetTitle, setLinkedInTargetTitle] = useState<string | undefined>(undefined);
  const [linkedInCachedAt, setLinkedInCachedAt] = useState<number | null>(null);
  const [linkedInAnalysisId, setLinkedInAnalysisId] = useState<string | null>(null);
  // Goal-picker state — the modal that asks "why are you analyzing this?"
  // BEFORE we call the AI, so the target is specific instead of blindly
  // inferred. `pendingAnalyzeFlow` records whether the click that triggered
  // the picker came from the guest CTA or the authed pill, so we can route
  // to the right handler on submit.
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [pendingAnalyzeFlow, setPendingAnalyzeFlow] = useState<'authed' | 'guest' | null>(null);
  const [goalPickerContext, setGoalPickerContext] = useState<'own-profile' | 'other-profile' | undefined>(undefined);
  // Guest-mode state — separate from `linkedInAnalysis` because the guest
  // endpoint returns a teaser shape, not the full LinkedInProfileAnalysis.
  const [linkedInMode, setLinkedInMode] = useState<'guest' | 'authed'>('authed');
  const [linkedInTeaser, setLinkedInTeaser] = useState<import('../types').LinkedInProfileAnalysisTeaser | null>(null);
  // Cached-analysis timestamp for the CURRENT tab's profile URL. Drives the
  // "View LinkedIn analysis · analyzed X ago" state on the profile-card pill
  // so users know a click won't spend another credit.
  const [linkedInTabAnalyzedAt, setLinkedInTabAnalyzedAt] = useState<number | null>(null);

  // DEV-ONLY: forces the guest analyzer UX to render even when the user is
  // signed in. Not surfaced anywhere in the UI — flip it from DevTools:
  //   await chrome.storage.local.set({ debugForceGuestAnalyzer: true })
  //   // …reload the sidepanel to take effect
  // Reset with `false` (or `chrome.storage.local.remove`) when done.
  const [debugForceGuestAnalyzer, setDebugForceGuestAnalyzer] = useState(false);
  useEffect(() => {
    let active = true;
    chrome.storage.local.get('debugForceGuestAnalyzer').then((r) => {
      if (active) setDebugForceGuestAnalyzer(!!r.debugForceGuestAnalyzer);
    });
    const onChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && 'debugForceGuestAnalyzer' in changes) {
        setDebugForceGuestAnalyzer(!!changes.debugForceGuestAnalyzer.newValue);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  // Web sign-in flow for the signed-out LinkedIn-analyzer teaser. Arrow wrapper
  // defers the loadAuthAndProfile reference (declared below) past the TDZ.
  const { signInOnWeb: liTeaserSignIn } = useWebSignIn(() =>
    loadAuthAndProfile(),
  );
  const [gapReview, setGapReview] = useState<{
    gaps: any[];
    settings: TailorSettings | null;
  } | null>(null);

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
    detectLinkedInProfileTab();

    // One-time client-cache wipe. Bumped to v3 because the earlier v2 wipe
    // still left users with wrong-target cache entries when the server's
    // URL-cap soft-fallback returned a mismatched-target row — that path
    // then wrote through to the CLIENT cache under whatever target the
    // user asked for. Nuking the cache once more clears any residue.
    chrome.storage.local.get(['linkedInAnalysisCacheVersion']).then(({ linkedInAnalysisCacheVersion }) => {
      if (linkedInAnalysisCacheVersion !== 3) {
        chrome.storage.local.set({
          linkedInAnalysisCache: {},
          linkedInAnalysisCacheVersion: 3,
        }).catch(() => {});
      }
    }).catch(() => {});

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
      // Also refresh the LinkedIn-profile flag whenever a URL changes.
      if (changeInfo.url) detectLinkedInProfileTab();
    };
    const onTabActivated = () => {
      setTimeout(() => loadJobInfoWithRetry(), 300);
      // Re-check whether we're on a LinkedIn profile page.
      detectLinkedInProfileTab();
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
    let jobUrl = '';

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
          jobUrl = stored.currentJobUrl || '';
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
        jobUrl = tab?.url || '';
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
      // Get the URL for cache lookup
      if (!jobUrl) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          jobUrl = tab?.url || '';
        } catch (_) {}
      }
      if (jobUrl) {
        try {
          const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
          const cached = tailoredCache[jobUrl];
          if (cached) {
            setTailoredProfile(cached);
          }
        } catch (_) {}
      }
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
    setAnswersCount(Object.keys(savedAnswers || {}).length);
  };

  // Detect whether the active tab is a LinkedIn profile page — controls the
  // "Analyze LinkedIn Profile" pill on the profile card. Also checks whether
  // this specific profile URL already has a cached analysis, so the pill can
  // flip to "View LinkedIn analysis · analyzed X ago".
  const detectLinkedInProfileTab = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const isProfile = !!tab?.url && /linkedin\.com\/in\//i.test(tab.url);
      setIsOnLinkedInProfile(isProfile);
      if (isProfile) {
        // Any prior analysis of this profile (whatever target) satisfies the
        // "analyzed X ago" indicator — use the URL-prefix variant so target
        // choice doesn't affect the pill's badge state.
        const prefix = linkedInUrlPrefix(tab?.url);
        const hit = prefix ? await readAnyLinkedInCacheForUrl(prefix) : null;
        setLinkedInTabAnalyzedAt(hit?.cachedAt ?? null);
      } else {
        setLinkedInTabAnalyzedAt(null);
      }
    } catch {
      setIsOnLinkedInProfile(false);
      setLinkedInTabAnalyzedAt(null);
    }
  }, []);

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
        showNotification('Filled the basics — review the rest before submitting', 'success');
      }
    } catch (error) {
      showNotification('Please refresh the page and try again', 'warning');
    }
  }, [profile]);

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
      setShowSmartAnswers(true);
    } finally {
      setIsDetectingQuestions(false);
    }
  }, [currentJob]);

  const handleAnalyzeLinkedIn = useCallback(async (
    opts?: { force?: boolean; targetTitleOverride?: string }
  ) => {
    const force = opts?.force === true;
    // When the goal-picker submits, it passes an explicit `targetTitleOverride`
    // (may be an empty string, which means "let AI infer"). We use that as
    // the exact value, no auto-fill fallback. When called with no opts (e.g.
    // Re-analyze inside the modal) we keep the previous behaviour: use the
    // user's saved title ONLY when analysing their own profile.
    setShowLinkedInAnalyzer(true);
    setLinkedInError(null);
    setLinkedInErrorCode(null);
    setLinkedInMode('authed');
    setLinkedInTeaser(null);

    // Grab the tab URL upfront — we need it both to resolve the target
    // (own vs foreign profile) AND to build the cache key. Split from cache
    // logic below so the target resolves BEFORE we hit the cache.
    let tabUrl: string | undefined;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tabUrl = tab?.url || undefined;
    } catch {
      /* fallthrough with undefined */
    }

    // Resolve the target FIRST. Priority:
    //   1) explicit override from the goal-picker (may be '' meaning infer)
    //   2) user's saved title, ONLY when analysing their own /in/<slug>
    //   3) undefined -> backend / AI infers from the profile itself
    let targetTitle: string | undefined;
    if (opts && typeof opts.targetTitleOverride === 'string') {
      const v = opts.targetTitleOverride.trim();
      targetTitle = v || undefined;
    } else {
      const tabSlug = (tabUrl || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase();
      const ownSlug = (profile?.linkedinUrl || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase();
      if (tabSlug && ownSlug && tabSlug === ownSlug) {
        targetTitle = (profile?.title || profile?.headline || '').trim() || undefined;
      }
    }

    // Cache key includes the resolved target so switching targets never
    // returns the previous target's analysis from cache.
    const cacheKeyUrl = linkedInCacheKey(tabUrl, targetTitle);

    // Cache HIT path — instant load, no AI call.
    if (!force && cacheKeyUrl) {
      const hit = await readLinkedInCache(cacheKeyUrl);
      if (hit) {
        setLinkedInAnalysis(hit.analysis);
        setLinkedInTargetTitle(hit.targetTitle);
        setLinkedInCachedAt(hit.cachedAt);
        setLinkedInTabAnalyzedAt(hit.cachedAt);
        setLinkedInLoading(false);
        return;
      }
    }

    // Cache MISS or forced refresh — call the AI.
    setLinkedInLoading(true);
    setLinkedInCachedAt(null);
    beginOp('linkedin');
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'ANALYZE_LINKEDIN_PROFILE',
        data: { targetTitle },
      });
      if (resp?.success && resp.analysis) {
        const analysis = resp.analysis as LinkedInProfileAnalysis;
        const resolvedTitle = resp.targetTitle || targetTitle;
        const cachedAt = Date.now();
        setLinkedInAnalysis(analysis);
        setLinkedInTargetTitle(resolvedTitle);
        setLinkedInCachedAt(cachedAt);
        setLinkedInTabAnalyzedAt(cachedAt);
        setLinkedInAnalysisId(resp.analysisId || null);

        // Persist to cache (eviction: keep newest MAX_ENTRIES by cachedAt).
        if (cacheKeyUrl) {
          await writeLinkedInCache(cacheKeyUrl, analysis, resolvedTitle, cachedAt);
        }
      } else {
        setLinkedInAnalysis(null);
        setLinkedInError(resp?.error || 'Could not analyze this profile');
      }
    } catch (e) {
      setLinkedInAnalysis(null);
      setLinkedInError((e as Error).message || 'Analysis failed');
    } finally {
      endOp('linkedin');
      setLinkedInLoading(false);
    }
  }, [profile]);

  /**
   * Guest / signed-out LinkedIn Profile Analyzer flow. Runs the same scrape
   * against the active LinkedIn tab, hits the unauthenticated backend
   * endpoint, and shows the teaser variant of the modal. Fires analytics
   * events at each funnel stage (start, complete, teaser viewed).
   *
   * Does NOT share cache with the authed flow — a guest cache key would
   * leak the teaser vs full distinction and confuse eviction. The backend
   * caches everything server-side anyway, so the client cache is optional.
   */
  const handleGuestAnalyze = useCallback(async (
    opts?: { targetTitleOverride?: string }
  ) => {
    setShowLinkedInAnalyzer(true);
    setLinkedInMode('guest');
    setLinkedInAnalysis(null);
    setLinkedInTeaser(null);
    setLinkedInError(null);
    setLinkedInErrorCode(null);
    setLinkedInCachedAt(null);
    setLinkedInAnalysisId(null);
    setLinkedInLoading(true);
    const overrideTitle = (opts?.targetTitleOverride || '').trim();
    void emitAnalyticsEvent('guest_analysis_started', overrideTitle ? { targetTitle: overrideTitle } : {});
    beginOp('linkedinGuest');
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'ANALYZE_LINKEDIN_PROFILE_GUEST',
        data: overrideTitle ? { targetTitle: overrideTitle } : {},
      });
      if (resp?.success && resp.teaser) {
        setLinkedInTeaser(resp.teaser as import('../types').LinkedInProfileAnalysisTeaser);
        setLinkedInTargetTitle(resp.targetTitle || undefined);
        setLinkedInAnalysisId(resp.analysisId || null);
        setLinkedInTabAnalyzedAt(Date.now());
        void emitAnalyticsEvent('guest_analysis_completed', {
          analysisId: resp.analysisId || null,
          overallScore: resp.teaser?.overallScore ?? null,
        });
        void emitAnalyticsEvent('teaser_viewed', { analysisId: resp.analysisId || null });
      } else {
        setLinkedInTeaser(null);
        setLinkedInError(resp?.error || 'Could not analyze this profile');
        setLinkedInErrorCode(resp?.errorCode || null);
      }
    } catch (e) {
      setLinkedInTeaser(null);
      setLinkedInError((e as Error).message || 'Analysis failed');
    } finally {
      endOp('linkedinGuest');
      setLinkedInLoading(false);
    }
  }, []);

  /**
   * Opens the goal picker instead of firing the analyzer immediately.
   * `flow` tells us which handler to call once the user submits their goal.
   * Also derives whether this is the user's OWN LinkedIn profile so the
   * picker can prefill their saved title when it makes sense (and skip it
   * when it doesn't).
   */
  const openAnalyzeGoalPicker = useCallback(async (flow: 'authed' | 'guest') => {
    // The analyzer pill is always visible now. If the active tab isn't a
    // LinkedIn profile, there's nothing to grade — guide the user there
    // instead of opening the goal picker on an irrelevant page.
    if (!isOnLinkedInProfile) {
      showNotification('Open a LinkedIn profile (linkedin.com/in/…) in your browser tab, then tap Analyze.', 'info');
      return;
    }
    setPendingAnalyzeFlow(flow);
    // Best-effort own-profile detection. Same slug match the analyzer itself
    // uses. Fails safe to 'other-profile' so we don't misleadingly prefill.
    let ctx: 'own-profile' | 'other-profile' | undefined = undefined;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabSlug = (tab?.url || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase();
      const ownSlug = (profile?.linkedinUrl || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase();
      if (tabSlug) ctx = ownSlug && tabSlug === ownSlug ? 'own-profile' : 'other-profile';
    } catch { /* leave ctx undefined */ }
    setGoalPickerContext(ctx);
    setShowGoalPicker(true);
  }, [profile, isOnLinkedInProfile]);

  /**
   * The analyzer hook is pinned to the top of the signed-out surface on every
   * page, so its click has two jobs: analyze the LinkedIn profile in the active
   * tab, or — when there isn't one — open LinkedIn so the user can. /in/me
   * resolves to the signed-in member's own profile; the tab listener flips the
   * card back to "Analyze my profile" as soon as it lands.
   */
  const handleAnalyzerHookClick = useCallback(() => {
    if (isOnLinkedInProfile) {
      void openAnalyzeGoalPicker('guest');
      return;
    }
    chrome.runtime.sendMessage({
      type: 'OPEN_TAB',
      data: { url: 'https://www.linkedin.com/in/me/' },
    });
    showNotification('Opened LinkedIn. Tap Analyze once your profile loads.', 'info');
  }, [isOnLinkedInProfile, openAnalyzeGoalPicker]);

  const closeGoalPicker = useCallback(() => {
    setShowGoalPicker(false);
    setPendingAnalyzeFlow(null);
  }, []);

  const handleGoalPickerSubmit = useCallback((targetTitle: string) => {
    const flow = pendingAnalyzeFlow;
    setShowGoalPicker(false);
    setPendingAnalyzeFlow(null);
    if (flow === 'guest') {
      void handleGuestAnalyze({ targetTitleOverride: targetTitle });
    } else if (flow === 'authed') {
      void handleAnalyzeLinkedIn({ targetTitleOverride: targetTitle });
    }
  }, [pendingAnalyzeFlow, handleGuestAnalyze, handleAnalyzeLinkedIn]);

  /**
   * Submits a captured email to the guest-report backend and returns the
   * server response so the modal can render the correct success/error UI.
   * Fires the `email_submitted` analytics event only on success.
   */
  const handleGuestSubmitEmail = useCallback(async (email: string) => {
    const analysisId = linkedInAnalysisId;
    if (!analysisId) {
      return { ok: false, error: 'Missing analysis id — please re-analyze.', errorCode: 'missing_analysis' as const };
    }
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'SUBMIT_GUEST_REPORT_EMAIL',
        data: { email, analysisId },
      });
      if (resp?.ok) {
        void emitAnalyticsEvent('email_submitted', {
          analysisId,
          duplicate: !!resp.duplicate,
        });
      }
      return resp as {
        ok: boolean;
        duplicate?: boolean;
        message?: string;
        error?: string;
        errorCode?: string;
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message || 'Network error' };
    }
  }, [linkedInAnalysisId]);

  /**
   * Called from the guest modal's "Sign in free" links. Fires the
   * signin_clicked_from_teaser analytics event and kicks off the same web
   * sign-in flow used by the SignedOut screens.
   */
  const handleGuestSignIn = useCallback(() => {
    void emitAnalyticsEvent('signin_clicked_from_teaser', {
      analysisId: linkedInAnalysisId,
    });
    void liTeaserSignIn();
  }, [linkedInAnalysisId, liTeaserSignIn]);

  const handleAnalyzeMatch = useCallback(async () => {
    setShowMatchAnalysis(true);
    setMatchLoading(true);
    beginOp('match');
    try {
      // Ensure we have a fresh job info + analysis.
      let job = currentJob;
      if (!job) {
        const r = await runOwnedOp('keywords', () => chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' }));
        if (r?.jobInfo) {
          job = r.jobInfo;
          setCurrentJob(r.jobInfo);
          if (r.success && r.keywords) setKeywordAnalysis(r.keywords);
        }
      }
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
  }, [currentJob]);

  const handleTailor = useCallback(async () => {
    // Get fresh job info — try ANALYZE_JOB_PAGE which uses executeScript (most reliable)
    let freshJob = currentJob;
    if (!freshJob) {
      try {
        const response = await runOwnedOp('keywords', () => chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' }));
        if (response?.jobInfo && (response.jobInfo.title || response.jobInfo.company || response.jobInfo.description)) {
          freshJob = response.jobInfo;
          setCurrentJob(response.jobInfo);
          if (response?.success && response?.keywords) {
            setKeywordAnalysis(response.keywords);
          }
        }
      } catch (_) {}
    }
    if (!freshJob) {
      try {
        const relayResponse = await chrome.runtime.sendMessage({ type: 'GET_JOB_INFO_RELAY' });
        if (relayResponse && (relayResponse.title || relayResponse.company || relayResponse.description)) {
          freshJob = relayResponse;
          setCurrentJob(relayResponse);
        }
      } catch (_) {}
    }

    if (!freshJob) {
      showNotification('Could not detect job info on this page', 'warning');
      return;
    }

    // Check if already tailored for this job
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const jobUrl = tabs[0]?.url || '';
      if (jobUrl) {
        const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
        if (tailoredCache[jobUrl]) {
          setRetailorConfirm({ jobUrl, jobTitle: freshJob.title || '', company: freshJob.company || '' });
          return;
        }
      }
    } catch (_) {}

    // Show settings modal before proceeding
    setShowTailorSettings(true);
  }, [currentJob]);

  const handleTailorSettingsContinue = useCallback(async (settings: TailorSettings) => {
    setTailorSettings(settings);
    setShowTailorSettings(false);
    await proceedWithTailor(settings);
  }, [currentJob]);

  const proceedWithTailor = useCallback(async (settings?: TailorSettings | null) => {
    if (!currentJob) return;
    setRetailorConfirm(null);
    const activeSettings = settings || tailorSettings;
    
    // Step 1: Analyze gaps first
    setIsAnalyzingGaps(true);
    showNotification('Analyzing skill gaps...', 'info');

    // The gap analysis runs in the worker, so the panel may be gone by the
    // time it returns. Park the settings the user just picked where a
    // reopened panel can find them and carry on into tailoring.
    try {
      await chrome.storage.local.set({ pendingTailorSettings: activeSettings || null });
    } catch (_) {}

    beginOp('gaps');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_GAPS',
        data: {
          jobDescription: currentJob.description || '',
          jobTitle: currentJob.title,
          company: currentJob.company,
        },
      });

      if (response?.success && response?.gaps?.length > 0) {
        // Show in-page modal (rendered below) instead of opening a popup window.
        setGapReview({ gaps: response.gaps, settings: activeSettings || null });
      } else {
        // No gaps — proceed directly to tailoring
        await doTailor(null, undefined, activeSettings);
      }
    } catch (error) {
      console.warn('[ProfileAI] Gap analysis failed, proceeding to tailor:', error);
      await doTailor(null, undefined, activeSettings);
    } finally {
      endOp('gaps');
      setIsAnalyzingGaps(false);
    }
  }, [currentJob]);

  // Core tailor logic
  const doTailor = useCallback(async (
    gapSelections: { acceptedGaps: string[]; skippedGaps: string[] } | null,
    acceptedGapObjects?: any[],
    settings?: TailorSettings | null
  ) => {
    if (!currentJob) return;

    // Capture the job URL up front so the background can persist progress/result
    // by URL — this lets the panel recover state if it's closed mid-tailor.
    let jobUrl = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      jobUrl = tab?.url || '';
    } catch (_) {}

    setIsTailoring(true);
    showNotification('Tailoring your profile...', 'info');

    // Remember the pre-tailor match so we can show before → after.
    if (keywordAnalysis) {
      setPreTailorSnapshot({
        score: keywordAnalysis.matchScore,
        missing: keywordAnalysis.missing,
        total: keywordAnalysis.totalKeywords,
      });
    }

    beginOp('tailor');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TAILOR_PROFILE',
        data: {
          jobDescription: currentJob.description || '',
          jobTitle: currentJob.title,
          company: currentJob.company,
          jobUrl,
          gapSelections: gapSelections ? {
            ...gapSelections,
            acceptedGapObjects: acceptedGapObjects || [],
          } : null,
          tailorSettings: settings || undefined,
        },
      });

      if (response?.success && response?.tailoredProfile) {
        // The background already stamped the job context onto the profile,
        // persisted tailoredCache and saved to the backend — nothing to
        // duplicate here.
        setTailoredProfile(response.tailoredProfile);
        showNotification('Profile tailored! Download your resume below.', 'success');
      } else {
        throw new Error(response?.error || 'Tailoring failed');
      }
    } catch (error) {
      showNotification((error as Error).message || 'Please refresh the page and try again', 'error');
    } finally {
      endOp('tailor');
      setIsTailoring(false);
      chrome.storage.local.remove('pendingTailorSettings').catch(() => {});
    }
  }, [currentJob, keywordAnalysis]);

  const handleAnalyzeKeywords = useCallback(async () => {
    setIsAnalyzing(true);
    beginOp('keywords');
    try {
      // Use ANALYZE_JOB_PAGE: background extracts fresh job info via scripting API + analyzes in one step
      const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' });

      // Update the job card with fresh info (accept if it has description, title, or company)
      if (response?.jobInfo && (response.jobInfo.title || response.jobInfo.company || response.jobInfo.description)) {
        setCurrentJob(response.jobInfo);
      }

      if (response?.success && response?.keywords) {
        setKeywordAnalysis(response.keywords);
        showNotification(`Matched ${response.keywords.present.length} of ${response.keywords.totalKeywords} keywords`, 'success');
      } else {
        throw new Error(response?.error || 'Analysis failed');
      }
    } catch (error) {
      showNotification((error as Error).message || 'Keyword analysis failed', 'error');
    } finally {
      endOp('keywords');
      setIsAnalyzing(false);
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'warning' | 'info' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCoverLetter = useCallback(async () => {
    // Fetch job info on-demand if not already detected
    if (!currentJob) {
      try {
        const response = await runOwnedOp('keywords', () => chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' }));
        if (response?.jobInfo && (response.jobInfo.title || response.jobInfo.company || response.jobInfo.description)) {
          setCurrentJob(response.jobInfo);
          if (response?.success && response?.keywords) {
            setKeywordAnalysis(response.keywords);
          }
        } else {
          showNotification('Could not detect job info on this page', 'warning');
          return;
        }
      } catch (_) {
        showNotification('Could not detect job info on this page', 'warning');
        return;
      }
    }
    setShowCoverLetterModal(true);
  }, [currentJob]);

  const generateCoverLetter = useCallback(async (tone: string, length: string): Promise<string | null> => {
    if (!currentJob) return null;
    // The background caches the finished letter under this URL, so a panel
    // that reopens after the run finishes still finds it.
    let jobUrl = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      jobUrl = tab?.url || '';
    } catch (_) {}
    beginOp('coverLetter');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        data: {
          jobTitle: currentJob.title,
          company: currentJob.company,
          jobDescription: currentJob.description || '',
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
        setIsTailoring(running);
        if (running) return;
        setIsAnalyzingGaps(false);
        chrome.storage.local.remove('pendingTailorSettings').catch(() => {});
        if (failure) {
          showNotification(failure, 'error');
          return;
        }
        if (res?.tailoredProfile) {
          setTailoredProfile(res.tailoredProfile);
          showNotification('Your tailored resume is ready.', 'success');
        }
        return;
      }

      case 'gaps': {
        setIsAnalyzingGaps(running);
        if (running || failure) return;
        const gaps = res?.gaps;
        if (!gaps?.length) return;
        // Settings were parked when the run started, so a reopened panel can
        // carry them into the tailor step the gap review leads to.
        let parked: TailorSettings | null = null;
        try {
          const { pendingTailorSettings } = await chrome.storage.local.get('pendingTailorSettings');
          parked = (pendingTailorSettings as TailorSettings) || null;
        } catch (_) {}
        setGapReview({ gaps, settings: parked });
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

      case 'linkedin':
      case 'linkedinGuest': {
        const guest = rec.kind === 'linkedinGuest';
        setLinkedInMode(guest ? 'guest' : 'authed');
        setShowLinkedInAnalyzer(true);
        setLinkedInLoading(running);
        if (running) return;
        if (failure) {
          setLinkedInError(failure);
          setLinkedInErrorCode(res?.errorCode || null);
          return;
        }
        setLinkedInError(null);
        setLinkedInErrorCode(null);
        const resolvedTitle: string | undefined =
          res?.targetTitle || (rec.meta?.targetTitle as string) || undefined;
        setLinkedInTargetTitle(resolvedTitle);
        setLinkedInAnalysisId(res?.analysisId || null);
        setLinkedInTabAnalyzedAt(rec.updatedAt);
        if (guest) {
          setLinkedInTeaser(res?.teaser || null);
          return;
        }
        if (!res?.analysis) return;
        setLinkedInAnalysis(res.analysis);
        setLinkedInCachedAt(rec.updatedAt);
        const cacheKeyUrl = linkedInCacheKey(rec.meta?.profileUrl as string, resolvedTitle);
        if (cacheKeyUrl) {
          await writeLinkedInCache(cacheKeyUrl, res.analysis, resolvedTitle, rec.updatedAt);
        }
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
    if (rec.kind === 'linkedin' || rec.kind === 'linkedinGuest') {
      // These keys are `<pageKey>::<target>`.
      return rec.key.startsWith(`${tabKey}::`);
    }
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
          {/* Signed-out surface: the LinkedIn Profile Analyzer is our
              acquisition hook, so it must run WITHOUT sign-in OR a profile, and
              it stays pinned to the top on EVERY page — not just
              linkedin.com/in/* tabs — so a first-time user always has one free
              thing to try. Off a profile tab the pill opens LinkedIn instead of
              analyzing nothing. Same pill the signed-in surfaces use, so the
              hook looks identical before and after sign-in. */}
          <div className="panel-section li-preprofile-section">
            <AnalyzeLinkedInPill
              onClick={handleAnalyzerHookClick}
              loading={linkedInLoading && linkedInMode === 'guest'}
              guest
              offProfile={!isOnLinkedInProfile}
            />
          </div>
          <SignedOut
            currentJob={currentJob}
            lastProfile={lastProfile}
            hasAccount={hasAccount}
            onAuthSync={loadAuthAndProfile}
          />
        </>
      ) : !profileProgress.hasMinimumProfile ? (
        <>
          {/* DEV: force the guest analyzer surface for signed-in testing.
              Renders above the normal authed pill so the tester can trigger
              both flows from the same panel. */}
          {debugForceGuestAnalyzer && isOnLinkedInProfile && (
            <div className="panel-section li-preprofile-section" style={{ outline: '1px dashed rgba(245,158,11,0.5)' }}>
              <AnalyzeLinkedInPill
                onClick={() => void openAnalyzeGoalPicker('guest')}
                loading={linkedInLoading && linkedInMode === 'guest'}
                guest
              />
            </div>
          )}
          {/* LinkedIn Analyzer works WITHOUT a completed ProfileAI profile —
              it grades the LinkedIn page itself. Surfacing it before profile
              setup gives new users instant value (hook), then the setup guide
              below converts them to the full product. */}
          <div className="panel-section li-preprofile-section">
            <AnalyzeLinkedInPill
              onClick={() => void openAnalyzeGoalPicker('authed')}
              loading={linkedInLoading && linkedInMode === 'authed'}
              analyzedAt={linkedInTabAnalyzedAt}
              offProfile={!isOnLinkedInProfile}
            />
          </div>
          <ProfileSetupGuide
            profile={profile}
            currentJob={currentJob}
            progress={profileProgress}
          />
          <Footer onLogout={handleLogout} />
        </>
      ) : (
        <>
          {debugForceGuestAnalyzer && isOnLinkedInProfile && (
            <div className="panel-section li-preprofile-section" style={{ outline: '1px dashed rgba(245,158,11,0.5)' }}>
              <AnalyzeLinkedInPill
                onClick={() => void openAnalyzeGoalPicker('guest')}
                loading={linkedInLoading && linkedInMode === 'guest'}
                guest
              />
            </div>
          )}
          <div className="main-content">
            <ProfileSection
              profile={profile}
              isOnLinkedInProfile={isOnLinkedInProfile}
              onAnalyzeLinkedIn={() => void openAnalyzeGoalPicker('authed')}
              isAnalyzingLinkedIn={linkedInLoading}
              linkedInAnalyzedAt={linkedInTabAnalyzedAt}
            />
            
            <JobMatchSection 
              currentJob={currentJob} 
              onAnalyze={handleAnalyzeKeywords}
              keywordAnalysis={keywordAnalysis}
              isAnalyzing={isAnalyzing}
              onTailor={handleTailor}
              isTailoring={isTailoring || isAnalyzingGaps}
              hasTailored={!!tailoredProfile}
            />
            
            <QuickActions 
              onSmartAnswers={handleSmartAnswers}
              onQuickFillBasics={handleAutofill}
              onTailor={handleTailor}
              onCoverLetter={handleCoverLetter}
              hasJob={!!currentJob}
              isTailoring={isTailoring || isAnalyzingGaps}
              isDetecting={isDetectingQuestions}
              detectedCount={detectedCount}
            />

            {(isTailoring || isAnalyzingGaps) && (
              <TailoringProgress
                jobTitle={currentJob?.title}
                company={currentJob?.company}
                onCancel={async () => {
                  // Drops the progress UI. The run itself can't be aborted
                  // mid-flight, so if it does land later the result still
                  // shows up rather than being thrown away.
                  try {
                    const tasks = await readBgTasks();
                    await Promise.all(
                      Object.values(tasks)
                        .filter((t) => t.kind === 'tailor' || t.kind === 'gaps')
                        .map((t) => clearBgTask(t.id)),
                    );
                  } catch (_) {}
                  setIsTailoring(false);
                  setIsAnalyzingGaps(false);
                  showNotification('Tailoring canceled. You can try again.', 'info');
                }}
              />
            )}

            <AutofillSettings />

            {/* Skill Gap Review modal (in-page, not a separate window) */}
            {gapReview && (
              <GapReviewModal
                gaps={gapReview.gaps}
                onCancel={() => {
                  setGapReview(null);
                  showNotification('Gap review cancelled', 'info');
                }}
                onContinue={async ({ acceptedGaps, skippedGaps, acceptedGapObjects }) => {
                  const settings = gapReview.settings;
                  setGapReview(null);
                  await doTailor(
                    { acceptedGaps, skippedGaps },
                    acceptedGapObjects,
                    settings
                  );
                }}
              />
            )}

            {/* Re-tailor confirmation modal */}
            {retailorConfirm && (
              <div className="retailor-overlay" onClick={() => setRetailorConfirm(null)}>
                <div className="retailor-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="retailor-icon">📋</div>
                  <p className="retailor-text">
                    You already tailored your resume for <strong>{retailorConfirm.jobTitle}</strong>
                    {retailorConfirm.company ? ` at ${retailorConfirm.company}` : ''}.
                    Save your tailoring limit for another job, or tailor again.
                  </p>
                  <div className="retailor-actions">
                    <button className="retailor-btn keep" onClick={() => setRetailorConfirm(null)}>
                      Keep Existing
                    </button>
                    <button className="retailor-btn retailor" onClick={() => { setRetailorConfirm(null); setShowTailorSettings(true); }}>
                      Tailor Again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {tailoredProfile && (
              <TailoredResults
                tailoredProfile={tailoredProfile}
                profile={profile}
                beforeScore={preTailorSnapshot?.score ?? keywordAnalysis?.matchScore ?? null}
                addedKeywords={preTailorSnapshot?.missing}
                totalKeywords={preTailorSnapshot?.total ?? keywordAnalysis?.totalKeywords ?? null}
                onNotification={showNotification}
                onDismiss={async () => {
                  setTailoredProfile(null);
                  // Remove from cache
                  try {
                    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                    const jobUrl = tab?.url || '';
                    if (jobUrl) {
                      const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
                      delete tailoredCache[jobUrl];
                      await chrome.storage.local.set({ tailoredCache });
                    }
                  } catch (_) {}
                }}
              />
            )}
            
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

      {showTailorSettings && currentJob && (
        <TailorSettingsModal
          jobTitle={currentJob.title || ''}
          company={currentJob.company || ''}
          onContinue={handleTailorSettingsContinue}
          onCancel={() => setShowTailorSettings(false)}
        />
      )}

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
        onOpStart={() => beginOp('smartAnswers')}
        onOpEnd={() => endOp('smartAnswers')}
      />

      <MatchAnalysisModal
        open={showMatchAnalysis}
        onClose={() => setShowMatchAnalysis(false)}
        loading={matchLoading}
        analysis={matchAnalysis}
        currentJob={currentJob}
        onRefresh={handleAnalyzeMatch}
      />

      <LinkedInAnalyzerModal
        open={showLinkedInAnalyzer}
        onClose={() => setShowLinkedInAnalyzer(false)}
        loading={linkedInLoading}
        analysis={linkedInAnalysis}
        error={linkedInError}
        errorCode={linkedInErrorCode}
        targetTitle={linkedInTargetTitle}
        cachedAt={linkedInCachedAt}
        onRefresh={() => (linkedInMode === 'guest'
          ? handleGuestAnalyze({ targetTitleOverride: linkedInTargetTitle })
          : handleAnalyzeLinkedIn({ force: true, targetTitleOverride: linkedInTargetTitle }))}
        onNotification={showNotification}
        mode={linkedInMode}
        analysisId={linkedInAnalysisId}
        teaser={linkedInTeaser}
        onSubmitEmail={handleGuestSubmitEmail}
        onSignIn={handleGuestSignIn}
      />

      {/* Goal picker — appears BEFORE the analyzer so the user commits to
          a specific target instead of the AI guessing blindly. Prefills the
          signed-in user's saved title only when the current tab is their own
          /in/<slug>. On submit, dispatches to the correct handler (guest or
          authed) with the resolved target. */}
      <AnalyzerGoalPicker
        open={showGoalPicker}
        onClose={closeGoalPicker}
        onAnalyze={handleGoalPickerSubmit}
        defaultTitle={(profile?.title || profile?.headline || '').trim() || undefined}
        contextHint={goalPickerContext}
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
