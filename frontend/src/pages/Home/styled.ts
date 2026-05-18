import { keyframes } from '@emotion/react';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, TRANSITIONS } from '../../designTokens';

// ── Keyframes ───────────────────────────────────────────────────────

export const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(3deg); }
`;

export const floatReverse = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(15px) rotate(-2deg); }
`;

export const slideIn = keyframes`
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

export const scanLine = keyframes`
  0% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: calc(100% - 4px); opacity: 0; }
`;

export const typewriter = keyframes`
  0% { width: 0; }
  100% { width: 100%; }
`;

export const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
`;

export const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// ── Helper constants ────────────────────────────────────────────────
const SURFACE_DARK = '#12101f';
const DARK_BASE = '#0d0219';
const PRIMARY_GRADIENT = GRADIENTS.PRIMARY;
const GRADIENT_TEXT = `linear-gradient(135deg, ${COLORS.PRIMARY} 30%, ${COLORS.ACCENT_PURPLE} 60%, ${COLORS.PRIMARY_DARK} 100%)`;
const BORDER_ALPHA = 'rgba(102, 126, 234, 0.12)';
const BORDER_HOVER_ALPHA = 'rgba(102, 126, 234, 0.3)';

// ── Page ────────────────────────────────────────────────────────────

export const pageContainerSx = {
  bgcolor: DARK_BASE,
  overflow: 'hidden',
} as const;

// ── Hero Section ────────────────────────────────────────────────────

export const heroSectionSx = {
  position: 'relative',
  background: `linear-gradient(160deg, ${DARK_BASE} 0%, #1a1040 30%, ${DARK_BASE} 60%, #0f0a1a 100%)`,
  color: COLORS.TEXT_WHITE,
  pt: { xs: 10, md: 18 },
  pb: { xs: 4, md: 16 },
  overflow: 'hidden',
} as const;

export const heroOrb1Sx = {
  position: 'absolute',
  width: 500,
  height: 500,
  borderRadius: RADIUS.CIRCLE,
  background: `radial-gradient(circle, rgba(102,126,234,0.15) 0%, transparent 70%)`,
  top: -100,
  right: -100,
  animation: `${pulse} 6s ease-in-out infinite`,
  pointerEvents: 'none',
} as const;

export const heroOrb2Sx = {
  position: 'absolute',
  width: 400,
  height: 400,
  borderRadius: RADIUS.CIRCLE,
  background: `radial-gradient(circle, rgba(118,75,162,0.12) 0%, transparent 70%)`,
  bottom: -80,
  left: -80,
  animation: `${pulse} 8s ease-in-out infinite 1s`,
  pointerEvents: 'none',
} as const;

export const heroGridLinesSx = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `
    linear-gradient(rgba(102,126,234,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(102,126,234,0.03) 1px, transparent 1px)
  `,
  backgroundSize: '60px 60px',
  pointerEvents: 'none',
} as const;

export const heroContentSx = { position: 'relative', zIndex: 1 } as const;

export const heroChipSx = {
  mb: 3,
  bgcolor: 'rgba(102,126,234,0.12)',
  color: '#a78bfa',
  border: '1px solid rgba(167,139,250,0.25)',
  fontWeight: 600,
  fontSize: '0.8rem',
  letterSpacing: '0.5px',
} as const;

export const heroChipIconSx = { fontSize: 16, color: '#a78bfa !important' } as const;

export const heroTitleSx = {
  fontSize: { xs: '2.5rem', sm: '3.2rem', md: '3.8rem' },
  fontWeight: 800,
  lineHeight: 1.1,
  mb: 3,
  letterSpacing: '-0.02em',
} as const;

export const gradientTextSx = {
  background: GRADIENT_TEXT,
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: `${gradientShift} 4s ease infinite`,
} as const;

export const staticGradientTextSx = {
  background: GRADIENT_TEXT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const;

export const heroSubtitleSx = {
  color: 'rgba(255,255,255,0.7)',
  fontWeight: 400,
  lineHeight: 1.7,
  mb: 4,
  maxWidth: 520,
  fontSize: { xs: '1rem', md: '1.15rem' },
} as const;

export const heroButtonWrapperSx = { display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4, flexDirection: { xs: 'column', sm: 'row' } } as const;

export const heroPrimaryBtnSx = {
  background: PRIMARY_GRADIENT,
  px: 4, py: 1.6,
  borderRadius: RADIUS.LARGE,
  fontWeight: 700, fontSize: '1rem', textTransform: 'none',
  boxShadow: SHADOWS.PRIMARY_GLOW,
  width: { xs: '100%', sm: 'auto' },
  '&:hover': { boxShadow: SHADOWS.PRIMARY_GLOW_STRONG, transform: 'translateY(-1px)' },
  transition: TRANSITIONS.FAST,
} as const;

export const heroOutlinedBtnSx = {
  borderColor: 'rgba(255,255,255,0.25)', color: COLORS.TEXT_WHITE,
  px: 4, py: 1.6, borderRadius: RADIUS.LARGE,
  fontWeight: 700, fontSize: '1rem', textTransform: 'none',
  width: { xs: '100%', sm: 'auto' },
  '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
} as const;

export const trustWrapperSx = { display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', order: { xs: -1, md: 0 }, mb: { xs: 2, md: 0 } } as const;
export const trustItemSx = { display: 'flex', alignItems: 'center', gap: 0.8, color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' } as const;

// ── Hero Visual (right side) ────────────────────────────────────────

export const heroVisualWrapperSx = { display: 'block' } as const;
export const heroVisualContainerSx = { position: 'relative', height: { xs: 280, md: 560 } } as const;

export const heroVisualGridBgSx = {
  position: 'absolute', inset: -40,
  backgroundImage: `
    linear-gradient(rgba(167,139,250,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(167,139,250,0.06) 1px, transparent 1px)
  `,
  backgroundSize: '60px 60px',
  borderRadius: '24px',
  pointerEvents: 'none',
  mask: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
  WebkitMask: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
} as const;

export const profileCardSx = {
  position: 'absolute', top: { xs: 0, md: -10 }, left: { xs: 'auto', md: -20 }, right: { xs: 10, md: 'auto' }, width: { xs: 130, md: 210 }, zIndex: 1,
  bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: { xs: '12px', md: '16px' }, p: { xs: 1.2, md: 2 },
  animation: `${float} 6s ease-in-out infinite`,
} as const;

export const profileCardHeaderSx = { display: 'flex', alignItems: 'center', gap: { xs: 0.8, md: 1.5 }, mb: { xs: 0.8, md: 1.5 } } as const;
export const profileAvatarSx = {
  width: { xs: 28, md: 40 }, height: { xs: 28, md: 40 }, borderRadius: RADIUS.CIRCLE, background: PRIMARY_GRADIENT,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: { xs: 12, md: 16 },
} as const;
export const profileNameSx = { fontWeight: 700, fontSize: { xs: 11, md: 13 } } as const;
export const profileRoleSx = { fontSize: { xs: 9, md: 11 }, color: 'rgba(255,255,255,0.45)' } as const;
export const profileSkillsWrapperSx = { display: 'flex', gap: 0.7, flexWrap: 'wrap' } as const;
export const profileSkillChipSx = { bgcolor: `rgba(102,126,234,0.15)`, color: '#a78bfa', fontSize: { xs: 9, md: 10.5 }, height: { xs: 18, md: 22 } } as const;

export const aiInsightCardSx = {
  position: 'absolute', top: { xs: 100, md: 10 }, right: { xs: 10, md: -40 }, width: { xs: 130, md: 200 }, zIndex: 1,
  bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: { xs: '10px', md: '14px' }, p: { xs: 1.2, md: 2 },
  animation: `${floatReverse} 7s ease-in-out infinite`,
} as const;
export const aiInsightHeaderSx = { display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 } as const;
export const aiInsightIconSx = { fontSize: { xs: 12, md: 16 }, color: COLORS.WARNING } as const;
export const aiInsightLabelSx = { fontWeight: 700, fontSize: { xs: 10, md: 12 }, color: COLORS.WARNING } as const;
export const aiInsightTextSx = { fontSize: { xs: 9, md: 11 }, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 } as const;

// Main ApplyPilot card
export const mainCardSx = {
  position: 'absolute', top: { xs: 5, md: 90 }, left: { xs: 5, md: 10 }, right: { xs: 'auto', md: 10 }, width: { xs: '48%', md: 'auto' },
  zIndex: 3,
  bgcolor: 'rgba(18,14,32,0.92)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(167,139,250,0.2)',
  borderRadius: { xs: '14px', md: RADIUS.ROUND }, overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(102,126,234,0.06)',
  animation: `${floatReverse} 8s ease-in-out infinite 0.3s`,
} as const;
export const mainCardHeaderSx = { px: { xs: 1.5, md: 3 }, pt: { xs: 1.5, md: 2.5 }, pb: { xs: 0.8, md: 1.5 }, display: 'flex', alignItems: 'center', gap: { xs: 0.8, md: 1.5 } } as const;
export const mainCardIconBoxSx = {
  width: { xs: 24, md: 36 }, height: { xs: 24, md: 36 }, borderRadius: { xs: '7px', md: '10px' },
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const mainCardTitleRowSx = { display: 'flex', alignItems: 'center', gap: 0.8 } as const;
export const mainCardTitleSx = { fontWeight: 800, fontSize: { xs: 12, md: 16.5 } } as const;
export const mainCardDotSx = {
  width: 8, height: 8, borderRadius: RADIUS.CIRCLE, bgcolor: '#34d399',
  animation: `${pulse} 2s ease-in-out infinite`,
} as const;
export const mainCardSubtitleSx = { fontSize: { xs: 9, md: 12 }, color: 'rgba(255,255,255,0.4)', mt: -0.2 } as const;
export const mainCardDotsSx = { color: 'rgba(255,255,255,0.2)', fontSize: { xs: 14, md: 20 }, letterSpacing: '2px', cursor: 'default', display: { xs: 'none', md: 'block' } } as const;

export const jobDetectedSx = {
  mx: { xs: 1, md: 2.5 }, mb: { xs: 1, md: 2 }, border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: { xs: '10px', md: '14px' }, p: { xs: 1.2, md: 2.5 }, bgcolor: 'rgba(255,255,255,0.02)',
} as const;
export const jobDetectedHeaderSx = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 } as const;
export const jobDetectedLabelSx = { color: '#a78bfa', fontSize: { xs: 9, md: 11.5 }, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' } as const;
export const jobDetectedTimeSx = { color: 'rgba(255,255,255,0.3)', fontSize: { xs: 9, md: 11 } } as const;
export const jobDetectedTitleSx = { fontWeight: 700, fontSize: { xs: 13, md: 18 }, mb: 0.3 } as const;
export const jobDetectedCompanySx = { fontSize: { xs: 10, md: 13 }, color: 'rgba(255,255,255,0.4)', mb: { xs: 1, md: 2 } } as const;
export const jobSkillsWrapperSx = { display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap', mb: { xs: 1, md: 2.5 } } as const;
export const jobSkillChipSx = {
  bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.7)', fontSize: { xs: 9, md: 12 }, height: { xs: 20, md: 28 }, fontWeight: 500,
} as const;
export const matchScoreWrapperSx = { display: 'flex', alignItems: 'center', gap: 1.5 } as const;
export const matchScoreBgSx = { flex: 1, height: 7, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' } as const;
export const matchScoreFillSx = { width: '94%', height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${COLORS.SUCCESS}, #34d399)` } as const;
export const matchScoreValueSx = { fontSize: { xs: 11, md: 15 }, color: '#34d399', fontWeight: 800 } as const;
export const matchScoreLabelSx = { fontSize: { xs: 9, md: 11 }, color: 'rgba(255,255,255,0.3)', mt: 0.5 } as const;

export const mainCardActionsSx = { px: { xs: 1, md: 2.5 }, pb: { xs: 1, md: 2.5 }, display: 'flex', gap: { xs: 0.6, md: 1.2 } } as const;
export const autoTailorBtnSx = {
  flex: 1, background: PRIMARY_GRADIENT,
  borderRadius: RADIUS.LARGE, py: { xs: 0.8, md: 1.5 }, textAlign: 'center', cursor: 'pointer',
} as const;
export const autoTailorTextSx = {
  color: COLORS.TEXT_WHITE, fontSize: { xs: 10, md: 13.5 }, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
} as const;
export const oneClickBtnSx = {
  flex: 1.2, bgcolor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: RADIUS.LARGE,
  py: { xs: 0.8, md: 1.5 }, textAlign: 'center', cursor: 'pointer',
} as const;
export const oneClickTextSx = {
  color: 'rgba(255,255,255,0.65)', fontSize: { xs: 10, md: 13.5 }, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8,
} as const;

export const statsMiniCardSx = {
  position: 'absolute', bottom: { xs: 10, md: -15 }, left: '50%', transform: 'translateX(-50%)', zIndex: 1,
  bgcolor: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', p: 2,
  display: { xs: 'none', md: 'flex' }, gap: 4,
  animation: `${float} 8s ease-in-out infinite 0.5s`,
} as const;
export const getStatValueSx = (color: string) => ({ fontWeight: 800, fontSize: 20, color, fontStyle: 'italic' });
export const statMiniLabelSx = { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', fontWeight: 600 } as const;

// ── Stats Bar ───────────────────────────────────────────────────────

export const statsBarSx = {
  bgcolor: SURFACE_DARK, borderBottom: `1px solid rgba(255,255,255,0.06)`, py: 5,
} as const;
export const statsGroupSx = { display: 'flex', gap: 6, justifyContent: { xs: 'center', md: 'flex-start' } } as const;
export const statsValueSx = { fontWeight: 800, fontSize: '1.6rem', color: COLORS.TEXT_WHITE, lineHeight: 1 } as const;
export const statsLabelSx = { fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', mt: 0.5 } as const;
export const companiesWrapperSx = {
  display: 'flex', alignItems: 'center', gap: 2,
  justifyContent: { xs: 'center', md: 'flex-end' }, flexWrap: 'wrap',
} as const;
export const companiesLabelSx = { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, mr: 1 } as const;
export const companyBadgeSx = {
  px: 2, py: 0.8, borderRadius: RADIUS.SMALL, bgcolor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.6)', letterSpacing: '0.3px',
} as const;

// ── Feature Showcase ────────────────────────────────────────────────

export const featureSectionSx = { py: { xs: 4, md: 12 }, bgcolor: DARK_BASE } as const;
export const sectionChipSx = {
  mb: 2, bgcolor: 'rgba(102,126,234,0.12)', color: '#a78bfa',
  fontWeight: 600, fontSize: '0.8rem',
  border: '1px solid rgba(167,139,250,0.25)',
} as const;
export const sectionTitleSx = {
  fontWeight: 800, color: COLORS.TEXT_WHITE, mb: 1.5,
  fontSize: { xs: '2rem', md: '2.5rem' },
} as const;
export const sectionSubtitleSx = {
  color: 'rgba(255,255,255,0.6)', maxWidth: 560, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.7,
} as const;
export const tabButtonWrapperSx = { display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' }, gap: 1, justifyContent: 'center', mb: { xs: 3, md: 6 } } as const;

export const getTabButtonSx = (isActive: boolean) => ({
  px: { xs: 2, md: 3 }, py: 1.3, borderRadius: RADIUS.LARGE,
  textTransform: 'none' as const, fontWeight: 600, fontSize: { xs: '0.8rem', md: '0.9rem' },
  transition: 'all 0.25s ease', width: '100%',
  ...(isActive
    ? { background: PRIMARY_GRADIENT, color: COLORS.TEXT_WHITE, boxShadow: SHADOWS.PRIMARY_GLOW }
    : { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)',
        '&:hover': { borderColor: COLORS.PRIMARY, color: COLORS.PRIMARY } }),
});

export const featureCardSx = {
  borderRadius: RADIUS.ROUND, border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.03)',
} as const;
export const featureTextPanelSx = {
  p: { xs: 3, md: 6 }, display: 'flex', flexDirection: 'column', justifyContent: 'center',
} as const;
export const featureHeadlineSx = {
  fontWeight: 800, color: COLORS.TEXT_WHITE, mb: 2,
  fontSize: { xs: '1.5rem', md: '1.8rem' }, lineHeight: 1.2,
} as const;
export const featureDescSx = { color: 'rgba(255,255,255,0.6)', mb: 3, lineHeight: 1.7 } as const;
export const featureBulletsWrapperSx = { display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 } as const;
export const featureBulletItemSx = { display: 'flex', alignItems: 'center', gap: 1.5 } as const;
export const featureBulletTextSx = { fontSize: '0.93rem', color: COLORS.TEXT_WHITE } as const;

export const getFeatureTryBtnSx = (color: string) => ({
  alignSelf: 'flex-start', textTransform: 'none' as const, fontWeight: 700,
  color, fontSize: '0.95rem', '&:hover': { bgcolor: `${color}10` },
});

export const featureVisualPanelSx = {
  bgcolor: SURFACE_DARK, display: 'flex', alignItems: 'center', justifyContent: 'center',
  p: { xs: 3, md: 6 }, minHeight: { xs: 280, md: 360 }, position: 'relative', overflow: 'hidden',
} as const;
export const getFeatureOrbSx = (color: string) => ({
  position: 'absolute' as const, width: 300, height: 300, borderRadius: RADIUS.CIRCLE,
  background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`, pointerEvents: 'none' as const,
});
export const featureVisualContentSx = { position: 'relative', zIndex: 1, width: '100%', maxWidth: 320 } as const;

// Feature demo panels
export const demoPanelSx = {
  bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '16px', p: 3,
} as const;
export const demoHeaderSx = { display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 } as const;
export const demoTitleSx = { color: COLORS.TEXT_WHITE, fontWeight: 700, fontSize: 14 } as const;
export const demoWhiteTextSx = { color: COLORS.TEXT_WHITE, fontSize: 13 } as const;
export const demoMutedTextSx = { color: 'rgba(255,255,255,0.5)', fontSize: 11, mb: 0.5 } as const;

// Tailor demo
export const tailorScoreBoxSx = {
  width: 56, height: 56, borderRadius: '14px',
  background: `linear-gradient(135deg, ${COLORS.SUCCESS}, #34d399)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const tailorScoreTextSx = { fontWeight: 800, fontSize: 18, color: COLORS.TEXT_WHITE } as const;
export const tailorRoleSx = { color: COLORS.TEXT_WHITE, fontWeight: 600, fontSize: 14 } as const;
export const tailorCompanySx = { color: 'rgba(255,255,255,0.5)', fontSize: 12 } as const;
export const getSkillMatchChipSx = (isMatch: boolean) => ({
  bgcolor: isMatch ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
  color: isMatch ? '#34d399' : '#fbbf24', fontSize: 11, height: 24, fontWeight: 600,
});

// Extension demo
export const extensionDemoPanelSx = {
  ...demoPanelSx, position: 'relative', overflow: 'hidden',
} as const;
export const extensionScanLineSx = {
  position: 'absolute', left: 0, right: 0, height: '3px',
  background: 'linear-gradient(90deg, transparent, #a78bfa, transparent)',
  animation: `${scanLine} 3s ease-in-out infinite`,
  borderRadius: 2, pointerEvents: 'none',
} as const;
export const extensionIconBoxSx = {
  width: 28, height: 28, borderRadius: RADIUS.SMALL,
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const extensionActiveChipSx = {
  bgcolor: 'rgba(16,185,129,0.15)', color: '#34d399',
  fontSize: 10, height: 20, fontWeight: 700, ml: 'auto',
} as const;
export const extensionDetectedBoxSx = {
  bgcolor: `rgba(102,126,234,0.1)`, border: `1px solid rgba(102,126,234,0.2)`,
  borderRadius: '10px', p: 2, mb: 2, animation: `${slideIn} 0.5s ease-out`,
} as const;
export const extensionDetectedLabelSx = { color: '#a78bfa', fontSize: 12, fontWeight: 600, mb: 0.5 } as const;
export const extensionJobTitleSx = { color: COLORS.TEXT_WHITE, fontSize: 13, fontWeight: 600 } as const;
export const extensionMatchTextSx = { color: 'rgba(255,255,255,0.4)', fontSize: 11, mt: 0.5 } as const;
export const extensionMatchScoreSx = { color: '#34d399', fontWeight: 700 } as const;
export const extensionTailorBtnSx = {
  flex: 1, bgcolor: 'rgba(102,126,234,0.15)', borderRadius: RADIUS.SMALL,
  p: 1.5, textAlign: 'center', cursor: 'pointer',
  transition: TRANSITIONS.FAST, '&:hover': { bgcolor: 'rgba(102,126,234,0.25)' },
} as const;
export const extensionTailorTextSx = { color: '#a78bfa', fontSize: 11, fontWeight: 700 } as const;
export const extensionAutoFillBtnSx = {
  flex: 1, bgcolor: 'rgba(16,185,129,0.15)', borderRadius: RADIUS.SMALL,
  p: 1.5, textAlign: 'center', cursor: 'pointer',
  transition: TRANSITIONS.FAST, '&:hover': { bgcolor: 'rgba(16,185,129,0.25)' },
} as const;
export const extensionAutoFillTextSx = { color: '#34d399', fontSize: 11, fontWeight: 700 } as const;

// Arena demo
export const arenaRecruiterBoxSx = {
  bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
  borderRadius: '10px', p: 2, mb: 2,
} as const;
export const arenaUserBoxSx = {
  bgcolor: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.15)',
  borderRadius: '10px', p: 2,
} as const;

// Jobs demo
export const jobListItemSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)',
  '&:last-child': { borderBottom: 'none' },
} as const;
export const jobListRoleSx = { color: COLORS.TEXT_WHITE, fontSize: 13, fontWeight: 600 } as const;
export const jobListCompanySx = { color: 'rgba(255,255,255,0.4)', fontSize: 11 } as const;
export const getJobScoreChipSx = (color: string) => ({
  bgcolor: `${color}20`, color, fontWeight: 700, fontSize: 12, height: 26,
});

// ── How It Works ────────────────────────────────────────────────────

export const howSectionSx = { py: { xs: 8, md: 12 }, bgcolor: SURFACE_DARK } as const;
export const howTitleSx = {
  fontWeight: 800, color: COLORS.TEXT_WHITE, fontSize: { xs: '2rem', md: '2.5rem' },
} as const;
export const getHowCardSx = (color: string) => ({
  position: 'relative' as const, p: 4, borderRadius: RADIUS.ROUND,
  border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)', height: '100%',
  transition: TRANSITIONS.DEFAULT,
  '&:hover': { borderColor: color, boxShadow: `0 8px 32px ${color}15`, transform: 'translateY(-4px)' },
});
export const getHowStepNumberSx = (color: string) => ({
  position: 'absolute' as const, top: 20, right: 24,
  fontSize: '3.5rem', fontWeight: 900, color: `${color}10`, lineHeight: 1,
});
export const getHowIconBoxSx = (color: string) => ({
  width: 56, height: 56, borderRadius: '16px', bgcolor: `${color}10`,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color, mb: 3,
});
export const howCardTitleSx = { fontWeight: 700, color: COLORS.TEXT_WHITE, mb: 1 } as const;
export const howCardDescSx = { color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 } as const;

// ── For Candidates / Recruiters ─────────────────────────────────────

export const audienceSectionSx = { py: { xs: 8, md: 12 }, bgcolor: DARK_BASE } as const;

export const candidateCardSx = {
  borderRadius: RADIUS.ROUND, border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden', height: '100%', transition: TRANSITIONS.DEFAULT, bgcolor: 'rgba(255,255,255,0.03)',
  '&:hover': { borderColor: 'rgba(102,126,234,0.3)', boxShadow: '0 8px 32px rgba(102,126,234,0.08)' },
} as const;
export const candidateHeaderBgSx = {
  background: `linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))`, p: 4, pb: 3,
} as const;
export const audienceHeaderRowSx = { display: 'flex', alignItems: 'center', gap: 2, mb: 1 } as const;
export const getAudienceIconBoxSx = (gradient: string) => ({
  width: 48, height: 48, borderRadius: '14px', background: gradient,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
export const audienceCardTitleSx = { fontWeight: 800, color: COLORS.TEXT_WHITE } as const;
export const audienceBodySx = { p: 4, pt: 3 } as const;
export const audienceDescSx = { color: 'rgba(255,255,255,0.6)', mb: 3, lineHeight: 1.7 } as const;
export const audienceFeatureItemSx = { display: 'flex', alignItems: 'center', gap: 1.5, py: 1 } as const;
export const audienceFeatureTextSx = { fontSize: '0.9rem', color: COLORS.TEXT_WHITE } as const;

export const candidateCtaBtnSx = {
  mt: 3, background: PRIMARY_GRADIENT, textTransform: 'none',
  fontWeight: 700, borderRadius: RADIUS.LARGE, px: 3, py: 1.2,
  boxShadow: SHADOWS.PRIMARY_GLOW,
  '&:hover': { boxShadow: SHADOWS.PRIMARY_GLOW_STRONG },
} as const;

export const recruiterCardSx = {
  borderRadius: RADIUS.ROUND, border: '1px solid rgba(255,255,255,0.08)',
  overflow: 'hidden', height: '100%', transition: TRANSITIONS.DEFAULT, position: 'relative', bgcolor: 'rgba(255,255,255,0.03)',
  '&:hover': { borderColor: 'rgba(16,185,129,0.3)', boxShadow: '0 8px 32px rgba(16,185,129,0.08)' },
} as const;
export const recruiterHeaderBgSx = {
  background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(52,211,153,0.12))', p: 4, pb: 3,
} as const;
export const recruiterBadgeSx = {
  bgcolor: 'rgba(245,158,11,0.1)', color: '#d97706', fontWeight: 700, fontSize: '0.7rem', ml: 1,
} as const;
export const recruiterComingSoonBtnSx = {
  mt: 0, background: `linear-gradient(135deg, ${COLORS.SUCCESS}, #34d399)`,
  textTransform: 'none', fontWeight: 700, borderRadius: RADIUS.LARGE,
  px: 3, py: 1.2, opacity: '0.5 !important', color: `${COLORS.TEXT_WHITE} !important`,
} as const;

// ── ApplyPilot CTA ──────────────────────────────────────────────────

export const applyPilotSectionSx = { py: { xs: 4, md: 8 }, bgcolor: DARK_BASE } as const;
export const applyPilotCardSx = {
  borderRadius: '24px', overflow: 'hidden',
  background: `linear-gradient(160deg, ${SURFACE_DARK} 0%, #1a1040 40%, ${COLORS.BG_DARK} 100%)`,
  color: COLORS.TEXT_WHITE, position: 'relative',
} as const;
export const applyPilotOrb1Sx = {
  position: 'absolute', width: 400, height: 400, borderRadius: RADIUS.CIRCLE,
  background: 'radial-gradient(circle, rgba(167,139,250,0.12), transparent 70%)',
  top: -120, right: -80, pointerEvents: 'none',
} as const;
export const applyPilotOrb2Sx = {
  position: 'absolute', width: 300, height: 300, borderRadius: RADIUS.CIRCLE,
  background: 'radial-gradient(circle, rgba(102,126,234,0.1), transparent 70%)',
  bottom: -100, left: -60, pointerEvents: 'none',
} as const;
export const applyPilotContentSx = { position: 'relative', zIndex: 1 } as const;
export const applyPilotTextPanelSx = {
  p: { xs: 4, md: 6 }, display: 'flex', flexDirection: 'column', justifyContent: 'center',
} as const;
export const applyPilotBrandSx = { display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 } as const;
export const applyPilotBrandIconSx = {
  width: 48, height: 48, borderRadius: '14px',
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
} as const;
export const applyPilotBrandTitleSx = { fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.3px' } as const;
export const applyPilotBrandSubSx = {
  fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
  fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase',
} as const;
export const applyPilotHeadingSx = {
  fontWeight: 800, mb: 2, fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 1.2,
} as const;
export const applyPilotGradientTextSx = {
  background: `linear-gradient(135deg, #a78bfa, ${COLORS.PRIMARY})`,
  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
} as const;
export const applyPilotDescSx = { color: 'rgba(255,255,255,0.6)', mb: 3, lineHeight: 1.7, maxWidth: 440 } as const;
export const applyPilotBulletWrapperSx = { display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 } as const;
export const applyPilotBulletItemSx = { display: 'flex', alignItems: 'center', gap: 1.5 } as const;
export const applyPilotBulletIconSx = { fontSize: 16 } as const;
export const applyPilotBulletTextSx = { fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)' } as const;
export const applyPilotBtnWrapperSx = { display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, flexDirection: { xs: 'column', sm: 'row' } } as const;
export const applyPilotPrimaryBtnSx = {
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  px: 4, py: 1.5, borderRadius: RADIUS.LARGE,
  fontWeight: 700, fontSize: '0.95rem', textTransform: 'none',
  width: { xs: '100%', sm: 'auto' },
  boxShadow: '0 4px 24px rgba(167,139,250,0.35)',
  '&:hover': { boxShadow: '0 8px 32px rgba(167,139,250,0.5)', transform: 'translateY(-1px)' },
  transition: TRANSITIONS.FAST,
} as const;
export const applyPilotOutlinedBtnSx = {
  borderColor: 'rgba(255,255,255,0.15)', color: COLORS.TEXT_WHITE,
  px: 4, py: 1.5, borderRadius: RADIUS.LARGE,
  fontWeight: 700, fontSize: '0.95rem', textTransform: 'none',
  width: { xs: '100%', sm: 'auto' },
  '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
} as const;
export const platformChipsWrapperSx = { display: 'flex', gap: 1.5, flexWrap: 'wrap' } as const;
export const platformChipSx = {
  bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(255,255,255,0.08)', fontWeight: 500, fontSize: '0.75rem',
} as const;

// Browser mockup
export const browserMockupWrapperSx = {
  p: { xs: 3, md: 5 }, display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const browserMockupContainerSx = { width: '100%', maxWidth: 420, position: 'relative' } as const;
export const browserFrameSx = {
  borderRadius: '16px', overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
} as const;
export const browserBarSx = {
  bgcolor: 'rgba(255,255,255,0.08)', py: 1.2, px: 2,
  display: 'flex', alignItems: 'center', gap: 1.5,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
} as const;
export const browserDotsSx = { display: 'flex', gap: 0.7 } as const;
export const browserDotRedSx = { width: 10, height: 10, borderRadius: RADIUS.CIRCLE, bgcolor: '#ff5f57' } as const;
export const browserDotYellowSx = { width: 10, height: 10, borderRadius: RADIUS.CIRCLE, bgcolor: '#ffbd2e' } as const;
export const browserDotGreenSx = { width: 10, height: 10, borderRadius: RADIUS.CIRCLE, bgcolor: '#28c840' } as const;
export const browserUrlBarSx = {
  flex: 1, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '6px',
  px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 1,
} as const;
export const browserUrlTextSx = { fontSize: 11, color: 'rgba(255,255,255,0.35)' } as const;
export const browserExtIconSx = {
  width: 24, height: 24, borderRadius: '6px',
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: `${pulse} 2s ease-in-out infinite`,
} as const;
export const browserContentSx = { bgcolor: '#0f0a1a', p: 2.5, minHeight: 280 } as const;
export const browserJobSx = { bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 2, mb: 2 } as const;
export const browserJobLabelSx = { color: 'rgba(255,255,255,0.3)', fontSize: 10, mb: 0.5 } as const;
export const browserJobTitleSx = { color: COLORS.TEXT_WHITE, fontWeight: 700, fontSize: 15 } as const;
export const browserJobCompanySx = { color: 'rgba(255,255,255,0.5)', fontSize: 12, mt: 0.3 } as const;
export const browserPopupSx = {
  bgcolor: 'rgba(26,16,64,0.95)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(167,139,250,0.3)', borderRadius: '14px', p: 2.5,
  animation: `${slideIn} 0.6s ease-out`,
  boxShadow: '0 8px 32px rgba(102,126,234,0.2)',
} as const;
export const browserPopupHeaderSx = { display: 'flex', alignItems: 'center', gap: 1, mb: 2 } as const;
export const browserPopupIconSx = {
  width: 22, height: 22, borderRadius: '6px',
  background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const browserPopupTitleSx = { color: COLORS.TEXT_WHITE, fontWeight: 700, fontSize: 13 } as const;
export const browserDetectedChipSx = {
  bgcolor: 'rgba(16,185,129,0.12)', color: '#34d399',
  fontSize: 9, height: 18, fontWeight: 700, ml: 'auto',
} as const;
export const browserMatchLabelSx = { fontSize: 11, color: 'rgba(255,255,255,0.5)' } as const;
export const browserMatchScoreSx = { fontSize: 12, color: '#34d399', fontWeight: 700 } as const;
export const browserMatchBarBgSx = { height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' } as const;
export const browserMatchBarFillSx = {
  width: '94%', height: '100%', borderRadius: 3,
  background: `linear-gradient(90deg, ${COLORS.PRIMARY}, #34d399)`,
  animation: `${typewriter} 1.5s ease-out`,
} as const;
export const getBrowserSkillChipSx = (isMatch: boolean) => ({
  bgcolor: isMatch ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
  color: isMatch ? '#34d399' : '#fbbf24', fontSize: 10, height: 22, fontWeight: 600,
});
export const browserSkillsWrapperSx = { display: 'flex', gap: 0.8, flexWrap: 'wrap', mb: 2 } as const;
export const browserActionsSx = { display: 'flex', gap: 1 } as const;
export const browserTailorBtnSx = {
  flex: 1, background: `linear-gradient(135deg, ${COLORS.PRIMARY}, #a78bfa)`,
  borderRadius: RADIUS.SMALL, p: 1.2, textAlign: 'center', cursor: 'pointer',
} as const;
export const browserTailorTextSx = { color: COLORS.TEXT_WHITE, fontSize: 11, fontWeight: 700 } as const;
export const browserCoverBtnSx = {
  flex: 1, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: RADIUS.SMALL, p: 1.2, textAlign: 'center', cursor: 'pointer',
} as const;
export const browserCoverTextSx = { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700 } as const;
export const browserFloatingNoteSx = {
  position: 'absolute', bottom: -16, right: -10,
  bgcolor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
  borderRadius: '10px', px: 2, py: 1,
  animation: `${float} 5s ease-in-out infinite`,
} as const;
export const browserFloatingNoteTextSx = { color: '#34d399', fontSize: 11, fontWeight: 700 } as const;

// ── More Features Grid ──────────────────────────────────────────────

export const moreSectionSx = { py: { xs: 8, md: 12 }, bgcolor: SURFACE_DARK } as const;
export const getMoreCardSx = (color: string) => ({
  p: 3.5, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
  bgcolor: 'rgba(255,255,255,0.03)', height: '100%', cursor: 'pointer',
  transition: TRANSITIONS.DEFAULT,
  '&:hover': { borderColor: color, transform: 'translateY(-4px)', boxShadow: `0 8px 24px ${color}12` },
});
export const getMoreIconBoxSx = (color: string) => ({
  width: 48, height: 48, borderRadius: '14px', bgcolor: `${color}10`,
  color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
});
export const moreCardTitleSx = { fontWeight: 700, color: COLORS.TEXT_WHITE, mb: 1, fontSize: '1rem' } as const;
export const moreCardDescSx = { color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 } as const;

// ── Final CTA ───────────────────────────────────────────────────────

export const ctaSectionSx = { py: { xs: 4, md: 10 }, bgcolor: DARK_BASE } as const;
export const ctaTitleSx = {
  fontWeight: 800, color: COLORS.TEXT_WHITE, mb: 2, fontSize: { xs: '2rem', md: '2.8rem' },
} as const;
export const ctaSubtitleSx = {
  color: 'rgba(255,255,255,0.6)', mb: 4, maxWidth: 480, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.7,
} as const;
export const ctaBtnWrapperSx = { display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 3 } as const;
export const ctaPrimaryBtnSx = {
  background: PRIMARY_GRADIENT, px: 5, py: 1.8, borderRadius: RADIUS.LARGE,
  fontWeight: 700, fontSize: '1.1rem', textTransform: 'none',
  boxShadow: SHADOWS.PRIMARY_GLOW,
  '&:hover': { boxShadow: SHADOWS.PRIMARY_GLOW_STRONG, transform: 'translateY(-2px)' },
  transition: TRANSITIONS.FAST,
} as const;
export const ctaOutlinedBtnSx = {
  borderColor: 'rgba(255,255,255,0.25)', color: COLORS.TEXT_WHITE, px: 5, py: 1.8,
  borderRadius: RADIUS.LARGE, fontWeight: 600, fontSize: '1.1rem', textTransform: 'none',
  '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
} as const;
export const ctaStarsWrapperSx = { display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1 } as const;
export const ctaStarSx = { fontSize: 20, color: COLORS.WARNING } as const;
export const ctaRatingSx = { color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' } as const;

// ── Footer ──────────────────────────────────────────────────────────

export const footerSectionSx = { bgcolor: SURFACE_DARK, color: COLORS.TEXT_WHITE, pt: { xs: 5, md: 8 }, pb: 4 } as const;
export const footerBrandSx = { display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 } as const;
export const footerBrandIconSx = {
  width: 36, height: 36, borderRadius: '10px', background: PRIMARY_GRADIENT,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;
export const footerBrandTitleSx = { fontWeight: 800, letterSpacing: '-0.5px' } as const;
export const footerDescSx = { color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, mb: 2, maxWidth: 280, fontSize: '0.85rem' } as const;
export const footerSocialWrapperSx = { display: 'flex', gap: 1 } as const;
export const footerSocialBtnSx = {
  px: 2, py: 0.6, borderRadius: '6px', bgcolor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem',
  color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
  '&:hover': { borderColor: 'rgba(255,255,255,0.2)', color: COLORS.TEXT_WHITE },
  transition: TRANSITIONS.FAST,
} as const;
export const footerColTitleSx = {
  fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.85rem' }, mb: { xs: 1.5, md: 2 }, color: 'rgba(255,255,255,0.8)',
  letterSpacing: '0.5px', textTransform: 'uppercase',
} as const;
export const footerColLinksSx = { display: 'flex', flexDirection: 'column', gap: { xs: 0.8, md: 1.2 } } as const;
export const footerLinkSx = {
  color: 'rgba(255,255,255,0.4)', fontSize: { xs: '0.78rem', md: '0.88rem' }, textDecoration: 'none',
  '&:hover': { color: COLORS.TEXT_WHITE }, transition: 'color 0.2s',
} as const;
export const footerDividerSx = { my: 4, borderColor: 'rgba(255,255,255,0.06)' } as const;
export const footerBottomSx = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  flexWrap: 'wrap', gap: 2,
} as const;
export const footerCopyrightSx = { color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' } as const;
export const footerBottomLinksSx = { display: 'flex', gap: 3 } as const;
export const footerBottomLinkSx = {
  color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textDecoration: 'none',
  '&:hover': { color: COLORS.TEXT_WHITE },
} as const;
