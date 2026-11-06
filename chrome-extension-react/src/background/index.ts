// ProfileAI Background Service Worker
import { CONFIG } from '../config';
import type { User, FullProfile, Message } from '../types';
import { runBackgroundTask, sweepInterruptedTasks, jobTaskKey } from '../tasks';
import { scrapeJobFromDocument, mergeScrapes } from '../jobScrape';
import { parseLimit, type LimitInfo } from '../sidepanel/tailorLogic';
import {
  ANSWERS_RULES_VERSION, applyRulesVersion, buildSeedStoryPatch, matchFact,
  type AnswerCatalog, type AnswerDetail,
} from '../answerMemory';

// Any task that was still running when a previous worker generation was torn
// down has no fetch behind it any more. Flag those immediately on boot so a
// reopened side panel shows "run it again" instead of a spinner that never
// resolves. Runs at module scope, before any message can start a new task.
void sweepInterruptedTasks();

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
  // Our own web app. The dashboard/profile screens would hand the extractor
  // phantom job info, but /jobs and /jobs/:id are real postings — carve those
  // out. The character class after "jobs" is what keeps /my-jobs blocked.
  // (The old `(^|\.)` form required a dot before the host, so it only ever
  // matched www. and left the apex host unguarded.)
  /(^|\/\/)(www\.)?profilleai\.com(?!\/jobs(?:[/?#]|$))/i,
  /localhost:3000(?!\/jobs(?:[/?#]|$))/i,
];

function isNonJobUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  return NON_JOB_URL_PATTERNS.some((p) => p.test(url));
}

/** URL of the tab a panel-initiated operation is about. */
async function activeTabUrl(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.url || '';
  } catch {
    return '';
  }
}

/** Task key for work scoped to whatever page is in front of the user. */
async function activeTabJobKey(): Promise<string> {
  return jobTaskKey({ jobUrl: await activeTabUrl() });
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

      case 'AUTH_GOOGLE_INTERACTIVE': {
        const r = await googleAuthInteractive();
        sendResponse(r);
        break;
      }

      case 'AUTH_LINKEDIN_INTERACTIVE': {
        const r = await linkedinAuthInteractive();
        sendResponse(r);
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
        // The page being asked about, so a stored posting from another tab can
        // be rejected rather than substituted.
        let relayUrl = '';
        try {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          const tab = tabs[0];
          relayUrl = tab?.url || '';
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
              // The shared scraper, injected. This was a third hand-written
              // copy of the extraction logic, with its own selector list and
              // its own description read — the drift between the copies is the
              // whole reason job data differed depending on which code path
              // happened to produce it.
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scrapeJobFromDocument,
              });
              if (results && results[0]?.result) {
                jobInfo = results[0].result;
                console.log('[ProfileAI BG] Got job via scripting.executeScript:', {
                  title: jobInfo.title?.slice(0, 60),
                  company: jobInfo.company?.slice(0, 40),
                  descLength: jobInfo.description?.length || 0,
                });
                // Also store in storage for future use. `_url` rides along so
                // readers can tell which page this came from — storage has one
                // slot shared by every tab.
                chrome.storage.local.set({
                  currentJobInfo: { ...jobInfo, _ts: Date.now(), _url: tab.url },
                  currentJobUrl: tab.url,
                });
              }
            } catch (e) {
              console.log('[ProfileAI BG] scripting.executeScript failed:', e);
            }
          }
        } catch (e) {
          console.log('[ProfileAI BG] tabs.query failed:', e);
        }
        // Fallback: read from storage — but only if it is about THIS page.
        // Storage holds a single slot shared by every tab, so an unguarded
        // read here answered "what job is on screen?" with a posting from a
        // different tab, which the panel then tailored against.
        if (!jobInfo || (!jobInfo.title && !jobInfo.company)) {
          try {
            const stored = await chrome.storage.local.get(['currentJobInfo', 'currentJobUrl']);
            const storedUrl = stored.currentJobInfo?._url || stored.currentJobUrl || '';
            const samePage = !!relayUrl && !!storedUrl && storedUrl === relayUrl;
            if (samePage && stored.currentJobInfo && (stored.currentJobInfo.title || stored.currentJobInfo.company)) {
              jobInfo = stored.currentJobInfo;
              console.log('[ProfileAI BG] Got job from storage fallback:', {
                title: jobInfo.title?.slice(0, 60),
                descLength: jobInfo.description?.length || 0,
              });
            } else if (stored.currentJobInfo && !samePage) {
              console.log('[ProfileAI BG] Ignoring storage fallback — belongs to a different page', {
                storedUrl: storedUrl?.slice(0, 80),
                relayUrl: relayUrl?.slice(0, 80),
              });
            }
          } catch (_) {}
        }
        sendResponse(jobInfo || null);
        break;
      }

      case 'ANALYZE_JOB_PAGE': {
        // Runs as a durable task so closing the side panel mid-analysis does not
        // lose the result. Scoring is an AI call that spends an allowance, so it
        // runs only when asked for (`score: true` — the Analyze button). Tailor,
        // answers and the match modal re-read the page for its text alone.
        const pageKey = await activeTabJobKey();
        const wantScore = !!(message.data as { score?: boolean } | undefined)?.score;
        const jobPageResult = await runBackgroundTask('keywords', pageKey, undefined, () =>
          analyzeActiveJobPage(wantScore),
        );
        sendResponse(jobPageResult);
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
        // The whole run — AI call, cache write, backend save — lives inside the
        // task, so none of it depends on the side panel still being open.
        const tailorResult = await runBackgroundTask(
          'tailor',
          tailorData.jobUrl ? jobTaskKey({ jobUrl: tailorData.jobUrl }) : await activeTabJobKey(),
          { jobUrl: tailorData.jobUrl || '', jobTitle: tailorData.jobTitle || '', company: tailorData.company || '' },
          async () => {
            const result = await tailorProfileForJob(tailorData.jobDescription, tailorData.jobTitle, tailorData.company, tailorData.gapSelections, tailorData.tailorSettings);
            if (!result?.success || !result.tailoredProfile) return result;

            // Stamp the job context onto the profile here rather than in the
            // panel, so the stored task result and the direct response are the
            // same object either way.
            const tailored = {
              ...result.tailoredProfile,
              jobTitle: tailorData.jobTitle,
              company: tailorData.company,
              _skillGaps: tailorData.gapSelections?.acceptedGapObjects || [],
            };
            /* Diagnostic: the "still missing" list has three possible
               sources and the panel cannot tell us which one it used. Print
               all of them next to what the draft actually contains, so a
               mismatch is readable from the background console. */
            try {
              const draft = [
                tailored.summary || '',
                ...(tailored.skills || []),
                ...(tailored.experience || []).map((e: any) => e?.description || ''),
              ].join(' ').toLowerCase();
              const accepted = (tailorData.gapSelections?.acceptedGapObjects || []).map((g: any) => g.skill);
              console.log('[ProfileAI BG] GAP SOURCES', {
                matchAnalysisGaps: tailored.matchAnalysis?.gaps ?? '(absent)',
                acceptedGaps: accepted,
                skippedGaps: tailorData.gapSelections?.skippedGaps ?? '(none)',
                inDraft: accepted.filter((g: string) =>
                  String(g).toLowerCase().split(/[^a-z0-9+#.]+/)
                    .filter((w) => w.length > 2)
                    .every((w) => draft.includes(w))),
                skillsCount: (tailored.skills || []).length,
                draftChars: draft.length,
              });
            } catch (_) {}

            try {
              if (tailorData.jobUrl) {
                const { tailoredCache = {} } = await chrome.storage.local.get('tailoredCache');
                tailoredCache[tailorData.jobUrl] = tailored;
                await chrome.storage.local.set({ tailoredCache });
              }
            } catch (_) {}

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

            return { ...result, tailoredProfile: tailored };
          },
        );

        sendResponse(tailorResult);
        break;
      }

      case 'ANALYZE_GAPS': {
        const gapData = message.data as { jobDescription: string; jobTitle?: string; company?: string; forceRefresh?: boolean };
        // Keyed by page, like every other job-scoped task, so the panel can
        // tell whether a restored record belongs to the tab in front of the user.
        const gapResult = await runBackgroundTask(
          'gaps',
          await activeTabJobKey(),
          { jobTitle: gapData.jobTitle || '', company: gapData.company || '' },
          () => analyzeGapsForJob(gapData.jobDescription, gapData.forceRefresh),
        );
        sendResponse(gapResult);
        break;
      }

      case 'ANALYZE_KEYWORDS':
        const keywordData = message.data as { jobDescription: string; jobTitle?: string };
        const keywordResult = await analyzeKeywords(keywordData.jobDescription, keywordData.jobTitle);
        sendResponse(keywordResult);
        break;

      case 'GENERATE_AI_ANSWERS':
        const aiData = message.data as { questions: string[]; jobDescription: string; questionMeta?: AnswerQuestionMeta[] };
        const aiResult = await runBackgroundTask(
          'singleAnswer',
          `page-answers:${hashStringBg((aiData.questions || []).join('|'))}`,
          undefined,
          () => generateAIAnswers(aiData.questions, aiData.jobDescription, aiData.questionMeta),
        );
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

      // --- Tailor for this job: the same four-step flow as the web app ------
      // (frontend/src/components/JobTailorFlow.jsx). Each handler calls the
      // endpoint the web flow calls, and answers with { success, ...} or
      // { success: false, error, limit? } so the panel can show the usage-limit
      // screen when the allowance is spent.
      case 'JOB_FIT': {
        const d = message.data as { jobDescription: string; jobTitle?: string };
        sendResponse(await jobFit(d));
        break;
      }

      case 'JOB_FIT_RESCORE': {
        const d = message.data as { requirements: any[]; components: any; confirmed: string[] };
        sendResponse(await jobFitRescore(d));
        break;
      }

      case 'TAILOR_FLOW_RUN': {
        const d = message.data as TailorFlowRequest;
        // A durable task: the run, the save and the rescore all happen inside
        // it, so hiding the flow or closing the panel loses nothing.
        const flowResult = await runBackgroundTask(
          'tailor',
          d.jobUrl ? jobTaskKey({ jobUrl: d.jobUrl }) : await activeTabJobKey(),
          { jobUrl: d.jobUrl || '', jobTitle: d.jobTitle || '', company: d.company || '', flow: true },
          () => runTailorFlow(d),
        );
        sendResponse(flowResult);
        break;
      }

      case 'TAILORED_PROFILE_SAVE': {
        const d = message.data as {
          id?: string | null;
          jobTitle?: string;
          companyName?: string;
          jobUrl?: string;
          tailoredData: any;
          matchScore?: number | null;
        };
        sendResponse(await saveTailoredFlowCopy(d));
        break;
      }

      case 'REGENERATE_SECTION': {
        const d = message.data as { profileData: any; instructions: Record<string, string> };
        sendResponse(await regenerateSection(d));
        break;
      }

      case 'TAILOR_USAGE': {
        sendResponse(await tailorUsage());
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
          jobUrl?: string;
          tone?: string;
          length?: string;
        };
        const clResult = await runBackgroundTask(
          'coverLetter',
          clData.jobUrl ? jobTaskKey({ jobUrl: clData.jobUrl }) : await activeTabJobKey(),
          { jobUrl: clData.jobUrl || '', jobTitle: clData.jobTitle || '', company: clData.company || '' },
          async () => {
            const result = await generateCoverLetter(clData);
            // Cache here rather than in the modal — a letter that finishes
            // after the panel closed must still be waiting when it reopens.
            if (result?.success && result.coverLetter && clData.jobUrl) {
              try {
                const { coverLetterCache = {} } = await chrome.storage.local.get('coverLetterCache');
                coverLetterCache[clData.jobUrl] = {
                  coverLetter: result.coverLetter,
                  jobTitle: clData.jobTitle,
                  company: clData.company,
                  savedAt: Date.now(),
                };
                await chrome.storage.local.set({ coverLetterCache });
              } catch (_) {}
            }
            return result;
          },
        );
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
          // Where this sits on the server's ladder. 'in_progress' means the user
          // started the form; 'applied' means we actually observed a submission.
          // Omitting it makes the server default to 'applied', which is what
          // older builds did and why autofill alone counted as an application.
          stage?: 'in_progress' | 'applied';
          confirmedBy?: string;
        };
        const saveAppResult = await saveExternalApplication(appData);
        sendResponse(saveAppResult);
        break;
      }

      case 'MEMORY_CATALOG':
        sendResponse({ success: true, catalog: await getAnswerCatalog() });
        break;

      case 'MEMORY_GET':
        sendResponse(await getMemory());
        break;

      case 'MEMORY_SAVE':
        sendResponse(await saveMemory(message.data as { answerFacts?: Record<string, any>; answerStories?: Record<string, any> }));
        break;

      case 'MEMORY_TRANSCRIBE':
        sendResponse(await transcribeAudio(message.data as { audioBase64: string; mimeType?: string }));
        break;

      case 'EXPERIENCE_FROM_SPEECH':
        sendResponse(await experienceFromSpeech(message.data as { transcript: string; roleHint?: string }));
        break;

      case 'EXPERIENCE_APPEND':
        sendResponse(await experienceAppend(message.data as { roleIndex: number; bullets: string[] }));
        break;

      case 'FACT_DROPDOWN_ANSWERS':
        sendResponse(await factDropdownAnswers(message.data as { fields: Array<{ question: string; options?: string[] }>; jobDescription?: string }));
        break;

      case 'GENERATE_SMART_ANSWERS': {
        const data = message.data as {
          questions: SmartQuestionIn[];
          jobInfo?: { title?: string; company?: string; description?: string } | null;
          jobUrl?: string;
        };
        const result = await runBackgroundTask(
          'smartAnswers',
          data.jobUrl ? jobTaskKey({ jobUrl: data.jobUrl }) : await activeTabJobKey(),
          { jobUrl: data.jobUrl || '', jobTitle: data.jobInfo?.title || '', company: data.jobInfo?.company || '', questions: data.questions },
          () => generateSmartAnswers(data),
        );
        sendResponse(result);
        break;
      }

      case 'GENERATE_SINGLE_ANSWER': {
        const data = message.data as {
          question: SmartQuestionIn;
          jobInfo?: { title?: string; company?: string; description?: string } | null;
          jobUrl?: string;
          forceRegenerate?: boolean;
          instruction?: 'shorter' | 'more_specific' | 'more_personal';
          extraDetail?: string;
        };
        const result = await runBackgroundTask(
          'singleAnswer',
          `${jobTaskKey({ jobUrl: data.jobUrl })}::${data.question?.id || 'q'}${data.forceRegenerate ? ':regen' : ''}${data.instruction ? ':' + data.instruction : ''}${data.extraDetail ? ':x' + data.extraDetail.length : ''}`,
          undefined,
          () => generateSingleSmartAnswer(data),
        );
        sendResponse(result);
        break;
      }

      case 'ANALYZE_MATCH': {
        const data = message.data as {
          jobTitle?: string;
          company?: string;
          jobDescription?: string;
        };
        const result = await runBackgroundTask(
          'match',
          await activeTabJobKey(),
          { jobTitle: data.jobTitle || '', company: data.company || '' },
          () => analyzeMatch(data),
        );
        sendResponse(result);
        break;
      }

      default:
        sendResponse({ error: 'The extension was just updated. Reload this page and try again.' });
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
  if (!pending) {
    console.log('[ProfileAI] finishExtensionLoginRedirect: no pending login, nothing to do');
    return;
  }
  console.log('[ProfileAI] finishExtensionLoginRedirect: returning to job tab', {
    closeLoginTab: pending.loginTabId,
    focusJobTab: pending.originTabId,
    focusWindow: pending.originWindowId,
  });
  try {
    if (pending.loginTabId != null) {
      try { await chrome.tabs.remove(pending.loginTabId); } catch (e) {
        console.log('[ProfileAI] finishExtensionLoginRedirect: could not close login tab', e);
      }
    }
    if (pending.originTabId != null) {
      try { await chrome.tabs.update(pending.originTabId, { active: true }); } catch (e) {
        console.log('[ProfileAI] finishExtensionLoginRedirect: could not focus job tab', e);
      }
    }
    if (pending.originWindowId != null) {
      try { await chrome.windows.update(pending.originWindowId, { focused: true }); } catch (_) {}
      // Side panel is per-window and normally already open through the flow; a
      // best-effort reopen. This one can legitimately throw when there's no
      // active user gesture — that's fine, the tab focus above is what matters.
      try { await chrome.sidePanel.open({ windowId: pending.originWindowId }); } catch (_) {}
    }
    console.log('[ProfileAI] finishExtensionLoginRedirect: done');
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

    // During a panel-initiated sign-in, ONLY trust the exact tab we opened for
    // that login. Otherwise an unrelated profilleai.com tab that happens to be
    // logged in as a DIFFERENT account (e.g. an admin dashboard tab) can be
    // scanned first and its token synced — which is exactly how the panel ended
    // up showing the wrong user. The login tab keeps its localStorage token
    // across the login → /extension-auth-success navigation (same origin), so
    // scoping to it is both correct and sufficient.
    let tabsToCheck = webAppTabs;
    if (pending?.loginTabId != null) {
      const loginTabOnly = webAppTabs.filter(t => t.id === pending.loginTabId);
      if (loginTabOnly.length > 0) {
        tabsToCheck = loginTabOnly;
        console.log(`[ProfileAI] Pending login — restricting auth sync to login tab ${pending.loginTabId}`);
      }
    }

    for (const tab of tabsToCheck) {
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

// The API sits behind Cloudflare in front of Render, and Render redeploys the
// service on every push to main. During that restart — and during an OOM kill,
// which this 512MB instance has had before — the edge answers 502/503/504 on
// its own; the Express app never sees the request. Those windows last seconds,
// but a single request landing in one used to fail for good: fetchProfileImpl
// threw, the catch swallowed it, and the panel fell back to the cached profile,
// which for a first-run user is nothing at all. Retrying across the window is
// the whole fix. Network-level rejections (service worker woken with no
// connectivity, DNS blip) are the same problem wearing a different hat, so they
// retry too.
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const TRANSIENT_RETRY_DELAYS_MS = [600, 1800];

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchWithTransientRetry(url: string, init?: RequestInit): Promise<Response> {
  const lastAttempt = TRANSIENT_RETRY_DELAYS_MS.length;
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) await delay(TRANSIENT_RETRY_DELAYS_MS[attempt - 1]);
    try {
      const response = await fetch(url, init);
      if (attempt === lastAttempt || !TRANSIENT_HTTP_STATUSES.has(response.status)) return response;
      console.warn(`[ProfileAI] ${url} -> HTTP ${response.status} (backend restarting?), retrying`);
    } catch (err) {
      // Total budget here is 2.4s, well inside the MV3 service worker's idle
      // timeout, so the retries cannot outlive the worker that started them.
      if (attempt === lastAttempt) throw err;
      console.warn(`[ProfileAI] ${url} fetch failed, retrying`, err);
    }
  }
}


// A 502/503 does not carry JSON — Cloudflare serves its own HTML error page —
// so the unconditional response.json() the sign-in and promo paths used to do
// threw a SyntaxError, was caught by their outer catch, and reported "Could not
// connect to server". That sends people to check their wifi when the real cause
// is the API redeploying. Parse defensively and name the actual cause instead.
async function readJsonOrNull(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function apiErrorMessage(response: Response, body: any, fallback: string): string {
  if (body?.error) return body.error;
  if (body?.errors?.[0]?.msg) return body.errors[0].msg;
  if (TRANSIENT_HTTP_STATUSES.has(response.status)) {
    return 'ProfileAI is restarting. Wait a few seconds and try again.';
  }
  return fallback;
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
  // `hasSignedInBefore` is deliberately never cleared on logout: it's how the
  // signed-out panel knows to lead with "sign in" instead of pushing this
  // person through profile creation they've already done.
  await chrome.storage.local.set({ authToken: token, user, hasSignedInBefore: true });

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
    const data = await readJsonOrNull(response);
    if (!response.ok) {
      return { success: false, error: apiErrorMessage(response, data, 'Login failed') };
    }
    await handleLogin(data.token, data.user);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('[ProfileAI] Login error:', error);
    return { success: false, error: 'Could not connect to server' };
  }
}

// ── In-panel social sign-in via chrome.identity.launchWebAuthFlow ──
// These run the provider's OAuth in a native popup window (no profilleai tab)
// and exchange the result with our backend, then set the session in-place so
// the panel updates without ever leaving the job page. The extension's OAuth
// redirect URL — chrome.identity.getRedirectURL(), i.e.
// https://<extension-id>.chromiumapp.org/ — MUST be registered as an authorized
// redirect URI in the Google/LinkedIn OAuth apps or the flow fails.
type InteractiveAuthResult =
  | { success: true; token: string; user: User }
  | { success: false; error?: string; notRegistered?: boolean; cancelled?: boolean };

async function googleAuthInteractive(): Promise<InteractiveAuthResult> {
  try {
    if (!CONFIG.GOOGLE_CLIENT_ID) return { success: false, error: 'Google sign-in is not configured' };
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      response_type: 'token',
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      prompt: 'select_account',
    }).toString();

    let redirectResponse: string | undefined;
    try {
      redirectResponse = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    } catch (e) {
      // User closed the popup, or the redirect URI isn't registered on the client.
      console.warn('[ProfileAI] Google launchWebAuthFlow failed:', e);
      return { success: false, cancelled: true, error: 'Google sign-in was cancelled' };
    }
    if (!redirectResponse) return { success: false, cancelled: true };

    const fragment = new URL(redirectResponse).hash.slice(1);
    const accessToken = new URLSearchParams(fragment).get('access_token');
    if (!accessToken) return { success: false, error: 'No Google access token returned' };

    const resp = await fetch(`${CONFIG.API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, clientId: CONFIG.GOOGLE_CLIENT_ID }),
    });
    const data = await readJsonOrNull(resp);
    if (!resp.ok) {
      if (resp.status === 404) return { success: false, notRegistered: true, error: data?.error };
      return { success: false, error: apiErrorMessage(resp, data, 'Google sign-in failed') };
    }
    await handleLogin(data.token, data.user);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('[ProfileAI] Google interactive auth error:', error);
    return { success: false, error: 'Could not complete Google sign-in' };
  }
}

async function linkedinAuthInteractive(): Promise<InteractiveAuthResult> {
  try {
    if (!CONFIG.LINKEDIN_CLIENT_ID) return { success: false, error: 'LinkedIn sign-in is not configured yet' };
    const redirectUri = chrome.identity.getRedirectURL();
    const state = Math.random().toString(36).slice(2);
    const authUrl = 'https://www.linkedin.com/oauth/v2/authorization?' + new URLSearchParams({
      response_type: 'code',
      client_id: CONFIG.LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: CONFIG.LINKEDIN_SCOPE,
      state,
    }).toString();

    let redirectResponse: string | undefined;
    try {
      redirectResponse = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    } catch (e) {
      console.warn('[ProfileAI] LinkedIn launchWebAuthFlow failed:', e);
      return { success: false, cancelled: true, error: 'LinkedIn sign-in was cancelled' };
    }
    if (!redirectResponse) return { success: false, cancelled: true };

    const url = new URL(redirectResponse);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code || returnedState !== state) return { success: false, error: 'LinkedIn sign-in was cancelled' };

    const resp = await fetch(`${CONFIG.API_BASE}/auth/linkedin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    });
    const data = await readJsonOrNull(resp);
    if (!resp.ok) {
      // Backend 404 = valid LinkedIn identity but no ProfilleAI account yet.
      if (resp.status === 404) return { success: false, notRegistered: true, error: data?.error };
      return { success: false, error: apiErrorMessage(resp, data, 'LinkedIn sign-in failed') };
    }
    await handleLogin(data.token, data.user);
    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    console.error('[ProfileAI] LinkedIn interactive auth error:', error);
    return { success: false, error: 'Could not complete LinkedIn sign-in' };
  }
}

async function registerWithCredentials(data: { email: string; password: string; firstName: string; lastName: string; role?: string }) {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await readJsonOrNull(response);
    if (!response.ok) {
      return { success: false, error: apiErrorMessage(response, result, 'Registration failed') };
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
async function analyzeGapsForJob(jobDescription: string, forceRefresh = false) {
  if (!authToken) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    // No profile in the body: the server loads the stored record itself. This
    // used to upload the cached raw /me row — embedding vectors and the full
    // original resume text included — on every call, and a copy that went
    // stale whenever the profile was edited on the web.
    const response = await fetch(`${CONFIG.API_BASE}/profiles/analyze-gaps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobDescription,
        // A deliberate "Tailor Again" must not be answered from the stored
        // analysis — identical gaps are what made re-tailoring look like a
        // no-op, with no way for the user to get a fresh read.
        forceRefresh: forceRefresh || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze gaps');
    }

    const data = await response.json();
    return {
      success: true,
      gaps: data.gaps || [],
      satisfiedAlternatives: data.satisfiedAlternatives || [],
      // Surfaced so the panel can say "this is your saved analysis" instead of
      // presenting a cached report as a fresh one.
      cached: !!data.cached,
    };
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
    // No profile in the body — the server loads the stored record. See
    // analyzeGapsForJob for why the client copy is no longer sent.
    const response = await fetch(`${CONFIG.API_BASE}/profiles/tailor-for-job`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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

// --- Tailor flow API ---------------------------------------------------------
// One small authenticated-JSON helper for the endpoints the tailor flow calls.
// It adopts a fresher web-app token and retries once on a 401, like the profile
// fetch does. Transient 502/503/504 retries are opt-in: the AI endpoints spend
// an allowance, and re-sending a request the server may already have started
// could spend it twice.
interface ApiResult {
  ok: boolean;
  status: number;
  body: any;
  limit: LimitInfo | null;
  error: string;
}

async function authedApi(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path: string,
  payload?: unknown,
  opts: { retryTransient?: boolean } = {},
): Promise<ApiResult> {
  if (!authToken) {
    return { ok: false, status: 401, body: null, limit: null, error: 'Sign in to ProfileAI to continue.' };
  }
  const send = () => {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        // A FormData body sets its own multipart boundary header.
        ...(payload !== undefined && !(payload instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload === undefined ? undefined : payload instanceof FormData ? payload : JSON.stringify(payload),
    };
    const url = `${CONFIG.API_BASE}${path}`;
    return opts.retryTransient ? fetchWithTransientRetry(url, init) : fetch(url, init);
  };
  try {
    let response = await send();
    if (response.status === 401 && (await adoptFresherTokenFromWebApp(authToken))) {
      response = await send();
    }
    const body = await readJsonOrNull(response);
    const limit = parseLimit(response.status, body);
    const error = response.ok
      ? ''
      : (limit?.message || limit?.error || apiErrorMessage(response, body, 'Something went wrong. Please try again.'));
    return { ok: response.ok, status: response.status, body, limit, error };
  } catch (err) {
    console.error(`[ProfileAI] ${method} ${path} failed`, err);
    return {
      ok: false,
      status: 0,
      body: null,
      limit: null,
      error: 'Could not reach ProfileAI. Check your connection and try again.',
    };
  }
}

const apiFailure = (r: ApiResult, fallback: string) => ({
  success: false as const,
  error: r.error || fallback,
  ...(r.limit ? { limit: r.limit } : {}),
});

/** The match, as the web flow reads it: every requirement and its coverage.
 *  Free when the server has it cached. */
async function jobFit(d: { jobDescription: string; jobTitle?: string }) {
  if (!d?.jobDescription || d.jobDescription.trim().length < 30) {
    return { success: false, error: 'Could not read this job. Scroll the posting into view and try again.' };
  }
  const r = await authedApi('POST', '/profiles/job-match', { jobDescription: d.jobDescription, jobTitle: d.jobTitle });
  if (!r.ok || !r.body?.success || !r.body?.data) return apiFailure(r, 'Could not score this job');
  return { success: true, data: r.body.data };
}

/** The score again with confirmed requirements counted as covered. No AI. */
async function jobFitRescore(d: { requirements: any[]; components: any; confirmed: string[] }) {
  const r = await authedApi('POST', '/profiles/job-match/rescore', d, { retryTransient: true });
  if (!r.ok || !r.body?.success) return apiFailure(r, 'Could not update the score');
  return { success: true, score: r.body.score as number };
}

interface TailorFlowRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  jobUrl?: string;
  gapSelections?: unknown;
  tailorSettings?: unknown;
  /** Saved on the record: the match score the candidate saw going in. */
  matchScore?: number | null;
  skillGaps?: unknown[];
  /** What the post-tailoring score is computed from (free arithmetic). */
  rescore?: { requirements: any[]; components: any; confirmed: string[] } | null;
  /** The score before tailoring, handed back so a restored review can say "was". */
  beforeScore?: number | null;
}

/** Tailor, save to the user's tailored resumes, and rescore, as one task. */
async function runTailorFlow(d: TailorFlowRequest) {
  const t = await authedApi('POST', '/profiles/tailor-for-job', {
    jobDescription: d.jobDescription,
    jobTitle: d.jobTitle,
    company: d.company,
    gapSelections: d.gapSelections,
    tailorSettings: d.tailorSettings,
  });
  if (!t.ok || !t.body?.success || !t.body?.data) {
    return apiFailure(t, 'Tailoring failed. No credit was used. Please try again.');
  }
  const tailored = t.body.data;

  let savedId: string | null = null;
  const saved = await authedApi('POST', '/tailored-profiles', {
    jobTitle: d.jobTitle || tailored.jobTitle || 'Untitled position',
    companyName: d.company || '',
    jobUrl: d.jobUrl || undefined,
    tailoredData: tailored,
    matchScore: d.matchScore ?? undefined,
    skillGaps: d.skillGaps || [],
  });
  if (saved.ok) savedId = saved.body?.id || null; // otherwise saved again from Review

  let afterScore: number | null = null;
  if (d.rescore?.requirements?.length) {
    const rs = await jobFitRescore(d.rescore);
    if (rs.success) afterScore = (rs as { score: number }).score;
  }

  return { success: true, tailored, savedId, afterScore, beforeScore: d.beforeScore ?? null };
}

/** Review's save: updates the copy made by the run, or creates it if that save failed. */
async function saveTailoredFlowCopy(d: {
  id?: string | null;
  jobTitle?: string;
  companyName?: string;
  jobUrl?: string;
  tailoredData: any;
  matchScore?: number | null;
}) {
  const record: Record<string, unknown> = { tailoredData: d.tailoredData, matchScore: d.matchScore ?? undefined };
  const r = d.id
    ? await authedApi('PUT', `/tailored-profiles/${encodeURIComponent(d.id)}`, record, { retryTransient: true })
    : await authedApi('POST', '/tailored-profiles', {
        ...record,
        jobTitle: d.jobTitle || 'Untitled position',
        companyName: d.companyName || '',
        jobUrl: d.jobUrl || undefined,
      });
  if (!r.ok) return apiFailure(r, 'Could not save your tailored resume. Please try again.');
  return { success: true, id: (r.body?.id as string | undefined) || d.id || null };
}

/** Ask AI on one section of the tailored copy. */
async function regenerateSection(d: { profileData: any; instructions: Record<string, string> }) {
  const r = await authedApi('POST', '/profiles/regenerate-sections', d);
  if (!r.ok) return apiFailure(r, 'Could not rewrite this section. Please try again.');
  return { success: true, data: r.body?.data || {} };
}

/** Whether tailoring is unlimited on this plan, so the button can say "1 credit" or not. */
async function tailorUsage() {
  const r = await authedApi('GET', '/subscriptions/usage', undefined, { retryTransient: true });
  if (!r.ok) return { success: false, unlimited: false };
  const t = r.body?.usage?.tailor_profile;
  const unlimited = !!t && [t.weeklyLimit, t.monthlyLimit, t.dailyLimit ?? -1, t.lifetimeLimit ?? -1].every((v: number) => v === -1);
  return { success: true, unlimited };
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
    const result = await readJsonOrNull(response);
    if (!response.ok) {
      return { error: apiErrorMessage(response, result, 'Failed to redeem promo code') };
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

/**
 * Extracts the job posting from the active tab (scripting API first, content
 * script second, stored info as a fallback) and runs the keyword analysis on
 * it. Returns the response shape the side panel expects.
 */
async function analyzeActiveJobPage(score = false): Promise<any> {
  let pageJobInfo: any = null;
  let resolvedTabId: number | null = null;
  // The page this analysis is about. Used to reject a stored posting that
  // belongs to some other tab — see the storage fallback below.
  let activeUrl = '';
  try {
    const tabs2 = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs2[0];
    resolvedTabId = tab?.id ?? null;
    activeUrl = tab?.url || '';
    console.log('[ProfileAI BG] ANALYZE_JOB_PAGE — tab:', tab?.id, tab?.url?.slice(0, 80));
    // Same non-job guard as GET_JOB_INFO_RELAY — don't scrape phantom
    // titles/companies from social/profile/search pages.
    if (isNonJobUrl(tab?.url)) {
      console.log('[ProfileAI BG] Skipping analyze — non-job URL');
      await clearStoredJobInfo();
      return { success: false, error: 'This page does not look like a job posting.' };
    }
    if (tab?.id && tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      // Method 1: executeScript (direct DOM access, no content script
      // dependency). Injects the SHARED scraper — this used to be a second,
      // independently-written copy of the extraction logic, and the two drifted
      // apart on exactly the fields that matter (title selector priority,
      // bullet preservation).
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: scrapeJobFromDocument,
        });
        if (results?.[0]?.result) {
          pageJobInfo = results[0].result;
          console.log('[ProfileAI BG] ANALYZE_JOB_PAGE executeScript result:', {
            title: pageJobInfo.title?.slice(0, 60),
            company: pageJobInfo.company?.slice(0, 40),
            descLength: pageJobInfo.description?.length || 0,
            site: pageJobInfo.site,
            via: pageJobInfo.via,
          });
        }
      } catch (e) {
        console.log('[ProfileAI BG] ANALYZE_JOB_PAGE executeScript failed:', e);
      }


      // Method 2: ask the content script. It runs the SAME scraper, but from
      // inside the page, so it can see content an injected read occasionally
      // misses (and it is the only path available if injection is blocked).
      //
      // The two are merged FIELD BY FIELD. The old merge gated everything on
      // "is the content script's description longer?" and then took its title
      // too — so a longer description could drag a worse title along with it,
      // overwriting a title read from the posting's own header with one read
      // from a stray `h1`.
      try {
        const csResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
        if (csResponse) {
          const merged = mergeScrapes(pageJobInfo, csResponse);
          console.log('[ProfileAI BG] ANALYZE_JOB_PAGE merged scrapes:', {
            injected: {
              title: pageJobInfo?.title?.slice(0, 60),
              descLength: pageJobInfo?.description?.trim().length || 0,
              via: pageJobInfo?.via,
            },
            contentScript: {
              title: csResponse.title?.slice(0, 60),
              descLength: csResponse.description?.trim().length || 0,
              via: csResponse.via,
            },
            chose: {
              title: merged.title?.slice(0, 60),
              descLength: merged.description?.trim().length || 0,
              via: merged.via,
            },
          });
          pageJobInfo = merged;
        }
      } catch (e) {
        console.log('[ProfileAI BG] ANALYZE_JOB_PAGE content script message failed:', e);
      }

      // Store in storage for future use. `_url` travels with the payload so a
      // later reader can tell which page the text came from — storage holds one
      // slot shared by every tab.
      if (pageJobInfo && (pageJobInfo.title || pageJobInfo.company || pageJobInfo.description)) {
        chrome.storage.local.set({
          currentJobInfo: { ...pageJobInfo, _ts: Date.now(), _url: tab.url },
          currentJobUrl: tab.url,
        });
      }
    }
  } catch (e) {
    console.log('[ProfileAI BG] ANALYZE_JOB_PAGE tabs.query failed:', e);
  }
  // Storage fallback — ONLY for the same page.
  //
  // `currentJobInfo` is a single slot shared across every tab, so an unguarded
  // fallback happily substituted a different posting whenever the live read
  // came back short: the user got a resume tailored, flawlessly, to whatever
  // job they had looked at before this one. The URL has to match for the
  // stored copy to be about this page at all.
  if (!pageJobInfo || (!pageJobInfo.description || pageJobInfo.description.trim().length < 30)) {
    try {
      const stored = await chrome.storage.local.get(['currentJobInfo', 'currentJobUrl']);
      const storedUrl = stored.currentJobInfo?._url || stored.currentJobUrl || '';
      const samePage = !!activeUrl && !!storedUrl && storedUrl === activeUrl;
      if (!samePage && stored.currentJobInfo) {
        console.log(
          '[ProfileAI BG] ANALYZE_JOB_PAGE ignoring storage fallback — it belongs to a different page',
          { storedUrl: storedUrl?.slice(0, 80), activeUrl: activeUrl?.slice(0, 80) }
        );
      }
      if (
        samePage &&
        stored.currentJobInfo &&
        stored.currentJobInfo.description?.trim().length > (pageJobInfo?.description?.trim().length || 0)
      ) {
        console.log('[ProfileAI BG] ANALYZE_JOB_PAGE using storage fallback, descLength:', stored.currentJobInfo.description?.length);
        pageJobInfo = stored.currentJobInfo;
      }
    } catch (_) {}
  }

  if (!pageJobInfo?.description || pageJobInfo.description.trim().length < 30) {
    console.log('[ProfileAI BG] ANALYZE_JOB_PAGE: no description found, pageJobInfo:', JSON.stringify(pageJobInfo)?.slice(0, 200));
    return { success: false, error: 'Could not extract job description from this page. Try scrolling down to load the full job description, then click Analyze again.', jobInfo: pageJobInfo };
  }

  console.log('[ProfileAI BG] ANALYZE_JOB_PAGE: analyzing', pageJobInfo.description.length, 'chars');
  // The title carries the role-fit judgement, so it goes in with the body.
  if (!score) return { success: true, jobInfo: pageJobInfo };
  const analysisResult = await analyzeKeywords(pageJobInfo.description, pageJobInfo.title);
  return { ...analysisResult, jobInfo: pageJobInfo };
}

/**
 * Scores the candidate against a posting — one score, from the AI read.
 *
 * /profiles/job-match has the model extract each requirement and grade the
 * evidence for it; the server's fixed arithmetic turns that into the number.
 * There used to be a second, on-device score from keyword matching beside it,
 * and two numbers for one posting meant neither could be trusted.
 *
 * When the AI read can't run (signed out, allowance used up, the service
 * failing) the card gets the vocabulary scan with the reason and NO number:
 * a guessed score in place of the real one is the thing this replaced.
 */
async function analyzeKeywords(jobDescription: string, jobTitle?: string) {
  try {
    const result = await deepJobMatch(jobDescription, jobTitle);
    if (result.success && result.keywords) {
      console.log('[ProfileAI] Job match:', {
        score: result.keywords.matchScore,
        projected: result.keywords.projectedScore,
        requirements: result.keywords.totalKeywords,
        blockers: result.keywords.blockers.length,
        components: result.keywords.components,
      });
      return { success: true, keywords: result.keywords };
    }
    await fetchProfile();
    const scan = extractKeywordsLocal(jobDescription, cachedProfile || ({} as any));
    return { success: true, keywords: { ...scan, reason: result.error || 'The match score could not be computed.' } };
  } catch (error) {
    console.error('[ProfileAI] Job match error:', error);
    return { success: false, error: (error as Error).message };
  }
}

/** One AI read of a posting against the stored profile. Spends a job-match
 *  allowance, except when the server answers from its cache (same posting,
 *  unchanged profile). */
async function deepJobMatch(jobDescription: string, jobTitle?: string) {
  if (!authToken) {
    return { success: false, error: 'Sign in to see your match score for this job.' };
  }
  try {
    // No profile in the body — the server scores against the stored record.
    const response = await fetch(`${CONFIG.API_BASE}/profiles/job-match`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobDescription, jobTitle }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // A used-up allowance answers with a short `error` ("Lifetime trial used")
      // and the sentence the user needs in `message`.
      throw new Error(errorData.message || errorData.error || 'The match score could not be computed.');
    }
    const { data } = await response.json();
    return { success: true, keywords: shapeServerJobMatch(data) };
  } catch (error) {
    console.error('[ProfileAI] Job match request failed:', error);
    return { success: false, error: (error as Error).message };
  }
}

/** The server's job-match payload in the shape the match card renders. */
function shapeServerJobMatch(data: any) {
  const requirements: any[] = Array.isArray(data?.requirements) ? data.requirements : [];
  // Responsibilities carry no weight on the server either; showing them as
  // gaps would hand the user work no screen checks.
  const scored = requirements.filter((r) => r?.type !== 'responsibility' && r?.requirement);
  const byHardness = (list: any[]) => [
    ...list.filter((r) => r.hardness === 'must'),
    ...list.filter((r) => r.hardness !== 'must'),
  ];
  const names = (coverage: string) =>
    byHardness(scored.filter((r) => r.coverage === coverage)).map((r) => String(r.requirement));
  const blockers: Array<{ requirement: string; type: string; why: string }> = Array.isArray(data?.blockers)
    ? data.blockers
    : [];
  const blockerSet = new Set(blockers.map((b) => b.requirement.toLowerCase()));
  const priorities: Record<string, 'high' | 'medium' | 'low'> = {};
  for (const r of scored.filter((q) => q.coverage === 'none')) {
    const key = String(r.requirement).toLowerCase();
    // Every unmet required item is high impact — knockouts are listed apart,
    // and a required gap that doesn't knock the application out still costs
    // its full share of the score.
    priorities[key] = blockerSet.has(key) || r.hardness === 'must' ? 'high' : 'low';
  }
  return {
    matchScore: Number(data?.score) || 0,
    projectedScore: Number(data?.projectedScore) || 0,
    present: names('strong'),
    partial: names('partial'),
    missing: names('none'),
    totalKeywords: scored.length,
    source: 'ai' as const,
    provisional: false,
    priorities,
    blockers,
    components: data?.components,
    verdict: typeof data?.verdict === 'string' ? data.verdict : '',
  };
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

// Word-boundary occurrence count. Multi-word keywords carrying symbols
// (".net", "c++", "ci/cd") need looser edges than \b, which misbehaves next to
// punctuation. Shared by the job-description scan and the profile scan so both
// sides of the comparison use identical matching rules.
const escapeRegexBg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function countKeywordMatches(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  const hasSymbol = /[^a-z0-9 ]/i.test(keyword);
  const pattern = hasSymbol
    ? `(?<![a-z0-9])${escapeRegexBg(keyword)}(?![a-z0-9])`
    : `\\b${escapeRegexBg(keyword)}\\b`;
  try {
    return text.match(new RegExp(pattern, 'gi'))?.length || 0;
  } catch {
    // Defensive fallback if a runtime doesn't support lookbehind
    return text.match(new RegExp(`\\b${escapeRegexBg(keyword)}\\b`, 'gi'))?.length || 0;
  }
}

const containsKeyword = (text: string, keyword: string): boolean =>
  countKeywordMatches(text, keyword) > 0;

// Comprehensive keyword list covering tech, business, and soft skills.
// ONE list, used to read the job description AND to read the candidate's
// profile. They used to be two different lists, which meant 147 terms could be
// detected in a posting but never in the user's experience — those always came
// back "missing" no matter what the person had actually done.
const KNOWN_KEYWORDS = [
  // Programming languages
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'go', 'golang',
  'rust', 'swift', 'kotlin', 'scala', 'php', 'perl', 'r lang', 'matlab', 'dart',
  'elixir', 'haskell', 'lua', 'objective-c', 'groovy', 'powershell', 'bash', 'shell scripting',
  // Frontend
  'react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby',
  'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap', 'material ui',
  'webpack', 'vite', 'rollup', 'babel', 'storybook',
  'redux', 'mobx', 'zustand', 'recoil', 'jotai', 'xstate',
  'react query', 'tanstack query', 'swr',
  'frontend', 'front-end', 'front end',
  // Graphics, mapping & real-time collaboration — without these a graphics or
  // geospatial posting had nothing to match on, and every requirement in it
  // fell through to raw word overlap.
  'webgl', 'webgpu', 'three.js', 'threejs', 'opengl', 'glsl', 'shaders', 'shader',
  'canvas', 'svg', 'd3', 'd3.js', '3d', 'vr', 'virtual reality', 'webxr',
  'deck.gl', 'mapbox', 'maplibre', 'leaflet', 'openlayers', 'cesium',
  'gis', 'postgis', 'geospatial', 'vector tiles', 'mvt',
  'crdt', 'yjs', 'automerge', 'operational transforms', 'operational transformation',
  'webrtc', 'web workers', 'webassembly', 'wasm',
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

// Alias collapse, so "node.js" and "nodejs" never appear as two keywords.
const KEYWORD_ALIASES: Record<string, string> = {
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
  'threejs': 'three.js', 'd3.js': 'd3', 'shader': 'shaders', 'glsl': 'shaders',
  'tanstack query': 'react query', 'virtual reality': 'vr', 'wasm': 'webassembly',
  'mvt': 'vector tiles', 'operational transformation': 'operational transforms',
};

/** Canonical form of a keyword ("nodejs" and "node.js" are the same thing). */
const canonicalKeyword = (kw: string): string => KEYWORD_ALIASES[kw] || kw;

/** Every spelling of a canonical keyword, so a profile written as "golang"
 *  still satisfies a posting that says "Go". */
const KEYWORD_VARIANTS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [alias, canonical] of Object.entries(KEYWORD_ALIASES)) {
    (out[canonical] = out[canonical] || []).push(alias);
  }
  return out;
})();

const keywordSpellings = (keyword: string): string[] => [keyword, ...(KEYWORD_VARIANTS[keyword] || [])];

function extractKeywordsLocal(jobDescription: string, profile: any) {
  if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
    console.warn('[ProfileAI] extractKeywordsLocal: description too short or missing', { length: jobDescription?.length });
    return { totalKeywords: 0, matchScore: 0, present: [], missing: [], source: 'local' as const, provisional: true };
  }

  // Stash the original (case-preserved) JD on globalThis so extractDynamicKeywords
  // can use case as a proper-noun signal (e.g. "Cypress" vs. "cypress" leaking
  // from "experience with the company"). Also keep a lowercased copy for matching.
  (globalThis as any).__profileai_lastJobDescription = jobDescription;
  const text = jobDescription.toLowerCase();

  // --- Phase 1: Check known keywords against job description ---
  // Word-boundary matching for ALL keywords avoids substring false positives
  // ("less" in "wireless", "rust" in "trust", "safe" in "safety"). Occurrence
  // counts do double duty: they drop mentioned-once-in-passing noise, and they
  // order the results by how much the posting actually leans on each term.
  const counts = new Map<string, number>();
  for (const keyword of KNOWN_KEYWORDS) {
    const count = countKeywordMatches(text, keyword);
    if (count === 0) continue;
    // Generic fluff ("communication", "leadership") and very short terms
    // ("ai", "go", "ux") need a second mention to count as a real requirement
    // rather than a throwaway line in the company blurb.
    const isFluff = SOFT_SKILL_FLUFF.has(keyword) || keyword.length <= 3;
    if (isFluff && count < 2) continue;
    const canonical = canonicalKeyword(keyword);
    counts.set(canonical, (counts.get(canonical) || 0) + count);
  }

  // --- Phase 2: Extract skills dynamically from requirements/qualifications ---
  // Strict mode: only accept phrases that look like proper nouns / tech terms,
  // OR are already in our known vocabulary. Generic categorical phrases like
  // "design systems", "testing frameworks", "user interface" get filtered out
  // because they collapse to known aliases or fail the quality filter.
  const knownKeywordsLower = new Set(KNOWN_KEYWORDS.map((k) => k.toLowerCase()));
  for (const skill of extractDynamicKeywords(text, knownKeywordsLower)) {
    const canonical = canonicalKeyword(skill);
    if (!counts.has(canonical)) {
      counts.set(canonical, countKeywordMatches(text, skill) || 1);
    }
  }

  // Most-repeated first. The UI ranks impact by position, so this ordering is
  // what makes "high impact" mean anything at all.
  const foundInJob = Array.from(counts.keys()).sort(
    (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b),
  );

  console.log('[ProfileAI] Keywords found in job description:', foundInJob.length, foundInJob.slice(0, 20));

  // --- Match against user profile ---
  // A keyword counts as covered when it appears as a WHOLE WORD among the
  // user's skills or in their experience text. The previous check was a
  // bidirectional substring test, which matched "go" inside "mongodb", "ai"
  // inside "tailwind" and "ui" inside "build tools" — every one of those
  // inflated the score with skills the candidate never claimed.
  const profileSkills = flattenSkills(profile.skills);
  const experienceKeywords = new Set(extractSkillsFromExperience(profile.experience));
  const skillBlob = profileSkills.join(' | ');

  console.log('[ProfileAI] Extracted profile skills:', {
    fromSkillsField: profileSkills,
    fromExperience: Array.from(experienceKeywords),
  });

  const present: string[] = [];
  const missing: string[] = [];

  for (const keyword of foundInJob) {
    const covered = keywordSpellings(keyword).some(
      (spelling) => experienceKeywords.has(spelling) || containsKeyword(skillBlob, spelling),
    );
    if (covered) present.push(keyword);
    else missing.push(keyword);
  }

  const matchScore = foundInJob.length > 0 ? Math.round((present.length / foundInJob.length) * 100) : 0;

  // `provisional` is the important field here. This ratio is vocabulary overlap
  // — it knows nothing about the candidate's title, seniority, or whether a term
  // was a hard requirement or a word in the company blurb. Presented as a match
  // score it reads as authoritative and is not; the panel shows the keyword
  // chips from this pass but waits for /job-match for a number.
  return {
    totalKeywords: foundInJob.length,
    matchScore,
    present,
    missing,
    source: 'local' as const,
    provisional: true,
  };
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

/**
 * Canonical keywords the candidate demonstrably has, read out of their
 * experience entries. Uses the SAME vocabulary as the job-description scan —
 * a second, shorter list here used to make 147 terms permanently unmatchable.
 */
function extractSkillsFromExperience(experience: any[]): string[] {
  if (!experience || !Array.isArray(experience)) return [];

  const found = new Set<string>();

  experience.forEach((exp: any) => {
    // Combine all text fields from experience (handle both title and position field names)
    const textToSearch = [
      exp.title || exp.position || '',
      exp.description || '',
      exp.company || '',
      ...(exp.achievements || []),
      ...(exp.skills || []).map((s: any) => (typeof s === 'string' ? s : s?.name || '')),
    ].join(' ').toLowerCase();

    for (const keyword of KNOWN_KEYWORDS) {
      // Two-letter terms ("ai", "go", "ux") are too easy to hit inside prose
      // like "go-to-market", so free-form experience text doesn't get to claim
      // them — only an explicit entry in the skills list does.
      if (keyword.length <= 2) continue;
      if (containsKeyword(textToSearch, keyword)) found.add(canonicalKeyword(keyword));
    }
  });

  return Array.from(found);
}

// AI-powered answer generation for screening questions. The server loads the
// person's answer memory itself, so nothing personal is sent from here beyond
// the profile snapshot. `details` carries where each answer came from.
interface AnswerQuestionMeta {
  question: string;
  fieldType: string;
  options?: string[] | null;
  optional?: boolean;
  wordHint?: { min: number; max: number } | null;
}

async function generateAIAnswers(questions: string[], jobDescription: string, questionMeta?: AnswerQuestionMeta[]) {
  try {
    if (!cachedProfile) await fetchProfile();
    const profile = cachedProfile || ({} as any);

    if (!authToken) {
      return { answers: generateLocalAnswers(questions, profile), details: {} as Record<string, AnswerDetail> };
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
        questionMeta: (questionMeta || questions.map((q): AnswerQuestionMeta => ({ question: q, fieldType: 'text', options: null }))).map((m) => ({
          question: m.question,
          fieldType: m.fieldType,
          ...(m.options ? { options: m.options } : {}),
          ...(m.optional ? { optional: true } : {}),
          ...(m.wordHint ? { wordHint: m.wordHint } : {}),
        })),
        profile: {
          title: profile.title || profile.headline,
          summary: profile.summary,
          skills: profile.skills,
          experience: profile.experience,
          education: profile.education,
          location: profile.location,
        },
      }),
    });

    if (!response.ok) {
      console.log('[ProfileAI] API failed, using local answer generation');
      return { answers: generateLocalAnswers(questions, profile), details: {} as Record<string, AnswerDetail> };
    }

    const result = await response.json();
    const body = result.data?.answers ? result.data : result;
    return {
      answers: (body.answers || {}) as Record<string, string>,
      details: (body.details || {}) as Record<string, AnswerDetail>,
    };
  } catch (error) {
    console.error('[ProfileAI] AI answer generation error:', error);
    const profile = cachedProfile || ({} as any);
    return { answers: generateLocalAnswers(questions, profile), details: {} as Record<string, AnswerDetail> };
  }
}

// Local fallback answer generation (no API needed). Only used when the server
// cannot be reached; it never states personal facts, only what the profile says.
function generateLocalAnswers(questions: string[], profile: any): Record<string, string> {
  const answers: Record<string, string> = {};
  const skills = flattenSkills(profile.skills);

  questions.forEach((q) => {
    const question = q.toLowerCase();

    // Personal facts (work authorization, visa sponsorship, years of experience, start date,
    // salary, how they heard of the job) and claims about tools or products are never guessed
    // here: a wrong answer on an application is worse than a blank one. Those fields stay
    // empty for the person to fill in.
    if (question.includes('tech stack') || question.includes('technologies') || question.includes('proficient')) {
      if (skills.length) answers[q] = skills.slice(0, 10).join(', ');
    } else if (
      (question.includes('interested') || question.includes('excited') || question.includes('attract') || question.includes('appeal') || question.includes('why')) &&
      (question.includes('role') || question.includes('position') || question.includes('opportunity') || question.includes('company') || question.includes('job') || question.includes('apply') || question.includes('join'))
    ) {
      if (skills.length) {
        answers[q] = `This role lines up well with my background in ${skills.slice(0, 3).join(', ')}. ${(profile.summary || '').slice(0, 200)}`.trim();
      }
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
// Multiple message handlers (CHECK_AUTH_SILENT, SYNC_AUTH_FROM_WEB, LOGIN) can
// fire within milliseconds of each other around a sign-in, each independently
// calling fetchProfile(). Sharing one in-flight request avoids stampeding the
// backend with concurrent calls that raced observably in production and made
// the pending-login race above harder to reason about.
let fetchProfileInFlight: Promise<FullProfile | null> | null = null;

async function fetchProfile(): Promise<FullProfile | null> {
  if (!authToken) return null;
  if (fetchProfileInFlight) return fetchProfileInFlight;
  fetchProfileInFlight = fetchProfileImpl();
  try {
    return await fetchProfileInFlight;
  } finally {
    fetchProfileInFlight = null;
  }
}

// Force-read the current token straight from an open web app tab, ignoring the
// cached authToken. Used to self-heal when the cached token is stale: the web
// app's localStorage holds the user's CURRENT valid token, so on a 401 we can
// adopt it and retry instead of getting permanently stuck on a dead token.
// Sets auth state directly (no fetchProfile) to avoid recursing back here.
async function adoptFresherTokenFromWebApp(deadToken: string | null): Promise<boolean> {
  try {
    const allTabs = await chrome.tabs.query({});
    const webAppTabs = allTabs.filter(tab =>
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
          func: () => {
            try {
              const token = localStorage.getItem('token');
              const userStr = localStorage.getItem('user');
              return { token, user: userStr ? JSON.parse(userStr) : null };
            } catch { return { token: null, user: null }; }
          },
        });
        const r = results[0]?.result as { token: string | null; user: User | null } | undefined;
        if (r?.token && r?.user && r.token !== deadToken) {
          authToken = r.token;
          currentUser = r.user;
          cachedProfile = null;
          await chrome.storage.local.remove(['profile', 'extSignedOut']);
          await chrome.storage.local.set({ authToken: r.token, user: r.user, hasSignedInBefore: true });
          console.log('[ProfileAI] Adopted a fresher token from web app tab after 401');
          return true;
        }
      } catch (_) { /* tab not scriptable (chrome:// etc.) */ }
    }
  } catch (_) { /* ignore */ }
  return false;
}

async function fetchProfileImpl(retryOn401 = true): Promise<FullProfile | null> {
  const tokenFingerprint = authToken ? `${authToken.slice(0, 12)}…(len ${authToken.length})` : 'null';
  try {
    const response = await fetchWithTransientRetry(`${CONFIG.API_BASE}/profiles/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        let body = '';
        try { body = await response.clone().text(); } catch (_) {}
        console.warn('[ProfileAI] /profiles/me rejected:', {
          status: response.status,
          body,
          apiBase: CONFIG.API_BASE,
          tokenFingerprint,
        });
        // Self-heal: the cached token is stale/dead, but an open web app tab
        // almost certainly holds the user's CURRENT valid token. Adopt it and
        // retry once. This is what was actually breaking the panel — the
        // extension clung to a token from a previous session and never
        // refreshed it, so every profile fetch 401'd forever.
        if (retryOn401) {
          const deadToken = authToken;
          const adopted = await adoptFresherTokenFromWebApp(deadToken);
          if (adopted && authToken !== deadToken) {
            console.log('[ProfileAI] Retrying /profiles/me with the refreshed token');
            return await fetchProfileImpl(false);
          }
        }
        // No fresher token available — don't tear down the session here (that
        // used to cancel the panel's post-login redirect); just report no
        // profile. A genuinely dead token surfaces on the next real action.
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

interface SmartCacheEntry { answer: string; ts: number; source?: string }

/** Cached answers written under older answer rules may contain invented facts,
 *  so a version bump throws the whole cache away once. */
async function loadSmartAnswerCache(): Promise<Record<string, SmartCacheEntry>> {
  const { smartAnswerCache, smartAnswerRulesVersion } = await chrome.storage.local.get(['smartAnswerCache', 'smartAnswerRulesVersion']);
  const v = applyRulesVersion<SmartCacheEntry>(smartAnswerCache, smartAnswerRulesVersion);
  if (v.reset) {
    await chrome.storage.local.set({ smartAnswerCache: {}, smartAnswerRulesVersion: v.version });
  }
  return v.cache;
}

async function saveSmartAnswerCacheEntry(key: string, answer: string, source = 'ai') {
  const cache = await loadSmartAnswerCache();
  cache[key] = { answer, ts: Date.now(), source };
  // Cap cache size to avoid storage bloat (keep newest 200).
  const entries = Object.entries(cache);
  const keep: Record<string, SmartCacheEntry> = {};
  (entries.length > 200 ? entries.sort((x, y) => y[1].ts - x[1].ts).slice(0, 200) : entries)
    .forEach(([k, v]) => { keep[k] = v; });
  await chrome.storage.local.set({ smartAnswerCache: keep, smartAnswerRulesVersion: ANSWERS_RULES_VERSION });
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

const TEXT_FIELD_TYPES = new Set(['textarea', 'longtext', 'contenteditable', 'text']);

interface SmartQuestionIn {
  id: string;
  question: string;
  fieldType: string;
  options?: string[] | null;
  optional?: boolean;
  wordHint?: { min: number; max: number } | null;
}

interface SmartResultOut {
  questionId: string;
  question: string;
  answer: string;
  source: AnswerDetail['source'];
  detail: AnswerDetail;
  /** Re-used from an earlier run rather than generated now. */
  cached?: 'job' | 'saved';
}

/** Questions that must be answered by the server from the person's memory and
 *  never from a local cache or a fuzzy saved answer. */
function serverOnlyQuestion(q: SmartQuestionIn, catalog: AnswerCatalog | null): boolean {
  if (!TEXT_FIELD_TYPES.has(q.fieldType)) return true;
  return !!matchFact(q.question, catalog);
}

const normQuestion = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

function lookupByQuestion<T>(map: Record<string, T> | undefined, question: string): T | undefined {
  if (!map) return undefined;
  if (map[question] !== undefined) return map[question];
  const target = normQuestion(question);
  for (const [k, v] of Object.entries(map)) if (normQuestion(k) === target) return v;
  return undefined;
}

function detailFor(question: string, answers: Record<string, string>, details: Record<string, AnswerDetail>): AnswerDetail {
  const d = lookupByQuestion(details, question);
  const ans = lookupByQuestion(answers, question) || d?.answer || '';
  if (d) return { ...d, answer: d.answer ?? ans };
  return ans ? { answer: ans, source: 'ai' } : { answer: '', source: 'needs_you' };
}

// -- Answer memory client ------------------------------------------------------
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

async function getAnswerCatalog(): Promise<AnswerCatalog | null> {
  const { answerCatalogCache } = await chrome.storage.local.get('answerCatalogCache');
  const fresh = answerCatalogCache && Date.now() - answerCatalogCache.ts < CATALOG_TTL_MS;
  if (fresh) return answerCatalogCache.data as AnswerCatalog;
  if (!authToken) return (answerCatalogCache?.data as AnswerCatalog) || null;
  const r = await authedApi('GET', '/career-context/answer-catalog', undefined, { retryTransient: true });
  const data = (r.body?.facts ? r.body : r.body?.data) as AnswerCatalog | undefined;
  if (r.ok && data?.facts) {
    await chrome.storage.local.set({ answerCatalogCache: { ts: Date.now(), data } });
    return data;
  }
  return (answerCatalogCache?.data as AnswerCatalog) || null;
}

async function getMemory(): Promise<{ success: boolean; answerFacts: Record<string, any>; answerStories: Record<string, any>; error?: string }> {
  const r = await authedApi('GET', '/career-context', undefined, { retryTransient: true });
  if (!r.ok) return { success: false, answerFacts: {}, answerStories: {}, error: r.error };
  const ctx = r.body?.answerFacts !== undefined || r.body?.answerStories !== undefined
    ? r.body
    : (r.body?.data || r.body?.careerContext || r.body || {});
  return { success: true, answerFacts: ctx.answerFacts || {}, answerStories: ctx.answerStories || {} };
}

async function saveMemory(patch: { answerFacts?: Record<string, any>; answerStories?: Record<string, any> }) {
  const r = await authedApi('PATCH', '/career-context', patch, { retryTransient: true });
  return r.ok ? { success: true as const } : apiFailure(r, 'Could not save that');
}

/** One-time move of the old local seed answers into the server memory. */
async function migrateSeedAnswers(): Promise<void> {
  try {
    if (!authToken) return;
    const { seedAnswers } = await chrome.storage.local.get('seedAnswers');
    if (!seedAnswers || typeof seedAnswers !== 'object' || Object.keys(seedAnswers).length === 0) {
      if (seedAnswers !== undefined) await chrome.storage.local.remove('seedAnswers');
      return;
    }
    const mem = await getMemory();
    if (!mem.success) return;
    const { patch, count } = buildSeedStoryPatch(seedAnswers, mem.answerStories);
    if (count > 0) {
      const saved = await saveMemory({ answerStories: patch });
      if (!saved.success) return;
    }
    await chrome.storage.local.remove('seedAnswers');
  } catch (err) {
    console.warn('[ProfileAI] seed answer migration failed', err);
  }
}

async function transcribeAudio(d: { audioBase64: string; mimeType?: string }) {
  try {
    const bin = atob(d.audioBase64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = d.mimeType || 'audio/webm';
    const form = new FormData();
    form.append('audio', new Blob([bytes], { type }), type.includes('mp4') ? 'speech.mp4' : 'speech.webm');
    // Paid call: never resent automatically.
    const r = await authedApi('POST', '/profiles/transcribe', form);
    const text = r.body?.text ?? r.body?.data?.text;
    if (!r.ok || typeof text !== 'string') return apiFailure(r, 'Could not turn that into text');
    return { success: true as const, text };
  } catch (err) {
    return { success: false as const, error: 'Could not read the recording. Please try again or type it instead.' };
  }
}

async function experienceFromSpeech(d: { transcript: string; roleHint?: string }) {
  if (!d?.transcript || !d.transcript.trim()) return { success: false as const, error: 'Say or type what you did first.' };
  const r = await authedApi('POST', '/profiles/experience-from-speech', { transcript: d.transcript.trim(), ...(d.roleHint ? { roleHint: d.roleHint } : {}) });
  const body = r.body?.bullets ? r.body : r.body?.data;
  if (!r.ok || !Array.isArray(body?.bullets)) return apiFailure(r, 'Could not write the bullets');
  return {
    success: true as const,
    bullets: body.bullets as string[],
    roleIndex: typeof body.roleIndex === 'number' ? body.roleIndex as number : null,
    roleCandidates: (body.roleCandidates || []) as Array<{ index: number; title: string; company: string }>,
    followUp: (body.followUp || null) as string | null,
  };
}

async function experienceAppend(d: { roleIndex: number; bullets: string[] }) {
  const r = await authedApi('POST', '/profiles/experience/append', { roleIndex: d.roleIndex, bullets: d.bullets });
  if (!r.ok) return apiFailure(r, 'Could not add that to your experience');
  // The cached profile is now stale; the next read refetches it.
  cachedProfile = null;
  void fetchProfile();
  return { success: true as const };
}

/**
 * Quick Fill: answers only the dropdown questions that ask about a stored fact.
 * Everything else is left to the existing flow. A fact question with no stored
 * fact comes back unmatched so it is skipped instead of guessed.
 */
async function factDropdownAnswers(d: { fields: Array<{ question: string; options?: string[] }>; jobDescription?: string }) {
  const catalog = await getAnswerCatalog();
  const matched = (d.fields || []).filter((f) => matchFact(f.question, catalog));
  if (matched.length === 0) return { success: true as const, matched: [] as string[], details: {} as Record<string, AnswerDetail> };
  const res = await generateAIAnswers(
    matched.map((f) => f.question),
    d.jobDescription || '',
    matched.map((f) => ({ question: f.question, fieldType: 'select', options: f.options && f.options.length ? f.options : null })),
  );
  const details: Record<string, AnswerDetail> = {};
  matched.forEach((f) => { details[f.question] = detailFor(f.question, res.answers, res.details); });
  return { success: true as const, matched: matched.map((f) => f.question), details };
}

async function generateSmartAnswers(payload: {
  questions: SmartQuestionIn[];
  jobInfo?: { title?: string; company?: string; description?: string } | null;
  jobUrl?: string;
}): Promise<{ success: boolean; results?: SmartResultOut[]; error?: string }> {
  try {
    if (!payload.questions || payload.questions.length === 0) {
      return { success: true, results: [] };
    }

    await migrateSeedAnswers();
    const catalog = await getAnswerCatalog();
    const jobId = jobIdFromContext(payload.jobInfo, payload.jobUrl);
    const cache = await loadSmartAnswerCache();
    const { savedAnswers = {} } = await chrome.storage.local.get('savedAnswers');

    const results = new Map<string, SmartResultOut>();
    const needAI: SmartQuestionIn[] = [];

    for (const q of payload.questions) {
      if (!serverOnlyQuestion(q, catalog)) {
        const cKey = smartAnswerCacheKey(jobId, q.question);
        // 1. Per-job cache (saves AI cost on re-scans)
        if (cache[cKey]?.answer) {
          const a = cache[cKey].answer;
          results.set(q.id, { questionId: q.id, question: q.question, answer: a, source: 'ai', detail: { answer: a, source: 'ai' }, cached: 'job' });
          continue;
        }
        // 2. Generic saved answers (cross-job consistency)
        const saved = findSimilarSavedAnswer(q.question, savedAnswers);
        if (saved) {
          results.set(q.id, { questionId: q.id, question: q.question, answer: saved, source: 'ai', detail: { answer: saved, source: 'ai' }, cached: 'saved' });
          await saveSmartAnswerCacheEntry(cKey, saved);
          continue;
        }
      }
      // A dropdown or radio question the memory does not cover is never sent to
      // the model: the person chooses it from the form's real options.
      if (!TEXT_FIELD_TYPES.has(q.fieldType) && !matchFact(q.question, catalog)) {
        results.set(q.id, { questionId: q.id, question: q.question, answer: '', source: 'needs_you', detail: { answer: '', source: 'needs_you' } });
        continue;
      }
      needAI.push(q);
    }

    // 3. Everything else goes to the server in one round-trip.
    if (needAI.length > 0) {
      const aiResp = await generateAIAnswers(
        needAI.map((q) => q.question),
        payload.jobInfo?.description || '',
        needAI.map((q) => ({ question: q.question, fieldType: q.fieldType, options: q.options || null, optional: q.optional, wordHint: q.wordHint })),
      );
      for (const q of needAI) {
        const detail = detailFor(q.question, aiResp.answers, aiResp.details);
        results.set(q.id, { questionId: q.id, question: q.question, answer: detail.answer || '', source: detail.source, detail });
        if (detail.answer && !serverOnlyQuestion(q, catalog) && detail.source !== 'needs_you') {
          // Cache & auto-save to grow saved-answers over time. Fact answers are
          // never cached: the memory can change between runs.
          await saveSmartAnswerCacheEntry(smartAnswerCacheKey(jobId, q.question), detail.answer, detail.source);
          if (detail.source === 'ai') { try { await saveAnswer(q.question, detail.answer); } catch (_) {} }
        }
      }
    }

    const ordered = payload.questions.map((q) => results.get(q.id) || {
      questionId: q.id, question: q.question, answer: '', source: 'needs_you' as const, detail: { answer: '', source: 'needs_you' as const },
    });
    return { success: true, results: ordered };
  } catch (err) {
    console.error('[ProfileAI] generateSmartAnswers error', err);
    return { success: false, error: (err as Error).message || 'Smart answer generation failed' };
  }
}

const REFINE_HINTS: Record<string, string> = {
  shorter: 'Rewrite instruction: make the answer noticeably shorter and keep only the strongest point.',
  more_specific: 'Rewrite instruction: make the answer more specific, using concrete details from the profile only.',
  more_personal: 'Rewrite instruction: make the answer more personal and in a natural first person voice, using only what the profile and memory say.',
};

async function generateSingleSmartAnswer(payload: {
  question: SmartQuestionIn;
  jobInfo?: { title?: string; company?: string; description?: string } | null;
  jobUrl?: string;
  forceRegenerate?: boolean;
  instruction?: 'shorter' | 'more_specific' | 'more_personal';
  /** Something the person added in their own words, by voice or typing. */
  extraDetail?: string;
}): Promise<{ success: boolean; answer?: string; source?: AnswerDetail['source']; detail?: AnswerDetail; cached?: 'job' | 'saved'; error?: string }> {
  try {
    const q = payload.question;
    const jobId = jobIdFromContext(payload.jobInfo, payload.jobUrl);
    const cKey = smartAnswerCacheKey(jobId, q.question);
    const catalog = await getAnswerCatalog();
    const serverOnly = serverOnlyQuestion(q, catalog);

    if (!payload.forceRegenerate && !serverOnly) {
      const cache = await loadSmartAnswerCache();
      if (cache[cKey]?.answer) {
        const a = cache[cKey].answer;
        return { success: true, answer: a, source: 'ai', detail: { answer: a, source: 'ai' }, cached: 'job' };
      }
      const { savedAnswers = {} } = await chrome.storage.local.get('savedAnswers');
      const saved = findSimilarSavedAnswer(q.question, savedAnswers);
      if (saved) {
        await saveSmartAnswerCacheEntry(cKey, saved);
        return { success: true, answer: saved, source: 'ai', detail: { answer: saved, source: 'ai' }, cached: 'saved' };
      }
    }

    // The server does not take a rewrite instruction yet, so it travels as an
    // extra line of the question text.
    const extra = (payload.extraDetail || '').replace(/["\n]+/g, ' ').trim().slice(0, 1200);
    const hints = [
      payload.instruction ? REFINE_HINTS[payload.instruction] : '',
      extra ? `The candidate asked for this change to the answer, in their own words. Apply it, keep the answer truthful, and do not add facts that neither the profile nor this request contains: ${extra}` : '',
    ].filter(Boolean);
    const sentText = hints.length ? `${q.question}\n\n(${hints.join(' ')})` : q.question;
    const aiResp = await generateAIAnswers(
      [sentText],
      payload.jobInfo?.description || '',
      [{ question: sentText, fieldType: q.fieldType, options: q.options || null, optional: q.optional, wordHint: q.wordHint }],
    );
    let detail = detailFor(sentText, aiResp.answers, aiResp.details);
    if (!detail.answer) {
      // Single-question requests only ever have one answer in the map anyway.
      const firstVal = Object.values(aiResp.answers).find((v) => typeof v === 'string' && v.trim());
      const firstDetail = Object.values(aiResp.details)[0];
      if (firstDetail?.answer) detail = firstDetail;
      else if (firstVal) detail = { answer: firstVal, source: 'ai' };
    }
    if (!detail.answer && detail.source !== 'needs_you') return { success: false, error: 'No answer generated' };
    if (detail.answer && !serverOnly && detail.source !== 'needs_you') {
      await saveSmartAnswerCacheEntry(cKey, detail.answer, detail.source);
      if (detail.source === 'ai') { try { await saveAnswer(q.question, detail.answer); } catch (_) {} }
    }
    return { success: true, answer: detail.answer, source: detail.source, detail };
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

    // Run on-device match scoring + backend gap analysis in parallel.
    const [keywords, gapsResp] = await Promise.all([
      analyzeKeywords(payload.jobDescription, payload.jobTitle),
      analyzeGapsForJob(payload.jobDescription).catch(() => null),
    ]);

    // analyzeKeywords resolves to { success, keywords } — reading the score off
    // the wrapper meant this modal showed 0% and no matched items on every run.
    const analysis = (keywords as any)?.keywords || {};
    const matchScore = analysis.matchScore ?? 0;
    const presentKeywords: string[] = analysis.present || [];
    const missingKeywords: string[] = analysis.missing || [];
    const components = analysis.components || {};

    // Build alignment bullets from the user's profile + evidenced requirements.
    const profile = cachedProfile || ({} as any);
    const skills = flattenSkills(profile.skills);
    const alignments: string[] = [];
    if (presentKeywords.length > 0) {
      alignments.push(
        `You can evidence ${presentKeywords.length} of the posting's requirements: ${presentKeywords.slice(0, 5).join('; ')}.`,
      );
    }
    if (Array.isArray(profile.experience) && profile.experience.length > 0) {
      const recent = profile.experience[0];
      // Only claim the seniority lines up when the numbers say it does — this
      // used to assert it unconditionally.
      if ((recent?.title || recent?.company) && (components.seniorityFit ?? 1) >= 0.8) {
        alignments.push(`Recent role as ${recent.title || ''}${recent.company ? ` at ${recent.company}` : ''} sits in the range this posting asks for.`);
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
      talkingPoints.push(`Lead with a specific example covering "${presentKeywords[0]}".`);
    }
    if (presentKeywords[1]) {
      talkingPoints.push(`Quantify your impact on "${presentKeywords[1]}" (numbers > adjectives).`);
    }
    if (missingKeywords.length > 0) {
      talkingPoints.push(`Pre-empt the gap on "${missingKeywords[0]}" — name a transferable project, don't dodge it.`);
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
  // Forwarded verbatim to POST /external-applications, which places the row on
  // its stage ladder. Without them the server defaults to 'applied' — correct
  // for a manual add, wrong for an autofill, which is the bug this closes.
  stage?: 'in_progress' | 'applied';
  confirmedBy?: string;
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
        stage: data.stage,
        confirmedBy: data.confirmedBy,
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
