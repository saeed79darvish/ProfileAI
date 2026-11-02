import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress, Menu, MenuItem, Portal, Snackbar, Button } from '@mui/material';
import {
  ArrowBackIosNew as BackIcon,
  MoreHoriz as MoreIcon,
  FileDownloadOutlined as DownloadIcon,
  Check as CheckIcon,
  PriorityHigh as BangIcon,
  ExpandMore as DownIcon,
  ExpandLess as UpIcon,
  AutoAwesome as SparkIcon,
} from '@mui/icons-material';
import { tailoredProfileAPI, resumeAPI } from '@/services/api';
import { hideWhileTyping } from '@/styles/keyboard';
import NoteField from '../flow/NoteField';
import PdfCanvasPreview from '../PdfCanvasPreview';
import {
  STATUSES, companyOf, statusOf, gapsOf, gapLine, strengthsOf, alsoInJobOf, groupVersions, shortDate, tileColor, TAG_LABEL,
} from './tailoredModel';

/**
 * Tailored resumes: one resume per job, and where each application stands.
 *
 * List: every card the same shape (company, role, match, status, date, one
 * line of gaps), filtered by status. Detail: a status bar to update, then
 * Resume (the PDF and its headline and summary), Fit (gaps to address and
 * strengths) and Interview prep (a round, a format, any worries, then a
 * four-part guide). Phones open the detail full screen; desktop shows the
 * list and the detail side by side.
 */

const ROUNDS = [
  ['phone-screen', 'Phone screen'], ['technical-coding', 'Technical'], ['system-design', 'System design'],
  ['behavioral', 'Behavioral'], ['hiring-manager', 'Hiring manager'], ['final-round', 'Final / onsite'],
];
const FORMATS = [['phone', 'Phone call'], ['video', 'Video call'], ['in-person', 'In person']];
const PREP_STEPS = ['Reading the job and your resume', 'Picking likely questions', 'Planning how to handle your gaps', 'Writing your guide'];
const ROUND_LABEL = Object.fromEntries(ROUNDS);

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', soft: '#f0f0fc', bg: '#f3f4f8' };

/* ── shared pieces ─────────────────────────────────────────────── */

const Tile = styled.div`
  flex-shrink: 0;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${(p) => Math.round(p.$size / 4)}px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => p.$bg};
  color: #fff;
  font-weight: 800;
  font-size: ${(p) => Math.round(p.$size * 0.42)}px;
`;
const Logo = ({ name, size = 48 }) => <Tile $size={size} $bg={tileColor(name)} aria-hidden>{String(name || '?').trim()[0]?.toUpperCase() || '?'}</Tile>;

const Pill = styled.span`
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: ${(p) => (p.$good ? '#e9f8ef' : '#fdf1e4')};
  color: ${(p) => (p.$good ? '#1f8a4c' : '#b45309')};
`;

const STATUS_TONE = {
  tailored: ['#f1f2f6', '#4b5063', '#9ca3af'],
  applied: ['#eaf1ff', '#2563eb', '#2563eb'],
  interview: ['#e9f8ef', '#16794a', '#22a05a'],
  offer: ['#f3ecff', '#6d28d9', '#7c3aed'],
};
const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  background: ${(p) => STATUS_TONE[p.$s][0]};
  color: ${(p) => STATUS_TONE[p.$s][1]};
  &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: ${(p) => STATUS_TONE[p.$s][2]}; }
`;
const statusLabel = (s) => STATUSES.find((x) => x.id === s)?.label || 'Tailored';

const FilterTabs = styled.div`
  display: flex;
  gap: 18px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid ${C.line};
  &::-webkit-scrollbar { display: none; }

  button {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 0 12px;
    border: none;
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
    background: none;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    color: #8a8fa3;
    cursor: pointer;
  }
  button[aria-selected='true'] { color: ${C.ink}; border-bottom-color: ${C.brand}; }
  .n { min-width: 20px; padding: 1px 6px; border-radius: 999px; background: #f1f2f6; color: #5a5e7a; font-size: 12.5px; text-align: center; }
`;

const IconBtn = styled.button`
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: ${(p) => p.$tone || '#4b5063'};
  cursor: pointer;
  &:hover { background: #f4f5f9; }
  svg { font-size: 22px; }
`;

const NewBtn = styled.button`
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 12px;
  background: ${C.brand};
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
`;

const ListHead = styled.div`
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 24px; font-weight: 800; color: ${C.ink}; letter-spacing: -0.01em; }
  p { margin: 4px 0 14px; font-size: 15px; color: ${C.muted}; }
`;

/* ── list cards ────────────────────────────────────────────────── */

const Card = styled.article`
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${(p) => (p.$on ? '#cfd1f7' : C.line)};
  cursor: pointer;

  .top { display: flex; gap: 14px; align-items: flex-start; }
  .main { flex: 1; min-width: 0; }
  .co { font-size: 17px; font-weight: 700; color: ${C.ink}; }
  .role { margin-top: 2px; font-size: 15px; line-height: 1.35; color: #4a4d63; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; font-size: 14px; color: #8a8fa3; }
  .foot { display: flex; align-items: center; gap: 4px; margin-top: 12px; padding-top: 6px; border-top: 1px solid #eef0f4; }
  .gaps { flex: 1; font-size: 14.5px; font-weight: 500; }
  .gaps[data-tone='bad'] { color: #b42318; }
  .gaps[data-tone='warn'] { color: #b45309; }
  .gaps[data-tone='good'] { color: #1f8a4c; }
`;

const Row = styled.button`
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border: 1.5px solid ${(p) => (p.$on ? '#cfd1f7' : 'transparent')};
  border-radius: 14px;
  background: ${(p) => (p.$on ? '#f2f2fd' : 'transparent')};
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { background: ${(p) => (p.$on ? '#f2f2fd' : '#f8f9fc')}; }

  .main { flex: 1; min-width: 0; }
  .line { display: flex; justify-content: space-between; gap: 8px; }
  .co { font-size: 16px; font-weight: 700; color: ${C.ink}; }
  .pct { font-size: 15px; font-weight: 700; color: ${(p) => (p.$good ? '#1f8a4c' : '#b45309')}; }
  .role { margin-top: 2px; font-size: 14.5px; color: #4a4d63; }
  .meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 13.5px; color: #8a8fa3; }
`;

/* ── detail ───────────────────────────────────────────────────── */

// Portalled to the body: the profile page's panels would otherwise trap a
// fixed element under the navbar and the tools dock.
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: ${C.ink};

  .bar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 4px; border-bottom: 1px solid ${C.line}; }
  .back { display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 12px; border: none; background: none; font: inherit; font-size: 17px; font-weight: 600; color: ${C.ink}; cursor: pointer; }
  .back svg { font-size: 18px; }
  .scroll { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
`;

const Head = styled.div`
  padding: ${(p) => (p.$desk ? '0' : '18px 16px 0')};
  .who { display: flex; flex-wrap: ${(p) => (p.$desk ? 'wrap' : 'nowrap')}; gap: 14px 16px; align-items: flex-start; }
  .main { flex: 1 1 220px; min-width: 0; }
  h3 { margin: 0; font-size: ${(p) => (p.$desk ? 28 : 22)}px; font-weight: 800; letter-spacing: -0.01em; }
  .role { margin-top: 2px; font-size: ${(p) => (p.$desk ? 17 : 15.5)}px; color: #4a4d63; line-height: 1.35; }
  .date { margin-top: 4px; font-size: 14px; color: #9ca3af; }
  .score { text-align: right; }
  .score b { display: block; font-size: 26px; font-weight: 800; color: ${(p) => (p.$good ? '#1f8a4c' : '#b45309')}; }
  .score span { font-size: 13px; color: ${C.muted}; }
  .actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; margin-left: auto; }
  .actions button { white-space: nowrap; }
  .versions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
`;

const VersionChip = styled.button`
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$on ? C.brand : C.line)};
  background: ${(p) => (p.$on ? C.soft : '#fff')};
  color: ${(p) => (p.$on ? '#4b4fc4' : '#5a5e7a')};
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const StatusBar = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  flex: 1 1 320px;
  min-width: 0;

  button {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    color: #9ca3af;
    cursor: pointer;
    &::before { content: ''; display: block; height: 5px; margin-bottom: 8px; border-radius: 999px; background: #e5e7ef; }
  }
  button[data-done='true'] { color: ${C.ink}; }
  button[data-done='true']::before { background: ${(p) => (p.$tone === 'good' ? '#3fae6a' : C.brand)}; }
`;

const Tracker = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 22px;
  margin-top: 18px;
  ${(p) => p.$desk && `padding: 16px 18px; border-radius: 16px; background: #f7f8fb;`}
  .ring { display: flex; align-items: center; gap: 12px; }
  .ring b { display: block; font-size: 16px; }
  .ring span { font-size: 13.5px; color: ${C.muted}; }
`;

const Ring = ({ score }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const good = score >= 85;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`${score}% match`} style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e7e8f0" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={good ? '#3fae6a' : '#e08a2c'} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="14" fontWeight="800" fill={C.ink}>{score}%</text>
    </svg>
  );
};

const DetailTabs = styled(FilterTabs)`
  margin-top: 18px;
  padding: 0 ${(p) => (p.$desk ? 0 : 16)}px;
  gap: 24px;
  button { font-size: 16.5px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #22a05a; }
`;

const Pane = styled.div`
  padding: ${(p) => (p.$desk ? '22px 0 4px' : '16px 16px 24px')};
  background: ${(p) => (p.$desk ? 'transparent' : C.bg)};
  min-height: ${(p) => (p.$desk ? 0 : '60%')};
`;

const Box = styled.section`
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${C.line};
  & + & { margin-top: 14px; }

  .boxhead { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px; }
  h4 { margin: 0; font-size: 18px; font-weight: 700; color: ${C.ink}; }
  .count { font-size: 14px; color: #9ca3af; }
  p.lead { margin: 6px 0 16px; font-size: 15.5px; line-height: 1.5; color: ${C.muted}; }
`;

const Gap = styled.div`
  display: flex;
  gap: 12px;
  padding: 14px 0;
  & + & { border-top: 1px solid #eef0f4; }

  .ico { flex-shrink: 0; width: 22px; height: 22px; margin-top: 2px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: ${(p) => GAP_TONE[p.$tag][2]}; }
  .ico svg { font-size: 15px; }
  .t { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 16.5px; font-weight: 700; color: ${C.ink}; }
  .tag { padding: 2px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; background: ${(p) => GAP_TONE[p.$tag][0]}; color: ${(p) => GAP_TONE[p.$tag][1]}; }
  .n { margin-top: 4px; font-size: 15px; line-height: 1.5; color: ${C.muted}; }
`;
const GAP_TONE = {
  required: ['#fdecec', '#b42318', '#dc3c3c'],
  missing: ['#f1f2f6', '#4b5063', '#9aa0b1'],
  preferred: ['#fdf1e4', '#b45309', '#e08a2c'],
  partial: ['#fdf1e4', '#b45309', '#e08a2c'],
};

const Strengths = styled.div`
  padding: 18px;
  border-radius: 18px;
  background: #f1faf4;
  border: 1.5px solid #cfe9d8;
  color: #1f6b3a;

  .h { width: 100%; display: flex; align-items: center; gap: 10px; padding: 0; border: none; background: none; font: inherit; font-size: 18px; font-weight: 700; color: #1f6b3a; text-align: left; cursor: ${(p) => (p.$fold ? 'pointer' : 'default')}; }
  .h .label { flex: 1; }
  .ok { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #3fae6a; color: #fff; }
  .ok svg { font-size: 16px; }
  ul { margin: 12px 0 0; padding-left: 20px; }
  li { margin: 6px 0; font-size: 15.5px; line-height: 1.45; color: #2d4a37; }
`;

const Also = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  .k { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: #5a5e7a; text-transform: uppercase; margin-right: 4px; }
  span.c { padding: 5px 12px; border-radius: 999px; background: #fdf6e7; color: #8a5a12; font-size: 14px; font-weight: 600; }
`;

const FitGrid = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$desk ? 'minmax(0, 1fr) minmax(0, 0.85fr)' : 'minmax(0, 1fr)')};
  gap: 16px;
  align-items: start;
`;

const ResumeGrid = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$desk ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)')};
  gap: 20px;
  align-items: start;

  .sheet { position: relative; border-radius: 14px; border: 1.5px solid ${C.line}; background: #fff; overflow: hidden; max-height: ${(p) => (p.$desk ? 560 : 440)}px; cursor: zoom-in; }
  .sheet::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; background: linear-gradient(transparent, #fff); }
  .loading { display: flex; align-items: center; justify-content: center; gap: 10px; height: 300px; color: ${C.muted}; font-size: 14.5px; }
  .k { margin-top: 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #5a5e7a; }
  .headline { margin: 4px 0 16px; font-size: 19px; font-weight: 700; }
  .summary { margin: 4px 0 18px; font-size: 16px; line-height: 1.55; color: #2f3247; white-space: pre-line; }
  .btns { display: flex; flex-wrap: wrap; gap: 10px; }
`;

const Soft = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1.5px solid ${(p) => (p.$brand ? '#e1e2f8' : C.line)};
  background: ${(p) => (p.$brand ? C.soft : '#fff')};
  color: ${(p) => (p.$brand ? '#4b4fc4' : C.ink)};
  font: inherit;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
  svg { font-size: 18px; }
`;

const Primary = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: ${(p) => (p.$big ? 54 : 46)}px;
  padding: 0 20px;
  border: none;
  border-radius: 14px;
  background: ${C.brand};
  color: #fff;
  font: inherit;
  font-size: ${(p) => (p.$big ? 17 : 15.5)}px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;

const Secondary = styled(Primary)`
  background: #fff;
  color: ${C.ink};
  border: 1.5px solid #e2e4ec;
  font-weight: 600;
`;

const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid ${C.line};
  background: #fff;
  > button:first-child:not(:only-child) { flex: 0 0 38%; }
  > button:last-child { flex: 1; }
  ${hideWhileTyping}
`;

const Banner = styled.div`
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #e9f8ef;
  color: #16794a;
  font-size: 16px;
  font-weight: 600;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 20px;
`;

const Chip = styled.button`
  min-height: 42px;
  padding: 6px 15px;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$on ? C.brand : C.line)};
  background: ${(p) => (p.$on ? C.soft : '#fff')};
  color: ${(p) => (p.$on ? '#4b4fc4' : C.ink)};
  font: inherit;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
`;

const Label = styled.div`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5a5e7a;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$desk ? 'minmax(0, 1.2fr) minmax(0, 1fr)' : 'minmax(0, 1fr)')};
  column-gap: 28px;
`;

const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  li { display: flex; align-items: center; gap: 12px; padding: 14px 0; font-size: 16px; color: #9ca3af; }
  li + li { border-top: 1px solid #eef0f4; }
  li[data-state='done'], li[data-state='active'] { color: ${C.ink}; }
  .d { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #f1f2f6; flex-shrink: 0; }
  li[data-state='done'] .d { background: #3fae6a; color: #fff; }
  .d svg { font-size: 17px; }
`;

const GuideGrid = styled.div`
  display: grid;
  grid-template-columns: ${(p) => (p.$desk ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)')};
  gap: 14px;
`;

const Guide = styled.section`
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${C.line};
  overflow: hidden;

  .h { width: 100%; display: flex; align-items: center; gap: 10px; padding: 16px 18px; border: none; background: none; font: inherit; font-size: 17px; font-weight: 700; color: ${C.ink}; text-align: left; cursor: ${(p) => (p.$fold ? 'pointer' : 'default')}; }
  .h .label { flex: 1; }
  .b { padding: 0 18px 16px; }
  .item { padding: 10px 0; font-size: 15.5px; line-height: 1.5; color: #2f3247; }
  .item + .item { border-top: 1px solid #f0f1f5; }
  .item b { display: block; color: ${C.ink}; }
  .item small { display: block; margin-top: 4px; font-size: 14.5px; color: ${C.muted}; }
`;

const Empty = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: ${C.muted};
  font-size: 15.5px;
  line-height: 1.5;
  h3 { margin: 0 0 6px; font-size: 19px; color: ${C.ink}; }
  button { margin-top: 16px; }
`;

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  @media (max-width: 1100px) { grid-template-columns: minmax(0, 1fr); }
`;

/* ── the preview, cached per copy ─────────────────────────────── */

const previewCache = new Map();

function ResumeSheet({ tp, data, onOpen }) {
  const key = `${tp.id}:${tp.updatedAt || ''}`;
  const [url, setUrl] = useState(previewCache.get(key) || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (previewCache.has(key)) { setUrl(previewCache.get(key)); return undefined; }
    let live = true;
    setUrl('');
    setFailed(false);
    resumeAPI.preview('professional', null, data)
      .then((res) => {
        const u = res.data?.preview;
        if (!u) throw new Error('no preview');
        previewCache.set(key, u);
        if (live) setUrl(u);
      })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div className="sheet" role="button" tabIndex={0} aria-label="Open the resume full screen" onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      {url ? <PdfCanvasPreview url={url} title="Tailored resume" />
        : <div className="loading">{failed ? 'Preview unavailable. Tap to open it.' : <><CircularProgress size={18} />Loading preview…</>}</div>}
    </div>
  );
}

/* ── the component ────────────────────────────────────────────── */

/**
 * @param {Object} props
 * @param {Array} props.items - tailored profiles
 * @param {(fn) => void} props.onItemsChange - setState for items
 * @param {boolean} props.isMobile
 * @param {Object} props.user
 * @param {Object} props.profile
 * @param {() => void} props.onNew - Tailor for a Job
 * @param {(tp, tab: 'preview'|'edit') => void} props.onOpenResume - the Download Resume screen
 * @param {string} [props.requestedId] - deep link (?resumeId=)
 */
export default function TailoredResumes({ items, loading, onItemsChange, isMobile, user, profile, onNew, onOpenResume, requestedId }) {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [versionId, setVersionId] = useState(null);
  const [menu, setMenu] = useState(null); // { anchor, tp }
  const [undo, setUndo] = useState(null); // { tp, timer }
  const undoRef = useRef(null);
  undoRef.current = undo;

  const groups = useMemo(() => groupVersions(items), [items]);
  const counts = useMemo(() => {
    const c = { all: groups.length, tailored: 0, applied: 0, interview: 0, offer: 0 };
    for (const g of groups) c[statusOf(g.latest)] += 1;
    return c;
  }, [groups]);
  const tabs = [['all', 'All'], ['applied', 'Applied'], ['interview', 'Interview'], ...(counts.offer ? [['offer', 'Offer']] : []), ['tailored', 'Tailored']];
  const shown = filter === 'all' ? groups : groups.filter((g) => statusOf(g.latest) === filter);

  // Desktop always shows one; phones open one on tap.
  const group = groups.find((g) => g.versions.some((v) => String(v.id) === String(selectedId)))
    || (!isMobile ? shown[0] || groups[0] : null);
  const tp = group ? group.versions.find((v) => String(v.id) === String(versionId)) || group.latest : null;

  useEffect(() => {
    if (!requestedId || !items.length) return;
    const hit = items.find((t) => String(t.id) === String(requestedId) || String(t.applyPilotApplicationId) === String(requestedId));
    if (hit) { setSelectedId(hit.id); setVersionId(hit.id); }
  }, [requestedId, items]);

  // A delete waits five seconds for Undo; leaving the page sends it.
  useEffect(() => () => {
    const u = undoRef.current;
    if (u) { clearTimeout(u.timer); tailoredProfileAPI.delete(u.tp.id).catch(() => {}); }
  }, []);

  useEffect(() => {
    if (!isMobile || !tp) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, tp]);

  const open = (g) => { setSelectedId(g.id); setVersionId(null); };
  const close = () => { setSelectedId(null); setVersionId(null); };

  const remove = (target) => {
    setMenu(null);
    if (undo) { clearTimeout(undo.timer); tailoredProfileAPI.delete(undo.tp.id).catch(() => {}); }
    onItemsChange((prev) => prev.filter((t) => t.id !== target.id));
    const wasOpen = String(tp?.id) === String(target.id);
    if (wasOpen) close();
    const timer = setTimeout(() => {
      tailoredProfileAPI.delete(target.id).catch(() => onItemsChange((prev) => [...prev, target]));
      setUndo(null);
    }, 5000);
    setUndo({ tp: target, timer, wasOpen });
  };

  const restore = () => {
    if (!undo) return;
    clearTimeout(undo.timer);
    onItemsChange((prev) => [...prev, undo.tp]);
    // Deleted from its own page: Undo takes you back there.
    if (undo.wasOpen) { setSelectedId(undo.tp.id); setVersionId(undo.tp.id); }
    setUndo(null);
  };

  const setStatus = (target, status) => {
    const before = target.tailoredData?.trackStatus;
    const patch = (s) => onItemsChange((prev) => prev.map((t) => (t.id === target.id ? { ...t, tailoredData: { ...t.tailoredData, trackStatus: s } } : t)));
    patch(status);
    tailoredProfileAPI.setStatus(target.id, status).catch(() => patch(before));
  };

  const updateItem = (id, tailoredDataPatch) => onItemsChange((prev) => prev.map((t) => (t.id === id ? { ...t, tailoredData: { ...t.tailoredData, ...tailoredDataPatch } } : t)));

  const renderCard = (g) => {
    const t = g.latest;
    const company = companyOf(t) || t.jobTitle;
    const s = statusOf(t);
    const gl = gapLine(t);
    return (
      <Card key={g.id} $on={String(selectedId) === String(g.id)} onClick={() => open(g)}>
        <div className="top">
          <Logo name={company} size={48} />
          <div className="main">
            <div className="co">{company}</div>
            {companyOf(t) && <div className="role">{t.jobTitle}</div>}
          </div>
          {t.matchScore != null && <Pill $good={t.matchScore >= 85}>{t.matchScore}%</Pill>}
        </div>
        <div className="meta" style={{ paddingLeft: 62 }}>
          <StatusChip $s={s}>{statusLabel(s)}</StatusChip>
          <span>Created {shortDate(t.createdAt)}{g.versions.length > 1 ? ` · ${g.versions.length} versions` : ''}</span>
        </div>
        <div className="foot" style={{ marginLeft: 62 }}>
          <span className="gaps" data-tone={gl.tone}>{gl.text}</span>
          <IconBtn type="button" $tone={C.brand} aria-label="Download PDF" onClick={(e) => { e.stopPropagation(); onOpenResume(t, 'preview'); }}><DownloadIcon /></IconBtn>
          <IconBtn type="button" aria-label="More actions" onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, tp: t }); }}><MoreIcon /></IconBtn>
        </div>
      </Card>
    );
  };

  const renderRow = (g) => {
    const t = g.latest;
    const company = companyOf(t) || t.jobTitle;
    const s = statusOf(t);
    return (
      <Row key={g.id} type="button" $on={group?.id === g.id} $good={t.matchScore >= 85} onClick={() => open(g)}>
        <Logo name={company} size={44} />
        <div className="main">
          <div className="line"><span className="co">{company}</span>{t.matchScore != null && <span className="pct">{t.matchScore}%</span>}</div>
          {companyOf(t) && <div className="role">{t.jobTitle}</div>}
          <div className="meta"><StatusChip $s={s}>{statusLabel(s)}</StatusChip><span>{shortDate(t.createdAt)}{g.versions.length > 1 ? ` · ${g.versions.length} versions` : ''}</span></div>
        </div>
      </Row>
    );
  };

  const list = (
    <>
      <ListHead>
        <div className="row">
          <h2>Tailored resumes</h2>
          <NewBtn type="button" onClick={onNew}>+ New</NewBtn>
        </div>
        <p>One resume per job. Track where each one is.</p>
      </ListHead>
      <FilterTabs role="tablist" aria-label="Filter by status">
        {tabs.map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {name}<span className="n">{counts[id]}</span>
          </button>
        ))}
      </FilterTabs>
      {loading ? (
        <Empty><CircularProgress size={26} /></Empty>
      ) : !groups.length ? (
        <Empty>
          <h3>No tailored resumes yet</h3>
          Tailor your resume for a job and it lands here, with its match and where the application stands.
          <div><Primary type="button" onClick={onNew}>Tailor for a job</Primary></div>
        </Empty>
      ) : !shown.length ? (
        <Empty>Nothing here yet. Update a resume&rsquo;s status from its page and it moves to this tab.</Empty>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>{shown.map(renderCard)}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>{shown.map(renderRow)}</div>
      )}
    </>
  );

  const detail = tp && (
    <Detail
      key={tp.id}
      tp={tp}
      group={group}
      desk={!isMobile}
      user={user}
      profile={profile}
      onVersion={setVersionId}
      onStatus={(s) => setStatus(tp, s)}
      onOpenResume={onOpenResume}
      onUpdate={updateItem}
      onMenu={(anchor) => setMenu({ anchor, tp })}
      onBack={close}
    />
  );

  return (
    <>
      {isMobile ? (
        <>
          {list}
          {detail}
        </>
      ) : (
        <Split>
          <div style={{ padding: 20, borderRadius: 20, background: '#fff', border: `1.5px solid ${C.line}` }}>{list}</div>
          {detail ? <div style={{ padding: 24, borderRadius: 20, background: '#fff', border: `1.5px solid ${C.line}`, minWidth: 0 }}>{detail}</div> : null}
        </Split>
      )}

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)} sx={{ zIndex: 1400 }}>
        {menu?.tp?.jobUrl && <MenuItem onClick={() => { window.open(menu.tp.jobUrl, '_blank', 'noopener,noreferrer'); setMenu(null); }}>View job</MenuItem>}
        <MenuItem onClick={() => { onOpenResume(menu.tp, 'preview'); setMenu(null); }}>Download PDF</MenuItem>
        <MenuItem onClick={() => remove(menu.tp)} sx={{ color: '#b42318' }}>Delete</MenuItem>
      </Menu>

      <Portal>
        <Snackbar
          open={!!undo}
          message="Resume deleted"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ zIndex: 1500, bottom: { xs: 'calc(90px + env(safe-area-inset-bottom, 0px))', sm: 24 } }}
          action={<Button color="inherit" size="small" onClick={restore} sx={{ fontWeight: 700 }}>Undo</Button>}
        />
      </Portal>
    </>
  );
}

/* ── one resume ───────────────────────────────────────────────── */

function Detail({ tp, group, desk, user, profile, onVersion, onStatus, onOpenResume, onUpdate, onMenu, onBack }) {
  const td = tp.tailoredData || {};
  const company = companyOf(tp) || tp.jobTitle;
  const status = statusOf(tp);
  const statusIndex = STATUSES.findIndex((s) => s.id === status);
  const prepWaiting = status === 'interview' && !td.interviewPrep;
  const [tab, setTab] = useState(prepWaiting ? 'prep' : 'resume');
  const [showStrengths, setShowStrengths] = useState(false);
  const gaps = gapsOf(tp);
  const strengths = strengthsOf(tp);
  const also = alsoInJobOf(tp);
  const required = gaps.filter((g) => g.tag === 'required').length;

  // Interview prep: ask, details, loading, results.
  const draft = td.interviewPrepDraft;
  const [step, setStep] = useState(td.interviewPrep ? 'results' : draft ? 'details' : 'ask');
  const [gotInterview, setGotInterview] = useState(!!draft || status === 'interview');
  const [round, setRound] = useState(td.interviewPrepMeta?.interviewLevel || draft?.round || '');
  const [format, setFormat] = useState(td.interviewPrepMeta?.interviewFormat || draft?.format || '');
  const [worries, setWorries] = useState(draft?.inviteMeta?.specificConcerns || '');
  const [prepError, setPrepError] = useState('');
  const [progress, setProgress] = useState(0);
  const [openGuide, setOpenGuide] = useState(0);

  const data = useMemo(() => {
    const merged = { ...td };
    if (!merged.fullName && !merged.name) merged.fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    for (const k of ['email', 'phone', 'location', 'linkedinUrl', 'githubUrl', 'portfolioUrl']) {
      if (!merged[k]) merged[k] = k === 'email' ? (profile?.email || user?.email) : profile?.[k];
    }
    return merged;
  }, [td, user, profile]);

  const haveInterview = () => {
    setGotInterview(true);
    setStep('details');
    if (statusIndex < 2) onStatus('interview');
  };

  const build = async () => {
    setPrepError('');
    setStep('loading');
    setProgress(0);
    const timers = [2500, 7000, 14000].map((ms, i) => setTimeout(() => setProgress(i + 1), ms));
    try {
      const { data: res } = await tailoredProfileAPI.generateInterviewPrep(tp.id, {
        interviewLevel: round, interviewFormat: format, specificConcerns: worries,
      });
      if (!res?.success) throw new Error('Could not build the guide. Please try again.');
      onUpdate(tp.id, { interviewPrep: res.interviewPrep, interviewPrepMeta: res.interviewPrepMeta });
      setStep('results');
      setOpenGuide(0);
    } catch (err) {
      setPrepError(err.response?.status === 429
        ? 'You have used your interview prep allowance for now.'
        : err.response?.data?.error || err.message || 'Could not build the guide. Please try again.');
      setStep('details');
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const header = (
    <Head $desk={desk} $good={tp.matchScore >= 85}>
      <div className="who">
        <Logo name={company} size={desk ? 64 : 52} />
        <div className="main">
          <h3>{company}</h3>
          {companyOf(tp) && <div className="role">{tp.jobTitle}</div>}
          {desk && <div className="date">Created {new Date(tp.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
        </div>
        {desk ? (
          <div className="actions">
            {tp.jobUrl && <Secondary type="button" onClick={() => window.open(tp.jobUrl, '_blank', 'noopener,noreferrer')}>View job</Secondary>}
            <Primary type="button" onClick={() => onOpenResume(tp, 'preview')}>Download PDF</Primary>
            <IconBtn type="button" aria-label="More actions" style={{ border: `1.5px solid ${C.line}` }} onClick={(e) => onMenu(e.currentTarget)}><MoreIcon /></IconBtn>
          </div>
        ) : tp.matchScore != null && (
          <div className="score"><b>{tp.matchScore}%</b><span>match</span></div>
        )}
      </div>
      {group.versions.length > 1 && (
        <div className="versions" role="group" aria-label="Versions">
          {group.versions.map((v, i) => (
            <VersionChip key={v.id} type="button" $on={v.id === tp.id} onClick={() => onVersion(v.id)}>
              {i === 0 ? 'Latest' : 'Earlier'} · {shortDate(v.createdAt)}
            </VersionChip>
          ))}
        </div>
      )}
      <Tracker $desk={desk}>
        {desk && tp.matchScore != null && (
          <div className="ring">
            <Ring score={tp.matchScore} />
            <div><b>Match</b><span>{required ? `${required} required gap${required === 1 ? '' : 's'}` : `${gaps.length} gap${gaps.length === 1 ? '' : 's'}`}</span></div>
          </div>
        )}
        <StatusBar role="group" aria-label="Application status" $tone={statusIndex >= 2 ? 'good' : 'brand'}>
          {STATUSES.map((s, i) => (
            <button key={s.id} type="button" data-done={i <= statusIndex} aria-pressed={s.id === status} onClick={() => onStatus(s.id)}>{s.label}</button>
          ))}
        </StatusBar>
      </Tracker>
      <DetailTabs $desk={desk} role="tablist" aria-label="Resume details">
        {[['resume', 'Resume'], ['fit', 'Fit'], ['prep', 'Interview prep']].map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {name}{id === 'prep' && prepWaiting && <span className="dot" aria-label="needs prep" />}
          </button>
        ))}
      </DetailTabs>
    </Head>
  );

  const resumeTab = (
    <ResumeGrid $desk={desk}>
      <ResumeSheet tp={tp} data={data} onOpen={() => onOpenResume(tp, 'preview')} />
      <div>
        {td.title && <><div className="k">Headline</div><div className="headline">{td.title}</div></>}
        {td.summary && <><div className="k">Summary</div><p className="summary">{td.summary}</p></>}
        <div className="btns">
          <Soft type="button" $brand onClick={() => onOpenResume(tp, 'edit')}><SparkIcon />Edit with AI</Soft>
          <Soft type="button" onClick={() => onOpenResume(tp, 'preview')}>Open full screen</Soft>
        </div>
      </div>
    </ResumeGrid>
  );

  const gapsBox = (
    <Box>
      <div className="boxhead"><h4>Gaps to address</h4><span className="count">{gaps.length} found</span></div>
      {gaps.length ? gaps.map((g) => (
        <Gap key={g.title} $tag={g.tag}>
          <span className="ico"><BangIcon /></span>
          <div>
            <div className="t">{g.title}<span className="tag">{TAG_LABEL[g.tag]}</span></div>
            {g.note && <div className="n">{g.note}</div>}
          </div>
        </Gap>
      )) : <p className="lead">Nothing the job asks for is missing from this resume.</p>}
      {also.length > 0 && (
        <Also><span className="k">Also in the job</span>{also.map((a) => <span key={a} className="c">{a}</span>)}</Also>
      )}
    </Box>
  );

  const strengthsBox = strengths.length > 0 && (
    <Strengths $fold={!desk}>
      <button type="button" className="h" onClick={() => !desk && setShowStrengths((v) => !v)} aria-expanded={desk || showStrengths}>
        <span className="ok"><CheckIcon /></span><span className="label">{strengths.length} strong match{strengths.length === 1 ? '' : 'es'}</span>
        {!desk && (showStrengths ? <UpIcon /> : <DownIcon />)}
      </button>
      {(desk || showStrengths) && <ul>{strengths.map((s) => <li key={s}>{s}</li>)}</ul>}
    </Strengths>
  );

  const fitTab = (
    <FitGrid $desk={desk}>
      {desk ? <>{gapsBox}{strengthsBox}</> : <>{strengthsBox}{gapsBox}</>}
    </FitGrid>
  );

  const prep = td.interviewPrep || {};
  const guide = [
    { title: 'Your pitch', items: [prep.roundOverview, ...(prep.talkingPoints || [])].filter(Boolean).map((p) => ({ text: typeof p === 'string' ? p : p.point || p.text || '' })) },
    { title: 'Likely questions', items: [...(prep.technicalQuestions || []), ...(prep.behavioralQuestions || [])].map((q) => (typeof q === 'string' ? { head: q } : { head: q.question, text: q.tip || q.approach || q.hint || q.answerTip || q.starTip || q.why || '' })) },
    { title: 'Handling your gaps', items: (prep.gapMitigation || []).map((g) => (typeof g === 'string' ? { text: g } : { head: g.gap || g.skill, text: g.strategy || g.howToAddress || '' })) },
    { title: 'Questions to ask', items: (prep.questionsToAsk || []).map((q) => ({ text: typeof q === 'string' ? q : q.question || '' })) },
  ].filter((s) => s.items.some((i) => i.head || i.text));

  const prepTab = (() => {
    if (step === 'ask') {
      return (
        <Box>
          <h4>Got an interview at {company}?</h4>
          <p className="lead">We&rsquo;ll build a prep guide from this job, your resume and your gaps.</p>
          <div style={{ display: 'flex', flexDirection: desk ? 'row' : 'column', gap: 10 }}>
            <Primary $big type="button" style={{ flex: 1 }} onClick={haveInterview}>Yes, I have an interview</Primary>
            <Secondary $big type="button" style={{ flex: 1 }} onClick={() => { setGotInterview(false); setStep('details'); }}>Not yet, prepare anyway</Secondary>
          </div>
        </Box>
      );
    }
    if (step === 'loading') {
      return (
        <Box>
          <h4>Building your prep guide…</h4>
          <p className="lead">About half a minute.</p>
          <Steps>
            {PREP_STEPS.map((name, i) => {
              const state = i < progress ? 'done' : i === progress ? 'active' : 'pending';
              return (
                <li key={name} data-state={state}>
                  <span className="d">{state === 'done' ? <CheckIcon /> : state === 'active' ? <CircularProgress size={16} sx={{ color: C.brand }} /> : null}</span>{name}
                </li>
              );
            })}
          </Steps>
        </Box>
      );
    }
    if (step === 'results' && guide.length) {
      const meta = td.interviewPrepMeta || {};
      return (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 18 }}>Your {ROUND_LABEL[meta.interviewLevel] ? `${ROUND_LABEL[meta.interviewLevel].toLowerCase()} ` : ''}prep guide</h4>
            <button type="button" onClick={() => setStep('details')} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 15, fontWeight: 600, color: '#4b4fc4', cursor: 'pointer' }}>Prep another round</button>
          </div>
          <GuideGrid $desk={desk}>
            {guide.map((s, i) => {
              const isOpen = desk || openGuide === i;
              return (
                <Guide key={s.title} $fold={!desk}>
                  <button type="button" className="h" aria-expanded={isOpen} onClick={() => !desk && setOpenGuide(isOpen ? -1 : i)}>
                    <span className="label">{s.title}</span>{!desk && (isOpen ? <UpIcon /> : <DownIcon />)}
                  </button>
                  {isOpen && (
                    <div className="b">
                      {s.items.filter((it) => it.head || it.text).map((it, k) => (
                        <div key={k} className="item">{it.head && <b>{it.head}</b>}{it.head ? it.text && <small>{it.text}</small> : it.text}</div>
                      ))}
                    </div>
                  )}
                </Guide>
              );
            })}
          </GuideGrid>
        </>
      );
    }
    // details
    return (
      <>
        {gotInterview && <Banner>Nice work. Let&rsquo;s get you ready.</Banner>}
        <Box>
          <FormGrid $desk={desk}>
            <div>
              <Label>Which round?</Label>
              <Chips>{ROUNDS.map(([id, name]) => <Chip key={id} type="button" $on={round === id} aria-pressed={round === id} onClick={() => setRound(id)}>{name}</Chip>)}</Chips>
            </div>
            <div>
              <Label>Format</Label>
              <Chips>{FORMATS.map(([id, name]) => <Chip key={id} type="button" $on={format === id} aria-pressed={format === id} onClick={() => setFormat(id)}>{name}</Chip>)}</Chips>
            </div>
          </FormGrid>
          <Label>Anything you&rsquo;re worried about? (optional)</Label>
          <NoteField multiline value={worries} onChange={setWorries} placeholder="e.g. rusty on system design" label="Anything you're worried about" hints={tp.jobTitle || ''} maxLength={500} />
          {prepError && <p style={{ margin: '12px 0 0', color: '#b42318', fontSize: 14.5 }}>{prepError}</p>}
          {desk && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <Secondary type="button" onClick={() => setStep(td.interviewPrep ? 'results' : 'ask')}>Back</Secondary>
              <Primary type="button" onClick={build} disabled={!round}>Build prep guide</Primary>
            </div>
          )}
        </Box>
      </>
    );
  })();

  const body = (
    <Pane $desk={desk}>
      {tab === 'resume' && resumeTab}
      {tab === 'fit' && fitTab}
      {tab === 'prep' && prepTab}
    </Pane>
  );

  if (desk) return <>{header}{body}</>;

  const prepFooter = tab === 'prep' && step === 'details';
  return (
    <Portal>
    <Overlay role="dialog" aria-label={`${company} tailored resume`}>
      <div className="bar">
        <button type="button" className="back" onClick={onBack}><BackIcon />Tailored resumes</button>
        <IconBtn type="button" aria-label="More actions" onClick={(e) => onMenu(e.currentTarget)}><MoreIcon /></IconBtn>
      </div>
      <div className="scroll">{header}{body}</div>
      <Footer>
        {prepFooter ? (
          <>
            <Secondary $big type="button" onClick={() => setStep(td.interviewPrep ? 'results' : 'ask')}>Back</Secondary>
            <Primary $big type="button" onClick={build} disabled={!round}>Build prep guide</Primary>
          </>
        ) : (
          <>
            {tp.jobUrl && <Secondary $big type="button" onClick={() => window.open(tp.jobUrl, '_blank', 'noopener,noreferrer')}>View job</Secondary>}
            <Primary $big type="button" onClick={() => onOpenResume(tp, 'preview')}>Download PDF</Primary>
          </>
        )}
      </Footer>
    </Overlay>
    </Portal>
  );
}
