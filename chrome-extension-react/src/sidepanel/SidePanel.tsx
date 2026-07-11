import React, { useState, useEffect, useCallback } from 'react';
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
import { SmartAnswersModal } from './components/SmartAnswersModal';
import { MatchAnalysisModal } from './components/MatchAnalysisModal';
import { LinkedInAnalyzerModal } from './components/LinkedInAnalyzerModal';
import { AnalyzeLinkedInPill } from './components/AnalyzeLinkedInPill';
import { GuestAnalyzerCTA } from './components/GuestAnalyzerCTA';
import { useWebSignIn } from './components/useWebSignIn';
import { emitAnalyticsEvent } from './analytics';
import { TailorSettingsModal, TailorSettings } from './components/TailorSettingsModal';
import { TailoringProgress } from './components/TailoringProgress';
import { GapReviewModal } from './components/GapReviewModal';
import { computeProfileProgress, buildProfileSummary, type ProfileSummary } from './profileProgress';
import type { FullProfile, JobInfo, AuthState, LinkedInProfileAnalysis } from '../types';

// --- LinkedIn analysis cache helpers (shared by detector + analyzer) --------
const LI_CACHE_KEY = 'linkedInAnalysisCache';
const LI_CACHE_MAX_ENTRIES = 20;
const LI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Normalized cache key for a LinkedIn profile URL (origin + pathname, no
 *  trailing slash) or null when the URL isn't a /in/ profile page. */
const linkedInCacheKey = (url: string | undefined | null): string | null => {
  if (!url || !/linkedin\.com\/in\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
};

/** Returns the cached entry for a profile URL, or null if absent/expired. */
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

export const SidePanel: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
  });
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [lastProfile, setLastProfile] = useState<ProfileSummary | null>(null);
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
  // Guest-mode state — separate from `linkedInAnalysis` because the guest
  // endpoint returns a teaser shape, not the full LinkedInProfileAnalysis.
  const [linkedInMode, setLinkedInMode] = useState<'guest' | 'authed'>('authed');
  const [linkedInTeaser, setLinkedInTeaser] = useState<import('../types').LinkedInProfileAnalysisTeaser | null>(null);
  // Cached-analysis timestamp for the CURRENT tab's profile URL. Drives the
  // "View LinkedIn analysis · analyzed X ago" state on the profile-card pill
  // so users know a click won't spend another credit.
  const [linkedInTabAnalyzedAt, setLinkedInTabAnalyzedAt] = useState<number | null>(null);

  // Web sign-in flow for the signed-out LinkedIn-analyzer teaser. Arrow wrapper
  // defers the loadAuthAndProfile reference (declared below) past the TDZ.
  const { webSyncing: liTeaserSyncing, signInOnWeb: liTeaserSignIn } = useWebSignIn(() =>
    loadAuthAndProfile(),
  );
  const [gapReview, setGapReview] = useState<{
    gaps: any[];
    settings: TailorSettings | null;
  } | null>(null);

  // Load auth and profile on mount
  useEffect(() => {
    loadAuthAndProfile();
    loadJobInfo();
    loadAnswersCount();
    detectLinkedInProfileTab();

    // Restore the returning-user summary so the reconnect screen can show
    // before/without a fresh login.
    chrome.storage.local.get('lastProfileSummary').then(({ lastProfileSummary }) => {
      if (lastProfileSummary) setLastProfile(lastProfileSummary as ProfileSummary);
    }).catch(() => {});

    // Recover tailoring state if the panel was closed mid-tailor.
    (async () => {
      try {
        const { tailoringInFlight, tailoringResult, tailoringError } = await chrome.storage.local.get([
          'tailoringInFlight',
          'tailoringResult',
          'tailoringError',
        ]);
        // Stale guard: 4 minutes. A typical tailor finishes in 30–60s; if the
        // service worker was killed mid-fetch the flag may stick — clearing it
        // here lets the user retry without staring at a stuck spinner.
        const STALE_MS = 4 * 60 * 1000;
        if (tailoringInFlight?.startedAt && (Date.now() - tailoringInFlight.startedAt) < STALE_MS) {
          setIsTailoring(true);
        } else if (tailoringInFlight) {
          // Stale flag — clear it.
          chrome.storage.local.remove('tailoringInFlight').catch(() => {});
        }
        // If a result landed while the panel was closed, surface it once.
        if (tailoringResult?.tailored) {
          setTailoredProfile(tailoringResult.tailored);
          chrome.storage.local.remove('tailoringResult').catch(() => {});
        }
        if (tailoringError?.error) {
          showNotification(tailoringError.error, 'error');
          chrome.storage.local.remove('tailoringError').catch(() => {});
        }
      } catch (_) {}
    })();

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

    // Listen for storage changes — content script writes job info reactively,
    // and the background writes tailoring lifecycle state.
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
      // Tailoring lifecycle (set/cleared by background)
      if ('tailoringInFlight' in changes) {
        const next = changes.tailoringInFlight.newValue;
        setIsTailoring(!!next);
      }
      if (changes.tailoringResult?.newValue?.tailored) {
        setTailoredProfile(changes.tailoringResult.newValue.tailored);
        showNotification('Profile tailored! Download your resume below.', 'success');
        chrome.storage.local.remove('tailoringResult').catch(() => {});
      }
      if (changes.tailoringError?.newValue?.error) {
        showNotification(changes.tailoringError.newValue.error, 'error');
        chrome.storage.local.remove('tailoringError').catch(() => {});
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
        const key = linkedInCacheKey(tab?.url);
        const hit = key ? await readLinkedInCache(key) : null;
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

  const handleAnalyzeLinkedIn = useCallback(async (forceArg?: unknown) => {
    // STRICT check: this handler is wired directly to button onClick in
    // several places, where React passes the MouseEvent as the first arg —
    // which is truthy and was silently forcing a fresh (paid) analysis on
    // every click. Only an explicit `true` bypasses the cache.
    const force = forceArg === true;
    setShowLinkedInAnalyzer(true);
    setLinkedInError(null);
    setLinkedInErrorCode(null);
    setLinkedInMode('authed');
    setLinkedInTeaser(null);

    // Cache the analysis per LinkedIn profile URL so subsequent clicks on the
    // same profile don't burn an AI credit. The "Re-analyze" button in the
    // modal passes force=true to bypass the cache — that's the (metered) path.
    let cacheKeyUrl: string | null = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      cacheKeyUrl = linkedInCacheKey(tab?.url);
    } catch {
      /* fallthrough */
    }

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
    try {
      const targetTitle = (profile?.title || profile?.headline || '').trim() || undefined;
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
          try {
            const { [LI_CACHE_KEY]: cache = {} } = await chrome.storage.local.get(LI_CACHE_KEY);
            const next: Record<string, any> = { ...cache };
            next[cacheKeyUrl] = { analysis, targetTitle: resolvedTitle, cachedAt };
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
            /* non-fatal — result is still shown, just not cached */
          }
        }
      } else {
        setLinkedInAnalysis(null);
        setLinkedInError(resp?.error || 'Could not analyze this profile');
      }
    } catch (e) {
      setLinkedInAnalysis(null);
      setLinkedInError((e as Error).message || 'Analysis failed');
    } finally {
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
  const handleGuestAnalyze = useCallback(async () => {
    setShowLinkedInAnalyzer(true);
    setLinkedInMode('guest');
    setLinkedInAnalysis(null);
    setLinkedInTeaser(null);
    setLinkedInError(null);
    setLinkedInErrorCode(null);
    setLinkedInCachedAt(null);
    setLinkedInAnalysisId(null);
    setLinkedInLoading(true);
    void emitAnalyticsEvent('guest_analysis_started');
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'ANALYZE_LINKEDIN_PROFILE_GUEST',
        data: {},
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
      setLinkedInLoading(false);
    }
  }, []);

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
    try {
      // Ensure we have a fresh job info + analysis.
      let job = currentJob;
      if (!job) {
        const r = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' });
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
      setMatchLoading(false);
    }
  }, [currentJob]);

  const handleTailor = useCallback(async () => {
    // Get fresh job info — try ANALYZE_JOB_PAGE which uses executeScript (most reliable)
    let freshJob = currentJob;
    if (!freshJob) {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' });
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
        const tailored = {
          ...response.tailoredProfile,
          jobTitle: currentJob.title,
          company: currentJob.company,
          _skillGaps: acceptedGapObjects || [],
        };
        setTailoredProfile(tailored);
        showNotification('Profile tailored! Download your resume below.', 'success');
        // Note: background already persists tailoredCache and saves to backend, so we no
        // longer need to duplicate that work here.
      } else {
        throw new Error(response?.error || 'Tailoring failed');
      }
    } catch (error) {
      showNotification((error as Error).message || 'Please refresh the page and try again', 'error');
    } finally {
      setIsTailoring(false);
    }
  }, [currentJob, keywordAnalysis]);

  const handleAnalyzeKeywords = useCallback(async () => {
    setIsAnalyzing(true);
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
        const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_JOB_PAGE' });
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
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        data: {
          jobTitle: currentJob.title,
          company: currentJob.company,
          jobDescription: currentJob.description || '',
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
    }
  }, [currentJob]);

  if (loading) {
    return (
      <div className="app loading-state">
        <div className="loading-spinner">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#7c3aed' }}/>
                <stop offset="100%" style={{ stopColor: '#8b5cf6' }}/>
              </linearGradient>
            </defs>
          </svg>
          <div className="spinner" />
        </div>
        <div className="loading-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>ProfilleAI</span>
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
              acquisition hook, so it must run WITHOUT sign-in. On any
              linkedin.com/in/* tab, show the guest CTA card ABOVE the pill
              — both trigger the same free guest analysis; the CTA is the
              louder, first-time-visitor headline, the pill is the compact
              reminder. */}
          {isOnLinkedInProfile && (
            <>
              <div className="panel-section li-preprofile-section">
                <GuestAnalyzerCTA
                  onClick={handleGuestAnalyze}
                  loading={linkedInLoading && linkedInMode === 'guest'}
                />
              </div>
              <div className="panel-section li-preprofile-section">
                <AnalyzeLinkedInPill
                  onClick={handleGuestAnalyze}
                  loading={linkedInLoading && linkedInMode === 'guest'}
                  guest
                />
              </div>
            </>
          )}
          <SignedOut
            currentJob={currentJob}
            lastProfile={lastProfile}
            onAuthSync={loadAuthAndProfile}
          />
        </>
      ) : !profileProgress.hasMinimumProfile ? (
        <>
          {/* LinkedIn Analyzer works WITHOUT a completed ProfileAI profile —
              it grades the LinkedIn page itself. Surfacing it before profile
              setup gives new users instant value (hook), then the setup guide
              below converts them to the full product. */}
          {isOnLinkedInProfile && (
            <div className="panel-section li-preprofile-section">
              <AnalyzeLinkedInPill
                onClick={handleAnalyzeLinkedIn}
                loading={linkedInLoading}
                analyzedAt={linkedInTabAnalyzedAt}
              />
            </div>
          )}
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
            <ProfileSection
              profile={profile}
              isOnLinkedInProfile={isOnLinkedInProfile}
              onAnalyzeLinkedIn={handleAnalyzeLinkedIn}
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
                  try {
                    await chrome.storage.local.remove(['tailoringInFlight', 'tailoringResult', 'tailoringError']);
                  } catch (_) {}
                  setIsTailoring(false);
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
          onClose={() => setShowCoverLetterModal(false)}
          jobTitle={currentJob?.title}
          company={currentJob?.company}
          onGenerate={generateCoverLetter}
          onNotification={showNotification}
        />
      )}

      <SmartAnswersModal
        open={showSmartAnswers}
        onClose={() => {
          setShowSmartAnswers(false);
          loadAnswersCount();
        }}
        currentJob={currentJob}
        onNotification={showNotification}
        onAnswersGenerated={(count?: number) => {
          if (typeof count === 'number') setDetectedCount(count);
          loadAnswersCount();
        }}
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
        onRefresh={() => (linkedInMode === 'guest' ? handleGuestAnalyze() : handleAnalyzeLinkedIn(true))}
        onNotification={showNotification}
        mode={linkedInMode}
        analysisId={linkedInAnalysisId}
        teaser={linkedInTeaser}
        onSubmitEmail={handleGuestSubmitEmail}
        onSignIn={handleGuestSignIn}
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
