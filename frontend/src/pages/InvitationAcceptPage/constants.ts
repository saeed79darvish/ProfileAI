export const ROUTES = {
  PROFILE: '/profile',
  TERMS: '/terms',
  PRIVACY: '/privacy',
} as const;

export const TEXT = {
  LOADING: 'Loading invitation...',
  NOT_FOUND_TITLE: 'Invitation Not Found',
  NOT_FOUND_DESCRIPTION: 'This invitation link is invalid or has been removed.',
  EXPIRED_TITLE: 'Invitation Expired',
  EXPIRED_DESCRIPTION: 'This invitation has expired. Please contact the recruiter for a new invitation.',
  SUCCESS_TITLE: 'Welcome to ProfileAI!',
  SUCCESS_DESCRIPTION: "Your account has been created. You'll be redirected to your dashboard shortly.",
  GO_TO_DASHBOARD: 'Go to Dashboard',
  DECLINED_TITLE: 'Invitation Declined',
  DECLINED_DESCRIPTION: 'You have declined this invitation. If this was a mistake, please contact the recruiter.',
  HEADER: {
    BRAND: 'ProfileAI',
    TITLE: "You're Invited!",
    SUBTITLE_SUFFIX: 'would like to connect with you',
    DEFAULT_COMPANY: 'A company',
  },
  LABELS: {
    FIRST_NAME: 'First Name *',
    LAST_NAME: 'Last Name *',
    EMAIL: 'Email',
    PHONE: 'Phone (Optional)',
    CREATE_PASSWORD: 'Create Password *',
    CONFIRM_PASSWORD: 'Confirm Password *',
  },
  PHONE_PLACEHOLDER: '+1 (555) 123-4567',
  CONSENT: {
    TITLE: 'Your Consent Required',
    TERMS_TITLE: 'Terms of Service & Privacy Policy',
    TERMS_DESCRIPTION: 'I agree to the',
    SCREENING_TITLE: 'AI Screening Consent',
  },
  BUTTONS: {
    DECLINE: 'Decline',
    ACCEPT: 'Accept & Create Account',
    SUBMITTING: 'Processing...',
  },
  ERRORS: {
    PASSWORDS_MISMATCH: 'Passwords do not match',
    PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters',
    CONSENT_REQUIRED: 'You must accept both consent items to proceed',
    ACCEPT_FAILED: 'Failed to accept invitation',
    DECLINE_FAILED: 'Failed to decline invitation',
    NOT_FOUND: 'Invitation not found',
  },
  CONFIRM_DECLINE: 'Are you sure you want to decline this invitation?',
} as const;

export const FEATURES = [
  { key: 'ai-interview', title: 'AI Interview', description: '15-min smart screening' },
  { key: 'fast-process', title: 'Fast Process', description: 'Get results in hours' },
  { key: 'direct-access', title: 'Direct Access', description: 'Connect with recruiters' },
] as const;

export const PASSWORD_MIN_LENGTH = 8;
export const REDIRECT_DELAY_MS = 3000;
