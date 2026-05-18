export const ROUTES = {
  CHALLENGES: '/challenges',
  JOIN: (inviteCode: string) => `/challenges/join/${inviteCode}`,
} as const;

export const MOOD_EMOJIS: Record<string, string> = {
  struggling: '\uD83D\uDE13',
  okay: '\uD83D\uDE10',
  good: '\uD83D\uDE42',
  great: '\uD83D\uDE0A',
  crushing: '\uD83D\uDD25'
};

export const GRADIENTS: Record<string, string> = {
  sprint: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
  deep_dive: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
  transformation: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  custom: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
};

export const TEXT = {
  BACK: 'Back to Challenges',
  NOT_FOUND: 'Challenge not found',
  STAT_DAYS_LEFT: 'Days Left',
  STAT_PARTICIPANTS: 'Participants',
  STAT_MILESTONES: 'Milestones',
  STAT_STREAK: 'Your Streak',
  PROGRESS_LABEL: 'Challenge Progress',
  PROGRESS_SUFFIX: '% Complete',
  JOIN: 'Join Challenge',
  CHECK_IN: 'Daily Check-In',
  CHECKED_IN: 'Checked In Today \u2713',
  LEAVE: 'Leave Challenge',
  TAB_OVERVIEW: 'Overview',
  TAB_LEADERBOARD: 'Leaderboard',
  TAB_MILESTONES: 'Milestones',
  TAB_CHECKINS: 'Check-Ins',
  ABOUT: 'About This Challenge',
  NO_DESCRIPTION: 'No description provided.',
  STAKES: '\uD83C\uDFB2 Stakes',
  PARTICIPANTS: 'Participants',
  LEADERBOARD: 'Leaderboard',
  YOU_SUFFIX: '(You)',
  DAY_STREAK: 'day streak',
  CHECK_INS_LABEL: 'check-ins',
  PTS: 'pts',
  MILESTONES_TITLE: 'Milestones',
  NO_MILESTONES: 'No milestones defined.',
  RECENT_CHECKINS: 'Recent Check-Ins',
  NO_CHECKINS: 'No check-ins yet.',
  DIALOG_CHECKIN: 'Daily Check-In',
  DIALOG_MOOD: 'How are you feeling today?',
  DIALOG_NOTES: 'What did you accomplish today?',
  DIALOG_PLACEHOLDER: 'Share your progress, learnings, or challenges...',
  DIALOG_CANCEL: 'Cancel',
  DIALOG_SUBMIT: 'Submit Check-In',
  SHARE_TITLE: 'Invite Friends',
  SHARE_TEXT: 'Share this link to invite friends to the challenge:',
  COPY: 'Copy',
  SNACKBAR_JOINED: 'Successfully joined the challenge! \uD83C\uDF89',
  SNACKBAR_LEFT: 'Left the challenge',
  SNACKBAR_CHECKIN: 'Check-in recorded! Keep it up! \uD83D\uDD25',
  SNACKBAR_NUDGE: 'Nudge sent! \uD83D\uDC4B',
  SNACKBAR_COPIED: 'Invite link copied!',
  SNACKBAR_JOIN_FAIL: 'Failed to join',
  SNACKBAR_LEAVE_FAIL: 'Failed to leave',
  SNACKBAR_CHECKIN_FAIL: 'Failed to check in',
  SNACKBAR_NUDGE_FAIL: 'Failed to nudge',
  NUDGE_TOOLTIP: 'Send a friendly nudge',
} as const;

export const LIMITS = {
  CHECKIN_DISPLAY: 20,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  SNACKBAR_MS: 3000,
} as const;
