// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes, css } from 'styled-components';

export const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const fadeSlideOut = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
`;

export const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
`;

export const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(102,126,234,0.3); }
  50%      { box-shadow: 0 0 0 12px rgba(102,126,234,0); }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
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
  cursor: pointer;
  /* No svg overrides: the mark is BrandLogo, which sizes and colours itself. */
`;

/* Persistent "Log in" affordance in the top bar. Deliberately a quiet
   secondary control: the page's job is to get new users building a profile,
   but returning users arriving from the extension need an exit to sign-in
   from any step. */
export const LoginLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: 1px solid #e2e4f0;
  border-radius: 999px;
  background: #fff;
  color: #4b4b63;
  font-size: 0.92rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, box-shadow 140ms ease;

  &:hover {
    border-color: #667eea;
    color: #4c51bf;
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.18);
  }

  @media (max-width: 480px) {
    padding: 8px 14px;
    font-size: 0.86rem;
  }
`;

export const MainContent = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;

  @media (max-width: 768px) {
    padding-bottom: 120px;
  }

  @media (max-width: 480px) {
    padding: 20px 14px 120px;
    align-items: flex-start;
  }
`;

export const SlideContainer = styled.div`
  max-width: 960px;
  width: 100%;
`;

export const DotsWrapper = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 40px;

  @media (max-width: 480px) {
    margin-bottom: 24px;
  }
`;

export const Dot = styled.div`
  width: ${props => props.$active ? '24px' : '8px'};
  height: 8px;
  border-radius: 4px;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : '#ddd'};
  transition: all 0.35s ease;
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
  margin-bottom: 32px;

  @media (max-width: 480px) {
    gap: 10px;
    padding: 6px 16px 6px 6px;
    margin-bottom: 20px;
  }
`;

export const SlideInner = styled.div`
  animation: ${props => props.$animating
    ? css`${fadeSlideOut} 0.3s ease forwards`
    : css`${fadeSlideIn} 0.45s ease forwards`};
`;

export const TwoColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 48px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 28px;
  }

  @media (max-width: 480px) {
    gap: 20px;
  }
`;

export const LeftCol = styled.div`
  flex: 1;
  min-width: 0;
`;

export const RightCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
`;

export const FeatureBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: white;
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.04);
  margin-top: 24px;

  @media (max-width: 480px) {
    padding: 14px 16px;
    gap: 10px;
    margin-top: 16px;
    border-radius: 12px;
  }
`;

export const FeatureBoxIcon = styled.div`
  font-size: 24px;
  line-height: 1;
`;

export const MockupCard = styled.div`
  background: white;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 8px 32px rgba(102,126,234,0.12);
  width: 100%;
  max-width: 380px;
  animation: ${float} 4s ease-in-out infinite;

  @media (max-width: 768px) {
    max-width: 340px;
  }

  @media (max-width: 480px) {
    padding: 18px;
    border-radius: 14px;
    max-width: 100%;
    animation: none;
  }
`;

export const MockupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f0f0f0;
`;

export const MockLine = styled.div`
  height: ${props => props.$h || '10px'};
  width: ${props => props.$w || '100%'};
  border-radius: 5px;
  background: ${props => props.$color || '#f0f2f5'};
  margin-bottom: ${props => props.$mb || '8px'};
`;

export const MockTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${props => props.$bg || 'rgba(102,126,234,0.08)'};
  color: ${props => props.$color || '#667eea'};
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  margin-right: 6px;
  margin-bottom: 6px;
`;

export const MockBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
`;

export const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin-top: 36px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

export const ChoiceCard = styled.div`
  background: white;
  border-radius: 20px;
  padding: 0;
  text-align: left;
  cursor: pointer;
  border: 2px solid transparent;
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 480px) {
    border-radius: 16px;
  }

  &:hover {
    border-color: #667eea;
    transform: translateY(-6px);
    box-shadow: 0 12px 36px rgba(102,126,234,0.18);
  }
`;

export const ChoiceCardVisual = styled.div`
  height: 200px;
  background: ${props => props.$bg || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  @media (max-width: 480px) {
    height: 170px;
  }
`;

export const FloatingCard = styled.div`
  background: white;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  width: ${props => props.$w || 'auto'};
  position: ${props => props.$abs ? 'absolute' : 'relative'};
  top: ${props => props.$top || 'auto'};
  left: ${props => props.$left || 'auto'};
  right: ${props => props.$right || 'auto'};
  bottom: ${props => props.$bottom || 'auto'};
  transform: ${props => props.$rotate || 'none'};
  z-index: ${props => props.$z || 1};

  @media (max-width: 480px) {
    padding: 12px 14px;
    border-radius: 10px;
  }
`;

export const ChoiceCardBody = styled.div`
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  flex: 1;

  @media (max-width: 480px) {
    padding: 20px 20px 22px;
  }
`;

export const ChoiceCardMockup = styled.div`
  height: 140px;
  border-radius: 12px;
  border: 2px solid #e8ecf4;
  background: linear-gradient(135deg, rgba(102,126,234,0.04), rgba(118,75,162,0.04));
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 16px;

  @media (max-width: 480px) {
    height: 110px;
    margin: 14px 0;
    padding: 12px;
  }
`;

export const ChoiceButton = styled.button`
  width: 100%;
  padding: 13px 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  font-size: 14.5px;
  font-family: inherit;
  margin-top: auto;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    box-shadow: 0 6px 20px rgba(102,126,234,0.4);
    transform: translateY(-1px);
  }
`;

export const ContinueBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  margin-top: 32px;
  transition: all 0.25s ease;
  animation: ${pulse} 2.5s ease infinite;

  &:hover {
    box-shadow: 0 6px 20px rgba(102,126,234,0.4);
    transform: translateY(-1px);
  }

  svg { font-size: 18px; }

  @media (max-width: 768px) {
    display: none;
  }
`;

export const SkipLink = styled.button`
  background: none;
  border: none;
  color: #999;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  margin-top: 16px;
  display: block;

  &:hover { color: #667eea; }

  @media (max-width: 768px) {
    display: none;
  }
`;

/* ═══════════════════════════════════════════════
   STICKY MOBILE ACTION BAR (Continue + Skip)
   Mirrors the screenshot's pinned bottom CTA.
   ═══════════════════════════════════════════════ */
export const MobileActionBar = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #ffffff;
    border-top: 1px solid #eef0f4;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -6px 24px rgba(0,0,0,0.08);
    z-index: 50;
  }
`;

export const MobilePrimaryBtn = styled.button`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 14px;
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;

  svg { font-size: 20px; }
`;

export const MobileSkip = styled.button`
  background: none;
  border: none;
  color: #6b7185;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: 8px;

  &:hover { color: #667eea; }
`;