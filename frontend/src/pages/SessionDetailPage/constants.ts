// Constants for SessionDetailPage

export const ROUTES = {
  LOGIN: '/login',
  FEED: '/feed',
  SESSION: (id: string | number) => `/sessions/${id}`,
  PROFILE: (id: string | number) => `/profile/${id}`,
} as const;

export const EXTERNAL_LINKS = {
  GOOGLE_MEET: 'https://meet.google.com/new',
  ZOOM: 'https://zoom.us/start/videomeeting',
} as const;

export const LIMITS = {
  DEFAULT_MAX_PARTICIPANTS: 20,
  DEFAULT_DURATION: 60,
  LOW_SPOTS_WARNING: 5,
  MAX_PARTICIPANTS_INPUT: 100,
  MIN_PARTICIPANTS_INPUT: 1,
} as const;

export const TEXT = {
  BACK_TO_FEED: 'Back to Feed',
  NOT_FOUND: 'Session not found',
  LOAD_ERROR: 'Failed to load session',
  YOURE_HOST: "You're the Host",
  MANAGE_SESSION: 'Manage Your Session',
  JOINED: 'Joined',
  SPOTS_LEFT: 'Spots Left',
  REGISTERED: "✓ You're registered for this session",
  ABOUT: 'About this Session',
  TOPICS: 'Topics & Skills',
  WHAT_YOULL_LEARN: "What You'll Learn",
  PARTICIPANTS: 'Registered Participants',
  SHARE: 'Share',
  START_SESSION: 'Start Session',
  EDIT: 'Edit',
  END_SESSION: 'End Session',
  OPEN_MEETING: 'Open Meeting',
  LEAVE_SESSION: 'Leave Session',
  JOIN_SESSION: 'Join Session',
  SESSION_FULL: 'Session Full',
  JOIN_LIVE: 'Join Live Session',
  WAITING_LINK: 'Waiting for Host Link...',
  START_YOUR_SESSION: '🚀 Start Your Session',
  QUICK_CREATE: 'Quick Create Meeting',
  GO_LIVE: 'Go Live!',
  STARTING: 'Starting...',
  EDIT_SESSION: 'Edit Session',
  SAVE_CHANGES: 'Save Changes',
  SAVING: 'Saving...',
  CANCEL: 'Cancel',
  SESSION_HOST: 'Session Host',
  TIP_GO_LIVE: 'Tip: Once you click "Go Live", participants will see the link and can join your session.',
  COPY_LINK: 'Copy link to clipboard',
  CLICK_CREATE: 'Click to create a meeting, then copy and paste the link below',
} as const;
