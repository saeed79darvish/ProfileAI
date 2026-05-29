import React, { useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as EmptyIcon,
  AutoAwesome as SparkleIcon,
  ArrowForward as ArrowIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';

/* ═══════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════ */

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const ringGrow = keyframes`
  from { stroke-dashoffset: 226; }
`;

/* ═══════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════ */

const Card = styled.section`
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(102,126,234,0.16);
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
  overflow: hidden;
  margin-bottom: 20px;
  animation: ${slideDown} 0.4s ease;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(102,126,234,0.08), rgba(240,147,251,0.06));
  cursor: pointer;

  @media (max-width: 480px) { padding: 16px; gap: 12px; }
`;

const RingWrap = styled.div`
  position: relative;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
`;

const Ring = styled.svg`
  width: 58px;
  height: 58px;
  transform: rotate(-90deg);

  .track { fill: none; stroke: rgba(102,126,234,0.15); stroke-width: 7; }
  .bar {
    fill: none;
    stroke: url(#dashGrad);
    stroke-width: 7;
    stroke-linecap: round;
    stroke-dasharray: 226;
    stroke-dashoffset: ${p => 226 - (226 * p.$pct) / 100};
    animation: ${ringGrow} 1s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: stroke-dashoffset 0.5s ease;
  }
`;

const RingPct = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 800;
  color: #1a1a2e;
`;

const HeadText = styled.div`
  flex: 1;
  min-width: 0;

  .title {
    font-size: 15.5px;
    font-weight: 700;
    color: #1a1a2e;
    display: flex;
    align-items: center;
    gap: 6px;

    svg { font-size: 17px; color: #667eea; }
  }
  .sub {
    font-size: 13px;
    color: #667085;
    margin-top: 2px;
  }
`;

const Toggle = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: #667085;
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: 8px;

  svg { font-size: 22px; }
  &:hover { background: rgba(0,0,0,0.04); }
  &:focus-visible { outline: 2px solid #667eea; outline-offset: 2px; }
`;

const Items = styled.div`
  padding: 8px;
`;

const Item = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: ${p => (p.$done ? 'default' : 'pointer')};
  text-align: left;
  font-family: inherit;
  transition: background 0.15s ease;

  &:hover { background: ${p => (p.$done ? 'transparent' : 'rgba(102,126,234,0.06)')}; }
  &:focus-visible { outline: 2px solid #667eea; outline-offset: -2px; }

  .status {
    flex-shrink: 0;
    display: inline-flex;
    svg { font-size: 22px; }
    .check { color: #22c55e; }
    .empty { color: #cbd2e0; }
  }

  .label {
    flex: 1;
    font-size: 14px;
    font-weight: ${p => (p.$done ? 500 : 600)};
    color: ${p => (p.$done ? '#9aa1b2' : '#1a1a2e')};
    text-decoration: ${p => (p.$done ? 'line-through' : 'none')};
  }

  .gain {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    color: #667eea;
    background: rgba(102,126,234,0.1);
    border-radius: 7px;
    padding: 3px 8px;
  }

  .go {
    flex-shrink: 0;
    color: #667eea;
    display: inline-flex;
    svg { font-size: 18px; }
  }
`;

const Done = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;

  .icon {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    svg { color: #fff; font-size: 26px; }
  }
  .txt .title { font-size: 15px; font-weight: 700; color: #1a1a2e; }
  .txt .sub { font-size: 13px; color: #667085; margin-top: 2px; }
`;

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

const STAGE_COPY = (pct) => {
  if (pct >= 80) return 'Almost there — finish strong to reach Top 10%.';
  if (pct >= 50) return 'Looking good! A few more steps to stand out.';
  return 'Complete these to get 5x more recruiter views.';
};

/**
 * Dashboard "Complete your profile" checklist card.
 * Surfaces the shared completion score + the remaining checklist items, each
 * deep-linking into the relevant editor section. Collapsible; auto-hidden at
 * 100% unless the user just hit it (parent decides whether to render at all).
 *
 * Props:
 *  - completion: result of useProfileCompletion (pct, label, items, missing, done)
 *  - onItemClick: (section: string) => void
 *  - defaultOpen?: boolean
 */
const ProfileCompletionCard = ({ completion, onItemClick, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const { pct = 0, items = [], missing = [], done } = completion || {};

  // Show incomplete items first; keep completed ones visible (struck through)
  // so progress feels tangible, capped so the card never dominates the page.
  const ordered = useMemo(() => {
    const incomplete = items.filter((it) => !it.done);
    const complete = items.filter((it) => it.done);
    return [...incomplete, ...complete];
  }, [items]);

  if (done) {
    return (
      <Card aria-label="Profile complete">
        <Done>
          <div className="icon"><CheckIcon /></div>
          <div className="txt">
            <div className="title">Your profile is 100% complete 🎉</div>
            <div className="sub">You're in the top tier — recruiters can see the full picture.</div>
          </div>
        </Done>
      </Card>
    );
  }

  return (
    <Card aria-label="Complete your profile">
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="dashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f093fb" />
          </linearGradient>
        </defs>
      </svg>

      <Head onClick={() => setOpen((o) => !o)}>
        <RingWrap>
          <Ring viewBox="0 0 80 80" $pct={pct}>
            <circle className="track" cx="40" cy="40" r="36" />
            <circle className="bar" cx="40" cy="40" r="36" />
          </Ring>
          <RingPct>{pct}%</RingPct>
        </RingWrap>
        <HeadText>
          <div className="title"><SparkleIcon /> Complete your profile</div>
          <div className="sub">
            {missing.length} step{missing.length === 1 ? '' : 's'} left · {STAGE_COPY(pct)}
          </div>
        </HeadText>
        <Toggle
          aria-label={open ? 'Collapse checklist' : 'Expand checklist'}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          {open ? <CollapseIcon /> : <ExpandIcon />}
        </Toggle>
      </Head>

      {open && (
        <Items>
          {ordered.map((it) => (
            <Item
              key={it.key}
              $done={it.done}
              disabled={it.done}
              onClick={() => !it.done && onItemClick?.(it.section)}
            >
              <span className="status">
                {it.done
                  ? <CheckIcon className="check" />
                  : <EmptyIcon className="empty" />}
              </span>
              <span className="label">{it.label}</span>
              {!it.done && (
                <>
                  <span className="gain">+{it.gainPct}%</span>
                  <span className="go"><ArrowIcon /></span>
                </>
              )}
            </Item>
          ))}
        </Items>
      )}
    </Card>
  );
};

export default ProfileCompletionCard;
