export interface RoleDialogState {
  open: boolean;
  user: any | null;
  newRole: string;
}

export interface TierDialogState {
  open: boolean;
  user: any | null;
  newTier: string;
}

export interface SnackState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}
