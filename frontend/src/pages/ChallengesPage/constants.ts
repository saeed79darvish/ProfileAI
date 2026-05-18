// Constants for ChallengesPage

export const ROUTES = {
  CHALLENGE_DETAIL: (id: string | number) => `/challenges/${id}`,
  CREATE_CHALLENGE: '/challenges/create',
} as const;

export const STATUS_CONFIG = {
  recruiting: { label: 'Open', color: '#22c55e' },
  active: { label: 'In Progress', color: '#3b82f6' },
  completed: { label: 'Completed', color: '#8b5cf6' },
} as const;

export const CATEGORY_CONFIG = {
  sprint: { label: 'Coding', dotColor: '#22c55e', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  deep_dive: { label: 'Design', dotColor: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
  transformation: { label: 'Writing', dotColor: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  custom: { label: 'General', dotColor: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
} as const;

export const LIMITS = {
  FETCH_LIMIT: 20,
  POINTS_MULTIPLIER: 10,
  LEADERBOARD_LIMIT: 5,
  AVATAR_GROUP_MAX: 3,
  SKELETON_COUNT: 6,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
} as const;

export const TEXT = {
  HERO_BADGE: 'LIVE CHALLENGES',
  HERO_TITLE_1: 'Master Your Skills in',
  HERO_TITLE_2: 'Challenge Mode',
  HERO_DESC: 'Join time-bound challenges with friends. Daily check-ins, leaderboards, and accountability to push your growth.',
  CREATE_CHALLENGE: 'Create Challenge',
  HOW_IT_WORKS: 'How it works',
  VIEW_DETAILS: 'View Details',
  STAT_OPEN: 'Open Challenges',
  STAT_ACTIVE: 'Active Challengers',
  STAT_TOTAL: 'Total Challenges',
  TAB_TRENDING: 'Trending',
  TAB_DISCOVER: 'Discover',
  TAB_MY: 'My Challenges',
  TAB_BOOKMARKED: 'Bookmarked',
  SEARCH_PLACEHOLDER: 'Search challenges...',
  FILTER_ALL_TYPES: 'All Types',
  FILTER_ALL_STATUS: 'All Status',
  SORT_NEWEST: 'Newest First',
  SORT_POPULAR: 'Most Popular',
  SORT_STARTING: 'Starting Soon',
  EMPTY_BOOKMARKS: 'No bookmarked challenges',
  EMPTY_BOOKMARKS_DESC: 'Bookmark challenges by clicking the heart icon on any card.',
  EMPTY_MY: "You haven't joined any challenges yet. Explore and find one!",
  EMPTY_GENERAL: 'No challenges found',
  EMPTY_FIRST: 'Be the first to create a challenge and inspire others!',
  LEADERBOARD_TITLE: 'Top Challengers',
  LEADERBOARD_DESC: 'Most active participants this month',
  LOAD_ERROR: 'Failed to load challenges',
  TIME_STARTING_SOON: 'Starting soon',
  TIME_ENDING_SOON: 'Ending soon',
  TIME_COMPLETED: 'Completed',
} as const;
