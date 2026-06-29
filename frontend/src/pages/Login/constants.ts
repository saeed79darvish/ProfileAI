export const ROLES = {
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
  CANDIDATE: 'candidate',
} as const;

export const LINKEDIN_OAUTH_STATE = 'linkedin_login';
export const STORAGE_KEY_TOKEN = 'token';

export const ROUTES = {
  RECRUITER_ONBOARDING: '/recruiter/onboarding',
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  ADMIN: '/admin',
  PROFILE: '/profile',
  CHECK_EMAIL: '/check-email',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  REGISTER: '/register',
} as const;

export const TEXT = {
  WELCOME_TITLE: 'Welcome back',
  SUBTITLE: 'Sign in to access your AI-enhanced profile',
  ERROR_LINKEDIN_NO_ACCOUNT: 'No account found. Please sign up with LinkedIn first.',
  ERROR_LINKEDIN_LOGIN: 'LinkedIn login failed. Please try again.',
  ERROR_LINKEDIN_NOT_CONFIGURED: 'LinkedIn sign-in is not configured.',
  ERROR_GOOGLE_NO_ACCOUNT: 'No account found. Please sign up with Google first.',
  ERROR_GOOGLE_LOGIN: 'Google login failed. Please try again.',
  ERROR_GOOGLE_SIGNIN: 'Google sign-in failed. Please try again.',
  ERROR_SERVER_UNAVAILABLE: 'Our server is briefly unavailable. Please try again in a moment.',
  ERROR_LOGIN: 'Login failed. Please try again.',
  SIGN_IN_LINKEDIN: 'Sign in with LinkedIn',
  DIVIDER_TEXT: 'Or sign in with email',
  EMAIL_LABEL: 'Email Address',
  PASSWORD_LABEL: 'Password',
  FORGOT_PASSWORD_LINK: 'Forgot password?',
  BUTTON_LOADING: 'Signing in...',
  BUTTON_SUBMIT: 'Sign In',
  NO_ACCOUNT: "Don't have an account?",
  SIGN_UP: 'Sign up',
} as const;
