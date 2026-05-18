// ═══════════════════════════════════════════════════════════════════
// Design Tokens, Single source of truth for all visual constants
// ═══════════════════════════════════════════════════════════════════

// ─── Colors ──────────────────────────────────────────────────────
export const COLORS = {
  // Brand
  PRIMARY: '#667eea',
  PRIMARY_DARK: '#764ba2',
  PRIMARY_LIGHT: '#818cf8',
  SECONDARY: '#7c3aed',

  // Accent
  ACCENT_PURPLE: '#8b5cf6',
  ACCENT_PINK: '#ec4899',
  ACCENT_CYAN: '#06b6d4',
  ACCENT_INDIGO: '#6366f1',

  // Status
  SUCCESS: '#10b981',
  SUCCESS_DARK: '#059669',
  SUCCESS_LIGHT: '#22c55e',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',

  // Text
  TEXT_PRIMARY: '#1a1a2e',
  TEXT_SECONDARY: '#6b7280',
  TEXT_MUTED: '#9ca3af',
  TEXT_DARK: '#111827',
  TEXT_WHITE: '#ffffff',

  // Background
  BG_WHITE: '#ffffff',
  BG_LIGHT: '#fafbfc',
  BG_GRAY: '#f3f4f6',
  BG_DARK: '#1a1a2e',

  // Borders
  BORDER_LIGHT: '#e5e7eb',
  BORDER_DEFAULT: '#d1d5db',
  BORDER_FOCUS: '#667eea',
} as const;

// ─── Gradients ───────────────────────────────────────────────────
export const GRADIENTS = {
  PRIMARY: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  PRIMARY_HORIZONTAL: 'linear-gradient(90deg, #667eea, #764ba2)',
  SUCCESS: 'linear-gradient(135deg, #10b981, #059669)',
  CODING: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  DESIGN: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
  WRITING: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  GENERAL: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  PURPLE: 'linear-gradient(135deg, #7c3aed, #ec4899)',
  BLUE: 'linear-gradient(135deg, #3b82f6, #667eea)',
  WARM: 'linear-gradient(135deg, #f59e0b, #ef4444)',
} as const;

// ─── Shadows ─────────────────────────────────────────────────────
export const SHADOWS = {
  SMALL: '0 2px 8px rgba(0,0,0,0.06)',
  MEDIUM: '0 2px 16px rgba(0,0,0,0.06)',
  LARGE: '0 8px 32px rgba(0,0,0,0.15)',
  PRIMARY_GLOW: '0 4px 15px rgba(102, 126, 234, 0.3)',
  PRIMARY_GLOW_STRONG: '0 8px 25px rgba(102, 126, 234, 0.4)',
  CARD: '0 1px 3px rgba(0,0,0,0.08)',
  ELEVATED: '0 4px 20px rgba(0,0,0,0.1)',
} as const;

// ─── Border Radius ───────────────────────────────────────────────
export const RADIUS = {
  SMALL: '8px',
  MEDIUM: '10px',
  LARGE: '12px',
  XL: '14px',
  XXL: '16px',
  ROUND: '20px',
  PILL: '50px',
  CIRCLE: '50%',
} as const;

// ─── Typography ──────────────────────────────────────────────────
export const FONT_SIZE = {
  XS: '11px',
  SM: '12px',
  MD: '13px',
  BASE: '14px',
  LG: '16px',
  XL: '18px',
  XXL: '24px',
  XXXL: '32px',
} as const;

export const FONT_WEIGHT = {
  NORMAL: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────
export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '12px',
  LG: '16px',
  XL: '24px',
  XXL: '32px',
  XXXL: '48px',
} as const;

// ─── Transitions ─────────────────────────────────────────────────
export const TRANSITIONS = {
  FAST: 'all 0.2s ease',
  DEFAULT: 'all 0.3s ease',
  SLOW: 'all 0.5s ease',
} as const;

// ─── Z-Index ─────────────────────────────────────────────────────
export const Z_INDEX = {
  DROPDOWN: 100,
  MODAL: 1000,
  TOOLTIP: 1500,
  TOAST: 2000,
} as const;

// ─── Common MUI sx overrides ─────────────────────────────────────
export const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    backgroundColor: '#fafbfc',
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.PRIMARY },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.PRIMARY },
  },
} as const;

export const DARK_TEXT_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.BG_WHITE,
    borderRadius: RADIUS.SMALL,
    '& fieldset': { borderColor: COLORS.BORDER_DEFAULT },
    '&:hover fieldset': { borderColor: COLORS.PRIMARY },
    '&.Mui-focused fieldset': { borderColor: COLORS.PRIMARY },
  },
  '& .MuiInputLabel-root': {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontWeight: FONT_WEIGHT.SEMIBOLD,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    '&.Mui-focused': { color: COLORS.PRIMARY },
  },
  '& .MuiInputBase-input::placeholder': {
    color: COLORS.TEXT_MUTED,
    opacity: 1,
  },
  '& .MuiFormHelperText-root': {
    color: COLORS.TEXT_MUTED,
  },
} as const;
