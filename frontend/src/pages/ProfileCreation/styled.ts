// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 40px;
  background: white;
  border-bottom: 1px solid #f0f0f0;

  @media (max-width: 768px) {
    padding: 16px 20px;
  }
`;

export const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  svg { font-size: 26px; color: #667eea; }
`;

export const MainContent = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;

  @media (max-width: 480px) {
    padding: 24px 16px;
    align-items: flex-start;
  }
`;

export const ContentWrapper = styled.div`
  max-width: 720px;
  width: 100%;
  animation: ${fadeIn} 0.5s ease;
`;

export const WelcomeBubble = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border-radius: 50px;
  padding: 8px 24px 8px 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  width: fit-content;
  margin: 0 auto 32px;

  @media (max-width: 480px) {
    gap: 10px;
    padding: 6px 16px 6px 6px;
    margin-bottom: 24px;
  }
`;

export const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 36px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const ChoiceCard = styled.div`
  background: white;
  border-radius: 18px;
  padding: 32px 28px;
  text-align: center;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  border: 2px solid transparent;
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: ${props => props.$disabled ? 0.7 : 1};

  @media (max-width: 480px) {
    padding: 24px 20px;
    border-radius: 14px;
  }

  &:hover {
    border-color: ${props => props.$disabled ? 'transparent' : '#667eea'};
    transform: ${props => props.$disabled ? 'none' : 'translateY(-4px)'};
    box-shadow: ${props => props.$disabled ? '0 2px 16px rgba(0,0,0,0.05)' : '0 8px 28px rgba(102,126,234,0.15)'};
  }

  &:focus-visible {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102,126,234,0.25), 0 8px 28px rgba(102,126,234,0.15);
  }
`;

export const IconCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: ${props => props.$gradient || 'linear-gradient(135deg, #667eea, #764ba2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 14px ${props => props.$shadow || 'rgba(102,126,234,0.3)'};

  @media (max-width: 480px) {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    margin-bottom: 16px;
    svg { font-size: 24px !important; }
  }

  svg {
    font-size: 28px;
    color: white;
  }
`;

export const CardButton = styled.div`
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: ${props => props.$bg || 'linear-gradient(135deg, #667eea, #764ba2)'};
  color: white;
  font-weight: 600;
  font-size: 14px;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: auto;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 4px 14px rgba(102,126,234,0.4);
  }

  svg { font-size: 18px; }
`;

export const FeatureTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${props => props.$bg || 'rgba(102,126,234,0.08)'};
  color: ${props => props.$color || '#667eea'};
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  margin-top: 12px;
`;

export const UploadOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
`;

/* ═══════════════════════════════════════════════
   AI "BUILDING YOUR PROFILE" MAGIC OVERLAY
   ═══════════════════════════════════════════════ */

const overlayFade = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  0%   { opacity: 0; transform: scale(0.85) translateY(12px); }
  60%  { transform: scale(1.02) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -320px 0; }
  100% { background-position: 320px 0; }
`;

const orbPulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(102,126,234,0.45); }
  50%      { transform: scale(1.06); box-shadow: 0 0 0 22px rgba(102,126,234,0); }
`;

const ring = keyframes`
  to { transform: rotate(360deg); }
`;

const sparkleFloat = keyframes`
  0%   { opacity: 0; transform: translateY(8px) scale(0.6); }
  40%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-22px) scale(1.1); }
`;

const fillRow = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

export const MagicScreen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(102,126,234,0.16), transparent 60%),
    radial-gradient(900px 500px at 90% 110%, rgba(240,147,251,0.14), transparent 60%),
    #0b1020;
  animation: ${overlayFade} 0.4s ease;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 30%, rgba(255,255,255,0.05) 0 1px, transparent 1px),
      radial-gradient(circle at 70% 60%, rgba(255,255,255,0.04) 0 1px, transparent 1px),
      radial-gradient(circle at 40% 80%, rgba(255,255,255,0.05) 0 1px, transparent 1px);
    background-size: 180px 180px, 220px 220px, 260px 260px;
    pointer-events: none;
  }
`;

export const MagicGrid = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 48px;
  align-items: center;
  width: 100%;
  max-width: 920px;
  animation: ${popIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    gap: 28px;
    max-width: 440px;
  }
`;

export const MagicLeft = styled.div`
  color: #fff;

  @media (max-width: 820px) {
    text-align: center;
    order: 2;
  }
`;

export const MagicOrb = styled.div`
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 26px;
  animation: ${orbPulse} 2.4s ease-in-out infinite;

  svg { font-size: 40px; color: #fff; }

  @media (max-width: 820px) { margin: 0 auto 20px; }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const OrbRing = styled.div`
  position: absolute;
  inset: -10px;
  border-radius: 30px;
  border: 2px solid transparent;
  border-top-color: rgba(255,255,255,0.7);
  border-right-color: rgba(255,255,255,0.25);
  animation: ${ring} 1.1s linear infinite;

  @media (prefers-reduced-motion: reduce) { animation: none; opacity: 0.4; }
`;

export const Sparkle = styled.span`
  position: absolute;
  font-size: 14px;
  pointer-events: none;
  animation: ${sparkleFloat} 1.8s ease-in-out infinite;
  animation-delay: ${p => p.$delay || '0s'};
  left: ${p => p.$left || '50%'};
  top: ${p => p.$top || '0'};

  @media (prefers-reduced-motion: reduce) { display: none; }
`;

export const MagicTitle = styled.h1`
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.6px;
  margin: 0 0 10px;
  line-height: 1.15;
  background: linear-gradient(90deg, #fff, #c7d2fe);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  @media (max-width: 820px) { font-size: 24px; }
`;

export const MagicStepText = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 30px;
  font-size: 16px;
  font-weight: 600;
  color: #c7d2fe;
  margin-bottom: 26px;

  svg { font-size: 20px; color: #a5b4fc; flex-shrink: 0; }

  @media (max-width: 820px) { justify-content: center; }
`;

export const MagicProgressTrack = styled.div`
  width: 100%;
  max-width: 360px;
  height: 8px;
  border-radius: 99px;
  background: rgba(255,255,255,0.12);
  overflow: hidden;

  @media (max-width: 820px) { margin: 0 auto; }
`;

export const MagicProgressBar = styled.div`
  height: 100%;
  width: ${p => p.$pct || 0}%;
  border-radius: 99px;
  background: linear-gradient(90deg, #667eea, #a78bfa, #f093fb);
  background-size: 200% 100%;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  animation: ${shimmer} 1.4s linear infinite;

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const MagicProgressLabel = styled.div`
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);

  @media (max-width: 820px) { text-align: center; }
`;

/* Live profile card that fills in as parsing progresses */
export const MagicCard = styled.div`
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.45);

  @media (max-width: 820px) { order: 1; }
`;

export const MagicCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
`;

export const MagicAvatar = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  flex-shrink: 0;
`;

export const SkeletonLine = styled.div`
  height: ${p => p.$h || '10px'};
  width: ${p => p.$w || '100%'};
  border-radius: 6px;
  margin-bottom: ${p => p.$mb || '8px'};
  background: ${p => p.$filled
    ? (p.$accent || 'linear-gradient(90deg,#667eea,#764ba2)')
    : 'linear-gradient(90deg,#eef0f4 25%,#e3e6ee 37%,#eef0f4 63%)'};
  background-size: 320px 100%;
  ${p => p.$filled
    ? `animation: ${fillRow} 0.45s ease both;`
    : `animation: ${shimmer} 1.3s linear infinite;`}

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const MagicSectionLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #9aa1b2;
  margin: 16px 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;

  svg { font-size: 14px; color: #667eea; }
`;

export const MagicTagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const MagicTag = styled.span`
  font-size: 12px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: 8px;
  background: ${p => p.$accent || 'rgba(102,126,234,0.1)'};
  color: ${p => p.$color || '#667eea'};
  animation: ${fillRow} 0.4s ease both;
  animation-delay: ${p => p.$delay || '0s'};

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

/* "Done" results summary */
export const ResultStats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 22px 0 6px;

  @media (max-width: 820px) { grid-template-columns: repeat(2, 1fr); }
`;

export const ResultStat = styled.div`
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  animation: ${countUp} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: ${p => p.$delay || '0s'};

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const ResultNumber = styled.div`
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(90deg, #a5b4fc, #f0abfc);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

export const ResultLabel = styled.div`
  margin-top: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: rgba(255,255,255,0.65);
`;