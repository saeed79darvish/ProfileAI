import { alpha } from '@mui/material/styles';
import { COLORS } from '../../designTokens';

export const ROLE_COLORS: Record<string, 'error' | 'secondary' | 'primary'> = {
  admin: 'error',
  recruiter: 'secondary',
  candidate: 'primary',
};

export const TIER_STYLES: Record<string, { bgcolor: string; color: string }> = {
  enterprise: { bgcolor: alpha(COLORS.PRIMARY, 0.1), color: COLORS.PRIMARY },
  pro: { bgcolor: alpha(COLORS.PRIMARY_DARK, 0.1), color: COLORS.PRIMARY_DARK },
  free: { bgcolor: alpha(COLORS.TEXT_SECONDARY, 0.1), color: COLORS.TEXT_SECONDARY },
};

export const DEFAULT_ROWS_PER_PAGE = 20;

export const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

export const SEARCH_DEBOUNCE_MS = 400;
