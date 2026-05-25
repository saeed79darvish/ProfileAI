export const ROUTES = {
  HOME: '/',
} as const;

export const TEXT = {
  PAGE_TITLE: 'Track Your Application',
  PAGE_SUBTITLE: 'Enter your tracking code to check your status',
  PLACEHOLDER_CODE: 'Enter code',
  ERROR_INVALID_CODE: 'Please enter a valid tracking code',
  ERROR_NOT_FOUND: 'Application not found',
  BACK_TO_HOME: 'Back to ProfilleAI',
  SUBMITTED_LABEL: 'Submitted',
  APPLICANT_LABEL: 'Applicant',
} as const;

export const VALIDATION = {
  MIN_TRACKING_CODE_LENGTH: 6,
  MAX_TRACKING_CODE_LENGTH: 12,
} as const;
