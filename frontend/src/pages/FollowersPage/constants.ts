export const ROUTES = {
  RECRUITER_PROFILE: (id: string | number) => `/recruiter/${id}`,
  USER_PROFILE: (id: string | number) => `/profile/${id}`,
} as const;

export const TEXT = {
  ERROR_LOADING_COUNTS: 'Error loading counts:',
  ERROR_FOLLOWERS: 'Failed to load followers',
  ERROR_FOLLOWING: 'Failed to load following',
  EMPTY_FOLLOWERS: 'No followers yet',
  EMPTY_FOLLOWING: 'Not following anyone yet',
  TITLE_OWN: 'Your Network',
  TITLE_OTHER: 'Network',
  FOLLOWERS: 'Followers',
  FOLLOWING: 'Following',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
} as const;
