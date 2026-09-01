// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { css, keyframes } from 'styled-components';

/* ═══════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════ */

export const bubbleIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const blink = keyframes`
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40%           { opacity: 1;    transform: translateY(-3px); }
`;

/* ═══════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════ */

export const PageContainer = styled.div`
  /* dvh, not vh: on mobile Safari the URL bar otherwise hides the composer,
     which is the one control the whole page exists to offer. */
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f4f4f8;
  overflow: hidden;
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 12px 16px;
  }
`;

export const Logo = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
`;

export const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;

  @media (max-width: 480px) {
    gap: 12px;
  }
`;

export const TopButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 6px 2px;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  color: ${({ $muted }) => ($muted ? '#9a9ab0' : '#1a1a2e')};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};

  &:hover:not(:disabled) { color: #4c51bf; }

  @media (max-width: 480px) {
    font-size: 0.86rem;
    span.label { display: none; }
  }
`;

export const Body = styled.div`
  flex: 1;
  display: flex;
  min-height: 0; /* lets the chat column scroll instead of the page */
`;

/* ═══════════════════════════════════════════════
   CHAT COLUMN
   ═══════════════════════════════════════════════ */

export const ChatColumn = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
`;

export const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scroll-behavior: smooth;

  @media (max-width: 768px) {
    padding: 16px 14px 4px;
  }
`;

// Keeps the conversation in a readable column on wide screens without
// letting bubbles stretch edge to edge.
export const Thread = styled.div`
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  animation: ${bubbleIn} 260ms ease both;
  ${({ $mine }) => $mine && css`
    justify-content: flex-end;
  `}
`;

export const CoachAvatar = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #6366f1, #7c85f5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.28);

  svg { width: 22px; height: 22px; }
`;

export const Bubble = styled.div`
  max-width: min(560px, 82%);
  padding: 14px 18px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(26, 26, 46, 0.06);
  font-size: 1.02rem;
  line-height: 1.5;
  color: #1a1a2e;
  white-space: pre-wrap;
  word-break: break-word;

  ${({ $mine }) => $mine && css`
    background: #6366f1;
    color: #fff;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.25);
  `}

  @media (max-width: 480px) {
    font-size: 0.96rem;
    max-width: 88%;
  }
`;

export const BubbleHint = styled.div`
  margin-top: 4px;
  font-size: 0.93rem;
  line-height: 1.45;
  color: #7c7c94;
`;

export const Typing = styled.div`
  display: inline-flex;
  gap: 5px;
  padding: 4px 2px;

  span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9a9ab0;
    animation: ${blink} 1.3s infinite ease-in-out;
  }
  span:nth-child(2) { animation-delay: 0.18s; }
  span:nth-child(3) { animation-delay: 0.36s; }
`;

/* ═══════════════════════════════════════════════
   CHIPS
   ═══════════════════════════════════════════════ */

// The in-message answer chips (the big white tiles in the transcript).
export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-left: 50px; /* aligns under the coach bubble, past the avatar */

  @media (max-width: 480px) {
    padding-left: 0;
    gap: 8px;
  }
`;

export const Chip = styled.button`
  padding: 11px 18px;
  border-radius: 12px;
  border: 1.5px solid ${({ $selected }) => ($selected ? '#6366f1' : '#e6e6ef')};
  background: ${({ $selected }) => ($selected ? '#eef0ff' : '#fff')};
  color: ${({ $selected, $spent }) => ($spent ? '#b4b4c4' : $selected ? '#4c51bf' : '#1a1a2e')};
  font-family: inherit;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: ${({ $spent }) => ($spent ? 'default' : 'pointer')};
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
  box-shadow: 0 1px 2px rgba(26, 26, 46, 0.05);

  &:hover:not(:disabled) {
    border-color: #6366f1;
    transform: translateY(-1px);
  }

  &:disabled { box-shadow: none; }

  @media (max-width: 480px) {
    padding: 10px 14px;
    font-size: 0.92rem;
  }
`;

// The small pill row directly above the composer — shortcuts, not answers.
export const QuickReplies = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 4px 24px 10px;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 768px) {
    padding: 4px 14px 8px;
    /* One scrolling line beats three wrapped rows eating the small screen. */
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
`;

export const QuickReply = styled.button`
  padding: 9px 16px;
  border-radius: 999px;
  border: 1.5px solid #dcdcf0;
  background: #fff;
  color: #4c51bf;
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;

  &:hover { border-color: #6366f1; background: #f6f7ff; }
`;

/* ═══════════════════════════════════════════════
   COMPOSER
   ═══════════════════════════════════════════════ */

export const ComposerWrap = styled.div`
  flex-shrink: 0;
  padding: 0 24px 14px;

  @media (max-width: 768px) {
    padding: 0 14px 10px;
  }
`;

export const Composer = styled.form`
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 768px;
  margin: 0 auto;
  padding: 8px 8px 8px 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 14px rgba(26, 26, 46, 0.08);
`;

export const ComposerInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 1rem;
  color: #1a1a2e;
  padding: 10px 0;
  min-width: 0;

  &::placeholder { color: #a0a0b8; }
`;

export const IconButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  transition: background 140ms ease, opacity 140ms ease;

  ${({ $primary }) => $primary
    ? css`
        background: #6366f1;
        color: #fff;
        &:hover:not(:disabled) { background: #5457e5; }
      `
    : css`
        background: #f1f1f8;
        color: #6366f1;
        &:hover:not(:disabled) { background: #e7e7f6; }
      `}

  &:disabled { opacity: 0.45; }
`;

export const Footnote = styled.p`
  margin: 8px auto 0;
  max-width: 768px;
  text-align: center;
  font-size: 0.84rem;
  color: #9a9ab0;

  @media (max-width: 480px) {
    font-size: 0.78rem;
  }
`;

export const ErrorNote = styled.div`
  max-width: 768px;
  margin: 0 auto 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fdecec;
  border: 1px solid #f5c2c2;
  color: #b23434;
  font-size: 0.9rem;
`;

/* ═══════════════════════════════════════════════
   PROGRESS PANEL
   ═══════════════════════════════════════════════ */

export const SidePanel = styled.aside`
  width: 340px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #ececf3;
  padding: 26px 24px;
  overflow-y: auto;

  /* Below this the conversation needs the whole width; the same data shows
     in the collapsible strip instead. */
  @media (max-width: 1024px) {
    display: none;
  }
`;

export const PanelHead = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 22px;
  border-bottom: 1px solid #f0f0f6;
`;

export const Meter = styled.div`
  position: relative;
  width: 58px;
  height: 58px;
  flex-shrink: 0;

  svg { transform: rotate(-90deg); }

  span {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.92rem;
    font-weight: 700;
    color: #1a1a2e;
  }
`;

export const PanelTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: #9a9ab0;
`;

export const PanelTier = styled.div`
  font-size: 1.14rem;
  font-weight: 700;
  color: ${({ $color }) => $color || '#1a1a2e'};
  margin: 2px 0 3px;
`;

export const PanelSub = styled.div`
  font-size: 0.86rem;
  color: #7c7c94;
  line-height: 1.35;
`;

export const PanelItem = styled.div`
  padding: 16px 0;
  border-bottom: 1px solid #f4f4f9;

  &:last-child { border-bottom: none; }
`;

export const PanelItemHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${({ $done }) => ($done ? '#4c51bf' : '#9a9ab0')};
`;

export const Dot = styled.span`
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $done }) => ($done ? '#6366f1' : '#e4e4ef')};
  transition: background 220ms ease;
`;

export const PanelItemBody = styled.div`
  margin-top: 6px;
  padding-left: 23px;
  font-size: 0.96rem;
  color: ${({ $done }) => ($done ? '#1a1a2e' : '#8a8aa2')};
  line-height: 1.4;
  word-break: break-word;
`;

/* ─── Mobile: the same panel, collapsed to a strip ─────────────── */

export const MobileStrip = styled.button`
  display: none;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border: none;
  border-bottom: 1px solid #ececf3;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  flex-shrink: 0;

  @media (max-width: 1024px) {
    display: flex;
  }
`;

export const StripBar = styled.div`
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #eeeef6;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    width: ${({ $pct }) => `${$pct}%`};
    border-radius: 999px;
    background: #6366f1;
    transition: width 320ms ease;
  }
`;

export const StripLabel = styled.span`
  font-size: 0.82rem;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
`;

export const MobilePanel = styled.div`
  display: none;
  padding: 4px 16px 14px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
  flex-shrink: 0;

  @media (max-width: 1024px) {
    display: ${({ $open }) => ($open ? 'block' : 'none')};
  }
`;

/* ═══════════════════════════════════════════════
   COACHING CARDS

   The review, the target read, the finished resume, the tour and the
   sign-up all render inside the transcript rather than in modals, so
   the conversation stays the single place everything happens. They
   share Card so they read as one family of things the coach hands over.
   ═══════════════════════════════════════════════ */

export const Card = styled.div`
  width: 100%;
  max-width: min(600px, 92%);
  margin-left: 50px;
  background: #fff;
  border: 1px solid #ececf3;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 2px 12px rgba(26, 26, 46, 0.06);
  animation: ${bubbleIn} 300ms ease both;

  @media (max-width: 480px) {
    margin-left: 0;
    max-width: 100%;
    padding: 16px;
  }
`;

export const CardLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #9a9ab0;
  margin-bottom: 10px;
`;

export const CardList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

// A single point of feedback. The left rule is the only ornament — it
// separates items faster than spacing alone when several stack up.
// Direct-child selectors, not descendants. A plain `span {}` here is
// specificity (0,1,1) and silently beats the (0,1,0) class of any styled
// component nested inside — which is how EffortTag, an inline-block pill,
// rendered as a full-width block bar.
export const Finding = styled.li`
  border-left: 3px solid ${({ $tone }) => ($tone === 'good' ? '#22c55e' : '#f59e0b')};
  padding-left: 12px;

  > b {
    display: block;
    font-size: 0.98rem;
    font-weight: 650;
    color: #1a1a2e;
    line-height: 1.4;
  }

  > span {
    display: block;
    margin-top: 3px;
    font-size: 0.92rem;
    color: #6c6c86;
    line-height: 1.45;
  }

  > i {
    display: block;
    margin-top: 5px;
    font-style: normal;
    font-size: 0.92rem;
    color: #4c51bf;
    line-height: 1.45;
  }
`;

/* ─── Target assessment ───────────────────────────────────────── */

export const VerdictRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

export const Verdict = styled.span`
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.86rem;
  font-weight: 700;
  background: ${({ $tone }) => ({ near: '#dcfce7', mid: '#fef3c7', far: '#fee2e2' }[$tone] || '#eef0ff')};
  color: ${({ $tone }) => ({ near: '#15803d', mid: '#b45309', far: '#b91c1c' }[$tone] || '#4c51bf')};
`;

export const MarketNote = styled.span`
  font-size: 0.9rem;
  color: #6c6c86;
`;

export const Headline = styled.p`
  margin: 0 0 14px;
  font-size: 1.02rem;
  line-height: 1.5;
  color: #1a1a2e;
`;

export const EffortTag = styled.span`
  display: inline-block;
  margin-left: 8px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  background: #f1f1f8;
  color: #6c6c86;
  vertical-align: middle;
`;

/* ─── The resume, rendered in the chat ────────────────────────── */

export const ResumeSheet = styled.div`
  background: #fff;
  border: 1px solid #e6e6ef;
  border-radius: 12px;
  padding: 26px 28px;
  /* Deliberately a document, not a UI panel: serif headings and generous
     leading are what make someone recognise it as their resume. */
  font-family: Georgia, 'Times New Roman', serif;

  @media (max-width: 480px) {
    padding: 18px 16px;
  }
`;

export const ResumeName = styled.div`
  font-size: 1.42rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
`;

export const ResumeMeta = styled.div`
  margin-top: 4px;
  font-size: 0.9rem;
  color: #6c6c86;
  font-family: system-ui, -apple-system, sans-serif;
`;

export const ResumeSection = styled.section`
  margin-top: 20px;

  h4 {
    margin: 0 0 8px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: #6366f1;
    font-family: system-ui, -apple-system, sans-serif;
    border-bottom: 1px solid #eeeef6;
    padding-bottom: 5px;
  }

  p { margin: 0; font-size: 0.98rem; line-height: 1.55; color: #2a2a40; }
`;

export const ResumeEntry = styled.div`
  margin-bottom: 14px;

  &:last-child { margin-bottom: 0; }

  strong { font-size: 1rem; color: #1a1a2e; font-weight: 700; }

  em {
    display: block;
    font-style: normal;
    font-size: 0.86rem;
    color: #8a8aa2;
    margin-top: 1px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  ul { margin: 7px 0 0; padding-left: 18px; }
  li { font-size: 0.96rem; line-height: 1.5; color: #2a2a40; margin-bottom: 3px; }
`;

export const ResumeSkills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-family: system-ui, -apple-system, sans-serif;

  span {
    padding: 4px 10px;
    border-radius: 6px;
    background: #f4f4fb;
    font-size: 0.86rem;
    color: #4a4a63;
  }
`;

/* ─── Product tour ────────────────────────────────────────────── */

export const TourGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const TourCard = styled.div`
  border: 1px solid #ececf3;
  border-radius: 12px;
  padding: 16px;
  background: #fbfbfe;

  h5 {
    margin: 10px 0 5px;
    font-size: 0.98rem;
    font-weight: 700;
    color: #1a1a2e;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #6c6c86;
  }
`;

export const TourIcon = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #eef0ff;
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;

  svg { width: 19px; height: 19px; }
`;

/* ─── Sign-up ─────────────────────────────────────────────────── */

export const ConvertCard = styled(Card)`
  background: linear-gradient(135deg, #6366f1, #7c85f5);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.3);

  h4 { margin: 0 0 8px; font-size: 1.18rem; font-weight: 700; }
  p  { margin: 0 0 16px; font-size: 0.98rem; line-height: 1.55; opacity: 0.94; }
`;

export const ConvertActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

export const ConvertPrimary = styled.button`
  padding: 12px 22px;
  border-radius: 11px;
  border: none;
  background: #fff;
  color: #4c51bf;
  font-family: inherit;
  font-size: 0.98rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease;

  &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16); }
`;

export const ConvertSecondary = styled.button`
  padding: 12px 6px;
  border: none;
  background: none;
  color: #fff;
  font-family: inherit;
  font-size: 0.94rem;
  font-weight: 600;
  cursor: pointer;
  opacity: 0.9;
  text-decoration: underline;

  &:hover { opacity: 1; }
`;

export const ConvertNote = styled.div`
  margin-top: 12px;
  font-size: 0.84rem;
  opacity: 0.8;
`;

/* ─── Resume upload progress ──────────────────────────────────── */

export const UploadCard = styled(Card)`
  display: flex;
  align-items: center;
  gap: 14px;
`;

export const UploadIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eef0ff;
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const UploadBody = styled.div`
  flex: 1;
  min-width: 0;

  b {
    display: block;
    font-size: 0.96rem;
    font-weight: 650;
    color: #1a1a2e;
    /* A long filename must not push the card wider than the thread. */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    display: block;
    margin-top: 2px;
    font-size: 0.9rem;
    color: #6c6c86;
  }
`;

export const UploadTrack = styled.div`
  margin-top: 9px;
  height: 5px;
  border-radius: 999px;
  background: #eeeef6;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: ${({ $done, $failed }) => ($failed ? '#dc2626' : $done ? '#22c55e' : '#6366f1')};
    width: ${({ $pct }) => `${$pct}%`};
    transition: width 420ms ease, background 220ms ease;
  }
`;
