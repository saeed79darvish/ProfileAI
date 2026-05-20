import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Box, Typography, Link, IconButton } from '@mui/material';
import {
  AutoAwesome as SparkleIcon,
  Extension as ExtensionIcon,
  Psychology as BrainIcon,
  Bolt as BoltIcon,
  ArrowBack as ArrowBackIcon,
  Star as StarIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';

// ── Animations ──
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(1.5deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.04); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const GradientText = styled.span`
  background: linear-gradient(135deg, #667eea 30%, #a78bfa 60%, #764ba2 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${gradientShift} 4s ease infinite;
`;

// ── Layout ──
const PageContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background: #fafbff;
  @media (max-width: 899px) { flex-direction: column; }
`;

const LeftPanel = styled.div`
  width: 46%;
  flex-shrink: 0;
  background: linear-gradient(165deg, #16132b 0%, #1a1040 40%, #0d0219 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 56px 48px;
  position: relative;
  overflow: hidden;

  @media (max-width: 899px) {
    display: none;
  }
`;

const GridOverlay = styled.div`
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(102, 126, 234, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(102, 126, 234, 0.035) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
`;

const Orb = styled.div`
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  animation: ${pulse} ${props => props.$dur || '6s'} ease-in-out infinite ${props => props.$del || '0s'};
`;

const LeftContent = styled.div`
  max-width: 380px;
  position: relative;
  z-index: 1;
  @media (max-width: 899px) { text-align: center; max-width: 400px; }
`;

const RightPanel = styled.div`
  flex: 1;
  background: #fafbff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  min-height: 100vh;
  overflow-y: auto;
  position: relative;

  /* Soft dark-to-transparent fade on left edge for seamless blend */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 80px;
    background: linear-gradient(90deg,
      rgba(13, 2, 25, 0.15) 0%,
      rgba(22, 19, 43, 0.06) 40%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 1;
  }

  @media (max-width: 899px) {
    width: 100%;
    padding: 0 20px 200px;
    min-height: auto;
    align-items: stretch;
    justify-content: flex-start;
    &::before { display: none; }
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 400px;

  @media (max-width: 899px) {
    max-width: 100%;
  }
`;

// ── Mobile-only header & hero ──
const MobileTopBar = styled(Box)`
  display: none;
  @media (max-width: 899px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 4px 16px;
    margin: 0 -20px;
    padding-left: 20px;
    padding-right: 20px;
    background: #ffffff;
    position: sticky;
    top: 0;
    z-index: 5;
  }
`;

const MobileBrand = styled(RouterLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
`;

const MobileBrandLogo = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.32);
`;

const MobileMenuButton = styled(IconButton)`
  && {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    width: 40px;
    height: 40px;
    color: #374151;
    background: #ffffff;
  }
`;

const MobileHero = styled(Box)`
  display: none;
  @media (max-width: 899px) {
    display: block;
    background: linear-gradient(180deg, #f5f3ff 0%, #fafbff 100%);
    margin: 0 -20px 24px;
    padding: 28px 20px 32px;
    border-bottom: 1px solid rgba(102, 126, 234, 0.08);
  }
`;

const MobileHeroPill = styled(Box)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(102, 126, 234, 0.1);
  color: #5b3df5;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 18px;

  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #5b3df5;
  }
`;

export const MobileStickyFooter = styled(Box)`
  margin-top: 24px;

  @media (max-width: 899px) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin-top: 0;
    background: #ffffff;
    padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid #eef0f5;
    box-shadow: 0 -6px 24px rgba(15, 23, 42, 0.06);
    z-index: 20;
  }
`;

export const HideOnMobile = styled.div`
  @media (max-width: 899px) {
    display: none;
  }
`;

const BrandMark = styled(RouterLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 40px;
  text-decoration: none;
  transition: opacity 0.2s;
  &:hover { opacity: 0.85; }
  @media (max-width: 899px) { justify-content: center; margin-bottom: 24px; }
`;

// ── Floating UI Card ──
const GlassCard = styled.div`
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  padding: 16px 18px;
  animation: ${float} ${props => props.$dur || '7s'} ease-in-out infinite ${props => props.$del || '0s'};
  position: absolute;
  pointer-events: none;
  @media (max-width: 899px) { display: none; }
`;

// ── Feature Pill ──
const FeaturePill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(102, 126, 234, 0.25);
  }
`;

const features = [
  { icon: <SparkleIcon sx={{ fontSize: 16 }} />, label: 'AI Tailoring', color: '#a78bfa' },
  { icon: <ExtensionIcon sx={{ fontSize: 16 }} />, label: 'Chrome Extension', color: '#667eea' },
  { icon: <BrainIcon sx={{ fontSize: 16 }} />, label: 'Agent Arena', color: '#f59e0b' },
  { icon: <BoltIcon sx={{ fontSize: 16 }} />, label: 'Smart Matching', color: '#10b981' },
];

const AuthLayout = ({ children }) => {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <PageContainer>
      <LeftPanel>
        <GridOverlay />

        {/* Ambient orbs */}
        <Orb $dur="7s" style={{ width: 350, height: 350, top: -100, right: -80, background: 'radial-gradient(circle, rgba(102,126,234,0.12) 0%, transparent 70%)' }} />
        <Orb $dur="9s" $del="1.5s" style={{ width: 280, height: 280, bottom: -60, left: -60, background: 'radial-gradient(circle, rgba(118,75,162,0.1) 0%, transparent 70%)' }} />
        <Orb $dur="10s" $del="3s" style={{ width: 200, height: 200, top: '55%', right: '15%', background: 'radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)' }} />

        {/* Floating card, match score */}
        <GlassCard $dur="8s" style={{ top: '10%', right: '8%', width: 160 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
            <SparkleIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 11 }}>Match Score</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ width: '92%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
            </Box>
            <Typography sx={{ fontSize: 10, color: '#34d399', fontWeight: 700 }}>92%</Typography>
          </Box>
        </GlassCard>

        {/* Floating card, stats */}
        <GlassCard $dur="9s" $del="2s" style={{ bottom: '14%', right: '5%', width: 140 }}>
          <Box sx={{ display: 'flex', gap: 2.5 }}>
            {[
              { n: '12', label: 'Applied', color: '#667eea' },
              { n: '4', label: 'Interviews', color: '#10b981' },
            ].map((s) => (
              <Box key={s.label} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: s.color, lineHeight: 1 }}>{s.n}</Typography>
                <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', mt: 0.3, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </GlassCard>

        <LeftContent>
          {/* Brand */}
          <BrandMark to="/">
            <Box sx={{
              width: 34, height: 34, borderRadius: '9px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(102,126,234,0.3)',
            }}>
              <SparkleIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.5px' }}>
              ProfileAI
            </Typography>
          </BrandMark>

          {/* Headline */}
          <Typography
            variant="h3"
            sx={{
              color: 'white', fontWeight: 800, lineHeight: 1.08,
              mb: 2, fontSize: { xs: '1.6rem', md: '2.1rem' }, letterSpacing: '-0.03em',
            }}
          >
            {isLogin ? (
              <>Pick up where you <GradientText>left off</GradientText></>
            ) : (
              <>Your career, <GradientText>supercharged</GradientText> by AI.</>
            )}
          </Typography>

          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 400, lineHeight: 1.65, mb: 4, fontSize: '0.92rem' }}>
            {isLogin
              ? 'Your tailored profiles, saved matches, and AI career tools are right where you left them.'
              : 'Join thousands of professionals using AI to tailor resumes in seconds and land interviews faster.'}
          </Typography>

          {/* Feature pills, compact 2x2 grid */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', gap: 1, mb: 4 }}>
            {features.map((f, i) => (
              <FeaturePill key={i}>
                <Box sx={{ color: f.color, display: 'flex' }}>{f.icon}</Box>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>{f.label}</span>
              </FeaturePill>
            ))}
          </Box>

          {/* Social proof */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', gap: 0.3, mb: 0.8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <StarIcon key={i} sx={{ fontSize: 15, color: '#f59e0b' }} />
              ))}
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', fontWeight: 400 }}>
              {isLogin ? 'Trusted by 12,500+ professionals' : 'Loved by 12,500+ professionals'}
            </Typography>
          </Box>
        </LeftContent>
      </LeftPanel>

      <RightPanel>
        {/* Subtle corner decoration on right panel */}
        <Box sx={{
          position: 'absolute', top: 0, right: 0, width: 300, height: 300,
          background: 'radial-gradient(circle at 100% 0%, rgba(102,126,234,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <FormContainer>
          <MobileTopBar>
            <MobileBrand to="/">
              <MobileBrandLogo>
                <SparkleIcon sx={{ color: '#fff', fontSize: 18 }} />
              </MobileBrandLogo>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.3px' }}>
                ProfileAI
              </Typography>
            </MobileBrand>
            <Link
              component={RouterLink}
              to="/"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                color: '#64748b', textDecoration: 'none', fontSize: '0.82rem',
                fontWeight: 500,
                '&:hover': { color: '#667eea' },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 15 }} />
              Home
            </Link>
          </MobileTopBar>

          <MobileHero>
            <MobileHeroPill>Join 12,000+ professionals</MobileHeroPill>
            <Typography
              sx={{
                color: '#0f172a',
                fontWeight: 800,
                fontSize: '2.1rem',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                mb: 1.5,
              }}
            >
              {isLogin ? (
                <>Pick up where you <GradientText>left off</GradientText></>
              ) : (
                <>Your career, <GradientText>supercharged</GradientText> by AI.</>
              )}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.55 }}>
              {isLogin
                ? 'Welcome back. Your tailored profiles are ready.'
                : 'Tailor resumes in seconds and land interviews faster.'}
            </Typography>
          </MobileHero>

          <HideOnMobile>
            <Link
              component={RouterLink}
              to="/"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                color: '#94a3b8', textDecoration: 'none', fontSize: '0.82rem',
                fontWeight: 500, mb: 3, transition: 'all 0.2s',
                '&:hover': { color: '#667eea', gap: 1 },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 15 }} />
              Back to home
            </Link>
          </HideOnMobile>
          {children}
        </FormContainer>
      </RightPanel>
    </PageContainer>
  );
};

export default AuthLayout;
