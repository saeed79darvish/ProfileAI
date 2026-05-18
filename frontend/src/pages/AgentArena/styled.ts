/* ================================================================
   ApplyPilot · styled-components
   Shared design primitives for the four Phase-0 tabs:
     1. Setup    (SetupPage)
     2. Inbox    (InboxPage + ReviewPage detail)
     3. Sent     (SentPage + SentDetailPage)
     4. Training (TrainingPage)
   Palette values are hard-coded here so nothing depends on CSS
   variables in the rest of the app.
   ================================================================ */

import styled, { keyframes, css } from 'styled-components';

/* ================================================================
   SHARED · palette helpers
   ================================================================ */
const brand50 = '#F2EEFF';
const brand100 = '#E4DBFF';
const brand200 = '#D0C0FF';
const brand300 = '#B8A3FF';
const brand400 = '#9A7EFF';
const brand500 = '#7C5CFF';
const brand600 = '#6D4AE8';
const brand700 = '#5938C9';
const ink900 = '#0E0B1F';
const ink700 = '#3A3552';
const ink500 = '#6B6787';
const ink400 = '#8A87A3';
const ink300 = '#BEBCD0';
const bg0 = '#FAFAFC';
const bg1 = '#F5F4F9';
const bg2 = '#EEEDF2';
const line = '#E9E7EF';
const lineStrong = '#D5D1E0';
const good50 = '#E5F9EE';
const good500 = '#1DA34A';
const good600 = '#128A3A';
const warn50 = '#FFF4E1';
const warn600 = '#B5730E';
const bad50 = '#FFEDEE';
const bad600 = '#C42B35';
const sh1 = '0 1px 2px rgba(16,12,40,.05)';
const sh2 = '0 4px 16px rgba(16,12,40,.04)';

/* ================================================================
   Animations
   ================================================================ */
export const pulseGreen = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,.5); }
  50% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
`;

export const trainPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

/* ================================================================
   SHELL
   ================================================================ */
export const Page = styled.div`
  min-height: calc(100vh - 70px);
  background: ${bg0};
  color: ${ink900};
`;

/* ----------------------------------------------------------------
   Shell · persistent sub-nav across every /applypilot/* route.
   Sits directly under the global Navbar (which is ~70px tall).
   ---------------------------------------------------------------- */
export const ArenaSubNav = styled.nav`
  position: sticky;
  top: 70px;
  z-index: 5;
  background: rgba(250, 250, 252, 0.92);
  backdrop-filter: saturate(150%) blur(8px);
  -webkit-backdrop-filter: saturate(150%) blur(8px);
  border-bottom: 1px solid ${line};

  /* Match the responsive Navbar heights so the sub-nav sits flush
     against the main top bar at every breakpoint. */
  @media (max-width: 899px) {
    top: 64px;
  }
  @media (max-width: 599px) {
    top: 56px;
  }

  @media (max-width: 1199px) {
    body.applypilot-focus & { display: none; }
  }
`;

/* ----------------------------------------------------------------
   Bottom-tab nav · mobile-only.
   Replaces the top sub-nav on phones with a fixed bottom-tab bar,
   the convention users expect on mobile apps.
   ---------------------------------------------------------------- */
export const ArenaBottomNav = styled.nav`
  display: none;

  @media (max-width: 1199px) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid ${line};
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 25;
    box-shadow: 0 -2px 12px rgba(16, 12, 40, 0.06);

    body.applypilot-focus & { display: none; }
  }
`;

export const ArenaBottomNavLink = styled.a<{ $active?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px 6px;
  min-height: 56px;
  text-decoration: none;
  color: ${p => (p.$active ? brand700 : ink500)};
  font-size: 11px;
  font-weight: 600;
  background: transparent;

  svg { width: 22px; height: 22px; }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: ${p => (p.$active ? '32px' : '0')};
    height: 2px;
    background: ${brand500};
    border-radius: 0 0 2px 2px;
    transition: width 0.15s;
  }
`;

export const ArenaBottomNavBadge = styled.span<{ $tone?: 'brand' | 'good' | 'neutral' }>`
  position: absolute;
  top: 4px;
  left: calc(50% + 6px);
  background: ${p => (p.$tone === 'good' ? good500 : brand500)};
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

export const ArenaSubNavInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 32px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: 1199px) {
    padding: 6px 12px;
  }
`;

export const ArenaNavBrand = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${ink900};
  letter-spacing: -0.01em;
  padding-right: 14px;
  margin-right: 10px;
  border-right: 1px solid ${line};
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${brand500};
    box-shadow: 0 0 0 3px ${brand100};
  }

  @media (max-width: 1199px) {
    display: none;
  }
`;

export const ArenaNavLink = styled.a<{ $active?: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: ${p => (p.$active ? ink900 : ink500)};
  background: ${p => (p.$active ? '#fff' : 'transparent')};
  border: 1px solid ${p => (p.$active ? line : 'transparent')};
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;

  &:hover {
    color: ${ink900};
    background: ${p => (p.$active ? '#fff' : bg2)};
  }
`;

export const ArenaNavCount = styled.span<{ $tone?: 'neutral' | 'warn' | 'good' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: ${p =>
    p.$tone === 'warn' ? warn50 : p.$tone === 'good' ? good50 : bg2};
  color: ${p =>
    p.$tone === 'warn' ? warn600 : p.$tone === 'good' ? good600 : ink500};
`;

export const ArenaNavSpacer = styled.div`
  flex: 1;
`;

/* ----------------------------------------------------------------
   Shell · generic page container for the simpler list screens
   (Sent, Needs attention) that don't need the purple hero.
   ---------------------------------------------------------------- */
export const ArenaSimplePage = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 22px 32px 40px;

  @media (max-width: 1199px) {
    padding: 18px 16px 40px;
  }
`;

export const ArenaPageHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h1 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: ${ink900};
  }
  p {
    margin: 0;
    font-size: 13.5px;
    color: ${ink500};
    max-width: 640px;
  }

  @media (max-width: 1199px) {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;

    h1 { font-size: 20px; }
  }
`;

export const ArenaPageHeaderActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 1199px) {
    flex-wrap: wrap;
    width: 100%;
    > * { flex: 1 1 auto; }
  }
`;

export const EmptyState = styled.div`
  background: #fff;
  border: 1px dashed ${lineStrong};
  border-radius: 14px;
  padding: 48px 28px;
  text-align: center;
  color: ${ink500};
  font-size: 14px;
  box-shadow: ${sh2};

  h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 700;
    color: ${ink900};
  }
  p {
    margin: 0 auto;
    max-width: 440px;
    line-height: 1.55;
  }
`;

export const SentListCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 14px;
  overflow: hidden;
  box-shadow: ${sh2};
`;

export const SentRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px 160px 140px;
  gap: 16px;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid ${line};
  font-size: 13.5px;

  &:last-child { border-bottom: none; }

  .company {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .role {
    font-weight: 600;
    color: ${ink900};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 12px;
    color: ${ink500};
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    font-size: 12px;
    color: ${ink500};
  }
  .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  @media (max-width: 1199px) {
    grid-template-columns: 1fr auto;
    .when, .match { display: none; }
  }
`;

export const StatusChip = styled.span<{
  $tone?: 'good' | 'warn' | 'bad' | 'neutral' | 'brand';
}>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 999px;
  white-space: nowrap;
  background: ${p =>
    p.$tone === 'good' ? good50 :
    p.$tone === 'warn' ? warn50 :
    p.$tone === 'bad' ? bad50 :
    p.$tone === 'brand' ? brand50 :
    bg2};
  color: ${p =>
    p.$tone === 'good' ? good600 :
    p.$tone === 'warn' ? warn600 :
    p.$tone === 'bad' ? bad600 :
    p.$tone === 'brand' ? brand700 :
    ink700};
`;

/* ================================================================
   SHARED · Buttons (faithful to prototype .btn)
   ================================================================ */
export const Btn = styled.button<{
  $variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'dark' | 'pauseLight';
  $size?: 'sm' | 'md' | 'big';
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${line};
  background: #fff;
  color: ${ink900};
  font-family: inherit;
  transition: background 0.12s, transform 0.05s, border-color 0.12s;
  white-space: nowrap;

  &:hover { background: ${bg1}; }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }

  svg { width: 14px; height: 14px; }

  ${p =>
    p.$size === 'sm' &&
    css`
      padding: 6px 11px;
      font-size: 12px;
      border-radius: 8px;

      @media (max-width: 1199px) {
        min-height: 44px;
        padding: 8px 14px;
        font-size: 13px;
        border-radius: 10px;
      }
    `}

  ${p =>
    p.$size === 'big' &&
    css`
      padding: 13px 22px;
      font-size: 14px;
    `}

  ${p =>
    p.$variant === 'primary' &&
    css`
      background: ${brand500};
      color: #fff;
      border-color: ${brand500};
      box-shadow: 0 2px 10px rgba(124, 92, 255, 0.3);
      &:hover { background: ${brand600}; }
    `}

  ${p =>
    p.$variant === 'ghost' &&
    css`
      background: transparent;
      border-color: transparent;
      color: ${ink700};
      &:hover { background: ${bg2}; }
    `}

  ${p =>
    p.$variant === 'danger' &&
    css`
      background: #fff;
      border-color: ${bad600};
      color: ${bad600};
      &:hover { background: ${bad50}; }
    `}

  ${p =>
    p.$variant === 'dark' &&
    css`
      background: ${ink900};
      color: #fff;
      border-color: ${ink900};
      &:hover { background: #1c1833; }
    `}

  ${p =>
    p.$variant === 'pauseLight' &&
    css`
      background: #fff;
      color: ${brand700};
      border-color: #fff;
      &:hover { background: #f4f0ff; }
    `}
`;

export const Kbd = styled.span`
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  background: ${bg2};
  border: 1px solid ${line};
  color: ${ink500};
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 6px;
`;

/* ================================================================
   SHARED · Hero (used on Setup & Dashboard)
   ================================================================ */
export const ArenaHero = styled.section`
  margin: 24px 36px;
  background: linear-gradient(135deg, #2a1b66 0%, #15093e 60%, #0a0528 100%);
  border-radius: 20px;
  padding: 40px 44px;
  color: #fff;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -40%;
    right: -5%;
    width: 440px;
    height: 440px;
    background: radial-gradient(
      circle,
      rgba(167, 139, 250, 0.35),
      transparent 70%
    );
  }

  @media (max-width: 1199px) {
    margin: 16px 16px;
    padding: 28px 22px;
    border-radius: 16px;
  }
`;

export const HeroInner = styled.div`
  position: relative;
  z-index: 1;
  max-width: 640px;
`;

export const ProBadgeLg = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 236, 186, 0.15);
  color: #ffebb4;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 236, 186, 0.3);
`;

export const HeroTitle = styled.h1`
  margin: 12px 0 10px;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;

  b { color: #a78bfa; font-weight: 700; }

  @media (max-width: 1199px) {
    font-size: 24px;
  }
`;

export const HeroText = styled.p`
  margin: 0;
  font-size: 15px;
  opacity: 0.78;
  line-height: 1.55;

  @media (max-width: 1199px) {
    font-size: 13.5px;
  }
`;

export const ArenaStatus = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4ade80;
  margin-bottom: 14px;
`;

export const PulseGreen = styled.span`
  width: 10px;
  height: 10px;
  background: #4ade80;
  border-radius: 50%;
  animation: ${pulseGreen} 2s infinite;
`;

export const ArenaControls = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 24px;
  flex-wrap: wrap;
`;

/**
 * Glass-style secondary button for use inside the dark ArenaHero
 * (e.g. "Criteria & rules", "Weekly digest"). Kept separate from the
 * default `Btn` so we don't accidentally restyle primary/danger CTAs.
 */
export const HeroGlassBtn = styled.button<{ $size?: 'sm' | 'md' | 'big' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  transition: background 0.12s;
  white-space: nowrap;

  &:hover { background: rgba(255, 255, 255, 0.18); }
  svg { width: 14px; height: 14px; }

  ${p =>
    p.$size === 'sm' &&
    css`
      padding: 6px 11px;
      font-size: 12px;
      border-radius: 8px;
    `}
`;

/* ================================================================
   SETUP PAGE
   ================================================================ */
export const SetupCards = styled.div`
  margin: 0 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (max-width: 1199px) {
    margin: 0 16px;
  }
`;

export const WizardCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 16px;
  padding: 26px 30px;
  box-shadow: ${sh1};

  @media (max-width: 1199px) {
    padding: 20px 18px;
  }
`;

export const WcNum = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${brand50};
  color: ${brand700};
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 15px;
`;

export const WcContent = styled.div`
  min-width: 0;

  h3 {
    margin: 2px 0 4px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  > p {
    margin: 0 0 16px;
    font-size: 13px;
    color: ${ink500};
    line-height: 1.5;
  }
`;

export const Pill = styled.span<{ $tone?: 'brand' | 'good' }>`
  margin-left: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 5px;

  ${p =>
    p.$tone === 'good'
      ? css`
          color: ${good600};
          background: ${good50};
        `
      : css`
          color: ${brand700};
          background: ${brand50};
        `}
`;

/* Train-topic tiles on the first wizard card */
export const TrainTopicGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 14px;

  @media (max-width: 1199px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const TrainTopicTile = styled.div<{
  $variant: 'motive' | 'stories' | 'values' | 'limits' | 'voice';
}>`
  border-radius: 10px;
  padding: 12px 10px;
  text-align: center;
  border: 1px solid ${line};
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: auto;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  .ico { font-size: 18px; margin-bottom: 4px; }
  .name { font-size: 12px; font-weight: 700; }
  .count { font-size: 10.5px; color: ${ink500}; margin-top: 2px; }

  ${p => {
    switch (p.$variant) {
      case 'motive':
        return css`
          background: ${brand50};
          border-color: ${brand100};
          .name { color: ${brand700}; }

          &:hover {
            background: ${brand100};
            border-color: ${brand100};
          }
        `;
      case 'stories':
        return css`
          background: #fef3d4;
          border-color: #f5e3a8;
          .name { color: #8a5900; }

          &:hover {
            background: #fde9b3;
            border-color: #f5d980;
          }
        `;
      case 'values':
        return css`
          background: #e6f6ee;
          border-color: #bee8cd;
          .name { color: ${good600}; }

          &:hover {
            background: #d4f0e4;
            border-color: #a8ddb8;
          }
        `;
      case 'limits':
        return css`
          background: #fdecec;
          border-color: #f8cbce;
          .name { color: ${bad600}; }

          &:hover {
            background: #fdd9db;
            border-color: #f2b3b7;
          }
        `;
      case 'voice':
      default:
        return css`
          background: #e9f1fd;
          border-color: #c2d7f4;
          .name { color: #2e6bd6; }

          &:hover {
            background: #d6e8fc;
            border-color: #a8c8f0;
          }
        `;
    }
  }}
`;

export const CoachCta = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #fbfafe;
  border: 1px solid ${line};
  border-radius: 10px;

  .ava {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, ${brand500}, ${brand700});
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 800;
    box-shadow: 0 3px 10px rgba(124, 92, 255, 0.35);
    flex: 0 0 auto;
  }

  .body { flex: 1; min-width: 0; }
  .title { font-size: 13px; font-weight: 700; }
  .sub { font-size: 12px; color: ${ink500}; margin-top: 2px; }

  @media (max-width: 640px) {
    flex-wrap: wrap;
  }
`;

/* --- criteria rails --- */
export const Rails = styled.div`
  display: flex;
  flex-direction: column;
`;

export const RailRow = styled.div`
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid ${line};

  &:last-child { border-bottom: 0; padding-bottom: 0; }
  &:first-child { padding-top: 0; }

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
    gap: 8px;
    align-items: flex-start;
  }
`;

export const RailLabel = styled.div`
  font-size: 13px;
  color: ${ink900};
  font-weight: 600;
`;

export const RailSub = styled.div`
  font-size: 11.5px;
  color: ${ink500};
  margin-top: 2px;
`;

export const RailValue = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 14px;
`;

export const CriteriaChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const CritChip = styled.span<{ $neutral?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  background: ${brand50};
  color: ${brand700};
  border: 1px solid ${brand100};

  .x {
    color: ${brand600};
    opacity: 0.55;
    cursor: pointer;
    font-weight: 700;
  }

  ${p =>
    p.$neutral &&
    css`
      background: ${bg1};
      color: ${ink700};
      border-color: ${line};
      .x { color: ${ink500}; }
    `}
`;

export const CritAdd = styled.button`
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px dashed ${lineStrong};
  background: transparent;
  color: ${ink500};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    color: ${brand600};
    border-color: ${brand500};
  }
`;

/**
 * Inline pill input shown in place of CritAdd while the user is typing
 * a new chip value. Matches the CritChip silhouette so the row doesn't
 * jump when toggling between button and input.
 */
export const CritAddInput = styled.input`
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid ${brand500};
  background: ${bg1};
  color: ${ink700};
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  min-width: 140px;
  outline: none;

  &::placeholder {
    color: ${ink500};
  }
  &:focus {
    box-shadow: 0 0 0 3px ${brand100};
  }
`;

export const DemoSelect = styled.select`
  padding: 7px 13px;
  border-radius: 10px;
  border: 1px solid ${lineStrong};
  background: #fff;
  color: ${ink900};
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  min-width: 180px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${brand500};
    box-shadow: 0 0 0 3px ${brand100};
  }
`;

export const Stepper = styled.div`
  display: inline-flex;
  align-items: center;
  background: ${bg1};
  border-radius: 9px;
  padding: 3px;
  gap: 2px;

  button {
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
    color: ${ink700};
    font-family: inherit;
    font-size: 14px;

    &:hover { background: #fff; }
  }

  .val {
    padding: 0 14px;
    font-size: 14px;
    font-weight: 700;
  }
`;

export const ToggleSwitch = styled.button<{ $on?: boolean }>`
  width: 36px;
  height: 20px;
  background: ${p => (p.$on ? brand500 : bg2)};
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  border: 0;
  padding: 0;
  transition: background 0.15s;

  &::after {
    content: '';
    position: absolute;
    left: ${p => (p.$on ? 18 : 2)}px;
    top: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    transition: left 0.15s;
  }
`;

/* --- approval mode --- */
export const ApprovalGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const ApprovalCard = styled.button<{ $on?: boolean }>`
  text-align: left;
  border: 1px solid ${line};
  border-radius: 12px;
  padding: 18px;
  cursor: pointer;
  position: relative;
  background: #fff;
  font-family: inherit;
  color: inherit;
  transition: all 0.12s;

  ${p =>
    p.$on &&
    css`
      border-color: ${brand500};
      box-shadow: 0 0 0 3px ${brand50};
    `}

  .ac-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: ${brand50};
    color: ${brand600};
    display: grid;
    place-items: center;
    margin-bottom: 10px;
  }
  .ac-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .ac-desc { font-size: 12.5px; color: ${ink500}; line-height: 1.5; }
  .ac-tag {
    position: absolute;
    top: 14px;
    right: 14px;
    font-size: 10px;
    font-weight: 700;
    background: ${brand500};
    color: #fff;
    padding: 2px 8px;
    border-radius: 999px;
  }
`;

/* --- setup footer --- */
export const SetupFooter = styled.div`
  margin: 26px 36px 30px;
  padding-top: 22px;
  border-top: 1px solid ${line};
  display: flex;
  align-items: center;
  gap: 12px;

  .summary-text {
    font-size: 13px;
    color: ${ink500};
    b { color: ${ink900}; font-weight: 600; }
  }

  .right-actions {
    margin-left: auto;
    display: flex;
    gap: 10px;
  }

  @media (max-width: 1199px) {
    position: sticky;
    bottom: 0;
    background: #fff;
    margin: 16px 0 0;
    padding: 12px 16px;
    border-top: 1px solid ${line};
    box-shadow: 0 -4px 16px rgba(16, 12, 40, 0.04);
    z-index: 5;

    .summary-text { display: none; }
    .right-actions {
      margin-left: 0;
      width: 100%;
      button { flex: 1; }
    }
  }
`;

/* ================================================================
   DASHBOARD PAGE
   ================================================================ */
export const ArenaStats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 0 36px 22px;

  @media (max-width: 1199px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 1199px) {
    margin: 0 16px 16px;
  }
`;

export const Stat = styled.div<{ $key: 'queue' | 'applied' | 'replies' | 'interviews'; $clickable?: boolean }>`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 14px;
  padding: 20px 22px;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  transition: all 0.12s ease;

  ${p => p.$clickable && css`
    &:hover {
      border-color: ${brand300};
      background: ${brand50};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(124, 92, 255, 0.12);
    }
    &:active {
      transform: translateY(0);
    }
  `}

  .label {
    font-size: 12px;
    font-weight: 600;
    color: ${ink500};
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .label .i {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: grid;
    place-items: center;
  }
  .value {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-top: 6px;
  }
  .change {
    font-size: 11.5px;
    color: ${good600};
    font-weight: 600;
    margin-top: 2px;
  }

  ${p => {
    switch (p.$key) {
      case 'queue':
        return css`
          .label .i { background: ${warn50}; color: ${warn600}; }
          .value { color: ${warn600}; }
        `;
      case 'applied':
        return css`
          .label .i { background: ${brand50}; color: ${brand700}; }
        `;
      case 'replies':
        return css`
          .label .i { background: ${good50}; color: ${good600}; }
        `;
      case 'interviews':
      default:
        return css`
          .label .i { background: #ebf4ff; color: #1c5cd8; }
          .change { color: #1c5cd8; }
        `;
    }
  }}
`;

export const ArenaGrid = styled.div`
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 16px;
  margin: 0 36px 36px;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 1199px) {
    margin: 0 16px 24px;
  }
`;

export const QueueCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 14px;
  overflow: hidden;
`;

export const TableHead = styled.div`
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid ${line};
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

export const BadgeRed = styled.span`
  background: ${bad600};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
`;

export const TableWrap = styled.div`
  overflow-x: auto;
`;

export const QueueTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 12px 20px;
    text-align: left;
    font-size: 13px;
    border-bottom: 1px solid ${line};
  }
  th {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${ink500};
    background: ${bg1};
  }
  td .comp {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  td .comp .j-title-t {
    font-weight: 600;
    color: ${ink900};
    font-size: 13.5px;
  }
  td .comp .j-sub-t {
    font-size: 11.5px;
    color: ${ink500};
  }
  td .prep {
    display: flex;
    gap: 4px;
    font-size: 11px;
  }
  td .prep .p-ok {
    color: ${good600};
    background: ${good50};
    padding: 2px 7px;
    border-radius: 5px;
    font-weight: 600;
  }
  tr:hover { background: ${bg1}; }
  tr:last-child td { border-bottom: 0; }

  @media (max-width: 1199px) {
    th, td { padding: 10px 14px; }
  }
`;

export const MatchBadge = styled.span<{ $fair?: boolean }>`
  background: ${p => (p.$fair ? '#FFF8E1' : good50)};
  color: ${p => (p.$fair ? '#B58B00' : good600)};
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  display: inline-block;
`;

export const CompLogo = styled.div<{ $key?: string; $size?: number }>`
  width: ${p => p.$size ?? 32}px;
  height: ${p => p.$size ?? 32}px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  font-size: ${p => (p.$size && p.$size > 40 ? 18 : 12)}px;
  flex-shrink: 0;
  background: ${bg2};

  ${p =>
    p.$key === 'stripe' &&
    css`background: #635BFF;`}
  ${p =>
    p.$key === 'linear' &&
    css`background: #5E6AD2;`}
  ${p =>
    p.$key === 'vercel' &&
    css`background: #000;`}
  ${p =>
    p.$key === 'shopify' &&
    css`background: #95BF47;`}
  ${p =>
    p.$key === 'figma' &&
    css`background: #000;`}
  ${p =>
    p.$key === 'notion' &&
    css`background: #000;`}
  ${p =>
    p.$key === 'openai' &&
    css`background: #10A37F;`}
  ${p =>
    p.$key === 'meta' &&
    css`background: #1877F2;`}
`;

export const ActivityCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 14px;
  padding: 18px 20px;

  h3 {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 700;
  }
`;

export const ActivityList = styled.div`
  position: relative;
  padding-left: 18px;

  &::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: ${line};
  }
`;

export const ActItem = styled.div<{ $live?: boolean }>`
  position: relative;
  padding: 10px 0;

  &::before {
    content: '';
    position: absolute;
    left: -18px;
    top: 15px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${p => (p.$live ? good500 : bg2)};
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px ${line};
    ${p => p.$live && css`animation: ${pulseGreen} 2s infinite;`}
  }

  .a-title { font-size: 13px; font-weight: 600; }
  .a-sub { font-size: 12px; color: ${ink500}; margin-top: 2px; }
  .a-time { font-size: 11px; color: ${ink400}; margin-top: 2px; }
`;

/* ================================================================
   REVIEW PAGE
   ================================================================ */
export const ReviewShell = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  background: ${bg1};
`;

export const ReviewHead = styled.div`
  padding: 18px 36px;
  border-bottom: 1px solid ${line};
  background: #fff;
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 10;

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }

  h1 .hd-mobile-text { display: none; }

  @media (max-width: 1199px) {
    padding: 10px 14px 8px;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;

    h1 {
      font-size: 15px;
      font-weight: 700;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    h1 .hd-desktop-text { display: none; }
    h1 .hd-mobile-text { display: inline; }

    body.applypilot-focus & { display: none; }
  }
`;

export const BackButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid ${line};
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: ${ink700};
  flex-shrink: 0;

  &:hover { background: ${bg1}; }
  svg { width: 16px; height: 16px; }

  @media (max-width: 1199px) {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border-color: transparent;
    background: transparent;
    svg { width: 18px; height: 18px; }
  }
`;

export const ReviewProgress = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: ${ink500};

  .bar {
    width: 180px;
    height: 6px;
    background: ${bg2};
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: ${brand500};
    border-radius: 999px;
    transition: width 0.2s;
  }

  /* Mobile: hoist the children directly into ReviewHead via display:contents
     so the "N of M" count sits on the title row (right side), and the
     thin progress bar drops to a full-width row below. The verbose
     breakdown (✓ approved · ✗ rejected · remaining) is dropped, those
     numbers are visible in the queue list and don't need to live in the
     header chrome. */
  @media (max-width: 1199px) {
    display: contents;

    .verbose-counts { display: none; }
    .summary-count {
      flex: 0 0 auto;
      font-size: 13px;
      font-weight: 600;
      color: ${ink500};
      white-space: nowrap;
      margin-left: auto;
      order: 1;
    }
    .summary-count b { color: ${ink900}; font-weight: 700; }

    .bar {
      flex: 1 1 100%;
      width: 100%;
      height: 4px;
      order: 3;
    }
  }
`;

export const HeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  @media (max-width: 1199px) {
    /* Hide the bulk-approve / preparing label entirely on mobile, the
       "N of M" counter in ReviewProgress already conveys remaining work,
       and the chrome budget is too tight for an extra button. */
    display: none;
  }
`;

export const ReviewBody = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  overflow: hidden;
  min-height: 0;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }
`;

export const ReviewQueue = styled.aside<{ $hideOnMobile?: boolean }>`
  background: #fff;
  border-right: 1px solid ${line};
  overflow-y: auto;

  @media (max-width: 1199px) {
    border-right: 0;
    display: ${p => (p.$hideOnMobile ? 'none' : 'block')};

    body.applypilot-focus & { display: none; }
  }
`;

export const QueueHeadR = styled.div`
  padding: 14px 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${ink500};
  border-bottom: 1px solid ${line};
  background: #fff;
  position: sticky;
  top: 0;
`;

export const QueueItemR = styled.button<{ $selected?: boolean }>`
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  font-family: inherit;
  padding: 14px 20px;
  border-bottom: 1px solid ${line};
  cursor: pointer;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: flex-start;

  &:hover { background: ${bg1}; }

  ${p =>
    p.$selected &&
    css`
      background: ${brand50};
      border-left: 3px solid ${brand500};
      padding-left: 17px;
    `}

  .q-title { font-size: 13px; font-weight: 600; color: ${ink900}; }
  .q-sub { font-size: 11.5px; color: ${ink500}; margin-top: 2px; }
  .q-state-approved { margin-top: 4px; font-size: 10.5px; color: ${good600}; font-weight: 600; }
  .q-state-rejected { margin-top: 4px; font-size: 10.5px; color: ${ink500}; }
  .q-ready { margin-top: 6px; display: flex; gap: 3px; }
  .q-ready .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${good500};
  }
`;

export const ReviewDetail = styled.section<{ $showOnMobile?: boolean }>`
  background: ${bg1};
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 1199px) {
    display: ${p => (p.$showOnMobile ? 'flex' : 'none')};
  }
`;

export const ReviewDetailHead = styled.div`
  padding: 24px 32px 0;
  background: #fff;
  border-bottom: 1px solid ${line};

  @media (max-width: 1199px) { padding: 18px 18px 0; }
`;

export const ReviewHero = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
  align-items: flex-start;

  .r-title { flex: 1; min-width: 0; }
  .r-title h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .r-title p {
    margin: 2px 0 0;
    font-size: 13px;
    color: ${ink500};
  }
  .r-skills { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }

  .r-match { text-align: right; }
  .r-match .m-pct {
    font-size: 28px;
    font-weight: 800;
    color: ${brand700};
  }
  .r-match .m-lab {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${ink500};
  }

  @media (max-width: 1199px) {
    /* Self-contained card. Use CSS grid with fixed column tracks so logo +
       title + donut always share row 1, and skills always span row 2.
       Flex-wrap fails here because long titles demand their full content
       width and push the donut to its own row. */
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 56px;
    grid-template-rows: auto auto;
    column-gap: 12px;
    row-gap: 10px;
    align-items: center;

    background: #fff;
    border: 1px solid ${line};
    border-radius: 14px;
    padding: 14px;
    box-shadow: 0 1px 2px rgba(16, 12, 40, 0.04);
    margin-bottom: 14px;

    /* Logo (CompLogo, the first child): row 1 / col 1. Force size since
       CompLogo accepts a $size prop the desktop layout uses. */
    > :first-child {
      grid-row: 1;
      grid-column: 1;
      width: 40px !important;
      height: 40px !important;
      align-self: center;
      font-size: 16px !important;
    }

    .r-title {
      grid-row: 1;
      grid-column: 2;
      min-width: 0;
    }
    .r-title h2 {
      font-size: 14.5px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .r-title p {
      font-size: 12px;
      margin-top: 2px;
      color: ${ink500};
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Circular match donut: row 1 / col 3. */
    .r-match {
      grid-row: 1;
      grid-column: 3;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      padding: 0;
      background:
        conic-gradient(${brand500} var(--match-deg, 270deg), ${bg2} 0);
      display: grid;
      place-items: center;
      position: relative;
      text-align: center;
    }
    .r-match::before {
      content: '';
      position: absolute;
      inset: 4px;
      background: #fff;
      border-radius: 50%;
    }
    .r-match .m-pct {
      position: relative;
      font-size: 12.5px;
      font-weight: 800;
      color: ${ink900};
      line-height: 1;
    }
    .r-match .m-lab {
      position: relative;
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${ink500};
      margin-top: 2px;
    }

    /* Skills row spans the full grid width below. */
    .r-skills {
      grid-row: 2;
      grid-column: 1 / -1;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
      padding-top: 10px;
      padding-bottom: 2px;
      border-top: 1px dashed ${line};
      -webkit-overflow-scrolling: touch;
    }
    .r-skills > * { flex: 0 0 auto; }

    /* Empty state (no logo / no match donut, only .r-title): collapse the
       3-column grid so the title + body text + button can use the full
       card width instead of being squeezed into the middle 1fr track. */
    &:not(:has(.r-match)) {
      grid-template-columns: 1fr;
    }
    &:not(:has(.r-match)) .r-title {
      grid-column: 1 / -1;
    }
    &:not(:has(.r-match)) .r-title h2,
    &:not(:has(.r-match)) .r-title p {
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      display: block;
      -webkit-line-clamp: unset;
      -webkit-box-orient: unset;
    }

    body.applypilot-focus & { display: none; }
  }
`;

export const SkillToken = styled.span<{ $have?: boolean; $missing?: boolean; $fit?: boolean }>`
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 6px;
  background: ${bg1};
  color: ${ink700};
  border: 1px solid ${line};

  ${p =>
    p.$have &&
    css`
      background: ${good50};
      color: ${good600};
      border-color: ${good50};
    `}
  ${p =>
    p.$missing &&
    css`
      background: ${bad50};
      color: ${bad600};
      border-color: ${bad50};
    `}
  ${p =>
    p.$fit &&
    css`
      background: ${brand50};
      color: ${brand700};
      border-color: ${brand50};
    `}
`;

export const ReviewTabs = styled.div`
  display: flex;
  gap: 2px;
  padding: 0 32px;
  background: #fff;
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid ${line};
  box-shadow: 0 6px 12px rgba(16, 12, 40, 0.04);

  @media (max-width: 1199px) {
    padding: 0 12px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
    /* Right-edge fade affordance signals there's more to scroll. Pinned to
       the scroll container with a sticky pseudo so it doesn't scroll away. */
    &::after {
      content: '';
      position: sticky;
      right: 0;
      top: 0;
      align-self: stretch;
      width: 28px;
      margin-left: -28px;
      flex: 0 0 28px;
      pointer-events: none;
      background: linear-gradient(to right, rgba(255,255,255,0), #fff 70%);
    }
  }
`;

export const RTab = styled.button<{ $on?: boolean }>`
  padding: 12px 16px;
  min-height: 44px;
  font-size: 13px;
  font-weight: 600;
  color: ${p => (p.$on ? brand700 : ink500)};
  cursor: pointer;
  border: 0;
  background: transparent;
  font-family: inherit;
  border-bottom: 2px solid ${p => (p.$on ? brand500 : 'transparent')};
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;

  .ok {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${good500};
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 9px;
    font-weight: 800;
  }

  .pending {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    color: ${ink500};
    background: ${bg2};
    border: 1px solid ${line};
    padding: 2px 6px;
    border-radius: 999px;
    line-height: 1;
  }

  /* Mobile: tabs become rounded pill buttons. Active = black filled pill;
     inactive = outlined white pill with a colored leading dot conveying
     ready vs preparing. */
  @media (max-width: 1199px) {
    border-bottom: 0;
    padding: 8px 14px;
    margin-right: 6px;
    min-height: 40px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    color: ${ink700};
    font-size: 13px;
    font-weight: 600;
    gap: 8px;

    ${p => p.$on && css`
      background: ${ink900};
      border-color: ${ink900};
      color: #fff;
    `}

    .pending {
      width: 8px;
      height: 8px;
      padding: 0;
      gap: 0;
      border-radius: 50%;
      background: #F4B23A;
      border: 0;
      font-size: 0;
      color: transparent;
      flex-shrink: 0;
    }
    .ok {
      width: 8px;
      height: 8px;
      font-size: 0;
      color: transparent;
      background: ${good500};
    }
    ${p => p.$on && css`
      .ok { background: #fff; }
      .pending { background: #fff; }
    `}
  }
`;

export const ReviewContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 32px;
  position: relative;
  z-index: 0;

  @media (max-width: 1199px) {
    /* Reserve room for the fixed bottom action bar (~70px + safe-area). */
    padding: 14px 14px calc(82px + env(safe-area-inset-bottom));
  }
`;

export const PreparingBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: ${brand50};
  border: 1px solid ${brand100};
  border-radius: 12px;
  font-size: 13px;
  color: ${brand700};
  font-weight: 600;

  .pb-spin {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid ${brand500};
    border-top-color: transparent;
    animation: pb-spin 0.9s linear infinite;
  }
  .pb-text { flex: 1; min-width: 0; }
  .pb-eta { opacity: 0.7; font-weight: 500; margin-left: 4px; }

  @keyframes pb-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/* Focus-mode compact header, appears on mobile when the user taps
   "Open full ↗" on the resume panel. Replaces the verbose ReviewHero
   card with a one-liner: back · "Company · Role" / "Reviewing N of M"
   · match%. */
export const FocusHeader = styled.div`
  display: none;

  body.applypilot-focus & {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #fff;
    border-bottom: 1px solid ${line};
    position: sticky;
    top: 0;
    z-index: 12;

    .fh-back {
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid ${line};
      background: #fff;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: ${ink700};
      svg { width: 18px; height: 18px; }
    }

    .fh-title {
      flex: 1;
      min-width: 0;
    }
    .fh-line1 {
      font-size: 14px;
      font-weight: 700;
      color: ${ink900};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.25;
    }
    .fh-line2 {
      font-size: 12px;
      color: ${ink500};
      margin-top: 2px;
    }

    .fh-match {
      flex-shrink: 0;
      background: ${brand50};
      color: ${brand700};
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 800;
    }
  }
`;

export const ReviewPanel = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 14px;
  padding: 22px 26px;

  .open-full-mobile { display: none; }

  /* Hide the "Open full resume" CTA on desktop \u2014 the embedded resume
     panel is already large enough; users can scroll directly. The
     button is still rendered (and visible) on mobile, where it switches
     to focus-mode to escape the cramped tab layout. */
  .open-full-action { display: none; }

  @media (max-width: 1199px) {
    /* Transparent shell on mobile, the toolbar (Final/Changes + Open
       full) sits directly on the page background, and the resume below
       carries its own card via ResumeShell. */
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;

    /* Drop the resume toolbar (Final/Changes toggle + Open full link)
       on mobile, the active tab pill already conveys the view, and the
       toolbar overflows the panel edge on narrow screens. */
    .panel-toolbar { display: none; }

    /* The active tab name already conveys "Tailored resume / Cover letter /
       etc.", drop the duplicate panel header on mobile, keep just the
       toolbar actions (Final/Changes toggle, Open full link). */
    .panel-title, .panel-subtitle { display: none; }
    .panel-toolbar { margin-bottom: 12px; gap: 8px; }
    .panel-toolbar-actions {
      margin-left: auto;
      width: auto;
      gap: 10px;
      flex-wrap: nowrap;
    }

    .open-full-mobile { display: inline; }
    .open-full-desktop { display: none; }

    /* Reduce visual weight on mobile, Download PDF hides; Open full
       collapses to a borderless brand text link with arrow. */
    .download-pdf-action { display: none; }
    .open-full-action {
      display: inline-flex;
      background: transparent;
      border: 0;
      color: ${brand700};
      padding: 0 4px;
      min-height: 0;
      box-shadow: none;
      font-weight: 700;
    }

    body.applypilot-focus & .panel-toolbar { display: none !important; }
  }
`;

export const DiffLine = styled.div<{ $kind: 'del' | 'add' | 'note' }>`
  font-size: 13px;
  line-height: 1.65;
  padding: 3px 6px;
  border-radius: 4px;
  margin: 2px 0;

  ${p =>
    p.$kind === 'del' &&
    css`
      background: ${bad50};
      color: ${bad600};
      text-decoration: line-through;
    `}
  ${p =>
    p.$kind === 'add' &&
    css`
      background: ${good50};
      color: ${good600};
    `}
`;

export const ReviewSectionTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${ink500};
  margin: 16px 0 8px;
`;

export const ReviewFooter = styled.div`
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid ${line};
  padding: 16px 32px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -4px 16px rgba(16, 12, 40, 0.04);
  flex-wrap: wrap;

  .left { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .right {
    margin-left: auto;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .more-menu-wrap { display: none; position: relative; }
  .desktop-only-action { display: inline-flex; }
  .footer-status { font-size: 12px; }

  /* Mobile: full-width action bar pinned to the bottom of the viewport.
     Exactly three controls, Reject (icon), Edit (pencil + label), Approve
     & send (primary, fills remaining width). Class-based hide/show so we
     don't depend on child order. */
  @media (max-width: 1199px) {
    /* Hidden by default on mobile, only the focus-mode view shows the
       full action bar. In normal review, scroll-down "Approve & send"
       lives at the end of the resume content. */
    display: none;

    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    padding-right: max(12px, env(safe-area-inset-right));
    padding-left: max(12px, env(safe-area-inset-left));
    background: #fff;
    border: 0;
    border-top: 1px solid ${line};
    border-radius: 0;
    box-shadow: 0 -4px 16px rgba(16, 12, 40, 0.06);
    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    flex-wrap: nowrap;
    z-index: 40;

    /* Keep the action bar visible in focus mode, it sits above the
       ArenaBottomNav (z-index 25) so the three primary actions stay
       reachable while the rest of the chrome is hidden. */
    body.applypilot-focus & {
      display: flex !important;
      z-index: 40;
    }

    .left, .right { display: contents; }
    .footer-status { display: none; }
    .more-menu-wrap { display: none; }
    /* Aggressively hide anything that isn't one of the three primary
       actions, beats earlier .left > button rules via !important. */
    .desktop-only-action { display: none !important; }
    .right > button:not(.primary-cta) { display: none; }

    /* Reject, soft-tinted square icon-only button. Tinted background
       lets it read as "destructive" without competing with the gradient
       primary, and matches the visual weight of the Edit pill next to
       it. */
    .reject-action {
      flex: 0 0 auto;
      width: 52px;
      height: 52px;
      min-height: 52px;
      padding: 0;
      border-radius: 14px;
      gap: 0;
      background: #FEECEE;
      border: 1px solid #F8D3D8;
      color: #E14B5A;
      box-shadow: none;
    }
    .reject-action:hover { background: #FCDADE; }
    .reject-action:active { background: #F8C4CA; }

    /* Exit-focus variant, same square, but neutral grey instead of red,
       so the X reads as "close fullscreen", not "reject". */
    .exit-focus-action {
      background: #fff !important;
      border: 1px solid ${line} !important;
      color: ${ink700} !important;
    }
    .exit-focus-action:hover { background: ${bg1} !important; }
    .reject-action .action-text,
    .reject-action ${Kbd} { display: none; }
    .reject-action svg { width: 22px; height: 22px; }

    /* Edit, outlined pill with pencil + short label. */
    .edit-action {
      flex: 0 0 auto;
      height: 52px;
      min-height: 52px;
      padding: 0 18px;
      border-radius: 14px;
      font-size: 14.5px;
      font-weight: 600;
      gap: 8px;
      background: #fff;
      border: 1px solid ${line};
      color: ${ink900};
    }
    .edit-action ${Kbd} { display: none; }
    .edit-action .action-text-desktop { display: none; }
    .edit-action .action-text-mobile { display: inline; }
    .edit-action .edit-icon { display: inline-flex; width: 16px; height: 16px; }

    /* Approve & send, fills remaining width with a purple→blue
       gradient that matches the rest of the brand. */
    .primary-cta {
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
      height: 52px;
      min-height: 52px;
      padding: 0 18px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      background: linear-gradient(135deg, #7C5CFF 0%, #6178F8 60%, #5B8DEF 100%);
      color: #fff;
      border: 0;
      box-shadow: 0 10px 22px rgba(108, 92, 231, 0.32);
    }
    .primary-cta ${Kbd} { display: none; }
    .primary-cta .cta-label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .primary-cta:disabled {
      background: #E9E5FA;
      color: ${ink500};
      border-color: #E9E5FA;
      box-shadow: none;
      opacity: 1;
    }
    .primary-cta:disabled svg { display: none; }
  }

  /* Desktop: hide the mobile-only span, show the verbose label. */
  .edit-action .action-text-mobile { display: none; }
  .edit-action .action-text-desktop { display: inline; }
  .edit-action .edit-icon { display: none; }

  /* Focus mode: force the compact mobile-style action bar regardless of
     viewport width, since the focus view is always presented as a
     phone-like distraction-free reading mode (even on tablets). */
  body.applypilot-focus & {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: #fff;
    border: 0;
    border-top: 1px solid ${line};
    border-radius: 0;
    box-shadow: 0 -4px 16px rgba(16, 12, 40, 0.06);
    flex-direction: row;
    align-items: stretch;
    gap: 8px;
    flex-wrap: nowrap;
    z-index: 40;
    display: flex !important;

    .left, .right { display: contents; }
    .footer-status { display: none; }
    .more-menu-wrap { display: none; }
    .desktop-only-action { display: none !important; }
    .right > button:not(.primary-cta) { display: none; }

    .reject-action {
      flex: 0 0 auto;
      width: 52px;
      height: 52px;
      min-height: 52px;
      padding: 0;
      border-radius: 14px;
      gap: 0;
      background: ${brand50} !important;
      border: 1px solid ${brand50} !important;
      color: ${brand700} !important;
      box-shadow: none;
    }
    .reject-action:hover { background: #E9E0FF !important; }
    .reject-action .action-text,
    .reject-action ${Kbd} { display: none; }
    .reject-action svg { width: 22px; height: 22px; display: inline-block; }

    /* When in focus mode the X is an exit-focus action, not destructive,
       so it shares the brand palette with the primary CTA. */
    .exit-focus-action {
      background: ${brand50} !important;
      border: 1px solid ${brand50} !important;
      color: ${brand700} !important;
    }

    .edit-action {
      flex: 0 0 auto;
      height: 52px;
      min-height: 52px;
      padding: 0 18px;
      border-radius: 14px;
      font-size: 14.5px;
      font-weight: 600;
      gap: 8px;
      background: #fff;
      border: 1px solid ${line};
      color: ${ink900};
    }
    .edit-action ${Kbd} { display: none; }
    .edit-action .action-text-desktop { display: none; }
    .edit-action .action-text-mobile { display: inline; }
    .edit-action .edit-icon { display: inline-flex; width: 16px; height: 16px; }

    .primary-cta {
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
      height: 52px;
      min-height: 52px;
      padding: 0 18px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      background: linear-gradient(135deg, #7C5CFF 0%, #6178F8 60%, #5B8DEF 100%);
      color: #fff;
      border: 0;
      box-shadow: 0 10px 22px rgba(108, 92, 231, 0.32);
    }
    .primary-cta ${Kbd} { display: none; }
    .primary-cta:disabled {
      background: #E9E5FA;
      color: ${ink500};
      border-color: #E9E5FA;
      box-shadow: none;
      opacity: 1;
    }
    .primary-cta:disabled svg { display: none; }
  }
`;

export const MoreMenu = styled.div`
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  right: auto;
  min-width: 200px;
  background: #fff;
  border: 1px solid ${line};
  border-radius: 12px;
  box-shadow: 0 14px 36px rgba(16, 12, 40, 0.18);
  padding: 6px;
  z-index: 20;
  display: flex;
  flex-direction: column;

  button {
    appearance: none;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: ${ink900};
    cursor: pointer;
    font-family: inherit;
    &:hover { background: ${bg1}; }
    &:disabled { opacity: 0.55; cursor: not-allowed; }
  }
`;

export const WhyBox = styled.div`
  margin-top: 24px;
  padding: 14px;
  background: ${brand50};
  border: 1px solid ${brand100};
  border-radius: 10px;
  font-size: 13px;
  color: ${brand700};
  line-height: 1.55;
`;

/* ================================================================
   TRAINING PAGE
   ================================================================ */
export const TrainPageHead = styled.div`
  padding: 28px 36px 18px;

  .wrap {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 700;
    color: ${brand600};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.02em;
    font-weight: 800;
  }
  p {
    margin: 6px 0 0;
    font-size: 14px;
    color: ${ink500};
    line-height: 1.5;
    max-width: 640px;
  }
  .actions {
    margin-left: auto;
    display: flex;
    gap: 10px;
  }

  @media (max-width: 1199px) {
    padding: 20px 16px 14px;
    .actions { margin-left: 0; }
    h1 { font-size: 22px; }
  }
`;

export const TrainingGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  margin: 0 36px 36px;
  align-items: start;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 1199px) {
    margin: 0 16px 24px;
  }
`;

export const TrainCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 16px;
  box-shadow: ${sh1};
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 720px;

  @media (max-width: 1199px) {
    height: min(720px, calc(100dvh - 160px));
    min-height: 520px;
  }
`;

export const TrainHeader = styled.div`
  padding: 18px 22px 14px;
  border-bottom: 1px solid ${line};
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(180deg, #fbfafe, #fff);

  .ava {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${brand500}, ${brand700});
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 800;
    box-shadow: 0 4px 14px rgba(124, 92, 255, 0.35);
    flex: 0 0 auto;
  }
  .meta { flex: 1; min-width: 0; }
  .name {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${good500};
    box-shadow: 0 0 0 4px rgba(29, 163, 74, 0.18);
    animation: ${trainPulse} 2.2s ease-in-out infinite;
  }
  .sub { font-size: 12px; color: ${ink500}; margin-top: 2px; }
  .overall { text-align: right; }
  .overall .pct-big {
    font-size: 24px;
    font-weight: 800;
    color: ${brand700};
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .overall .label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${ink500};
  }
`;

export const TrainBreadcrumb = styled.div`
  display: flex;
  gap: 6px;
  padding: 10px 22px;
  background: #fbfafe;
  border-bottom: 1px solid ${line};
  overflow-x: auto;
`;

export const BcStep = styled.span<{ $state: 'done' | 'on' | 'idle' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: ${ink500};
  background: transparent;
  white-space: nowrap;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  .n {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    display: grid;
    place-items: center;
    font-size: 10px;
  }

  ${p =>
    p.$state === 'done' &&
    css`
      color: ${good600};
      background: ${good50};
      .n { background: ${good500}; color: #fff; }
      cursor: pointer;
      &:hover { opacity: 0.8; }
    `}
  ${p =>
    p.$state === 'on' &&
    css`
      color: ${brand700};
      background: ${brand50};
      font-weight: 700;
      .n { background: ${brand500}; color: #fff; }
      cursor: default;
    `}
  ${p =>
    p.$state === 'idle' &&
    css`
      cursor: pointer;
      &:hover { background: rgba(124, 92, 255, 0.05); }
    `}
`;

export const TrainChat = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(180deg, #fafafc 0%, #fff 100%);
`;

export const DMsg = styled.div<{ $who: 'ai' | 'me' }>`
  display: flex;
  gap: 10px;
  max-width: 78%;

  ${p =>
    p.$who === 'ai'
      ? css`align-self: flex-start;`
      : css`align-self: flex-end; flex-direction: row-reverse;`}

  .ava {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 800;

    ${p =>
      p.$who === 'ai'
        ? css`
            background: linear-gradient(135deg, ${brand500}, ${brand700});
            color: #fff;
          `
        : css`
            background: #eae6fb;
            color: ${brand700};
          `}
  }

  @media (max-width: 640px) { max-width: 92%; }
`;

export const DBubble = styled.div<{ $who: 'ai' | 'me' }>`
  padding: 12px 15px;
  border-radius: 16px;
  font-size: 13.5px;
  line-height: 1.55;
  box-shadow: ${sh1};

  ${p =>
    p.$who === 'ai'
      ? css`
          background: #fff;
          color: ${ink900};
          border: 1px solid ${line};
          border-bottom-left-radius: 6px;
        `
      : css`
          background: ${brand600};
          color: #fff;
          border-bottom-right-radius: 6px;
        `}
`;

export const TopicTag = styled.span`
  display: inline-block;
  font-size: 10.5px;
  font-weight: 700;
  color: ${brand600};
  background: ${brand50};
  padding: 2px 7px;
  border-radius: 6px;
  margin-bottom: 6px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

export const TrainChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 22px 4px;
  background: #fff;
  border-top: 1px solid ${line};
`;

export const TcChip = styled.button<{ $on?: boolean }>`
  padding: 8px 13px;
  border-radius: 999px;
  background: ${p => (p.$on ? brand50 : '#fff')};
  border: 1px solid ${p => (p.$on ? brand500 : line)};
  font-size: 12.5px;
  font-weight: 600;
  color: ${p => (p.$on ? brand700 : ink700)};
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;

  &:hover {
    border-color: ${brand500};
    color: ${brand700};
  }
`;

export const TrainInput = styled.div`
  padding: 10px 16px 16px;
  background: #fff;
  display: flex;
  gap: 10px;
  align-items: center;

  .field {
    flex: 1;
    border: 1px solid ${line};
    border-radius: 14px;
    padding: 12px 16px;
    font-size: 13.5px;
    color: ${ink400};
    background: #f7f7fb;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      color: ${ink900};
    }
  }

  .mic,
  .send {
    display: grid;
    place-items: center;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mic {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${brand500}, ${brand700});
    color: #fff;
    box-shadow: 0 6px 18px rgba(109, 74, 232, 0.45);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .mic:hover {
    transform: scale(1.04);
    box-shadow: 0 8px 22px rgba(109, 74, 232, 0.55);
  }
  .send {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #EFEBFA;
    color: ${ink700};
  }
  .send:hover { background: #E4DEF7; }
  .send:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const TrainFooter = styled.div`
  padding: 14px 22px;
  border-top: 1px solid ${line};
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(180deg, #fff, #fbfafe);
  flex-wrap: wrap;

  .note {
    font-size: 12px;
    color: ${ink500};
    b { color: ${ink900}; font-weight: 700; }
  }
  .right {
    margin-left: auto;
    display: flex;
    gap: 10px;
  }
`;

/* --- Right column --- */
export const TrainSide = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const TsCard = styled.div<{ $accent?: boolean }>`
  background: ${p =>
    p.$accent
      ? 'linear-gradient(135deg, #F3EFFE 0%, #FAF7FF 100%)'
      : '#fff'};
  border: 1px solid ${p => (p.$accent ? brand100 : line)};
  border-radius: 16px;
  padding: 20px;
  box-shadow: ${sh1};
`;

export const TsTitle = styled.h4`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${ink500};
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;

  .count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: ${brand700};
    background: ${brand50};
    padding: 3px 8px;
    border-radius: 999px;
    letter-spacing: 0.02em;
    text-transform: none;
  }
`;

export const TsRingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;

  h4 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  p {
    margin: 0;
    font-size: 12.5px;
    color: ${ink500};
    line-height: 1.4;
  }
`;

export const TsRing = styled.div`
  width: 80px;
  height: 80px;
  position: relative;
  flex: 0 0 auto;

  svg { transform: rotate(-90deg); }
  .p {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 20px;
    font-weight: 800;
    color: ${brand700};
    letter-spacing: -0.02em;
  }
`;

export const TsTopic = styled.div<{ $variant: 'motive' | 'stories' | 'values' | 'limits' | 'voice' }>`
  padding: 10px 0;
  border-top: 1px solid ${line};
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  align-items: center;

  &:first-of-type { border-top: 0; }

  .t-ico {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 14px;

    ${p => {
      switch (p.$variant) {
        case 'motive':
          return css`background: #F3EFFE; color: ${brand600};`;
        case 'stories':
          return css`background: #FEF3D4; color: #B07800;`;
        case 'values':
          return css`background: #E6F6EE; color: ${good600};`;
        case 'limits':
          return css`background: #FDECEC; color: ${bad600};`;
        case 'voice':
        default:
          return css`background: #E9F1FD; color: #2E6BD6;`;
      }
    }}
  }

  .t-name { font-size: 13px; font-weight: 700; }
  .t-sub { font-size: 11.5px; color: ${ink500}; margin-top: 1px; }
  .t-pct { font-size: 12px; font-weight: 800; color: ${ink900}; }

  .t-track {
    grid-column: 2 / 4;
    height: 4px;
    border-radius: 3px;
    background: #f0eef7;
    overflow: hidden;
    margin-top: 6px;
  }
  .t-fill {
    height: 100%;
    border-radius: 3px;
    background: ${brand500};
  }
  .t-fill.good { background: ${good500}; }
  .t-fill.warn { background: #e79b1c; }
`;

export const MemRow = styled.div`
  padding: 10px 0;
  border-top: 1px solid ${line};
  font-size: 12.5px;
  color: ${ink900};
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 10px;
  align-items: start;

  &:first-of-type { border-top: 0; padding-top: 2px; }

  .k {
    font-weight: 700;
    color: ${brand700};
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding-top: 2px;
  }
  .v {
    color: ${ink700};
    line-height: 1.45;
    word-break: break-word;
  }
  .edit-link {
    color: ${ink400};
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding-top: 2px;
    background: transparent;
    border: 0;
    font-family: inherit;

    &:hover { color: ${brand600}; }
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr auto;
    .k { grid-column: 1 / -1; }
  }
`;

export const InfoCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .emblem {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, ${brand500}, ${brand700});
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 15px;
    font-weight: 800;
    flex: 0 0 auto;
    box-shadow: 0 3px 10px rgba(124, 92, 255, 0.35);
  }
  .title {
    font-size: 13px;
    font-weight: 800;
    color: ${brand700};
    margin-bottom: 4px;
  }
  .body {
    font-size: 12.5px;
    color: ${ink700};
    line-height: 1.5;
  }
`;

/* ================================================================
   Modal · shared lightweight dialog.
   Used by Review page's "Request edit" flow and anywhere else we
   need a focus-trapped prompt (replaces window.prompt).
   ================================================================ */
export const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(14, 11, 31, 0.45);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 24px;
  animation: arenaModalFadeIn 0.12s ease-out;

  @keyframes arenaModalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const ModalCard = styled.div`
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(14, 11, 31, 0.25);
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: arenaModalPop 0.14s ease-out;

  @keyframes arenaModalPop {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

export const ModalHeader = styled.div`
  padding: 18px 20px 10px;
  border-bottom: 1px solid ${line};

  h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    color: ${ink900};
  }
  p {
    margin: 0;
    font-size: 13px;
    color: ${ink500};
    line-height: 1.5;
  }
`;

export const ModalBody = styled.div`
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const ModalFooter = styled.div`
  padding: 12px 20px;
  border-top: 1px solid ${line};
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: ${bg1};
`;

export const ModalTextarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  max-height: 300px;
  resize: vertical;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${lineStrong};
  background: #fff;
  color: ${ink900};
  font-size: 13.5px;
  font-family: inherit;
  line-height: 1.55;
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;

  &::placeholder { color: ${ink400}; }
  &:focus {
    border-color: ${brand500};
    box-shadow: 0 0 0 3px ${brand100};
  }
`;

export const ModalSelect = styled.select`
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid ${lineStrong};
  background: #fff;
  color: ${ink900};
  font-size: 13.5px;
  font-family: inherit;
  outline: none;

  &:focus {
    border-color: ${brand500};
    box-shadow: 0 0 0 3px ${brand100};
  }
`;

export const ModalLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${ink700};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

/* ================================================================
   Submission timeline · shown on the Review detail for the
   "Submission status" tab when the Puppeteer adapter has captured
   step-by-step screenshots.
   ================================================================ */
export const TimelineCard = styled.div`
  background: #fff;
  border: 1px solid ${line};
  border-radius: 12px;
  padding: 14px 16px;
  margin-top: 12px;
  box-shadow: ${sh1};

  h4 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 700;
    color: ${ink900};
    letter-spacing: -0.005em;
  }
`;

export const TimelineList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
`;

export const TimelineItem = styled.li`
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  background: ${bg1};
  border: 1px solid ${line};

  .step {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${brand500};
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 11.5px;
    font-weight: 700;
  }
  .body {
    min-width: 0;
  }
  .label {
    font-size: 13px;
    font-weight: 600;
    color: ${ink900};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    font-size: 11.5px;
    color: ${ink500};
  }
  a.thumb {
    display: block;
    width: 84px;
    height: 52px;
    border-radius: 6px;
    border: 1px solid ${lineStrong};
    background: #fff center/cover no-repeat;
    overflow: hidden;
    text-decoration: none;
    transition: transform 0.12s, border-color 0.12s;
  }
  a.thumb:hover {
    transform: scale(1.04);
    border-color: ${brand500};
  }
  .thumb-missing {
    width: 84px;
    height: 52px;
    border-radius: 6px;
    border: 1px dashed ${lineStrong};
    background: #fff;
    display: grid;
    place-items: center;
    font-size: 10.5px;
    color: ${ink500};
    text-align: center;
    padding: 4px;
    line-height: 1.2;
  }
`;
