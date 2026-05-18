export const ROLES = {
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
  CANDIDATE: 'candidate',
} as const;

export const GITHUB_OAUTH_STATE = 'github_login';
export const STORAGE_KEY_TOKEN = 'token';

export const ROUTES = {
  RECRUITER_ONBOARDING: '/recruiter/onboarding',
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  ADMIN: '/admin',
  PROFILE: '/profile',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  REGISTER: '/register',
} as const;

export const TEXT = {
  WELCOME_TITLE: 'Welcome back',
  SUBTITLE: 'Sign in to access your AI-enhanced profile',
  ERROR_GITHUB_NO_ACCOUNT: 'No account found. Please sign up with GitHub first.',
  ERROR_GITHUB_LOGIN: 'GitHub login failed. Please try again.',
  ERROR_GOOGLE_NO_ACCOUNT: 'No account found. Please sign up with Google first.',
  ERROR_GOOGLE_LOGIN: 'Google login failed. Please try again.',
  ERROR_GOOGLE_SIGNIN: 'Google sign-in failed. Please try again.',
  ERROR_LOGIN: 'Login failed. Please try again.',
  SIGN_IN_GITHUB: 'Sign in with GitHub',
  DIVIDER_TEXT: 'Or sign in with email',
  EMAIL_LABEL: 'Email Address',
  PASSWORD_LABEL: 'Password',
  FORGOT_PASSWORD_LINK: 'Forgot password?',
  BUTTON_LOADING: 'Signing in...',
  BUTTON_SUBMIT: 'Sign In',
  NO_ACCOUNT: "Don't have an account?",
  SIGN_UP: 'Sign up',
} as const;
