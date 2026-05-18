export const ROUTES = {
  CHALLENGE: (id: string | number) => `/challenges/${id}`,
  CHALLENGES: '/challenges',
} as const;

export const STEPS = ['Choose Type', 'Challenge Details', 'Milestones', 'Settings', 'Review'] as const;

export const CHALLENGE_TYPES = [
  { id: 'sprint', label: '7-Day Sprint', emoji: '\uD83C\uDFAF', duration: 7, description: 'Ship a side project in 7 days' },
  { id: 'deep_dive', label: '14-Day Deep Dive', emoji: '\uD83D\uDCDA', duration: 14, description: 'Master a new skill through focused learning' },
  { id: 'transformation', label: '30-Day Transformation', emoji: '\uD83D\uDE80', duration: 30, description: 'Transform your career in 30 days' },
  { id: 'custom', label: 'Custom Challenge', emoji: '\u26A1', duration: null, description: 'Create your own challenge format' }
] as const;

export const TEXT = {
  BACK: 'Back to Challenges',
  WIZARD_TITLE: 'Create a Challenge',
  WIZARD_SUBTITLE: 'Set up a new challenge for you and your friends',
  MILESTONE_HINT: 'Milestones help participants track their progress throughout the challenge.',
  ADD_MILESTONE: 'Add New Milestone',
  VISIBILITY_PUBLIC: 'Public - Anyone can join',
  VISIBILITY_FRIENDS: 'Friends Only',
  VISIBILITY_PRIVATE: 'Private - Invite only',
  STAKES_LABEL: 'Stakes (Optional)',
  STAKES_PLACEHOLDER: 'e.g., Loser buys coffee, donate to charity',
  STAKES_HELPER: "What's at stake? Add some friendly accountability!",
  REVIEW_DURATION: 'Duration',
  REVIEW_VISIBILITY: 'Visibility',
  REVIEW_MAX_PARTICIPANTS: 'Max Participants',
  REVIEW_MILESTONES: 'Milestones',
  REVIEW_STAKES: 'Stakes',
  UNTITLED: 'Untitled Challenge',
  BUTTON_BACK: 'Back',
  BUTTON_CREATING: 'Creating...',
  BUTTON_CREATE: 'Create Challenge',
  BUTTON_NEXT: 'Next',
  ERROR_CREATE: 'Failed to create challenge',
} as const;

export const LIMITS = {
  DEFAULT_MAX_PARTICIPANTS: 50,
  DEFAULT_SKIP_DAYS: 2,
  DURATION_MIN: 3,
  DURATION_MAX: 90,
  PARTICIPANTS_MIN: 2,
  PARTICIPANTS_MAX: 100,
  SKIP_DAYS_MIN: 0,
  SKIP_DAYS_MAX: 7,
} as const;
