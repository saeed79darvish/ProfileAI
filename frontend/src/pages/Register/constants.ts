export const ROUTES = {
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  ADMIN: '/admin',
  PROFILE: '/profile',
  RECRUITER_ONBOARDING: '/recruiter/onboarding',
  ONBOARDING: '/onboarding',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  LOGIN: '/login',
  REGISTER: '/register',
} as const;

export const TEXT = {
  HEADING: 'Sign up for an account',
  SUBTITLE_RECRUITER: 'Start finding top talent with AI',
  SUBTITLE_CANDIDATE: 'Build your AI-enhanced career profile',
  ROLE_CANDIDATE: 'Candidate',
  ROLE_RECRUITER: 'Recruiter',
  COMING_SOON: 'COMING SOON',
  EXTENSION_NOTICE: 'To use your Chrome extension, you need to complete your profile.',
  LINKEDIN_BUTTON: 'Sign up with LinkedIn',
  DIVIDER: 'Or register with email',
  LABELS: {
    FIRST_NAME: 'First Name',
    LAST_NAME: 'Last Name',
    EMAIL: 'Email Address',
    PASSWORD: 'Password',
    CONFIRM_PASSWORD: 'Confirm Password',
  },
  TERMS_PREFIX: 'By signing up you agree to our',
  TERMS_LINK: 'Terms and Conditions',
  PRIVACY_LINK: 'Privacy Policy',
  SUBMIT: 'Register',
  SUBMITTING: 'Creating Account...',
  LOGIN_PROMPT: 'Already have an account?',
  LOGIN_LINK: 'Log in',
  CONSENT_REQUIRED: 'I have read and agree to the Terms of Service and Privacy Policy.',
  ERRORS: {
    PASSWORDS_MISMATCH: 'Passwords do not match',
    PASSWORD_REQUIREMENTS: 'Password must meet all requirements: 8+ chars, uppercase, lowercase, number, special character',
    CONSENT_REQUIRED: 'You must accept the Terms of Service and Privacy Policy to create an account.',
    REGISTRATION_FAILED: 'Registration failed. Please try again.',
    GOOGLE_FAILED: 'Google sign-in failed. Please try again.',
    GOOGLE_SIGNUP_FAILED: 'Google sign-up failed. Please try again.',
    GITHUB_FAILED: 'GitHub sign-up failed. Please try again.',
    LINKEDIN_FAILED: 'LinkedIn sign-up failed. Please try again.',
    LINKEDIN_NOT_CONFIGURED: 'LinkedIn sign-up is not configured.',
  },
} as const;

export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  LABELS: {
    MIN_LENGTH: '8+ characters',
    LOWERCASE: 'Lowercase',
    UPPERCASE: 'Uppercase',
    NUMBER: 'Number',
    SPECIAL: 'Special (@$!%*?&)',
  },
} as const;

export const PASSWORD_STRENGTH_LEVELS = {
  WEAK: { label: 'weak', color: '#ef4444', progress: 20, minChecks: 0 },
  LOW: { label: 'weak', color: '#f97316', progress: 40, minChecks: 2 },
  FAIR: { label: 'fair', color: '#eab308', progress: 60, minChecks: 3 },
  GOOD: { label: 'good', color: '#84cc16', progress: 80, minChecks: 4 },
  STRONG: { label: 'strong', color: '#22c55e', progress: 100, minChecks: 5 },
} as const;

export const ROLES = {
  CANDIDATE: 'candidate',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
} as const;

export const GITHUB_OAUTH_STATE = 'github_register';
export const GITHUB_SESSION_KEY = 'github_signup_role';
export const GOOGLE_LOGIN_WIDTH = '400';
