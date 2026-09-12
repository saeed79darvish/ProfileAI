// @ts-nocheck — styled-components transient ($) props are dynamic; TS strict typing adds no value here.
import styled, { keyframes } from 'styled-components';

/* The intro visuals from the old standalone /onboarding page, re-cut to sit
   inside the coach transcript. The mockups, the feature box, the gradient
   choice card and their type scale are unchanged — only the page chrome
   (full-screen container, centred slide stage, sticky mobile action bar) is
   gone, because the chat already provides all three. */

export const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
`;

export const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(102,126,234,0.3); }
  50%      { box-shadow: 0 0 0 12px rgba(102,126,234,0); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ═══════════════════════════════════════════════
   CARD SHELL (takes the place of the slide stage)
   ═══════════════════════════════════════════════ */

// Aligns under the coach bubble, past the 38px avatar + 12px gap, exactly
// like ChipRow and the other in-chat cards.
export const IntroCard = styled.div`
  width: 100%;
  max-width: calc(100% - 50px);
  margin-left: 50px;
  background: #fff;
  border: 1px solid #ececf3;
  border-radius: 20px;
  padding: 26px 28px;
  box-shadow: 0 2px 14px rgba(26, 26, 46, 0.06);
  animation: ${slideIn} 320ms ease both;

  @media (max-width: 480px) {
    margin-left: 0;
    max-width: 100%;
    padding: 18px 16px;
    border-radius: 16px;
  }
`;

export const DotsWrapper = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;

  @media (max-width: 480px) {
    margin-bottom: 18px;
  }
`;

export const Dot = styled.div`
  width: ${({ $active }) => ($active ? '24px' : '8px')};
  height: 8px;
  border-radius: 4px;
  background: ${({ $active }) => ($active
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : '#ddd')};
  transition: all 0.35s ease;
`;

/* The chat column is at most 720px wide, so the side-by-side layout only
   earns its keep on a real desktop — below that the mockup drops under the
   copy rather than being squeezed to illegibility. */
export const TwoColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;

  @media (max-width: 1180px) {
    flex-direction: column;
    align-items: stretch;
    gap: 24px;
  }
`;

export const LeftCol = styled.div`
  flex: 1.1;
  min-width: 0;
`;

export const RightCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
`;

/* ═══════════════════════════════════════════════
   COPY
   ═══════════════════════════════════════════════ */

export const IntroHeading = styled.h3`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
  letter-spacing: -0.5px;

  @media (max-width: 480px) {
    font-size: 1.35rem;
  }
`;

export const IntroAccent = styled(IntroHeading)`
  margin-bottom: 14px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

export const IntroBody = styled.p`
  margin: 0;
  font-size: 0.97rem;
  color: #666;
  line-height: 1.6;
`;

export const FeatureBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fbfbfe;
  border: 1px solid #f0f0f6;
  border-radius: 14px;
  padding: 16px 18px;
  margin-top: 18px;

  @media (max-width: 480px) {
    padding: 14px;
    gap: 10px;
    margin-top: 14px;
    border-radius: 12px;
  }
`;

export const FeatureBoxIcon = styled.div`
  font-size: 22px;
  line-height: 1;
`;

export const FeatureText = styled.p`
  margin: 0;
  font-size: 0.9rem;
  color: #555;
  line-height: 1.55;
`;

/* ═══════════════════════════════════════════════
   MOCKUPS
   ═══════════════════════════════════════════════ */

export const MockupCard = styled.div`
  background: #fff;
  border: 1px solid #f0f0f6;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 8px 28px rgba(102,126,234,0.12);
  width: 100%;
  max-width: 340px;
  animation: ${float} 4s ease-in-out infinite;

  @media (max-width: 1180px) {
    max-width: 100%;
    animation: none;
  }

  @media (max-width: 480px) {
    padding: 16px;
    border-radius: 14px;
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
  height: ${({ $h }) => $h || '10px'};
  width: ${({ $w }) => $w || '100%'};
  border-radius: 5px;
  background: ${({ $color }) => $color || '#f0f2f5'};
  margin-bottom: ${({ $mb }) => $mb || '8px'};
`;

export const MockTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${({ $bg }) => $bg || 'rgba(102,126,234,0.08)'};
  color: ${({ $color }) => $color || '#667eea'};
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
`;

export const MockBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  white-space: nowrap;
`;

/* ═══════════════════════════════════════════════
   ACTIONS
   ═══════════════════════════════════════════════ */

export const IntroActions = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 22px;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 18px;
  }
`;

export const ContinueBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 13px 30px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  animation: ${pulse} 2.5s ease infinite;

  &:hover {
    box-shadow: 0 6px 20px rgba(102,126,234,0.4);
    transform: translateY(-1px);
  }

  @media (max-width: 480px) {
    width: 100%;
    padding: 15px 24px;
    font-size: 16px;
    animation: none;
  }
`;

export const SkipLink = styled.button`
  background: none;
  border: none;
  color: #999;
  font-size: 13.5px;
  font-family: inherit;
  cursor: pointer;
  padding: 6px 2px;

  &:hover { color: #667eea; }

  @media (max-width: 480px) {
    padding: 8px;
    font-size: 14px;
  }
`;

/* ═══════════════════════════════════════════════
   THE BUILD-PROFILE CARD
   (what the two-card "where would you like to
   start?" fork collapsed to)
   ═══════════════════════════════════════════════ */

// Aligns the dots + card under the coach bubble, past the avatar.
export const ChoiceWrap = styled.div`
  width: 100%;
  max-width: min(440px, calc(100% - 50px));
  margin-left: 50px;

  @media (max-width: 480px) {
    margin-left: 0;
    max-width: 100%;
  }
`;

export const ChoiceCard = styled.div`
  width: 100%;
  background: #fff;
  border: 2px solid transparent;
  border-radius: 20px;
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
  animation: ${slideIn} 320ms ease both;

  &:hover {
    border-color: #667eea;
    transform: translateY(-4px);
    box-shadow: 0 12px 36px rgba(102,126,234,0.18);
  }

  @media (max-width: 480px) {
    border-radius: 16px;
  }
`;

export const ChoiceCardVisual = styled.div`
  height: 190px;
  background: linear-gradient(135deg, #667eea 0%, #5a67d8 50%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  @media (max-width: 480px) {
    height: 165px;
  }
`;

export const FloatingCard = styled.div`
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  width: ${({ $w }) => $w || 'auto'};
  transform: rotate(-2deg);

  @media (max-width: 480px) {
    padding: 12px 14px;
    border-radius: 10px;
  }
`;

export const AiBadge = styled.div`
  position: absolute;
  bottom: 22px;
  right: 24px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 5px;
  background: #fff;
  border-radius: 10px;
  padding: 5px 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  font-size: 10px;
  font-weight: 700;
  color: #667eea;

  svg { font-size: 14px; }
`;

export const Blob = styled.div`
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,${({ $alpha }) => $alpha || 0.08});
  width: ${({ $size }) => $size || '120px'};
  height: ${({ $size }) => $size || '120px'};
  top: ${({ $top }) => $top || 'auto'};
  left: ${({ $left }) => $left || 'auto'};
  right: ${({ $right }) => $right || 'auto'};
  bottom: ${({ $bottom }) => $bottom || 'auto'};
`;

export const ChoiceCardBody = styled.div`
  padding: 22px 24px 24px;
  display: flex;
  flex-direction: column;
  flex: 1;

  @media (max-width: 480px) {
    padding: 18px 18px 20px;
  }
`;

export const ChoiceTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a1a2e;
`;

export const ChoiceBody = styled.p`
  margin: 0 0 20px;
  font-size: 0.88rem;
  color: #777;
  line-height: 1.6;
`;

export const ChoiceButton = styled.button`
  width: 100%;
  padding: 13px 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-weight: 600;
  font-size: 14.5px;
  font-family: inherit;
  margin-top: auto;
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    box-shadow: 0 6px 20px rgba(102,126,234,0.4);
    transform: translateY(-1px);
  }
`;

/* Skill pills and progress bar inside the floating profile card. */
export const MiniTag = styled.span`
  padding: 3px 8px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12));
  font-size: 10px;
  font-weight: 600;
  color: #667eea;
`;

export const MiniBar = styled.div`
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;

  > div {
    flex: 1;
    height: 5px;
    border-radius: 4px;
    background: #eee;
    overflow: hidden;
  }

  > div > i {
    display: block;
    width: 85%;
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, #667eea, #764ba2);
  }

  > span {
    font-size: 9.5px;
    font-weight: 700;
    color: #667eea;
  }
`;
