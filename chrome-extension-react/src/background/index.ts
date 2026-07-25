// ProfileAI Background Service Worker
import { CONFIG } from '../config';
import type { User, FullProfile, Message } from '../types';

// State
let authToken: string | null = null;
let currentUser: User | null = null;
let cachedProfile: FullProfile | null = null;

// Tracks an in-progress "sign in on the web app" flow started from the side
// panel, so once auth syncs back we can close the login tab and return the
// user to the job page they came from (with the panel still open).
//
// IMPORTANT: MV3 service workers are terminated between events, so this state
// must be persisted to chrome.storage — an in-memory variable would be lost by
// the time the panel polls for the synced session, defeating the freshness
// guard and letting a stale prior session sync the wrong user.
interface PendingExtensionLogin {
  originTabId?: number;
  originWindowId?: number;
  loginTabId?: number;
  /** When the sign-in flow started. We only accept an auth blob the web app
   *  wrote AFTER this moment, so a stale prior session can't sync the wrong
   *  user before the real login completes. */
  startedAt: number;
  /** Token present in the web app when the flow started (may be a stale prior
   *  session). A genuine new login changes this, which is how we detect it. */
  priorToken?: string | null;
}

const PENDING_LOGIN_KEY = 'pendingExtensionLogin';
// How long a pending web sign-in stays "active". After this, we stop applying
// the freshness guard so an abandoned flow can't block normal auth sync.
const PENDING_LOGIN_TTL_MS = 5 * 60 * 1000;

async function getPendingLogin(): Promise<PendingExtensionLogin | null> {
  try {
    const { [PENDING_LOGIN_KEY]: pending } = await chrome.storage.local.get(PENDING_LOGIN_KEY);
    const p = pending as PendingExtensionLogin | undefined;
    if (!p) return null;
    if (Date.now() - p.startedAt > PENDING_LOGIN_TTL_MS) {
      await clearPendingLogin();
      return null;
    }
    return p;
  } catch (_) {
    return null;
  }
}

async function setPendingLogin(pending: PendingExtensionLogin): Promise<void> {
  try { await chrome.storage.local.set({ [PENDING_LOGIN_KEY]: pending }); } catch (_) {}
}

async function clearPendingLogin(): Promise<void> {
  try { await chrome.storage.local.remove(PENDING_LOGIN_KEY); } catch (_) {}
}

// URLs that are DEFINITELY not job pages — we should not run our job-title /
// company extractor here, because the fallback selectors (`h1`, generic
// `[class*="company"]`) match unrelated content and populate the panel with
// phantom job info. Notable example: linkedin.com/in/* → h1 = the person's
// name, which the panel then displays as "Detected job title".
//
// Job-hosting URLs on the SAME domain (e.g. linkedin.com/jobs/) MUST still be
// matched, so the patterns below are narrow.
const NON_JOB_URL_PATTERNS = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^about:/i,
  /linkedin\.com\/(in|company|school|feed|mynetwork|messaging|notifications|search\/results\/(?!jobs))/i,
  /(^|\.)google\.com\/(search|maps|images|drive|docs|mail|calendar|photos)/i,
  /(^|\.)docs\.google\.com/i,
  /(^|\.)drive\.google\.com/i,
  /(^|\.)mail\.google\.com/i,
  /(^|\.)youtube\.com/i,
  /(^|\.)facebook\.com/i,
  /(^|\.)instagram\.com/i,
  /(^|\.)twitter\.com|(^|\.)x\.com/i,
  /(^|\.)reddit\.com/i,
  /(^|\.)wikipedia\.org/i,
  /(^|\.)notion\.so/i,
  /(^|\.)figma\.com/i,
  /(^|\.)slack\.com/i,
  /(^|\.)chat\.openai\.com/i,
  /(^|\.)claude\.ai/i,
  /(^|\.)profilleai\.com/i,
  /localhost:3000/i,
];

function isNonJobUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  return NON_JOB_URL_PATTERNS.some((p) => p.test(url));
}

/** Clear any stale detected-job info so the SidePanel doesn't keep showing a
 *  job card for a tab where we now know no job exists. */
async function clearStoredJobInfo(): Promise<void> {
  try {
    await chrome.storage.local.remove(['currentJobInfo', 'currentJobUrl']);
  } catch { /* ignore */ }
}

// Reads the ProfilleAI auth token from any open web app tab. localStorage is
// shared per-origin, so any web app tab returns the same value. Returns null if
// no web app tab is open or no token is stored.
async function readWebAppToken(): Promise<string | null> {
  try {
    const tabs = await chrome.tabs.query({});
    const webAppTabs = tabs.filter(tab =>
      tab.url && (
        tab.url.includes('localhost:3000') ||
        tab.url.includes('profilleai.com') ||
        tab.url.includes('127.0.0.1:3000')
      )
    );
    for (const tab of webAppTabs) {
      if (!tab.id) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => localStorage.getItem('token'),
        });
        const token = results[0]?.result as string | null | undefined;
        if (token) return token;
      } catch (_) { /* tab not scriptable */ }
    }
  } catch (_) { /* ignore */ }
  return null;
}


// Initialize on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ProfileAI] Extension installed/updated');
  await loadAuthFromStorage();
  
  // Set side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Open onboarding for new installs
  if (details.reason === 'install') {
    // Check if onboarding was already completed (e.g., user reinstalled)
    const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
    if (!onboardingComplete) {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
    }
  }
});

// Load auth on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[ProfileAI] Extension started');
  await loadAuthFromStorage();
});

// Message handler
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) {
  console.log('[ProfileAI] Background received:', message.type);

  // Ensure auth is loaded from storage on service worker wake-up
  if (!authToken) {
    await loadAuthFromStorage();
  }

  try {
    switch (message.type) {
      case 'GET_AUTH':
        // If not authenticated, try silent auth first
        if (!authToken) {
          await silentAuthCheck();
        }
        sendResponse({
          isAuthenticated: !!authToken,
          token: authToken,
          user: currentUser,
        });
        break;

      case 'LOGIN': {
        const loginData = message.data as { token: string; user: User };
        await handleLogin(loginData.token, loginData.user);
        // If this login landed while a panel-initiated web sign-in/sign-up
        // was pending, finish it now instead of waiting on the side panel's
        // next poll — the panel may not even be open to poll (e.g. it closed
        // while the user was on the web tab), which otherwise left the user
        // stranded on the web app's generic success page.
        if (await getPendingLogin()) {
          await finishExtensionLoginRedirect();
        }
        sendResponse({ success: true });
        break;
      }

      case 'LOGIN_WITH_CREDENTIALS': {
        const creds = message.data as { email: string; password: string };
        const loginResult = await loginWithCredentials(creds.email, creds.password);
        sendResponse(loginResult);
        break;
      }

      case 'REGISTER': {
        const regData = message.data as { email: string; password: string; firstName: string; lastName: string; role?: string };
        const regResult = await registerWithCredentials(regData);
        sendResponse(regResult);
        break;
      }

      case 'LOGOUT':
        await handleLogout();
        sendResponse({ success: true });
        break;

      case 'GET_PROFILE':
        const profile = await fetchProfile();
        sendResponse({ profile });
        break;

      case 'GET_SAVED_ANSWERS':
        const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
        sendResponse({ answers: savedAnswers || {} });
        break;

      case 'GET_SEED_ANSWERS':
        const { seedAnswers } = await chrome.storage.local.get('seedAnswers');
        sendResponse({ seedAnswers: seedAnswers || {} });
        break;

      case 'SAVE_SEED_ANSWERS':
        const seedData = message.data as Record<string, string>;
        await chrome.storage.local.set({ seedAnswers: seedData });
        sendResponse({ success: true });
        break;

      case 'GET_ONBOARDING_STATUS':
        const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
        sendResponse({ complete: !!onboardingComplete });
        break;

      case 'OPEN_ONBOARDING':
        chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
        sendResponse({ success: true });
        break;

      case 'SAVE_ANSWER':
        const saveData = message.data as { question: string; answer: string };
        await saveAnswer(saveData.question, saveData.answer);
        sendResponse({ success: true });
        break;

      case 'DELETE_ANSWER':
        const deleteData = message.data as { question: string };
        await deleteAnswer(deleteData.question);
        sendResponse({ success: true });
        break;

      case 'CLEAR_ANSWERS':
        await chrome.storage.local.remove(['savedAnswers']);
        sendResponse({ success: true });
        break;

      case 'AUTOFILL_SUGGEST': {
        const payload = message.data as {
          question: string;
          fieldType?: string;
          options?: string[];
          jobContext?: { title?: string; company?: string };
        };
        const result = await autofillSuggest(payload);
        sendResponse(result);
        break;
      }

      case 'AUTOFILL_SUGGEST_BATCH': {
        const payload = message.data as {
          fields: Array<{ question: string; fieldType?: string; options?: string[] }>;
          jobContext?: { title?: string; company?: string };
        };
        const result = await autofillSuggestBatch(payload);
        sendResponse(result);
        break;
      }

      case 'OPEN_SIDE_PANEL':
        if (sender.tab?.windowId) {
          chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
        sendResponse({ success: true });
        break;
        
      case 'OPEN_TAB':
        const { url } = message.data as { url: string };
        chrome.tabs.create({ url });
        sendResponse({ success: true });
        break;

      case 'OPEN_WEB_LOGIN': {
        // Sign-in started from the side panel. Remember the job page the user
        // came from so we can return them there once they finish authenticating.
        const { url: loginUrl } = message.data as { url: string };
        try {
          const [originTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          // Capture whatever session the web app currently has so we can tell a
          // genuine new login (token changes) from a stale prior session.
          const priorToken = await readWebAppToken();
          const loginTab = await chrome.tabs.create({ url: loginUrl });
          await setPendingLogin({
            originTabId: originTab?.id,
            originWindowId: originTab?.windowId,
            loginTabId: loginTab?.id,
            startedAt: Date.now(),
            priorToken,
          });
        } catch (_) {
          await clearPendingLogin();
          try { chrome.tabs.create({ url: loginUrl }); } catch (__) {}
        }
        sendResponse({ success: true });
        break;
      }

      case 'CLOSE_CURRENT_TAB':
        if (sender.tab?.id) {
          chrome.tabs.remove(sender.tab.id);
        }
        sendResponse({ success: true });
        break;
        
      case 'CHECK_AUTH_SILENT':
        await silentAuthCheck();
        sendResponse({ 
          isAuthenticated: !!authToken,
          token: authToken,
          user: currentUser 
        });
        break;

      case 'GET_JOB_INFO_RELAY': {
        // Use chrome.scripting.executeScript to extract job info directly from the page DOM.
        // This is the most reliable method — no dependency on content script messaging.
        let jobInfo = null;
        try {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          const tab = tabs[0];
          console.log('[ProfileAI BG] GET_JOB_INFO_RELAY — tab:', tab?.id, tab?.url?.slice(0, 80));
          // Bail out on pages that are definitely not job pages. Prevents phantom
          // "job title" like the person's name being scraped off a LinkedIn
          // profile via the h1 fallback selector.
          if (isNonJobUrl(tab?.url)) {
            console.log('[ProfileAI BG] Skipping job detection — non-job URL');
            await clearStoredJobInfo();
            sendResponse(null);
            break;
          }
          if (tab?.id && tab?.url && !tab.url.startsWith('chrome://')) {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  // --- Runs in the page context ---
                  const titleSelectors = [
                    '.job-details-jobs-unified-top-card__job-title',
                    '.jobs-unified-top-card__job-title',
                    '.jobs-details-top-card__job-title',
                    '.top-card-layout__title',
                    'h1.t-24',
                    'h1[class*="jobs"]',
                    'h2.top-card-layout__title',
                    '.app-title',
                    '.posting-headline h2',
                    '[data-automation-id="jobPostingTitle"]',
                    'h1',
                  ];
                  const companySelectors = [
                    '.job-details-jobs-unified-top-card__company-name',
                    '.jobs-unified-top-card__company-name',
                    '.jobs-details-top-card__company-info a',
                    '.topcard__org-name-link',
                    'a[data-tracking-control-name*="company"]',
                    '[class*="job-details"] a[href*="/company/"]',
                    '.company-name',
                    '.posting-categories .location',
                    '[data-automation-id="jobPostingCompany"]',
                    '[class*="company"]',
                  ];
                  const descriptionSelectors = [
                    '#job-details',
                    '.jobs-description-content',
                    '.jobs-description__content',
                    '.jobs-description-content__text',
                    '.jobs-box__html-content',
                    '.show-more-less-html__markup',
                    '.description__text',
                    'div.jobs-description',
                    'div[class*="jobs-description"]',
                    'section[class*="description"]',
                    '.job-description',
                    '#job_description',
                    '[data-automation-id="jobPostingDescription"]',
                    '.posting-page',
                    '.section-wrapper',
                    '[class*="job-description"]',
                    '[class*="description"]',
                    'article',
                    'main',
                  ];

                  let title = '';
                  let company = '';
                  let description = '';

                  for (const sel of titleSelectors) {
                    try {
                      const el = document.querySelector(sel);
                      if (el && el.textContent && el.textContent.trim()) {
                        title = el.textContent.trim();
                        break;
                      }
                    } catch (_) {}
                  }

                  for (const sel of companySelectors) {
                    try {
                      const el = document.querySelector(sel);
                      if (el && el.textContent && el.textContent.trim()) {
                        company = el.textContent.trim();
                        break;
                      }
                    } catch (_) {}
                  }

                  // For description, pick the longest match
                  for (const sel of descriptionSelectors) {
                    try {
                      const el = document.querySelector(sel);
                      if (el) {
                        const text = (el as HTMLElement).innerText || el.textContent || '';
                        if (text.trim().length > description.length) {
                          description = text.trim();
                        }
                      }
                    } catch (_) {}
                  }

                  // Ultimate fallback: page body
                  if (description.length < 100) {
                    description = document.body.innerText.slice(0, 8000);
                  }

                  if (!title && !company) return null;
                  return { title, company, description };
                },
              });
              if (results && results[0]?.result) {
                jobInfo = results[0].result;
                console.log('[ProfileAI BG] Got job via scripting.executeScript:', {
                  title: jobInfo.title?.slice(0, 60),
                  company: jobInfo.company?.slice(0, 40),
                  descLength: jobInfo.description?.length || 0,
                });
                // Also store in storage for future use
                chrome.storage.local.set({ currentJobInfo: jobInfo, currentJobUrl: tab.url });
              }
            } catch (e) {
              console.log('[ProfileAI BG] scripting.executeScript failed:', e);
            }
          }
        } catch (e) {
          console.log('[ProfileAI BG] tabs.query failed:', e);
        }
        // Fallback: read from storage
        if (!jobInfo || (!jobInfo.title && !jobInfo.company)) {
          try {
            const stored = await chrome.storage.local.get(['currentJobInfo', 'currentJobUrl']);
            if (stored.currentJobInfo && (stored.currentJobInfo.title || stored.currentJobInfo.company)) {
              jobInfo = stored.currentJobInfo;
              console.log('[ProfileAI BG] Got job from storage fallback:', {
                title: jobInfo.title?.slice(0, 60),
                descLength: jobInfo.description?.length || 0,
              });
            }
          } catch (_) {}
        }
        sendResponse(jobInfo || null);
        break;
      }

      case 'ANALYZE_JOB_PAGE': {
        // Combined: extract job info via scripting API, then analyze keywords in one step
        let pageJobInfo: any = null;
        let resolvedTabId: number | null = null;
        try {
          const tabs2 = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          const tab = tabs2[0];
          resolvedTabId = tab?.id ?? null;
          console.log('[ProfileAI BG] ANALYZE_JOB_PAGE — tab:', tab?.id, tab?.url?.slice(0, 80));
          // Same non-job guard as GET_JOB_INFO_RELAY — don't scrape phantom
          // titles/companies from social/profile/search pages.
          if (isNonJobUrl(tab?.url)) {
            console.log('[ProfileAI BG] Skipping analyze — non-job URL');
            await clearStoredJobInfo();
            sendResponse({ success: false, error: 'This page does not look like a job posting.' });
            break;
          }
          if (tab?.id && tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
            // Method 1: executeScript (direct DOM access, no content script dependency)
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  // Try multiple selectors, return first non-empty match
                  const getText = (selectors: string[]) => {
                    for (const sel of selectors) {
                      try {
                        const el = document.querySelector(sel);
                        const text = el?.textContent?.trim();
                        if (text && text.length > 0 && text.length < 500) return text;
                      } catch (_) {}
                    }
                    return '';
                  };
                  let title = getText([
                    '.job-details-jobs-unified-top-card__job-title a',
                    '.job-details-jobs-unified-top-card__job-title h1',
                    '.job-details-jobs-unified-top-card__job-title',
                    '.jobs-unified-top-card__job-title a',
                    '.jobs-unified-top-card__job-title h1',
                    '.jobs-unified-top-card__job-title',
                    '.jobs-details-top-card__job-title',
                    '.top-card-layout__title',
                    'h1.t-24', 'h1.t-18',
                    'h1[class*="job"]', 'h2[class*="job-title"]',
                    '.app-title',
                    '.posting-headline h2',
                    '[data-automation-id="jobPostingTitle"]',
                    'h1',
                  ]);
                  let company = getText([
                    '.job-details-jobs-unified-top-card__company-name a',
                    '.job-details-jobs-unified-top-card__company-name',
                    '.job-details-jobs-unified-top-card__primary-description-without-tagline a',
                    '.jobs-unified-top-card__company-name a',
                    '.jobs-unified-top-card__company-name',
                    '.jobs-details-top-card__company-info a',
                    '.topcard__org-name-link',
                    'a[data-tracking-control-name*="company"]',
                    '.job-details-jobs-unified-top-card__primary-description a[href*="/company/"]',
                    'a[href*="/company/"]',
                    '[class*="company-name"]',
                    '[data-automation-id="jobPostingCompany"]',
                  ]);
                  // Fallback: extract from document.title (e.g. "Frontend Architect | Distyl | LinkedIn")
                  if (!title || !company) {
                    const docTitle = document.title || '';
                    // LinkedIn pattern: "Job Title | Company | LinkedIn" or "(N) Job Title | Company | LinkedIn"
                    const cleaned = docTitle.replace(/^\(\d+\)\s*/, '');
                    const parts = cleaned.split(/\s*[|·–—]\s*/);
                    if (parts.length >= 2) {
                      if (!title && parts[0].length < 200) title = parts[0].trim();
                      if (!company && parts[1] && parts[1] !== 'LinkedIn' && parts[1].length < 200) company = parts[1].trim();
                    }
                  }
                  let description = '';
                  for (const sel of [
                    '#job-details', '.jobs-description-content', '.jobs-description__content',
                    '.jobs-description-content__text', '.jobs-box__html-content',
                    '.show-more-less-html__markup', 'div.jobs-description',
                    'div[class*="jobs-description"]', 'section[class*="description"]',
                    '.job-description', '#job_description',
                    '[data-automation-id="jobPostingDescription"]',
                    '.posting-page', '.section-wrapper',
                    '[class*="job-description"]', '[class*="description"]',
                    'article', 'main',
                  ]) {
                    try {
                      const el = document.querySelector(sel);
                      if (el) {
                        const text = (el as HTMLElement).innerText || '';
                        if (text.trim().length > description.length) description = text.trim();
                      }
                    } catch (_) {}
                  }
                  if (description.length < 100) description = document.body.innerText.slice(0, 8000);
                  return { title, company, description };
                },
              });
              if (results?.[0]?.result) {
                pageJobInfo = results[0].result;
                console.log('[ProfileAI BG] ANALYZE_JOB_PAGE executeScript result:', {
                  title: pageJobInfo.title?.slice(0, 60),
                  company: pageJobInfo.company?.slice(0, 40),
                  descLength: pageJobInfo.description?.length || 0,
                });
              }
            } catch (e) {
              console.log('[ProfileAI BG] ANALYZE_JOB_PAGE executeScript failed:', e);
            }

            // Method 2: Ask content script (has richer site-specific extraction)
            try {
              const csResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
              if (csResponse) {
                // Use content script data if it's better (longer description, or has title/company we're missing)
                const csDescLen = csResponse.description?.trim().length || 0;
                const curDescLen = pageJobInfo?.description?.trim().length || 0;
                const csBetter = csDescLen > curDescLen
                  || (!pageJobInfo?.title && csResponse.title)
                  || (!pageJobInfo?.company && csResponse.company);
                if (csBetter) {
                  console.log('[ProfileAI BG] ANALYZE_JOB_PAGE got better data from content script:', {
                    title: csResponse.title?.slice(0, 60),
                    company: csResponse.company?.slice(0, 40),
                    descLength: csDescLen,
                  });
                  // Merge: prefer content script fields that are better
                  pageJobInfo = {
                    title: csResponse.title || pageJobInfo?.title || '',
                    company: csResponse.company || pageJobInfo?.company || '',
                    description: csDescLen > curDescLen ? csResponse.description : (pageJobInfo?.description || ''),
                    location: csResponse.location || pageJobInfo?.location || '',
                  };
                }
              }
            } catch (e) {
              console.log('[ProfileAI BG] ANALYZE_JOB_PAGE content script message failed:', e);
            }

            // Store in storage for future use
            if (pageJobInfo && (pageJobInfo.title || pageJobInfo.company || pageJobInfo.description)) {
              chrome.storage.local.set({ currentJobInfo: pageJobInfo, currentJobUrl: tab.url });
            }
          }
        } catch (e) {
          console.log('[ProfileAI BG] ANALYZE_JOB_PAGE tabs.query failed:', e);
        }
        // Storage fallback
        if (!pageJobInfo || (!pageJobInfo.description || pageJobInfo.description.trim().length < 30)) {
          try {
            const stored = await chrome.storage.local.get(['currentJobInfo']);
            if (stored.currentJobInfo && stored.currentJobInfo.description?.trim().length > (pageJobInfo?.description?.trim().length || 0)) {
              console.log('[ProfileAI BG] ANALYZE_JOB_PAGE using storage fallback, descLength:', stored.currentJobInfo.description?.length);
              pageJobInfo = stored.currentJobInfo;
            }
          } catch (_) {}
        }

        if (!pageJobInfo?.description || pageJobInfo.description.trim().length < 30) {
          console.log('[ProfileAI BG] ANALYZE_JOB_PAGE: no description found, pageJobInfo:', JSON.stringify(pageJobInfo)?.slice(0, 200));
          sendResponse({ success: false, error: 'Could not extract job description from this page. Try scrolling down to load the full job description, then click Analyze again.', jobInfo: pageJobInfo });
          break;
        }

        console.log('[ProfileAI BG] ANALYZE_JOB_PAGE: analyzing', pageJobInfo.description.length, 'chars');
        const analysisResult = await analyzeKeywords(pageJobInfo.description);
        sendResponse({ ...analysisResult, jobInfo: pageJobInfo });
        break;
      }
        
      case 'SYNC_AUTH_FROM_WEB':
        // Try to get auth from the web app
        await syncAuthFromWebApp();
        // If this sync completed a panel-initiated web sign-in, close the login
        // tab and return the user to the job page they started from.
        if (authToken && (await getPendingLogin())) {
          await finishExtensionLoginRedirect();
        }
        sendResponse({ 
          isAuthenticated: !!authToken,
          token: authToken,
          user: currentUser 
        });
        break;
        
      case 'TAILOR_PROFILE': {
        const tailorData = message.data as { jobDescription: string; jobTitle?: string; company?: string; jobUrl?: string; gapSelections?: { acceptedGaps: string[]; skippedGaps: string[]; acceptedGapObjects?: any[] }; tailorSettings?: any };
        // Persist in-flight state so the side panel can restore progress UI
        // when it's closed and reopened mid-tailor.
        const tailoringInFlight = {
          jobUrl: tailorData.jobUrl || '',
          jobTitle: tailorData.jobTitle || '',
          company: tailorData.company || '',
          startedAt: Date.now(),
        };
        try {
          await chrome.storage.local.set({ tailoringInFlight });
          await chrome.storage.local.remove(['tailoringResult', 'tailoringError']);
        } catch (_) {}

        const tailorResult = await tailorProfileForJob(tailorData.jobDescription, tailorData.jobTitle, tailorData.company, tailorData.gapSelections, tailorData.tailorSettings);

        // Persist the outcome so a closed-and-reopened side panel can pick it up.
        try {
          if (tailorResult?.success && tailorResult.tailoredProfile) {
            const tailored = {
              ...tailorResult.tailoredProfile,
              jobTitle: tailorData.jobTitle,
              company: tailorData.company,
              _skillGaps: tailorData.gapSelections?.acceptedGapObjects || [],
            };
            const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
            if (tailorData.jobUrl) {
              tailoredCache[tailorData.jobUrl] = tailored;
            }
            await chrome.storage.local.set({
              tailoredCache,
              tailoringResult: { jobUrl: tailorData.jobUrl || '', tailored, ts: Date.now() },
            });

            // Save to backend in the background as well, so it doesn't depend on the panel staying open.
            saveTailoredProfile({
              jobTitle: tailorData.jobTitle || '',
              jobUrl: tailorData.jobUrl,
              companyName: tailorData.company,
              tailoredData: tailored,
              matchScore: tailored.matchScore,
              skillGaps: tailorData.gapSelections?.acceptedGapObjects || [],
              learningPlan: tailorData.gapSelections ? {
                acceptedGaps: tailorData.gapSelections.acceptedGaps,
                skippedGaps: tailorData.gapSelections.skippedGaps,
                createdAt: new Date().toISOString(),
              } : null,
            }).catch(() => {});
          } else {
            await chrome.storage.local.set({
              tailoringError: { jobUrl: tailorData.jobUrl || '', error: tailorResult?.error || 'Tailoring failed', ts: Date.now() },
            });
          }
        } catch (_) {}
        try { await chrome.storage.local.remove('tailoringInFlight'); } catch (_) {}

        sendResponse(tailorResult);
        break;
      }

      case 'ANALYZE_GAPS': {
        const gapData = message.data as { jobDescription: string; jobTitle?: string; company?: string };
        const gapResult = await analyzeGapsForJob(gapData.jobDescription);
        sendResponse(gapResult);
        break;
      }

      case 'ANALYZE_KEYWORDS':
        const keywordData = message.data as { jobDescription: string };
        const keywordResult = await analyzeKeywords(keywordData.jobDescription);
        sendResponse(keywordResult);
        break;

      case 'GENERATE_AI_ANSWERS':
        const aiData = message.data as { questions: string[]; jobDescription: string; questionMeta?: Array<{ question: string; fieldType: string; options?: string[] | null }> };
        const aiResult = await generateAIAnswers(aiData.questions, aiData.jobDescription, aiData.questionMeta);
        sendResponse(aiResult);
        break;

      case 'SAVE_TAILORED_PROFILE': {
        const saveData = message.data as {
          jobTitle: string;
          jobUrl?: string;
          companyName?: string;
          tailoredData: any;
          matchScore?: number;
          skillGaps?: any[];
          learningPlan?: any;
        };
        const saveResult = await saveTailoredProfile(saveData);
        sendResponse(saveResult);
        break;
      }

      case 'REDEEM_PROMO': {
        const promoData = message.data as { code: string };
        const promoResult = await redeemPromoCode(promoData.code);
        sendResponse(promoResult);
        break;
      }

      case 'GENERATE_COVER_LETTER': {
        const clData = message.data as {
          jobTitle?: string;
          company?: string;
          jobDescription: string;
          tone?: string;
          length?: string;
        };
        const clResult = await generateCoverLetter(clData);
        sendResponse(clResult);
        break;
      }

      case 'SAVE_EXTERNAL_APPLICATION': {
        const appData = message.data as {
          jobTitle: string;
          company: string;
          jobUrl?: string;
          platform?: string;
          location?: string;
          matchScore?: number;
        };
        const saveAppResult = await saveExternalApplication(appData);
        sendResponse(saveAppResult);
        break;
      }

      case 'GENERATE_SMART_ANSWERS': {
        const data = message.data as {
          questions: Array<{ id: string; question: string; fieldType: string }>;
          jobInfo?: { title?: string; company?: string; description?: string } | null;
          jobUrl?: string;
        };
        const result = await generateSmartAnswers(data);
        sendResponse(result);
        break;
      }

      case 'GENERATE_SINGLE_ANSWER': {
        const data = message.data as {
          question: { id: string; question: string; fieldType: string };
          jobInfo?: { title?: string; company?: string; description?: string } | null;
          jobUrl?: string;
          forceRegenerate?: boolean;
        };
        const result = await generateSingleSmartAnswer(data);
        sendResponse(result);
        break;
      }

      case 'ANALYZE_MATCH': {
        const data = message.data as {
          jobTitle?: string;
          company?: string;
          jobDescription?: string;
        };
        const result = await analyzeMatch(data);
        sendResponse(result);
        break;
      }

      case 'ANALYZE_LINKEDIN_PROFILE': {
        const data = (message.data || {}) as { targetTitle?: string };
        const result = await analyzeLinkedInProfile(data.targetTitle);
        sendResponse(result);
        break;
      }

      case 'ANALYZE_LINKEDIN_PROFILE_GUEST': {
        const data = (message.data || {}) as { targetTitle?: string };
        const result = await analyzeLinkedInProfileGuest(data.targetTitle);
        sendResponse(result);
        break;
      }

      case 'SUBMIT_GUEST_REPORT_EMAIL': {
        const data = (message.data || {}) as { email: string; analysisId: string };
        const result = await submitGuestReportEmail(data);
        sendResponse(result);
        break;
      }

      case 'ANALYTICS_EVENT': {
        // Fire-and-forget from callers' perspective, but we await so any 4xx
        // is at least surfaced in the background console during dev.
        const data = (message.data || {}) as {
          name: string;
          sessionId?: string;
          properties?: Record<string, any>;
        };
        const result = await recordAnalyticsEvent(data);
        sendResponse(result);
        break;
      }

      case 'OPEN_LINKEDIN_EDITOR': {
        const data = (message.data || {}) as {
          section: 'headline' | 'about' | 'skills' | 'featured' | 'experience';
        };
        const result = await openLinkedInEditor(data.section);
        sendResponse(result);
        break;
      }

      case 'REWRITE_FIELD': {
        const data = (message.data || {}) as {
          text: string;
          action?: string;
          customPrompt?: string;
          fieldKind?: string;
          targetTitle?: string;
        };
        const result = await rewriteField(data);
        sendResponse(result);
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[ProfileAI] Error handling message:', error);
    sendResponse({ error: (error as Error).message });
  }
}

// After a panel-initiated web sign-in (or sign-up) completes, close the
// login/register tab and bring the user back to the job page they came from,
// with the side panel open — it's per-window and normally stays open across
// the flow, but this covers the case where it got closed in the meantime.
async function finishExtensionLoginRedirect(): Promise<void> {
  const pending = await getPendingLogin();
  await clearPendingLogin();
  if (!pending) return;
  try {
    if (pending.loginTabId != null) {
      try { await chrome.tabs.remove(pending.loginTabId); } catch (_) {}
    }
    if (pending.originTabId != null) {
      try { await chrome.tabs.update(pending.originTabId, { active: true }); } catch (_) {}
    }
    if (pending.originWindowId != null) {
      try { await chrome.windows.update(pending.originWindowId, { focused: true }); } catch (_) {}
      try { await chrome.sidePanel.open({ windowId: pending.originWindowId }); } catch (_) {}
    }
  } catch (_) {
    /* best-effort — never block the auth flow on tab housekeeping */
  }
}

// Sync auth from web app by checking localStorage in web app tabs
async function syncAuthFromWebApp(): Promise<boolean> {
  if (authToken) return true; // Already authenticated
  
  console.log('[ProfileAI] Attempting to sync auth from web app...');
  
  // If a panel-initiated sign-in is in progress, only accept an auth blob the
  // web app wrote AFTER the flow started (via the extension bridge). This stops
  // a stale prior session from syncing the wrong user before the real login.
  // Read from storage because the MV3 worker may have restarted since the flow
  // began, which would otherwise drop this guard.
  const pending = await getPendingLogin();
  const requireFreshSince = pending?.startedAt ?? null;
  
  // If the user explicitly signed out of the extension, don't silently re-sync
  // from a web app tab that's still logged in — unless they've explicitly
  // started a new sign-in flow from the panel.
  if (!pending) {
    try {
      const { extSignedOut } = await chrome.storage.local.get('extSignedOut');
      if (extSignedOut) {
        console.log('[ProfileAI] Skipping web sync — user signed out of extension');
        return false;
      }
    } catch (_) { /* ignore */ }
  }
  
  try {
    // Try multiple approaches:
    
    // 1. First, check ALL tabs for any that might have our app
    const allTabs = await chrome.tabs.query({});
    console.log(`[ProfileAI] Checking ${allTabs.length} total tabs`);
    
    // Filter for tabs that might be our web app
    const webAppTabs = allTabs.filter(tab => 
      tab.url && (
        tab.url.includes('localhost:3000') ||
        tab.url.includes('profilleai.com') ||
        tab.url.includes('127.0.0.1:3000')
      )
    );
    
    console.log(`[ProfileAI] Found ${webAppTabs.length} potential web app tabs`);
    
    for (const tab of webAppTabs) {
      if (!tab.id) continue;
      
      try {
        console.log(`[ProfileAI] Trying tab ${tab.id}: ${tab.url}`);
        
        // Execute script to get localStorage values. When a panel sign-in is in
        // progress we read the bridge blob (which carries a timestamp) so we can
        // tell a fresh login apart from a stale pre-existing session.
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const token = localStorage.getItem('token');
              const userStr = localStorage.getItem('user');
              let bridge: { token?: string; user?: any; timestamp?: number } | null = null;
              try {
                const raw = localStorage.getItem('profileai_extension_auth');
                if (raw) bridge = JSON.parse(raw);
              } catch (_) { /* ignore */ }
              return {
                token,
                user: userStr ? JSON.parse(userStr) : null,
                bridgeToken: bridge?.token ?? null,
                bridgeUser: bridge?.user ?? null,
                bridgeTimestamp: bridge?.timestamp ?? null,
              };
            } catch (e) {
              return { token: null, user: null, bridgeToken: null, bridgeUser: null, bridgeTimestamp: null, error: String(e) };
            }
          },
        });
        
        const result = results[0]?.result;
        console.log('[ProfileAI] Script result:', { 
          hasToken: !!result?.token, 
          hasUser: !!result?.user,
          bridgeTimestamp: result?.bridgeTimestamp,
          error: (result as any)?.error 
        });
        
        if (requireFreshSince != null) {
          const priorToken = pending?.priorToken ?? null;

          // Primary signal: a genuine new login changes the stored token from
          // whatever was there when the flow started. This is bulletproof
          // against stale/other-account sessions and bridge-blob races.
          if (result?.token && result?.user && result.token !== priorToken) {
            await handleLogin(result.token, result.user);
            console.log('[ProfileAI] ✓ Synced fresh auth (token changed) from web sign-in');
            return true;
          }

          // Secondary signal: the user explicitly confirmed the existing account
          // ("Continue as …"), which writes a fresh bridge blob. The deployed web
          // app no longer auto-syncs an existing session, so a bridge blob newer
          // than the flow start always reflects a deliberate user action.
          if (
            result?.bridgeToken &&
            result?.bridgeUser &&
            typeof result.bridgeTimestamp === 'number' &&
            result.bridgeTimestamp >= requireFreshSince
          ) {
            await handleLogin(result.bridgeToken, result.bridgeUser);
            console.log('[ProfileAI] ✓ Synced fresh auth (bridge) from web sign-in');
            return true;
          }
          // Otherwise keep waiting — don't fall back to a token that matches the
          // stale prior session.
          continue;
        }
        
        if (result?.token && result?.user) {
          await handleLogin(result.token, result.user);
          console.log('[ProfileAI] ✓ Successfully synced auth from web app tab');
          return true;
        }
      } catch (e) {
        console.log(`[ProfileAI] Could not execute script in tab ${tab.id}:`, e);
      }
    }
    
    console.log('[ProfileAI] No authenticated web app tab found');
    return false;
    
  } catch (error) {
    console.log('[ProfileAI] Could not sync auth from web app:', error);
    return false;
  }
}

// Listen for auth broadcast from web app
chrome.runtime.onMessageExternal?.addListener((message, sender, sendResponse) => {
  console.log('[ProfileAI] Received external message:', message.type, 'from:', sender.origin);
  
  if (message.type === 'PROFILEAI_AUTH_BROADCAST') {
    if (message.token && message.user) {
      handleLogin(message.token, message.user).then(() => {
        console.log('[ProfileAI] Auth synced from web app broadcast');
        sendResponse({ success: true });
      });
    }
  }
  return true;
});

// Silent auth check - just try to sync from web app
async function silentAuthCheck(): Promise<boolean> {
  if (authToken) return true;
  return await syncAuthFromWebApp();
}

// Auth functions
async function loadAuthFromStorage() {
  const data = await chrome.storage.local.get(['authToken', 'user']);
  authToken = data.authToken || null;
  currentUser = data.user || null;
  
  if (authToken) {
    // Validate token by fetching profile
    try {
      await fetchProfile();
    } catch (error) {
      console.log('[ProfileAI] Token invalid, logging out');
      await handleLogout();
    }
  } else {
    // Try to sync from web app if no stored auth
    await syncAuthFromWebApp();
  }
}

async function handleLogin(token: string, user: User) {
  authToken = token;
  currentUser = user;
  // Drop any profile cached for a previous account so we never show stale data
  // for the newly signed-in user while the fresh profile loads.
  cachedProfile = null;
  await chrome.storage.local.remove(['profile', 'extSignedOut']);
  await chrome.storage.local.set({ authToken: token, user });
  
  // Fetch and cache profile
  await fetchProfile();
}

async function loginWithCredentials(email: string, password: string) {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || data.errors?.[0]?.msg || 'Login failed' };
    }
    await handleLogin(data.token, data.user);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('[ProfileAI] Login error:', error);
    return { success: false, error: 'Could not connect to server' };
  }
}

async function registerWithCredentials(data: { email: string; password: string; firstName: string; lastName: string; role?: string }) {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      return { success: false, error: result.error || result.errors?.[0]?.msg || 'Registration failed' };
    }
    await handleLogin(result.token, result.user);
    return { success: true, token: result.token, user: result.user };
  } catch (error) {
    console.error('[ProfileAI] Register error:', error);
    return { success: false, error: 'Could not connect to server' };
  }
}

async function handleLogout() {
  authToken = null;
  currentUser = null;
  cachedProfile = null;
  // Mark an explicit sign-out so we don't immediately re-sync from a web app
  // tab that's still logged in. Cleared on the next explicit sign-in.
  await chrome.storage.local.set({ extSignedOut: true });
  await clearPendingLogin();
  await chrome.storage.local.remove(['authToken', 'user', 'profile']);
}

// Analyze skill gaps between profile and job
async function analyzeGapsForJob(jobDescription: string) {
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    if (!cachedProfile) {
      await fetchProfile();
    }
    if (!cachedProfile) {
      return { success: false, error: 'Profile not found. Please complete your profile first.' };
    }

    const response = await fetch(`${CONFIG.API_BASE}/profiles/analyze-gaps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileData: cachedProfile,
        jobDescription,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze gaps');
    }

    const data = await response.json();
    return { success: true, gaps: data.gaps || [], satisfiedAlternatives: data.satisfiedAlternatives || [] };
  } catch (error) {
    console.error('[ProfileAI] Error analyzing gaps:', error);
    return { success: false, error: (error as Error).message, gaps: [], satisfiedAlternatives: [] };
  }
}

// Tailor profile for job
async function tailorProfileForJob(
  jobDescription: string,
  jobTitle?: string,
  company?: string,
  gapSelections?: { acceptedGaps: string[]; skippedGaps: string[]; acceptedGapObjects?: any[] } | null,
  tailorSettings?: any
) {
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    // Ensure we have profile data before tailoring
    if (!cachedProfile) {
      await fetchProfile();
    }
    if (!cachedProfile) {
      return { success: false, error: 'Profile not found. Please complete your profile first.' };
    }

    const response = await fetch(`${CONFIG.API_BASE}/profiles/tailor-for-job`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileData: cachedProfile,
        jobDescription,
        jobTitle,
        company,
        gapSelections: gapSelections || undefined,
        tailorSettings: tailorSettings || undefined,
        // Pass-through style guidance for backend prompt — encourages
        // specific, human-sounding language tied to this job (no buzzword stuffing).
        styleHints: {
          humanize: true,
          avoidBuzzwords: true,
          specificAndConcrete: true,
          notes: 'Phrase rewritten bullets as how a senior practitioner would actually describe the work in conversation. Use concrete details. No corporate fluff. Tie clearly to the job description above.',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to tailor profile');
    }

    const data = await response.json();
    // Backend returns { success, data: {...} } — normalize to tailoredProfile
    const tailoredProfile = data.data || data.tailoredProfile || data;
    return { success: true, tailoredProfile };
  } catch (error) {
    console.error('[ProfileAI] Error tailoring profile:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Save tailored profile to backend
async function saveTailoredProfile(data: {
  jobTitle: string;
  jobUrl?: string;
  companyName?: string;
  tailoredData: any;
  matchScore?: number;
  skillGaps?: any[];
  learningPlan?: any;
}) {
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    const response = await fetch(`${CONFIG.API_BASE}/tailored-profiles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobTitle: data.jobTitle,
        jobUrl: data.jobUrl || null,
        companyName: data.companyName || null,
        tailoredData: data.tailoredData,
        matchScore: data.matchScore || null,
        skillGaps: data.skillGaps || [],
        learningPlan: data.learningPlan || null,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save tailored profile');
    }
    const result = await response.json();
    return { success: true, savedProfile: result };
  } catch (error) {
    console.error('[ProfileAI] Error saving tailored profile:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Redeem a promo code via backend
async function redeemPromoCode(code: string) {
  if (!authToken) {
    return { error: 'Not authenticated — sign in first' };
  }
  try {
    const response = await fetch(`${CONFIG.API_BASE}/promo/redeem`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    const result = await response.json();
    if (!response.ok) {
      return { error: result.error || 'Failed to redeem promo code' };
    }
    return result; // { success, message, benefit, expiresAt, redemption }
  } catch (error) {
    console.error('[ProfileAI] Error redeeming promo code:', error);
    return { error: (error as Error).message };
  }
}

// Generate a cover letter for a job posting
async function generateCoverLetter(data: {
  jobTitle?: string;
  company?: string;
  jobDescription: string;
  tone?: string;
  length?: string;
}) {
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  try {
    if (!cachedProfile) {
      await fetchProfile();
    }
    if (!cachedProfile) {
      return { success: false, error: 'Profile not found. Please complete your profile first.' };
    }

    const response = await fetch(`${CONFIG.API_BASE}/profiles/generate-cover-letter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobTitle: data.jobTitle,
        company: data.company,
        jobDescription: data.jobDescription,
        tone: data.tone || 'conversational',
        length: data.length || 'short',
        // Style guidance — pass-through hints the backend prompt can incorporate.
        // Forward-compatible: ignored if the API doesn't read it yet.
        styleHints: {
          humanize: true,
          avoidBuzzwords: true,
          tightLanguage: true,
          notes: 'Write like a real person. Specific, concise, no corporate fluff or buzzword stuffing. Tie tightly to the candidate profile and the job description above.',
        },
        profile: {
          firstName: cachedProfile.firstName,
          lastName: cachedProfile.lastName,
          title: (cachedProfile as any).title || (cachedProfile as any).headline,
          summary: cachedProfile.summary,
          skills: cachedProfile.skills,
          experience: cachedProfile.experience,
          education: cachedProfile.education,
          location: (cachedProfile as any).location,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate cover letter');
    }

    const result = await response.json();
    return { success: true, coverLetter: result.coverLetter };
  } catch (error) {
    console.error('[ProfileAI] Error generating cover letter:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Keyword analysis — runs entirely client-side, no backend needed
async function analyzeKeywords(jobDescription: string) {
  try {
    // Always refresh profile to get latest skills
    await fetchProfile();
    
    const profile = cachedProfile || {} as any;
    
    // Debug: log what we got
    console.log('[ProfileAI] Analyzing keywords:', {
      hasProfile: !!cachedProfile,
      descriptionLength: jobDescription?.length || 0,
      descriptionPreview: jobDescription?.slice(0, 200) || '(empty)',
      skills: profile.skills,
      skillsType: typeof profile.skills,
      experience: Array.isArray(profile.experience) ? profile.experience.length : 0,
    });
    
    const keywords = extractKeywordsLocal(jobDescription, profile);
    
    console.log('[ProfileAI] Keyword analysis result:', {
      totalKeywords: keywords.totalKeywords,
      present: keywords.present,
      missing: keywords.missing,
      matchScore: keywords.matchScore,
    });
    
    return { success: true, keywords };
  } catch (error) {
    console.error('[ProfileAI] Keyword analysis error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Generic soft-skill / business terms that show up in nearly every JD as filler.
// We require ≥2 occurrences for these to count, otherwise a single mention of
// "communication" or "leadership" in a boilerplate sentence dominates the missing list.
const SOFT_SKILL_FLUFF = new Set<string>([
  'communication', 'leadership', 'teamwork', 'collaboration',
  'mentoring', 'coaching', 'presentation', 'critical thinking', 'analytical',
  'attention to detail', 'time management', 'organizational skills',
  'problem solving', 'strategy', 'operations',
  // Business terms that frequently appear as competitor / example mentions, NOT requirements
  'sales', 'marketing', 'salesforce', 'hubspot', 'sap', 'erp', 'crm',
]);

function extractKeywordsLocal(jobDescription: string, profile: any) {
  if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
    console.warn('[ProfileAI] extractKeywordsLocal: description too short or missing', { length: jobDescription?.length });
    return { totalKeywords: 0, matchScore: 0, present: [], missing: [] };
  }

  // Stash the original (case-preserved) JD on globalThis so extractDynamicKeywords
  // can use case as a proper-noun signal (e.g. "Cypress" vs. "cypress" leaking
  // from "experience with the company"). Also keep a lowercased copy for matching.
  (globalThis as any).__profileai_lastJobDescription = jobDescription;
  const text = jobDescription.toLowerCase();
  // Comprehensive keyword list covering tech, business, and soft skills
  const knownKeywords = [
    // Programming languages
    'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'go', 'golang',
    'rust', 'swift', 'kotlin', 'scala', 'php', 'perl', 'r lang', 'matlab', 'dart',
    'elixir', 'haskell', 'lua', 'objective-c', 'groovy', 'powershell', 'bash', 'shell scripting',
    // Frontend
    'react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby',
    'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap', 'material ui',
    'webpack', 'vite', 'rollup', 'babel', 'storybook',
    'redux', 'mobx', 'zustand', 'recoil',
    'frontend', 'front-end', 'front end',
    // Backend
    'node.js', 'nodejs', 'express', 'fastify', 'nestjs', 'django', 'flask', 'fastapi',
    'spring', 'spring boot', '.net', 'asp.net', 'rails', 'ruby on rails', 'laravel',
    'backend', 'back-end', 'back end',
    'microservices', 'serverless',
    'rest', 'restful', 'graphql', 'grpc', 'websocket', 'api',
    // Databases
    'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'cassandra', 'dynamodb', 'firebase', 'supabase', 'sqlite', 'oracle', 'mariadb', 'neo4j',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
    'terraform', 'ansible', 'puppet', 'cloudformation',
    'jenkins', 'github actions', 'gitlab ci', 'circleci',
    'ci/cd', 'cicd', 'devops', 'sre', 'infrastructure',
    'nginx', 'apache', 'load balancing', 'cdn',
    'linux', 'unix', 'windows server',
    'cloud', 'cloud computing',
    'prometheus', 'grafana', 'datadog', 'splunk', 'monitoring',
    // Data & ML
    'machine learning', 'deep learning', 'neural network', 'nlp',
    'natural language processing', 'computer vision',
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
    'data science', 'data engineering', 'data analysis', 'analytics',
    'etl', 'data pipeline', 'data warehouse', 'snowflake', 'databricks', 'airflow',
    'tableau', 'power bi', 'looker',
    'big data', 'hadoop', 'spark', 'kafka',
    'ai', 'artificial intelligence', 'llm', 'generative ai',
    'statistics', 'regression', 'classification',
    // Mobile
    'ios', 'android', 'react native', 'flutter', 'swiftui',
    'mobile', 'mobile development',
    // Design & UX
    'figma', 'sketch', 'adobe xd', 'invision',
    'ux', 'ui', 'ux design', 'ui design', 'user experience', 'user interface',
    'wireframe', 'prototype', 'design system', 'accessibility',
    'responsive design', 'interaction design',
    // Testing & QA
    'unit testing', 'integration testing', 'e2e testing', 'end-to-end',
    'jest', 'mocha', 'cypress', 'selenium', 'playwright', 'puppeteer',
    'tdd', 'bdd', 'qa', 'quality assurance', 'automation testing', 'test automation',
    // Project & product
    'agile', 'scrum', 'kanban', 'waterfall', 'lean', 'safe',
    'sprint', 'backlog', 'product owner', 'scrum master',
    'project management', 'product management', 'program management',
    'jira', 'confluence', 'asana', 'trello',
    'roadmap', 'stakeholder management',
    // Security
    'security', 'cybersecurity', 'infosec', 'penetration testing',
    'encryption', 'authentication', 'authorization', 'oauth', 'jwt', 'sso',
    'owasp', 'compliance', 'gdpr', 'soc 2',
    // Version control
    'git', 'github', 'gitlab', 'bitbucket', 'code review', 'pull request',
    // Architecture
    'system design', 'distributed systems', 'high availability', 'scalability',
    'performance', 'caching', 'message queue', 'rabbitmq', 'event-driven',
    'design patterns', 'clean architecture',
    'full stack', 'fullstack', 'full-stack',
    // General tech
    'web development', 'software engineering', 'software development',
    'open source', 'documentation', 'technical writing',
    // Soft skills
    'communication', 'leadership', 'teamwork', 'collaboration', 'problem solving',
    'mentoring', 'coaching', 'presentation', 'critical thinking', 'analytical',
    'attention to detail', 'time management', 'organizational skills',
    // Business / non-tech
    'marketing', 'digital marketing', 'content marketing', 'seo', 'sem',
    'sales', 'business development', 'strategy',
    'crm', 'salesforce', 'hubspot', 'sap', 'erp',
    'excel', 'powerpoint', 'google analytics',
    'financial analysis', 'budgeting', 'forecasting',
    'supply chain', 'logistics', 'operations',
    'customer service', 'customer success', 'account management',
    'negotiation', 'procurement',
    'human resources', 'recruiting', 'talent acquisition',
    'risk management', 'audit',
  ];

  // --- Phase 1: Check known keywords against job description ---
  // Use word-boundary matching for ALL keywords to avoid substring false positives
  // (e.g. "less" matching "wireless", "lean" matching "clean", "rust" matching "trust",
  //  "safe" matching "safety", "sales" matching "wholesales", etc.).
  // We also count occurrences so we can drop "mentioned once in passing" noise like
  // a competitor name or an example product appearing in the company description.
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countMatches = (text: string, keyword: string): number => {
    // Multi-word keywords with non-alphanum chars (e.g. ".net", "c++", "ci/cd") need a
    // looser boundary — \b doesn't behave well around symbols. Fall back to a simple
    // word-edge check using lookarounds against alphanumerics.
    const hasSymbol = /[^a-z0-9 ]/i.test(keyword);
    const pattern = hasSymbol
      ? `(?<![a-z0-9])${escapeRegex(keyword)}(?![a-z0-9])`
      : `\\b${escapeRegex(keyword)}\\b`;
    try {
      const matches = text.match(new RegExp(pattern, 'gi'));
      return matches ? matches.length : 0;
    } catch {
      // Defensive fallback if a runtime doesn't support lookbehind
      const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
      const matches = text.match(re);
      return matches ? matches.length : 0;
    }
  };

  // Short keywords (≤3 chars: "ai", "go", "ux", "ui", "qa", "r lang", etc.) are
  // particularly noisy — require ≥1 strong hit but treat them as low-confidence
  // unless they appear inside a requirements-like context.
  const foundSet = new Set<string>();
  for (const keyword of knownKeywords) {
    const count = countMatches(text, keyword);
    if (count === 0) continue;
    // Generic fluff terms ("communication", "leadership", "teamwork") need to
    // appear at least twice to be treated as a real requirement, not a throwaway
    // line in the company blurb. Same for any short ≤3-char keyword.
    const isFluff = SOFT_SKILL_FLUFF.has(keyword) || keyword.length <= 3;
    if (isFluff && count < 2) continue;
    foundSet.add(keyword);
  }

  // --- Phase 2: Extract skills dynamically from requirements/qualifications ---
  // Strict mode: only accept phrases that look like proper proper nouns / tech terms,
  // OR are already in our known vocabulary. Generic categorical phrases like
  // "design systems", "testing frameworks", "user interface" get filtered out
  // because they collapse to known aliases or fail the quality filter.
  const knownKeywordsLower = new Set(knownKeywords.map(k => k.toLowerCase()));
  const dynamicSkills = extractDynamicKeywords(text, knownKeywordsLower);
  for (const skill of dynamicSkills) {
    foundSet.add(skill);
  }

  // Deduplicate aliases (e.g., keep "node.js" not both "node.js" and "nodejs")
  const aliases: Record<string, string> = {
    'nodejs': 'node.js', 'nextjs': 'next.js', 'front-end': 'frontend',
    'front end': 'frontend', 'back-end': 'backend', 'back end': 'backend',
    'full-stack': 'full stack', 'fullstack': 'full stack', 'cicd': 'ci/cd',
    'postgres': 'postgresql', 'k8s': 'kubernetes', 'golang': 'go',
    'restful': 'rest',
    // Plural / variant collapse — fixes "design system" + "design systems" duplication
    'design systems': 'design system',
    'testing frameworks': 'unit testing',
    'test automation': 'automation testing',
    'user interface': 'ui',
    'user experience': 'ux',
    'natural language processing': 'nlp',
    'artificial intelligence': 'ai',
    'machine-learning': 'machine learning',
  };
  const deduped = new Set<string>();
  for (const kw of foundSet) {
    deduped.add(aliases[kw] || kw);
  }
  const foundInJob = Array.from(deduped);

  console.log('[ProfileAI] Keywords found in job description:', foundInJob.length, foundInJob.slice(0, 20));

  // --- Match against user profile ---
  const profileSkills = flattenSkills(profile.skills);
  const experienceSkills = extractSkillsFromExperience(profile.experience);
  const allProfileSkills = [...new Set([...profileSkills, ...experienceSkills])];

  console.log('[ProfileAI] Extracted profile skills:', {
    fromSkillsField: profileSkills,
    fromExperience: experienceSkills,
    combined: allProfileSkills,
  });

  const present: string[] = [];
  const missing: string[] = [];

  for (const keyword of foundInJob) {
    const hasSkill = allProfileSkills.some((skill) => {
      if (skill === keyword) return true;
      if (skill.includes(keyword) || keyword.includes(skill)) return true;
      const normSkill = skill.replace(/[.\-\s]/g, '').toLowerCase();
      const normKeyword = keyword.replace(/[.\-\s]/g, '').toLowerCase();
      return normSkill === normKeyword || normSkill.includes(normKeyword) || normKeyword.includes(normSkill);
    });
    if (hasSkill) {
      present.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const matchScore = foundInJob.length > 0 ? Math.round((present.length / foundInJob.length) * 100) : 0;

  return { totalKeywords: foundInJob.length, matchScore, present, missing };
}

/**
 * Dynamically extract skill-like terms from job description text
 * using requirement patterns and structural cues.
 *
 * Strict-mode quality bar: only accept phrases that either
 *   (a) match a known-vocabulary keyword, or
 *   (b) look like a proper noun / tech term (capitalized in source, contains
 *       a tech symbol, or is a tight 1–2-word phrase that survives the stop-word
 *       and generic-category filters).
 */
function extractDynamicKeywords(text: string, knownVocab: Set<string>): string[] {
  const skills = new Set<string>();

  // Phrases that are too generic to be useful — they'd just become noise in the
  // missing-keywords list. Each of these is a category, not a concrete skill.
  const GENERIC_REJECT = new Set<string>([
    'testing frameworks', 'design systems', 'user interface', 'user experience',
    'best practices', 'modern technologies', 'cutting edge', 'cutting-edge',
    'related field', 'similar role', 'similar field', 'relevant experience',
    'computer science', 'engineering', 'programming', 'development',
    'software', 'software development', 'software engineering',
    'web', 'mobile', 'cloud', 'data', 'tools', 'frameworks', 'libraries',
    'web technologies', 'modern web', 'frontend technologies', 'backend technologies',
    'team', 'product', 'company', 'business', 'industry', 'environment',
    'multiple programming languages', 'one or more', 'related discipline',
    'complex systems', 'large scale', 'large-scale', 'distributed systems',
    'real-time', 'high-performance', 'scalable systems',
  ]);

  const STOPWORD_PREFIX = /^(?:the|a|an|our|their|various|multiple|different|other|both|all|some|most|any|several|many|few|new|same|such|these|those)\s+/i;

  const isLowQuality = (phrase: string): boolean => {
    if (!phrase) return true;
    if (phrase.length < 2 || phrase.length > 35) return true;
    if (/^\d+$/.test(phrase)) return true;
    if (/^(?:years?|months?|etc|e\.g|i\.e|ex\.)/i.test(phrase)) return true;
    // Reject if the phrase is mostly stopwords / verbs / fluff
    if (GENERIC_REJECT.has(phrase)) return true;
    // Reject if the phrase ends with a verb-like pattern
    if (/\b(?:and|or|with|to|in|for|of|by|using|including|such as|like|on|at|from)\s*$/i.test(phrase)) return true;
    // Must contain at least one alphabetic character
    if (!/[a-z]/i.test(phrase)) return true;
    // Reject sentences (anything with a verb-like structure: "build apps that scale")
    const wordCount = phrase.split(/\s+/).length;
    if (wordCount > 3) return true;
    return false;
  };

  const accept = (raw: string) => {
    let phrase = raw.trim().toLowerCase();
    phrase = phrase.replace(STOPWORD_PREFIX, '').trim();
    // Strip trailing punctuation / connectives
    phrase = phrase.replace(/\s*(?:and|or|etc\.?|including|such as|with|in|of|for|to)\s*$/i, '').trim();
    if (isLowQuality(phrase)) return;
    // Either the phrase is in our known vocab (highly trusted), OR it has a
    // tech-style marker (dot, slash, plus, hash, capitalization in source).
    const inVocab = knownVocab.has(phrase);
    const hasTechMarker = /[./+#-]/.test(phrase) || /\d/.test(phrase);
    if (!inVocab && !hasTechMarker) {
      // For 1-word phrases without tech markers, only accept if it appears
      // capitalized somewhere in the source text (proper-noun heuristic).
      const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const titleCaseRe = new RegExp(`\\b${phrase.split(/\s+/).map(w => w[0]?.toUpperCase() + w.slice(1)).join('\\s+')}\\b`);
      if (!titleCaseRe.test(jobDescriptionRaw) && phrase.split(/\s+/).length === 1) return;
      // Multi-word non-vocab phrases are too noisy — drop them entirely.
      if (phrase.split(/\s+/).length > 1) return;
    }
    skills.add(phrase);
  };

  // We need access to the original (non-lowercased) text for proper-noun checks.
  // Caller passes a lowercased `text`; recover the original via globalThis if available
  // — otherwise fall back to using the lowercased text (no proper-noun bonus).
  const jobDescriptionRaw = (globalThis as any).__profileai_lastJobDescription || text;

  // Pattern 1: "experience with/in X", "knowledge of X", "proficiency in X", "expertise in X"
  const requirementPatterns = [
    /(?:experience|proficiency|expertise|knowledge|familiarity|background)\s+(?:with|in|of|using)\s+([^.,;()\n]+)/gi,
    /(?:skilled|proficient|experienced|fluent)\s+(?:in|with)\s+([^.,;()\n]+)/gi,
    /(?:strong|solid|deep|good|excellent)\s+(?:understanding|knowledge|grasp)\s+(?:of|in)\s+([^.,;()\n]+)/gi,
    /(?:hands-on|hands on)\s+(?:experience|work)\s+(?:with|in|on)\s+([^.,;()\n]+)/gi,
  ];

  for (const pattern of requirementPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Split on "and", "or", "/" to get individual skills
      const parts = match[1].split(/\s+(?:and|or|&)\s+|[/,]/).map(s => s.trim());
      for (const part of parts) accept(part);
    }
  }

  return Array.from(skills);
}

// Flatten skills from any format into a lowercase string array
function flattenSkills(skills: any): string[] {
  console.log('[ProfileAI] flattenSkills input:', { skills, type: typeof skills, isArray: Array.isArray(skills) });
  
  if (!skills) {
    console.log('[ProfileAI] flattenSkills: skills is null/undefined');
    return [];
  }

  // Array of strings or objects: [{name: 'React'}, 'JavaScript', ...]
  if (Array.isArray(skills)) {
    const result = skills
      .map((s: any) => (typeof s === 'string' ? s : s?.name || s?.skill || '').toLowerCase())
      .filter(Boolean);
    console.log('[ProfileAI] flattenSkills (array):', result);
    return result;
  }

  // String: "React, Node.js, TypeScript"
  if (typeof skills === 'string') {
    const result = skills.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    console.log('[ProfileAI] flattenSkills (string):', result);
    return result;
  }

  // Categorized object: { frontend: ['React', ...], backend: ['Node.js', ...] }
  if (typeof skills === 'object' && skills !== null) {
    const all: string[] = [];
    for (const [category, value] of Object.entries(skills)) {
      console.log('[ProfileAI] flattenSkills processing category:', category, value);
      if (Array.isArray(value)) {
        (value as any[]).forEach((s: any) => {
          const name = (typeof s === 'string' ? s : s?.name || s?.skill || '').toLowerCase();
          if (name) all.push(name);
        });
      } else if (typeof value === 'string') {
        all.push((value as string).toLowerCase());
      }
    }
    console.log('[ProfileAI] flattenSkills (object):', all);
    return all;
  }

  console.log('[ProfileAI] flattenSkills: unhandled format');
  return [];
}

// Extract skills mentioned in experience descriptions and titles
function extractSkillsFromExperience(experience: any[]): string[] {
  if (!experience || !Array.isArray(experience)) return [];
  
  const techKeywordsToFind = [
    'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'go', 'golang',
    'rust', 'swift', 'kotlin', 'scala', 'php', 'react', 'angular', 'vue', 'svelte',
    'next.js', 'nextjs', 'nuxt', 'node.js', 'nodejs', 'express', 'nestjs',
    'django', 'flask', 'fastapi', 'spring', 'spring boot', '.net', 'rails', 'laravel',
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
    'terraform', 'ansible', 'jenkins', 'github actions', 'gitlab ci', 'circleci',
    'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'dynamodb', 'firebase', 'supabase', 'cassandra', 'neo4j',
    'graphql', 'rest', 'restful', 'grpc', 'api', 'websocket',
    'git', 'github', 'gitlab', 'bitbucket',
    'agile', 'scrum', 'kanban', 'ci/cd', 'devops', 'sre',
    'machine learning', 'deep learning', 'nlp', 'computer vision',
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy',
    'data science', 'data engineering', 'data analysis', 'analytics',
    'tableau', 'power bi', 'looker', 'snowflake', 'databricks', 'airflow',
    'hadoop', 'spark', 'kafka',
    'figma', 'sketch', 'adobe xd', 'ux', 'ui',
    'jest', 'mocha', 'cypress', 'selenium', 'playwright',
    'product management', 'project management',
    'frontend', 'backend', 'full stack', 'fullstack',
    'web', 'mobile', 'ios', 'android', 'react native', 'flutter',
    'css', 'html', 'sass', 'tailwind', 'bootstrap',
    'webpack', 'vite', 'rollup',
    'redux', 'mobx', 'zustand',
    'nginx', 'linux', 'unix',
    'cloud', 'serverless', 'microservices',
    'security', 'cybersecurity', 'encryption', 'oauth', 'jwt',
    'monitoring', 'prometheus', 'grafana', 'datadog',
    'communication', 'leadership', 'mentoring', 'collaboration',
    'salesforce', 'hubspot', 'sap', 'erp', 'crm',
    'excel', 'seo', 'google analytics',
    'marketing', 'sales', 'strategy', 'operations',
  ];
  
  const found: Set<string> = new Set();
  
  experience.forEach((exp: any) => {
    // Combine all text fields from experience (handle both title and position field names)
    const textToSearch = [
      exp.title || exp.position || '',
      exp.description || '',
      exp.company || '',
      ...(exp.achievements || []),
      ...(exp.skills || []).map((s: any) => typeof s === 'string' ? s : s?.name || ''),
    ].join(' ').toLowerCase();
    
    // Find matching tech keywords
    techKeywordsToFind.forEach(keyword => {
      // Use word boundary matching for better accuracy
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(textToSearch) || textToSearch.includes(keyword)) {
        found.add(keyword);
      }
    });
  });
  
  return Array.from(found);
}

// AI-powered answer generation for screening questions
async function generateAIAnswers(questions: string[], jobDescription: string, questionMeta?: Array<{ question: string; fieldType: string; options?: string[] | null }>) {
  try {
    if (!cachedProfile) await fetchProfile();
    const profile = cachedProfile || ({} as any);

    // Load seed answers for personalized context
    const { seedAnswers } = await chrome.storage.local.get('seedAnswers');

    if (!authToken) {
      // Not authenticated — use local fallback
      return { answers: generateLocalAnswers(questions, profile, seedAnswers || {}) };
    }

    console.log('[ProfileAI] Generating AI answers for', questions.length, 'questions');

    const response = await fetch(`${CONFIG.API_BASE}/profiles/generate-answers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questions,
        jobDescription,
        questionMeta: questionMeta || questions.map(q => ({ question: q, fieldType: 'text', options: null })),
        profile: {
          title: profile.title || profile.headline,
          summary: profile.summary,
          skills: profile.skills,
          experience: profile.experience,
          education: profile.education,
          location: profile.location,
        },
        // Include seed answers for better personalization
        seedAnswers: seedAnswers || {},
      }),
    });

    if (!response.ok) {
      console.log('[ProfileAI] API failed, using local answer generation');
      return { answers: generateLocalAnswers(questions, profile, seedAnswers || {}) };
    }

    const result = await response.json();
    return { answers: result.answers || result.data?.answers || {} };
  } catch (error) {
    console.error('[ProfileAI] AI answer generation error:', error);
    // Fallback to local
    const profile = cachedProfile || ({} as any);
    const { seedAnswers } = await chrome.storage.local.get('seedAnswers');
    return { answers: generateLocalAnswers(questions, profile, seedAnswers || {}) };
  }
}

// Local fallback answer generation (no API needed)
function generateLocalAnswers(questions: string[], profile: any, seedAnswers: Record<string, string> = {}): Record<string, string> {
  const answers: Record<string, string> = {};

  // Extract skills
  const skills = flattenSkills(profile.skills);

  // Estimate years of experience
  let yearsOfExperience = '5+';
  if (profile.experience && Array.isArray(profile.experience)) {
    const years = profile.experience.length * 2;
    yearsOfExperience = years > 10 ? '10+' : years.toString();
  }

  // Helper to get seed answer content
  const getSeedContext = (key: string) => seedAnswers[key] || '';

  questions.forEach((q) => {
    const question = q.toLowerCase();

    if (question.includes('authorized') && question.includes('work') && question.includes('united states')) {
      answers[q] = 'Yes';
    } else if (question.includes('visa') && question.includes('sponsorship')) {
      answers[q] = 'No';
    } else if (question.includes('years') && (question.includes('experience') || question.includes('professional'))) {
      answers[q] = yearsOfExperience + ' years';
    } else if (question.includes('tech stack') || question.includes('technologies') || question.includes('proficient')) {
      answers[q] = skills.slice(0, 10).join(', ') || 'JavaScript, TypeScript, React, Node.js, Python, SQL, AWS';
    } else if (question.includes('generative ai') || question.includes('ai tools') || question.includes('ai framework')) {
      answers[q] = 'GitHub Copilot, ChatGPT/GPT-4 API, Claude, OpenAI API for code generation and review, LangChain for AI application development';
    } else if (question.includes('developer') && (question.includes('products') || question.includes('tools') || question.includes('sdk') || question.includes('api'))) {
      const projects = profile.projects ? profile.projects.slice(0, 2).map((p: any) => p.title || p.name).join(', ') : '';
      answers[q] = projects || 'Yes, I have experience building developer tools, REST APIs, and internal SDKs.';
    } else if (
      (question.includes('interested') || question.includes('excited') || question.includes('attract') || question.includes('appeal')) &&
      (question.includes('role') || question.includes('position') || question.includes('opportunity') || question.includes('company') || question.includes('job'))
    ) {
      const motivation = getSeedContext('career_motivation');
      const idealRole = getSeedContext('ideal_role');
      if (motivation || idealRole) {
        answers[q] = `${motivation} ${idealRole}`.trim().slice(0, 500);
      } else {
        answers[q] = `This role lines up well with my background in ${skills.slice(0, 3).join(', ')}. ${(profile.summary || '').slice(0, 200)}`.trim();
      }
    } else if (question.includes('why') && (question.includes('interested') || question.includes('apply') || question.includes('join') || question.includes('company') || question.includes('role'))) {
      // Use seed answers for motivation questions
      const motivation = getSeedContext('career_motivation');
      const idealRole = getSeedContext('ideal_role');
      if (motivation || idealRole) {
        answers[q] = `${motivation} ${idealRole}`.trim().slice(0, 500);
      } else {
        answers[q] = `This role caught my attention because it lines up well with my background in ${skills.slice(0, 3).join(', ')}. ${(profile.summary || '').slice(0, 200)}`;
      }
    } else if (question.includes('career') && question.includes('goal')) {
      const goals = getSeedContext('career_goals');
      if (goals) {
        answers[q] = goals;
      }
    } else if (question.includes('achievement') || question.includes('proud') || question.includes('accomplishment')) {
      const achievement = getSeedContext('proudest_achievement');
      if (achievement) {
        answers[q] = achievement;
      }
    } else if (question.includes('unique') || question.includes('stand out') || question.includes('set you apart') || question.includes('strength')) {
      const strength = getSeedContext('unique_strength');
      if (strength) {
        answers[q] = strength;
      }
    } else if (question.includes('work style') || question.includes('work environment') || question.includes('team') || question.includes('collaboration')) {
      const workStyle = getSeedContext('work_style');
      const idealRole = getSeedContext('ideal_role');
      if (workStyle || idealRole) {
        answers[q] = `${workStyle} ${idealRole}`.trim().slice(0, 400);
      }
    } else if (question.includes('salary') || question.includes('compensation')) {
      answers[q] = 'Open to discussion based on the full compensation package.';
    } else if (question.includes('start') && question.includes('date')) {
      answers[q] = 'Two weeks notice - flexible';
    } else if (question.includes('hear about') || question.includes('how did you find')) {
      answers[q] = 'Online job board';
    }
  });

  return answers;
}

// Ask the backend for an AI suggestion when the rule-based pass fails. Cheap,
// single-question call. Caller is expected to cache the result in saved-answers.
async function autofillSuggest(payload: {
  question: string;
  fieldType?: string;
  options?: string[];
  jobContext?: { title?: string; company?: string };
}): Promise<{ value: string; confidence: number }> {
  if (!authToken) return { value: '', confidence: 0 };
  try {
    const profile = await fetchProfile();
    const response = await fetch(`${CONFIG.API_BASE}/profiles/autofill-suggest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: payload.question,
        fieldType: payload.fieldType,
        options: payload.options,
        profile,
        jobContext: payload.jobContext,
      }),
    });
    if (!response.ok) return { value: '', confidence: 0 };
    const data = await response.json();
    return {
      value: typeof data?.value === 'string' ? data.value : '',
      confidence: Number(data?.confidence) || 0,
    };
  } catch (err) {
    console.warn('[ProfileAI] autofillSuggest failed', err);
    return { value: '', confidence: 0 };
  }
}

// Batch version: send up to 30 questions in ONE AI call. Used during autofill so
// every unmatched dropdown is resolved in a single round-trip instead of N.
async function autofillSuggestBatch(payload: {
  fields: Array<{ question: string; fieldType?: string; options?: string[] }>;
  jobContext?: { title?: string; company?: string };
}): Promise<{ answers: Array<{ i: number; value: string; confidence: number }> }> {
  if (!authToken) return { answers: [] };
  try {
    const profile = await fetchProfile();
    const response = await fetch(`${CONFIG.API_BASE}/profiles/autofill-suggest-batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: payload.fields,
        profile,
        jobContext: payload.jobContext,
      }),
    });
    if (!response.ok) return { answers: [] };
    const data = await response.json();
    return { answers: Array.isArray(data?.answers) ? data.answers : [] };
  } catch (err) {
    console.warn('[ProfileAI] autofillSuggestBatch failed', err);
    return { answers: [] };
  }
}

// Profile functions
async function fetchProfile(): Promise<FullProfile | null> {
  if (!authToken) return null;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/profiles/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Expired/invalid token: clear auth so the panel shows the signed-out
      // state instead of repeatedly throwing a generic "Failed to fetch" error.
      if (response.status === 401 || response.status === 403) {
        console.warn('[ProfileAI] Profile fetch unauthorized — clearing stale session');
        await handleLogout();
        return null;
      }
      // 404 = this account simply has no candidate profile yet (e.g. a brand
      // new user or a recruiter). That's a valid state, not an error — return
      // null quietly without clearing auth or spamming the console.
      if (response.status === 404) {
        console.log('[ProfileAI] No profile yet for this account (404)');
        cachedProfile = null;
        await chrome.storage.local.remove('profile');
        return null;
      }
      throw new Error(`Failed to fetch profile (HTTP ${response.status})`);
    }

    const data = await response.json();
    
    // Merge user data into profile
    cachedProfile = {
      ...data,
      firstName: currentUser?.firstName,
      lastName: currentUser?.lastName,
      email: currentUser?.email,
    };

    // Cache profile
    await chrome.storage.local.set({ profile: cachedProfile });
    
    return cachedProfile;
  } catch (error) {
    console.error('[ProfileAI] Error fetching profile:', error);
    
    // Return cached profile if available
    const cached = await chrome.storage.local.get('profile');
    return cached.profile || null;
  }
}

// Saved answers functions
async function saveAnswer(question: string, answer: string) {
  const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
  const answers = savedAnswers || {};
  
  // Normalize question
  const normalizedQ = question.toLowerCase().trim();
  answers[normalizedQ] = answer;
  
  await chrome.storage.local.set({ savedAnswers: answers });
}

async function deleteAnswer(question: string) {
  const { savedAnswers } = await chrome.storage.local.get('savedAnswers');
  const answers = savedAnswers || {};
  
  const normalizedQ = question.toLowerCase().trim();
  delete answers[normalizedQ];
  
  await chrome.storage.local.set({ savedAnswers: answers });
}

// =============================================================================
// SMART ANSWERS — generate tailored answers for open-ended application questions
// =============================================================================

// Tiny string hash (matches content-script-side hashString shape)
function hashStringBg(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function jobIdFromContext(jobInfo?: { title?: string; company?: string } | null, jobUrl?: string): string {
  // Prefer URL (most stable across visits). Fall back to title+company hash.
  if (jobUrl) return hashStringBg(jobUrl);
  return hashStringBg(`${jobInfo?.title || ''}::${jobInfo?.company || ''}`);
}

function smartAnswerCacheKey(jobId: string, question: string): string {
  return `${jobId}:${hashStringBg(question.toLowerCase().trim())}`;
}

async function loadSmartAnswerCache(): Promise<Record<string, { answer: string; ts: number }>> {
  const { smartAnswerCache } = await chrome.storage.local.get('smartAnswerCache');
  return smartAnswerCache || {};
}

async function saveSmartAnswerCacheEntry(key: string, answer: string) {
  const cache = await loadSmartAnswerCache();
  cache[key] = { answer, ts: Date.now() };
  // Cap cache size to avoid storage bloat (keep newest 200).
  const entries = Object.entries(cache);
  if (entries.length > 200) {
    entries.sort((a, b) => b[1].ts - a[1].ts);
    const trimmed: Record<string, { answer: string; ts: number }> = {};
    entries.slice(0, 200).forEach(([k, v]) => { trimmed[k] = v; });
    await chrome.storage.local.set({ smartAnswerCache: trimmed });
  } else {
    await chrome.storage.local.set({ smartAnswerCache: cache });
  }
}

// Find a similar saved answer (fuzzy word overlap, threshold ≥0.7).
function findSimilarSavedAnswer(question: string, savedAnswers: Record<string, string>): string | null {
  const q = question.toLowerCase().trim();
  if (savedAnswers[q]) return savedAnswers[q];
  const qWords = new Set(q.split(/\W+/).filter((w) => w.length > 2));
  if (qWords.size === 0) return null;
  let bestScore = 0;
  let bestAnswer: string | null = null;
  for (const savedQ in savedAnswers) {
    const sWords = new Set(savedQ.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
    if (sWords.size === 0) continue;
    let overlap = 0;
    qWords.forEach((w) => { if (sWords.has(w)) overlap++; });
    const score = overlap / Math.max(qWords.size, sWords.size);
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestAnswer = savedAnswers[savedQ];
    }
  }
  return bestAnswer;
}

async function generateSmartAnswers(payload: {
  questions: Array<{ id: string; question: string; fieldType: string }>;
  jobInfo?: { title?: string; company?: string; description?: string } | null;
  jobUrl?: string;
}): Promise<{ success: boolean; results?: Array<{ questionId: string; question: string; answer: string; source: 'cache' | 'saved' | 'ai' }>; error?: string }> {
  try {
    if (!payload.questions || payload.questions.length === 0) {
      return { success: true, results: [] };
    }

    const jobId = jobIdFromContext(payload.jobInfo, payload.jobUrl);
    const cache = await loadSmartAnswerCache();
    const { savedAnswers = {} } = await chrome.storage.local.get('savedAnswers');

    const results: Array<{ questionId: string; question: string; answer: string; source: 'cache' | 'saved' | 'ai' }> = [];
    const needAI: typeof payload.questions = [];

    for (const q of payload.questions) {
      const cKey = smartAnswerCacheKey(jobId, q.question);
      // 1. Per-job cache (saves AI cost on re-scans)
      if (cache[cKey]?.answer) {
        results.push({ questionId: q.id, question: q.question, answer: cache[cKey].answer, source: 'cache' });
        continue;
      }
      // 2. Generic saved answers (cross-job consistency)
      const saved = findSimilarSavedAnswer(q.question, savedAnswers);
      if (saved) {
        results.push({ questionId: q.id, question: q.question, answer: saved, source: 'saved' });
        // Also seed into per-job cache so re-scan is instant.
        await saveSmartAnswerCacheEntry(cKey, saved);
        continue;
      }
      needAI.push(q);
    }

    // 3. Anything left → ask the AI (in one round-trip via existing endpoint).
    if (needAI.length > 0) {
      const questionsTxt = needAI.map((q) => q.question);
      const aiResp = await generateAIAnswers(
        questionsTxt,
        payload.jobInfo?.description || '',
        needAI.map((q) => ({ question: q.question, fieldType: q.fieldType, options: null })),
      );
      const answers = (aiResp?.answers || {}) as Record<string, string>;
      for (const q of needAI) {
        const ans = answers[q.question] || answers[q.question.toLowerCase()] || '';
        if (ans) {
          results.push({ questionId: q.id, question: q.question, answer: ans, source: 'ai' });
          // Cache & auto-save to grow saved-answers over time.
          const cKey = smartAnswerCacheKey(jobId, q.question);
          await saveSmartAnswerCacheEntry(cKey, ans);
          try { await saveAnswer(q.question, ans); } catch (_) {}
        } else {
          results.push({ questionId: q.id, question: q.question, answer: '', source: 'ai' });
        }
      }
    }

    // Preserve original ordering
    const ordered = payload.questions.map((q) => results.find((r) => r.questionId === q.id) || { questionId: q.id, question: q.question, answer: '', source: 'ai' as const });
    return { success: true, results: ordered };
  } catch (err) {
    console.error('[ProfileAI] generateSmartAnswers error', err);
    return { success: false, error: (err as Error).message || 'Smart answer generation failed' };
  }
}

async function generateSingleSmartAnswer(payload: {
  question: { id: string; question: string; fieldType: string };
  jobInfo?: { title?: string; company?: string; description?: string } | null;
  jobUrl?: string;
  forceRegenerate?: boolean;
}): Promise<{ success: boolean; answer?: string; source?: 'cache' | 'saved' | 'ai'; error?: string }> {
  try {
    const q = payload.question;
    const jobId = jobIdFromContext(payload.jobInfo, payload.jobUrl);
    const cKey = smartAnswerCacheKey(jobId, q.question);

    if (!payload.forceRegenerate) {
      const cache = await loadSmartAnswerCache();
      if (cache[cKey]?.answer) {
        return { success: true, answer: cache[cKey].answer, source: 'cache' };
      }
      const { savedAnswers = {} } = await chrome.storage.local.get('savedAnswers');
      const saved = findSimilarSavedAnswer(q.question, savedAnswers);
      if (saved) {
        await saveSmartAnswerCacheEntry(cKey, saved);
        return { success: true, answer: saved, source: 'saved' };
      }
    }

    const aiResp = await generateAIAnswers(
      [q.question],
      payload.jobInfo?.description || '',
      [{ question: q.question, fieldType: q.fieldType, options: null }],
    );
    const answersMap = (aiResp?.answers as Record<string, string>) || {};
    // Exact-key lookup first; the AI route returns answers keyed by the
    // original question, but tiny whitespace/punctuation drift breaks that
    // lookup and used to produce a misleading "No answer generated" error.
    let answer = answersMap[q.question] || '';
    if (!answer) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
      const target = norm(q.question);
      for (const [k, v] of Object.entries(answersMap)) {
        if (typeof v === 'string' && v.trim() && norm(k) === target) {
          answer = v;
          break;
        }
      }
    }
    if (!answer) {
      // Last resort: take the first non-empty value (single-question requests
      // only ever have one answer in the map anyway).
      const firstVal = Object.values(answersMap).find((v) => typeof v === 'string' && v.trim());
      if (firstVal) answer = firstVal as string;
    }
    if (!answer) return { success: false, error: 'No answer generated' };
    await saveSmartAnswerCacheEntry(cKey, answer);
    try { await saveAnswer(q.question, answer); } catch (_) {}
    return { success: true, answer, source: 'ai' };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Generation failed' };
  }
}

// =============================================================================
// MATCH ANALYSIS — score + alignments + gaps + talking points
// =============================================================================

async function analyzeMatch(payload: {
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
}): Promise<{ success: boolean; analysis?: any; error?: string }> {
  try {
    if (!payload.jobDescription || payload.jobDescription.trim().length < 30) {
      return { success: false, error: 'No job description available to analyze' };
    }
    if (!cachedProfile) await fetchProfile();

    // Run client-side keyword scoring + backend gap analysis in parallel.
    const [keywords, gapsResp] = await Promise.all([
      analyzeKeywords(payload.jobDescription),
      analyzeGapsForJob(payload.jobDescription).catch(() => null),
    ]);

    const matchScore = (keywords as any)?.matchScore ?? 0;
    const presentKeywords: string[] = (keywords as any)?.present || [];
    const missingKeywords: string[] = (keywords as any)?.missing || [];

    // Build alignment bullets from the user's profile + matched keywords.
    const profile = cachedProfile || ({} as any);
    const skills = flattenSkills(profile.skills);
    const alignments: string[] = [];
    if (presentKeywords.length > 0) {
      alignments.push(`You match on ${presentKeywords.length} core keywords from the JD: ${presentKeywords.slice(0, 8).join(', ')}.`);
    }
    if (Array.isArray(profile.experience) && profile.experience.length > 0) {
      const recent = profile.experience[0];
      if (recent?.title || recent?.company) {
        alignments.push(`Recent role as ${recent.title || ''}${recent.company ? ` at ${recent.company}` : ''} aligns with the seniority being asked for.`);
      }
    }
    if (skills.length >= 5) {
      alignments.push(`Your skill set is broad enough to cover the day-to-day stack (${skills.slice(0, 5).join(', ')}).`);
    }

    // Gaps: prefer backend-detected gaps, fall back to missing keywords.
    let gaps: string[] = [];
    if (gapsResp && (gapsResp as any).gaps && Array.isArray((gapsResp as any).gaps)) {
      gaps = (gapsResp as any).gaps.slice(0, 5).map((g: any) => g?.skill || g?.label || g?.name).filter(Boolean);
    }
    if (gaps.length === 0 && missingKeywords.length > 0) {
      gaps = missingKeywords.slice(0, 5).map((k) => `${k} — not represented in your profile.`);
    }

    // Talking points = pair strongest alignments with concrete suggestions.
    const talkingPoints: string[] = [];
    if (presentKeywords.length > 0) {
      talkingPoints.push(`Lead with a specific example showing ${presentKeywords[0]} in production.`);
    }
    if (presentKeywords[1]) {
      talkingPoints.push(`Quantify impact involving ${presentKeywords[1]} (numbers > adjectives).`);
    }
    if (missingKeywords.length > 0) {
      talkingPoints.push(`Pre-empt the gap on ${missingKeywords[0]} — name a transferable project, don't dodge it.`);
    }
    if (payload.company) {
      talkingPoints.push(`Tie one sentence directly to ${payload.company}'s product, not just the role description.`);
    }

    const summary = matchScore >= 70
      ? 'Strong match — emphasize specific, recent wins.'
      : matchScore >= 50
        ? 'Decent match — frame gaps as transferable, lead with strongest keywords.'
        : 'Stretch role — focus on transferable wins and rapid-learning evidence.';

    return {
      success: true,
      analysis: {
        matchScore,
        alignments,
        gaps,
        talkingPoints,
        summary,
      },
    };
  } catch (err) {
    console.error('[ProfileAI] analyzeMatch error', err);
    return { success: false, error: (err as Error).message || 'Match analysis failed' };
  }
}

// =============================================================================
// LINKEDIN PROFILE ANALYZER — scrape the current linkedin.com/in/* tab and
// send it to the backend for a recruiter-POV analysis.
// =============================================================================

/**
 * Scrapes the LinkedIn profile page in the active tab (via scripting API so we
 * work even if the content script hasn't attached to that frame) and posts it
 * to the backend for AI analysis. Returns the parsed analysis for the panel.
 */
// Shared scraper — extracted so both the authed analyzer AND the guest
// analyzer can pass it to chrome.scripting.executeScript without duplicating
// ~200 lines. Runs in the page's world; must not close over the extension
// scope or use chrome.*.
const SCRAPER_FN = () => {
        const clean = (s: string | null | undefined) =>
          (s || '').replace(/\s+/g, ' ').trim();
        const firstText = (selectors: string[]): string => {
          for (const sel of selectors) {
            try {
              const el = document.querySelector(sel) as HTMLElement | null;
              const txt = clean(el?.innerText || el?.textContent);
              if (txt) return txt;
            } catch {
              /* invalid selector for the current DOM — skip */
            }
          }
          return '';
        };
        const longestText = (selectors: string[], min = 40): string => {
          let best = '';
          for (const sel of selectors) {
            try {
              document.querySelectorAll(sel).forEach((el) => {
                const txt = clean((el as HTMLElement).innerText || el.textContent);
                if (txt.length > best.length) best = txt;
              });
            } catch {
              /* skip */
            }
          }
          return best.length >= min ? best : best;
        };

        // Section-scoped extractor. LinkedIn's OLDER profile pages used
        // `<section>` wrappers with an anchor `<div id="about">`, `id="experience">`,
        // etc. — the newer `sdui` profile pages have dropped those IDs entirely
        // and use hashed CSS-module classnames instead. So we now try, in order:
        //   1) The legacy `document.getElementById(anchorId)` path.
        //   2) An `<h2>` heading whose text matches the section label — take
        //      its ancestor `<section>` (or nearest large ancestor) and pull
        //      the visible text minus that heading itself.
        //   3) A regex slice of the whole document.body.innerText between the
        //      section's heading and the next known section heading.
        // The section labels below cover every LinkedIn section we care about.
        const SECTION_HEADINGS = ['About', 'Experience', 'Education', 'Skills', 'Featured', 'Projects', 'Certifications', 'Recommendations', 'Languages', 'Volunteering'];
        // Cache the full-page text once — several fallbacks reuse it.
        const bodyText = clean(document.body.innerText);
        const sectionText = (anchorId: string, minLen = 30): string => {
          try {
            // 1) Legacy anchor-id path.
            const anchor = document.getElementById(anchorId);
            if (anchor) {
              const section = anchor.closest('section');
              if (section) {
                const clone = section.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('a[href*="/details/"]').forEach((a) => a.remove());
                clone.querySelectorAll('.visually-hidden, .a11y-text').forEach((a) => a.remove());
                const txt = clean(clone.innerText || clone.textContent);
                if (txt.length >= minLen) return txt;
              }
            }
            // 2) Heading-based path. Look for an <h2>/<h3> whose text is the
            //    section label (or starts with it — "About", "Featured", etc.).
            const label = anchorId.charAt(0).toUpperCase() + anchorId.slice(1); // "about" → "About"
            const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
            const heading = headings.find((h) => {
              const t = clean((h as HTMLElement).innerText || h.textContent);
              return t === label || new RegExp(`^${label}\\b`, 'i').test(t);
            }) as HTMLElement | undefined;
            if (heading) {
              // Prefer nearest <section>; else walk up until we find a
              // container that's at least 3x taller than the heading itself.
              let container: HTMLElement | null = heading.closest('section');
              if (!container) {
                let node: HTMLElement | null = heading.parentElement;
                const hh = heading.getBoundingClientRect().height || 24;
                let hops = 0;
                while (node && hops < 8) {
                  if (node.getBoundingClientRect().height > hh * 3) { container = node; break; }
                  node = node.parentElement;
                  hops++;
                }
              }
              if (container) {
                const clone = container.cloneNode(true) as HTMLElement;
                // Remove the heading itself so we don't include "About\nAbout"
                clone.querySelectorAll('h1, h2, h3').forEach((h) => {
                  const t = clean((h as HTMLElement).innerText || h.textContent);
                  if (t === label || new RegExp(`^${label}\\b`, 'i').test(t)) h.remove();
                });
                clone.querySelectorAll('a[href*="/details/"]').forEach((a) => a.remove());
                clone.querySelectorAll('.visually-hidden, .a11y-text').forEach((a) => a.remove());
                const txt = clean(clone.innerText || clone.textContent);
                if (txt.length >= minLen) return txt;
              }
            }
            // 3) Regex slice fallback on the full body text — cut between
            //    THIS heading and the NEXT known section heading.
            const otherHeadings = SECTION_HEADINGS.filter((h) => h.toLowerCase() !== anchorId.toLowerCase());
            const startRe = new RegExp(`(^|\\n)${label}\\s*(\\n|$)`, 'i');
            const startMatch = bodyText.match(startRe);
            if (startMatch && typeof startMatch.index === 'number') {
              const after = bodyText.slice(startMatch.index + startMatch[0].length);
              const endRe = new RegExp(`(^|\\n)(${otherHeadings.join('|')})\\s*(\\n|$)`, 'i');
              const endMatch = after.match(endRe);
              const slice = endMatch && typeof endMatch.index === 'number'
                ? after.slice(0, endMatch.index)
                : after.slice(0, 3000);
              const txt = clean(slice);
              if (txt.length >= minLen) return txt;
            }
            return '';
          } catch {
            return '';
          }
        };

        const name = firstText([
          'h1.text-heading-xlarge',
          'h1.top-card-layout__title',
          // Newer sdui profile pages: the name is the first <h1> inside
          // <main>, but the class is a hashed CSS-module name so we can't
          // target it directly. `main h1` still catches it.
          'main h1',
          '[data-sdui-screen*="profile"] h1',
          'h1',
        ]);

        const headline = firstText([
          'div.text-body-medium.break-words',
          '.top-card-layout__headline',
          '.pv-text-details__left-panel .text-body-medium',
          // Newer sdui: the headline sits right under the <h1> in the top card,
          // often the FIRST <p> after the name. Best generic fallback is the
          // first paragraph inside <main> that isn't a link and is 20-260 chars.
        ]) || (() => {
          try {
            const main = document.querySelector('main') || document.body;
            const h1 = main.querySelector('h1');
            if (!h1) return '';
            let node: Element | null = h1.nextElementSibling;
            let hops = 0;
            while (node && hops < 30) {
              const txt = clean((node as HTMLElement).innerText || node.textContent);
              if (txt && txt.length >= 20 && txt.length <= 260 && !/(\bconnect\b|\bmessage\b|\bfollow\b)/i.test(txt.split('\n')[0] || '')) {
                return txt.split('\n')[0] || txt;
              }
              node = node.nextElementSibling;
              hops++;
            }
          } catch { /* ignore */ }
          return '';
        })();

        const location = firstText([
          'span.text-body-small.inline.t-black--light.break-words',
          '.top-card__subline-item',
          '.pv-text-details__left-panel .text-body-small',
        ]);

        // Current role / company — sometimes appears in the "experience" pill
        // near the top card; fall back to the first item in the experience section.
        const currentTop = firstText([
          'button[aria-label*="Current company"]',
          '.pv-text-details__right-panel button[aria-label*="Current"]',
        ]);
        let currentCompany = currentTop || '';
        let currentTitle = '';

        const about = sectionText('about', 20);
        const experience = sectionText('experience', 40);
        const education = sectionText('education', 20);
        const skills = sectionText('skills', 5);

        // If we still don't have current role, grab the first non-empty line of
        // the experience section — that's almost always the current role's title.
        if (!currentTitle && experience) {
          const firstLine = experience.split('\n').map((l) => clean(l)).find(Boolean) || '';
          if (firstLine) {
            const parts = firstLine.split('·').map((p) => clean(p));
            currentTitle = parts[0] || firstLine;
            if (!currentCompany && parts[1]) currentCompany = parts[1];
          }
        }

        // Featured / recommendations counts — best-effort.
        const countFromHeader = (labelRegex: RegExp): number | null => {
          const headers = Array.from(document.querySelectorAll('h2, h3'));
          for (const h of headers) {
            const txt = clean((h as HTMLElement).innerText);
            const m = txt.match(labelRegex);
            if (m) {
              const numMatch = txt.match(/(\d+)/);
              if (numMatch) return Number(numMatch[1]);
              // If label exists but no count in the header, at least confirm the
              // section is present by counting its list items.
              const sect = h.closest('section');
              if (sect) {
                return sect.querySelectorAll('li').length || 0;
              }
            }
          }
          return null;
        };
        const featuredCount = countFromHeader(/^Featured\b/i);
        const recommendationsCount = countFromHeader(/^Recommendations\b/i);

        // Followers / connections — best-effort.
        const followers = firstText([
          '.pv-top-card--list-bullet li',
          'ul.pv-top-card--list-bullet li',
        ]);
        const connections = firstText([
          'span.t-bold',
          '.pv-top-card--list-bullet li',
        ]);

        // Full page innerText fallback (capped) — lets the AI still grade the
        // profile if section anchors moved / A/B test changed the DOM.
        const rawText = bodyText.slice(0, 12000);

        return {
          name,
          headline,
          location,
          currentTitle,
          currentCompany,
          about,
          experience,
          education,
          skills,
          featuredCount,
          recommendationsCount,
          followers,
          connections,
          rawText,
        };
};

async function analyzeLinkedInProfile(
  targetTitle?: string
): Promise<{ success: boolean; analysis?: any; error?: string; targetTitle?: string; analysisId?: string | null }> {
  if (!authToken) return { success: false, error: 'Not authenticated' };
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab?.url) {
      return { success: false, error: 'Could not find the active tab' };
    }
    if (!/linkedin\.com\/in\//i.test(tab.url)) {
      return {
        success: false,
        error: 'Open a LinkedIn profile (linkedin.com/in/…) first, then try again.',
      };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: SCRAPER_FN,
    });

    const scraped: any = results?.[0]?.result || {};
    scraped.url = tab.url;

    // Quick client-side guard so we don't burn an API call on an empty page.
    const hasSignal =
      (typeof scraped.headline === 'string' && scraped.headline.length > 5) ||
      (typeof scraped.about === 'string' && scraped.about.length > 20) ||
      (typeof scraped.experience === 'string' && scraped.experience.length > 40) ||
      (typeof scraped.rawText === 'string' && scraped.rawText.length > 200);
    if (!hasSignal) {
      return {
        success: false,
        error:
          'Could not read the profile. Scroll down so the headline, About, and Experience sections are visible, then try again.',
      };
    }

    // Fall back to the user's saved title if the panel didn't send one.
    let effectiveTitle = (targetTitle || '').trim();
    if (!effectiveTitle && cachedProfile) {
      effectiveTitle = (cachedProfile.title || cachedProfile.headline || '').trim();
    }

    const response = await fetch(`${CONFIG.API_BASE}/profiles/analyze-linkedin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scraped, targetTitle: effectiveTitle }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      return { success: false, error: err.error || `Server returned ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      analysis: data.analysis,
      targetTitle: data.targetTitle,
      analysisId: data.analysisId,
    };
  } catch (err) {
    console.error('[ProfileAI] analyzeLinkedInProfile error', err);
    return { success: false, error: (err as Error).message || 'Analysis failed' };
  }
}

/**
 * Guest / signed-out variant of the LinkedIn Profile Analyzer.
 * - Runs the SAME scraper against the active linkedin.com/in/* tab.
 * - Posts to /api/profiles/analyze-linkedin-guest without an Authorization
 *   header (rate-limited server-side by IP + URL).
 * - Returns the TEASER response shape (scores + verdict + summary + 5
 *   quick-win rows where 4 are locked). Never receives full sections,
 *   keyword chips, or the paste-ready priority fixes — those live in the
 *   server cache and only ship via email or after sign-in.
 */
async function analyzeLinkedInProfileGuest(
  targetTitle?: string
): Promise<{
  success: boolean;
  teaser?: any;
  analysisId?: string | null;
  targetTitle?: string;
  error?: string;
  errorCode?: string;
}> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab?.url) {
      return { success: false, error: 'Could not find the active tab' };
    }
    if (!/linkedin\.com\/in\//i.test(tab.url)) {
      return {
        success: false,
        error: 'Open a LinkedIn profile (linkedin.com/in/…) first, then try again.',
      };
    }

    // Reuse the exact scraper by calling analyzeLinkedInProfile's scripting
    // extraction — refactor into a shared helper if we ever add a 3rd caller.
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: SCRAPER_FN,
    });
    const scraped: any = results?.[0]?.result || {};
    scraped.url = tab.url;

    const hasSignal =
      (typeof scraped.headline === 'string' && scraped.headline.length > 5) ||
      (typeof scraped.about === 'string' && scraped.about.length > 20) ||
      (typeof scraped.experience === 'string' && scraped.experience.length > 40) ||
      (typeof scraped.rawText === 'string' && scraped.rawText.length > 200);
    if (!hasSignal) {
      return {
        success: false,
        error:
          'Could not read the profile. Scroll down so the headline, About, and Experience sections are visible, then try again.',
      };
    }

    const effectiveTitle = (targetTitle || '').trim();

    const response = await fetch(`${CONFIG.API_BASE}/profiles/analyze-linkedin-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scraped, targetTitle: effectiveTitle }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      return {
        success: false,
        error: err.message || err.error || `Server returned ${response.status}`,
        errorCode: err.error || undefined,
      };
    }

    const data = await response.json();
    return {
      success: true,
      teaser: data.teaser,
      analysisId: data.analysisId,
      targetTitle: data.targetTitle,
    };
  } catch (err) {
    console.error('[ProfileAI] analyzeLinkedInProfileGuest error', err);
    return { success: false, error: (err as Error).message || 'Analysis failed' };
  }
}

/** Thin proxy so the sidepanel can POST the guest email form without
 *  hitting fetch() directly (keeps CORS + error shape consistent). */
async function submitGuestReportEmail(
  data: { email: string; analysisId: string }
): Promise<{ ok: boolean; duplicate?: boolean; message?: string; error?: string; errorCode?: string }> {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/profiles/guest-report-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      return {
        ok: false,
        error: json.message || json.error || `Server returned ${response.status}`,
        errorCode: json.error || undefined,
      };
    }
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Network error' };
  }
}

/** Fire-and-forget analytics event. Errors are swallowed — analytics should
 *  never break a user-facing flow. */
async function recordAnalyticsEvent(
  data: { name: string; sessionId?: string; properties?: Record<string, any> }
): Promise<{ ok: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch(`${CONFIG.API_BASE}/profiles/analytics-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  } catch (err) {
    // swallow — analytics failures must not surface
    console.debug('[ProfileAI] analytics event drop:', (err as Error).message);
  }
  return { ok: true };
}

/**
 * Best-effort click of LinkedIn's own "Edit" pencil button for a given section
 * so the user lands inside LinkedIn's native editor with focus. We stop short
 * of pasting the text ourselves — LinkedIn uses React-controlled contenteditables
 * that ignore programmatic `input.value` writes, and synthetic paste events get
 * blocked. The modal shows a toast telling the user to press Cmd/Ctrl+V, which
 * works because the text is already on the system clipboard.
 *
 * Falls back to scrolling to the section anchor if no edit button matches.
 */
async function openLinkedInEditor(
  section: 'headline' | 'about' | 'skills' | 'featured' | 'experience'
): Promise<{ success: boolean; clicked?: boolean; scrolled?: boolean; error?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab?.url) {
      return { success: false, error: 'Could not find the active tab' };
    }
    if (!/linkedin\.com\/in\//i.test(tab.url)) {
      return { success: false, error: 'Open a LinkedIn profile first (linkedin.com/in/…).' };
    }
    // Focus the tab so the user can immediately paste.
    try {
      await chrome.tabs.update(tab.id, { active: true });
      if (typeof tab.windowId === 'number') {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch {
      /* best-effort */
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [section],
      func: (sec: string) => {
        // aria-label patterns LinkedIn uses across their profile-edit UI.
        // Multiple hints per section so a small label rename doesn't break us.
        const patterns: Record<string, string[]> = {
          headline: ['edit intro', 'edit headline'],
          about: ['edit about'],
          skills: ['edit skills', 'add skill'],
          featured: ['edit featured', 'add featured'],
          experience: ['edit position', 'edit experience', 'add position'],
        };
        const anchorIds: Record<string, string> = {
          about: 'about',
          skills: 'skills',
          featured: 'featured',
          experience: 'experience',
          headline: '',
        };
        const hints = patterns[sec] || [];
        // Prefer the FIRST match — for Experience that's the top-most edit
        // button, which is almost always the current role.
        for (const hint of hints) {
          const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
          const btn = buttons.find((b) => {
            const label = (b.getAttribute('aria-label') || '').toLowerCase();
            return label.includes(hint);
          });
          if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Small delay so the smooth-scroll doesn't fight the click.
            setTimeout(() => btn.click(), 250);
            return { clicked: true, matched: hint };
          }
        }
        // Fallback: scroll to the anchor. Better than nothing.
        const anchorId = anchorIds[sec];
        if (anchorId) {
          const el = document.getElementById(anchorId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return { clicked: false, scrolled: true };
          }
        }
        // Headline lives in the top card — jump to top of page.
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return { clicked: false, scrolled: true };
      },
    });
    const r = results?.[0]?.result || {};
    return { success: true, clicked: !!r.clicked, scrolled: !!r.scrolled };
  } catch (err) {
    console.error('[ProfileAI] openLinkedInEditor error', err);
    return { success: false, error: (err as Error).message || 'Could not open editor' };
  }
}

/**
 * Rewrite a single field's text via POST /api/profiles/rewrite-inline. Called
 * from the content-script inline AI popover injected into LinkedIn's edit
 * modals. We proxy through the background so the auth token stays in the
 * service worker and doesn't have to be readable from every content-script
 * frame.
 *
 * Returns the AI-rewritten text (or a friendly error) so the popover can
 * render it with Insert / Copy / Regenerate actions.
 */
async function rewriteField(payload: {
  text: string;
  action?: string;
  customPrompt?: string;
  fieldKind?: string;
  targetTitle?: string;
}): Promise<{ success: boolean; text?: string; action?: string; error?: string }> {
  if (!authToken) return { success: false, error: 'Please sign in to ProfileAI first.' };
  try {
    // Fallback: if the caller didn't send a targetTitle, use the user's saved
    // profile title/headline so "keywords" mode has something to weight against.
    let targetTitle = (payload.targetTitle || '').trim();
    if (!targetTitle) {
      if (!cachedProfile) {
        try { await fetchProfile(); } catch { /* fallthrough */ }
      }
      if (cachedProfile) {
        targetTitle = (cachedProfile.title || cachedProfile.headline || '').trim();
      }
    }

    const response = await fetch(`${CONFIG.API_BASE}/profiles/rewrite-inline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.text || '',
        action: payload.action,
        customPrompt: payload.customPrompt,
        fieldKind: payload.fieldKind,
        targetTitle,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as any));
      return { success: false, error: err.error || `Server returned ${response.status}` };
    }

    const data = await response.json();
    if (!data?.text) {
      return { success: false, error: 'AI returned an empty response.' };
    }
    return { success: true, text: data.text, action: data.action };
  } catch (err) {
    console.error('[ProfileAI] rewriteField error', err);
    return { success: false, error: (err as Error).message || 'Rewrite failed' };
  }
}

async function saveExternalApplication(data: {
  jobTitle: string;
  company: string;
  jobUrl?: string;
  platform?: string;
  location?: string;
  matchScore?: number;
}): Promise<{ success: boolean; error?: string }> {
  if (!authToken) {
    console.log('[ProfileAI] Not authenticated, skipping application save');
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE}/external-applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jobTitle: data.jobTitle,
        company: data.company,
        jobUrl: data.jobUrl,
        platform: data.platform,
        location: data.location,
        matchScore: data.matchScore,
      }),
    });

    if (response.status === 409) {
      // Duplicate — already tracked
      console.log('[ProfileAI] Application already tracked');
      return { success: true };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[ProfileAI] Application saved to dashboard');
    return { success: true };
  } catch (error) {
    console.error('[ProfileAI] Failed to save application:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Listen for tab updates to detect login from web app
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if user logged in from web app
    if (tab.url.includes(CONFIG.WEB_BASE) && tab.url.includes('extension=true')) {
      // Try to get auth from the page
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');
            return { token, user: user ? JSON.parse(user) : null };
          },
        });

        if (results[0]?.result?.token && results[0]?.result?.user) {
          await handleLogin(results[0].result.token, results[0].result.user);
          console.log('[ProfileAI] Logged in from web app');
        }
      } catch (error) {
        console.log('[ProfileAI] Could not get auth from page:', error);
      }
    }
  }
});

console.log('[ProfileAI] Background service worker initialized');
