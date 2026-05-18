export const ROUTES = {
  PRICING: '/pricing',
  PROFILE: '/profile',
} as const;

export const TEXT = {
  PROCESSING: 'Processing your subscription...',
  WELCOME_TITLE: 'Welcome to Pro!',
  SUCCESS_MESSAGE: 'Your subscription has been activated successfully.',
  REDIRECTING_BACK: ' Redirecting you back to continue...',
  REDIRECTING_DASHBOARD: ' Redirecting you to the dashboard...',
  CONTINUE: 'Continue',
  GO_TO_PROFILE: 'Go to Profile',
  CANCELLED_TITLE: 'Subscription Cancelled',
  CANCELLED_MESSAGE: 'You cancelled the subscription process. No charges were made.',
  BACK_TO_PRICING: 'Back to Pricing',
  ERROR_TITLE: 'Something went wrong',
  ERROR_MESSAGE: 'There was an error processing your subscription. Please try again.',
  TRY_AGAIN: 'Try Again',
} as const;

export const STORAGE_KEYS = {
  UPGRADE_RETURN_PATH: 'upgradeReturnPath',
} as const;

export const TIMINGS = {
  REDIRECT_DELAY_MS: 2000,
} as const;
