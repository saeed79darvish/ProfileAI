// @ts-nocheck — styled-components transient ($) props are dynamic; TS strict typing adds no value here.
import styled, { keyframes, css } from 'styled-components';

/* The welcome intro, as it appears inside the coach transcript.
   
   It is one card that advances in place, not a card per slide: three stacked
   500px panels all repeating the same heading buried the conversation the
   intro exists to start. The mockups, gradient headline and feature box are
   the old /onboarding page's; the chrome around them is chat-native. */

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// Each slide arrives from the right, the way a carousel reads.
const slideSwap = keyframes`
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
`;

// One switch for everything decorative. Motion here is ornament — the card
// is perfectly legible without it.
const motionSafe = (rules) => css`
  @media (prefers-reduced-motion: no-preference) { ${rules} }
`;

/* ═══════════════════════════════════════════════
   CARD SHELL
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
  padding: 24px 26px 20px;
  box-shadow: 0 4px 20px rgba(26, 26, 46, 0.05);
  ${motionSafe(css`animation: ${slideIn} 320ms ease both;`)}

  @media (max-width: 560px) {
    margin-left: 0;
    max-width: 100%;
    padding: 18px 16px 16px;
    border-radius: 18px;
  }
`;

/* Holds the slide content. The min-height is what stops the card from
   jolting taller and shorter as slides of different lengths swap through
   it — the footer controls must not move under a finger mid-tap. */
export const SlideStage = styled.div`
  min-height: 246px;
  display: flex;
  align-items: center;
  ${motionSafe(css`animation: ${slideSwap} 300ms ease both;`)}

  @media (max-width: 1180px) {
    min-height: 0;
  }
`;

export const TwoColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 28px;
  width: 100%;

  /* The chat column caps at 720px, so side-by-side only earns its keep on a
     real desktop; below that the mockup drops under the copy. */
  @media (max-width: 1180px) {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }
`;

export const LeftCol = styled.div`
  flex: 1.15;
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

// "ProfilleAI can help you..." is the same on every slide, so it reads as a
// label rather than as a headline — which is what it is.
export const Eyebrow = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #9a9ab0;
  margin-bottom: 8px;
`;

export const IntroAccent = styled.h3`
  margin: 0 0 12px;
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;

  @media (max-width: 560px) {
    font-size: 1.3rem;
  }
`;

export const IntroBody = styled.p`
  margin: 0;
  font-size: 0.95rem;
  color: #6c6c86;
  line-height: 1.6;
`;

export const FeatureBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f7f8ff;
  border: 1px solid #eceefb;
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: 16px;

  @media (max-width: 560px) {
    padding: 12px 14px;
    border-radius: 12px;
  }
`;

export const FeatureBoxIcon = styled.div`
  font-size: 20px;
  line-height: 1.2;
`;

export const FeatureText = styled.p`
  margin: 0;
  font-size: 0.88rem;
  color: #55556e;
  line-height: 1.55;
`;

/* ═══════════════════════════════════════════════
   MOCKUPS
   ═══════════════════════════════════════════════ */

// No float animation: this card sits on screen for the whole intro, and a
// panel that never stops moving beside the text you are reading is noise.
export const MockupCard = styled.div`
  background: #fff;
  border: 1px solid #f0f0f6;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(102,126,234,0.10);
  width: 100%;
  max-width: 300px;

  @media (max-width: 1180px) {
    max-width: 100%;
  }

  @media (max-width: 560px) {
    padding: 14px;
    border-radius: 14px;
  }
`;

export const MockupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f2f2f7;
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
  padding: 4px 9px;
  border-radius: 6px;
  white-space: nowrap;
`;

export const MockBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 10.5px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 8px;
  white-space: nowrap;
`;

/* ═══════════════════════════════════════════════
   FOOTER: progress + actions
   ═══════════════════════════════════════════════ */

export const IntroFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #f2f2f7;

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
`;

export const DotsWrapper = styled.div`
  display: flex;
  gap: 7px;
  align-items: center;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

// A button, not a decoration: skimming ahead and back is the one thing
// people want from a carousel and the dots are where they reach for it.
export const Dot = styled.button`
  width: ${({ $active }) => ($active ? '22px' : '8px')};
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: ${({ $active }) => ($active
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : '#e0e0ea')};
  transition: width 0.3s ease, background 0.3s ease;

  &:hover { background: ${({ $active }) => ($active
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : '#c9c9d8')}; }
`;

export const FooterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 560px) {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 6px;
  }
`;

export const SkipLink = styled.button`
  background: none;
  border: none;
  color: #9a9ab0;
  font-size: 0.88rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 10px;

  &:hover { color: #6c6c86; background: #f6f6fb; }
`;

export const ContinueBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 12px 26px;
  font-size: 0.95rem;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(102,126,234,0.25);
  transition: box-shadow 0.25s ease, transform 0.25s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(102,126,234,0.38);
    transform: translateY(-1px);
  }

  @media (max-width: 560px) {
    width: 100%;
    padding: 14px 24px;
    font-size: 1rem;
  }
`;

/* ═══════════════════════════════════════════════
   THE BUILD-PROFILE CARD
   (what the two-card "where would you like to
   start?" fork collapsed to)
   ═══════════════════════════════════════════════ */

export const ChoiceWrap = styled.div`
  width: 100%;
  max-width: min(420px, calc(100% - 50px));
  margin-left: 50px;

  @media (max-width: 560px) {
    margin-left: 0;
    max-width: 100%;
  }
`;

export const ChoiceCard = styled.div`
  width: 100%;
  background: #fff;
  border: 1.5px solid #ececf3;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(26, 26, 46, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: ${({ $spent }) => ($spent ? 'default' : 'pointer')};
  transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
  ${motionSafe(css`animation: ${slideIn} 320ms ease both;`)}

  ${({ $spent }) => !$spent && css`
    &:hover {
      border-color: #a5aef5;
      transform: translateY(-3px);
      box-shadow: 0 14px 34px rgba(102,126,234,0.16);
    }
  `}

  @media (max-width: 560px) {
    border-radius: 18px;
  }
`;

export const ChoiceCardVisual = styled.div`
  height: 168px;
  background: linear-gradient(135deg, #667eea 0%, #5a67d8 50%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  @media (max-width: 560px) {
    height: 150px;
  }
`;

export const FloatingCard = styled.div`
  background: #fff;
  border-radius: 14px;
  padding: 15px 17px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.16);
  width: ${({ $w }) => $w || 'auto'};
  transform: rotate(-2deg);
`;

export const AiBadge = styled.div`
  position: absolute;
  bottom: 18px;
  right: 20px;
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
  padding: 20px 22px 22px;
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const ChoiceTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 1.08rem;
  font-weight: 700;
  color: #1a1a2e;
`;

export const ChoiceBody = styled.p`
  margin: 0 0 18px;
  font-size: 0.88rem;
  color: #6c6c86;
  line-height: 1.6;
`;

export const ChoiceButton = styled.button`
  width: 100%;
  padding: 13px 20px;
  border: none;
  border-radius: 12px;
  background: ${({ disabled }) => (disabled
    ? '#e6e6ef'
    : 'linear-gradient(135deg, #667eea, #764ba2)')};
  color: ${({ disabled }) => (disabled ? '#9a9ab0' : '#fff')};
  font-weight: 650;
  font-size: 0.95rem;
  font-family: inherit;
  margin-top: auto;
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  box-shadow: ${({ disabled }) => (disabled ? 'none' : '0 2px 10px rgba(102,126,234,0.25)')};
  transition: box-shadow 0.25s ease;
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
