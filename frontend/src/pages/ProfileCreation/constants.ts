export const ROUTES = {
  HOME: '/',
  CREATE_FORM: '/profile/create-form',
  PREFERENCES: '/profile/preferences',
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
  MANUAL_TITLE: 'Create from Scratch',
  MANUAL_DESCRIPTION: "Don't have a resume? No problem, fill out the form and ProfilleAI will help you with smart suggestions along the way.",
  MANUAL_TAG: 'AI Assistant \u2022 Full Control',
  MANUAL_BUTTON: 'Start from Scratch',
  FOOTER: 'Whichever option you choose, ProfilleAI lets you review and edit everything before saving.',
  ERROR_FILE_TYPE: 'Please upload a PDF or DOCX file',
  ERROR_FILE_SIZE: 'File size must be less than 5MB',
  ERROR_PARSE: 'Failed to parse resume. Please try again or create manually.',
  ERROR_UPLOAD: 'Failed to upload resume. Please try again or create manually.',
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
