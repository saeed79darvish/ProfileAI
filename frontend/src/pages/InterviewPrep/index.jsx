import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { tailoredProfileAPI } from '@/services/api';
import FocusCard from './FocusCard';
import { rankByFocus, cleanFocus as cleanFocusLogic } from './targeting';
import { interviewPrepAPI } from '@/services/interviewPrep';
import Stories from './Stories';
import { companyOf } from '@/components/tailored/tailoredModel';
import {
  CATEGORIES, filterQuestions, cleanTopics, cleanRounds, categoryCounts, monthYear, reportedBy, sourcesFor, safeUrl, pollExpired, progressStep, companyFromUrl, cleanDiscussions, POLL_MS,
  categoryTag, sourcePillLabel, coverageChip, companyInitial, logoColor, selectStep, stepKeyTarget, visibleQuestions, showMoreLabel,
  isGapProbe, gapDetail, discussionBadge, planProgress, storyRows,
} from './prepLogic';
import { isPrepIdMode, prepHeading, refreshBody, apiErrorState } from './startLogic';
import { practiceSummary, sessionsLabel } from './practiceLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', brandInk: '#4b4fc4', soft: '#f0f0fc', bg: '#f4f5fa', success: '#1f8f55' };
const STEPS = ['Searching recent interview reports', 'Reading the sources', 'Grouping the questions', 'Checking dates'];

const Page = styled.div`
  min-height: 100%;
  background: ${C.bg};
  padding: 16px 16px 72px;
  color: ${C.ink};
  .wrap { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .layout { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .main { flex: 999 1 700px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .rail { flex: 1 1 320px; max-width: 380px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  @media (max-width: 740px) { .rail { max-width: none; flex-basis: 100%; } }
  @media (min-width: 900px) { padding: 32px 40px 96px; .main { gap: 24px; } .rail { gap: 20px; } .wrap { gap: 20px; } }
  @media (min-width: 1120px) { .rail { position: sticky; top: 24px; } }
`;
const Back = styled.button`
  align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; min-height: 44px;
  font: inherit; font-size: 14.5px; font-weight: 600; color: ${C.brandInk}; cursor: pointer;
`;
const Head = styled.header`
  display: flex; flex-wrap: wrap; gap: 16px 20px; align-items: center; justify-content: space-between;
  .who { display: flex; gap: 14px; align-items: center; min-width: 0; }
  .logo { flex: none; width: 52px; height: 52px; border-radius: 14px; color: #fff; font-size: 24px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .txt { min-width: 0; }
  h1 { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; overflow-wrap: anywhere; }
  .role { margin-top: 3px; font-size: 15px; color: #4a4d63; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-top: 10px; }
  .chip { padding: 3px 10px; border-radius: 999px; background: #ecedf3; color: #3b3e52; font-size: 12.5px; font-weight: 600; }
  @media (min-width: 900px) {
    .logo { width: 64px; height: 64px; border-radius: 16px; font-size: 28px; }
    h1 { font-size: 34px; }
    .role { font-size: 17px; }
  }
`;
const TextBtn = styled.button`
  border: none; background: none; padding: 10px 0; min-height: 44px; font: inherit; font-size: 14.5px; font-weight: 700;
  color: ${C.brandInk}; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 20px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #d9dbe5' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : '#fff')};
`;
const Ghost = styled.button`
  min-height: 44px; padding: 0 20px; border: 1.5px solid #d9dbe5; border-radius: 12px; background: #fff; color: ${C.ink};
  font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
`;
const Card = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 20px; box-sizing: border-box;
  .eyebrow { margin-bottom: 8px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; color: ${C.brandInk}; text-transform: uppercase; }
  .titlerow { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 8px; }
  h2 { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  .aside { font-size: 14px; color: ${C.muted}; }
  p { margin: 0; font-size: 16px; line-height: 1.5; }
  .lead { font-size: 16px; line-height: 1.6; }
  @media (min-width: 900px) {
    border-radius: 20px; padding: 28px;
    h2 { font-size: 22px; }
    .eyebrow { font-size: 12px; }
    .lead { font-size: 18px; }
  }
`;
const InfoNote = styled.div`
  display: flex; gap: 10px; align-items: flex-start; margin-top: 18px; padding: 12px 14px; border-radius: 12px; background: #f6f7fb;
  font-size: 13.5px; line-height: 1.5; color: #4a4d63;
  svg { flex: none; margin-top: 2px; }
`;
const Note = styled.div`
  margin-top: 12px; padding: 10px 12px; border-radius: 12px; font-size: 14.5px; line-height: 1.45;
  background: #fdf1e4; color: #8a4a08;
`;
const StepWrap = styled.div`
  margin-top: 20px; overflow-x: auto;
  .track { position: relative; display: grid; gap: 0; min-width: min-content; }
  .line { position: absolute; top: 17px; height: 2px; background: ${C.line}; }
  .tab { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 88px; min-height: 44px; padding: 0 4px; border: none; background: none; font: inherit; cursor: pointer; color: ${C.ink}; }
  .dot { width: 36px; height: 36px; box-sizing: border-box; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; background: #fff; border: 2px solid ${C.brand}; color: ${C.brandInk}; }
  .tab[aria-selected='true'] .dot { background: ${C.brand}; color: #fff; }
  .lbl { font-size: 13px; font-weight: 600; text-align: center; line-height: 1.3; }
  .tab[aria-selected='true'] .lbl { font-weight: 700; color: ${C.brandInk}; }
  .tab:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; border-radius: 10px; }
`;
const Timeline = styled.div`
  position: relative; display: flex; flex-direction: column; gap: 6px; margin-top: 16px; padding-left: 4px;
  .line { position: absolute; left: 17px; top: 22px; bottom: 22px; width: 2px; background: ${C.line}; }
  .tab { position: relative; display: flex; gap: 14px; align-items: center; width: 100%; min-height: 44px; padding: 0; border: none; background: none; font: inherit; text-align: left; cursor: pointer; color: ${C.ink}; }
  .dot { flex: none; width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; background: #fff; border: 2px solid ${C.brand}; color: ${C.brandInk}; }
  .tab[aria-selected='true'] .dot { background: ${C.brand}; color: #fff; }
  .lbl { font-size: 15px; font-weight: 600; }
  .tab[aria-selected='true'] .lbl { font-weight: 700; color: ${C.brandInk}; }
  .tab:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; border-radius: 10px; }
  .inline { margin: 2px 0 6px 42px; }
`;
const Detail = styled.div`
  padding: 14px; border-radius: 12px; background: ${C.soft};
  .top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .name { font-size: 17px; font-weight: 700; }
  .by { padding: 2px 10px; border-radius: 999px; background: #fff; color: ${C.brandInk}; font-size: 12px; font-weight: 700; }
  .fmt { margin-top: 6px; font-size: 14px; color: #4a4d63; }
  .notes { margin-top: 8px; font-size: 15px; line-height: 1.55; color: ${C.ink}; }
  @media (min-width: 900px) { margin-top: 24px; padding: 20px; border-radius: 16px; .notes { font-size: 15.5px; } }
`;
const Chips = styled.div`
  display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 4px;
  @media (max-width: 600px) { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
`;
const Chip = styled.button`
  flex-shrink: 0; min-height: 44px; padding: 0 14px; border-radius: 999px; border: none; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  background: ${(p) => (p.$on ? C.ink : C.bg)};
  color: ${(p) => (p.$on ? '#fff' : '#3b3e52')};
`;
const Q = styled.li`
  list-style: none; border-bottom: 1px solid #eef0f5;
  &:last-child { border-bottom: none; }
  .head { width: 100%; display: flex; gap: 14px; align-items: flex-start; justify-content: space-between; text-align: left; padding: 16px 0; border: none; background: none; font: inherit; color: inherit; cursor: pointer; min-height: 44px; }
  .body { flex: 1; min-width: 0; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; margin-bottom: 8px; }
  .text { font-size: 16px; line-height: 1.45; font-weight: 600; color: ${C.ink}; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 13.5px; color: ${C.muted}; }
  .by { font-weight: 700; color: ${C.brandInk}; }
  .chev { flex: none; margin-top: 6px; transition: transform 0.15s; }
  .head[aria-expanded='true'] .chev { transform: rotate(180deg); }
  .src { margin: 0 0 16px; padding: 14px; border-radius: 12px; background: #f8f9fc; display: flex; flex-direction: column; gap: 8px; }
  .srclabel { font-size: 12.5px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.04em; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  @media (min-width: 900px) { .text { font-size: 17px; } .tag { font-size: 12px; } .head { padding: 18px 0; } }
  @media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
`;
const Link = styled.a`
  display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid #d9dbe5;
  font-size: 13.5px; font-weight: 600; color: ${C.brandInk}; text-decoration: none; background: #fff; overflow-wrap: anywhere;
  &:hover { text-decoration: underline; }
`;
const MoreBtn = styled(Ghost)`
  margin-top: 16px; width: 100%; min-height: 48px;
  @media (min-width: 900px) { width: auto; }
`;
const Topic = styled.button`
  min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1.5px solid ${(p) => (p.$on ? C.brand : 'transparent')}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer;
  background: ${C.soft}; color: #3b3f9e; text-align: left;
`;
const Probes = styled.ul`
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px;
  li { padding: 16px; border-radius: 14px; border: 1px solid ${C.line}; }
  li[data-gap='true'] { border-color: #f1d9b8; background: #fffaf2; }
  .q { font-size: 16px; font-weight: 600; line-height: 1.45; }
  .why { margin-top: 6px; font-size: 14px; line-height: 1.5; color: #4a4d63; }
  .based { margin-top: 10px; display: inline-block; padding: 3px 10px; border-radius: 8px; background: ${C.bg}; font-size: 12.5px; color: #4a4d63; }
  li[data-gap='true'] .based { background: #fdf1e4; color: #8a4a08; font-weight: 600; }
`;
const Disc = styled.a`
  display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 12px 0; border-bottom: 1px solid #eef0f5; text-decoration: none; color: ${C.ink};
  &:last-child { border-bottom: none; padding-bottom: 0; }
  &:hover .t { text-decoration: underline; }
  .badge { flex: none; width: 64px; padding: 3px 0; border-radius: 8px; font-size: 11.5px; font-weight: 700; text-align: center; }
  .t { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  .site { flex: none; max-width: 30%; font-size: 13px; color: ${C.muted}; overflow-wrap: anywhere; }
  @media (max-width: 600px) { .site { display: none; } }
  @media (min-width: 900px) { gap: 14px; .badge { width: 72px; font-size: 12px; } .t { font-size: 15.5px; } }
`;
const Plan = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 20px; box-sizing: border-box;
  .top { display: flex; align-items: baseline; justify-content: space-between; }
  h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .count { font-size: 13px; color: ${C.muted}; }
  .bar { height: 6px; border-radius: 999px; background: #eef0f5; margin: 10px 0 20px; }
  .fill { height: 6px; border-radius: 999px; background: ${C.brand}; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
  li { display: flex; gap: 12px; align-items: flex-start; }
  .dot { flex: none; width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
  .dot[data-s='done'] { background: ${C.success}; }
  .dot[data-s='todo'] { border: 2px solid ${C.brand}; color: ${C.brandInk}; }
  .dot[data-s='later'] { border: 2px solid #d9dbe5; color: ${C.muted}; }
  .t { font-size: 15px; font-weight: 700; }
  .d { font-size: 13.5px; color: ${C.muted}; }
  .act { margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: inherit; font-weight: 700; }
  .act.out { min-height: 44px; padding: 0 16px; border: 1.5px solid ${C.brand}; border-radius: 10px; background: #fff; color: ${C.brandInk}; font-size: 14px; }
  .act.solid { min-height: 44px; padding: 0 20px; border: none; border-radius: 12px; background: ${C.brand}; color: #fff; font-size: 15px; }
  @media (min-width: 900px) { border-radius: 20px; padding: 24px; }
`;
const Mini = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 14px; font-size: 18px; font-weight: 700; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  li { padding: 14px; border-radius: 14px; background: #f8f9fc; }
  .t { font-size: 14.5px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
  .th { margin-top: 4px; font-size: 13px; color: ${C.muted}; }
  @media (min-width: 900px) { border-radius: 20px; padding: 24px; }
`;
const Another = styled.div`
  padding: 4px 8px; font-size: 14px; line-height: 1.5; color: ${C.muted};
  a { display: inline-block; padding: 10px 0; font-weight: 600; color: ${C.brandInk}; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;
const Steps = styled.ul`
  list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px;
  li { display: flex; align-items: center; gap: 12px; font-size: 16px; color: #9aa0b4; }
  li[data-state='done'] { color: ${C.ink}; }
  li[data-state='now'] { color: ${C.ink}; font-weight: 600; }
  .dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #d5d8e3; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #fff; }
  li[data-state='done'] .dot { background: #22a05a; border-color: #22a05a; }
  li[data-state='now'] .dot { border-color: ${C.brand}; border-top-color: transparent; animation: prepSpin 0.8s linear infinite; }
  @keyframes prepSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { li[data-state='now'] .dot { animation: none; border-top-color: ${C.brand}; } }
`;
const Foot = styled.p`
  margin: 0; font-size: 13.5px; line-height: 1.5; color: ${C.muted};
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
`;

function Svg({ children, size = 16, stroke = 'currentColor', width = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const ChevronLeft = () => <Svg width={2.4}><path d="M15 6l-6 6 6 6" /></Svg>;
const ChevronDown = () => <Svg size={20} stroke={C.muted}><path d="M6 9l6 6 6-6" /></Svg>;
const CheckIcon = () => <Svg stroke="#ffffff" width={3}><path d="M5 12l4.5 4.5L19 7" /></Svg>;
const InfoIcon = () => <Svg stroke={C.muted} width={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></Svg>;
const MicIcon = () => <Svg size={18} width={2}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;

/** True while the media query matches. */
function useMedia(query) {
  const get = useCallback(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false), [query]);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const h = () => setOn(mq.matches);
    h();
    if (mq.addEventListener) { mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }
    mq.addListener(h);
    return () => mq.removeListener(h);
  }, [query]);
  return on;
}

function SourceLinks({ list }) {
  return list.map((s) => {
    const href = safeUrl(s.url);
    const label = sourcePillLabel(s);
    return href
      ? <Link key={s.id} href={href} target="_blank" rel="noopener noreferrer">{label || href}</Link>
      : <span key={s.id} style={{ fontSize: 13.5, color: C.muted }}>{label}</span>;
  });
}

function QuestionRow({ q, sources }) {
  const [open, setOpen] = useState(false);
  const list = sourcesFor(q.sourceIds, sources);
  const latest = monthYear(q.mostRecent);
  const tag = categoryTag(q.category);
  const panelId = useId();
  return (
    <Q>
      <button type="button" className="head" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span className="body">
          <span className="tag" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
          <span className="text" style={{ display: 'block' }}>{q.text}</span>
          <span className="meta">
            <span className="by">{reportedBy(q)}</span>
            {latest && <span>Latest: {latest}</span>}
          </span>
        </span>
        <span className="chev"><ChevronDown /></span>
      </button>
      {open && (
        <div className="src" id={panelId}>
          <div className="srclabel">WHERE IT WAS REPORTED</div>
          <div className="pills">
            {list.length ? <SourceLinks list={list} /> : <span style={{ fontSize: 14, color: C.muted }}>No source links for this question.</span>}
          </div>
        </div>
      )}
    </Q>
  );
}

/** The process as a numbered stepper (tabs). Wide: a horizontal line of circles. Narrow: a vertical timeline with the detail under the chosen step. */
const TIPS_SHOWN = 5;
function TipsList({ tips }) {
  const [all, setAll] = useState(false);
  const list = (Array.isArray(tips) ? tips : []).map((t) => (typeof t === 'string' ? t : String(t?.text || ''))).filter(Boolean);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, TIPS_SHOWN);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Tips from candidates</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.55 }}>
        {shown.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}
      </ul>
      {list.length > TIPS_SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} style={{ marginTop: 8, minHeight: 44, padding: 0, border: 'none', background: 'none', font: 'inherit', fontSize: 15, fontWeight: 600, color: C.brandInk, cursor: 'pointer' }}>
          {all ? 'Show fewer tips' : `Show ${list.length - TIPS_SHOWN} more tips`}
        </button>
      )}
    </div>
  );
}

function ProcessStepper({ rounds }) {
  const [sel, setSel] = useState(0);
  const narrow = useMedia('(max-width: 700px)');
  const base = useId();
  const refs = useRef([]);
  const idx = selectStep(rounds, sel);
  const r = rounds[idx];
  const n = rounds.length;
  const onKey = (e) => {
    const next = stepKeyTarget(e.key, idx, n);
    if (next == null) return;
    e.preventDefault();
    setSel(next);
    const el = refs.current[next];
    if (el) el.focus();
  };
  const detail = (round, i) => {
    return (
      <Detail role="tabpanel" id={`${base}-panel-${i}`} aria-labelledby={`${base}-tab-${i}`}>
        <div className="top">
          <span className="name">{round.name}</span>
          <span className="by">{reportedBy(round)}</span>
        </div>
        {round.format && <div className="fmt">{round.format}</div>}
        {round.notes && <div className="notes">{round.notes}</div>}
      </Detail>
    );
  };
  const tabProps = (i) => ({
    className: 'tab',
    ref: (el) => { refs.current[i] = el; },
    type: 'button',
    role: 'tab',
    id: `${base}-tab-${i}`,
    'aria-selected': i === idx,
    'aria-controls': i === idx ? `${base}-panel-${i}` : undefined,
    tabIndex: i === idx ? 0 : -1,
    onClick: () => setSel(i),
    onKeyDown: onKey,
  });
  if (narrow) {
    return (
      <Timeline role="tablist" aria-label="Interview steps" aria-orientation="vertical">
        <div className="line" aria-hidden="true" />
        {rounds.map((round, i) => (
          <div key={`${round.name}-${i}`} role="presentation">
            <button {...tabProps(i)}><span className="dot">{i + 1}</span><span className="lbl">{round.name}</span></button>
            {i === idx && <div className="inline">{detail(round, i)}</div>}
          </div>
        ))}
      </Timeline>
    );
  }
  return (
    <>
      <StepWrap>
        <div className="track" role="tablist" aria-label="Interview steps" style={{ gridTemplateColumns: `repeat(${n}, minmax(88px, 1fr))` }}>
          <div className="line" aria-hidden="true" style={{ left: `calc(100% / ${n * 2})`, right: `calc(100% / ${n * 2})` }} />
          {rounds.map((round, i) => (
            <button key={`${round.name}-${i}`} {...tabProps(i)}><span className="dot">{i + 1}</span><span className="lbl">{round.name}</span></button>
          ))}
        </div>
      </StepWrap>
      {r && detail(r, idx)}
    </>
  );
}

function Progress({ elapsed }) {
  const now = progressStep(elapsed);
  return (
    <Card aria-live="polite">
      <h2>Researching</h2>
      <p className="sub">This can take one to three minutes the first time for a company. You can leave this page, the research keeps going and will be here when you come back. {Math.floor(elapsed / 1000)}s so far.</p>
      <Steps>
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < now ? 'done' : i === now ? 'now' : 'todo'}>
            <span className="dot">{i < now ? '✓' : ''}</span>{s}
          </li>
        ))}
      </Steps>
    </Card>
  );
}

function PlanCard({ plan, practice, onStories, onPractice, onCode }) {
  return (
    <Plan aria-label="Your plan">
      <div className="top"><h2>Your plan</h2><span className="count">{plan.doneCount} of {plan.total} done</span></div>
      <div className="bar" role="progressbar" aria-label="Plan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={plan.percent}>
        <div className="fill" style={{ width: `${plan.percent}%` }} />
      </div>
      <ol>
        {plan.steps.map((s, i) => {
          const state = s.done ? 'done' : s.id === 'practice' ? 'later' : 'todo';
          return (
            <li key={s.id}>
              <span className="dot" data-s={state}>{s.done ? <CheckIcon /> : i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">{s.title}</div>
                {s.id === 'practice' && practice.count > 0 ? (
                  <>
                    <div className="d">{sessionsLabel(practice.count)}</div>
                    {practice.line && <div className="d" style={{ marginTop: 2 }}>{practice.line}</div>}
                  </>
                ) : (s.detail && <div className="d">{s.detail}</div>)}
                {s.id === 'stories' && <button type="button" className="act out" onClick={onStories}>Build my stories</button>}
                {s.id === 'practice' && <button type="button" className="act solid" onClick={onPractice}><MicIcon />Practice out loud</button>}
                {s.id === 'practice' && <button type="button" className="act out" onClick={onCode} style={{ marginLeft: 8 }}>Practice coding</button>}
              </div>
            </li>
          );
        })}
      </ol>
    </Plan>
  );
}

export default function InterviewPrep() {
  const params = useParams();
  const { tailoredId, prepId: routePrepId } = params;
  const byId = isPrepIdMode(params);
  const navigate = useNavigate();
  const [tp, setTp] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | researching | ready | failed | timeout | unavailable | missing
  const [prep, setPrep] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [companyInput, setCompanyInput] = useState('');
  const [cat, setCat] = useState('all');
  const [topicOpen, setTopicOpen] = useState(null);
  const [probes, setProbes] = useState({ state: 'idle', list: [] });
  const [practice, setPractice] = useState({ count: 0, line: '' });
  const [focus, setFocus] = useState(null);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesSignal, setStoriesSignal] = useState(0);
  const [headPrep, setHeadPrep] = useState(null); // prep id mode: company, role and scope for the heading
  const run = useRef(0);
  const prepId = useRef(null);
  const typed = useRef('');
  const [showAll, setShowAll] = useState(false);
  const [stories, setStories] = useState(null); // null until the stories section reports its saved list
  const handleStories = useCallback((list) => { setStories(Array.isArray(list) ? list : null); }, []);

  const personalize = useCallback(async (id, runId) => {
    setProbes({ state: 'loading', list: [] });
    try {
      const res = await interviewPrepAPI.personalize(id, tailoredId);
      if (run.current !== runId) return;
      setProbes({ state: 'done', list: Array.isArray(res.data?.probes) ? res.data.probes : [] });
    } catch {
      if (run.current === runId) setProbes({ state: 'error', list: [] });
    }
  }, [tailoredId]);

  const start = useCallback(async (profile, refresh, typedCompany) => {
    const runId = ++run.current;
    if (typedCompany) typed.current = String(typedCompany).trim();
    const company = String(typed.current || companyOf(profile)).trim();
    if (!company) { setCompanyInput(companyFromUrl(profile.jobUrl)); setPhase('needsCompany'); return; }
    const jobTitle = String(profile.jobTitle || '').trim();
    setPhase('researching'); setElapsed(0); setErrMsg(''); setProbes({ state: 'idle', list: [] });
    const began = Date.now();
    const fail = (e) => {
      if (run.current !== runId) return true;
      if (e?.response?.status === 503 && e.response.data?.code === 'search_not_configured') { setPhase('unavailable'); return true; }
      // 403/429 from the plan limiter: free plans have no research, paid plans have a monthly count.
      if ([403, 429].includes(e?.response?.status) && (e.response.data?.upgradeRequired || e.response.data?.feature === 'interview_prep')) {
        setErrMsg(e.response.data?.upgradeRequired ? 'upgrade' : 'limit'); setPhase('locked'); return true;
      }
      setErrMsg(e?.response?.data?.error || e?.response?.data?.message || ''); setPhase('failed'); return true;
    };
    const finish = (id, p) => {
      if (run.current !== runId) return;
      prepId.current = id; setPrep(p); setPhase('ready'); personalize(id, runId);
    };
    try {
      const res = await interviewPrepAPI.start(company, jobTitle, refresh);
      if (run.current !== runId) return;
      const { id, status, prep: ready } = res.data || {};
      if (status === 'ready' && ready) return finish(id, ready);
      if (!id) return fail();
      // Poll every 3 seconds, give up after four minutes.
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (run.current !== runId) return;
        setElapsed(Date.now() - began);
        if (pollExpired(began)) { setPhase('timeout'); return; }
        let r;
        try { r = await interviewPrepAPI.get(id); } catch (e) { fail(e); return; }
        if (run.current !== runId) return;
        const d = r.data || {};
        if (d.status === 'ready' && d.prep) return finish(id, d.prep);
        if (d.status === 'failed') { setErrMsg(d.error || ''); setPhase('failed'); return; }
      }
    } catch (e) { fail(e); }
  }, [personalize]);

  // Prep id mode: open a prep by its id (no tailored resume), or run it again when `again` is the prep to refresh.
  const runById = useCallback(async (again) => {
    const runId = ++run.current;
    setErrMsg(''); setProbes({ state: 'idle', list: [] });
    if (again) { setPhase('researching'); setElapsed(0); } else setPhase('loading');
    const began = Date.now();
    const fail = (e) => {
      if (run.current !== runId) return;
      if (e?.response?.status === 404) { setPhase('missing'); return; }
      const st = apiErrorState(e);
      if (st.kind === 'unavailable') { setPhase('unavailable'); return; }
      if (st.kind === 'upgrade' || st.kind === 'limit') { setErrMsg(st.kind); setPhase('locked'); return; }
      setErrMsg(st.message); setPhase('failed');
    };
    const finish = (id, p) => {
      if (run.current !== runId) return;
      prepId.current = id; setPrep(p); setHeadPrep(p); setPhase('ready'); personalize(id, runId);
    };
    try {
      let id = routePrepId;
      let d;
      if (again) {
        const res = await interviewPrepAPI.start(again.company, again.jobTitle, true, { level: again.level, source: again.source });
        if (run.current !== runId) return;
        d = res.data || {};
        id = d.id;
      } else {
        const res = await interviewPrepAPI.get(id);
        if (run.current !== runId) return;
        d = res.data || {};
      }
      for (;;) {
        if (d.prep && (d.prep.company || d.prep.role)) setHeadPrep(d.prep);
        if (d.status === 'ready' && d.prep) return finish(id, d.prep);
        if (d.status === 'failed') { setErrMsg(typeof d.error === 'string' ? d.error : ''); setPhase('failed'); return; }
        if (!id) { setPhase('failed'); return; }
        setPhase('researching');
        // Poll every 3 seconds, give up after four minutes.
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (run.current !== runId) return;
        setElapsed(Date.now() - began);
        if (pollExpired(began)) { setPhase('timeout'); return; }
        let r;
        try { r = await interviewPrepAPI.get(id); } catch (e) { fail(e); return; }
        if (run.current !== runId) return;
        d = r.data || {};
      }
    } catch (e) { fail(e); }
  }, [routePrepId, personalize]);

  // Tick the progress lines while waiting.
  useEffect(() => {
    if (phase !== 'researching') return undefined;
    const t0 = Date.now() - elapsed;
    const t = setInterval(() => setElapsed(Date.now() - t0), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (byId) return undefined;
    let alive = true;
    setPhase('loading'); setPrep(null);
    tailoredProfileAPI.getById(tailoredId).then((res) => {
      if (!alive) return;
      const profile = res.data?.tailoredProfile || res.data?.profile || res.data;
      if (!profile || !(companyOf(profile) || profile.jobTitle)) { setPhase('missing'); return; }
      setTp(profile);
      start(profile, false);
    }).catch(() => { if (alive) setPhase('missing'); });
    return () => { alive = false; run.current += 1; };
  }, [tailoredId, start, byId]);

  useEffect(() => {
    if (!byId) return undefined;
    setPrep(null); setHeadPrep(null);
    runById(null);
    return () => { run.current += 1; };
  }, [byId, runById]);

  const idHead = byId ? prepHeading(headPrep) : null;
  const refreshPrep = () => { if (byId) runById(refreshBody(headPrep)); else start(tp, true); };
  const retryPrep = (refresh) => { if (byId) runById(refresh && headPrep ? refreshBody(headPrep) : null); else start(tp, refresh); };

  const company = byId ? '' : tp ? companyOf(tp) || tp.jobTitle : '';
  const role = byId ? idHead.role : tp && companyOf(tp) ? tp.jobTitle : '';
  const questions = prep ? rankByFocus(filterQuestions(prep.questions, cat), focus) : [];
  const counts = prep ? categoryCounts(prep.questions) : {};
  const coverage = prep?.coverage;
  const generated = prep?.generatedAt ? monthYear(prep.generatedAt) : '';
  const generatedFull = prep?.generatedAt && Number.isFinite(Date.parse(prep.generatedAt))
    ? new Date(prep.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : generated;
  const rounds = cleanRounds(prep?.process?.rounds);
  const sources = Array.isArray(prep?.sources) ? prep.sources : [];
  const discussions = cleanDiscussions(prep?.discussions);


  useEffect(() => { setShowAll(false); }, [prep]);

  // What this person said they are aiming at. Failures show nothing.
  useEffect(() => {
    setFocus(null);
    if (phase !== 'ready' || !prepId.current) return undefined;
    let alive = true;
    interviewPrepAPI.getFocus(prepId.current).then((res) => { if (alive) setFocus(cleanFocusLogic(res.data?.focus)); }).catch(() => {});
    return () => { alive = false; };
  }, [phase, prep]);

  // Past practice sessions, for the plan. Failures show nothing.
  useEffect(() => {
    setPractice({ count: 0, line: '' });
    if (phase !== 'ready' || !prepId.current) return undefined;
    let alive = true;
    interviewPrepAPI.listPractice(prepId.current)
      .then((res) => { if (alive) setPractice(practiceSummary(res.data?.sessions)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [phase, prep]);

  const hasCompany = byId ? !idHead.acrossCompanies && Boolean(headPrep) : Boolean(tp && companyOf(tp));
  const name = byId ? (idHead.acrossCompanies ? idHead.title : String(headPrep?.company || '')) : (company ? company : 'Interview prep');
  const goBack = () => (byId ? navigate('/interview-prep') : navigate(-1));
  const chip = coverageChip(coverage);
  const shown = visibleQuestions(questions, showAll, 6);
  const moreLabel = showMoreLabel(questions.length, shown.length);
  const topicList = rankByFocus(cleanTopics(prep?.topics), focus);
  const probeList = probes.state === 'done' ? probes.list : [];
  const plan = planProgress({
    sourceCount: sources.length,
    questionCount: (prep?.questions || []).length,
    probeCount: probeList.length,
    storyCount: Array.isArray(stories) ? stories.length : null,
  });
  const storyList = storyRows(stories);
  const goPractice = () => { if (prepId.current) navigate(`/interview-prep/practice/${prepId.current}`); };
  const goCode = () => { if (prepId.current) navigate(`/interview-prep/code/${prepId.current}`); };
  const openStories = () => { setStoriesOpen(true); setStoriesSignal((n) => n + 1); };

  return (
    <Page>
      <div className="wrap">
        <Back type="button" onClick={goBack}><ChevronLeft />{byId ? 'Interview prep' : 'Back to resumes'}</Back>
        <Head>
          <div className="who">
            {hasCompany && <div className="logo" aria-hidden="true" style={{ background: logoColor(name) }}>{companyInitial(name)}</div>}
            <div className="txt">
              <h1>{name}</h1>
              {role && <div className="role">{role}</div>}
              {(phase === 'ready' || (byId && idHead.acrossCompanies && headPrep)) && (
                <div className="chips">
                  {byId && idHead.acrossCompanies && headPrep && <span className="chip">Across companies</span>}
                  {phase === 'ready' && <span className="chip" style={{ background: chip.bg, color: chip.fg, fontWeight: 700 }}>{chip.label}</span>}
                  {phase === 'ready' && generated && <span className="chip">Researched {generated}</span>}
                  {phase === 'ready' && <span className="chip">{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>}
                </div>
              )}
            </div>
          </div>
          {phase === 'ready' && <Ghost type="button" onClick={refreshPrep} title={generatedFull ? `Last researched ${generatedFull}` : undefined}>Refresh research</Ghost>}
        </Head>

        {phase === 'loading' && <Center><CircularProgress size={26} /></Center>}
        {phase === 'missing' && (
          <Center>
            <h2>{byId ? 'We could not find that prep' : 'We could not find that resume'}</h2>
            <p>It may have been deleted. Go back and pick another one.</p>
            <Btn type="button" onClick={goBack}>Go back</Btn>
          </Center>
        )}
        {phase === 'unavailable' && (
          <Center>
            <h2>Interview research is not available yet</h2>
            <p>We will turn it on soon.</p>
            <Btn type="button" $ghost onClick={goBack}>Go back</Btn>
          </Center>
        )}
        {phase === 'needsCompany' && (
          <Center>
            <h2>Which company is this interview for?</h2>
            <p>This resume does not say. Tell us and we will look up what candidates reported for {tp?.jobTitle || 'this role'}.</p>
            <input
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && companyInput.trim()) start(tp, false, companyInput); }}
              placeholder="Company name"
              aria-label="Company name"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, border: '1.5px solid #d5d8e3', borderRadius: 12, marginBottom: 12 }}
            />
            <Btn type="button" disabled={!companyInput.trim()} onClick={() => start(tp, false, companyInput)}>Start research</Btn>
          </Center>
        )}
        {phase === 'locked' && (
          <Center>
            <h2>{errMsg === 'upgrade' ? 'Recent interview questions are a Pro feature' : 'You have used this month’s interview research'}</h2>
            <p>{errMsg === 'upgrade'
              ? 'Pro and Pro Plus read what candidates recently shared about this role at this company, and show you the likely questions with their sources and dates.'
              : 'Your allowance renews next month. Pro Plus includes more research each month.'}</p>
            <Btn type="button" onClick={() => navigate('/pricing')}>See plans</Btn>
            <Btn type="button" $ghost onClick={goBack}>Go back</Btn>
          </Center>
        )}
        {phase === 'researching' && <Progress elapsed={elapsed} />}
        {phase === 'timeout' && (
          <Center>
            <h2>This is taking longer than expected</h2>
            <p>The research did not finish in time. Please try again in a moment.</p>
            <Btn type="button" onClick={() => retryPrep(false)}>Try again</Btn>
          </Center>
        )}
        {phase === 'failed' && (
          <Center>
            <h2>We could not finish the research</h2>
            <p>{errMsg || 'Something went wrong on our side. Please try again.'}</p>
            <Btn type="button" onClick={() => retryPrep(true)}>Retry</Btn>
          </Center>
        )}

        {phase === 'ready' && prep && (
          <div className="layout">
            <div className="main">
              <Card>
                <div className="eyebrow">The short version</div>
                {prep.summary ? <p className="lead">{prep.summary}</p> : <p className="sub">No summary was written for this role.</p>}
                {coverage === 'thin' && <Note>We found limited public information for this role, so treat this as a starting point.</Note>}
                {coverage === 'none' && (
                  <Note>
                    We did not find public interview reports for this company and role, so the general role questions are not available.
                    The questions based on your own resume are below.
                  </Note>
                )}
                {coverage !== 'none' && sources.length > 0 && (
                  <InfoNote>
                    <InfoIcon />
                    <span>Built from {sources.length} public {sources.length === 1 ? 'page' : 'pages'}, with the date and link for each. Questions change, so use this as a guide, not a promise.</span>
                  </InfoNote>
                )}
              </Card>

              {coverage !== 'none' && prepId.current && (
                <FocusCard prepId={prepId.current} role={prep?.role} level={prep?.level} focus={focus} onSaved={setFocus} />
              )}

              {coverage !== 'none' && rounds.length > 0 && (
                <Card>
                  <h2>How the process usually goes</h2>
                  <ProcessStepper key={String(prep.generatedAt || prepId.current || '')} rounds={rounds} />
                  {prep.process?.timeline && <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>{prep.process.timeline}</p>}
                  <TipsList tips={prep.process?.tips} />
                </Card>
              )}

              {coverage !== 'none' && (
                <Card>
                  <div className="titlerow"><h2>Questions candidates reported</h2></div>
                  {(prep.questions || []).length === 0 ? (
                    <p className="sub" style={{ marginBottom: 0 }}>No specific questions were reported for this role yet.</p>
                  ) : (
                    <>
                      <p className="sub" style={{ marginBottom: 0 }}>Tap a question to see where it was reported.</p>
                      <Chips role="group" aria-label="Filter by category">
                        {CATEGORIES.map((c) => (
                          <Chip key={c.id} type="button" $on={cat === c.id} aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setShowAll(false); }}>
                            {c.label} {counts[c.id] || 0}
                          </Chip>
                        ))}
                      </Chips>
                      {questions.length === 0 ? (
                        <p className="sub" style={{ marginBottom: 0, marginTop: 12 }}>No questions in this category.</p>
                      ) : (
                        <ul style={{ margin: '4px 0 0', padding: 0 }}>
                          {shown.map((q, i) => <QuestionRow key={q.id || i} q={q} sources={sources} />)}
                        </ul>
                      )}
                      {moreLabel && <MoreBtn type="button" onClick={() => setShowAll(true)}>{moreLabel}</MoreBtn>}
                    </>
                  )}
                </Card>
              )}

              <Card>
                <h2>What they may ask about your resume</h2>
                <p className="sub">Based on your own resume, not on public reports.</p>
                {probes.state === 'loading' && <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 12 }}><CircularProgress size={22} /><span className="sub" style={{ margin: 0 }}>Reading your resume</span></div>}
                {probes.state === 'error' && (
                  <>
                    <p className="sub">We could not build these just now.</p>
                    <TextBtn type="button" onClick={() => personalize(prepId.current, run.current)}>Try again</TextBtn>
                  </>
                )}
                {probes.state === 'done' && probes.list.length === 0 && <p className="sub" style={{ marginBottom: 0 }}>No resume questions came back this time.</p>}
                {probes.state === 'done' && probes.list.length > 0 && (
                  <Probes>
                    {probes.list.map((p, i) => {
                      const gap = isGapProbe(p);
                      const detailText = gap ? gapDetail(p.basedOn) : p.basedOn;
                      return (
                        <li key={i} data-gap={gap ? 'true' : 'false'}>
                          <div className="q">{typeof p.question === 'string' ? p.question : ''}</div>
                          {typeof p.why === 'string' && p.why && <div className="why">{p.why}</div>}
                          {gap && <div className="based">{`A gap: not in your profile yet${detailText ? `. ${detailText}` : ''}`}</div>}
                          {!gap && typeof p.basedOn === 'string' && p.basedOn && <div className="based">From your resume: {p.basedOn}</div>}
                        </li>
                      );
                    })}
                  </Probes>
                )}
              </Card>

              {coverage !== 'none' && topicList.length > 0 && (
                <Card>
                  <h2>Topics to review</h2>
                  <p className="sub">Tap a topic to see why it matters.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {topicList.map((t, i) => (
                      <Topic key={`${t.name}-${i}`} type="button" $on={topicOpen === i} aria-expanded={topicOpen === i} onClick={() => setTopicOpen(topicOpen === i ? null : i)}>{t.name}</Topic>
                    ))}
                  </div>
                  {topicOpen != null && topicList[topicOpen]?.why && (
                    <Note style={{ background: C.soft, color: C.ink }}>{topicList[topicOpen].why}</Note>
                  )}
                </Card>
              )}

              <Stories prepId={prepId.current} tailoredId={byId ? undefined : tailoredId} open={storiesOpen} openSignal={storiesSignal} onPractice={goPractice} onStoriesChange={handleStories} />

              {discussions.length > 0 && (
                <Card>
                  <h2>Discussions to read</h2>
                  <p className="sub">Reddit, LeetCode and other threads where candidates talk about interviewing at this company. We could not read these in full, so nothing above is taken from them. Open them for the full stories.</p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {discussions.map((d) => {
                      const b = discussionBadge(d);
                      const meta = [d.site, monthYear(d.date)].filter(Boolean).join(', ');
                      return (
                        <Disc key={d.url} href={d.href} target="_blank" rel="noopener noreferrer">
                          <span className="badge" style={{ background: b.bg, color: b.fg }}>{b.label}</span>
                          <span className="t">{d.title}</span>
                          {meta && <span className="site">{meta}</span>}
                        </Disc>
                      );
                    })}
                  </div>
                </Card>
              )}

              {sources.length > 0 && (
                <Card>
                  <h2>Sources</h2>
                  <p className="sub">Public pages this research is based on.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><SourceLinks list={sources} /></div>
                </Card>
              )}
              {prep.disclaimer && <Foot>{prep.disclaimer}</Foot>}
            </div>

            <aside className="rail" aria-label="Your plan">
              <PlanCard plan={plan} practice={practice} onStories={openStories} onPractice={goPractice} onCode={goCode} />
              {storyList.length > 0 && (
                <Mini aria-label="Your stories">
                  <h2>Your stories</h2>
                  <ul>
                    {storyList.map((s) => (
                      <li key={s.key}>
                        <div className="t">{s.title}</div>
                        {s.theme && <div className="th">{s.theme}</div>}
                      </li>
                    ))}
                  </ul>
                </Mini>
              )}
              <Another>
                Another interview coming up?{' '}
                <a href="/interview-prep" onClick={(e) => { e.preventDefault(); navigate('/interview-prep'); }}>Prepare for another one</a>
              </Another>
            </aside>
          </div>
        )}
      </div>

    </Page>
  );
}
