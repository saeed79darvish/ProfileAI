export const CATEGORIES = [
  { value: 'all', label: 'All', icon: '📊' },
  { value: 'career', label: 'Career', icon: '💼' },
  { value: 'tech', label: 'Tech', icon: '🛠' },
  { value: 'industry', label: 'Industry', icon: '📈' },
  { value: 'learning', label: 'Learning', icon: '🎓' },
  { value: 'general', label: 'General', icon: '💬' },
] as const;

export const TEXT = {
  PAGE_TITLE: '📊 Hot Takes & Polls',
  PAGE_SUBTITLE: 'Vote on career debates, share your hot takes, and see where you stand',
  TOTAL_POLLS: 'Total Polls',
  TOTAL_VOTES: 'Total Votes',
  HOT_TAKES: '🔥 Hot Takes',
  SORT_RECENT: 'Recent',
  SORT_TRENDING: 'Trending',
  SORT_HOT: 'Hot Takes',
  STATUS_ACTIVE: 'Active',
  STATUS_ENDED: 'Ended',
  NO_POLLS: 'No polls found',
  EMPTY_CATEGORY: (category: string) => `No ${category} polls yet. Be the first to create one!`,
  EMPTY_DEFAULT: 'Start a debate and get the community talking!',
  CREATE_POLL: 'Create Poll',
  ERROR_LOADING: 'Failed to load polls',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
} as const;
