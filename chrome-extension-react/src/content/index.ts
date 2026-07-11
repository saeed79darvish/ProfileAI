// ProfileAI Content Script
// Runs on all pages - shows overlay panel as iframe
// Self-contained - no imports

// Environment: 'development' | 'production'
const ENV = 'production';

// Inline config with environment support
const CONFIG = {
  WEB_BASE: ENV === 'production' ? 'https://www.profilleai.com' : 'http://localhost:3000',
  API_BASE: ENV === 'production' ? 'https://api.profilleai.com/api' : 'http://localhost:5001/api',
  SUPPORTED_SITES: {
    linkedin: {
      match: /linkedin\.com/,
      titleSelector: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-details-top-card__job-title, .top-card-layout__title, h1.t-24, h1[class*="jobs"], h2.top-card-layout__title, h1',
      companySelector: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-details-top-card__company-info a, .top-card-layout__card a[data-tracking-control-name*="company"], .topcard__org-name-link, a[data-tracking-control-name*="company"], [class*="job-details"] a[href*="/company/"]',
      descriptionSelector: '#job-details, .jobs-description-content, .jobs-description__content, .jobs-description-content__text, .jobs-box__html-content, .show-more-less-html__markup, .description__text, [class*="jobs-description"], [class*="decorated-job-posting__details"]',
      formSelector: '.jobs-easy-apply-modal, .jobs-apply-button, [class*="jobs-apply"]',
    },
    greenhouse: {
      match: /greenhouse\.io/,
      titleSelector: '.app-title, h1.heading, h1',
      companySelector: '.company-name, .logo',
      descriptionSelector: '#content, .job-description, #job_description, [class*="job-description"]',
      formSelector: '#application-form, #application',
    },
    lever: {
      match: /lever\.co/,
      titleSelector: '.posting-headline h2, h1.posting-headline, h1',
      companySelector: '.posting-categories .location, .main-header-logo img[alt]',
      descriptionSelector: '.posting-page, .section-wrapper, .content, [class*="posting-"]',
      formSelector: '.application-form, #application-form, form[action*="apply"], form',
    },
    workday: {
      match: /workday\.com|myworkdayjobs\.com/,
      titleSelector: '[data-automation-id="jobPostingTitle"], h2[data-automation-id], .css-1q2dra3, h1',
      companySelector: '[data-automation-id="jobPostingHeader"] .css-1q2dra3, .company-name, [data-automation-id="jobPostingCompany"]',
      descriptionSelector: '[data-automation-id="jobPostingDescription"], [data-automation-id="jobPostingPage"], .css-cygeeu, [class*="jobDescription"]',
      formSelector: '[data-automation-id="jobPostingPage"] form, form',
    },
    ashby: {
      match: /ashbyhq\.com|jobs\.ashbyhq\.com|[?&]ashby_jid=/,
      titleSelector: 'h1, [class*="JobPostingTitle"], [class*="job-title"]',
      companySelector: '[class*="CompanyName"], [class*="company"]',
      descriptionSelector: '[class*="JobDescription"], [class*="job-description"], main',
      formSelector: 'form, [class*="application"]',
    },
    icims: {
      match: /icims\.com/,
      titleSelector: '.iCIMS_Header h1, h1',
      companySelector: '.iCIMS_CompanyName',
      descriptionSelector: '.iCIMS_JobContent',
      formSelector: 'form',
    },
    gem: {
      match: /gem\.com|supio/,
      titleSelector: 'h1, h2, [class*="title"]',
      companySelector: '[class*="company"], [class*="employer"]',
      descriptionSelector: '[class*="description"], main',
      formSelector: 'form, [class*="application"], [class*="form"], main',
    },
    smartrecruiters: {
      match: /smartrecruiters\.com|jobs\.smartrecruiters/,
      titleSelector: 'h1, [class*="job-title"]',
      companySelector: '[class*="company"]',
      descriptionSelector: '[class*="job-description"], main',
      formSelector: 'form, [class*="application"]',
    },
    generic: {
      match: /.*/,
      titleSelector: 'h1, [class*="job-title"], [class*="jobtitle"]',
      companySelector: '[class*="company"]',
      descriptionSelector: '[class*="job-description"], main',
      formSelector: 'form, [class*="application"], [class*="form-container"], main',
    },
  } as Record<string, { match: RegExp; titleSelector: string; companySelector: string; descriptionSelector: string; formSelector: string }>,
};

// Types
interface FullProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  headline?: string;
  summary?: string;
  company?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  skills?: string[] | Record<string, string[]>;
  experience?: Array<{ title?: string; company?: string; organization?: string; location?: string; startDate?: string; endDate?: string; current?: boolean; description?: string; degree?: string; level?: string }>;
  education?: Array<{ school?: string; degree?: string; level?: string; field?: string; startDate?: string; endDate?: string }>;
  projects?: Array<{ title?: string; name?: string; description?: string }>;
}

interface JobInfo {
  title: string;
  company: string;
  description: string;
}

// State
let isInitialized = false;
let currentSite: typeof CONFIG.SUPPORTED_SITES[keyof typeof CONFIG.SUPPORTED_SITES] | null = null;
let profileData: FullProfile | null = null;
let isAuthenticated = false;
let overlayContainer: HTMLElement | null = null;
let backdrop: HTMLElement | null = null;
let savedAnswers: Record<string, string> = {};
let isJobPage = false;
let currentSiteName = 'generic';
let autofillMode: { useSavedAnswers: boolean; useAI: boolean } = { useSavedAnswers: true, useAI: true };
// When true, autofill ONLY touches reliable text basics (name/email/phone/location/links).
// Skips selects, custom dropdowns, checkboxes, radios, and AI-suggested fields.
let basicsOnly = false;
let savedApplicationUrls: Set<string> = new Set();
let formStepRetryCount = 0;
const MAX_FORM_STEP_RETRIES = 5;

// Job page detection patterns
const JOB_PAGE_PATTERNS = [
  /\/apply/i,
  /\/application/i,
  /\/jobs?\//i,
  /\/careers?\//i,
  /\/positions?\//i,
  /\/openings?\//i,
  /lever\.co/i,
  /greenhouse\.io/i,
  /workday\.com.*\/job/i,
  /myworkdayjobs\.com/i,
  /linkedin\.com\/jobs/i,
  /indeed\.com.*\/viewjob/i,
  /glassdoor\.com.*\/job/i,
  /ziprecruiter\.com.*\/jobs/i,
];

// True while the extension context is still alive. After the extension is
// reloaded/updated, stale content scripts in already-open tabs keep running
// their timers and MutationObservers — any chrome.* call from them throws
// "Extension context invalidated" (the anonymous content.js:1 errors seen in
// the console). Check this before every chrome.* call in async paths.
function extAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// Initialize
async function init() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[ProfileAI] Initializing content script...');

  // Sweep any DOM injected by a PREVIOUS extension load (different extension
  // ID, e.g. after Chrome auto-updated us or the user reloaded the extension
  // while a LinkedIn tab was open). Those orphans still hold references to
  // chrome-extension://<old-id>/… URLs which Chrome now normalizes to
  // chrome-extension://invalid/. Any request LinkedIn's Pemberly network layer
  // or a React lazy-import fires on them produces the ERR_FAILED flood in the
  // console (dozens per second). Removing them before we inject anything of
  // our own puts the tab back to a clean state.
  sweepOrphanedInjections();

  // Listen for auth broadcasts from web app
  listenForAuthBroadcast();

  // In subframes (iframes), only run the auth/data bridge \u2014 don't inject FAB,
  // banners, or message listeners. This is required so the unified resume
  // download modal (rendered as an iframe on top of any page) can receive
  // PROFILEAI_REQUEST_TAILORED_DATA / PROFILEAI_CLOSE_TAB / auth handoffs.
  if (window.top !== window.self) {
    return;
  }

  // Detect if this is a job-related page
  detectJobPage();
  detectSite();
  
  // Check auth silently in background
  await checkAuthSilently();
  
  // Always inject styles and create FAB
  injectStyles();

  // Check if FAB should be hidden
  const shouldShowFab = await checkFabVisibility();
  if (shouldShowFab) {
    createFloatingButton();
  }
  
  setupMessageListener();
  
  // If authenticated and on job page, show banner automatically
  if (isJobPage && isAuthenticated) {
    setTimeout(() => {
      showAutofillBanner();
    }, 800);
  }

  // Inject inline banner on supported ATS pages even before auth
  // (banner buttons open the overlay which handles auth)
  if (isJobPage && currentSiteName === 'linkedin') {
    setTimeout(() => {
      injectLinkedInBanner();
    }, 1200);
  }
  
  // Proactively store job info for the side panel — try immediately, then retry at increasing intervals
  if (isJobPage) {
    const tryStoreJobInfo = () => {
      const jobInfo = getJobInfo();
      if (jobInfo) {
        console.log('[ProfileAI] Storing job info:', jobInfo.title);
        chrome.storage.local.set({ currentJobInfo: jobInfo, currentJobUrl: location.href });
        return true;
      }
      return false;
    };
    // Cascade: 0ms → 500ms → 1.5s → 3s → 5s
    if (!tryStoreJobInfo()) {
      setTimeout(() => { if (!tryStoreJobInfo()) {
        setTimeout(() => { if (!tryStoreJobInfo()) {
          setTimeout(() => { if (!tryStoreJobInfo()) {
            setTimeout(() => tryStoreJobInfo(), 2000);
          }}, 1500);
        }}, 1000);
      }}, 500);
    }
  }
  
  // Watch for navigation (SPA support)
  watchForNavigation();
  
  // Watch for LinkedIn lazy-loaded job details (re-inject when DOM updates)
  if (currentSiteName === 'linkedin') {
    watchForLinkedInJobContent();
  }
  
  // Heartbeat: when the extension is reloaded/updated, this content script and
  // any iframes it injected (side panel overlay, download overlay, LinkedIn
  // inline AI popover, etc.) become orphaned. They keep running their old JS
  // bundle whose chrome.runtime.getURL() calls now resolve to
  // chrome-extension://invalid/ — that's what generates the 20/sec
  // "GET chrome-extension://invalid/ net::ERR_FAILED" flood the user saw.
  // Detect the dead context and rip out everything we injected so the tab
  // goes quiet immediately, without needing a manual page reload.
  startExtensionContextHeartbeat();

  console.log('[ProfileAI] Content script initialized', { isJobPage, isAuthenticated, url: window.location.href });
}

/** IDs we inject that we should sweep on init (in case a previous extension
 *  load left them behind) and on context death (see heartbeat). Kept as a
 *  single source of truth so we don't miss one. */
const PROFILEAI_INJECTED_IDS = [
  'profileai-overlay-container',
  'profileai-backdrop',
  'profileai-download-overlay',
  'profileai-fab',
  'profileai-fab-menu',
  'profileai-inline-banner',
  'profileai-li-topbtn',
  'profileai-loading-modal',
  'profileai-tailor-modal',
  'profileai-styles',
  'profileai-floating-styles',
  'profileai-floating-answer-btn',
  'profileai-floating-answer-popover',
  'profileai-li-inline-styles',
];
const PROFILEAI_INJECTED_CLASSES = [
  'profileai-li-ai-btn',
  'profileai-li-ai-pop',
  'profileai-notification',
];

/** Nuke any DOM this extension (or a previous extension ID's version of it)
 *  left in the page. Called on init BEFORE we inject anything, so a stale
 *  side panel iframe / FAB / etc. from a prior extension load can't keep
 *  firing chrome-extension://invalid/ fetches from LinkedIn's autorun loop.
 *  Also removes any iframe whose src points at a chrome-extension:// URL
 *  that doesn't match our current runtime — that's the real culprit for the
 *  console flood the user is seeing.
 *
 *  IMPORTANT: this intentionally does NOT touch PROFILEAI_INJECTED_CLASSES
 *  (the per-field LinkedIn inline AI ✨ buttons/popovers). Those are cheap,
 *  per-page elements with their own liveness check (liCleanupOrphanButtons,
 *  which only removes a button once its target field is actually gone from
 *  the DOM). Some LinkedIn edit routes (e.g. /edit/forms/summary/new/)
 *  trigger a fresh content-script init on every navigation — nuking the
 *  buttons here as well would wipe out a button that was JUST created a
 *  moment earlier by the previous init, for a field that's still on-screen,
 *  which is exactly the "button appears then vanishes" bug users hit. Only
 *  the heartbeat's context-DEATH cleanup (a real, one-time event) needs to
 *  remove those, since at that point their click handlers are permanently
 *  broken anyway. */
function sweepOrphanedInjections() {
  let removed = 0;
  try {
    PROFILEAI_INJECTED_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.remove(); removed++; }
    });
    // Belt-and-suspenders: any iframe pointing at chrome-extension://invalid/
    // or at a DIFFERENT extension ID than ours. LinkedIn's Pemberly network
    // layer keeps trying to prefetch these on requestIdleCallback → that's
    // the ERR_FAILED flood.
    let ownUrl = '';
    try { ownUrl = chrome.runtime?.getURL?.('') || ''; } catch { /* ignore */ }
    document.querySelectorAll<HTMLIFrameElement>('iframe[src^="chrome-extension://"]').forEach((frame) => {
      const src = frame.src || '';
      if (src.startsWith('chrome-extension://invalid/') || (ownUrl && !src.startsWith(ownUrl))) {
        try { frame.remove(); removed++; } catch { /* ignore */ }
      }
    });
    if (removed > 0) {
      console.log(`[ProfileAI] Swept ${removed} orphaned injection(s) from a previous extension load`);
    }
  } catch {
    /* best-effort */
  }
}

/** Poll chrome.runtime.id every 3s. When it goes undefined the extension has
 *  been reloaded/uninstalled — remove all our injected DOM so stale iframes
 *  stop making chrome-extension://invalid requests. */
let extHeartbeatTimer: number | null = null;
function startExtensionContextHeartbeat() {
  if (extHeartbeatTimer != null) return;
  extHeartbeatTimer = window.setInterval(() => {
    if (extAlive()) return;
    // Context is dead — clean up and stop the heartbeat.
    if (extHeartbeatTimer != null) {
      clearInterval(extHeartbeatTimer);
      extHeartbeatTimer = null;
    }
    try {
      PROFILEAI_INJECTED_IDS.forEach((id) => document.getElementById(id)?.remove());
      PROFILEAI_INJECTED_CLASSES.forEach((cls) => {
        document.querySelectorAll(`.${cls}`).forEach((n) => n.remove());
      });
      console.log('[ProfileAI] Extension context invalidated — cleaned up injected DOM');
    } catch {
      /* best-effort */
    }
  }, 3000);
}

// Check auth silently without redirects
async function checkAuthSilently() {
  try {
    const authData = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_SILENT' });
    isAuthenticated = authData?.isAuthenticated || (authData?.token && authData?.user);
    
    if (isAuthenticated) {
      const profileResponse = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
      profileData = profileResponse?.profile;
      
      const answersResponse = await chrome.runtime.sendMessage({ type: 'GET_SAVED_ANSWERS' });
      savedAnswers = answersResponse?.answers || {};
    }
    console.log('[ProfileAI] Auth check complete:', { isAuthenticated });
  } catch (error) {
    console.log('[ProfileAI] Auth check failed:', error);
  }
}

// Detect if current page is a job-related page
function detectJobPage() {
  const url = window.location.href;
  
  // Skip our own app and common non-job sites
  const skipPatterns = [
    /localhost:3000/i,
    /profileai\.io/i,
    /google\.com(?!.*\/jobs)/i,
    /youtube\.com/i,
    /facebook\.com/i,
    /twitter\.com|x\.com/i,
    /instagram\.com/i,
    /reddit\.com/i,
    /github\.com(?!.*\/(jobs|careers))/i,
    /stackoverflow\.com(?!.*\/jobs)/i,
    /amazon\.com(?!.*\/jobs)/i,
    /netflix\.com/i,
    /wikipedia\.org/i,
    /mail\.google\.com/i,
    /docs\.google\.com/i,
    /drive\.google\.com/i,
    /slack\.com/i,
    /notion\.so/i,
    /figma\.com/i,
    /medium\.com/i,
    /chat\.openai\.com/i,
    /claude\.ai/i,
  ];
  
  for (const skip of skipPatterns) {
    if (skip.test(url)) {
      isJobPage = false;
      return;
    }
  }
  
  // Check URL patterns for known job sites/paths
  for (const pattern of JOB_PAGE_PATTERNS) {
    if (pattern.test(url)) {
      isJobPage = true;
      console.log('[ProfileAI] Job page detected via URL pattern:', pattern.toString());
      updateFabAutofillVisibility();
      return;
    }
  }
  
  // Check if we're on a known ATS/job board domain
  const atsDomains = [
    /greenhouse\.io/i,
    /lever\.co/i,
    /workday\.com/i,
    /myworkdayjobs\.com/i,
    /ashbyhq\.com/i,
    /[?&]ashby_jid=/i,
    /icims\.com/i,
    /smartrecruiters\.com/i,
    /bamboohr\.com/i,
    /jazz\.co/i,
    /breezy\.hr/i,
    /recruitee\.com/i,
    /workable\.com/i,
    /applytojob\.com/i,
    /jobvite\.com/i,
    /taleo\.net/i,
    /successfactors\.com/i,
  ];
  
  for (const ats of atsDomains) {
    if (ats.test(url)) {
      isJobPage = true;
      console.log('[ProfileAI] Job page detected via ATS domain');
      updateFabAutofillVisibility();
      return;
    }
  }
  
  // Content analysis — only if page has STRONG job application signals (not just any form)
  setTimeout(() => {
    if (isJobPage) return; // Already detected
    
    // Must have a job application form — look for resume/CV upload or apply-specific forms
    const hasApplicationForm = document.querySelector(
      'input[name*="resume" i], input[name*="cv" i], input[accept*=".pdf"], ' +
      'form[action*="apply" i], form[action*="application" i], form[action*="submit" i], ' +
      'button[class*="apply" i], a[class*="apply" i], ' +
      '[class*="application-form" i], [id*="application-form" i]'
    );
    
    if (!hasApplicationForm) return; // No application form, not a job page
    
    // Also require multiple job-specific keywords (at least 3)
    const pageText = document.body?.innerText?.toLowerCase() || '';
    const jobSignals = [
      'apply now', 'submit application', 'job description', 
      'qualifications', 'responsibilities', 'experience required',
      'years of experience', 'salary', 'compensation', 'benefits',
      'full-time', 'part-time', 'remote', 'hybrid', 'on-site',
      'equal opportunity employer', 'we are hiring', 'join our team',
      'cover letter', 'resume', 'curriculum vitae'
    ];
    const matchedSignals = jobSignals.filter(kw => pageText.includes(kw));
    
    if (matchedSignals.length >= 3) {
      isJobPage = true;
      console.log('[ProfileAI] Job page detected via content analysis:', matchedSignals.slice(0, 5));
      updateFabAutofillVisibility();
      if (isAuthenticated) {
        showAutofillBanner();
      }
    }
  }, 2000);
}

// Listen for auth broadcast from web app via postMessage
function listenForAuthBroadcast() {
  window.addEventListener('message', (event) => {
    // Allow same-window messages (web app -> content script) AND messages from
    // child iframes (the download overlay iframe forwards close events to us).
    const isSameWindow = event.source === window;
    const isFromChildFrame = event.source !== window && event.source !== null;
    if (!isSameWindow && !isFromChildFrame) return;

    // Cross-frame close request from the download overlay iframe.
    if (event.data?.type === 'PROFILEAI_CLOSE_DOWNLOAD_OVERLAY' && window.top === window.self) {
      closeDownloadOverlay();
      return;
    }

    // The remaining handlers expect same-window messages from our own React app.
    if (!isSameWindow) return;

    // Handle auth success from ProfileAI web app
    if (event.data?.type === 'PROFILEAI_AUTH_SUCCESS') {
      console.log('[ProfileAI] Received auth from web app via postMessage');
      
      const { token, user } = event.data;
      if (token && user) {
        // Send to background script
        chrome.runtime.sendMessage({
          type: 'LOGIN',
          data: { token, user }
        }).then(() => {
          console.log('[ProfileAI] Auth synced to extension successfully');
          isAuthenticated = true;
          
          // Update any visible overlay
          const iframe = document.getElementById('profileai-sidepanel-iframe') as HTMLIFrameElement;
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'AUTH_UPDATED' }, '*');
          }
        }).catch((err) => {
          console.error('[ProfileAI] Failed to sync auth:', err);
        });
      }
    }
    
    // Handle logout from web app
    if (event.data?.type === 'PROFILEAI_AUTH_LOGOUT') {
      console.log('[ProfileAI] Received logout from web app');
      chrome.runtime.sendMessage({ type: 'LOGOUT' });
      isAuthenticated = false;
    }

    // Handle close request from web app (e.g. after resume download).
    if (event.data?.type === 'PROFILEAI_CLOSE_TAB') {
      console.log('[ProfileAI] Web app requested close');
      // Inside the download iframe? Forward to parent frame so the parent's
      // content script can remove the overlay. Don't close the tab \u2014 the
      // user is on their job application page.
      if (window.top !== window.self) {
        window.parent.postMessage({ type: 'PROFILEAI_CLOSE_DOWNLOAD_OVERLAY' }, '*');
        return;
      }
      // If a download overlay is open on this top page, close it.
      if (closeDownloadOverlay()) return;
      // Otherwise this IS a standalone /resume/download tab \u2014 close it.
      chrome.runtime.sendMessage({ type: 'CLOSE_CURRENT_TAB' });
    }

    // Handle resume download page requesting tailored data
    if (event.data?.type === 'PROFILEAI_REQUEST_TAILORED_DATA') {
      chrome.storage.local.get('pendingResumeDownload').then(({ pendingResumeDownload }) => {
        if (pendingResumeDownload) {
          window.postMessage({ type: 'PROFILEAI_TAILORED_PROFILE', profile: pendingResumeDownload }, '*');
          // Clean up after delivering
          chrome.storage.local.remove('pendingResumeDownload');
          console.log('[ProfileAI] Delivered tailored data to resume download page');
        }
      }).catch((err) => {
        console.error('[ProfileAI] Error fetching pending resume data:', err);
      });
    }
  });
  
  // Also check for auth data in localStorage on ProfileAI pages
  if (window.location.href.includes('localhost:3000') || window.location.href.includes('profilleai.com')) {
    checkLocalStorageAuth();

    // Proactively deliver pending resume data on the download page
    if (window.location.pathname.includes('/resume/download')) {
      chrome.storage.local.get('pendingResumeDownload').then(({ pendingResumeDownload }) => {
        if (pendingResumeDownload) {
          // Small delay to ensure React app has mounted and set up listeners
          setTimeout(() => {
            window.postMessage({ type: 'PROFILEAI_TAILORED_PROFILE', profile: pendingResumeDownload }, '*');
            chrome.storage.local.remove('pendingResumeDownload');
            console.log('[ProfileAI] Proactively delivered tailored data to download page');
          }, 500);
        }
      });
    }
  }
}

// Check localStorage for existing auth (on ProfileAI pages)
// Also inject extension auth INTO localStorage if web app has no auth
function checkLocalStorageAuth() {
  try {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      console.log('[ProfileAI] Found auth in localStorage, syncing to extension');
      
      chrome.runtime.sendMessage({
        type: 'LOGIN',
        data: { token, user }
      }).then(() => {
        console.log('[ProfileAI] Auth synced from localStorage');
        isAuthenticated = true;
      }).catch((err) => {
        console.error('[ProfileAI] Failed to sync localStorage auth:', err);
      });
    } else {
      // No web app auth — inject from extension storage so pages like /resume/download work
      injectExtensionAuthToLocalStorage();
    }
  } catch (e) {
    console.error('[ProfileAI] Error checking localStorage:', e);
  }
}

// Inject extension auth token + user into web app localStorage
async function injectExtensionAuthToLocalStorage() {
  try {
    const data = await chrome.storage.local.get(['authToken', 'user']);
    
    const authToken = data.authToken;
    const user = data.user;
    
    if (authToken && user) {
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(user));
      isAuthenticated = true;
      console.log('[ProfileAI] Injected extension auth into web app localStorage');
      
      // Notify the React app — it may already be mounted
      window.postMessage({
        type: 'PROFILEAI_AUTH_SUCCESS',
        token: authToken,
        user
      }, '*');
    }
  } catch (err) {
    console.error('[ProfileAI] Failed to inject auth:', err);
  }
}

// Watch for SPA navigation changes
function watchForNavigation() {
  let lastUrl = location.href;
  
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleNavigation();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', handleNavigation);
}

// Watch for LinkedIn lazy-loaded job content and inject banner when ready
function watchForLinkedInJobContent() {
  let injected = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  const observer = new MutationObserver(() => {
    if (injected) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Stale script (extension was reloaded) or we navigated off the job page
      // mid-observe (e.g. onto a /in/ profile) — stop, don't store phantoms.
      if (!extAlive() || !isJobPage) {
        observer.disconnect();
        return;
      }
      // Check if job details have loaded
      const jobInfo = getJobInfo();
      if (jobInfo && (jobInfo.title || jobInfo.company)) {
        console.log('[ProfileAI] LinkedIn content loaded, storing job info:', jobInfo.title);
        // Store for side panel — add _ts to force onChanged to fire even if same job
        chrome.storage.local.set({
          currentJobInfo: { ...jobInfo, _ts: Date.now() },
          currentJobUrl: location.href,
        });

        // Inject inline banner if not already present
        if (!document.getElementById('profileai-inline-banner')) {
          injectLinkedInBanner();
        }
        injected = true;
        observer.disconnect();
      }
    }, 500);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Auto-disconnect after 15 seconds to avoid leaks
  setTimeout(() => {
    observer.disconnect();
  }, 15000);
}

// Handle navigation in SPA
function handleNavigation() {
  console.log('[ProfileAI] Navigation detected:', location.href);
  
  const wasJobPage = isJobPage;
  isJobPage = false;
  detectJobPage();
  detectSite();
  
  // Clean up any leftover injected elements
  const oldBanner = document.getElementById('profileai-banner');
  if (oldBanner) oldBanner.remove();
  document.getElementById('profileai-inline-banner')?.remove();
  document.getElementById('profileai-li-topbtn')?.remove();
  inlineBannerState = { analyzing: false, tailoring: false, score: null, present: [], missing: [] };

  // Update stored job info for the overlay SidePanel — cascade retries.
  // ONLY store when this is actually a job page: getJobInfo()'s `h1` fallback
  // happily returns the profile owner's name on linkedin.com/in/* pages, which
  // used to write a phantom "job" into storage that the SidePanel displayed.
  const tryStoreNav = (attempt: number) => {
    if (!extAlive()) return; // stale script after extension reload — bail
    if (!isJobPage) {
      if (attempt < 4) {
        // detectJobPage()'s content-analysis pass is async (2s timer) — retry
        // in case this page turns out to be a job page after all.
        setTimeout(() => tryStoreNav(attempt + 1), 1500);
      } else {
        // Confirmed non-job page — purge any stale job so the panel clears.
        try { chrome.storage.local.remove(['currentJobInfo', 'currentJobUrl']); } catch (_) {}
      }
      return;
    }
    const jobInfo = getJobInfo();
    if (jobInfo) {
      console.log('[ProfileAI] Nav: stored job info (attempt', attempt, '):', jobInfo.title);
      try {
        chrome.storage.local.set({ currentJobInfo: { ...jobInfo, _ts: Date.now() }, currentJobUrl: location.href });
      } catch (_) { /* context gone mid-flight */ }
    } else if (attempt < 4) {
      // Retry — don't clear storage yet, content might still be loading
      setTimeout(() => tryStoreNav(attempt + 1), 1500);
    } else {
      try { chrome.storage.local.remove(['currentJobInfo', 'currentJobUrl']); } catch (_) {}
    }
  };
  setTimeout(() => tryStoreNav(1), 800);

  // Re-inject on new job pages
  if (isJobPage && isAuthenticated) {
    setTimeout(() => {
      showAutofillBanner();
    }, 1200);
  }
  // Always inject inline banner on LinkedIn job pages
  if (isJobPage && currentSiteName === 'linkedin') {
    setTimeout(() => {
      injectLinkedInBanner();
    }, 1500);
    // Start observer for lazy-loaded content
    watchForLinkedInJobContent();
  }
}

// Detect current site
function detectSite() {
  const url = window.location.href;
  for (const [name, config] of Object.entries(CONFIG.SUPPORTED_SITES)) {
    if (config.match.test(url)) {
      currentSite = config;
      currentSiteName = name;
      console.log('[ProfileAI] Detected site:', name);
      return;
    }
  }
  // Detect Ashby-embedded forms on company sites via URL param
  if (/[?&]ashby_jid=/.test(url)) {
    currentSite = CONFIG.SUPPORTED_SITES.ashby;
    currentSiteName = 'ashby';
    console.log('[ProfileAI] Detected Ashby-embedded site via ashby_jid param');
    return;
  }
  currentSite = null;
  currentSiteName = 'generic';
}

// Get job info from current page
function getJobInfo(): JobInfo | null {
  let title = '';
  let company = '';
  let description = '';

  if (currentSite) {
    const titleEl = document.querySelector(currentSite.titleSelector);
    const companyEl = document.querySelector(currentSite.companySelector);
    
    // Try each description selector separately (comma-separated selectors may not all exist)
    const descSelectors = currentSite.descriptionSelector.split(',').map((s: string) => s.trim());
    for (const sel of descSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el as HTMLElement).innerText || el.textContent || '';
          if (text.trim().length > (description?.length || 0)) {
            description = text;
          }
        }
      } catch (e) { /* skip invalid selector */ }
    }

    title = titleEl?.textContent?.trim() || '';
    company = companyEl?.textContent?.trim() || '';
  }

  // LinkedIn-specific: aggressive description extraction
  if (currentSiteName === 'linkedin' && (!description || description.trim().length < 200)) {
    // Try the "About the job" section specifically
    const aboutJobHeading = Array.from(document.querySelectorAll('h2, h3, span.t-bold')).find(
      el => /about the job|job description|description/i.test(el.textContent || '')
    );
    if (aboutJobHeading) {
      // Walk up to find the container and get its full text
      let container = aboutJobHeading.closest('section') || aboutJobHeading.closest('[class*="description"]') || aboutJobHeading.parentElement?.parentElement;
      if (container) {
        const text = (container as HTMLElement).innerText || '';
        if (text.trim().length > (description?.trim().length || 0)) {
          description = text;
        }
      }
    }
    
    // Try the main job details container (LinkedIn 2024+ layout)
    const jobDetailsContainers = [
      'div.jobs-description',
      'div.jobs-description-content',
      'div[class*="jobs-description"]',
      'section[class*="description"]',
      'div.jobs-box__html-content',
      'article[class*="jobs"]',
      'div.job-view-layout',
    ];
    for (const sel of jobDetailsContainers) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el as HTMLElement).innerText || '';
          if (text.trim().length > (description?.trim().length || 0)) {
            description = text;
          }
        }
      } catch (_) {}
    }
  }

  // Fallback: generic selectors if we still don't have a title
  if (!title) {
    title = (
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('.job-title, [class*="job-title"], [class*="posting-headline"]')?.textContent?.trim() ||
      ''
    );
  }
  if (!company) {
    company = (
      document.querySelector('.company, .company-name, [class*="company"]')?.textContent?.trim() ||
      ''
    );
  }

  // Fallback: try multiple common description selectors, pick the LONGEST match
  if (!description || description.trim().length < 200) {
    const fallbackSelectors = [
      '.job-description',
      '[class*="job-description"]',
      '[class*="jobdescription"]',
      '.posting-page',
      '.section-wrapper',
      '#content',
      '.content-wrapper',
      '[class*="description"]',
      'article',
      'main',
    ];
    let longestDesc = description || '';
    for (const sel of fallbackSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el as HTMLElement).innerText || el.textContent || '';
          if (text.trim().length > longestDesc.length) {
            longestDesc = text;
          }
        }
      } catch (e) { /* skip */ }
    }
    if (longestDesc.trim().length > (description?.trim().length || 0)) {
      description = longestDesc;
    }
  }

  // Ultimate fallback: use page body text (same as vanilla extension)
  if (!description || description.trim().length < 50) {
    description = document.body.innerText.slice(0, 8000);
  }

  console.log('[ProfileAI] getJobInfo result:', {
    title: title?.slice(0, 60),
    company: company?.slice(0, 40),
    descLength: description?.length || 0,
    descPreview: description?.slice(0, 150),
  });

  if (!title && !company) return null;

  return { title, company, description };
}

// Inject styles
function injectStyles() {
  if (document.getElementById('profileai-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'profileai-styles';
  style.textContent = `
    #profileai-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    .profileai-fab-btn {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
      transition: all 0.2s ease;
    }
    
    .profileai-fab-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(124, 58, 237, 0.5);
    }
    
    .profileai-fab-btn svg {
      width: 28px;
      height: 28px;
      color: white;
    }
    
    .profileai-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483645;
      animation: profileai-fadeIn 0.2s ease;
    }
    
    @keyframes profileai-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .profileai-backdrop.closing {
      animation: profileai-fadeOut 0.2s ease forwards;
    }
    
    @keyframes profileai-fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    #profileai-overlay-container {
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      z-index: 2147483646;
      animation: profileai-slideIn 0.3s ease;
    }
    
    @keyframes profileai-slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    
    #profileai-overlay-container.closing {
      animation: profileai-slideOut 0.25s ease forwards;
    }
    
    @keyframes profileai-slideOut {
      from { transform: translateX(0); }
      to { transform: translateX(100%); }
    }
    
    #profileai-overlay-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #0f0f14;
    }

    /* Fullscreen download overlay (renders unified resume modal centered on the current page) */
    #profileai-download-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(15, 15, 20, 0.35);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: profileai-fadeIn 0.15s ease;
    }
    #profileai-download-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
    
    .profileai-notification {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
      z-index: 2147483647;
      animation: profileai-notifyIn 0.3s ease;
    }
    
    @keyframes profileai-notifyIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    #profileai-fab-menu {
      position: absolute;
      bottom: 68px;
      right: 0;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
      padding: 6px 0;
      min-width: 210px;
      z-index: 2147483647;
      animation: profileai-menuIn 0.18s ease;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    @keyframes profileai-menuIn {
      from { opacity:0; transform:translateY(8px) scale(.96); }
      to { opacity:1; transform:translateY(0) scale(1); }
    }
    .profileai-fab-menu-item {
      display: block;
      width: 100%;
      padding: 11px 18px;
      border: none;
      background: none;
      color: #1a1a2e;
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .profileai-fab-menu-item:hover {
      background: #f3f0ff;
    }
    .profileai-fab-menu-item + .profileai-fab-menu-item {
      border-top: 1px solid #f0f0f0;
    }

    /* ─── Inline LinkedIn Banner ─── */
    #profileai-inline-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      box-sizing: border-box;
      width: 100%;
      flex: 1 1 100%;
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
      border: 1px solid #ddd6fe;
      border-radius: 12px;
      padding: 12px 16px;
      margin: 12px 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: profileai-bannerIn 0.3s ease;
      position: relative;
    }
    @keyframes profileai-bannerIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .profileai-inline-close {
      position: absolute;
      top: 6px;
      right: 8px;
      background: none;
      border: none;
      color: #a78bfa;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 1;
    }
    .profileai-inline-close:hover { background: rgba(124,58,237,.1); }

    .profileai-inline-score {
      flex-shrink: 0;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #7c3aed;
      background: conic-gradient(#7c3aed var(--score-deg, 0deg), #e9e5f5 0deg);
      position: relative;
    }
    .profileai-inline-score::after {
      content: attr(data-label);
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #f5f3ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #7c3aed;
    }

    .profileai-inline-info {
      flex: 1;
      min-width: 0;
    }
    .profileai-inline-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e1b4b;
      margin: 0 0 2px;
    }
    .profileai-inline-sub {
      font-size: 12px;
      color: #6d28d9;
      margin: 0;
    }

    .profileai-inline-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .profileai-inline-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .profileai-inline-btn svg {
      width: 14px;
      height: 14px;
    }
    .profileai-inline-btn.primary {
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      color: #fff;
      box-shadow: 0 2px 8px rgba(124,58,237,.3);
    }
    .profileai-inline-btn.primary:hover {
      box-shadow: 0 4px 14px rgba(124,58,237,.4);
      transform: translateY(-1px);
    }
    .profileai-inline-btn.secondary {
      background: #fff;
      color: #7c3aed;
      border: 1px solid #ddd6fe;
    }
    .profileai-inline-btn.secondary:hover {
      background: #f5f3ff;
      border-color: #c4b5fd;
    }
    .profileai-inline-btn.loading {
      opacity: 0.7;
      pointer-events: none;
    }
    .profileai-inline-btn .spin {
      animation: profileai-spin 1s linear infinite;
    }
    @keyframes profileai-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Top-bar button injected near Apply/Save */
    .profileai-li-topbtn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 18px;
      height: 36px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      color: #fff;
      box-shadow: 0 2px 8px rgba(124,58,237,.3);
      transition: all 0.15s ease;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      vertical-align: middle;
    }
    .profileai-li-topbtn:hover {
      box-shadow: 0 4px 14px rgba(124,58,237,.4);
      transform: translateY(-1px);
    }
    .profileai-li-topbtn svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);
  console.log('[ProfileAI] Styles injected');
}

// Check if the FAB should be visible based on user preferences
async function checkFabVisibility(): Promise<boolean> {
  try {
    const { fabHidden = {} } = await chrome.storage.local.get('fabHidden');
    
    // Check if hidden on all pages
    if (fabHidden.allPages) return false;
    
    // Check if hidden on this domain
    const domain = window.location.hostname;
    if (fabHidden.domains && fabHidden.domains.includes(domain)) return false;
    
    // "Hide until next visit" uses sessionStorage (cleared when tab closes)
    if (sessionStorage.getItem('profileai-fab-hidden') === '1') return false;
    
    return true;
  } catch {
    return true;
  }
}

// Show FAB context menu
function showFabMenu(fab: HTMLElement) {
  // Remove existing menu
  closeFabMenu();

  const menu = document.createElement('div');
  menu.id = 'profileai-fab-menu';

  const items = [
    { label: 'Hide until next visit', action: 'hide-session' },
    { label: 'Disable on this domain', action: 'hide-domain' },
    { label: 'Disable on all pages', action: 'hide-all' },
  ];

  items.forEach(({ label, action }) => {
    const btn = document.createElement('button');
    btn.className = 'profileai-fab-menu-item';
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleFabMenuAction(action, fab);
    });
    menu.appendChild(btn);
  });

  fab.appendChild(menu);

  // Close on outside click
  const closeOnClick = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      closeFabMenu();
      document.removeEventListener('click', closeOnClick, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnClick, true), 0);
}

function closeFabMenu() {
  document.getElementById('profileai-fab-menu')?.remove();
}

async function handleFabMenuAction(action: string, fab: HTMLElement) {
  closeFabMenu();
  
  switch (action) {
    case 'hide-session':
      sessionStorage.setItem('profileai-fab-hidden', '1');
      fab.style.display = 'none';
      break;
    case 'hide-domain': {
      const domain = window.location.hostname;
      const { fabHidden = {} } = await chrome.storage.local.get('fabHidden');
      const domains: string[] = fabHidden.domains || [];
      if (!domains.includes(domain)) domains.push(domain);
      await chrome.storage.local.set({ fabHidden: { ...fabHidden, domains } });
      fab.style.display = 'none';
      break;
    }
    case 'hide-all':
      await chrome.storage.local.set({ fabHidden: { allPages: true } });
      fab.style.display = 'none';
      break;
  }
}

// Create floating action button with drag-and-drop support
function createFloatingButton() {
  if (document.getElementById('profileai-fab')) return;
  
  const fab = document.createElement('div');
  fab.id = 'profileai-fab';
  fab.innerHTML = `
    <button class="profileai-fab-btn" title="Open ProfileAI Panel">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
  
  document.body.appendChild(fab);
  
  // Restore saved position
  const savedPos = localStorage.getItem('profileai-fab-pos');
  if (savedPos) {
    try {
      const { right, bottom } = JSON.parse(savedPos);
      fab.style.right = right + 'px';
      fab.style.bottom = bottom + 'px';
    } catch (e) { /* use default */ }
  }
  
  // Drag-and-drop logic
  let isDragging = false;
  let wasDragged = false;
  let startX = 0;
  let startY = 0;
  let startRight = 0;
  let startBottom = 0;

  const btn = fab.querySelector('.profileai-fab-btn') as HTMLElement | null;

  function onPointerDown(e: PointerEvent) {
    isDragging = true;
    wasDragged = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = fab.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    fab.style.transition = 'none';
    if (btn) btn.style.cursor = 'grabbing';
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) wasDragged = true;
    const newRight = Math.max(0, Math.min(window.innerWidth - 56, startRight - dx));
    const newBottom = Math.max(0, Math.min(window.innerHeight - 56, startBottom - dy));
    fab.style.right = newRight + 'px';
    fab.style.bottom = newBottom + 'px';
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    fab.style.transition = '';
    if (btn) btn.style.cursor = '';
    // Save position
    const computedRight = parseInt(fab.style.right) || 24;
    const computedBottom = parseInt(fab.style.bottom) || 24;
    localStorage.setItem('profileai-fab-pos', JSON.stringify({ right: computedRight, bottom: computedBottom }));
  }

  if (btn) {
    btn.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    // Only open panel if user didn't drag
    btn.addEventListener('click', (e) => {
      if (wasDragged) {
        e.stopPropagation();
        return;
      }
      toggleOverlay();
    });
    // Right-click opens context menu
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showFabMenu(fab);
    });
  }
  
  console.log('[ProfileAI] FAB created (draggable)');
}

// Show/hide the autofill button on the FAB based on job page detection
// (kept as no-op for callers)
function updateFabAutofillVisibility() {}

// Toggle overlay panel
function toggleOverlay() {
  if (overlayContainer) {
    closeOverlay();
  } else {
    openOverlay();
  }
}

// Open overlay panel with iframe
function openOverlay() {
  if (overlayContainer) return;

  // Store current job info so the iframe SidePanel can read it reliably
  const jobInfo = getJobInfo();
  if (jobInfo) {
    chrome.storage.local.set({ currentJobInfo: jobInfo, currentJobUrl: location.href });
  }
  
  // Create backdrop
  backdrop = document.createElement('div');
  backdrop.className = 'profileai-backdrop';
  backdrop.addEventListener('click', closeOverlay);
  document.body.appendChild(backdrop);
  
  // Create container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'profileai-overlay-container';
  
  // Create iframe loading the sidepanel
  const iframe = document.createElement('iframe');
  iframe.id = 'profileai-overlay-iframe';
  iframe.src = chrome.runtime.getURL('src/sidepanel/index.html');
  
  overlayContainer.appendChild(iframe);
  document.body.appendChild(overlayContainer);
  
  // Hide FAB when overlay is open
  const fab = document.getElementById('profileai-fab');
  if (fab) fab.style.display = 'none';
  
  console.log('[ProfileAI] Overlay opened');
}

// Close overlay panel
function closeOverlay() {
  if (backdrop) {
    backdrop.classList.add('closing');
  }
  
  if (overlayContainer) {
    overlayContainer.classList.add('closing');
    
    setTimeout(() => {
      backdrop?.remove();
      backdrop = null;
      overlayContainer?.remove();
      overlayContainer = null;
      
      // Show FAB again (only if not hidden by user)
      const fab = document.getElementById('profileai-fab');
      if (fab) {
        checkFabVisibility().then(show => {
          if (show) fab.style.display = '';
        });
      }
    }, 250);
  }
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD RESUME OVERLAY — full-page iframe rendering the unified
// ResumePreviewModal directly on top of the current page (no new tab,
// no separate window). Used by the side panel's Download button.
// ═══════════════════════════════════════════════════════════════
function openDownloadOverlay() {
  // Avoid duplicate overlays
  if (document.getElementById('profileai-download-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'profileai-download-overlay';

  const iframe = document.createElement('iframe');
  iframe.id = 'profileai-download-iframe';
  iframe.src = `${CONFIG.WEB_BASE}/resume/download?ext=1&overlay=1`;
  iframe.allow = 'clipboard-write';

  overlay.appendChild(iframe);
  document.documentElement.appendChild(overlay);

  // Hide FAB while overlay is open
  const fab = document.getElementById('profileai-fab');
  if (fab) fab.style.display = 'none';

  console.log('[ProfileAI] Download overlay opened');
}

function closeDownloadOverlay(): boolean {
  const overlay = document.getElementById('profileai-download-overlay');
  if (!overlay) return false;
  overlay.remove();
  // Restore FAB
  const fab = document.getElementById('profileai-fab');
  if (fab) {
    checkFabVisibility().then(show => { if (show) fab.style.display = ''; });
  }
  return true;
}

// Show autofill banner — now injects inline UI on supported ATS pages
function showAutofillBanner() {
  if (currentSiteName === 'linkedin') {
    injectLinkedInBanner();
  }
}

// ═══════════════════════════════════════════════════════════════
// INLINE LINKEDIN BANNER — injected directly in job details page
// ═══════════════════════════════════════════════════════════════

let inlineBannerState: {
  analyzing: boolean;
  tailoring: boolean;
  score: number | null;
  present: string[];
  missing: string[];
} = { analyzing: false, tailoring: false, score: null, present: [], missing: [] };

function injectLinkedInBanner() {
  // ── Disabled ──────────────────────────────────────────────────────────
  // We no longer inject any UI directly into LinkedIn's page (the inline
  // "Resume Match" banner or the "ProfileAI" top button). Overlaying content
  // on LinkedIn is the part of their User Agreement (§8.2) we'd rather not
  // lean on, and it broke whenever LinkedIn renamed its DOM. Analyze/Tailor
  // now live entirely in our own surfaces (the floating button + side panel),
  // which still read the single job posting the user is actively viewing.
  //
  // Defensively remove any stale injected nodes from older builds.
  document.getElementById('profileai-inline-banner')?.remove();
  document.getElementById('profileai-li-topbtn')?.remove();
}

function _deprecated_injectLinkedInBanner() {
  // Don't duplicate
  if (document.getElementById('profileai-inline-banner')) return;
  if (document.getElementById('profileai-li-topbtn')) return;

  // 1) Inject "Open ProfileAI" button near Apply/Save buttons
  injectLinkedInTopButton();

  // 2) Inject keyword match banner in the job details area
  injectLinkedInMatchBanner();
}

function findLinkedInButtonBar(): HTMLElement | null {
  // LinkedIn's button bar near Apply/Save — try multiple selectors
  const selectors = [
    '.jobs-unified-top-card__content--two-pane .mt2',
    '.jobs-details-top-card__content .mt2',
    '.job-details-jobs-unified-top-card__content--two-pane .mt2',
    '.jobs-unified-top-card .display-flex',
    '.job-details-jobs-unified-top-card .display-flex.justify-flex-start',
    '.top-card-layout .top-card-layout__cta-container',
    '.jobs-apply-button--top-card',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      // Verify this container has or is near an Apply button
      const hasApply = el.querySelector('[class*="apply"], [aria-label*="Apply"], [aria-label*="Easy Apply"], a[href*="apply"]');
      if (hasApply || el.closest('[class*="top-card"]')) {
        return el as HTMLElement;
      }
    }
  }

  // Direct fallback: find ANY Apply button and use its parent container
  const applyBtn = document.querySelector(
    '.jobs-apply-button, [class*="jobs-apply"], button[aria-label*="Apply"], button[aria-label*="Easy Apply"], ' +
    'a[class*="apply"][href*="apply"], .top-card-layout__cta-container button, [data-tracking-control-name*="apply"]'
  );
  if (applyBtn) {
    // Walk up to find a reasonable container
    let container = applyBtn.parentElement;
    // Go up at most 3 levels to find a flex container with multiple buttons
    for (let i = 0; i < 3 && container; i++) {
      if (container.children.length >= 2) return container as HTMLElement;
      container = container.parentElement;
    }
    return (applyBtn.parentElement || applyBtn) as HTMLElement;
  }
  return null;
}

function findLinkedInJobDetailArea(): HTMLElement | null {
  const selectors = [
    '.jobs-details-fit-level-preferences',
    '#job-details',
    '.jobs-description-content',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '.show-more-less-html__markup',
    '.description__text',
    '[class*="jobs-description"]',
    '[class*="decorated-job-posting__details"]',
    '.top-card-layout ~ section',
    'section.description',
  ];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el as HTMLElement;
    } catch (_) {}
  }
  // Last resort: find "About the job" heading and use its parent section
  const headings = document.querySelectorAll('h2, h3');
  for (const h of headings) {
    if (h.textContent?.trim().toLowerCase().includes('about the job')) {
      return (h.closest('section') || h.parentElement) as HTMLElement;
    }
  }
  return null;
}

function injectLinkedInTopButton() {
  const bar = findLinkedInButtonBar();
  if (!bar) {
    // Retry once after SPA load
    setTimeout(() => {
      const retryBar = findLinkedInButtonBar();
      if (retryBar && !document.getElementById('profileai-li-topbtn')) {
        doInjectTopButton(retryBar);
      }
    }, 2000);
    return;
  }
  doInjectTopButton(bar);
}

function doInjectTopButton(bar: HTMLElement) {
  const btn = document.createElement('button');
  btn.id = 'profileai-li-topbtn';
  btn.className = 'profileai-li-topbtn';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5Z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    ProfileAI
  `;
  btn.title = 'Open ProfileAI side panel';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleOverlay();
  });
  bar.appendChild(btn);
}

function injectLinkedInMatchBanner() {
  const jobArea = findLinkedInJobDetailArea();
  if (!jobArea) {
    setTimeout(() => {
      const retry = findLinkedInJobDetailArea();
      if (retry && !document.getElementById('profileai-inline-banner')) {
        doInjectMatchBanner(retry);
      }
    }, 2000);
    return;
  }
  doInjectMatchBanner(jobArea);
}

function doInjectMatchBanner(jobArea: HTMLElement) {
  const banner = document.createElement('div');
  banner.id = 'profileai-inline-banner';

  banner.innerHTML = `
    <button class="profileai-inline-close" title="Dismiss">&times;</button>
    <div class="profileai-inline-score" data-label="—" style="--score-deg:0deg"></div>
    <div class="profileai-inline-info">
      <p class="profileai-inline-title">Resume Match</p>
      <p class="profileai-inline-sub">Click "Analyze" to check keyword match</p>
    </div>
    <div class="profileai-inline-actions">
      <button class="profileai-inline-btn secondary" data-action="analyze">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Analyze
      </button>
      <button class="profileai-inline-btn primary" data-action="tailor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Tailor Resume
      </button>
    </div>
  `;

  // Find the best insertion point. LinkedIn churns its class names often, so we
  // anchor by structure/text first and only fall back to class selectors.
  //
  // A "good" anchor is a wide, block-level element in the main job column. We
  // insert the banner as its next sibling so it spans the full column width.
  const insertAfter = (anchor: Element | null | undefined): boolean => {
    if (!anchor || !anchor.parentElement) return false;
    anchor.parentElement.insertBefore(banner, anchor.nextSibling);
    return true;
  };
  const insertBeforeEl = (anchor: Element | null | undefined): boolean => {
    if (!anchor || !anchor.parentElement) return false;
    anchor.parentElement.insertBefore(banner, anchor);
    return true;
  };

  // 1) Right after Simplify's banner (if present) — keep extensions grouped.
  const simplifyBanner = document.querySelector('[class*="simplify-banner"], [class*="simplify-jobs-shadow-root"], .simplify-banner');

  // 2) After LinkedIn's "Use AI to assess how you fit" / fit-level section.
  //    Match by class OR by the heading text so it survives class renames.
  let fitSection: Element | null = document.querySelector(
    '[class*="fit-level-preferences"], [class*="job-details-fit"], [class*="premium-upsell"], [class*="jobs-premium"]'
  );
  if (!fitSection) {
    const headings = Array.from(document.querySelectorAll('h2, h3, .t-16, .t-bold'));
    const fitHeading = headings.find(h => {
      const t = h.textContent?.trim().toLowerCase() || '';
      return t.includes('how you fit') || t.includes('assess how you');
    });
    // Use the nearest card/section wrapper so we land after the whole block.
    fitSection = fitHeading?.closest('section, [class*="card"], [class*="container"]') || fitHeading?.parentElement || null;
  }

  // 3) The unified top card (Apply/Save area).
  const topCard = document.querySelector(
    '.jobs-unified-top-card, .job-details-jobs-unified-top-card, [class*="jobs-unified-top-card"], .top-card-layout'
  );

  if (simplifyBanner && insertAfter(simplifyBanner)) {
    // done
  } else if (fitSection && insertAfter(fitSection)) {
    // done
  } else if (topCard && insertAfter(topCard)) {
    // done
  } else {
    // 4) Fallback: before the job description area.
    insertBeforeEl(jobArea);
  }

  // Wire up buttons
  const analyzeBtn = banner.querySelector('[data-action="analyze"]') as HTMLButtonElement;
  const tailorBtn = banner.querySelector('[data-action="tailor"]') as HTMLButtonElement;
  const closeBtn = banner.querySelector('.profileai-inline-close') as HTMLButtonElement;

  analyzeBtn?.addEventListener('click', () => handleInlineAnalyze(banner));
  tailorBtn?.addEventListener('click', () => handleInlineTailor());
  closeBtn?.addEventListener('click', () => {
    banner.remove();
    // Remember dismissal for this session
    sessionStorage.setItem('profileai-inline-dismissed', '1');
  });
}

async function handleInlineAnalyze(banner: HTMLElement) {
  if (inlineBannerState.analyzing) return;

  const jobInfo = getJobInfo();
  if (!jobInfo?.description) {
    showNotification('Could not extract job description');
    return;
  }

  inlineBannerState.analyzing = true;
  const analyzeBtn = banner.querySelector('[data-action="analyze"]') as HTMLButtonElement;
  if (analyzeBtn) {
    analyzeBtn.classList.add('loading');
    analyzeBtn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> Analyzing…`;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_KEYWORDS',
      data: { jobDescription: jobInfo.description },
    });

    if (response?.success && response?.keywords) {
      const kw = response.keywords;
      inlineBannerState.score = kw.matchScore ?? Math.round((kw.present.length / Math.max(kw.totalKeywords, 1)) * 100);
      inlineBannerState.present = kw.present || [];
      inlineBannerState.missing = kw.missing || [];
      updateBannerScore(banner);
    } else {
      showNotification(response?.error || 'Keyword analysis failed');
    }
  } catch (e) {
    showNotification('Analysis failed — please try again');
  } finally {
    inlineBannerState.analyzing = false;
    if (analyzeBtn) {
      analyzeBtn.classList.remove('loading');
      analyzeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Analyze`;
    }
  }
}

function updateBannerScore(banner: HTMLElement) {
  const score = inlineBannerState.score ?? 0;
  const present = inlineBannerState.present;
  const missing = inlineBannerState.missing;
  const total = present.length + missing.length;
  const deg = Math.round((score / 100) * 360);

  const scoreEl = banner.querySelector('.profileai-inline-score') as HTMLElement;
  const titleEl = banner.querySelector('.profileai-inline-title') as HTMLElement;
  const subEl = banner.querySelector('.profileai-inline-sub') as HTMLElement;

  if (scoreEl) {
    scoreEl.style.setProperty('--score-deg', `${deg}deg`);
    scoreEl.setAttribute('data-label', `${score}%`);
  }
  if (titleEl) titleEl.textContent = 'Resume Match';
  if (subEl) {
    const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
    subEl.innerHTML = `<span style="color:${color};font-weight:600">${present.length} of ${total} keywords</span> in your profile`;
  }
}

async function handleInlineTailor() {
  // Open the side panel overlay and trigger tailor from there
  toggleOverlay();
  // Give the iframe time to load, then send a message to trigger tailor
  setTimeout(async () => {
    const iframe = document.getElementById('profileai-overlay-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'TRIGGER_TAILOR_FROM_INLINE' }, '*');
    }
  }, 1500);
}

// Handle autofill
async function handleAutofill() {
  if (!profileData) {
    try {
      const profileResponse = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
      profileData = profileResponse?.profile;
    } catch (e) {
      console.log('[ProfileAI] Failed to get profile:', e);
    }
  }
  
  if (!profileData) {
    showNotification('Please login to ProfileAI first');
    openOverlay();
    return;
  }

  console.log('[ProfileAI] Autofilling form...');

  // Try to find a form on the page
  let form: Element | null = null;
  const formSelectors = [
    ...(currentSite ? [currentSite.formSelector] : []),
    // Workday-specific containers
    '[data-automation-id="jobApplicationContainer"]',
    '[data-automation-id="applyForm"]',
    '[data-automation-id="quickApplyContent"]',
    // Ashby embedded forms on company sites
    '[class*="ashby"]', '[id*="ashby"]', '[class*="Ashby"]',
    '[class*="application-form"]', '[class*="ApplicationForm"]',
    'form[action*="apply"]', 'form[action*="submit"]',
    '.application-form', '#application-form',
    '[class*="application"] form',
    '[class*="form-container"]', '[class*="application-form"]',
    '[role="form"]', '[data-testid*="form"]', '[data-testid*="application"]',
    'main form', 'form',
    'main', // last resort: use the main content area
  ];
  for (const selector of formSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.querySelectorAll('input, textarea, select').length > 1) {
        form = el;
        break;
      }
    } catch (_) {}
  }

  if (!form) {
    // Check if there's an "Apply" button to click first
    const applyButton = document.querySelector(
      'a[href*="apply"], button[class*="apply"], .apply-btn, [class*="ApplyButton"], a.postings-btn'
    );
    if (applyButton) {
      showNotification('Click the "Apply" button first, then try Autofill again!');
      (applyButton as HTMLElement).style.outline = '3px solid #7c3aed';
      (applyButton as HTMLElement).style.outlineOffset = '2px';
      setTimeout(() => {
        (applyButton as HTMLElement).style.outline = '';
        (applyButton as HTMLElement).style.outlineOffset = '';
      }, 3000);
      return;
    }
  }

  // Use the form container or fall back to the whole body
  const container = form || document.body;
  await fillForm(container);

  // If we used a specific form container (not document.body), also scan the full page
  // for radio groups, checkboxes, and EEO fields that might be outside the form
  if (container !== document.body) {
    console.log('[ProfileAI] Running second pass on document.body for fields outside the form...');
    await fillForm(document.body, true);
  }

  // Also try to fill forms inside same-origin iframes
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of Array.from(iframes)) {
    try {
      const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
      if (iframeDoc && iframeDoc.querySelectorAll('input, textarea, select').length > 0) {
        console.log('[ProfileAI] Found fillable inputs inside iframe, attempting autofill...');
        await fillForm(iframeDoc.body);
      }
    } catch (_) {
      // Cross-origin iframe — cannot access, skip
    }
  }

  // Watch for form step changes (multi-page forms) — auto-fill new fields
  startFormStepObserver();
}

// Track whether the form step observer is running
let formStepObserverActive = false;
let formStepObserver: MutationObserver | null = null;

function startFormStepObserver() {
  if (formStepObserverActive) return;
  formStepObserverActive = true;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFieldCount = document.querySelectorAll('input, textarea, select, [role="radio"], [role="radiogroup"], [role="button"], [role="option"]').length;

  formStepObserver = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      // Check if new form fields appeared (indicates a page/step change)
      const currentFields = document.querySelectorAll('input, textarea, select, [role="radio"], [role="radiogroup"], [role="button"], [role="option"]');
      const currentCount = currentFields.length;

      // Check for unfilled inputs
      const unfilledInputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]):not([readonly]):not([disabled])'
      );
      let hasEmptyFields = false;
      unfilledInputs.forEach(input => {
        const inp = input as HTMLInputElement;
        if (!inp.value?.trim() && inp.type !== 'radio' && inp.type !== 'checkbox') {
          hasEmptyFields = true;
        }
      });

      // If field count changed significantly, re-fill (limit retries to prevent infinite loop)
      const fieldCountChanged = Math.abs(currentCount - lastFieldCount) >= 2;
      if (fieldCountChanged && profileData && formStepRetryCount < MAX_FORM_STEP_RETRIES) {
        lastFieldCount = currentCount;
        formStepRetryCount++;
        console.log('[ProfileAI] Form step change detected, auto-filling new fields... (attempt', formStepRetryCount, '/', MAX_FORM_STEP_RETRIES, ')');
        await fillForm(document.body, true);
      }
    }, 800);
  });

  formStepObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[ProfileAI] Form step observer started');
}

// Resolve the label text for an input element
function getInputLabel(input: Element): string | null {
  // Method 0: Workday data-automation-id — convert to readable label
  const automationId = input.getAttribute('data-automation-id') ||
    input.closest('[data-automation-id]')?.getAttribute('data-automation-id') || '';
  if (automationId) {
    // Convert "legalNameSection_firstName" → "first name"
    const readable = automationId
      .replace(/Section_?/gi, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    if (readable.length > 2) return readable;
  }
  // Method 1: label[for] 
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent?.trim() || null;
  }
  // Method 2: aria-labelledby
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() || null;
  }
  // Method 3: parent <label>
  const parentLabel = input.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select').forEach((i) => i.remove());
    return clone.textContent?.trim() || null;
  }
  // Method 4: aria-describedby
  const describedBy = input.getAttribute('aria-describedby');
  if (describedBy) {
    const descEl = document.getElementById(describedBy);
    if (descEl) {
      const text = descEl.textContent?.trim() || '';
      if (text.length > 2 && text.length < 200) return text;
    }
  }
  // Method 5: container-based lookup (Lever, Greenhouse, Gem, Workday, etc.)
  const containerSelectors = [
    '.application-question', '.application-field', '.field', '.form-field',
    '.form-group', '.input-wrapper', '.postings-form__field', 'li',
    '[class*="field"]', '[class*="question"]', '.application-answer',
    '[class*="FormField"]', '[class*="form-row"]', '[class*="input-group"]',
    '[class*="form_field"]', '[class*="formField"]',
    '[data-automation-id]', // Workday
    'div[class]', // broad fallback — closest div with a class
  ];
  for (const sel of containerSelectors) {
    const container = input.closest(sel);
    if (container) {
      const labelEl = container.querySelector(
        'label, .label, legend, h3, h4, p, span, [class*="label"], [class*="question"], [class*="Label"], [class*="title"]'
      );
      if (labelEl && !labelEl.contains(input)) {
        const text = labelEl.textContent?.trim() || '';
        if (text.length > 2 && text.length < 200) return text;
      }
    }
  }
  // Method 6: previous sibling
  const prevSibling = input.previousElementSibling;
  if (prevSibling && ['LABEL', 'P', 'SPAN', 'DIV', 'H3', 'H4', 'H5'].includes(prevSibling.tagName)) {
    const text = prevSibling.textContent?.trim() || '';
    if (text.length > 0 && text.length < 200) return text;
  }
  // Method 7: parent's previous sibling
  const parentPrev = input.parentElement?.previousElementSibling;
  if (parentPrev && !parentPrev.querySelector('input, textarea, select')) {
    const text = parentPrev.textContent?.trim() || '';
    if (text.length > 2 && text.length < 150) return text;
  }
  // Method 8: walk up the DOM tree (max 4 levels) looking for text-bearing siblings
  let node: Element | null = input;
  for (let depth = 0; depth < 4 && node; depth++) {
    node = node.parentElement;
    if (!node) break;
    // Check all direct children that are text-bearing and don't contain the input
    for (const child of Array.from(node.children)) {
      if (child.contains(input)) continue;
      const tag = child.tagName;
      if (['LABEL', 'P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'LEGEND'].includes(tag)) {
        const text = child.textContent?.trim() || '';
        if (text.length > 2 && text.length < 150) return text;
      }
    }
  }
  return null;
}

function fillInput(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  // Strip characters that Workday and other ATS platforms reject: < > [ ] " { } \
  const sanitized = value.replace(/[<>\[\]"{}\\]/g, '');

  if (input.tagName === 'SELECT') {
    const select = input as HTMLSelectElement;
    const options = Array.from(select.options);
    const valueLower = sanitized.toLowerCase().trim();
    // Exact match first, then partial match
    let match = options.find(
      (opt) => opt.text.trim().toLowerCase() === valueLower || opt.value.toLowerCase() === valueLower
    );
    if (!match) {
      match = options.find(
        (opt) =>
          opt.text.toLowerCase().includes(valueLower) ||
          valueLower.includes(opt.text.toLowerCase().trim()) ||
          opt.value.toLowerCase().includes(valueLower)
      );
    }
    if (match) {
      // Use the native HTMLSelectElement value setter so React's controlled-component
      // shim (which redefines .value) doesn't swallow the assignment. This is required
      // for React-Hook-Form / Formik <Field as="select"> bindings to register the change.
      const selectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      if (selectSetter) selectSetter.call(select, match.value);
      else select.value = match.value;
    } else {
      return; // no matching option
    }
  } else {
    // Use native setter to bypass React's controlled input protection
    // React overrides the .value setter on controlled inputs, so direct assignment
    // is invisible to React's synthetic event system.
    const nativeSetter = input.tagName === 'TEXTAREA'
      ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, sanitized);
    } else {
      input.value = sanitized;
    }
  }
  // Event sequence ordered for React-Hook-Form / Formik compatibility:
  //   focus (mount field) → input (RHF onChange) → change (Formik/native) → blur (Formik touched).
  // `blur` MUST be last so Formik marks the field touched and runs validation; a later `focus`
  // would un-touch the field and Formik would suppress error rendering until next blur.
  try { (input as HTMLElement).focus({ preventScroll: true } as any); } catch (_) { input.focus(); }
  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  // Visual feedback
  (input as HTMLElement).style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.5)';
  setTimeout(() => { (input as HTMLElement).style.boxShadow = ''; }, 2000);
}

// Fill a radio button group by selecting the best matching option
function fillRadioGroup(radios: HTMLInputElement[], desiredValue: string) {
  const valueLower = desiredValue.toLowerCase().trim();
  console.log('[ProfileAI] fillRadioGroup: looking for "' + desiredValue + '" among', radios.length, 'radios');
  // Log all radio options for debugging
  radios.forEach((r, i) => {
    const lbl = getInputLabel(r)?.trim() || '';
    console.log('[ProfileAI]   radio[' + i + ']:', { label: lbl.substring(0, 60), value: r.value, checked: r.checked, name: r.name });
  });
  // Try exact label/value match first
  let target: HTMLInputElement | null = null;
  for (const radio of radios) {
    const radioLabel = getInputLabel(radio)?.toLowerCase().trim() || '';
    const radioValue = (radio.value || '').toLowerCase().trim();
    if (radioLabel === valueLower || radioValue === valueLower) {
      target = radio;
      break;
    }
  }
  // Then partial match
  if (!target) {
    for (const radio of radios) {
      const radioLabel = getInputLabel(radio)?.toLowerCase().trim() || '';
      const radioValue = (radio.value || '').toLowerCase().trim();
      if (radioLabel.includes(valueLower) || valueLower.includes(radioLabel) ||
          radioValue.includes(valueLower) || valueLower.includes(radioValue)) {
        target = radio;
        break;
      }
    }
  }
  // Fuzzy match: try matching individual words
  if (!target) {
    const desiredWords = valueLower.split(/\s+/).filter(w => w.length > 2);
    let bestMatch: HTMLInputElement | null = null;
    let bestScore = 0;
    for (const radio of radios) {
      const radioLabel = getInputLabel(radio)?.toLowerCase().trim() || '';
      const radioValue = (radio.value || '').toLowerCase().trim();
      const radioText = `${radioLabel} ${radioValue}`;
      let score = 0;
      for (const word of desiredWords) {
        if (radioText.includes(word)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = radio;
      }
    }
    if (bestScore > 0 && bestMatch) {
      target = bestMatch;
    }
  }
  if (target) {
    console.log('[ProfileAI] fillRadioGroup: MATCHED radio with label "' + (getInputLabel(target) || target.value || '').substring(0, 60) + '"');
    // For hidden native radios (Ashby, Radix), click the label or parent instead
    const labelFor = target.id ? document.querySelector(`label[for="${target.id}"]`) as HTMLElement : null;
    const parentLabel = target.closest('label') as HTMLElement;
    if (labelFor) {
      console.log('[ProfileAI] Clicking label[for]');
      labelFor.click();
    } else if (parentLabel && parentLabel !== target) {
      console.log('[ProfileAI] Clicking parent label');
      parentLabel.click();
    } else {
      console.log('[ProfileAI] Clicking radio directly');
      target.click();
    }
    // Ensure checked state
    if (!target.checked) {
      console.log('[ProfileAI] Radio not checked after click, setting manually');
      target.checked = true;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    console.log('[ProfileAI] Radio checked state:', target.checked);
    // Visual feedback on the container
    const ctr = target.closest('.application-question, .field, .form-group, [class*="field"], [class*="question"], li, fieldset, section, div') as HTMLElement;
    if (ctr) {
      ctr.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
      setTimeout(() => { ctr.style.boxShadow = ''; }, 2000);
    }
    return true;
  }
  console.log('[ProfileAI] fillRadioGroup: NO MATCH found for "' + desiredValue + '"');
  return false;
}

// Robustly commit a click on a dropdown option. Different libraries listen on
// different events: react-select needs mousedown, MUI/Radix listen on click,
// some custom listboxes only respond to pointerdown/up. We dispatch the full
// pointer + mouse + click sequence DIRECTLY on the option element (not a
// descendant — many options contain inline icon buttons that would absorb the
// click otherwise).
//
// IMPORTANT: do NOT fall back to a keyboard-Enter on the trigger if the click
// "appears to fail" — the menu's currently-highlighted option (often the first
// one alphabetically) is NOT what we want, and Enter would commit it. A failed
// click should leave the menu state alone so the AI fallback can retry cleanly.
function commitOptionClick(option: Element, trigger?: Element | null) {
  const target = option as HTMLElement;
  const optionText = (target.textContent || '').trim();

  // Detect react-select / Greenhouse Remix / similar typeahead-combobox widgets.
  // For these, clicking the option div is unreliable — react-select uses
  // onMouseDown+preventDefault on options and synthetic click events frequently
  // no-op (or worse: the click is treated as click-outside, closing the menu
  // without committing). The reliable path is to type the option text into the
  // visible search input and press Enter.
  if (trigger && optionText) {
    const wrapper = (trigger.closest('[class*="select-shell"], [class*="__container"], [class*="-container"]') || trigger) as HTMLElement;
    const searchInput = wrapper.querySelector('input.select__input, input.select-input, input[role="combobox"]') as HTMLInputElement | null;
    if (searchInput) {
      try {
        // Native setter so React's controlled-input plumbing fires onChange.
        const proto = Object.getPrototypeOf(searchInput);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        const setter = desc?.set;
        searchInput.focus();
        if (setter) setter.call(searchInput, optionText); else searchInput.value = optionText;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // After react-select filters, send Enter — it commits the focused option.
        // Wait long enough for the filter render to land (~120ms is reliable).
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            try {
              searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
              searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
            } catch (_) {}
            resolve();
          }, 140);
        }) as any;
      } catch (_) {}
    }
  }

  // Fallback: direct pointer + mouse + click on the option element. Catches MUI,
  // Radix, Headless UI, plain ARIA listboxes that don't expose a typeahead input.
  try { target.scrollIntoView({ block: 'nearest' }); } catch (_) {}
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init: PointerEventInit = {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: 1,
    pointerId: 1, pointerType: 'mouse', isPrimary: true,
  };
  try { target.dispatchEvent(new PointerEvent('pointerover', init)); } catch (_) {}
  target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, clientX: x, clientY: y }));
  try { target.dispatchEvent(new PointerEvent('pointerdown', init)); } catch (_) {}
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  try { target.dispatchEvent(new PointerEvent('pointerup', init)); } catch (_) {}
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  try { target.click(); } catch (_) {}
}

// Open a custom dropdown reliably across react-select / Greenhouse Remix / MUI /
// Radix / Headless UI patterns. The wrapper trigger we have a handle on is
// often a `<div class="select-shell">` or `<div class="*__container">` that
// itself does NOT receive the open event; the real listener lives on a child
// `*__control`, the embedded `<input class="select__input">`, or the wrapper's
// only child div. Dispatching ONLY on the wrapper misses these libraries.
//
// Strategy: pick the best inner click target, then dispatch a full pointer +
// mouse sequence on it (with viewport-correct coords + buttons + pointerType)
// so the library's click-outside detector treats it as a real user gesture.
function openCustomDropdown(trigger: Element): HTMLElement {
  const wrapper = trigger as HTMLElement;
  // Pick the inner element libraries actually listen on, in order of preference.
  const inner = (
    wrapper.querySelector('[class*="__control"]') ||
    wrapper.querySelector('[class*="-control"]') ||
    wrapper.querySelector('input.select__input, input.select-input') ||
    wrapper.querySelector('[role="combobox"]') ||
    wrapper.querySelector('[role="button"]') ||
    wrapper
  ) as HTMLElement;
  try { inner.scrollIntoView({ block: 'center' }); } catch (_) {}
  try { (inner as HTMLElement).focus({ preventScroll: true }); } catch (_) {}
  const rect = inner.getBoundingClientRect();
  const x = rect.left + Math.min(rect.width / 2, 30);
  const y = rect.top + Math.min(rect.height / 2, 15);
  const init: PointerEventInit = {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: 1,
    pointerId: 1, pointerType: 'mouse', isPrimary: true,
  };
  try { inner.dispatchEvent(new PointerEvent('pointerover', init)); } catch (_) {}
  inner.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  inner.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, clientX: x, clientY: y }));
  try { inner.dispatchEvent(new PointerEvent('pointerdown', init)); } catch (_) {}
  inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  try { inner.dispatchEvent(new PointerEvent('pointerup', init)); } catch (_) {}
  inner.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  inner.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  // Some libraries open on .click() only (Headless UI button patterns).
  try { inner.click(); } catch (_) {}
  return inner;
}

function closeCustomDropdown(trigger: Element) {
  try {
    document.body.click();
    (trigger as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  } catch (_) {}
}

// Smart dropdown selection — pick the best option based on question context
const US_STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la',
  'me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok',
  'or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc','pr'
]);
const US_STATE_NAMES = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware',
  'florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky',
  'louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi',
  'missouri','montana','nebraska','nevada','new hampshire','new jersey','new mexico',
  'new york','north carolina','north dakota','ohio','oklahoma','oregon','pennsylvania',
  'rhode island','south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming','district of columbia'
]);

// Map a free-text profile location to the canonical country name we should select.
// Critical: "San Francisco, CA" must map to "United States", NOT "CA" (which would
// then partial-match "AmeriCAn Samoa" inside a country dropdown).
function locationToCountryName(location: string | null | undefined): string {
  if (!location) return 'United States';
  const parts = location.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return 'United States';
  const last = parts[parts.length - 1].toLowerCase();
  if (US_STATE_CODES.has(last) || US_STATE_NAMES.has(last)) return 'United States';
  if (last === 'usa' || last === 'us' || last === 'u.s.' || last === 'u.s.a.' || last.includes('united states') || last.includes('america')) return 'United States';
  if (last.includes('canada')) return 'Canada';
  if (last.includes('united kingdom') || last === 'uk' || last === 'u.k.' || last.includes('britain') || last.includes('england') || last.includes('scotland') || last.includes('wales')) return 'United Kingdom';
  if (last.includes('india')) return 'India';
  if (last.includes('germany') || last.includes('deutsch')) return 'Germany';
  if (last.includes('australia')) return 'Australia';
  if (last.includes('france')) return 'France';
  if (last.includes('ireland')) return 'Ireland';
  if (last.includes('netherlands') || last.includes('holland')) return 'Netherlands';
  // Fallback: only trust the last part if it's plausibly a country (>= 4 chars and not a state)
  return last.length >= 4 ? parts[parts.length - 1] : 'United States';
}

function fillSelectSmart(select: HTMLSelectElement, questionLabel: string, profile: any): boolean {
  const q = questionLabel.toLowerCase();
  const options = Array.from(select.options).filter(o => o.value && o.value !== '' && o.text.trim() !== '');
  if (options.length === 0) return false;

  let bestValue = '';

  // Gender
  if (q.includes('gender')) {
    bestValue = 'Prefer not to say';
  }
  // Ethnicity / Race / Hispanic / Latino
  else if (q.includes('ethnicity') || q.includes('race') || q.includes('demographic') || q.includes('hispanic') || q.includes('latino')) {
    bestValue = 'Prefer not to say';
  }
  // Veteran status
  else if (q.includes('veteran')) {
    bestValue = 'Prefer not to say';
  }
  // Disability
  else if (q.includes('disability') || q.includes('handicap')) {
    bestValue = 'Prefer not to say';
  }
  // Education / Highest degree
  else if (q.includes('education') || q.includes('degree') || q.includes('highest level')) {
    const education = profile?.education;
    if (education && Array.isArray(education) && education.length > 0) {
      const deg = (education[0].degree || education[0].level || '').toLowerCase();
      if (deg.includes('phd') || deg.includes('doctor')) bestValue = 'Doctorate';
      else if (deg.includes('master') || deg.includes('mba') || deg.includes('ms ') || deg.includes('m.s')) bestValue = "Master";
      else if (deg.includes('bachelor') || deg.includes('bs ') || deg.includes('b.s') || deg.includes('ba ')) bestValue = "Bachelor";
      else if (deg.includes('associate')) bestValue = 'Associate';
      else bestValue = "Bachelor";
    } else {
      bestValue = "Bachelor";
    }
  }
  // Years of experience
  else if (q.includes('years') && (q.includes('experience') || q.includes('relevant'))) {
    let years = 5;
    if (profile?.experience && Array.isArray(profile.experience)) {
      years = Math.min(profile.experience.length * 2, 15);
    }
    // Try to find the best range option
    for (const opt of options) {
      const optText = opt.text.toLowerCase();
      const match = optText.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num <= years) bestValue = opt.text; // keep the highest that fits
      }
    }
    if (!bestValue) bestValue = years.toString();
  }
  // How did you hear
  else if (q.includes('hear') || q.includes('how did you find') || q.includes('source') || q.includes('referral source')) {
    const preferred = ['online', 'job board', 'linkedin', 'internet', 'website', 'other'];
    for (const pref of preferred) {
      const match = options.find(o => o.text.toLowerCase().includes(pref));
      if (match) { bestValue = match.text; break; }
    }
  }
  // Visa / work authorization
  else if (q.includes('authorized') || q.includes('work authorization') || q.includes('eligible')) {
    bestValue = 'Yes';
  }
  else if (q.includes('visa') || q.includes('sponsorship')) {
    bestValue = 'No';
  }
  // Location preference
  else if (q.includes('willing to relocate') || q.includes('relocate')) {
    bestValue = 'Yes';
  }
  // Start date / availability
  else if (q.includes('start') || q.includes('available') || q.includes('notice')) {
    const preferred = ['2 weeks', 'two weeks', 'immediately', '1 month', 'within'];
    for (const pref of preferred) {
      const match = options.find(o => o.text.toLowerCase().includes(pref));
      if (match) { bestValue = match.text; break; }
    }
  }
  // Country
  else if (q.includes('country') && !q.includes('county')) {
    const target = locationToCountryName(profile?.location).toLowerCase();
    // Prefer exact match, then word-boundary, then includes (only for long targets)
    let match = options.find(o => o.text.trim().toLowerCase() === target);
    if (!match) {
      const wb = new RegExp('(^|[^a-z])' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i');
      match = options.find(o => wb.test(o.text));
    }
    if (!match && target.length >= 5) {
      match = options.find(o => o.text.toLowerCase().includes(target));
    }
    if (match) bestValue = match.text;
  }
  // State / Province
  else if (q.includes('state') || q.includes('province') || q.includes('region')) {
    const locParts = (profile?.location || '').split(',').map((s: string) => s.trim().toLowerCase());
    for (const part of locParts) {
      if (part.length < 2) continue;
      const match = options.find(o => o.text.toLowerCase().includes(part) || part.includes(o.text.toLowerCase()));
      if (match) { bestValue = match.text; break; }
    }
  }
  // Salary range / expectations
  else if (q.includes('salary') || q.includes('compensation') || q.includes('pay range')) {
    const preferred = ['open', 'prefer not', 'negotiable', 'competitive'];
    for (const pref of preferred) {
      const match = options.find(o => o.text.toLowerCase().includes(pref));
      if (match) { bestValue = match.text; break; }
    }
    // If no neutral option, default to a mid-range option
    if (!bestValue && options.length > 2) {
      bestValue = options[Math.floor(options.length / 2)].text;
    }
  }
  // Language proficiency
  else if (q.includes('language') || q.includes('proficiency level') || q.includes('fluency')) {
    const preferred = ['fluent', 'native', 'advanced', 'proficient', 'professional'];
    for (const pref of preferred) {
      const match = options.find(o => o.text.toLowerCase().includes(pref));
      if (match) { bestValue = match.text; break; }
    }
  }
  // Employment type preference
  else if (q.includes('employment type') || q.includes('job type') || q.includes('position type')) {
    const preferred = ['full-time', 'full time', 'permanent'];
    for (const pref of preferred) {
      const match = options.find(o => o.text.toLowerCase().includes(pref));
      if (match) { bestValue = match.text; break; }
    }
  }
  // Experience level / seniority
  else if (q.includes('experience level') || q.includes('seniority') || q.includes('career level')) {
    const expCount = profile?.experience?.length || 0;
    let target = 'mid';
    if (expCount >= 5) target = 'senior';
    else if (expCount <= 1) target = 'entry';
    const match = options.find(o => o.text.toLowerCase().includes(target));
    if (match) bestValue = match.text;
  }

  if (!bestValue) return false;

  // Find the best matching option
  const bvLower = bestValue.toLowerCase();
  let match = options.find(o => o.text.trim().toLowerCase() === bvLower);
  if (!match) {
    match = options.find(o =>
      o.text.toLowerCase().includes(bvLower) || bvLower.includes(o.text.toLowerCase().trim())
    );
  }
  if (match) {
    select.value = match.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.dispatchEvent(new Event('blur', { bubbles: true }));
    (select as HTMLElement).style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.5)';
    setTimeout(() => { (select as HTMLElement).style.boxShadow = ''; }, 2000);
    return true;
  }
  return false;
}

// Smart text value lookup by question label (for fields not matched by field mappings)
function getSmartTextValue(questionLabel: string, profile: any): string | null {
  if (!questionLabel || !profile) return null;
  const q = questionLabel.toLowerCase();

  // LinkedIn profile / URL
  if (q.includes('linkedin profile') || q.includes('linkedin url') || q.includes('linkedin link')) {
    return profile.linkedinUrl || null;
  }
  // GitHub profile / URL
  if (q.includes('github profile') || q.includes('github url') || q.includes('github link')) {
    return profile.githubUrl || null;
  }
  // Portfolio / personal website
  if (q.includes('portfolio') || q.includes('personal website') || q.includes('personal url') || q.includes('personal site')) {
    return profile.portfolioUrl || null;
  }
  // Current company
  if (q.includes('current company') || q.includes('current employer') || q.includes('company name')) {
    if (profile.experience && Array.isArray(profile.experience) && profile.experience.length > 0) {
      return profile.experience[0].company || profile.experience[0].organization || null;
    }
  }
  // Current / legal address
  if (q.includes('address') || q.includes('legal address') || q.includes('street')) {
    return profile.location || null;
  }
  // Salary expectations
  if (q.includes('salary') || q.includes('compensation') || q.includes('pay expectation')) {
    return 'Open to discussion based on the full compensation package';
  }
  // Start date — ONLY for free-text date questions, not month/year picker subfields.
  // (e.g. Greenhouse splits employment dates into separate "Start date month" / "year"
  // dropdowns; typing "Two weeks notice - flexible" into them is the bug from screenshots.)
  if ((q.includes('start date') || q.includes('earliest start') || q.includes('available to start'))
      && !q.includes('month') && !q.includes('year') && !q.includes('day')) {
    return 'Two weeks notice - flexible';
  }
  // Referred by
  if (q.includes('referred') || q.includes('referral')) {
    // Only return free-text "N/A" for open text questions. Greenhouse-style yes/no
    // dropdowns rarely have an "N/A" option; let the dropdown handler pick "No" instead.
    if (q.includes('?') || q.startsWith('were you') || q.startsWith('have you') || q.startsWith('did you')) return null;
    return 'N/A';
  }
  // How did you hear about this / find out about
  if (q.includes('hear about') || q.includes('how did you find') || q.includes('where did you find') || q.includes('how did you learn') || q.includes('find out about')) {
    return 'LinkedIn';
  }
  // Relocation timeline
  if (q.includes('relocation timeline') || q.includes('relocating') || q.includes('relocation') || q.includes('when can you start')) {
    return 'I am based in the area and available to start within two weeks';
  }
  // Cover letter / why interested
  if (q.includes('cover letter') || q.includes('why are you interested') || q.includes('why do you want')) {
    const skills = profile.skills ? Object.values(profile.skills).flat().slice(0, 5).join(', ') : '';
    return `This role caught my attention because it connects well with my background in ${skills || 'software engineering'}. ${(profile.summary || '').substring(0, 300)}`;
  }
  // Notice period
  if (q.includes('notice period')) {
    return 'Two weeks';
  }
  // Full name (single "name" field)
  if ((q === 'name' || q === 'full name' || q === 'your name' || q === 'candidate name') && profile.firstName) {
    return `${profile.firstName} ${profile.lastName || ''}`.trim();
  }
  // First name
  if (q === 'first name' || q.includes('first name') || q.includes('given name')) {
    return profile.firstName || null;
  }
  // Last name
  if (q === 'last name' || q.includes('last name') || q.includes('surname') || q.includes('family name')) {
    return profile.lastName || null;
  }
  // Email
  if (q === 'email' || q.includes('email address') || q.includes('your email') || q.includes('e-mail')) {
    return profile.email || null;
  }
  // Phone
  if (q === 'phone' || q.includes('phone number') || q.includes('mobile') || q.includes('contact number')) {
    return profile.phone || null;
  }
  // Location / city — ONLY for clearly location-shaped questions. Avoid matching
  // demographic/yes-no questions that happen to contain the word "based" or "city"
  // (e.g. "Are you Hispanic/Latino?" must NOT receive the user's location).
  const isQuestionShaped = q.includes('?') || q.startsWith('are you') || q.startsWith('do you') || q.startsWith('have you') || q.startsWith('will you') || q.startsWith('did you');
  if (!isQuestionShaped && (
    q === 'location' || q === 'city' ||
    q.includes('current location') || q.includes('your location') ||
    q.includes('current city') || q.includes('which city') ||
    q.includes('where are you based') || q.includes('where do you live')
  )) {
    return profile.location || null;
  }

  return null;
}

// Fill checkbox groups based on question context and profile data
function fillCheckboxes(container: Element, profile: any): number {
  let filled = 0;

  // Find all unchecked checkboxes — both native and ARIA custom checkboxes
  const nativeCheckboxes = Array.from(
    container.querySelectorAll('input[type="checkbox"]:not([disabled]):not(:checked)')
  ) as HTMLInputElement[];

  // Also find ARIA role="checkbox" elements (Ashby, Radix, custom ATS)
  const ariaCheckboxes = Array.from(
    container.querySelectorAll('[role="checkbox"]:not([aria-checked="true"]):not([data-state="checked"]):not([disabled])')
  ) as HTMLElement[];

  // Handle ARIA checkboxes first (custom components)
  ariaCheckboxes.forEach((checkbox) => {
    const style = window.getComputedStyle(checkbox);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (checkbox.offsetHeight === 0 && checkbox.offsetWidth === 0) return;

    // Get the label for this custom checkbox
    let label = '';
    const ariaLabelledBy = checkbox.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) label = (labelEl.textContent || '').trim().toLowerCase();
    }
    if (!label) label = (checkbox.getAttribute('aria-label') || '').toLowerCase();
    if (!label) {
      // Check parent/sibling for label text
      const parent = checkbox.closest('label, [class*="field"], [class*="checkbox"], [class*="Checkbox"], div, li');
      if (parent) {
        label = (parent.textContent || '').trim().toLowerCase();
      }
    }
    if (!label) {
      const nextSibling = checkbox.nextElementSibling;
      if (nextSibling) label = (nextSibling.textContent || '').trim().toLowerCase();
    }

    let shouldCheck = false;
    if (label.includes('confirm') || label.includes('agree') || label.includes('consent') ||
        label.includes('acknowledge') || label.includes('terms') || label.includes('accept') ||
        label.includes('certify') || label.includes('understand') || label.includes('read the above') ||
        label.includes('i have read') || label.includes('privacy policy')) {
      shouldCheck = true;
    } else if (label.includes('authorized to work') || label.includes('background check') || label.includes('legally eligible')) {
      shouldCheck = true;
    } else if (label.includes('contact me') || label.includes('notify me')) {
      shouldCheck = true;
    }

    if (shouldCheck) {
      checkbox.click();
      filled++;
      console.log('[ProfileAI] ✓ Checked ARIA checkbox:', label.substring(0, 50));
      const parentEl = checkbox.closest('[class*="field"], [class*="question"], [class*="checkbox"], .form-group, li, fieldset') as HTMLElement;
      if (parentEl) {
        parentEl.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
        setTimeout(() => { parentEl.style.boxShadow = ''; }, 2000);
      }
    }
  });

  const checkboxes = nativeCheckboxes;

  checkboxes.forEach((checkbox) => {
    // Get the label/question for this checkbox
    const label = getInputLabel(checkbox)?.toLowerCase() || '';
    const value = (checkbox.value || '').toLowerCase();
    const name = (checkbox.name || '').toLowerCase();

    // Skip if the parent container is not visible (but not the checkbox itself,
    // since ATS frameworks often visually hide the native input while showing a styled indicator)
    const parentContainer = checkbox.closest('label, [class*="checkbox"], [class*="field"], li, div') as HTMLElement;
    if (parentContainer) {
      const parentStyle = window.getComputedStyle(parentContainer);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') return;
    } else {
      const style = window.getComputedStyle(checkbox);
      if (style.display === 'none' || style.visibility === 'hidden') return;
    }

    // Get the parent question context (for grouped checkboxes)
    let groupQuestion = '';
    const fieldsetEl = checkbox.closest('fieldset');
    if (fieldsetEl) {
      const legend = fieldsetEl.querySelector('legend');
      if (legend) groupQuestion = (legend.textContent || '').trim().toLowerCase();
    }
    if (!groupQuestion) {
      const containerSelectors = [
        '.application-question', '.field', '.form-group', '[class*="field"]',
        '[class*="question"]', 'li', '.postings-form__field', 'fieldset',
      ];
      for (const sel of containerSelectors) {
        const parentContainer = checkbox.closest(sel);
        if (parentContainer) {
          const labelEl = parentContainer.querySelector(
            'label:not([for]), .label, legend, h3, h4, p, span, [class*="label"], [class*="question"]'
          );
          if (labelEl && !labelEl.contains(checkbox)) {
            groupQuestion = (labelEl.textContent || '').trim().toLowerCase();
            if (groupQuestion) break;
          }
        }
      }
    }

    const context = `${label} ${value} ${name} ${groupQuestion}`;
    let shouldCheck = false;

    // Agreement / Terms / Consent checkboxes — always check
    if (context.includes('agree') || context.includes('consent') || context.includes('acknowledge') ||
        context.includes('terms') || context.includes('privacy policy') || context.includes('accept') ||
        context.includes('i confirm') || context.includes('i certify') || context.includes('i understand')) {
      shouldCheck = true;
    }
    // Opt-in for emails / communication (check by default for job-related)
    else if (context.includes('contact me') || context.includes('notify me') || context.includes('updates about')) {
      shouldCheck = true;
    }
    // Work authorization confirmations
    else if (context.includes('authorized to work') || context.includes('legally eligible') ||
             context.includes('right to work') || context.includes('background check')) {
      shouldCheck = true;
    }
    // Skills selection checkboxes — check if the skill is in the user's profile
    else if (groupQuestion.includes('skill') || groupQuestion.includes('technolog') ||
             groupQuestion.includes('proficien') || groupQuestion.includes('experience with') ||
             groupQuestion.includes('familiar with') || groupQuestion.includes('knowledge of')) {
      const profileSkills = profile?.skills
        ? (Array.isArray(profile.skills)
            ? profile.skills
            : Object.values(profile.skills).flat())
          .map((s: any) => (typeof s === 'string' ? s : s?.name || '').toLowerCase())
        : [];
      const checkboxSkill = (label || value).toLowerCase();
      if (profileSkills.some((s: string) => checkboxSkill.includes(s) || s.includes(checkboxSkill))) {
        shouldCheck = true;
      }
    }
    // Work type preference checkboxes (remote, hybrid, on-site)
    else if (context.includes('remote') || context.includes('hybrid') || context.includes('on-site') ||
             context.includes('onsite') || context.includes('work arrangement')) {
      // Check all work arrangement options by default (flexible)
      shouldCheck = true;
    }

    if (shouldCheck) {
      // For visually hidden native checkboxes (Ashby, Radix), click the label or parent instead
      const labelFor = checkbox.id ? document.querySelector(`label[for="${checkbox.id}"]`) as HTMLElement : null;
      const parentLabel = checkbox.closest('label') as HTMLElement;
      if (labelFor) {
        labelFor.click();
      } else if (parentLabel) {
        parentLabel.click();
      } else {
        checkbox.click();
      }
      // Ensure the checked state is set
      if (!checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      filled++;
      console.log('[ProfileAI] ✓ Checked checkbox:', (label || value || name).substring(0, 50));
      // Visual feedback
      const parentEl = checkbox.closest('.application-question, .field, .form-group, [class*="field"], [class*="question"], li, fieldset') as HTMLElement;
      if (parentEl) {
        parentEl.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
        setTimeout(() => { parentEl.style.boxShadow = ''; }, 2000);
      }
    }
  });

  return filled;
}

// Fill custom dropdown widgets (React Select, Listbox, Combobox)
type AiDropdownCandidate = {
  question: string;
  selectEl: Element;
  options: Array<{ text: string; el?: Element }>;
};

// After the rule-based pass runs, scan the page for ANY custom dropdown that's
// still unfilled. Greenhouse v2 / Lever / Ashby render select-like widgets in
// many shapes; this catch-all sweep pairs each unfilled trigger with its label
// and an option-list snapshot, ready for the AI batch call.
async function collectUnfilledCustomDropdowns(
  container: Element,
  alreadyQueued: AiDropdownCandidate[]
): Promise<AiDropdownCandidate[]> {
  const queued = new Set(alreadyQueued.map((c) => c.selectEl));
  const triggers = Array.from(container.querySelectorAll(
    'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], button[aria-haspopup="true"], ' +
    '[role="combobox"], [role="listbox"], [class*="react-select"], [class*="Select__control"], ' +
    '[class*="select-shell"], [class*="select-trigger"]'
  )).filter((t) => {
    if (queued.has(t)) return false;
    const r = (t as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    // Already has a non-placeholder value?
    const sv = t.querySelector('[class*="singleValue"], [class*="selected"], [aria-selected="true"]');
    if (sv && (sv.textContent || '').trim()) return false;
    // Or the trigger's own visible text isn't the placeholder ("Select...", "Choose...")
    const text = ((t as HTMLElement).innerText || '').trim().toLowerCase();
    if (text && !text.startsWith('select') && !text.startsWith('choose') && !text.startsWith('—')) {
      // For phone-country pickers the visible text is just "+1" — still treat as filled.
      if (/^\+?\d/.test(text)) return false;
    }
    return true;
  });

  const out: AiDropdownCandidate[] = [];
  for (const trig of triggers) {
    const question = extractDropdownLabel(trig);
    if (!question) continue;
    // Open and snapshot options.
    try {
      openCustomDropdown(trig);
      await new Promise((r) => setTimeout(r, 320));
      const opts = Array.from(document.querySelectorAll(
        '[role="option"], [class*="option" i]:not([class*="OptionContainer"]), [class*="menu" i] li, [class*="listbox" i] li'
      )).filter((o) => {
        const r = o.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const snapshot = opts.map((o) => ({ text: (o.textContent || '').trim() })).filter(o => o.text);
      // Close the menu before moving on.
      closeCustomDropdown(trig);
      if (snapshot.length > 0) {
        out.push({ question, selectEl: trig, options: snapshot });
      } else {
        // No options rendered — likely a free-text combobox. Treat as a free-text
        // AI question with no options.
        out.push({ question, selectEl: trig, options: [] });
      }
    } catch (_) {}
  }
  return out;
}

// Extract a human-readable label for a custom dropdown trigger. Mirrors the
// label-discovery cascade inside fillCustomDropdowns().
function extractDropdownLabel(trigger: Element): string {
  let q = '';
  const fieldGroup = trigger.closest(
    '[class*="field"], [class*="question"], [class*="form-row"], [class*="FormRow"], ' +
    '[class*="input-wrapper"], [class*="InputWrapper"], .form-group, fieldset, [role="group"]'
  );
  if (fieldGroup) {
    const qLabel = fieldGroup.querySelector('label, legend, [class*="label"], [class*="Label"], h3, h4');
    if (qLabel && !qLabel.contains(trigger)) q = (qLabel.textContent || '').trim();
  }
  if (!q) q = trigger.getAttribute('aria-label') || '';
  if (!q) {
    const labelledBy = trigger.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/);
      q = ids.map((id) => document.getElementById(id)?.textContent?.trim() || '').filter(Boolean).join(' ');
    }
  }
  return q;
}

function fillCustomDropdowns(container: Element, profile: any, skipped?: string[], aiPending?: AiDropdownCandidate[]): number {
  let filled = 0;

  // Find custom dropdown triggers (React Select, Headless UI Listbox, custom comboboxes,
  // Greenhouse v2 phone-country pickers, Radix popovers, etc.).
  const customSelects = container.querySelectorAll(
    '[role="listbox"], [role="combobox"], [class*="react-select"], [class*="Select__control"], ' +
    '[class*="dropdown"][aria-haspopup], [aria-expanded], [data-testid*="select"], ' +
    '[class*="Dropdown"][class*="trigger"], [class*="listbox"], ' +
    'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], button[aria-haspopup="true"], ' +
    '[role="button"][aria-haspopup], [class*="select-shell"], [class*="select-trigger"]'
  );

  // De-duplicate: a single dropdown often matches several of the selectors above.
  const seen = new Set<Element>();

  customSelects.forEach((selectEl) => {
    if (seen.has(selectEl)) return;
    seen.add(selectEl);
    // Skip if already has a selected value (non-placeholder)
    const currentValue = selectEl.querySelector('[class*="singleValue"], [class*="selected"], [aria-selected="true"]');
    if (currentValue && currentValue.textContent?.trim()) return;

    // Get the question label. Greenhouse v2 / Lever / many ATS use a floating label
    // that lives INSIDE the trigger element (or as a sibling above it), not in a
    // labelled ancestor. Cascade through several strategies before giving up.
    let question = '';
    // 1) closest container that has a label/legend describing the field
    const labelEl = selectEl.closest(
      '[class*="field"], [class*="question"], [class*="form-row"], [class*="FormRow"], ' +
      '[class*="input-wrapper"], [class*="InputWrapper"], .form-group, fieldset, [role="group"]'
    );
    if (labelEl) {
      const qLabel = labelEl.querySelector(
        'label, legend, [class*="label"], [class*="Label"], h3, h4, p, span'
      );
      if (qLabel && !qLabel.contains(selectEl)) {
        question = (qLabel.textContent || '').trim();
      }
    }
    // 2) aria-label / aria-labelledby on the trigger itself
    if (!question) question = selectEl.getAttribute('aria-label') || '';
    if (!question) {
      const labelledBy = selectEl.getAttribute('aria-labelledby');
      if (labelledBy) {
        const ids = labelledBy.split(/\s+/);
        question = ids.map(id => document.getElementById(id)?.textContent?.trim() || '').filter(Boolean).join(' ');
      }
    }
    // 3) Greenhouse v2 floating label: <label> sibling immediately above the trigger
    if (!question) {
      const parent = selectEl.parentElement;
      const sibLabel = parent?.querySelector(':scope > label, :scope > [class*="label" i]');
      if (sibLabel && !sibLabel.contains(selectEl)) question = (sibLabel.textContent || '').trim();
    }
    // 4) Phone-country-picker heuristic: if the trigger sits next to an input[type=tel]
    //    and we still have no question, force-treat it as the Country field.
    if (!question) {
      const fieldGroup = selectEl.closest('[class*="field"], [class*="form-row"], [class*="input-wrapper"], div');
      if (fieldGroup && fieldGroup.querySelector('input[type="tel"]')) {
        question = 'Country';
      }
    }
    if (!question) return;

    const q = question.toLowerCase();

    // Determine the desired value based on question context.
    // ORDER MATTERS: more specific patterns must come before generic ones (e.g. "hispanic"
    // before "country", and yes/no patterns before any free-text fallback).
    let desiredValue = '';
    if (q.includes('gender')) desiredValue = 'Prefer not to say';
    else if (q.includes('ethnicity') || q.includes('race') || q.includes('hispanic') || q.includes('latino')) desiredValue = 'Prefer not to say';
    else if (q.includes('veteran')) desiredValue = 'Prefer not to say';
    else if (q.includes('disability')) desiredValue = 'Prefer not to say';
    else if (q.includes('education') || q.includes('degree')) {
      const education = profile?.education;
      if (education && Array.isArray(education) && education.length > 0) {
        const deg = (education[0].degree || education[0].level || '').toLowerCase();
        if (deg.includes('phd') || deg.includes('doctor')) desiredValue = 'Doctorate';
        else if (deg.includes('master')) desiredValue = "Master";
        else if (deg.includes('bachelor')) desiredValue = "Bachelor";
        else desiredValue = "Bachelor";
      } else desiredValue = "Bachelor";
    }
    else if (q.includes('country')) desiredValue = locationToCountryName(profile?.location);
    else if (q.includes('state') || q.includes('province')) {
      const parts = (profile?.location || '').split(',');
      desiredValue = parts.length > 1 ? parts[parts.length - 2].trim() : '';
    }
    else if (q.includes('authorized') || q.includes('eligible')) desiredValue = 'Yes';
    else if (q.includes('visa') || q.includes('sponsorship')) desiredValue = 'No';
    else if (q.includes('hear') || q.includes('how did you find') || q.includes('source')) desiredValue = 'Online';
    // Compliance / screening yes-no patterns (Greenhouse / Coinbase-style). Default to "No"
    // because these are almost always negative-by-default declarations.
    else if (q.includes('government official') || q.includes('government agency')) desiredValue = 'No';
    else if (q.includes('conflict of interest') || q.includes('financial interest')) desiredValue = 'No';
    else if (q.includes('referred by') || (q.includes('referred') && q.includes('?'))) desiredValue = 'No';
    // Confirm/agree/acknowledge declarations (e.g. "Please confirm receipt of Privacy Notice").
    else if (q.includes('confirm') || q.includes('acknowledge') || q.includes('agree to') || q.includes('consent')) desiredValue = 'Yes';

    if (!desiredValue) {
      // Rule-based pass has no opinion. Queue for AI fallback so the model can
      // pick the right option. Open the menu first so we can snapshot options.
      if (aiPending) {
        try {
          openCustomDropdown(selectEl);
          setTimeout(() => {
            const opts = Array.from(document.querySelectorAll(
              '[role="option"], [class*="option" i]:not([class*="OptionContainer"]), [class*="menu" i] li, [class*="listbox" i] li'
            )).filter(o => {
              const r = o.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            const snapshot = opts.map((o) => ({ text: (o.textContent || '').trim(), el: o })).filter(o => o.text);
            if (snapshot.length) aiPending.push({ question, selectEl, options: snapshot });
            closeCustomDropdown(selectEl);
          }, 380);
        } catch (_) {}
      }
      return;
    }

    // Try to interact with the custom dropdown
    try {
      // Click to open with the cross-library helper that targets the inner control.
      openCustomDropdown(selectEl);

      // Progressive retry: portals/Vue/Svelte often render options >300ms after click.
      // Poll at 250 / 600 / 1200 ms before giving up.
      const optionSelectors = [
        '[role="option"]', '[role="listbox"] [role="option"]',
        '[class*="option"]:not([class*="optionContainer"])', '[class*="Option"]:not([class*="OptionContainer"])',
        '[class*="menu"] li', '[class*="Menu"] li', '[class*="Menu"] div[tabindex]',
        '[class*="dropdown"] li', '[class*="Dropdown"] li',
        '[class*="listbox"] li', '[class*="Listbox"] li',
        '[data-value]', '[data-option]',
      ];

      const findOptions = (): Element[] => {
        for (const sel of optionSelectors) {
          try {
            const opts = Array.from(document.querySelectorAll(sel)).filter(opt => {
              const rect = opt.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            if (opts.length > 0) return opts;
          } catch (_) { /* skip invalid selector */ }
        }
        return [];
      };

      const desiredLower = desiredValue.toLowerCase();
      const tryMatchAndClick = (delays: number[]): void => {
        if (delays.length === 0) {
          // Exhausted retries: close dropdown without selecting anything
          console.log('[ProfileAI] No options rendered for custom dropdown "' + question.substring(0, 30) + '" after retries, closing');
          closeCustomDropdown(selectEl);
          if (skipped) skipped.push(question);
          return;
        }
        const [delay, ...rest] = delays;
        setTimeout(() => {
          const options = findOptions();
          if (options.length === 0) { tryMatchAndClick(rest); return; }

          console.log('[ProfileAI] Custom dropdown "' + question.substring(0, 30) + '": found', options.length, 'options');

          const exact = options.find((opt) => (opt.textContent || '').trim().toLowerCase() === desiredLower);
          // For short desired values (≤ 3 chars, e.g. "ca", "us", "uk"), substring matching
          // is dangerous — "ca" would match "AmeriCAn Samoa". Require word-boundary instead.
          let partial = exact;
          if (!partial) {
            if (desiredLower.length <= 3) {
              const wb = new RegExp('(^|[^a-z0-9])' + desiredLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
              partial = options.find((opt) => wb.test((opt.textContent || '').trim()));
            } else {
              // Prefer prefix match before substring — country pickers list "United States +1",
              // "United States Minor Outlying Islands +1" etc. Prefix on "united states" gets
              // the right one. Substring is the last resort.
              partial =
                options.find((opt) => (opt.textContent || '').trim().toLowerCase().startsWith(desiredLower)) ||
                options.find((opt) => {
                  const text = (opt.textContent || '').trim().toLowerCase();
                  // Require a word boundary on either side so "united states" does not match
                  // "united states minor outlying islands" preferentially.
                  return text.includes(desiredLower) || desiredLower.includes(text);
                });
            }
          }

          if (partial) {
            // Robust commit: pointer + mouse + click on deepest descendant, with
            // keyboard-Enter fallback if the menu refuses to close.
            commitOptionClick(partial, selectEl);
            filled++;
            console.log('[ProfileAI] ✓ Filled custom dropdown:', question.substring(0, 50), '→', desiredValue, '(picked: "' + (partial.textContent || '').trim().substring(0, 40) + '")');
            const parentEl = selectEl.closest('[class*="field"], [class*="question"], .form-group') as HTMLElement;
            if (parentEl) {
              parentEl.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
              setTimeout(() => { parentEl.style.boxShadow = ''; }, 2000);
            }
          } else {
            // Options rendered but none match the rule-based desired value:
            // queue this dropdown for an AI suggestion. Snapshot the options now
            // (text only) so we can pass them to the model.
            const snapshot = options.map((o) => ({
              text: (o.textContent || '').trim(),
              el: o,
            })).filter(o => o.text);
            if (aiPending && snapshot.length) {
              aiPending.push({ question, selectEl, options: snapshot });
            }
            console.log('[ProfileAI] No rule-based match for "' + question.substring(0, 30) + '", queued for AI fallback');
            closeCustomDropdown(selectEl);
            if (skipped) skipped.push(question);
          }
        }, delay);
      };

      tryMatchAndClick([250, 600, 1200]);
    } catch (e) {
      console.log('[ProfileAI] Custom dropdown interaction failed:', e);
    }
  });

  return filled;
}

// Handle custom ARIA radio groups (role="radiogroup" / role="radio")
// Handles Ashby, Radix UI, and other custom ATS radio implementations
function fillAriaRadioGroups(container: Element, profile: any): number {
  let filled = 0;

  // Find all radiogroup containers
  const radioGroups = container.querySelectorAll('[role="radiogroup"]');
  console.log('[ProfileAI] ARIA: Found', radioGroups.length, 'role="radiogroup" containers');

  radioGroups.forEach((group) => {
    const radios = Array.from(group.querySelectorAll('[role="radio"]')) as HTMLElement[];
    if (radios.length < 2) return;

    // Skip if already selected
    const alreadySelected = radios.some(r =>
      r.getAttribute('aria-checked') === 'true' ||
      r.getAttribute('data-state') === 'checked' ||
      r.classList.contains('active') || r.classList.contains('selected')
    );
    if (alreadySelected) return;

    // Get the group question label
    let groupLabel = '';
    const ariaLabelledBy = group.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) groupLabel = (labelEl.textContent || '').trim();
    }
    if (!groupLabel) groupLabel = group.getAttribute('aria-label') || '';
    if (!groupLabel) {
      // Try container / fieldset / legend
      const fieldset = group.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) groupLabel = (legend.textContent || '').trim();
      }
    }
    if (!groupLabel) {
      const containerSelectors = [
        '[class*="question"]', '[class*="field"]', '[class*="FormField"]',
        'fieldset', '.application-question', 'li',
      ];
      for (const sel of containerSelectors) {
        const parentContainer = group.closest(sel);
        if (parentContainer) {
          const labelEl = parentContainer.querySelector(
            'label, legend, h3, h4, p, [class*="label"], [class*="Label"], [class*="question"]'
          );
          if (labelEl && !labelEl.contains(group)) {
            groupLabel = (labelEl.textContent || '').trim();
            if (groupLabel) break;
          }
        }
      }
    }
    if (!groupLabel || groupLabel.length < 3) {
      console.log('[ProfileAI] ARIA radiogroup: no label found, skipping');
      return;
    }

    const q = groupLabel.toLowerCase();
    const radioTexts = radios.map(r => (r.textContent || r.getAttribute('aria-label') || '').trim());

    console.log('[ProfileAI] ARIA radiogroup label:', groupLabel.substring(0, 80), '| options:', radioTexts.map(t => t.substring(0, 40)));

    // Determine the desired answer based on question context
    let desiredAnswer = '';

    if (q.includes('gender') || q.includes('sex')) {
      const fallbacks = ['prefer not', 'decline', 'not to disclose', 'choose not', 'other'];
      for (const fb of fallbacks) {
        const match = radioTexts.find(t => t.toLowerCase().includes(fb));
        if (match) { desiredAnswer = match; break; }
      }
    } else if (q.includes('ethnicity') || q.includes('race') || q.includes('hispanic') || q.includes('latino')) {
      const fallbacks = ['prefer not', 'decline', 'not to disclose', 'choose not', 'two or more'];
      for (const fb of fallbacks) {
        const match = radioTexts.find(t => t.toLowerCase().includes(fb));
        if (match) { desiredAnswer = match; break; }
      }
    } else if (q.includes('veteran')) {
      const fallbacks = ['prefer not', 'decline', 'not to disclose', 'not a'];
      for (const fb of fallbacks) {
        const match = radioTexts.find(t => t.toLowerCase().includes(fb));
        if (match) { desiredAnswer = match; break; }
      }
      if (!desiredAnswer) {
        const noMatch = radioTexts.find(t => t.toLowerCase() === 'no');
        if (noMatch) desiredAnswer = noMatch;
      }
    } else if (q.includes('disability') || q.includes('handicap')) {
      const fallbacks = ['prefer not', 'decline', 'not to disclose', 'don\'t wish'];
      for (const fb of fallbacks) {
        const match = radioTexts.find(t => t.toLowerCase().includes(fb));
        if (match) { desiredAnswer = match; break; }
      }
    } else if (q.includes('authorized') || q.includes('legally') || q.includes('eligible to work') || q.includes('right to work')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('sponsorship') || q.includes('visa')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
    } else if (q.includes('relocate') || q.includes('commute') || q.includes('on-site') || q.includes('onsite')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('18 years') || q.includes('age') || q.includes('over 18')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('agree') || q.includes('consent') || q.includes('acknowledge') || q.includes('confirm')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('background check') || q.includes('drug test')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('remote') || q.includes('hybrid')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    } else if (q.includes('non-compete') || q.includes('noncompete')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
    } else if (q.includes('previously worked') || q.includes('former employee') || q.includes('worked for') || q.includes('employed by')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
    } else if (q.includes('government') && q.includes('employ')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
    } else if (q.includes('currently able') || q.includes('in-office') || q.includes('in office') || q.includes('days a week') || q.includes('work on-site') || q.includes('work onsite')) {
      desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
    }

    if (!desiredAnswer) return;

    // Find and click the matching radio
    const desiredLower = desiredAnswer.toLowerCase();
    const target = radios.find(r => {
      const text = (r.textContent || r.getAttribute('aria-label') || '').trim().toLowerCase();
      return text === desiredLower || text.includes(desiredLower) || desiredLower.includes(text);
    });

    if (target) {
      target.click();
      filled++;
      console.log('[ProfileAI] ✓ Filled ARIA radio group:', groupLabel.substring(0, 50), '→', desiredAnswer);
      const parent = group.closest('[class*="question"], [class*="field"], [class*="FormField"], fieldset') as HTMLElement;
      if (parent) {
        parent.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
        setTimeout(() => { parent.style.boxShadow = ''; }, 2000);
      }
    }
  });

  // Also find standalone [role="radio"] elements not inside a [role="radiogroup"]
  // Group them by their closest common parent
  const standaloneRadios = Array.from(
    container.querySelectorAll('[role="radio"]:not([role="radiogroup"] [role="radio"])')
  ) as HTMLElement[];

  if (standaloneRadios.length > 0) {
    // Group by closest question container
    const groups = new Map<Element, HTMLElement[]>();
    standaloneRadios.forEach(radio => {
      const parent = radio.closest(
        '[class*="question"], [class*="field"], [class*="FormField"], fieldset, .application-question, li'
      ) || radio.parentElement;
      if (parent) {
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent)!.push(radio);
      }
    });

    groups.forEach((radios, parentContainer) => {
      if (radios.length < 2) return;
      const alreadySelected = radios.some(r =>
        r.getAttribute('aria-checked') === 'true' ||
        r.getAttribute('data-state') === 'checked'
      );
      if (alreadySelected) return;

      const labelEl = parentContainer.querySelector(
        'label, legend, h3, h4, p, [class*="label"], [class*="Label"]'
      );
      const groupLabel = labelEl && !labelEl.querySelector('[role="radio"]')
        ? (labelEl.textContent || '').trim() : '';
      if (!groupLabel || groupLabel.length < 3) return;

      const q = groupLabel.toLowerCase();
      const radioTexts = radios.map(r => (r.textContent || r.getAttribute('aria-label') || '').trim());
      let desiredAnswer = '';

      if (q.includes('gender') || q.includes('sex')) {
        const fallbacks = ['prefer not', 'decline', 'not to disclose', 'other'];
        for (const fb of fallbacks) {
          const match = radioTexts.find(t => t.toLowerCase().includes(fb));
          if (match) { desiredAnswer = match; break; }
        }
      } else if (q.includes('ethnicity') || q.includes('race')) {
        const fallbacks = ['prefer not', 'decline', 'not to disclose'];
        for (const fb of fallbacks) {
          const match = radioTexts.find(t => t.toLowerCase().includes(fb));
          if (match) { desiredAnswer = match; break; }
        }
      } else if (q.includes('authorized') || q.includes('eligible')) {
        desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
      } else if (q.includes('sponsorship') || q.includes('visa')) {
        desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
      } else if (q.includes('government') && q.includes('employ')) {
        desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
      } else if (q.includes('previously worked') || q.includes('former employee') || q.includes('worked for') || q.includes('employed by')) {
        desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'no') || 'No';
      } else if (q.includes('relocate') || q.includes('commute') || q.includes('on-site') || q.includes('onsite') || q.includes('in-office') || q.includes('in office') || q.includes('currently able') || q.includes('days a week')) {
        desiredAnswer = radioTexts.find(t => t.toLowerCase() === 'yes') || 'Yes';
      }

      if (!desiredAnswer) return;
      const desiredLower = desiredAnswer.toLowerCase();
      const target = radios.find(r => {
        const text = (r.textContent || r.getAttribute('aria-label') || '').trim().toLowerCase();
        return text === desiredLower || text.includes(desiredLower) || desiredLower.includes(text);
      });
      if (target) {
        target.click();
        filled++;
        console.log('[ProfileAI] ✓ Filled standalone ARIA radio:', groupLabel.substring(0, 50), '→', desiredAnswer);
      }
    });
  }

  return filled;
}

// Handle button-style Yes/No toggles (Ashby, modern ATS)
// Ashby uses clickable divs/buttons that are NOT radio buttons or checkboxes
function fillButtonToggles(container: Element, profile: any): number {
  let filled = 0;

  // Strategy 1: Find question containers using broad selectors
  const containerSelectors = [
    '[class*="question"]', '[class*="field"]', '[class*="FormField"]',
    'fieldset', '.application-question',
    '[class*="section"]', '[class*="group"]', '[class*="block"]',
    '[class*="item"]',
  ];

  // Collect all potential question containers
  const allContainers = new Set<Element>();
  for (const sel of containerSelectors) {
    container.querySelectorAll(sel).forEach(el => allContainers.add(el));
  }

  // Strategy 2: Also find Yes/No button clusters directly on the page
  // Look for adjacent buttons/clickable elements with Yes/No text
  const allClickables = Array.from(container.querySelectorAll(
    'button:not([type="submit"]):not([type="file"]), [role="button"], [role="option"], ' +
    '[tabindex="0"], [class*="option"], [class*="Option"], [class*="choice"], [class*="Choice"], ' +
    '[class*="toggle"], [class*="Toggle"], [class*="pill"], [class*="Pill"], ' +
    '[class*="select-option"], [class*="btn"]:not([class*="submit"])'
  )) as HTMLElement[];

  // Group clickables by their parent container
  const clickableGroups = new Map<Element, HTMLElement[]>();
  allClickables.forEach(el => {
    // Walk up to find the nearest question-like container
    let parent: Element | null = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      if (parent.querySelectorAll('input, textarea, select').length > 0 && !parent.querySelector('button, [role="button"]')) {
        parent = parent.parentElement;
        continue;
      }
      // Check if this parent has multiple clickable siblings
      const siblings = parent.querySelectorAll(
        'button:not([type="submit"]):not([type="file"]), [role="button"], [role="option"], ' +
        '[tabindex="0"], [class*="option"], [class*="Option"], [class*="choice"]'
      );
      if (siblings.length >= 2 && siblings.length <= 6) break;
      parent = parent.parentElement;
    }
    if (parent) {
      if (!clickableGroups.has(parent)) clickableGroups.set(parent, []);
      const group = clickableGroups.get(parent)!;
      if (!group.includes(el)) group.push(el);
    }
  });

  // Process each group of clickable elements
  const processedContainers = new Set<Element>();

  const processButtonGroup = (buttons: HTMLElement[], questionContainer: Element) => {
    if (processedContainers.has(questionContainer)) return;
    if (buttons.length < 2 || buttons.length > 6) return;

    const buttonTexts = buttons.map(b => (b.textContent || '').trim().toLowerCase());
    console.log('[ProfileAI] Button toggle group found:', buttonTexts, 'in container:', questionContainer.tagName, questionContainer.className?.toString().substring(0, 60));

    const isYesNo = buttonTexts.some(t => t === 'yes') && buttonTexts.some(t => t === 'no');
    const isPreferSet = buttonTexts.some(t => t.includes('prefer not'));

    if (!isYesNo && !isPreferSet) return;

    // Check if already selected
    const alreadySelected = buttons.some(b => {
      const style = window.getComputedStyle(b);
      return b.classList.contains('active') || b.classList.contains('selected') ||
        b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-pressed') === 'true' ||
        b.getAttribute('data-state') === 'checked' || b.getAttribute('data-state') === 'on' ||
        b.getAttribute('aria-selected') === 'true' ||
        // Check for visual active state (background color different from siblings)
        (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent' &&
         buttons.some(other => other !== b && window.getComputedStyle(other).backgroundColor !== style.backgroundColor));
    });
    if (alreadySelected) {
      console.log('[ProfileAI] Button toggle already selected, skipping');
      return;
    }

    // Get the question text — try multiple approaches
    let questionText = '';

    // Approach 1: Look for label/heading within or above the container
    const labelSelectors = 'label, legend, h1, h2, h3, h4, h5, h6, p, [class*="label"], [class*="Label"], [class*="question"], [class*="title"], [class*="heading"]';
    const labelEl = questionContainer.querySelector(labelSelectors);
    if (labelEl && !labelEl.querySelector('button, [role="button"], [role="option"], [tabindex="0"]')) {
      questionText = (labelEl.textContent || '').trim();
    }

    // Approach 2: Walk up from container to find a heading/label before it
    if (!questionText) {
      let ancestor: Element | null = questionContainer;
      for (let depth = 0; depth < 5 && ancestor; depth++) {
        ancestor = ancestor.parentElement;
        if (!ancestor) break;
        const children = Array.from(ancestor.children);
        for (const child of children) {
          if (child.contains(questionContainer)) break;
          const headingEl = child.matches(labelSelectors) ? child : child.querySelector(labelSelectors);
          if (headingEl && !headingEl.querySelector('button, [role="button"]')) {
            const text = (headingEl.textContent || '').trim();
            if (text.length >= 10 && text.length < 500) {
              questionText = text;
              break;
            }
          }
        }
        if (questionText) break;
      }
    }

    // Approach 3: Get all text content of the container, excluding buttons
    if (!questionText) {
      const clone = questionContainer.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button, [role="button"], [role="option"], [tabindex="0"]').forEach(el => el.remove());
      questionText = (clone.textContent || '').trim();
    }

    if (!questionText || questionText.length < 10) {
      console.log('[ProfileAI] Button toggle: no question text found');
      return;
    }

    const q = questionText.toLowerCase();
    console.log('[ProfileAI] Button toggle question:', q.substring(0, 80));

    let desiredAnswer = '';

    if (q.includes('authorized') || q.includes('eligible') || q.includes('legally') || q.includes('right to work')) {
      desiredAnswer = 'yes';
    } else if (q.includes('sponsorship') || q.includes('visa') || q.includes('immigration')) {
      desiredAnswer = 'no';
    } else if (q.includes('commute') || q.includes('relocate') || q.includes('willing') || q.includes('on-site') || q.includes('onsite') || q.includes('office') || q.includes('meet this requirement') || q.includes('able to') || q.includes('work from')) {
      desiredAnswer = 'yes';
    } else if (q.includes('18 years') || q.includes('age') || q.includes('over 18') || q.includes('at least 18')) {
      desiredAnswer = 'yes';
    } else if (q.includes('veteran')) {
      desiredAnswer = isPreferSet ? 'prefer not to say' : 'no';
    } else if (q.includes('disability') || q.includes('handicap')) {
      desiredAnswer = isPreferSet ? 'prefer not to say' : 'no';
    } else if (q.includes('agree') || q.includes('consent') || q.includes('acknowledge') || q.includes('certify') || q.includes('confirm')) {
      desiredAnswer = 'yes';
    } else if (q.includes('background check') || q.includes('drug test') || q.includes('drug screen')) {
      desiredAnswer = 'yes';
    } else if (q.includes('remote') || q.includes('hybrid')) {
      desiredAnswer = 'yes';
    } else if (q.includes('non-compete') || q.includes('non compete') || q.includes('noncompete')) {
      desiredAnswer = 'no';
    } else if (q.includes('require') && q.includes('sponsor')) {
      desiredAnswer = 'no';
    } else if (q.includes('government') && q.includes('employ')) {
      desiredAnswer = 'no';
    } else if (q.includes('previously worked') || q.includes('former employee') || q.includes('worked for') || q.includes('employed by')) {
      desiredAnswer = 'no';
    } else if (q.includes('currently able') || q.includes('in-office') || q.includes('in office') || q.includes('days a week') || q.includes('work on-site') || q.includes('work onsite')) {
      desiredAnswer = 'yes';
    }

    if (!desiredAnswer) {
      console.log('[ProfileAI] Button toggle: no rule matched for:', q.substring(0, 60));
      return;
    }

    // Click the matching button
    const target = buttons.find(b => (b.textContent || '').trim().toLowerCase() === desiredAnswer);
    if (target) {
      target.click();
      // Also dispatch pointer/mouse events for React/framework compatibility
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      filled++;
      processedContainers.add(questionContainer);
      console.log('[ProfileAI] ✓ Clicked button toggle:', q.substring(0, 50), '→', desiredAnswer);
      const parent = (questionContainer.closest('[class*="question"], [class*="field"], [class*="FormField"], fieldset, section') || questionContainer) as HTMLElement;
      parent.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.3)';
      setTimeout(() => { parent.style.boxShadow = ''; }, 2000);
    } else {
      console.log('[ProfileAI] Button toggle: no button with text "' + desiredAnswer + '" found among:', buttonTexts);
    }
  };

  // Process known container-based groups
  allContainers.forEach((questionContainer) => {
    const buttons = Array.from(questionContainer.querySelectorAll(
      'button:not([type="submit"]):not([type="file"]), [role="button"], [role="option"], ' +
      '[tabindex="0"][class*="option"], [tabindex="0"][class*="Option"], ' +
      '[tabindex="0"][class*="choice"], [tabindex="0"][class*="pill"]'
    )) as HTMLElement[];
    processButtonGroup(buttons, questionContainer);
  });

  // Process proximity-based groups (detected from clickable elements)
  clickableGroups.forEach((buttons, parentContainer) => {
    processButtonGroup(buttons, parentContainer);
  });

  return filled;
}

// Detect whether the current page is Workday using a layered allow/deny strategy.
// Many enterprise Workday tenants use custom hostnames; conversely, several non-Workday
// ATS platforms (Greenhouse, Lever, custom CMSes) also use `data-automation-id` attributes,
// which would falsely trigger Workday's "type-then-Enter" combobox path.
function isWorkdayPage(): boolean {
  const href = window.location.href;

  // Deny list — known non-Workday ATS hosts that may carry data-automation-id.
  const DENY_HOSTS = /greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|icims\.com|jobvite\.com|gem\.com|breezy\.hr|recruitee\.com|teamtailor\.com|bamboohr\.com/i;
  if (DENY_HOSTS.test(href)) return false;

  // Allow list — canonical Workday domains.
  const ALLOW_HOSTS = /workday\.com|myworkdayjobs\.com|wd[0-9]+\.workday\.com/i;
  if (ALLOW_HOSTS.test(href)) return true;

  // Fallback: DOM signals unique to Workday's rendered page. Require at least 2 markers
  // before treating an unknown host as Workday (single attribute matches are too noisy).
  let signals = 0;
  if (document.querySelector('[data-automation-id="jobPostingPage"], [data-automation-id="applicationPage"], [data-automation-id="workdayLogo"]')) signals += 2;
  if (document.querySelector('[data-automation-id*="legalNameSection"], [data-automation-id*="contactInformation"]')) signals++;
  if (document.querySelector('[data-automation-id*="promptOption"]')) signals++;
  if (/wday|wd-/.test(document.documentElement.className || '')) signals++;
  return signals >= 2;
}

// Handle Workday-specific custom fields (dropdown prompts, custom selects)
// Workday uses data-automation-id and custom dropdown widgets instead of native <select>
function fillWorkdayCustomFields(container: Element, profile: any, skipped?: string[]): number {
  let filled = 0;
  if (!isWorkdayPage()) return filled;

  console.log('[ProfileAI] Running Workday custom field handler...');

  // Workday uses custom dropdown prompts with data-automation-id
  // These are NOT native <select> elements — they're clickable divs that open a popup list
  const workdayDropdowns = container.querySelectorAll(
    '[data-automation-id*="formField"], [data-automation-id*="selectWidget"], ' +
    '[data-automation-id*="dropdown"], [data-automation-id*="promptOption"], ' +
    '[data-automation-id*="multiselectInputContainer"]'
  );

  // Also find all prompt/dropdown containers by looking for Workday's common pattern:
  // a labeled section containing a text input with a popup trigger
  const allPromptContainers = container.querySelectorAll(
    '[data-automation-id] input[role="combobox"], ' +
    '[data-automation-id] input[aria-haspopup], ' +
    '[data-automation-id] input[aria-autocomplete]'
  );

  const processedLabels = new Set<string>();

  // Process combobox/prompt inputs (How Did You Hear, Phone Device Type, Country, etc.)
  allPromptContainers.forEach((input) => {
    const inputEl = input as HTMLInputElement;
    // Skip if already has a value
    if (inputEl.value && inputEl.value.trim()) return;

    // Get the label from the parent container
    let label = '';
    let parentContainer = inputEl.closest('[data-automation-id]');
    
    // Walk up to find the label text
    for (let depth = 0; depth < 6 && parentContainer; depth++) {
      const labelEl = parentContainer.querySelector('label, legend, [data-automation-id*="label"], [data-automation-id*="Label"]');
      if (labelEl) {
        label = (labelEl.textContent || '').trim();
        if (label) break;
      }
      // Check direct text content of the parent (Workday sometimes puts labels in parent)
      const textNodes = Array.from(parentContainer.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !(n as Element).querySelector('input')))
        .map(n => (n.textContent || '').trim())
        .filter(t => t.length > 2 && t.length < 100);
      if (textNodes.length > 0) {
        label = textNodes[0];
        break;
      }
      parentContainer = parentContainer.parentElement?.closest('[data-automation-id]') || null;
    }

    // Fallback: get label from getInputLabel
    if (!label) label = getInputLabel(inputEl) || '';
    if (!label || processedLabels.has(label.toLowerCase())) return;
    processedLabels.add(label.toLowerCase());

    const q = label.toLowerCase();
    let desiredValue = '';

    console.log('[ProfileAI] Workday prompt field:', label.substring(0, 60));

    // "How Did You Hear About Us?"
    if (q.includes('hear about') || q.includes('how did you') || q.includes('source') || q.includes('referral')) {
      desiredValue = 'LinkedIn';
    }
    // "Phone Device Type" (Mobile/Landline)
    else if (q.includes('phone') && q.includes('device') || q.includes('phone') && q.includes('type')) {
      desiredValue = 'Mobile';
    }
    // Phone type without "device" keyword
    else if (q.includes('phone type') || q.includes('telephone type')) {
      desiredValue = 'Mobile';
    }
    // Country
    else if (q.includes('country') && !q.includes('county')) {
      desiredValue = 'United States of America';
    }
    // State/Province
    else if (q.includes('state') || q.includes('province')) {
      const parts = (profile?.location || '').split(',').map((s: string) => s.trim());
      desiredValue = parts.length > 1 ? parts[parts.length - 2] : parts[0] || '';
    }

    if (!desiredValue) return;

    // Type the value and try to select from dropdown
    console.log('[ProfileAI] Workday: typing "' + desiredValue + '" into prompt for "' + label.substring(0, 40) + '"');
    
    // Focus and clear (use preventScroll to avoid page jumping)
    inputEl.focus({ preventScroll: true });
    inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
    
    // Clear existing value
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(inputEl, desiredValue);
    } else {
      inputEl.value = desiredValue;
    }
    
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

    // Wait for Workday's dropdown to appear, then click the first matching option
    setTimeout(() => {
      // Workday renders options in a popup/portal — search the entire document
      const optionSelectors = [
        '[data-automation-id*="promptOption"]',
        '[data-automation-id*="selectOption"]',
        '[role="option"]',
        '[role="listbox"] [role="option"]',
        '[data-automation-id*="menuItem"]',
        '.css-1q2dra3', // Workday's common option class
      ];
      let options: Element[] = [];
      for (const sel of optionSelectors) {
        options = Array.from(document.querySelectorAll(sel));
        if (options.length > 0) break;
      }

      console.log('[ProfileAI] Workday dropdown: found', options.length, 'options');

      const desiredLower = desiredValue.toLowerCase();
      const match = options.find((opt) => {
        const text = (opt.textContent || '').trim().toLowerCase();
        return text === desiredLower || text.includes(desiredLower) || desiredLower.includes(text);
      });

      // Determine if this input allows free-form text. Workday prompts that are pure dropdowns
      // expose role="combobox" with aria-autocomplete="list" — typed value MUST match an option.
      // Only inputs with aria-autocomplete="both" or no popup affordance accept free text.
      const ariaAutocomplete = (inputEl.getAttribute('aria-autocomplete') || '').toLowerCase();
      const hasPopup = !!inputEl.getAttribute('aria-haspopup') || inputEl.getAttribute('role') === 'combobox';
      const allowsFreeText = ariaAutocomplete === 'both' || ariaAutocomplete === 'inline' || !hasPopup;

      if (match) {
        console.log('[ProfileAI] ✓ Workday: clicking option "' + (match.textContent || '').trim().substring(0, 40) + '"');
        (match as HTMLElement).click();
        filled++;
      } else if (options.length > 0) {
        // Score options by token overlap; only auto-select if confidence is reasonable.
        const desiredTokens = new Set(desiredLower.split(/\s+/).filter(t => t.length > 1));
        let bestOpt: Element | null = null;
        let bestScore = 0;
        for (const opt of options) {
          const text = (opt.textContent || '').trim().toLowerCase();
          const tokens = text.split(/\s+/).filter(t => t.length > 1);
          let overlap = 0;
          for (const t of tokens) if (desiredTokens.has(t)) overlap++;
          const score = overlap / Math.max(desiredTokens.size, tokens.length || 1);
          if (score > bestScore) { bestScore = score; bestOpt = opt; }
        }
        if (bestOpt && bestScore >= 0.5) {
          console.log('[ProfileAI] Workday: fuzzy-matched option (score ' + bestScore.toFixed(2) + ') "' + (bestOpt.textContent || '').trim().substring(0, 40) + '"');
          (bestOpt as HTMLElement).click();
          filled++;
        } else {
          // No confident match — clear the typed value so we don't leave a random string
          // and close the popup. Track this field as skipped.
          console.log('[ProfileAI] Workday: no confident match for "' + label.substring(0, 40) + '" (best score ' + bestScore.toFixed(2) + '), clearing');
          if (nativeSetter) nativeSetter.call(inputEl, ''); else inputEl.value = '';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
          inputEl.blur();
          if (skipped) skipped.push(label);
        }
      } else if (allowsFreeText) {
        // Input explicitly allows free text — commit with Enter
        console.log('[ProfileAI] Workday: free-text input, pressing Enter to commit "' + desiredValue + '"');
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', keyCode: 13 }));
        filled++;
      } else {
        // Dropdown-only input but no options rendered — clear typed value, don't leave junk
        console.log('[ProfileAI] Workday: no options rendered for dropdown-only "' + label.substring(0, 40) + '", clearing');
        if (nativeSetter) nativeSetter.call(inputEl, ''); else inputEl.value = '';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
        inputEl.blur();
        if (skipped) skipped.push(label);
      }
    }, 500);
  });

  // Also handle Workday's prompt buttons (non-input dropdowns that are just clickable divs)
  const promptButtons = container.querySelectorAll(
    '[data-automation-id*="dateInputWrapper"], ' +
    'button[data-automation-id*="phone"], button[data-automation-id*="Phone"]'
  );
  promptButtons.forEach((btn) => {
    const automationId = (btn.getAttribute('data-automation-id') || '').toLowerCase();
    if (automationId.includes('phone') && automationId.includes('device')) {
      console.log('[ProfileAI] Workday: found phone device type button, clicking...');
      (btn as HTMLElement).click();
      setTimeout(() => {
        const options = document.querySelectorAll('[role="option"], [data-automation-id*="promptOption"]');
        const mobileOption = Array.from(options).find(o => 
          (o.textContent || '').toLowerCase().includes('mobile')
        );
        if (mobileOption) {
          (mobileOption as HTMLElement).click();
          filled++;
          console.log('[ProfileAI] ✓ Workday: selected Mobile for phone device type');
        }
      }, 400);
    }
  });

  return filled;
}

async function fillForm(container: Element, silent = false) {
  let filledCount = 0;
  // Track fields the autofill chose to skip (e.g. dropdown with no confident match).
  // Surfaced in the completion toast so users know what to fill manually.
  const skippedFields: string[] = [];
  
  // Save scroll position to restore after filling (prevents jarring scroll during autofill)
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  // Load saved custom answers
  let localSavedAnswers: Record<string, string> = {};
  if (autofillMode.useSavedAnswers) {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_SAVED_ANSWERS' });
      localSavedAnswers = resp?.answers || {};
    } catch (_) {}
  }

  // Regex-based field mappings (mirrors the vanilla extension)
  const fieldMappings = [
    { patterns: ['first.?name', 'fname', 'given.?name', 'first_name', 'name.?first'], value: profileData!.firstName, type: 'firstName' },
    { patterns: ['last.?name', 'lname', 'surname', 'family.?name', 'last_name', 'name.?last'], value: profileData!.lastName, type: 'lastName' },
    { patterns: ['full.?name', '^name$', 'your.?name', 'candidate.?name', 'legal.?name'], value: `${profileData!.firstName || ''} ${profileData!.lastName || ''}`.trim(), type: 'fullName' },
    { patterns: ['e.?mail', 'email.?address', 'your.?email'], value: profileData!.email, type: 'email' },
    { patterns: ['phone', 'mobile', 'tel(?!l)', 'cell', 'phone.?number', 'contact.?number'], value: profileData!.phone, type: 'phone' },
    { patterns: ['linkedin', 'linked.?in'], value: profileData!.linkedinUrl, type: 'linkedin' },
    { patterns: ['github'], value: profileData!.githubUrl, type: 'github' },
    { patterns: ['portfolio', 'website', 'personal.?site', 'personal.?url', 'other.?url', 'web.?site'], value: profileData!.portfolioUrl || profileData!.linkedinUrl, type: 'portfolio' },
    { patterns: ['city', 'location', 'street.?address', 'mailing.?address', 'home.?address', 'current.?location', 'where.?are.?you.?based'], value: profileData!.location, type: 'location' },
    { patterns: ['current.?title', 'job.?title', 'your.?title', 'headline'], value: profileData!.title || profileData!.headline, type: 'title' },
    { patterns: ['summary', 'about.?me', 'bio(?:graphy)?', 'cover.?letter', 'introduction', 'tell.?us.?about', 'why.?(?:are.?you.?)?interested', 'additional.?info'], value: profileData!.summary, type: 'summary' },
  ];

  // Find all fillable fields
  const inputs = container.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([readonly]):not([disabled]), ' +
    'textarea:not([readonly]):not([disabled]), ' +
    'select:not([disabled])'
  ) as NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  console.log('[ProfileAI] Found', inputs.length, 'fillable inputs');

  // Collect unfilled custom questions for AI (text fields, and later radio/select/checkbox)
  const customQuestions: { input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; question: string; fieldType?: string; options?: string[]; radios?: HTMLInputElement[] }[] = [];

  inputs.forEach((input, index) => {
    // Skip pre-filled
    if (input.value && input.value.trim() !== '') return;
    // Skip invisible
    const style = window.getComputedStyle(input);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
    if ((input as HTMLElement).offsetHeight === 0 && (input as HTMLElement).offsetWidth === 0) return;

    // CRITICAL: Skip the *search inputs* inside react-select / combobox dropdowns.
    // Greenhouse, Lever, Ashby, etc. render their dropdowns as <input role="combobox"
    // aria-autocomplete="list"> nested inside a wrapper. Typing into them only filters
    // options — it does NOT select a value. Letting the generic text-fill loop touch them
    // produces garbage like "San Francisco, CA" leaking into a Hispanic/Latino dropdown,
    // or "Two weeks notice" being typed into a Start-date month picker.
    // These widgets are handled exclusively by fillCustomDropdowns() / fillSelectSmart().
    //
    // Only skip if the input is BOTH:
    //   (a) explicitly typed as a combobox / has list autocomplete / haspopup
    //   (b) OR sits directly inside a known react-select-like CONTROL wrapper.
    // We must NOT skip plain text inputs that merely happen to live in a div whose
    // class contains the substring "select" (e.g. Databricks/Greenhouse wrap text fields
    // in such containers — that bug caused the entire form to be skipped).
    const ariaAutocomplete = (input.getAttribute('aria-autocomplete') || '').toLowerCase();
    const role = (input.getAttribute('role') || '').toLowerCase();
    const ariaHaspopup = (input.getAttribute('aria-haspopup') || '').toLowerCase();
    const inputTypeAttr = ((input as HTMLInputElement).type || '').toLowerCase();
    const isComboboxSearch =
      role === 'combobox' ||
      ariaAutocomplete === 'list' || ariaAutocomplete === 'both' ||
      ariaHaspopup === 'listbox' || ariaHaspopup === 'menu';
    // Tighter wrapper match: the input must be inside an actual react-select control
    // (not just any element with "select" in the class name). The control element is
    // usually `*__control` or `*-control` and contains the search input directly.
    const inSelectControl =
      inputTypeAttr !== 'email' && inputTypeAttr !== 'tel' && inputTypeAttr !== 'url' &&
      (
        // Class on the input itself is the dead giveaway for Greenhouse/Remix
        // typeahead comboboxes (e.g. `<input class="select__input" id="country">`).
        ((input as HTMLElement).classList.contains('select__input') ||
         (input as HTMLElement).classList.contains('select-input') ||
         (input as HTMLElement).className.toLowerCase().includes('select__input')) ||
        !!input.closest(
          '[class*="react-select__control"], [class*="Select__control"], [class*="select__control"], ' +
          '[class*="-control"][class*="select"], [class*="MuiAutocomplete-root"] [role="combobox"], ' +
          '[role="combobox"], [class*="select-shell"], [class*="select-trigger"]'
        )
      );
    if (isComboboxSearch || inSelectControl) {
      console.log('[ProfileAI] Skipping combobox/react-select search input #' + index + ' (handled by dropdown path)');
      return;
    }

    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const label = getInputLabel(input)?.toLowerCase() || '';
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const inputType = ((input as HTMLInputElement).type || '').toLowerCase();
    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    // Extra data attributes used by modern ATS (Gem/Supio, SmartRecruiters, etc.)
    const dataTestId = (input.getAttribute('data-testid') || input.getAttribute('data-test') || '').toLowerCase();
    const dataField = (input.getAttribute('data-field') || input.getAttribute('data-field-name') || input.getAttribute('data-qa') || '').toLowerCase();
    const title = (input.getAttribute('title') || '').toLowerCase();
    // Workday uses data-automation-id on inputs and parent containers
    const dataAutomationId = (input.getAttribute('data-automation-id') || '').toLowerCase();
    // Also check the parent container's data-automation-id (Workday nests inputs inside labeled divs)
    const parentAutomationId = (input.closest('[data-automation-id]')?.getAttribute('data-automation-id') || '').toLowerCase();

    const identifiers = [name, id, placeholder, label, ariaLabel, autocomplete, dataTestId, dataField, title, dataAutomationId, parentAutomationId];
    const identifiersJoined = identifiers.join(' ');

    console.log('[ProfileAI] Input #' + index + ':', { name, id, label: label.substring(0, 50), type: inputType, dataAutomationId: dataAutomationId || parentAutomationId || '' });

    let filled = false;

    // 0. Workday data-automation-id direct mapping (highest priority on Workday sites)
    if (!filled && (dataAutomationId || parentAutomationId)) {
      const wdId = dataAutomationId || parentAutomationId;
      const workdayMappings: Record<string, string | undefined> = {
        // Legal name section
        'legalnamensection_firstname': profileData!.firstName,
        'legalnamesection_firstname': profileData!.firstName,
        'firstname': profileData!.firstName,
        'legalnamensection_lastname': profileData!.lastName,
        'legalnamesection_lastname': profileData!.lastName,
        'lastname': profileData!.lastName,
        // Contact section
        'email': profileData!.email,
        'phone': profileData!.phone,
        'phonenumber': profileData!.phone,
        'addresssection_addressline1': profileData!.location,
        'addresssection_city': profileData!.location?.split(',')[0]?.trim(),
        'city': profileData!.location?.split(',')[0]?.trim(),
        'linkedin': profileData!.linkedinUrl,
        'linkedinquestion': profileData!.linkedinUrl,
        'linkedinprofile': profileData!.linkedinUrl,
        'websiteaddress': profileData!.portfolioUrl || profileData!.linkedinUrl,
      };
      for (const [wdKey, wdValue] of Object.entries(workdayMappings)) {
        if (wdValue && wdId.includes(wdKey)) {
          console.log('[ProfileAI] ✓ Workday match:', wdKey, 'into', wdId);
          fillInput(input, wdValue);
          filledCount++;
          filled = true;
          break;
        }
      }
    }

    // 1. Regex pattern matching — test each identifier individually so anchored patterns like ^name$ work
    for (const mapping of fieldMappings) {
      // basicsOnly: skip soft fields like summary/cover-letter/about-me/title — only fill hard basics.
      if (basicsOnly && (mapping.type === 'summary' || mapping.type === 'title')) continue;
      if (mapping.value && mapping.patterns.some((p) => {
        const regex = new RegExp(p, 'i');
        return identifiers.some((id) => regex.test(id));
      })) {
        console.log('[ProfileAI] ✓ Filling', mapping.type, 'into', name || id || `#${index}`);
        fillInput(input, mapping.value);
        filledCount++;
        filled = true;
        break;
      }
    }

    // 2. Fallback for email/tel/url type
    if (!filled && inputType === 'email' && profileData!.email) {
      fillInput(input, profileData!.email);
      filledCount++;
      filled = true;
    }
    if (!filled && inputType === 'tel' && profileData!.phone) {
      fillInput(input, profileData!.phone);
      filledCount++;
      filled = true;
    }
    if (!filled && inputType === 'url') {
      // Determine which URL based on label context
      const urlContext = (label + ' ' + placeholder + ' ' + ariaLabel + ' ' + name + ' ' + id).toLowerCase();
      let urlValue = '';
      if (urlContext.includes('linkedin')) urlValue = profileData!.linkedinUrl || '';
      else if (urlContext.includes('github')) urlValue = profileData!.githubUrl || '';
      else if (urlContext.includes('portfolio') || urlContext.includes('website')) urlValue = profileData!.portfolioUrl || '';
      else urlValue = profileData!.linkedinUrl || profileData!.portfolioUrl || ''; // default to linkedin
      if (urlValue) {
        fillInput(input, urlValue);
        filledCount++;
        filled = true;
      }
    }

    // 3. Try saved answers (if enabled)
    if (!filled && autofillMode.useSavedAnswers) {
      const question = label || placeholder || ariaLabel;
      if (question) {
        const normalizedQ = question.toLowerCase().trim();
        let answer = localSavedAnswers[normalizedQ];
        // Fuzzy match: use word-overlap similarity instead of substring inclusion
        if (!answer) {
          // Tightened threshold from 0.5 → 0.7 to avoid over-matching dissimilar questions
          // (e.g. "leadership experience" vs "management experience").
          const qWords = new Set<string>(normalizedQ.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2));
          let bestScore = 0;
          let bestAnswer: string | undefined;
          for (const [savedQ, savedA] of Object.entries(localSavedAnswers)) {
            const sWords = new Set<string>(savedQ.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length > 2));
            if (qWords.size === 0 || sWords.size === 0) continue;
            let overlap = 0;
            for (const w of qWords) {
              if (sWords.has(w)) overlap++;
            }
            const score = overlap / Math.max(qWords.size, sWords.size);
            if (score > bestScore && score >= 0.7) {
              bestScore = score;
              bestAnswer = savedA;
            }
          }
          if (bestAnswer) answer = bestAnswer;
        }
        if (answer) {
          fillInput(input, answer);
          filledCount++;
          filled = true;
        }
      }
    }

    // 4. For unfilled selects, try smart dropdown matching
    if (!filled && input.tagName === 'SELECT' && !basicsOnly) {
      const question = getInputLabel(input) || (input.getAttribute('aria-label') || '');
      if (question) {
        const smartFilled = fillSelectSmart(input as HTMLSelectElement, question, profileData);
        if (smartFilled) {
          filledCount++;
          filled = true;
          console.log('[ProfileAI] ✓ Smart-filled select:', question.substring(0, 50));
        }
      }
    }

    // 5. For unfilled text fields, try smart text mapping by label
    if (!filled && (inputType === 'text' || inputType === '' || input.tagName === 'TEXTAREA')) {
      const smartValue = getSmartTextValue(label || placeholder || ariaLabel, profileData);
      if (smartValue) {
        fillInput(input, smartValue);
        filledCount++;
        filled = true;
        console.log('[ProfileAI] ✓ Smart-filled text:', (label || placeholder || ariaLabel).substring(0, 50));
      }
    }

    // 6. Collect unfilled custom questions for AI (if enabled)
    if (!filled && autofillMode.useAI) {
      const question = getInputLabel(input) || (input.placeholder || '') || (input.getAttribute('aria-label') || '');
      if (question && question.length > 15) {
        customQuestions.push({ input, question, fieldType: input.tagName === 'TEXTAREA' ? 'textarea' : 'text' });
      }
    }
  });

  // --- Handle radio button groups ---
  const radioGroups = new Map<string, HTMLInputElement[]>();
  const unnamedRadiosByParent = new Map<Element, HTMLInputElement[]>();
  container.querySelectorAll('input[type="radio"]:not([disabled])').forEach((radio) => {
    const r = radio as HTMLInputElement;
    const groupName = r.name || r.getAttribute('data-group') || '';
    if (groupName) {
      if (!radioGroups.has(groupName)) radioGroups.set(groupName, []);
      radioGroups.get(groupName)!.push(r);
    } else {
      // Group unnamed radios by closest parent that contains multiple radios
      let parent: Element | null = r.parentElement;
      for (let i = 0; i < 6 && parent; i++) {
        if (parent.querySelectorAll('input[type="radio"]').length >= 2) break;
        parent = parent.parentElement;
      }
      if (parent) {
        if (!unnamedRadiosByParent.has(parent)) unnamedRadiosByParent.set(parent, []);
        unnamedRadiosByParent.get(parent)!.push(r);
      }
    }
  });
  // Merge unnamed groups into radioGroups with synthetic keys
  let unnamedIdx = 0;
  unnamedRadiosByParent.forEach((radios) => {
    if (radios.length >= 2) {
      radioGroups.set('__unnamed_' + (unnamedIdx++), radios);
    }
  });

  console.log('[ProfileAI] Found', radioGroups.size, 'radio groups');

  if (basicsOnly && radioGroups.size > 0) {
    console.log('[ProfileAI] basicsOnly mode → skipping radio groups');
  }

  if (!basicsOnly) radioGroups.forEach((radios, groupName) => {
    // Skip if already selected
    if (radios.some((r) => r.checked)) return;
    // Get the group question label (from container, fieldset legend, or first radio's parent)
    const firstRadio = radios[0];
    let groupLabel = '';

    // Strategy 1: fieldset > legend
    const fieldset = firstRadio.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) groupLabel = legend.textContent?.trim() || '';
    }

    // Strategy 2: aria-labelledby or aria-label on a parent radiogroup-like element
    if (!groupLabel) {
      let el: Element | null = firstRadio.parentElement;
      for (let i = 0; i < 5 && el; i++) {
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
          const labelEl = document.getElementById(ariaLabelledBy);
          if (labelEl) { groupLabel = labelEl.textContent?.trim() || ''; break; }
        }
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) { groupLabel = ariaLabel; break; }
        el = el.parentElement;
      }
    }

    // Strategy 3: container selector + label query (original approach with expanded selectors)
    if (!groupLabel) {
      const containerSelectors = [
        '.application-question', '.field', '.form-group', '[class*="field"]',
        '[class*="question"]', '.postings-form__field',
        'section', '[class*="section"]', '[class*="group"]', '[class*="block"]',
        '[class*="item"]', '[class*="FormField"]',
      ];
      for (const sel of containerSelectors) {
        const cnt = firstRadio.closest(sel);
        if (cnt) {
          const labelEl = cnt.querySelector(
            'label:not([for]), .label, legend, h1, h2, h3, h4, h5, h6, [class*="label"], [class*="question"], [class*="title"], [class*="heading"]'
          );
          if (labelEl && !labelEl.querySelector('input[type="radio"]')) {
            groupLabel = labelEl.textContent?.trim() || '';
            if (groupLabel) break;
          }
        }
      }
    }

    // Strategy 4: Walk up DOM tree looking for heading text BEFORE the radios
    if (!groupLabel) {
      let ancestor: Element | null = firstRadio;
      for (let depth = 0; depth < 8 && ancestor; depth++) {
        ancestor = ancestor.parentElement;
        if (!ancestor) break;
        const children = Array.from(ancestor.children);
        for (const child of children) {
          if (child.contains(firstRadio)) break; // Stop when we reach the subtree containing our radio
          const headingSel = 'h1, h2, h3, h4, h5, h6, strong, b, legend, label, [class*="label"], [class*="heading"], [class*="title"]';
          const headingEl = child.matches(headingSel) ? child : child.querySelector(headingSel);
          if (headingEl && !headingEl.querySelector('input[type="radio"]')) {
            const text = headingEl.textContent?.trim() || '';
            if (text.length >= 3 && text.length < 300) {
              groupLabel = text;
              break;
            }
          }
        }
        if (groupLabel) break;
      }
    }

    // Strategy 5: Use getInputLabel on the first radio as last resort
    if (!groupLabel) {
      groupLabel = getInputLabel(firstRadio) || '';
    }

    console.log('[ProfileAI] Radio group "' + groupName + '" label:', groupLabel?.substring(0, 80) || '(none)');

    if (!groupLabel) return;

    const q = groupLabel.toLowerCase();
    let desiredValue = '';

    // Common radio question answers
    if (q.includes('veteran')) {
      desiredValue = 'Prefer not to say';
      if (!radios.some(r => (getInputLabel(r) || r.value || '').toLowerCase().includes('prefer'))) {
        desiredValue = 'No';
      }
    } else if (q.includes('disability') || q.includes('handicap')) {
      desiredValue = 'Prefer not to say';
      if (!radios.some(r => (getInputLabel(r) || r.value || '').toLowerCase().includes('prefer'))) {
        desiredValue = 'No';
      }
    } else if (q.includes('gender') || q.includes('sex')) {
      // Try multiple fallbacks: prefer not > decline > other
      const genderFallbacks = ['prefer not', 'decline', 'not to disclose', 'choose not', 'other'];
      desiredValue = '';
      for (const fallback of genderFallbacks) {
        if (radios.some(r => ((getInputLabel(r) || '') + ' ' + (r.value || '')).toLowerCase().includes(fallback))) {
          const match = radios.find(r => ((getInputLabel(r) || '') + ' ' + (r.value || '')).toLowerCase().includes(fallback));
          desiredValue = getInputLabel(match!) || match!.value || '';
          break;
        }
      }
      if (!desiredValue) desiredValue = 'Prefer not to say';
    } else if (q.includes('ethnicity') || q.includes('race') || q.includes('hispanic') || q.includes('latino')) {
      const eeoFallbacks = ['prefer not', 'decline', 'not to disclose', 'choose not', 'two or more'];
      desiredValue = '';
      for (const fallback of eeoFallbacks) {
        if (radios.some(r => ((getInputLabel(r) || '') + ' ' + (r.value || '')).toLowerCase().includes(fallback))) {
          const match = radios.find(r => ((getInputLabel(r) || '') + ' ' + (r.value || '')).toLowerCase().includes(fallback));
          desiredValue = getInputLabel(match!) || match!.value || '';
          break;
        }
      }
      if (!desiredValue) desiredValue = 'Prefer not to say';
    } else if (q.includes('authorized') || q.includes('legally') || q.includes('eligible to work') || q.includes('right to work')) {
      desiredValue = 'Yes';
    } else if (q.includes('sponsorship') || q.includes('visa')) {
      desiredValue = 'No';
    } else if (q.includes('willing to relocate') || q.includes('open to relocation')) {
      desiredValue = 'Yes';
    } else if (q.includes('18 years') || q.includes('age') || q.includes('over 18') || q.includes('at least 18')) {
      desiredValue = 'Yes';
    } else if (q.includes('agree') || q.includes('consent') || q.includes('acknowledge') || q.includes('certify') || q.includes('confirm')) {
      desiredValue = 'Yes';
    } else if (q.includes('remote') || q.includes('work from home') || q.includes('hybrid')) {
      desiredValue = 'Yes';
    } else if (q.includes('background check') || q.includes('drug test') || q.includes('drug screen')) {
      desiredValue = 'Yes';
    } else if (q.includes('commute') || q.includes('on-site') || q.includes('onsite') || q.includes('in office') || q.includes('in-office') || q.includes('currently able') || q.includes('days a week')) {
      desiredValue = 'Yes';
    } else if (q.includes('non-compete') || q.includes('non compete') || q.includes('noncompete')) {
      desiredValue = 'No';
    } else if (q.includes('previously worked') || q.includes('former employee') || q.includes('worked for') || q.includes('employed by')) {
      desiredValue = 'No';
    } else if (q.includes('government') && q.includes('employ')) {
      desiredValue = 'No';
    } else if (q.includes('education') || q.includes('degree') || q.includes('highest level')) {
      // Try to match education from profile
      const education = profileData?.education;
      if (education && Array.isArray(education) && education.length > 0) {
        const deg = (education[0].degree || education[0].level || '').toLowerCase();
        if (deg.includes('phd') || deg.includes('doctor')) desiredValue = 'Doctorate';
        else if (deg.includes('master')) desiredValue = 'Master';
        else if (deg.includes('bachelor')) desiredValue = 'Bachelor';
        else desiredValue = 'Bachelor';
      } else {
        desiredValue = 'Bachelor';
      }
    } else if (q.includes('experience level') || q.includes('seniority') || q.includes('career level')) {
      const expCount = profileData?.experience?.length || 0;
      if (expCount >= 5) desiredValue = 'Senior';
      else if (expCount >= 3) desiredValue = 'Mid';
      else desiredValue = 'Entry';
    }

    if (desiredValue) {
      console.log('[ProfileAI] Radio group "' + groupLabel.substring(0, 50) + '" → desired:', desiredValue);
      const filled = fillRadioGroup(radios, desiredValue);
      if (filled) {
        filledCount++;
        console.log('[ProfileAI] ✓ Filled radio group:', groupLabel.substring(0, 50), '→', desiredValue);
      } else {
        console.log('[ProfileAI] ✗ Failed to fill radio group:', groupLabel.substring(0, 50));
      }
    } else {
      console.log('[ProfileAI] Radio group "' + groupLabel.substring(0, 50) + '" → no rule matched, skipping');
    }
  });

  // --- Handle checkbox groups (native + ARIA custom) ---
  if (!basicsOnly) filledCount += fillCheckboxes(container, profileData);

  // --- Handle ARIA radio groups (role="radiogroup"/role="radio" — Ashby, Radix, custom ATS) ---
  if (!basicsOnly) filledCount += fillAriaRadioGroups(container, profileData);

  // --- Handle button-style Yes/No toggles (Ashby, modern ATS) ---
  if (!basicsOnly) filledCount += fillButtonToggles(container, profileData);

  // --- Handle custom dropdown widgets (React Select, Listbox, Combobox) ---
  const aiDropdownPending: AiDropdownCandidate[] = [];
  if (!basicsOnly) filledCount += fillCustomDropdowns(container, profileData, skippedFields, aiDropdownPending);

  // --- Handle Workday custom prompts (data-automation-id based dropdowns & buttons) ---
  if (!basicsOnly) filledCount += fillWorkdayCustomFields(container, profileData, skippedFields);

  // --- AI fallback for dropdowns the rules couldn't match ---
  // First pick up any custom dropdown that's STILL unfilled (rule pass missed
  // its trigger entirely, or its question didn't match any rule branch). This
  // gives us much better coverage than relying on the queue alone.
  if (!basicsOnly) {
  await new Promise((r) => setTimeout(r, 400));
  const additionalUnfilled = await collectUnfilledCustomDropdowns(container, aiDropdownPending);
  for (const extra of additionalUnfilled) aiDropdownPending.push(extra);
  }

  if (aiDropdownPending.length > 0) {
    const jobInfo = (() => {
      try { return getJobInfo(); } catch { return null; }
    })();
    console.log('[ProfileAI] AI fallback: requesting', aiDropdownPending.length, 'dropdown answers in one batch');
    try {
      const batchResp = await chrome.runtime.sendMessage({
        type: 'AUTOFILL_SUGGEST_BATCH',
        data: {
          fields: aiDropdownPending.map((c, i) => ({
            i,
            question: c.question,
            fieldType: 'dropdown',
            options: c.options.map(o => o.text),
          })),
          jobContext: jobInfo ? { title: jobInfo.title, company: jobInfo.company } : undefined,
        },
      });
      const answers: Array<{ i: number; value: string; confidence: number }> = batchResp?.answers || [];
      console.log('[ProfileAI] AI fallback: got', answers.length, 'answers');
      for (const ans of answers) {
        const cand = aiDropdownPending[ans.i];
        if (!cand) continue;
        if (!ans.value || ans.confidence < 0.4) {
          skippedFields.push(cand.question);
          continue;
        }
        try {
          // Re-open the dropdown using the cross-library helper.
          openCustomDropdown(cand.selectEl);
          await new Promise((r) => setTimeout(r, 380));
          const valueLower = ans.value.toLowerCase();
          const liveOpts = Array.from(document.querySelectorAll(
            '[role="option"], [class*="option" i]:not([class*="OptionContainer"]), [class*="menu" i] li, [class*="listbox" i] li'
          )).filter(o => {
            const r = o.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          const target =
            liveOpts.find(o => (o.textContent || '').trim().toLowerCase() === valueLower) ||
            liveOpts.find(o => (o.textContent || '').trim().toLowerCase().startsWith(valueLower)) ||
            liveOpts.find(o => (o.textContent || '').trim().toLowerCase().includes(valueLower));
          if (target) {
            await commitOptionClick(target, cand.selectEl);
            filledCount++;
            console.log('[ProfileAI] ✓ AI-filled dropdown:', cand.question.substring(0, 50), '→', ans.value);
          } else {
            // Couldn't relocate the option — close menu and skip.
            closeCustomDropdown(cand.selectEl);
            skippedFields.push(cand.question);
          }
          // Give the previous dropdown time to fully close before opening the next.
          await new Promise((r) => setTimeout(r, 350));
        } catch (e) {
          console.warn('[ProfileAI] AI dropdown commit failed:', e);
        }
      }
    } catch (e) {
      console.warn('[ProfileAI] AI batch fallback failed:', e);
    }
  }

  // --- Collect unfilled radio/select/checkbox for AI if no rule-based match ---
  if (autofillMode.useAI) {
    // Collect unfilled radio groups that weren't handled by rules
    radioGroups.forEach((radios, _groupName) => {
      if (radios.some((r) => r.checked)) return;
      const firstRadio = radios[0];
      let groupLabel = '';
      const fieldset = firstRadio.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) groupLabel = legend.textContent?.trim() || '';
      }
      if (!groupLabel) groupLabel = getInputLabel(firstRadio) || '';
      if (groupLabel && groupLabel.length > 10) {
        const options = radios.map(r => (getInputLabel(r) || r.value || '').trim()).filter(Boolean);
        customQuestions.push({
          input: firstRadio,
          question: groupLabel,
          fieldType: 'radio',
          options,
          radios,
        } as any);
      }
    });

    // Collect unfilled selects that weren't handled
    container.querySelectorAll('select:not([disabled])').forEach((sel) => {
      const select = sel as HTMLSelectElement;
      if (select.value && select.selectedIndex > 0) return;
      const question = getInputLabel(select) || select.getAttribute('aria-label') || '';
      if (question && question.length > 10) {
        const options = Array.from(select.options)
          .filter(o => o.value && o.text.trim())
          .map(o => o.text.trim());
        if (options.length > 0) {
          customQuestions.push({
            input: select,
            question,
            fieldType: 'select',
            options,
          } as any);
        }
      }
    });
  }

  // Generate AI answers for remaining custom questions (if AI enabled)
  if (customQuestions.length > 0 && autofillMode.useAI) {
    console.log('[ProfileAI] Generating AI answers for', customQuestions.length, 'custom questions...');
    console.log('[ProfileAI] Generating AI answers for', customQuestions.length, 'questions...');

    try {
      // Get job description for context
      let jobDescription = '';
      const descSelectors = ['.job-description', '.posting-page', '.content', '[class*="description"]', 'main'];
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el && (el as HTMLElement).innerText.length > 200) {
          jobDescription = (el as HTMLElement).innerText.substring(0, 3000);
          break;
        }
      }

      // Build enriched question data with field types and options
      const enrichedQuestions = customQuestions.map((q: any) => ({
        question: q.question,
        fieldType: q.fieldType || 'text',
        options: q.options || null,
      }));

      const result = await chrome.runtime.sendMessage({
        type: 'GENERATE_AI_ANSWERS',
        data: {
          questions: enrichedQuestions.map((q: any) => q.question),
          jobDescription,
          questionMeta: enrichedQuestions,
        },
      });

      if (result?.answers) {
        for (const cq of customQuestions) {
          const { input, question } = cq;
          const meta = cq as any;
          const answer = result.answers[question];
          if (!answer) continue;

          if (meta.fieldType === 'radio' && meta.radios) {
            // Fill radio by AI-selected answer
            const filled = fillRadioGroup(meta.radios, answer);
            if (filled) {
              filledCount++;
              console.log('[ProfileAI] ✓ AI-filled radio:', question.substring(0, 50), '→', answer);
            }
          } else if (meta.fieldType === 'select') {
            // Fill select by AI-selected answer
            fillInput(input, answer);
            filledCount++;
            console.log('[ProfileAI] ✓ AI-filled select:', question.substring(0, 50), '→', answer);
          } else {
            fillInput(input, answer);
            filledCount++;
          }
          // Save for future use
          chrome.runtime.sendMessage({
            type: 'SAVE_ANSWER',
            data: { question: question.toLowerCase().trim(), answer },
          });
        }
      }
    } catch (e) {
      console.error('[ProfileAI] AI answer generation failed:', e);
    }
  }

  // Highlight unfilled required fields with amber
  container.querySelectorAll('input[required]:not([type="radio"]):not([type="checkbox"]), textarea[required], select[required]').forEach((input) => {
    if (!(input as HTMLInputElement).value) {
      (input as HTMLElement).style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.5)';
      setTimeout(() => { (input as HTMLElement).style.boxShadow = ''; }, 4000);
    }
  });
  // Also highlight unfilled required select elements that still show placeholder
  container.querySelectorAll('select[required]').forEach((select) => {
    const sel = select as HTMLSelectElement;
    if (!sel.value || sel.selectedIndex === 0) {
      (sel as HTMLElement).style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.5)';
      setTimeout(() => { (sel as HTMLElement).style.boxShadow = ''; }, 4000);
    }
  });

  // Restore scroll position to where user was before autofill
  window.scrollTo(scrollX, scrollY);
  
  if (!silent && filledCount > 0) {
    // Dedupe + truncate skipped list for the toast
    const uniqueSkipped = Array.from(new Set(skippedFields.map(s => s.trim()).filter(Boolean)));
    if (uniqueSkipped.length > 0) {
      const preview = uniqueSkipped.slice(0, 2).map(s => s.length > 30 ? s.substring(0, 30) + '…' : s).join(', ');
      const more = uniqueSkipped.length > 2 ? ` +${uniqueSkipped.length - 2} more` : '';
      showNotification(`✓ Autofilled ${filledCount} fields. Please review: ${preview}${more}`);
    } else {
      showNotification(`✓ Autofilled ${filledCount} fields!`);
    }
  }
  console.log('[ProfileAI] Autofill completed:', filledCount, 'fields,', skippedFields.length, 'skipped');

  // Track this application in ProfileAI dashboard (only once per URL)
  const currentUrl = window.location.href;
  if (filledCount > 0 && isAuthenticated && !savedApplicationUrls.has(currentUrl)) {
    try {
      const jobInfo = getJobInfo();
      const hostname = new URL(currentUrl).hostname.replace('www.', '');
      const jobTitle = jobInfo?.title || document.title;
      // Only save if we have a valid job title
      if (jobTitle && jobTitle.trim()) {
        savedApplicationUrls.add(currentUrl);
        chrome.runtime.sendMessage({
          type: 'SAVE_EXTERNAL_APPLICATION',
          data: {
            jobTitle: jobTitle.trim(),
            company: jobInfo?.company || hostname,
            jobUrl: currentUrl,
            platform: currentSiteName !== 'generic' ? currentSiteName : hostname,
            location: '',
          },
        });
        console.log('[ProfileAI] Application tracked');
      }
    } catch (e) {
      console.error('[ProfileAI] Failed to track application:', e);
    }
  }
}

// Handle tailor profile for current job
async function handleTailorProfile() {
  const jobInfo = getJobInfo();
  
  if (!jobInfo.description && !jobInfo.title) {
    showNotification('Could not detect job details on this page');
    return;
  }
  
  // Show loading modal
  showLoadingModal(jobInfo.title || 'this job', jobInfo.company);
  
  try {
    // Call background script to tailor profile via API
    const result = await chrome.runtime.sendMessage({
      type: 'TAILOR_PROFILE',
      data: {
        jobDescription: jobInfo.description || '',
        jobTitle: jobInfo.title,
        company: jobInfo.company
      }
    });
    
    // Remove loading modal
    hideLoadingModal();
    
    if (result.success && result.tailoredProfile) {
      // Store tailored profile
      const tailored = result.tailoredProfile;
      
      // Show success and offer to apply changes
      showTailoredProfileModal(tailored, jobInfo);
      
    } else {
      showNotification(result.error || 'Failed to tailor profile. Please try again.');
    }
  } catch (error) {
    hideLoadingModal();
    console.error('[ProfileAI] Tailor error:', error);
    showNotification('Error tailoring profile. Please try again.');
  }
}

// Show loading modal with progress
function showLoadingModal(jobTitle: string, company?: string) {
  // Remove existing
  const existing = document.getElementById('profileai-loading-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'profileai-loading-modal';
  modal.innerHTML = `
    <div class="profileai-modal-overlay">
      <div class="profileai-loading-content">
        <div class="profileai-loading-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
            <path d="M2 17L12 22L22 17"/>
            <path d="M2 12L12 17L22 12"/>
          </svg>
          <div class="profileai-spinner"></div>
        </div>
        <h3>Tailoring Your Profile</h3>
        <p>for <strong>${jobTitle}</strong>${company ? ` at ${company}` : ''}</p>
        <div class="profileai-progress-container">
          <div class="profileai-progress-bar">
            <div class="profileai-progress-fill"></div>
          </div>
          <div class="profileai-progress-steps">
            <span class="active">Analyzing job requirements</span>
            <span>Matching your experience</span>
            <span>Generating optimizations</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Animate progress steps
  const steps = modal.querySelectorAll('.profileai-progress-steps span');
  let currentStep = 0;
  const stepInterval = setInterval(() => {
    if (currentStep < steps.length - 1) {
      currentStep++;
      steps.forEach((s, i) => {
        if (i <= currentStep) s.classList.add('active');
      });
    }
  }, 1500);
  
  // Store interval for cleanup
  (modal as any)._stepInterval = stepInterval;
}

// Hide loading modal
function hideLoadingModal() {
  const modal = document.getElementById('profileai-loading-modal');
  if (modal) {
    clearInterval((modal as any)._stepInterval);
    modal.remove();
  }
}

// Store current tailored data for download
let currentTailoredData: any = null;

// Show tailored profile modal with suggestions
function showTailoredProfileModal(tailored: any, jobInfo: { title?: string; company?: string }) {
  // Store for download
  currentTailoredData = { tailored, jobInfo };
  
  // Remove existing modal
  const existing = document.getElementById('profileai-tailor-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'profileai-tailor-modal';
  modal.innerHTML = `
    <div class="profileai-modal-overlay">
      <div class="profileai-modal-content profileai-success-modal">
        <div class="profileai-modal-header">
          <div class="profileai-success-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2>Profile Tailored Successfully!</h2>
          <p class="profileai-modal-subtitle">Optimized for <strong>${jobInfo.title || 'This Job'}</strong>${jobInfo.company ? ` at ${jobInfo.company}` : ''}</p>
          <button class="profileai-modal-close">&times;</button>
        </div>
        <div class="profileai-modal-body">
          ${tailored.summary ? `
            <div class="profileai-tailor-section">
              <div class="profileai-section-header">
                <span class="profileai-section-icon">📝</span>
                <h3>Optimized Summary</h3>
              </div>
              <p>${tailored.summary}</p>
            </div>
          ` : ''}
          ${tailored.skills && tailored.skills.length > 0 ? `
            <div class="profileai-tailor-section">
              <div class="profileai-section-header">
                <span class="profileai-section-icon">🎯</span>
                <h3>Highlighted Skills</h3>
              </div>
              <div class="profileai-skills-list">
                ${tailored.skills.map((s: string) => `<span class="profileai-skill-tag">${s}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          ${tailored.highlights && tailored.highlights.length > 0 ? `
            <div class="profileai-tailor-section">
              <div class="profileai-section-header">
                <span class="profileai-section-icon">⭐</span>
                <h3>Key Highlights</h3>
              </div>
              <ul>
                ${tailored.highlights.map((h: string) => `<li>${h}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${tailored.suggestions && tailored.suggestions.length > 0 ? `
            <div class="profileai-tailor-section">
              <div class="profileai-section-header">
                <span class="profileai-section-icon">💡</span>
                <h3>Improvement Suggestions</h3>
              </div>
              <ul>
                ${tailored.suggestions.map((s: string) => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="profileai-modal-footer">
          <button class="profileai-btn-secondary profileai-modal-close-btn">Close</button>
          <button class="profileai-btn-outline profileai-download-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Resume
          </button>
          <button class="profileai-btn-primary profileai-apply-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Apply to Profile
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  const closeModal = () => modal.remove();
  modal.querySelector('.profileai-modal-close')?.addEventListener('click', closeModal);
  modal.querySelector('.profileai-modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('.profileai-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  
  modal.querySelector('.profileai-download-btn')?.addEventListener('click', () => {
    downloadTailoredResume(tailored, jobInfo);
  });
  
  modal.querySelector('.profileai-apply-btn')?.addEventListener('click', () => {
    // Open ProfileAI to apply changes
    chrome.runtime.sendMessage({ 
      type: 'OPEN_TAB', 
      data: { url: `${CONFIG.WEB_BASE}/profile?tailored=true` } 
    });
    closeModal();
    showNotification('Opening ProfileAI to apply changes...');
  });
}

// Download tailored resume as PDF (via web app)
async function downloadTailoredResume(tailored: any, jobInfo: { title?: string; company?: string }) {
  const downloadBtn = document.querySelector('.profileai-download-btn') as HTMLButtonElement;
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
      <svg class="profileai-btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Generating PDF...
    `;
  }
  
  try {
    // Open download page on ProfileAI
    const params = new URLSearchParams({
      jobTitle: jobInfo.title || '',
      company: jobInfo.company || '',
      tailored: 'true'
    });
    
    chrome.runtime.sendMessage({ 
      type: 'OPEN_TAB', 
      data: { url: `${CONFIG.WEB_BASE}/resume/download?${params.toString()}` } 
    });
    
    showNotification('Opening resume download page...');
    
  } catch (error) {
    console.error('[ProfileAI] Download error:', error);
    showNotification('Error generating resume. Please try again.');
  } finally {
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Resume
      `;
    }
  }
}

// Show notification
function showNotification(message: string) {
  const existing = document.querySelector('.profileai-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'profileai-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Message listener
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ProfileAI] Content received message:', message.type);
    switch (message.type) {
      case 'GET_JOB_INFO': {
        const info = getJobInfo();
        if (info) {
          // Also update storage so side panel poll can pick it up
          chrome.storage.local.set({ currentJobInfo: { ...info, _ts: Date.now() }, currentJobUrl: location.href });
          sendResponse(info);
        } else {
          // LinkedIn & other SPAs lazy-load job details; retry a few times
          let retries = 0;
          const maxRetries = 5;
          const retryInterval = setInterval(() => {
            retries++;
            const retryInfo = getJobInfo();
            if (retryInfo || retries >= maxRetries) {
              clearInterval(retryInterval);
              if (retryInfo) {
                chrome.storage.local.set({ currentJobInfo: { ...retryInfo, _ts: Date.now() }, currentJobUrl: location.href });
              }
              sendResponse(retryInfo);
            }
          }, 600);
          return true; // keep channel open for async sendResponse
        }
        break;
      }
      case 'TRIGGER_AUTOFILL':
        if (message.data) profileData = message.data;
        if (message.autofillMode) autofillMode = message.autofillMode;
        basicsOnly = !!message.basicsOnly;
        handleAutofill();
        sendResponse({ success: true });
        break;
      case 'TRIGGER_TAILOR':
        handleTailorProfile();
        sendResponse({ success: true });
        break;
      case 'OPEN_OVERLAY':
        openOverlay();
        sendResponse({ success: true });
        break;
      case 'CLOSE_OVERLAY':
        closeOverlay();
        sendResponse({ success: true });
        break;
      case 'SHOW_DOWNLOAD_OVERLAY':
        openDownloadOverlay();
        sendResponse({ success: true });
        break;
      case 'RESET_FAB_VISIBILITY':
        // Re-enable FAB (called from popup/settings)
        chrome.storage.local.set({ fabHidden: {} });
        sessionStorage.removeItem('profileai-fab-hidden');
        let fab = document.getElementById('profileai-fab');
        if (fab) {
          fab.style.display = '';
        } else {
          createFloatingButton();
        }
        sendResponse({ success: true });
        break;
      case 'DETECT_QUESTIONS': {
        try {
          const questions = detectOpenEndedQuestions();
          sendResponse({ questions });
        } catch (e) {
          console.warn('[ProfileAI] DETECT_QUESTIONS failed', e);
          sendResponse({ questions: [] });
        }
        break;
      }
      case 'INSERT_ANSWER': {
        try {
          const { questionId, answer } = (message.data || {}) as { questionId: string; answer: string };
          const ok = insertAnswerIntoField(questionId, answer);
          sendResponse({ success: ok });
        } catch (e) {
          console.warn('[ProfileAI] INSERT_ANSWER failed', e);
          sendResponse({ success: false });
        }
        break;
      }
    }
    return true;
  });
}

// Initialize when DOM is ready
console.log('[ProfileAI] Content script loaded, waiting for DOM...');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// =============================================================================
// SMART ANSWERS: open-ended question detection + floating per-field widget
// =============================================================================

// Element registry — DETECT_QUESTIONS returns ids that map back to live elements.
const detectedQuestionRegistry = new Map<string, HTMLElement>();
let lastDetectionTs = 0;

const QUESTION_KEYWORDS = [
  'why', 'tell us', 'tell me', 'describe', 'explain', 'experience',
  'what excites', 'what motivates', 'what interests', 'what makes',
  'how do you', 'how would you', 'walk us through', 'walk me through',
  'project', 'achievement', 'proud', 'challenge', 'goal', 'about you',
  'cover letter', 'introduction', 'additional', 'anything else',
];

const BASIC_FIELD_HINTS = [
  'name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'postal',
  'linkedin', 'github', 'portfolio', 'website', 'url',
];

function looksLikeOpenEndedQuestion(label: string, placeholder: string, fieldType: string): boolean {
  const haystack = `${label} ${placeholder}`.toLowerCase().trim();
  if (!haystack) return fieldType === 'textarea'; // any textarea is a candidate
  if (BASIC_FIELD_HINTS.some((h) => haystack.includes(h))) return false;
  if (QUESTION_KEYWORDS.some((k) => haystack.includes(k))) return true;
  // Long-ish question text → likely open-ended.
  if (haystack.length > 40 && haystack.includes('?')) return true;
  return fieldType === 'textarea';
}

function hashString(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function isElementVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (el.offsetHeight === 0 && el.offsetWidth === 0) return false;
  return true;
}

function detectOpenEndedQuestions() {
  const out: Array<{
    id: string;
    question: string;
    fieldType: 'textarea' | 'longtext' | 'contenteditable';
    placeholder?: string;
    index: number;
    hasContent?: boolean;
  }> = [];
  detectedQuestionRegistry.clear();

  // Textareas
  const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  // Long single-line text inputs (rare but happens)
  const longInputs = Array.from(document.querySelectorAll('input[type="text"]'))
    .filter((el) => {
      const i = el as HTMLInputElement;
      const ml = i.maxLength;
      // > 200 char max length OR no maxLength + placeholder looks like a question
      return (ml === -1 || ml > 200);
    }) as HTMLInputElement[];
  // ContentEditable rich-text fields
  const editables = Array.from(document.querySelectorAll('[contenteditable="true"]')) as HTMLElement[];

  let idx = 0;
  const tryAdd = (
    el: HTMLElement,
    fieldType: 'textarea' | 'longtext' | 'contenteditable',
    rawValue: string,
    placeholder: string
  ) => {
    if (!isElementVisible(el)) return;
    if ((el as HTMLInputElement).readOnly || (el as HTMLInputElement).disabled) return;
    const label = getInputLabel(el as HTMLInputElement) || el.getAttribute('aria-label') || '';
    const question = (label || placeholder || '').trim();
    if (!question) return;
    if (!looksLikeOpenEndedQuestion(question, placeholder, fieldType)) return;
    const id = hashString(`${question}::${fieldType}::${idx}`);
    detectedQuestionRegistry.set(id, el);
    out.push({
      id,
      question,
      fieldType,
      placeholder: placeholder || undefined,
      index: idx,
      hasContent: !!(rawValue && rawValue.trim().length > 5),
    });
    idx++;
  };

  textareas.forEach((ta) => tryAdd(ta, 'textarea', ta.value, ta.placeholder || ''));
  longInputs.forEach((inp) => tryAdd(inp, 'longtext', inp.value, inp.placeholder || ''));
  editables.forEach((ce) => tryAdd(ce, 'contenteditable', ce.innerText || '', ce.getAttribute('data-placeholder') || ''));

  lastDetectionTs = Date.now();
  console.log('[ProfileAI] Detected', out.length, 'open-ended questions');
  return out;
}

function insertAnswerIntoField(questionId: string, answer: string): boolean {
  const el = detectedQuestionRegistry.get(questionId);
  if (!el || !document.body.contains(el)) {
    return false;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    fillInput(el, answer);
    el.focus();
    return true;
  }
  // ContentEditable
  if (el.isContentEditable) {
    el.focus();
    el.innerText = answer;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Floating per-field widget — small button injected near focused textareas
// -----------------------------------------------------------------------------

const FLOATING_WIDGET_ID = 'profileai-floating-answer-btn';
const FLOATING_POPOVER_ID = 'profileai-floating-answer-popover';
let floatingWidgetTarget: HTMLElement | null = null;

function isWidgetEligibleField(el: EventTarget | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLInputElement && el.type === 'text') {
    const ml = el.maxLength;
    if (ml === -1 || ml > 200) return true;
  }
  return false;
}

function ensureFloatingWidgetStyles() {
  if (document.getElementById('profileai-floating-styles')) return;
  const style = document.createElement('style');
  style.id = 'profileai-floating-styles';
  style.textContent = `
    #${FLOATING_WIDGET_ID} {
      position: absolute;
      z-index: 2147483640;
      background: linear-gradient(135deg, #7c3aed, #8b5cf6);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(124,58,237,0.35);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${FLOATING_WIDGET_ID}:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(124,58,237,0.45); }
    #${FLOATING_WIDGET_ID}[disabled] { opacity: 0.7; cursor: progress; }
    #${FLOATING_POPOVER_ID} {
      position: absolute;
      z-index: 2147483641;
      width: 360px;
      max-width: calc(100vw - 24px);
      background: #1a1a22;
      color: #ececf1;
      border: 1px solid rgba(124,58,237,0.4);
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      padding: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    #${FLOATING_POPOVER_ID} .pa-pop-q { font-size: 11px; opacity: 0.7; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    #${FLOATING_POPOVER_ID} .pa-pop-text { white-space: pre-wrap; max-height: 220px; overflow: auto; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; }
    #${FLOATING_POPOVER_ID} .pa-pop-actions { display: flex; gap: 8px; margin-top: 10px; }
    #${FLOATING_POPOVER_ID} button {
      flex: 1; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04); color: #ececf1; border-radius: 6px;
      font-size: 12px; font-weight: 500; cursor: pointer;
    }
    #${FLOATING_POPOVER_ID} button.primary { background: #7c3aed; border-color: #7c3aed; }
    #${FLOATING_POPOVER_ID} button:hover { background: rgba(255,255,255,0.08); }
    #${FLOATING_POPOVER_ID} button.primary:hover { background: #8b5cf6; }
    #${FLOATING_POPOVER_ID} .pa-pop-close { position: absolute; top: 6px; right: 8px; width: 22px; height: 22px; flex: 0 0 auto; padding: 0; line-height: 18px; border-radius: 50%; }
    #${FLOATING_POPOVER_ID} .pa-pop-loading { display: flex; align-items: center; gap: 8px; padding: 12px; }
    #${FLOATING_POPOVER_ID} .pa-spinner { width: 14px; height: 14px; border: 2px solid rgba(124,58,237,0.3); border-top-color: #7c3aed; border-radius: 50%; animation: pa-spin 0.8s linear infinite; }
    @keyframes pa-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

function positionFloatingWidget(target: HTMLElement, btn: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const top = window.scrollY + rect.top - 6 - 24; // float just above the field
  const left = window.scrollX + rect.right - 180; // anchor to the right edge
  btn.style.top = `${Math.max(top, window.scrollY + 6)}px`;
  btn.style.left = `${Math.max(left, window.scrollX + 6)}px`;
}

function removeFloatingWidget() {
  document.getElementById(FLOATING_WIDGET_ID)?.remove();
  document.getElementById(FLOATING_POPOVER_ID)?.remove();
  floatingWidgetTarget = null;
}

function showFloatingWidget(target: HTMLElement) {
  ensureFloatingWidgetStyles();
  removeFloatingWidget();
  floatingWidgetTarget = target;

  const btn = document.createElement('button');
  btn.id = FLOATING_WIDGET_ID;
  btn.type = 'button';
  btn.innerHTML = '✨ Generate answer with ProfileAI';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void openFloatingPopover(target, btn);
  });
  document.body.appendChild(btn);
  positionFloatingWidget(target, btn);
}

async function openFloatingPopover(target: HTMLElement, anchor: HTMLElement, forceRegenerate = false) {
  document.getElementById(FLOATING_POPOVER_ID)?.remove();

  const label = getInputLabel(target as HTMLInputElement) || target.getAttribute('aria-label') || (target as HTMLTextAreaElement).placeholder || '';
  if (!label || label.trim().length < 4) {
    console.log('[ProfileAI] Floating widget: no usable label');
    return;
  }

  const pop = document.createElement('div');
  pop.id = FLOATING_POPOVER_ID;
  pop.innerHTML = `
    <button class="pa-pop-close" aria-label="Close">✕</button>
    <div class="pa-pop-q">${label.slice(0, 120)}</div>
    <div class="pa-pop-loading"><div class="pa-spinner"></div><span>Drafting answer…</span></div>
  `;
  document.body.appendChild(pop);
  // position below the field
  const rect = target.getBoundingClientRect();
  pop.style.top = `${window.scrollY + rect.bottom + 8}px`;
  pop.style.left = `${window.scrollX + Math.max(rect.left, 6)}px`;

  pop.querySelector('.pa-pop-close')?.addEventListener('click', () => pop.remove());

  anchor.setAttribute('disabled', 'true');
  try {
    const job = (() => { try { return getJobInfo(); } catch { return null; } })();
    const fakeId = hashString(`${label}::${target.tagName}`);
    detectedQuestionRegistry.set(fakeId, target);
    const resp = await chrome.runtime.sendMessage({
      type: 'GENERATE_SINGLE_ANSWER',
      data: {
        question: { id: fakeId, question: label, fieldType: target.tagName === 'TEXTAREA' ? 'textarea' : (target.isContentEditable ? 'contenteditable' : 'longtext') },
        jobInfo: job,
        jobUrl: location.href,
        forceRegenerate,
      },
    });

    if (!resp?.success) throw new Error(resp?.error || 'No answer');
    const answer: string = resp.answer || '';
    const source: string = resp.source || 'ai';

    pop.innerHTML = `
      <button class="pa-pop-close" aria-label="Close">✕</button>
      <div class="pa-pop-q">${label.slice(0, 120)}${source !== 'ai' ? ` · ${source}` : ''}</div>
      <div class="pa-pop-text"></div>
      <div class="pa-pop-actions">
        <button data-act="insert" class="primary">Insert</button>
        <button data-act="copy">Copy</button>
        <button data-act="regen">Regenerate</button>
      </div>
    `;
    (pop.querySelector('.pa-pop-text') as HTMLElement).innerText = answer;
    pop.querySelector('.pa-pop-close')?.addEventListener('click', () => pop.remove());
    pop.querySelector('[data-act="insert"]')?.addEventListener('click', () => {
      insertAnswerIntoField(fakeId, answer);
      pop.remove();
    });
    pop.querySelector('[data-act="copy"]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(answer); } catch (_) {}
    });
    pop.querySelector('[data-act="regen"]')?.addEventListener('click', () => {
      void openFloatingPopover(target, anchor, true);
    });
  } catch (err) {
    const msg = (err as Error)?.message || '';
    pop.innerHTML = `
      <button class="pa-pop-close" aria-label="Close">✕</button>
      <div class="pa-pop-q">${label.slice(0, 120)}</div>
      <div class="pa-pop-text">Couldn't draft an answer${msg ? `: ${msg}` : ''}. Make sure you're signed in to ProfileAI, then try again.</div>
    `;
    pop.querySelector('.pa-pop-close')?.addEventListener('click', () => pop.remove());
    console.warn('[ProfileAI] Floating widget gen failed', err);
  } finally {
    anchor.removeAttribute('disabled');
  }
}

function setupFloatingWidget() {
  // Show on focus into eligible fields. Hide on blur to a non-popover target.
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (!isWidgetEligibleField(target)) return;
    // Skip our own widget elements
    if (target.closest(`#${FLOATING_POPOVER_ID}, #${FLOATING_WIDGET_ID}`)) return;
    showFloatingWidget(target);
  });
  document.addEventListener('focusout', (e) => {
    // Defer so clicks on the widget still register
    setTimeout(() => {
      const active = document.activeElement;
      if (!active) { removeFloatingWidget(); return; }
      if (active === floatingWidgetTarget) return;
      if (active.closest(`#${FLOATING_POPOVER_ID}, #${FLOATING_WIDGET_ID}`)) return;
      // Only remove if user moved away from our target field & widget
      removeFloatingWidget();
    }, 200);
  });
  // Reposition on scroll/resize
  const reposition = () => {
    if (!floatingWidgetTarget) return;
    const btn = document.getElementById(FLOATING_WIDGET_ID);
    if (btn) positionFloatingWidget(floatingWidgetTarget, btn);
  };
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);

  // MutationObserver — pick up React-rendered textareas without re-init
  const mo = new MutationObserver(() => {
    // No-op; widget shows on focusin which fires reliably even for newly-rendered elements
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// Initialize the widget after DOM ready
// NOTE: floating "Generate answer with ProfileAI" widget is disabled for now
// (per user request). The implementation is kept in this file in case we want
// to re-enable it later — just uncomment the block below.
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => {
//     try { setupFloatingWidget(); } catch (e) { console.warn('[ProfileAI] floating widget setup failed', e); }
//   });
// } else {
//   try { setupFloatingWidget(); } catch (e) { console.warn('[ProfileAI] floating widget setup failed', e); }
// }

// =============================================================================
// LinkedIn INLINE AI EDITOR — injects ✨ AI buttons into LinkedIn's own edit
// modals (Edit intro / Edit about / Edit experience / Edit skill / …). Click
// opens a popover with preset actions + a free-form prompt. Insert writes the
// AI text back into the LinkedIn field via our fillInput helper (which uses
// the native setter so React's controlled-input shim doesn't swallow it).
// =============================================================================

const LI_INLINE_STYLE_ID = 'profileai-li-inline-styles';
const LI_INLINE_BTN_CLASS = 'profileai-li-ai-btn';
const LI_INLINE_POP_CLASS = 'profileai-li-ai-pop';
const LI_INLINE_BTN_ATTR = 'data-profileai-li-btn';
const LI_INLINE_FIELD_ATTR = 'data-profileai-li-field';

// Weak map: field element → injected AI button. Lets us find/replace/cleanup.
const liInlineButtons = new WeakMap<HTMLElement, HTMLButtonElement>();

/** Runtime-context guard — same reason as elsewhere in this file. When the
 *  extension reloads, existing content scripts keep firing observers and their
 *  chrome.* calls throw "Extension context invalidated". */
function liExtAlive(): boolean {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch { return false; }
}

function ensureLiInlineStyles() {
  if (document.getElementById(LI_INLINE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LI_INLINE_STYLE_ID;
  style.textContent = `
    .${LI_INLINE_BTN_CLASS} {
      /* Positioned by liPositionInlineBtn (fixed, beside LinkedIn's own
         "Write with AI" pill when present, else below the field). */
      position: fixed;
      z-index: 2147483645; /* above LinkedIn's modal (they use ~1000-9999) */
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px 6px 12px;
      /* Solid purple/indigo fill — deliberately DIFFERENT from LinkedIn's own
         blue-outlined "Write with AI" pill so the two are never confused when
         they sit side by side. */
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 999px;
      font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(124, 58, 237, 0.35);
      transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
      user-select: none;
      white-space: nowrap;
      /* Extra safety against modal clipping */
      pointer-events: auto;
    }
    .${LI_INLINE_BTN_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.5);
      filter: brightness(1.06);
    }
    .${LI_INLINE_BTN_CLASS}:active {
      transform: translateY(0);
    }
    .${LI_INLINE_BTN_CLASS}[disabled] { opacity: 0.7; cursor: progress; }
    .${LI_INLINE_BTN_CLASS} .pai-sparkle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }

    /* Popover — anchored below/above the ✨ button */
    .${LI_INLINE_POP_CLASS} {
      position: fixed;
      z-index: 2147483646; /* one above the button, still on top of LinkedIn's modal */
      width: 380px;
      max-width: calc(100vw - 24px);
      background: #14141c;
      color: #ececf1;
      border: 1px solid rgba(124, 58, 237, 0.45);
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
      padding: 12px;
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: pai-pop-in 140ms cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    @keyframes pai-pop-in {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .${LI_INLINE_POP_CLASS} .pai-pop-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .${LI_INLINE_POP_CLASS} .pai-pop-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      opacity: 0.65;
    }
    .${LI_INLINE_POP_CLASS} .pai-pop-close {
      background: transparent;
      border: none;
      color: #ececf1;
      opacity: 0.6;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font: inherit;
    }
    .${LI_INLINE_POP_CLASS} .pai-pop-close:hover { opacity: 1; background: rgba(255,255,255,0.05); }

    .${LI_INLINE_POP_CLASS} .pai-actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .${LI_INLINE_POP_CLASS} .pai-action {
      padding: 6px 8px;
      font: 500 11.5px/1.2 inherit;
      color: #ececf1;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: background 100ms ease, border-color 100ms ease;
    }
    .${LI_INLINE_POP_CLASS} .pai-action:hover {
      background: rgba(124, 58, 237, 0.15);
      border-color: rgba(124, 58, 237, 0.5);
    }
    .${LI_INLINE_POP_CLASS} .pai-prompt-row {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .${LI_INLINE_POP_CLASS} .pai-prompt {
      flex: 1;
      padding: 7px 10px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      color: #ececf1;
      font: 500 12.5px/1.35 inherit;
      outline: none;
    }
    .${LI_INLINE_POP_CLASS} .pai-prompt:focus {
      border-color: rgba(124, 58, 237, 0.7);
      box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
    }
    .${LI_INLINE_POP_CLASS} .pai-send {
      padding: 7px 12px;
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #fff;
      border-radius: 6px;
      font: 600 12px/1.2 inherit;
      cursor: pointer;
    }
    .${LI_INLINE_POP_CLASS} .pai-send:hover { filter: brightness(1.08); }
    .${LI_INLINE_POP_CLASS} .pai-send[disabled] { opacity: 0.6; cursor: progress; }

    .${LI_INLINE_POP_CLASS} .pai-result {
      background: rgba(124, 58, 237, 0.07);
      border: 1px solid rgba(124, 58, 237, 0.3);
      border-radius: 8px;
      padding: 10px 12px;
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      font-size: 12.5px;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .${LI_INLINE_POP_CLASS} .pai-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      color: #c4b5fd;
      font-size: 12px;
    }
    .${LI_INLINE_POP_CLASS} .pai-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(124, 58, 237, 0.25);
      border-top-color: #a78bfa;
      border-radius: 50%;
      animation: pai-spin 0.7s linear infinite;
    }
    @keyframes pai-spin { to { transform: rotate(360deg); } }
    .${LI_INLINE_POP_CLASS} .pai-err {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .${LI_INLINE_POP_CLASS} .pai-result-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    .${LI_INLINE_POP_CLASS} .pai-btn {
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #ececf1;
      border-radius: 6px;
      font: 600 11.5px/1.2 inherit;
      cursor: pointer;
    }
    .${LI_INLINE_POP_CLASS} .pai-btn:hover { background: rgba(255, 255, 255, 0.09); }
    .${LI_INLINE_POP_CLASS} .pai-btn.primary {
      background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      border-color: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
    .${LI_INLINE_POP_CLASS} .pai-btn.primary:hover { filter: brightness(1.08); }
  `;
  document.head.appendChild(style);
}

/** Best-guess field kind so the backend applies the right constraints. */
function liInferFieldKind(field: HTMLElement, label: string): string {
  const lbl = label.toLowerCase();
  if (lbl.includes('headline') || lbl.includes('title')) return 'headline';
  if (lbl.includes('about') || lbl === 'summary') return 'about';
  if (lbl.includes('description')) return 'experience';
  if (lbl.includes('skill')) return 'skill';
  // Fallback by max length / element type.
  if (field.tagName === 'TEXTAREA') return 'about';
  if (field instanceof HTMLInputElement) {
    const ml = field.maxLength;
    if (ml > 0 && ml <= 220) return 'headline';
  }
  return 'text';
}

/** Human-readable label for the field (used in popover header). */
function liGetFieldLabel(field: HTMLElement): string {
  // First try the associated <label for="…">
  if (field.id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
    const t = (explicit?.textContent || '').replace(/\*$/, '').trim();
    if (t) return t;
  }
  // aria-label / placeholder / preceding label sibling
  const aria = field.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const ancestor = field.closest('label');
  if (ancestor) {
    const clone = ancestor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, textarea, select').forEach((el) => el.remove());
    const t = (clone.textContent || '').replace(/\*$/, '').trim();
    if (t) return t;
  }
  // LinkedIn form-field wrapper pattern
  const wrapper = field.closest('.artdeco-text-input') || field.closest('[class*="text-input"]');
  if (wrapper) {
    const lbl = wrapper.querySelector('label, .artdeco-text-input__label, [class*="Label"]');
    const t = (lbl?.textContent || '').replace(/\*$/, '').trim();
    if (t) return t;
  }
  const ph = (field as HTMLInputElement).placeholder;
  return (ph && ph.trim()) || 'Field';
}

/** Filter: field is worth an AI button? */
function liIsEligibleField(el: HTMLElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute('readonly') || (el as HTMLInputElement).disabled) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;

  // Textareas: always eligible (About, Description, Summary, etc.)
  if (el instanceof HTMLTextAreaElement) return true;

  // Text inputs: only if there's enough room for a rewrite (skip Month, Year,
  // First name / Last name, etc.). LinkedIn's headline caps at 220. About caps
  // at 2600. We require maxLength >= 60 OR no cap.
  if (el instanceof HTMLInputElement) {
    if (el.type !== 'text') return false;
    const ml = el.maxLength;
    if (ml === -1 || ml === 0 || ml >= 60) {
      // Skip clearly-not-writeable inputs by label (e.g. Company, School, Year).
      const label = liGetFieldLabel(el).toLowerCase();
      if (/^year|^month|^company|^school|^organization|^employment type/.test(label)) return false;
      return true;
    }
    return false;
  }

  // Rich-text quill editor — LinkedIn uses .ql-editor for some fields.
  if (el.classList.contains('ql-editor') || el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  return false;
}

/** Find the nearest ancestor <dialog> that's actually open. LinkedIn's newer
 *  "sdui" edit panels (Edit about, etc.) use the native <dialog> element with
 *  .showModal(), which promotes the dialog to the browser's "top layer" — a
 *  compositing layer that always paints ABOVE the rest of the document,
 *  regardless of z-index. Any element we append to document.body (outside
 *  the dialog) stays in the NORMAL stacking context and renders BEHIND the
 *  dialog no matter how high its z-index is. So our AI button/popover must be
 *  appended INSIDE the open dialog to share its top-layer context. Falls back
 *  to null (caller uses document.body) for LinkedIn's older non-<dialog>
 *  modals. */
function liFindDialogHost(field: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = field;
  while (node) {
    if (node.tagName === 'DIALOG' && (node as HTMLDialogElement).open) return node;
    node = node.parentElement;
  }
  return null;
}

/** LinkedIn's own Premium "Write with AI" button sits right below/beside some
 *  fields (About, Headline). Our pill was landing directly on top of it since
 *  both anchor to the same field rect. Find it (if present near this field)
 *  so we can offset ours beside it instead of overlapping. */
function liFindNativeAiButtonNear(field: HTMLElement): HTMLElement | null {
  let scope: HTMLElement | null = field.parentElement;
  let hops = 0;
  while (scope && hops < 10) {
    const btns = scope.querySelectorAll('button');
    for (const b of Array.from(btns)) {
      if (b.classList.contains(LI_INLINE_BTN_CLASS)) continue;
      const txt = (b.textContent || '').trim().toLowerCase();
      if (/write with ai|improve with ai|enhance with ai/.test(txt)) return b as HTMLElement;
    }
    scope = scope.parentElement;
    hops++;
  }
  return null;
}

/** Anchor the ✨ button just BELOW the field, left-aligned with it — mirrors
 *  LinkedIn's own "Write with AI" pill placement in the Headline / About
 *  editors. Uses fixed positioning + reposition-on-scroll (elsewhere) so we
 *  don't have to mutate LinkedIn's DOM tree. Falls back to positioning ABOVE
 *  the field when there isn't enough vertical space below (rare, but happens
 *  with fields near the bottom of the modal). */
function liPositionInlineBtn(btn: HTMLButtonElement, field: HTMLElement) {
  const rect = field.getBoundingClientRect();
  // Off-screen zero-size fields (LinkedIn briefly renders these during React
  // mounts) — hide the button until layout is real.
  if (rect.width < 20 || rect.height < 20) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';

  const btnH = btn.offsetHeight || 30;
  const btnW = btn.offsetWidth || 120;
  const gap = 8;
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const viewportW = window.innerWidth || document.documentElement.clientWidth;

  // If LinkedIn's own "Write with AI" button is right there, sit BESIDE it
  // (same row) instead of stacking directly on top of it.
  const nativeBtn = liFindNativeAiButtonNear(field);
  if (nativeBtn) {
    const nRect = nativeBtn.getBoundingClientRect();
    if (nRect.width > 0 && nRect.height > 0) {
      let left = nRect.right + gap;
      let top = nRect.top + (nRect.height - btnH) / 2; // vertically centered with native btn
      if (left + btnW > viewportW - 8) {
        // Not enough room to the right — stack below the native button instead.
        left = nRect.left;
        top = nRect.bottom + gap;
      }
      btn.style.top = `${Math.max(8, top)}px`;
      btn.style.left = `${Math.max(8, Math.min(left, viewportW - btnW - 8))}px`;
      return;
    }
  }

  // Prefer BELOW the field; if it would overflow the viewport, place ABOVE.
  let top = rect.bottom + gap;
  if (top + btnH > viewportH - 8) {
    top = Math.max(8, rect.top - btnH - gap);
  }

  // Left-align with the field's left edge, but keep the pill inside the
  // viewport horizontally (its width is measured at ~ offsetWidth).
  let left = rect.left;
  if (left + btnW > viewportW - 8) left = Math.max(8, viewportW - btnW - 8);
  if (left < 8) left = 8;

  btn.style.top = `${top}px`;
  btn.style.left = `${left}px`;
}

/** Attach a ✨ AI button anchored to the field. Idempotent. */
function liEnsureButtonFor(field: HTMLElement) {
  if (!liIsEligibleField(field)) return;
  if (liInlineButtons.has(field)) {
    const existing = liInlineButtons.get(field)!;
    // Re-parent if the correct host changed (e.g. the dialog closed and
    // reopened as a new <dialog> instance) or the button somehow ended up
    // detached from any host.
    const desiredHost = liFindDialogHost(field) || document.body;
    if (existing.parentElement !== desiredHost) desiredHost.appendChild(existing);
    liPositionInlineBtn(existing, field);
    return;
  }
  ensureLiInlineStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = LI_INLINE_BTN_CLASS;
  btn.setAttribute(LI_INLINE_BTN_ATTR, 'true');
  // Branded label — "ProfilleAI" instead of "Edit with AI" so it's
  // immediately clear this is our extension's control, not another
  // LinkedIn-native "Write/Improve with AI" button sitting right next to it.
  // SVG sparkle instead of emoji so it renders consistently across OS font
  // stacks.
  btn.innerHTML = `
    <span class="pai-sparkle" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3l1.9 5.2L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.8L12 3z" fill="currentColor"/>
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="currentColor" opacity="0.7"/>
      </svg>
    </span>
    <span>ProfilleAI</span>
  `;
  btn.title = 'Rewrite this field with ProfilleAI';
  btn.addEventListener('mousedown', (e) => {
    // Prevent stealing focus from the field so its context stays intact.
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void liOpenInlinePopover(field, btn);
  });
  (liFindDialogHost(field) || document.body).appendChild(btn);
  field.setAttribute(LI_INLINE_FIELD_ATTR, 'attached');
  liInlineButtons.set(field, btn);
  // Back-reference on the button so cleanup can find the field for THIS
  // button (WeakMap doesn't allow reverse lookup, and the field's marker
  // attribute alone doesn't tell us which button belongs to which field).
  (btn as any)._paiField = field;
  // Position after append (needs offsetWidth).
  liPositionInlineBtn(btn, field);
}

/** Remove ✨ buttons whose target field is no longer in the DOM (modal
 *  closed, or React rerendered the field). Uses each button's back-reference
 *  to its target field, so orphans get cleaned up precisely. */
function liCleanupOrphanButtons() {
  let liveFields = 0;
  document.querySelectorAll<HTMLButtonElement>(`.${LI_INLINE_BTN_CLASS}`).forEach((btn) => {
    const field = (btn as any)._paiField as HTMLElement | undefined;
    if (!field || !document.contains(field)) {
      btn.remove();
    } else {
      liveFields++;
    }
  });
  // If no live target fields remain, drop any open popover too.
  if (liveFields === 0) {
    document.querySelectorAll(`.${LI_INLINE_POP_CLASS}`).forEach((p) => p.remove());
  }
}

/** Is LinkedIn's edit modal open right now? Falls back to a "sniff mode"
 *  that just picks up any writable form fields on the page — LinkedIn keeps
 *  A/B-testing container class names and the modal-detection query alone
 *  misses some variants. Injecting buttons directly on the field is safe
 *  because our field-eligibility filter already excludes tiny/short inputs. */
/** Scan the given root for eligible fields and inject buttons. */
function liInjectAll(root: ParentNode) {
  if (!liExtAlive()) return;
  const fields = root.querySelectorAll<HTMLElement>(
    'textarea, input[type="text"], .ql-editor, [contenteditable="true"]',
  );
  let injected = 0;
  fields.forEach((f) => {
    try {
      const before = liInlineButtons.has(f);
      liEnsureButtonFor(f);
      if (!before && liInlineButtons.has(f)) injected++;
    } catch {
      /* skip */
    }
  });
  if (injected > 0) {
    console.log(`[ProfileAI] Injected ${injected} ✨ AI button(s) into LinkedIn edit modal`);
  }
}

// -----------------------------------------------------------------------------
// Popover — action row + free-form prompt + result with Insert/Copy/Regenerate
// -----------------------------------------------------------------------------

async function liOpenInlinePopover(field: HTMLElement, anchor: HTMLButtonElement) {
  // Close any open popover first.
  document.querySelectorAll(`.${LI_INLINE_POP_CLASS}`).forEach((p) => p.remove());

  const label = liGetFieldLabel(field);
  const fieldKind = liInferFieldKind(field, label);

  const pop = document.createElement('div');
  pop.className = LI_INLINE_POP_CLASS;
  pop.innerHTML = `
    <div class="pai-pop-head">
      <span class="pai-pop-title">✨ ProfilleAI · ${label.slice(0, 40)}</span>
      <button type="button" class="pai-pop-close" aria-label="Close">✕</button>
    </div>
    <div class="pai-actions">
      <button type="button" class="pai-action" data-action="improve">Improve</button>
      <button type="button" class="pai-action" data-action="shorten">Shorten</button>
      <button type="button" class="pai-action" data-action="expand">Expand</button>
      <button type="button" class="pai-action" data-action="grammar">Fix grammar</button>
      <button type="button" class="pai-action" data-action="keywords">Add keywords</button>
      <button type="button" class="pai-action" data-action="first_person">First-person</button>
    </div>
    <div class="pai-prompt-row">
      <input type="text" class="pai-prompt" placeholder="Or ask AI to edit this…" maxlength="600" />
      <button type="button" class="pai-send">Send</button>
    </div>
    <div class="pai-body"></div>
  `;
  (liFindDialogHost(field) || document.body).appendChild(pop);

  // Position popover in viewport coords (position: fixed). Below the field by
  // default; flip above if it would clip the viewport bottom.
  const fieldRect = field.getBoundingClientRect();
  const overflowsBelow = fieldRect.bottom + 260 > window.innerHeight;
  const top = overflowsBelow
    ? Math.max(fieldRect.top - pop.offsetHeight - 8, 8)
    : fieldRect.bottom + 8;
  const left = Math.max(fieldRect.left, 8);
  pop.style.top = `${top}px`;
  pop.style.left = `${Math.min(left, window.innerWidth - pop.offsetWidth - 8)}px`;

  const bodyEl = pop.querySelector('.pai-body') as HTMLElement;
  const promptInput = pop.querySelector('.pai-prompt') as HTMLInputElement;
  const sendBtn = pop.querySelector('.pai-send') as HTMLButtonElement;

  const closePop = () => {
    pop.remove();
    document.removeEventListener('mousedown', outsideClose, true);
  };
  const outsideClose = (e: MouseEvent) => {
    const t = e.target as Node;
    if (!pop.contains(t) && !anchor.contains(t) && t !== field) closePop();
  };
  document.addEventListener('mousedown', outsideClose, true);
  pop.querySelector('.pai-pop-close')?.addEventListener('click', closePop);

  const readFieldText = (): string => {
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) return field.value || '';
    return (field.textContent || '').trim();
  };

  const writeFieldText = (text: string) => {
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      fillInput(field, text);
      return;
    }
    // contenteditable / .ql-editor
    field.focus();
    if (field.classList.contains('ql-editor')) {
      // Quill: replace children with paragraph nodes so it renders correctly.
      field.innerHTML = '';
      const paras = text.split(/\n{2,}/);
      for (const p of paras) {
        const pEl = document.createElement('p');
        pEl.textContent = p;
        field.appendChild(pEl);
      }
    } else {
      field.innerText = text;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    (field as HTMLElement).style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.5)';
    setTimeout(() => { (field as HTMLElement).style.boxShadow = ''; }, 1800);
  };

  const runRewrite = async (action: string, customPrompt?: string) => {
    if (!liExtAlive()) {
      bodyEl.innerHTML = `<div class="pai-err">Extension needs a reload — please refresh this page.</div>`;
      return;
    }
    const text = readFieldText();
    bodyEl.innerHTML = `<div class="pai-loading"><div class="pai-spinner"></div><span>ProfilleAI is drafting…</span></div>`;
    sendBtn.setAttribute('disabled', 'true');
    anchor.setAttribute('disabled', 'true');

    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'REWRITE_FIELD',
        data: { text, action, customPrompt, fieldKind },
      });
      if (!resp?.success) {
        bodyEl.innerHTML = `<div class="pai-err">${(resp?.error || 'Rewrite failed.').replace(/</g, '&lt;')}</div>`;
        return;
      }
      const answer: string = resp.text || '';
      renderResult(answer);
    } catch (err) {
      const msg = (err as Error)?.message || 'Something went wrong.';
      bodyEl.innerHTML = `<div class="pai-err">${msg.replace(/</g, '&lt;')}</div>`;
    } finally {
      sendBtn.removeAttribute('disabled');
      anchor.removeAttribute('disabled');
    }
  };

  const renderResult = (answer: string) => {
    const safe = answer.replace(/</g, '&lt;');
    bodyEl.innerHTML = `
      <div class="pai-result">${safe}</div>
      <div class="pai-result-actions">
        <button type="button" class="pai-btn" data-a="regen">Regenerate</button>
        <button type="button" class="pai-btn" data-a="copy">Copy</button>
        <button type="button" class="pai-btn primary" data-a="insert">Insert</button>
      </div>
    `;
    bodyEl.querySelector('[data-a="insert"]')?.addEventListener('click', () => {
      writeFieldText(answer);
      closePop();
    });
    bodyEl.querySelector('[data-a="copy"]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(answer);
        const btn = bodyEl.querySelector('[data-a="copy"]') as HTMLButtonElement;
        const prev = btn.textContent;
        btn.textContent = 'Copied ✓';
        setTimeout(() => { btn.textContent = prev || 'Copy'; }, 1400);
      } catch { /* ignore */ }
    });
    bodyEl.querySelector('[data-a="regen"]')?.addEventListener('click', () => {
      // Regenerate uses the last preset action, or 'improve' as a fallback.
      const last = pop.getAttribute('data-last-action') || 'improve';
      const lastPrompt = pop.getAttribute('data-last-prompt') || undefined;
      void runRewrite(last, lastPrompt || undefined);
    });
  };

  // Wire preset actions
  pop.querySelectorAll<HTMLButtonElement>('.pai-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action || 'improve';
      pop.setAttribute('data-last-action', action);
      pop.removeAttribute('data-last-prompt');
      void runRewrite(action);
    });
  });

  // Wire free-form prompt
  const submitPrompt = () => {
    const p = promptInput.value.trim();
    if (!p) { promptInput.focus(); return; }
    pop.setAttribute('data-last-action', 'custom');
    pop.setAttribute('data-last-prompt', p);
    void runRewrite('custom', p);
  };
  sendBtn.addEventListener('click', submitPrompt);
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  });

  // Focus the prompt so users can just start typing.
  setTimeout(() => promptInput.focus(), 30);
}

// -----------------------------------------------------------------------------
// Setup — MutationObserver on document.body watching for LinkedIn edit modals,
// plus focus-in handler as a safety net.
// -----------------------------------------------------------------------------

let liInlineInitialized = false;

function liSetupInlineEditor() {
  if (liInlineInitialized) return;
  if (!/linkedin\.com\//i.test(window.location.href)) return;
  liInlineInitialized = true;

  // Scan the whole document rather than trying to first locate "the modal"
  // container. LinkedIn constantly changes modal wrapper markup (class names,
  // whether role="dialog"/aria-modal is present, whether the URL even
  // navigates to an /edit/ path) — any attempt to detect "is a modal open"
  // first is fragile and silently no-ops when LinkedIn ships a variant we
  // don't recognize (this is what broke detection for the "Edit about"
  // overlay). liIsEligibleField() already excludes irrelevant fields (short
  // inputs, Company/School/Year, disabled/hidden), so a full-document scan is
  // safe and far more robust.

  // Initial scan (in case a modal was already open when the script loaded).
  liInjectAll(document.body);

  // Debounced scanner — coalesce rapid mutations from LinkedIn's React tree.
  let scanTimer: number | null = null;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      try {
        liInjectAll(document.body);
        liCleanupOrphanButtons();
      } catch { /* ignore */ }
    }, 120);
  };

  const observer = new MutationObserver(() => {
    if (!liExtAlive()) { observer.disconnect(); return; }
    scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Reposition anchored buttons on scroll/resize inside the modal.
  const reposition = () => {
    document.querySelectorAll<HTMLElement>(`[${LI_INLINE_FIELD_ATTR}]`).forEach((f) => {
      const btn = liInlineButtons.get(f);
      if (btn && document.contains(f)) liPositionInlineBtn(btn, f);
    });
  };
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);

  // Cleanup buttons on ESC (LinkedIn closes the modal on ESC).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setTimeout(liCleanupOrphanButtons, 120);
  });

  console.log('[ProfileAI] LinkedIn inline AI editor initialized');
}

// Kick off — only on LinkedIn.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { liSetupInlineEditor(); } catch (e) { console.warn('[ProfileAI] LI inline editor setup failed', e); }
  });
} else {
  try { liSetupInlineEditor(); } catch (e) { console.warn('[ProfileAI] LI inline editor setup failed', e); }
}

