export const ROUTES = {
  HOME: '/',
  CREATE_FORM: '/profile/create-form',
  PREFERENCES: '/profile/preferences',
  LINKEDIN_OAUTH_CALLBACK: '/auth/linkedin/callback',
} as const;

export const TEXT = {
  LOGO: 'ProfilleAI',
  PAGE_TITLE: 'Create Your Profile',
  WELCOME_MESSAGE: "Choose how you'd like to build your profile",
  PARSING_TITLE: 'Parsing your resume...',
  PARSING_SUBTITLE: 'ProfilleAI is extracting your information',
  UPLOAD_TITLE: 'Upload Resume',
  UPLOAD_DESCRIPTION: 'Upload your existing resume (PDF or DOCX) and let ProfilleAI extract everything automatically.',
  UPLOAD_TAG: 'AI-Powered \u2022 Fast & Easy',
  LINKEDIN_TITLE: 'Smart Import',
  LINKEDIN_DESCRIPTION: 'Enter your work email or your name and employer, and ProfilleAI will find and import your experience and education automatically.',
  LINKEDIN_TAG: 'AI-Powered \u2022 Zero typing',
  LINKEDIN_BUTTON: 'Import my profile',
  LINKEDIN_PARSING_TITLE: 'Finding your profile...',
  LINKEDIN_PARSING_SUBTITLE: 'ProfilleAI is importing your career history',
  MANUAL_TITLE: 'Create from Scratch',
  MANUAL_DESCRIPTION: "Don't have a resume? No problem, fill out the form and ProfilleAI will help you with smart suggestions along the way.",
  MANUAL_TAG: 'AI Assistant \u2022 Full Control',
  MANUAL_BUTTON: 'Start from Scratch',
  FOOTER: 'Whichever option you choose, ProfilleAI lets you review and edit everything before saving.',
  ERROR_FILE_TYPE: 'Please upload a PDF or DOCX file',
  ERROR_FILE_SIZE: 'File size must be less than 5MB',
  ERROR_PARSE: 'Failed to parse resume. Please try again or create manually.',
  ERROR_UPLOAD: 'Failed to upload resume. Please try again or create manually.',
  // Smart-import modal copy
  LINKEDIN_MODAL_TITLE: 'Smart Profile Import',
  LINKEDIN_MODAL_SUBTITLE: 'Tell us how to find you and AI will import your work history and education \u2014 no typing required.',
  LINKEDIN_MODAL_EMAIL_LABEL: 'Work email',
  LINKEDIN_MODAL_EMAIL_PLACEHOLDER: 'you@yourcompany.com',
  LINKEDIN_MODAL_EMAIL_HINT: 'Your company email \u2014 personal emails like Gmail won\u2019t work.',
  LINKEDIN_MODAL_NAME_DIVIDER: 'or find me by name',
  LINKEDIN_MODAL_FIRSTNAME_LABEL: 'First name',
  LINKEDIN_MODAL_LASTNAME_LABEL: 'Last name',
  LINKEDIN_MODAL_EMPLOYER_LABEL: 'Current employer website',
  LINKEDIN_MODAL_EMPLOYER_PLACEHOLDER: 'e.g. stripe.com',
  LINKEDIN_MODAL_ROLE_LABEL: 'Job title (optional)',
  LINKEDIN_MODAL_ROLE_PLACEHOLDER: 'e.g. Software Engineer',
  LINKEDIN_MODAL_SUBMIT: 'Import my profile',
  LINKEDIN_MODAL_CANCEL: 'Cancel',
  LINKEDIN_MODAL_OAUTH_DIVIDER: 'or',
  LINKEDIN_MODAL_OAUTH_BUTTON: 'Sign in with LinkedIn instead',
  LINKEDIN_MODAL_OAUTH_NOTE: "We'll only fetch your name, email, and photo \u2014 you'll add experience and education yourself.",
  LINKEDIN_MODAL_UNAVAILABLE: "Smart import isn't enabled on this server yet. Try uploading your resume, or use \u201CSign in with LinkedIn\u201D below to prefill your basics.",
  LINKEDIN_MODAL_ALL_UNAVAILABLE: "Profile import isn't enabled on this server yet. Please upload your resume or create your profile manually.",
  LINKEDIN_MODAL_OAUTH_UNAVAILABLE: 'Sign in with LinkedIn is not configured on this server.',
  LINKEDIN_ERROR_MISSING_INPUT: 'Enter your work email, or your first name plus your employer\u2019s website.',
  LINKEDIN_ERROR_GENERIC: 'Could not import your profile. Try again, upload your resume, or start from scratch.',
  LINKEDIN_ERROR_OAUTH: 'Could not sign in with LinkedIn. Try again or use another option.',
  LINKEDIN_ERROR_POPUP_BLOCKED: 'Popup blocked. Allow popups for this site and try again.',
  LINKEDIN_ERROR_POPUP_CLOSED: 'LinkedIn sign-in was cancelled.',
} as const;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export const VALIDATION = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
} as const;

/* ─── AI "building your profile" magic overlay ─────────────────── */

// Ordered narration steps shown while the resume is parsed. Each "label"
// is the live status; "field" maps to the skeleton row that fills in.
export const MAGIC_STEPS = [
  { id: 'read', label: 'Reading your resume\u2026', field: 'header' },
  { id: 'understand', label: 'Understanding your background\u2026', field: 'summary' },
  { id: 'skills', label: 'Extracting your skills\u2026', field: 'skills' },
  { id: 'experience', label: 'Mapping your experience\u2026', field: 'experience' },
  { id: 'story', label: 'Crafting your professional story\u2026', field: 'projects' },
  { id: 'polish', label: 'Polishing the final details\u2026', field: 'done' },
] as const;

export const MAGIC_TIMING = {
  STEP_MS: 1100,        // time spent per narration step before parsing resolves
  HOLD_PCT: 92,         // progress cap while waiting for the API to return
  FINISH_MS: 1900,      // how long the celebratory results screen shows
} as const;

export const MAGIC_TEXT = {
  TITLE_PARSING: 'Building your profile\u2026',
  TITLE_DONE: 'Your profile is ready!',
  STEP_DONE: 'AI did the heavy lifting \u2014 take a look.',
  PROGRESS_DONE: 'Done',
  CARD_NAME: 'Your Profile',
  CARD_TAG: 'AI-Enhanced',
  CONTINUE: 'Opening your profile\u2026',
  STAT_SKILLS: 'Skills',
  STAT_EXPERIENCE: 'Roles',
  STAT_EDUCATION: 'Education',
  STAT_PROJECTS: 'Projects',
} as const;
