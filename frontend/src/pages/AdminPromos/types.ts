export interface PromoFormState {
  code: string;
  description: string;
  type: string;
  dailyMultiplier: number;
  dailyBonusFlat: number;
  grantTier: string;
  durationDays: number;
  maxRedemptions: string;
  validUntil: string;
}

export interface SnackState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

export interface RedemptionsDialogState {
  open: boolean;
  promoId: number | null;
  redemptions: any[];
  loading: boolean;
}
