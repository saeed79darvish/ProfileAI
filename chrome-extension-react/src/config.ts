// ProfileAI Extension Configuration
// Change these values for production deployment

// Environment: 'development' | 'production'
const ENV = 'production';

// URLs based on environment
const URLS = {
  development: {
    WEB_BASE: 'http://localhost:3000',
    API_BASE: 'http://localhost:5001/api',
  },
  production: {
    WEB_BASE: 'https://www.profilleai.com',
    API_BASE: 'https://api.profilleai.com/api',
  },
};

export const CONFIG = {
  ENV,
  // API URLs - automatically selected based on ENV
  WEB_BASE: URLS[ENV].WEB_BASE,
  API_BASE: URLS[ENV].API_BASE,

  // OAuth client IDs for in-panel sign-in via chrome.identity.launchWebAuthFlow.
  // The extension's OAuth redirect URL is chrome.identity.getRedirectURL(), i.e.
  //   https://mogppemdigdgbmgejonhfjpddhjbkngp.chromiumapp.org/
  // That URL MUST be registered as an authorized redirect URI in each provider:
  //   - Google Cloud Console → this OAuth client's "Authorized redirect URIs"
  //   - LinkedIn Developer app → "Authorized redirect URLs"
  // Google client ID is the same public web client already in use. LinkedIn is
  // left blank until a client is provisioned; the panel hides LinkedIn when it
  // is empty. The backend must also have matching LINKEDIN_CLIENT_ID/SECRET.
  GOOGLE_CLIENT_ID: '188305923693-rsil9buaanu4e77eur9tahfivp23lobq.apps.googleusercontent.com',
  LINKEDIN_CLIENT_ID: '',
  LINKEDIN_SCOPE: 'openid profile email',

  // Feature flags
  FEATURES: {
    autofill: true,
    tailor: true,
    keywords: true,
    savedAnswers: true,
    jobTracker: true,
  },
  
  // Supported job sites
  SUPPORTED_SITES: {
    linkedin: {
      match: /linkedin\.com/,
      jobSelector: '.jobs-unified-top-card, .job-details-jobs-unified-top-card, [class*="jobs-details"], .top-card-layout',
      formSelector: '.jobs-easy-apply-modal, .jobs-apply-button, [class*="jobs-apply"]',
      titleSelector: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, .jobs-details-top-card__job-title, .top-card-layout__title, h1.t-24, h1[class*="jobs"], h2.top-card-layout__title, h1',
      companySelector: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .jobs-details-top-card__company-info a, .top-card-layout__card a[data-tracking-control-name*="company"], .topcard__org-name-link, a[data-tracking-control-name*="company"], [class*="job-details"] a[href*="/company/"]',
      descriptionSelector: '#job-details, .jobs-description-content, .jobs-description__content, .jobs-description-content__text, .jobs-box__html-content, .show-more-less-html__markup, .description__text, [class*="jobs-description"], [class*="decorated-job-posting__details"]',
    },
    greenhouse: {
      match: /greenhouse\.io/,
      formSelector: '#application-form, #application',
      titleSelector: '.app-title, h1.heading, h1',
      companySelector: '.company-name, .logo',
      descriptionSelector: '#content, .job-description, #job_description, [class*="job-description"]',
    },
    lever: {
      match: /lever\.co/,
      formSelector: '.application-form, #application-form, form[action*="apply"], form',
      titleSelector: '.posting-headline h2, h1.posting-headline, h1',
      companySelector: '.posting-categories .location, .main-header-logo img[alt]',
      descriptionSelector: '.posting-page, .section-wrapper, .content, [class*="posting-"]',
    },
    workday: {
      match: /workday\.com|myworkdayjobs\.com/,
      formSelector: '[data-automation-id="jobPostingPage"] form, form',
      titleSelector: '[data-automation-id="jobPostingTitle"], h2[data-automation-id], .css-1q2dra3, h1',
      descriptionSelector: '[data-automation-id="jobPostingDescription"], [data-automation-id="jobPostingPage"], .css-cygeeu, [class*="jobDescription"]',
    },
    ashby: {
      match: /ashbyhq\.com|jobs\.ashbyhq\.com/,
      formSelector: 'form, [class*="application"]',
      titleSelector: 'h1, [class*="JobPostingTitle"], [class*="job-title"]',
      companySelector: '[class*="CompanyName"], [class*="company"]',
      descriptionSelector: '[class*="JobDescription"], [class*="job-description"], main',
    },
    icims: {
      match: /icims\.com/,
      formSelector: 'form',
      titleSelector: '.iCIMS_Header h1, h1',
      companySelector: '.iCIMS_CompanyName',
      descriptionSelector: '.iCIMS_JobContent',
    },
    generic: {
      match: /.*/,
      formSelector: 'form',
      titleSelector: 'h1, .job-title, [class*="job-title"], [class*="jobtitle"]',
      descriptionSelector: '.job-description, [class*="job-description"], [class*="jobdescription"]',
    },
  },
} as const;

export type SiteName = keyof typeof CONFIG.SUPPORTED_SITES;
