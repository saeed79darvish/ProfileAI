export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
} as const;

export const TEXT = {
  SUCCESS: 'Resume downloaded successfully!',
  ERROR_DOWNLOAD: 'Failed to download resume. Please try again.',
  LOADING: 'Loading...',
  HEADER: 'Resume',
  TAILORED_FOR: 'Tailored for:',
  TAB_PREVIEW: 'Preview',
  TAB_EDIT: 'Edit',
  FILE_NAME_LABEL: 'File name',
  FORMAT_PDF: 'PDF',
  FORMAT_WORD: 'Word',
  UPDATE_PREVIEW: 'Update Preview',
  GENERATING_PREVIEW: 'Generating preview...',
  PREVIEW_NA: 'Preview not available',
  BACK: 'Back',
  DOWNLOAD_PDF: 'Download PDF',
  DOWNLOAD_WORD: 'Download Word',
  GENERATING: 'Generating...',
  SUMMARY: '\uD83D\uDCDD Summary',
  SKILLS: '\uD83D\uDEE0 Skills',
  EXPERIENCE: '\uD83D\uDCBC Experience',
  EDUCATION: '\uD83C\uDF93 Education',
  PROJECTS: '\uD83D\uDE80 Projects',
  SEPARATE_COMMAS: 'Separate with commas',
  ADD_EXPERIENCE: 'Add Experience',
  ADD_EDUCATION: 'Add Education',
  ADD_PROJECT: 'Add Project',
  UPDATE_VIEW: 'Update & View Preview',
  VIEW_PREVIEW: 'View Preview',
} as const;

export const TIMINGS = {
  AUTH_TIMEOUT_MS: 3000,
  EXTENSION_TIMEOUT_MS: 3000,
  CLOSE_DELAY_MS: 300,
  REDIRECT_DELAY_MS: 500,
} as const;
