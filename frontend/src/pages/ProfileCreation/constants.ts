export const ROUTES = {
  HOME: '/',
  CREATE_FORM: '/profile/create-form',
  PREFERENCES: '/profile/preferences',
} as const;

export const TEXT = {
  LOGO: 'ProfileAI',
  PAGE_TITLE: 'Create Your Profile',
  WELCOME_MESSAGE: "Choose how you'd like to build your profile",
  PARSING_TITLE: 'Parsing your resume...',
  PARSING_SUBTITLE: 'ProfileAI is extracting your information',
  UPLOAD_TITLE: 'Upload Resume',
  UPLOAD_DESCRIPTION: 'Upload your existing resume (PDF or DOCX) and let ProfileAI extract everything automatically.',
  UPLOAD_TAG: 'AI-Powered \u2022 Fast & Easy',
  MANUAL_TITLE: 'Create from Scratch',
  MANUAL_DESCRIPTION: "Don't have a resume? No problem, fill out the form and ProfileAI will help you with smart suggestions along the way.",
  MANUAL_TAG: 'AI Assistant \u2022 Full Control',
  MANUAL_BUTTON: 'Start from Scratch',
  FOOTER: 'Whichever option you choose, ProfileAI lets you review and edit everything before saving.',
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
