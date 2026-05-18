export const ROUTES = {
  TRACK: '/track',
  INVITE: (token: string) => `/invite/${token}`,
  TERMS: '/terms',
  PRIVACY: '/privacy',
} as const;

export const TEXT = {
  LOGO_PREFIX: 'Profile',
  LOGO_SUFFIX: 'AI',
  LOADING_TITLE: 'Loading...',
  LOADING_TEXT: 'Preparing your screening form...',
  ERROR_TITLE: 'Screening Unavailable',
  STATUS_SUBMITTED: '\u2705 Already Submitted',
  STATUS_ACCEPTED: '\u2705 Already Accepted',
  STATUS_DECLINED: '\u274C Declined',
  STATUS_ERROR: '\u26A0\uFE0F Error',
  TRACK_BUTTON: 'Track Your Application',
  SUCCESS_TITLE: 'Submission Received!',
  SUCCESS_HEADING: "You're all set!",
  SUCCESS_TEXT: 'Your screening submission has been received and will be reviewed shortly.',
  TRACKING_LABEL: 'Your Tracking Code',
  TRACKING_HELPER: 'Save this code to track your application status',
  NEXT_STEPS: 'What happens next?',
  MAIN_TITLE: "You're Invited!",
  QUICK_TITLE: 'Quick Screening Submission',
  SUBTITLE_SUFFIX: 'has invited you to apply',
  CHOICE_INTRO_PREFIX: 'Hi',
  CHOICE_INTRO_SUFFIX: '! Choose how you\'d like to proceed:',
  QUICK_SUBMIT_TITLE: 'Quick Submit',
  QUICK_SUBMIT_DESC: 'Upload your resume and answer a few questions. No account needed \u2014 our AI will review your profile.',
  QUICK_SUBMIT_TIME: '2\u20133 minutes',
  JOIN_TITLE: 'Join ProfileAI',
  JOIN_DESC: 'Create a full profile to get matched with more opportunities, AI-powered coaching, and direct recruiter connections.',
  JOIN_TIME: '5\u201310 minutes',
  BACK_TO_OPTIONS: 'Back to options',
  UPLOAD_TITLE: 'Upload Your Resume',
  DROP_ZONE_TEXT: 'Drag & drop your resume here, or click to browse',
  DROP_ZONE_HINT: 'PDF or DOCX, max 5MB',
  AI_NOTE: 'Our AI will parse your resume to extract skills and experience for matching',
  QUESTIONS_TITLE: 'Screening Questions',
  SELECT_PLACEHOLDER: 'Select...',
  CONSENT_AI: 'I consent to AI-powered screening of my resume and responses. My data will be analyzed to assess fit for this position.',
  CONSENT_TERMS: 'I agree to the Terms of Service and Privacy Policy.',
  SUBMIT_PROCESSING: 'Processing...',
  SUBMIT_BUTTON: 'Submit Screening',
  ERROR_FILE_TYPE: 'Please upload a PDF or DOCX file',
  ERROR_FILE_SIZE: 'File size must be under 5MB',
  ERROR_REQUIRED_PREFIX: 'Please answer all required questions:',
  ERROR_CONSENT: 'Please accept both consent checkboxes to continue',
  ERROR_SUBMIT: 'Failed to submit. Please try again.',
} as const;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
] as const;

export const LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  DEFAULT_MAX_LENGTH: 2000,
} as const;
