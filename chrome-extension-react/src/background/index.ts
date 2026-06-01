// ProfileAI Background Service Worker
import { CONFIG } from '../config';
import type { User, FullProfile, Message } from '../types';

// State
let authToken: string | null = null;
let currentUser: User | null = null;
let cachedProfile: FullProfile | null = null;

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

      case 'LOGIN':
        const loginData = message.data as { token: string; user: User };
        await handleLogin(loginData.token, loginData.user);
        sendResponse({ success: true });
        break;

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

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[ProfileAI] Error handling message:', error);
    sendResponse({ error: (error as Error).message });
  }
}

// Sync auth from web app by checking localStorage in web app tabs
async function syncAuthFromWebApp(): Promise<boolean> {
  if (authToken) return true; // Already authenticated
  
  console.log('[ProfileAI] Attempting to sync auth from web app...');
  
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
        
        // Execute script to get localStorage values
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const token = localStorage.getItem('token');
              const userStr = localStorage.getItem('user');
              console.log('[ProfileAI Injected] Reading localStorage:', { 
                hasToken: !!token, 
                hasUser: !!userStr,
                tokenPreview: token ? token.substring(0, 20) + '...' : null
              });
              return { 
                token, 
                user: userStr ? JSON.parse(userStr) : null 
              };
            } catch (e) {
              console.error('[ProfileAI Injected] Error:', e);
              return { token: null, user: null, error: String(e) };
            }
          },
        });
        
        const result = results[0]?.result;
        console.log('[ProfileAI] Script result:', { 
          hasToken: !!result?.token, 
          hasUser: !!result?.user,
          error: result?.error 
        });
        
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
      throw new Error('Failed to fetch profile');
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
