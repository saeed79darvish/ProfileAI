// Constants for FeedPage

export const ROUTES = {
  REGISTER: '/register',
  LOGIN: '/login',
} as const;

export const TIMINGS = {
  COPY_RESET_DELAY: 2000,
  RELOAD_SESSIONS_DELAY: 100,
} as const;

export const LIMITS = {
  MIN_POST_CONTENT_LENGTH: 20,
  MIN_CHAR_COUNTER_DISPLAY: 10,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  MAX_HEIGHT_COLLAPSED: 300,
} as const;

export const SESSION_FILTERS = [
  { value: 'all', label: 'All', iconName: 'public' as const },
  { value: 'posts', label: 'Posts', iconName: 'comment' as const },
  { value: 'polls', label: 'Polls', iconName: 'howToVote' as const },
] as const;
