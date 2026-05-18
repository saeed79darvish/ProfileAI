import { COLORS } from '../../designTokens';

// ── Local Constants ─────────────────────────────────────────────────
const HERO_GRADIENT = `linear-gradient(135deg, ${COLORS.SECONDARY} 0%, #6d28d9 100%)`;
const ERROR_BG_GRADIENT = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
const PAGE_BG = '#f8fafc';

// ── Loading State ───────────────────────────────────────────────────

export const loadingContainerSx = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  background: HERO_GRADIENT,
} as const;

export const loadingSpinnerSx = { color: COLORS.TEXT_WHITE, mb: 2 } as const;

export const loadingTextSx = { color: COLORS.TEXT_WHITE, opacity: 0.9 } as const;

// ── Error State ─────────────────────────────────────────────────────

export const errorContainerSx = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  background: ERROR_BG_GRADIENT,
} as const;

export const errorCardSx = {
  p: 6,
  textAlign: 'center',
  borderRadius: 4,
  maxWidth: 400,
} as const;

export const errorMessageSx = { mb: 3 } as const;

export const errorButtonSx = {
  background: HERO_GRADIENT,
  borderRadius: 2,
  textDecoration: 'none',
} as const;

// ── Page Wrapper ────────────────────────────────────────────────────

export const pageWrapperSx = {
  minHeight: '100vh',
  bgcolor: PAGE_BG,
} as const;

// ── Hero Section ────────────────────────────────────────────────────

export const heroSectionSx = {
  background: HERO_GRADIENT,
  pt: 4,
  pb: 15,
  position: 'relative',
} as const;

export const backButtonSx = {
  color: COLORS.TEXT_WHITE,
  bgcolor: 'rgba(255,255,255,0.15)',
  mb: 3,
  textDecoration: 'none',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
} as const;

// ── Profile Card ────────────────────────────────────────────────────

export const profileCardOffsetSx = { mt: -12 } as const;

export const profileCardSx = {
  borderRadius: 4,
  boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
  overflow: 'visible',
} as const;

export const profileCardContentSx = {
  p: { xs: 3, md: 5 },
} as const;

export const profileImageColumnSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
} as const;

export const profileAvatarSx = {
  width: 150,
  height: 150,
  border: '5px solid white',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  fontSize: '3rem',
  background: HERO_GRADIENT,
  mt: -10,
} as const;

export const companyLogoSx = {
  width: 100,
  height: 100,
  objectFit: 'contain',
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  p: 1,
  bgcolor: COLORS.BG_WHITE,
} as const;

// ── Profile Info ────────────────────────────────────────────────────

export const nameRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexWrap: 'wrap',
  mb: 1,
} as const;

export const companyNameClickableSx = {
  cursor: 'pointer',
  '&:hover': { color: 'primary.main', textDecoration: 'underline' },
} as const;

export const infoRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 3,
  mb: 3,
} as const;

export const infoItemSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

// ── Follow Counts ───────────────────────────────────────────────────

export const followCountsRowSx = {
  display: 'flex',
  gap: 3,
  mb: 3,
} as const;

export const followCountItemSx = {
  cursor: 'pointer',
  '&:hover': { opacity: 0.8 },
} as const;

// ── Action Buttons ──────────────────────────────────────────────────

export const actionButtonsRowSx = {
  display: 'flex',
  gap: 2,
  flexWrap: 'wrap',
} as const;

export const actionButtonSx = {
  borderRadius: 3,
  px: 4,
} as const;

export const linkedinIconButtonSx = {
  border: '1px solid',
  borderColor: 'divider',
} as const;

// ── Bio & Description Sections ──────────────────────────────────────

export const sectionsGridSx = {
  mt: 2,
  mb: 4,
} as const;

export const sectionPaperSx = {
  p: 3,
  borderRadius: 3,
  height: '100%',
} as const;

export const sectionTitleSx = {
  fontWeight: 600,
  mb: 2,
} as const;

export const sectionTextSx = {
  whiteSpace: 'pre-wrap',
} as const;

// ── Contact Section ─────────────────────────────────────────────────

export const contactPaperSx = {
  p: 3,
  borderRadius: 3,
  mb: 4,
} as const;

export const contactItemSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;

export const contactLinkSx = {
  color: 'primary.main',
  textDecoration: 'none',
} as const;
