import { COLORS } from '../../designTokens';

export const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ai_bonus: { label: 'AI Bonus', color: COLORS.PRIMARY },
  subscription_upgrade: { label: 'Sub Upgrade', color: COLORS.PRIMARY_DARK },
  trial_extension: { label: 'Trial Ext', color: COLORS.SUCCESS },
};

export const INITIAL_FORM_STATE = {
  code: '',
  description: '',
  type: 'ai_bonus',
  dailyMultiplier: 2,
  dailyBonusFlat: 0,
  grantTier: 'pro',
  durationDays: 30,
  maxRedemptions: '',
  validUntil: '',
};

export const TABLE_HEADERS = [
  'Code',
  'Type',
  'Benefit',
  'Duration',
  'Redemptions',
  'Status',
  'Created By',
];
