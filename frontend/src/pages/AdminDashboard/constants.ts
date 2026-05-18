import { COLORS } from '../../designTokens';

export const STAT_CARDS_CONFIG = {
  USERS: { color: COLORS.PRIMARY, label: 'Total Users' },
  JOBS: { color: COLORS.PRIMARY_DARK, label: 'Total Jobs' },
  AI: { color: COLORS.WARNING, label: 'AI Requests (30d)' },
  PROMOS: { color: COLORS.SUCCESS, label: 'Active Promos' },
};

export const TIER_COLORS = {
  enterprise: COLORS.PRIMARY,
  pro: COLORS.PRIMARY_DARK,
  free: COLORS.TEXT_SECONDARY,
};

export const GROWTH_COLORS = {
  NEW_MONTH: COLORS.SUCCESS,
  NEW_WEEK: COLORS.INFO,
  POSTS: COLORS.ACCENT_PURPLE,
};
