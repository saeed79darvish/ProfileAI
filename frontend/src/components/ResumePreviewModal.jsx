import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Reorder, useDragControls } from 'framer-motion';
import { Dialog, CircularProgress, useMediaQuery } from '@mui/material';
import {
  Close as CloseIcon,
  Download,
  Delete as DeleteIcon,
  Add as AddIcon,
  DragIndicator as DragIndicatorIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { resumeAPI, profileAPI } from '../services/api';
import PdfCanvasPreview from './PdfCanvasPreview';

// === Config ===
const TEMPLATE_OPTIONS = [
  { id: 'professional', label: 'Classic', desc: 'Traditional, ATS-friendly', dot: '#374151' },
  { id: 'modern', label: 'Modern', desc: 'Two-column with sidebar', dot: '#10b981' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean editorial style', dot: '#374151' },
  { id: 'centered', label: 'Centered', desc: 'Centered header, categorized skills', dot: '#000000' },
];

const ACCENT_COLORS = [
  '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#374151', '#6d28d9',
];

// Body sections a candidate can reorder. Name + contact always stay pinned at
// the very top of the resume and are intentionally not part of this list.
const ALL_SECTIONS = ['summary', 'skills', 'experience', 'projects', 'education'];
const SECTION_META = {
  summary: { label: 'Summary', desc: 'Professional summary' },
  skills: { label: 'Skills', desc: 'Core competencies' },
  experience: { label: 'Experience', desc: 'Work history' },
  projects: { label: 'Projects', desc: 'Selected work' },
  education: { label: 'Education', desc: 'Degrees & schools' },
};
// In the Modern (two-column) template, Skills & Education live in the fixed
// sidebar — only these main-column sections honor a custom order there.
const MODERN_MAIN_SECTIONS = ['summary', 'experience', 'projects'];

// Suggest the most effective section order for a candidate based on how much
// experience they have (new grad vs seasoned) and their likely industry.
// Returns { order, label } so the UI can explain *why* it's recommended.
const computeSuggestedOrder = (data) => {
  if (!data) return { order: [...ALL_SECTIONS], label: 'Standard order' };

  const experiences = Array.isArray(data.experience) ? data.experience : [];
  const realExp = experiences.filter((e) => e && (e.company || e.title || e.description));
  const title = String(data.title || data.headline || '').toLowerCase();

  // Flatten skills (object-of-arrays OR flat array) into a searchable string.
  let skillsText = '';
  if (Array.isArray(data.skills)) {
    skillsText = data.skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).join(' ');
  } else if (data.skills && typeof data.skills === 'object') {
    skillsText = Object.values(data.skills).flat().map((s) => (typeof s === 'string' ? s : s?.name || '')).join(' ');
  }
  const blob = `${title} ${skillsText}`.toLowerCase();

  const isNewGrad =
    realExp.length === 0 ||
    (realExp.length <= 1 && /(intern|junior|jr\b|entry|graduate|student|trainee|new[ -]?grad|associate)/.test(title));

  let industry = 'general';
  if (/(engineer|developer|software|data|devops|programmer|frontend|back[- ]?end|full[- ]?stack|machine learning|\bml\b|\bai\b|cloud|security|sre)/.test(blob)) industry = 'tech';
  else if (/(design|ux|ui|creative|artist|brand|motion|graphic|illustrat|product design)/.test(blob)) industry = 'creative';
  else if (/(research|ph\.?d|professor|scientist|academic|lecturer|postdoc)/.test(blob)) industry = 'academic';

  if (isNewGrad) {
    if (industry === 'tech') return { order: ['summary', 'skills', 'projects', 'education', 'experience'], label: 'Recommended for new grads in tech' };
    if (industry === 'creative') return { order: ['summary', 'projects', 'skills', 'education', 'experience'], label: 'Recommended for new creatives' };
    if (industry === 'academic') return { order: ['summary', 'education', 'projects', 'skills', 'experience'], label: 'Recommended for academic / research' };
    return { order: ['summary', 'education', 'projects', 'skills', 'experience'], label: 'Recommended for early-career candidates' };
  }

  if (industry === 'tech') return { order: ['summary', 'experience', 'skills', 'projects', 'education'], label: 'Recommended for experienced tech roles' };
  if (industry === 'creative') return { order: ['summary', 'experience', 'projects', 'skills', 'education'], label: 'Recommended for experienced creatives' };
  if (industry === 'academic') return { order: ['summary', 'experience', 'education', 'projects', 'skills'], label: 'Recommended for academic / research' };
  return { order: ['summary', 'experience', 'skills', 'projects', 'education'], label: 'Recommended for experienced candidates' };
};

// === Animations ===
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// === Styled Components ===
const ModalContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* On mobile the modal is fullscreen; let the entire modal be one
     natural scroll container instead of a nested scroll inside
     TwoColLayout. Without this the preview stayed pinned at the top
     while only the Save/Format/Template section scrolled. */
  @media (max-width: 768px) {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 28px 16px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 14px 14px 10px;
    flex-wrap: wrap;
    row-gap: 10px;
    column-gap: 8px;
    /* Keep the header visible at the top of the natural scroll so users
       always see 'Download Resume' + close button no matter how far
       they've scrolled into the form. */
    position: sticky;
    top: 0;
    background: white;
    z-index: 11;
    border-bottom: 1px solid #f3f4f6;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  margin-right: auto;

  @media (max-width: 768px) {
    flex: 1 1 auto;
    gap: 10px;
    margin-right: 0;
  }
`;

const HeaderIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #e0e7ff;
  color: #4f46e5;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }
`;

const HeaderText = styled.div`
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    line-height: 1.2;
  }
  .subtitle {
    font-size: 13px;
    color: #6b7280;
    margin-top: 1px;
  }

  @media (max-width: 768px) {
    h3 {
      font-size: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .subtitle {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 768px) {
    order: 3;
    flex-basis: 100%;
    justify-content: space-between;
    gap: 8px;
  }
`;

const BeforeAfterToggle = styled.div`
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  padding: 3px;
  border-radius: 8px;

  @media (max-width: 768px) {
    flex: 1 1 0;
  }
`;

const ToggleBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => (p.$active ? 'white' : 'transparent')};
  color: ${p => p.$active ? '#111827' : '#9ca3af'};
  box-shadow: ${p => (p.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none')};

  &:hover { color: #111827; }

  @media (max-width: 768px) {
    flex: 1;
    padding: 7px 10px;
    font-size: 12px;
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 20px;
  line-height: 1;
  transition: all 0.2s;
  flex-shrink: 0;
  &:hover { background: #f3f4f6; color: #374151; }

  @media (max-width: 768px) {
    order: 2;
    align-self: flex-start;
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #f3f4f6;
  margin: 0;
`;

// === Two-column layout ===
const TwoColLayout = styled.div`
  flex: 1 1 0;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 0;
  overflow: hidden;
  min-height: 0;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    /* No inner scroll on mobile — ModalContainer handles it so the
       preview scrolls up along with the form fields below. */
    overflow: visible;
    min-height: 0;
    flex: 0 0 auto;
  }
`;

const LeftPane = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 16px 20px 28px;
  overflow: hidden;
  background: #f8fafc;

  @media (max-width: 768px) {
    padding: 16px;
    /* Fixed, natural block-height on mobile so the preview scrolls with
       the rest of the modal instead of being pinned to a flex-filled
       zone that stole the scroll gesture. */
    overflow: visible;
    min-height: 0;
  }
`;

const PreviewCard = styled.div`
  flex: 1 1 0;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  animation: ${fadeIn} 0.3s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);

  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  /* Mobile: give the preview a specific viewport-relative height so it
     doesn't collapse to 0 (once the flex-1 stretch is removed) and so
     the rasterised canvas has real pixels to draw into. */
  @media (max-width: 768px) {
    flex: 0 0 auto;
    height: 60vh;
    min-height: 380px;
    max-height: 640px;
  }
`;

const TemplateRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 12px 0 4px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
`;

const TemplateChip = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid ${p => (p.$active ? p.$color : '#e5e7eb')};
  background: ${p => (p.$active ? `${p.$color}10` : 'white')};
  color: ${p => (p.$active ? p.$color : '#6b7280')};

  &:hover { border-color: ${p => p.$color}; }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${p => p.$color};
  }
`;

const RightPane = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 28px 20px 20px;
  overflow-y: auto;
  border-left: 1px solid #f3f4f6;

  @media (max-width: 768px) {
    padding: 16px;
    border-left: none;
    border-top: 1px solid #f3f4f6;
    /* Let it grow naturally so its content flows into the modal-level
       scroll — no local scrollbar. */
    overflow: visible;
  }
`;

const LoadingBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
`;

// === Right pane field styles ===
const FieldGroup = styled.div`
  margin-bottom: 24px;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.6px;
  margin-bottom: 8px;
`;

const FileNameWrap = styled.div`
  display: flex;
  align-items: center;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
  }

  input {
    flex: 1;
    padding: 10px 14px;
    border: none;
    font-size: 14px;
    color: #111827;
    font-weight: 500;
    outline: none;
    background: transparent;
  }

  .ext {
    padding: 10px 14px;
    font-size: 13px;
    color: #9ca3af;
    background: #f9fafb;
    border-left: 1px solid #e5e7eb;
    white-space: nowrap;
  }
`;

const FormatToggle = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const FormatCard = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 14px;
  border-radius: 12px;
  border: 2px solid ${p => (p.$active ? '#4f46e5' : '#e5e7eb')};
  background: ${p => (p.$active ? '#f5f3ff' : 'white')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: ${p => p.$active ? '#4f46e5' : '#c4c8d0'}; }

  .icon { font-size: 28px; opacity: 0.85; }
  .label { font-size: 14px; font-weight: 700; color: #111827; }
  .desc { font-size: 12px; color: #9ca3af; }

  .check {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #4f46e5;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
  }
`;

const TemplateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TemplateCard = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 2px solid ${p => p.$active ? '#4f46e5' : '#e5e7eb'};
  background: ${p => p.$active ? '#faf9ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover { border-color: ${p => p.$active ? '#4f46e5' : '#c4c8d0'}; }

  .thumb {
    width: 44px;
    height: 56px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .thumb-lines {
    width: 28px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    .line { height: 2px; border-radius: 1px; background: #d1d5db; }
    .line-short { width: 60%; }
    .line-full { width: 100%; }
    .line-med { width: 80%; }
  }

  .thumb-modern {
    display: flex;
    width: 100%;
    height: 100%;
    .sidebar { width: 12px; background: ${p => p.$accent || '#10b981'}; }
    .content { flex: 1; padding: 6px 4px; display: flex; flex-direction: column; gap: 2px; }
    .content .line { height: 1.5px; border-radius: 1px; background: #d1d5db; }
    .content .line-short { width: 50%; }
    .content .line-full { width: 100%; }
  }

  .thumb-centered {
    width: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    .line { height: 2px; border-radius: 1px; background: #d1d5db; }
    .line-name { width: 70%; height: 3px; background: #374151; }
    .line-contact { width: 90%; height: 1.5px; }
    .line-rule { width: 100%; height: 1px; background: #9ca3af; }
    .line-full { width: 100%; }
    .line-med { width: 80%; }
  }

  .info {
    flex: 1;
    min-width: 0;
  }

  .info .name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .info .name .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${p => p.$dot || '#374151'};
  }

  .info .desc {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
  }

  .check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #4f46e5;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
`;

const BulletStyleToggle = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const BulletStyleCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 10px;
  border-radius: 12px;
  border: 2px solid ${p => p.$active ? '#4f46e5' : '#e5e7eb'};
  background: ${p => p.$active ? '#faf9ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: ${p => p.$active ? '#4f46e5' : '#c4c8d0'}; }

  .preview {
    width: 64px;
    height: 46px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 6px 8px;
    gap: 4px;
  }

  .p-line {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .p-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #4f46e5;
    flex-shrink: 0;
  }

  .p-bar {
    height: 2px;
    border-radius: 1px;
    background: #d1d5db;
  }

  .label { font-size: 13px; font-weight: 700; color: #111827; }
  .desc { font-size: 11px; color: #9ca3af; }
`;

const AccentColorGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const AccentDot = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid ${p => p.$active ? '#111827' : 'transparent'};
  background: ${p => p.$color};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;

  &:hover { transform: scale(1.1); }

  .check {
    color: white;
    font-size: 14px;
    font-weight: 700;
  }
`;

// === Section order (drag-to-reorder) ===
const SuggestBanner = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  border: 1px solid ${p => p.$active ? '#c7d2fe' : '#e5e7eb'};
  background: ${p => p.$active ? 'linear-gradient(135deg,#eef2ff,#faf5ff)' : 'white'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: #a5b4fc; }

  .spark {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${p => p.$active ? '#4f46e5' : '#eef2ff'};
    color: ${p => p.$active ? '#fff' : '#4f46e5'};
  }
  .txt { min-width: 0; }
  .title { font-size: 12.5px; font-weight: 700; color: #111827; }
  .sub { font-size: 11px; color: #6b7280; line-height: 1.3; }
`;

const OrderGroup = styled(Reorder.Group)`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const OrderItem = styled(Reorder.Item)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  cursor: grab;

  &:active { cursor: grabbing; }

  .grip {
    display: flex;
    align-items: center;
    color: #9ca3af;
    flex-shrink: 0;
  }
  .pos {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .meta { min-width: 0; flex: 1; }
  .label { font-size: 13px; font-weight: 600; color: #111827; }
  .desc { font-size: 11px; color: #9ca3af; }
  .pinned {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #6b7280;
    background: #f3f4f6;
    border-radius: 6px;
    padding: 3px 7px;
  }

  @media (max-width: 768px) {
    padding: 12px;
    .desc { display: none; }
  }
`;

const OrderHint = styled.div`
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
  line-height: 1.4;
`;

// Non-draggable row used for sections that are pinned to the Modern sidebar.
const OrderItemStatic = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px dashed #e5e7eb;
  background: #fafafa;
  opacity: 0.85;

  .grip { display: flex; align-items: center; color: #d1d5db; flex-shrink: 0; }
  .meta { min-width: 0; flex: 1; }
  .label { font-size: 13px; font-weight: 600; color: #374151; }
  .desc { font-size: 11px; color: #9ca3af; }
  .pinned {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #6b7280;
    background: #eef2ff;
    border-radius: 6px;
    padding: 3px 7px;
  }

  @media (max-width: 768px) {
    .desc { display: none; }
  }
`;
const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 28px 22px;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 12px 16px 20px;
    position: sticky;
    bottom: 0;
    background: white;
    z-index: 10;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
    justify-content: stretch;

    button {
      flex: 1;
    }
  }
`;

const CancelBtn = styled.button`
  padding: 11px 24px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { background: #f9fafb; }
`;

const DownloadBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 28px;
  border-radius: 10px;
  border: none;
  background: ${p => p.$accent || '#667eea'};
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }

  &:disabled { opacity: 0.6; cursor: not-allowed; }

  svg { font-size: 18px; }
`;

const DoneEditingBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  margin-top: 12px;
  border-radius: 12px;
  border: none;
  background: #111827;
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.2);
  }
`;

// === Edit Tab Styles ===
const EditScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 24px;
`;

const EditSection = styled.div`
  margin-bottom: 20px;
`;

const EditSectionLabel = styled.label`
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const FieldInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  color: #111827;
  font-weight: 500;
  box-sizing: border-box;

  &:focus {
    border-color: #4f46e5;
    outline: none;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
  }
`;

const EditTextarea = styled.textarea`
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
  color: #111827;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
  overflow: hidden;
  min-height: 44px;
  font-weight: 500;

  &:focus {
    border-color: #4f46e5;
    outline: none;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
  }
`;

const AIPromptBox = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
`;

const AIPromptLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #764ba2;
  margin-bottom: 6px;
  .spark { font-size: 13px; }
`;

const AIPromptInput = styled.textarea`
  width: 100%;
  min-height: 46px;
  padding: 9px 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: #111827;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  &::placeholder { color: #9ca3af; }
  &:focus {
    border-color: #764ba2;
    outline: none;
    box-shadow: 0 0 0 3px rgba(118,75,162,0.10);
  }
  &:disabled { background: #f9fafb; }
`;

const AIPromptRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const AIPromptBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const AIPromptNote = styled.span`
  font-size: 11.5px;
  color: ${p => p.$error ? '#dc2626' : '#4b5563'};
`;

const SkillsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

const SkillChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  background: #ede9fe;
  color: #4f46e5;
  border: 1px solid #c4b5fd;

  .remove {
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    opacity: 0.6;
    &:hover { opacity: 1; }
  }
`;

const SkillAddInput = styled.input`
  border: none;
  outline: none;
  font-size: 13px;
  color: #374151;
  min-width: 80px;
  padding: 5px 4px;
  background: transparent;

  &::placeholder { color: #b0b8c4; }
`;

const SkillHint = styled.span`
  display: block;
  font-size: 11px;
  color: #b0b8c4;
  margin-top: 4px;
`;

const ExpCard = styled.div`
  position: relative;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
`;

const ExpRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 8px;
`;

const BulletRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;

  .bullet {
    color: #6b7280;
    font-size: 18px;
    line-height: 1;
    margin-top: 8px;
    flex-shrink: 0;
  }

  .remove {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: #d1d5db;
    padding: 4px;
    border-radius: 4px;
    margin-top: 4px;
    &:hover { color: #dc2626; }
    svg { font-size: 16px; }
  }
`;

const BulletInput = styled.textarea`
  flex: 1;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #111827;
  font-weight: 500;
  background: transparent;
  transition: all 0.15s;
  font-family: inherit;
  resize: none;
  overflow: hidden;
  min-height: 36px;

  &:focus {
    border-color: #e5e7eb;
    background: white;
    outline: none;
  }
`;

const AddBulletBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  margin-top: 4px;
  border: none;
  background: none;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-left: 24px;

  &:hover { text-decoration: underline; }
`;

const AddSectionBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1.5px dashed #d1d5db;
  border-radius: 10px;
  background: transparent;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: #4f46e5; background: #f5f3ff; }
  svg { font-size: 18px; }
`;

const TabRow = styled.div`
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  padding: 3px;
  border-radius: 8px;

  @media (max-width: 768px) {
    flex: 1 1 0;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => (p.$active ? 'white' : 'transparent')};
  color: ${p => (p.$active ? '#111827' : '#6b7280')};
  box-shadow: ${p => (p.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none')};

  &:hover { color: #111827; }

  @media (max-width: 768px) {
    flex: 1;
    padding: 7px 10px;
    font-size: 12px;
  }
`;

// === Auto-resize textarea helper ===
function AutoTextarea({ value, onChange, placeholder, ...rest }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <EditTextarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onInput={resize}
      {...rest}
    />
  );
}

function AutoBullet({ value, onChange, placeholder, ...rest }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <BulletInput
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onInput={resize}
      rows={1}
      {...rest}
    />
  );
}

// === Component ===
export default function ResumePreviewModal({
  open,
  onClose,
  profileData,
  tailoredProfileData,
  jobTitle,
  user,
  preloadedPreviewUrl,
  // Optional: 'preview' (default) or 'edit', opens the modal with
  // the Edit tab pre-selected so callers like the ApplyPilot Review
  // page can route directly to the inline editor.
  initialTab = 'preview',
}) {
  const buildDefaultName = () => {
    // Pattern: <FirstLast>-<JobTitle>-<Proficiency> e.g. SaeedDarvish-SeniorFrontEnd-Senior-Polished
    const sanitize = (s) =>
      String(s || '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');

    const data = tailoredProfileData || profileData || {};
    const firstName =
      data.firstName || user?.firstName || (data.fullName || data.name || '').split(' ')[0] || '';
    const lastName =
      data.lastName || user?.lastName || (data.fullName || data.name || '').split(' ').slice(1).join(' ') || '';
    const titleSource = jobTitle || data.title || data.headline || 'Resume';

    // Infer proficiency / seniority from title or top experience.
    const titleLc = String(titleSource).toLowerCase();
    let proficiency = '';
    if (/principal|staff|distinguished/.test(titleLc)) proficiency = 'Principal';
    else if (/lead|head|director|architect/.test(titleLc)) proficiency = 'Lead';
    else if (/senior|sr\.?\s/.test(titleLc)) proficiency = 'Senior';
    else if (/junior|jr\.?\s|intern|entry/.test(titleLc)) proficiency = 'Junior';
    else if (/mid/.test(titleLc)) proficiency = 'Mid';

    // Pick a polished descriptor that varies per generation so filename is unique.
    const descriptors = [
      'Polished', 'Tailored', 'Crafted', 'Refined', 'Optimized',
      'Sharpened', 'Curated', 'Precise', 'Focused', 'Aligned',
    ];
    const descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];

    const namePart = sanitize(`${firstName} ${lastName}`) || 'Candidate';
    const titlePart = sanitize(titleSource) || 'Resume';
    const tail = [proficiency, descriptor].filter(Boolean).join('-');

    return tail ? `${namePart}-${titlePart}-${tail}` : `${namePart}-${titlePart}`;
  };

  // Compute once per open so the random descriptor is stable while the modal is open.
  const defaultNameRef = useRef('');
  if (!defaultNameRef.current) defaultNameRef.current = buildDefaultName();
  const defaultName = defaultNameRef.current;

  const [filename, setFilename] = useState(defaultName);
  const [format, setFormat] = useState('pdf');
  const [activeTab, setActiveTab] = useState(initialTab === 'edit' ? 'edit' : 'preview');
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editData, setEditData] = useState(null);
  const [templateId, setTemplateId] = useState('professional');
  const [skillInput, setSkillInput] = useState('');
  const [previewMode, setPreviewMode] = useState('after');
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState('');
  const [bulletStyle, setBulletStyle] = useState('bullets');
  const [accentColor, setAccentColor] = useState('#0d9488');
  const [sectionOrder, setSectionOrder] = useState(ALL_SECTIONS);
  // Per-section instructions the user can hand to the AI before downloading.
  const [sectionPrompts, setSectionPrompts] = useState({});
  const [regeneratingSection, setRegeneratingSection] = useState(null);
  const [regenStatus, setRegenStatus] = useState({}); // { [section]: { msg, error } }
  // The AI-suggested order for this candidate + whether it's currently applied.
  const [suggestion, setSuggestion] = useState({ order: ALL_SECTIONS, label: 'Standard order' });
  const previewDebounceRef = useRef(null);
  const hasBothVersions = !!(tailoredProfileData && profileData);
  const isMobile = useMediaQuery('(max-width:768px)');

  useEffect(() => {
    if (open) {
      // Regenerate on each open so the random descriptor is fresh.
      defaultNameRef.current = buildDefaultName();
      setFilename(defaultNameRef.current);
      setFormat('pdf');
      setActiveTab(initialTab === 'edit' ? 'edit' : 'preview');
      setSkillInput('');
      setSectionPrompts({});
      setRegeneratingSection(null);
      setRegenStatus({});
      const data = tailoredProfileData || profileData;
      if (data) {
        const merged = JSON.parse(JSON.stringify(data));
        if (!merged.fullName && !merged.name && user) {
          merged.fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        }
        if (!merged.email && user) {
          merged.email = user.email || '';
        }
        // Normalize skills: if object {category: [...]} flatten to array for editing
        if (merged.skills && !Array.isArray(merged.skills) && typeof merged.skills === 'object') {
          merged.skills = Object.values(merged.skills).flat().map(s => typeof s === 'string' ? s : s?.name || '').filter(Boolean);
        }
        setEditData(merged);
      }
      setPreviewMode('after');
      setOriginalPreviewUrl('');
      // Suggest the strongest section order for this candidate and apply it so
      // the first preview already reflects a smart, level-aware layout.
      const suggested = computeSuggestedOrder(data);
      setSuggestion(suggested);
      setSectionOrder(suggested.order);
      if (preloadedPreviewUrl) {
        setPreviewUrl(preloadedPreviewUrl);
      } else {
        loadPreview(data, 'professional', undefined, undefined, suggested.order);
      }
      if (tailoredProfileData && profileData) {
        loadOriginalPreview(profileData, 'professional', undefined, undefined, suggested.order);
      }
    }
  }, [open]);

  // Contact details are identity, not content. The tailoring model is never
  // asked to return them, so a tailored payload carries none — and since
  // tailoredProfileData wins over profileData below, the generated header
  // would collapse to just name and email. Overlay the real profile's contact
  // fields onto whatever payload we're about to send.
  const withContact = useCallback((data) => {
    if (!data) return data;
    const merged = { ...data };
    if (!merged.fullName && !merged.name) {
      const fromUser = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
      if (fromUser) merged.fullName = fromUser;
    }
    const contact = {
      email: profileData?.email || user?.email,
      phone: profileData?.phone,
      location: profileData?.location,
      linkedinUrl: profileData?.linkedinUrl,
      githubUrl: profileData?.githubUrl,
      portfolioUrl: profileData?.portfolioUrl,
    };
    for (const [key, value] of Object.entries(contact)) {
      if (!merged[key] && value) merged[key] = value;
    }
    return merged;
  }, [profileData, user]);

  const [previewError, setPreviewError] = useState('');
  const loadPreview = useCallback(async (data, tmplId, color, bStyle, order) => {
    setLoadingPreview(true);
    setPreviewError('');
    try {
      const res = await resumeAPI.preview(tmplId || templateId, null, withContact(data) || null, color ?? accentColor, bStyle ?? bulletStyle, order ?? sectionOrder);
      if (res.data?.preview) {
        setPreviewUrl(res.data.preview);
      } else {
        // API returned 200 but no preview payload — treat as failure so
        // the UI shows a retry instead of silently sitting on "Preview
        // not available".
        setPreviewError('Server didn’t return a preview.');
      }
    } catch (err) {
      console.error('Preview error:', err);
      // The /api/resume/preview 500 handler returns BOTH a friendly
      // message ("Failed to generate preview") AND the real error
      // detail on `error`. We want the detail — the friendly message
      // alone tells the user nothing they don't already see.
      const server = err?.response?.data || {};
      const detail = server.error || server.message;
      const msg = detail
        || err?.message
        || 'Something went wrong generating your preview.';
      setPreviewError(msg);
    } finally {
      setLoadingPreview(false);
    }
  }, [templateId, accentColor, bulletStyle, sectionOrder, withContact]);

  // Convenience so the "Retry" button on the empty state re-runs whatever
  // profile data the modal was opened with.
  const retryPreview = useCallback(() => {
    const data = tailoredProfileData || profileData || editData;
    loadPreview(data, templateId, accentColor, bulletStyle, sectionOrder);
  }, [loadPreview, tailoredProfileData, profileData, editData, templateId, accentColor, bulletStyle, sectionOrder]);

  const loadOriginalPreview = useCallback(async (data, tmplId, color, bStyle, order) => {
    try {
      const res = await resumeAPI.preview(tmplId || templateId, null, withContact(data) || null, color ?? accentColor, bStyle ?? bulletStyle, order ?? sectionOrder);
      if (res.data?.preview) {
        setOriginalPreviewUrl(res.data.preview);
      }
    } catch (err) {
      console.error('Original preview error:', err);
    }
  }, [templateId, accentColor, bulletStyle, sectionOrder, withContact]);

  const schedulePreviewUpdate = useCallback((data) => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      loadPreview(data, templateId);
    }, 1200);
  }, [loadPreview, templateId]);

  // Apply a section order (from drag-reorder or the suggested-order banner)
  // and refresh the preview with a short debounce so dragging stays smooth.
  const applySectionOrder = useCallback((order) => {
    setSectionOrder(order);
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      loadPreview(editData || tailoredProfileData || profileData, templateId, accentColor, bulletStyle, order);
    }, 500);
  }, [loadPreview, editData, tailoredProfileData, profileData, templateId, accentColor, bulletStyle]);

  const isSuggestedApplied = sectionOrder.join(',') === suggestion.order.join(',');

  const handleTemplateChange = (tmplId) => {
    setTemplateId(tmplId);
    loadPreview(editData || tailoredProfileData || profileData, tmplId);
    if (hasBothVersions) {
      loadOriginalPreview(profileData, tmplId);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const cleanName = filename.trim() || defaultName;
      const response = await resumeAPI.generate(
        format === 'pdf' ? 'pdf' : 'word',
        templateId,
        null,
        withContact(editData || tailoredProfileData || profileData),
        accentColor,
        bulletStyle,
        sectionOrder
      );

      const blob = new Blob([response.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const setSectionPrompt = (section, value) => {
    setSectionPrompts(prev => ({ ...prev, [section]: value }));
  };

  const handleRegenerateSection = async (section) => {
    const base = editData || tailoredProfileData || profileData;
    const instruction = (sectionPrompts[section] || '').trim();
    if (!base || !instruction || regeneratingSection) return;
    setRegeneratingSection(section);
    setRegenStatus(prev => ({ ...prev, [section]: null }));
    try {
      const { data } = await profileAPI.regenerateSections({
        profileData: base,
        instructions: { [section]: instruction },
      });
      const updated = data?.data || {};
      if (updated[section] !== undefined) {
        const merged = { ...base, [section]: updated[section] };
        setEditData(merged);
        schedulePreviewUpdate(merged);
        setSectionPrompt(section, '');
        setRegenStatus(prev => ({ ...prev, [section]: { msg: 'Updated. Check the preview.' } }));
      } else {
        setRegenStatus(prev => ({ ...prev, [section]: { msg: 'No change returned.' } }));
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      setRegenStatus(prev => ({ ...prev, [section]: { msg: err.response?.data?.error || 'Failed. Try again.', error: true } }));
    } finally {
      setRegeneratingSection(null);
    }
  };

  const renderAIPrompt = (section, placeholder) => {
    const busy = regeneratingSection === section;
    const hasText = !!(sectionPrompts[section] || '').trim();
    const status = regenStatus[section];
    return (
      <AIPromptBox>
        <AIPromptLabel htmlFor={`ai-prompt-${section}`}>
          <span className="spark">✦</span> Ask AI to adjust this section (optional)
        </AIPromptLabel>
        <AIPromptInput
          id={`ai-prompt-${section}`}
          value={sectionPrompts[section] || ''}
          maxLength={400}
          disabled={busy}
          onChange={e => setSectionPrompt(section, e.target.value)}
          placeholder={placeholder}
        />
        <AIPromptRow>
          <AIPromptBtn
            type="button"
            onClick={() => handleRegenerateSection(section)}
            disabled={!hasText || !!regeneratingSection}
          >
            {busy
              ? <><CircularProgress size={12} sx={{ color: 'white' }} /> Regenerating…</>
              : <><span>✦</span> Regenerate with AI</>}
          </AIPromptBtn>
          {status && <AIPromptNote $error={status.error}>{status.msg}</AIPromptNote>}
        </AIPromptRow>
      </AIPromptBox>
    );
  };

  const updateField = (field, value) => {
    setEditData(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const updateArrayItem = (field, index, key, value) => {
    setEditData(prev => {
      if (!prev) return prev;
      const arr = [...(prev[field] || [])];
      arr[index] = { ...arr[index], [key]: value };
      const next = { ...prev, [field]: arr };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const removeArrayItem = (field, index) => {
    setEditData(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: prev[field].filter((_, i) => i !== index) };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const removeSkill = (index) => {
    setEditData(prev => {
      if (!prev) return prev;
      const raw = Array.isArray(prev.skills) ? prev.skills : Object.values(prev.skills || {}).flat();
      const skills = [...raw];
      skills.splice(index, 1);
      const next = { ...prev, skills };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const addSkill = (skill) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    setEditData(prev => {
      if (!prev) return prev;
      const arr = Array.isArray(prev.skills) ? prev.skills : Object.values(prev.skills || {}).flat();
      const existing = arr.map(s => typeof s === 'string' ? s : s.name || '');
      if (existing.includes(trimmed)) return prev;
      const next = { ...prev, skills: [...arr, trimmed] };
      schedulePreviewUpdate(next);
      return next;
    });
    setSkillInput('');
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const updateBullet = (expIndex, bulletIndex, value) => {
    setEditData(prev => {
      if (!prev) return prev;
      const experience = [...(prev.experience || [])];
      const exp = { ...experience[expIndex] };
      const bullets = [...(exp.bullets || parseBullets(exp.description))];
      bullets[bulletIndex] = value;
      exp.bullets = bullets;
      exp.description = bullets.filter(Boolean).join('\n');
      experience[expIndex] = exp;
      const next = { ...prev, experience };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const removeBullet = (expIndex, bulletIndex) => {
    setEditData(prev => {
      if (!prev) return prev;
      const experience = [...(prev.experience || [])];
      const exp = { ...experience[expIndex] };
      const bullets = [...(exp.bullets || parseBullets(exp.description))];
      bullets.splice(bulletIndex, 1);
      exp.bullets = bullets;
      exp.description = bullets.filter(Boolean).join('\n');
      experience[expIndex] = exp;
      const next = { ...prev, experience };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const addBullet = (expIndex) => {
    setEditData(prev => {
      if (!prev) return prev;
      const experience = [...(prev.experience || [])];
      const exp = { ...experience[expIndex] };
      const bullets = [...(exp.bullets || parseBullets(exp.description)), ''];
      exp.bullets = bullets;
      experience[expIndex] = exp;
      return { ...prev, experience };
    });
  };

  const addExperience = () => {
    setEditData(prev => prev ? {
      ...prev,
      experience: [...(prev.experience || []), { company: '', title: '', period: '', description: '', bullets: [''] }]
    } : prev);
  };

  const addEducation = () => {
    setEditData(prev => prev ? {
      ...prev,
      education: [...(prev.education || []), { school: '', degree: '', field: '', year: '' }]
    } : prev);
  };

  const removeEducation = (index) => {
    setEditData(prev => {
      if (!prev) return prev;
      const next = { ...prev, education: prev.education.filter((_, i) => i !== index) };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const updateEducation = (index, key, value) => {
    setEditData(prev => {
      if (!prev) return prev;
      const education = [...(prev.education || [])];
      education[index] = { ...education[index], [key]: value };
      const next = { ...prev, education };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const addProject = () => {
    setEditData(prev => prev ? {
      ...prev,
      projects: [...(prev.projects || []), { title: '', description: '', technologies: [], link: '' }]
    } : prev);
  };

  const removeProject = (index) => {
    setEditData(prev => {
      if (!prev) return prev;
      const next = { ...prev, projects: (prev.projects || []).filter((_, i) => i !== index) };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const updateProject = (index, key, value) => {
    setEditData(prev => {
      if (!prev) return prev;
      const projects = [...(prev.projects || [])];
      projects[index] = { ...projects[index], [key]: value };
      const next = { ...prev, projects };
      schedulePreviewUpdate(next);
      return next;
    });
  };

  const getSkillLabel = (s) => typeof s === 'string' ? s : s.name || '';

  const isModern = templateId === 'modern';
  const downloadColor = isModern ? (accentColor || '#667eea') : '#667eea';

  const renderPreview = () => {
    const showingOriginal = previewMode === 'before' && hasBothVersions;
    const currentUrl = showingOriginal ? originalPreviewUrl : previewUrl;
    const isLoading = showingOriginal ? !originalPreviewUrl : loadingPreview;

    return (
      <LeftPane>
        <PreviewCard>
          {isLoading ? (
            <LoadingBox>
              <CircularProgress size={32} sx={{ color: '#4f46e5' }} />
              <span>Generating preview...</span>
            </LoadingBox>
          ) : currentUrl ? (
            isMobile ? (
              // Mobile Safari/Chrome won't render a PDF data-URI in an <iframe>
              // (shows blank), so rasterise the pages to <canvas> instead.
              <PdfCanvasPreview
                url={currentUrl}
                title={showingOriginal ? 'Original Resume' : 'Tailored Resume'}
              />
            ) : (
              <iframe
                src={currentUrl.startsWith('blob:') || currentUrl.startsWith('data:') || /\.pdf(\?|$)/i.test(currentUrl)
                  ? `${currentUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
                  : currentUrl}
                title={showingOriginal ? 'Original Resume' : 'Tailored Resume'}
              />
            )
          ) : (
            // Empty-state / failure. Surfaces the real error + one Retry
            // button — user preference: keep it simple, no extra buttons.
            <LoadingBox style={{ gap: 12, textAlign: 'center', padding: '20px 16px' }}>
              <span style={{ color: '#475569', fontWeight: 600, fontSize: 15 }}>
                {previewError && !showingOriginal
                  ? 'Preview failed to load'
                  : 'Preview not available'}
              </span>
              {previewError && !showingOriginal && (
                <span style={{ color: '#94a3b8', fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
                  {previewError}
                </span>
              )}
              {!showingOriginal && (
                <button
                  type="button"
                  onClick={retryPreview}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #6366f1',
                    background: '#6366f1',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Retry preview
                </button>
              )}
            </LoadingBox>
          )}
        </PreviewCard>
        <TemplateRow>
          {TEMPLATE_OPTIONS.map(t => (
            <TemplateChip
              key={t.id}
              $active={templateId === t.id}
              $color={t.dot}
              onClick={() => handleTemplateChange(t.id)}
            >
              <span className="dot" />
              {t.label}
            </TemplateChip>
          ))}
        </TemplateRow>
      </LeftPane>
    );
  };

  const renderRightPaneControls = () => (
    <RightPane>
      {/* Save As */}
      <FieldGroup>
        <FieldLabel>Save As</FieldLabel>
        <FileNameWrap>
          <input
            value={filename}
            onChange={e => setFilename(e.target.value)}
            placeholder="Resume filename"
          />
          <span className="ext">.{format === 'pdf' ? 'pdf' : 'docx'}</span>
        </FileNameWrap>
      </FieldGroup>

      {/* Format */}
      <FieldGroup>
        <FieldLabel>Format</FieldLabel>
        <FormatToggle>
          <FormatCard $active={format === 'pdf'} onClick={() => setFormat('pdf')}>
            {format === 'pdf' && <span className="check">✓</span>}
            <span className="icon">📄</span>
            <span className="label">PDF</span>
            <span className="desc">Best for sharing</span>
          </FormatCard>
          <FormatCard $active={format === 'docx'} onClick={() => setFormat('docx')}>
            {format === 'docx' && <span className="check">✓</span>}
            <span className="icon">📝</span>
            <span className="label">Word</span>
            <span className="desc">Best for editing</span>
          </FormatCard>
        </FormatToggle>
      </FieldGroup>

      {/* Template */}
      <FieldGroup>
        <FieldLabel>Template</FieldLabel>
        <TemplateList>
          {TEMPLATE_OPTIONS.map(t => (
            <TemplateCard
              key={t.id}
              $active={templateId === t.id}
              $dot={t.dot}
              $accent={accentColor}
              onClick={() => handleTemplateChange(t.id)}
            >
              <div className="thumb">
                {t.id === 'modern' ? (
                  <div className="thumb-modern">
                    <div className="sidebar" />
                    <div className="content">
                      <div className="line line-short" />
                      <div className="line line-full" />
                      <div className="line line-full" />
                      <div className="line line-short" />
                    </div>
                  </div>
                ) : t.id === 'centered' ? (
                  <div className="thumb-centered">
                    <div className="line line-name" />
                    <div className="line line-contact" />
                    <div className="line line-rule" />
                    <div className="line line-full" />
                    <div className="line line-med" />
                  </div>
                ) : (
                  <div className="thumb-lines">
                    <div className="line line-short" />
                    <div className="line line-full" />
                    <div className="line line-full" />
                    <div className="line line-med" />
                    <div className="line line-full" />
                  </div>
                )}
              </div>
              <div className="info">
                <div className="name">
                  <span className="dot" />
                  {t.label}
                </div>
                <div className="desc">{t.desc}</div>
              </div>
              {templateId === t.id && <span className="check">✓</span>}
            </TemplateCard>
          ))}
        </TemplateList>
      </FieldGroup>

      {/* Accent Color (Modern only) */}
      {isModern && (
        <FieldGroup>
          <FieldLabel>Accent Color</FieldLabel>
          <AccentColorGrid>
            {ACCENT_COLORS.map(c => (
              <AccentDot
                key={c}
                $color={c}
                $active={accentColor === c}
                onClick={() => { setAccentColor(c); loadPreview(editData || tailoredProfileData || profileData, templateId, c); }}
              >
                {accentColor === c && <span className="check">✓</span>}
              </AccentDot>
            ))}
          </AccentColorGrid>
        </FieldGroup>
      )}

      {/* Bullet Style */}
      <FieldGroup>
        <FieldLabel>Bullet Style</FieldLabel>
        <BulletStyleToggle>
          <BulletStyleCard $active={bulletStyle === 'none'} onClick={() => { setBulletStyle('none'); loadPreview(editData || tailoredProfileData || profileData, templateId, accentColor, 'none'); }}>
            <div className="preview">
              <div className="p-bar" style={{ width: '100%' }} />
              <div className="p-bar" style={{ width: '80%' }} />
              <div className="p-bar" style={{ width: '100%' }} />
            </div>
            <span className="label">No Bullets</span>
            <span className="desc">Clean paragraphs</span>
          </BulletStyleCard>
          <BulletStyleCard $active={bulletStyle === 'bullets'} onClick={() => { setBulletStyle('bullets'); loadPreview(editData || tailoredProfileData || profileData, templateId, accentColor, 'bullets'); }}>
            <div className="preview">
              <div className="p-line"><span className="p-dot" /><div className="p-bar" style={{ width: '100%' }} /></div>
              <div className="p-line"><span className="p-dot" /><div className="p-bar" style={{ width: '80%' }} /></div>
              <div className="p-line"><span className="p-dot" /><div className="p-bar" style={{ width: '100%' }} /></div>
            </div>
            <span className="label">Bullet Points</span>
            <span className="desc">Traditional list</span>
          </BulletStyleCard>
        </BulletStyleToggle>
      </FieldGroup>

      {/* Section Order */}
      <FieldGroup>
        <FieldLabel>Section Order</FieldLabel>
        <SuggestBanner
          type="button"
          $active={isSuggestedApplied}
          onClick={() => applySectionOrder(suggestion.order)}
        >
          <span className="spark"><AutoAwesomeIcon style={{ fontSize: 18 }} /></span>
          <span className="txt">
            <span className="title">{isSuggestedApplied ? 'Smart order applied' : 'Use suggested order'}</span>
            <span className="sub">{suggestion.label}</span>
          </span>
        </SuggestBanner>

        {(() => {
          const reorderValues = isModern
            ? sectionOrder.filter((id) => MODERN_MAIN_SECTIONS.includes(id))
            : sectionOrder;
          const sidebarValues = isModern
            ? sectionOrder.filter((id) => !MODERN_MAIN_SECTIONS.includes(id))
            : [];
          const handleReorder = (newVals) => {
            if (isModern) {
              applySectionOrder([...newVals, ...sidebarValues]);
            } else {
              applySectionOrder(newVals);
            }
          };
          return (
            <>
              <OrderGroup axis="y" values={reorderValues} onReorder={handleReorder}>
                {reorderValues.map((id, idx) => (
                  <OrderItem key={id} value={id} whileDrag={{ scale: 1.03, boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
                    <span className="grip"><DragIndicatorIcon style={{ fontSize: 18 }} /></span>
                    <span className="pos">{idx + 1}</span>
                    <span className="meta">
                      <span className="label">{SECTION_META[id]?.label || id}</span>
                      <span className="desc">{SECTION_META[id]?.desc || ''}</span>
                    </span>
                  </OrderItem>
                ))}
              </OrderGroup>
              {sidebarValues.map((id) => (
                <OrderItemStatic key={id} style={{ marginTop: 8 }}>
                  <span className="grip"><DragIndicatorIcon style={{ fontSize: 18 }} /></span>
                  <span className="meta">
                    <span className="label">{SECTION_META[id]?.label || id}</span>
                    <span className="desc">{SECTION_META[id]?.desc || ''}</span>
                  </span>
                  <span className="pinned">Sidebar</span>
                </OrderItemStatic>
              ))}
              <OrderHint>
                {isModern
                  ? 'Drag to reorder the main column. Skills & Education stay in the sidebar for this template.'
                  : 'Drag sections to reorder how they appear on your resume. Name & contact stay at the top.'}
              </OrderHint>
            </>
          );
        })()}
      </FieldGroup>
    </RightPane>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 16, overflow: 'hidden', height: isMobile ? '100dvh' : '88vh', maxHeight: isMobile ? '100dvh' : '88vh', maxWidth: isMobile ? '100%' : 980, margin: isMobile ? 0 : undefined } }}
    >
      <ModalContainer>
        <Header>
          <HeaderLeft>
            <HeaderIcon>
              <Download style={{ fontSize: 20 }} />
            </HeaderIcon>
            <HeaderText>
              <h3>Download Resume</h3>
              <div className="subtitle">Customize and export your resume</div>
            </HeaderText>
          </HeaderLeft>
          <HeaderRight>
            {hasBothVersions && (
              <BeforeAfterToggle>
                <ToggleBtn $active={previewMode === 'before'} onClick={() => setPreviewMode('before')}>
                  Before
                </ToggleBtn>
                <ToggleBtn $active={previewMode === 'after'} onClick={() => setPreviewMode('after')}>
                  After ✨
                </ToggleBtn>
              </BeforeAfterToggle>
            )}
            {editData && (
              <TabRow>
                <Tab $active={activeTab === 'preview'} onClick={() => { setActiveTab('preview'); loadPreview(editData, templateId); }}>
                  Preview
                </Tab>
                <Tab $active={activeTab === 'edit'} onClick={() => setActiveTab('edit')}>
                  Edit
                </Tab>
              </TabRow>
            )}
          </HeaderRight>
          <CloseBtn onClick={onClose}>✕</CloseBtn>
        </Header>

        <Divider />

        {activeTab === 'preview' && (
          <>
            <TwoColLayout>
              {renderPreview()}
              {renderRightPaneControls()}
            </TwoColLayout>

            <Footer>
              <CancelBtn onClick={onClose}>Cancel</CancelBtn>
              <DownloadBtn $accent={downloadColor} onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <><CircularProgress size={16} sx={{ color: 'white' }} /> Generating...</>
                ) : (
                  <>Download {format === 'pdf' ? 'PDF' : 'Word'}</>
                )}
              </DownloadBtn>
            </Footer>
          </>
        )}

        {activeTab === 'edit' && editData && (
          <>
            <TwoColLayout>
              {renderPreview()}
              <RightPane>
                <EditScroll>
                  <EditSection>
                    <EditSectionLabel>Full Name</EditSectionLabel>
                    <FieldInput
                      value={editData.name || editData.fullName || ''}
                      onChange={e => updateField(editData.name !== undefined ? 'name' : 'fullName', e.target.value)}
                      placeholder="Your full name"
                    />
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Email</EditSectionLabel>
                    <FieldInput
                      value={editData.email || ''}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="your@email.com"
                    />
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Summary</EditSectionLabel>
                    <AutoTextarea
                      value={editData.summary || ''}
                      onChange={e => updateField('summary', e.target.value)}
                      placeholder="A brief professional summary..."
                    />
                    {renderAIPrompt('summary', 'e.g. Make it punchier and lead with my fintech impact.')}
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Skills</EditSectionLabel>
                    <SkillsWrap>
                      {(editData.skills || []).map((skill, i) => (
                        <SkillChip key={i}>
                          {getSkillLabel(skill)}
                          <span className="remove" onClick={() => removeSkill(i)}>×</span>
                        </SkillChip>
                      ))}
                      <SkillAddInput
                        value={skillInput}
                        onChange={e => setSkillInput(e.target.value)}
                        onKeyDown={handleSkillKeyDown}
                        placeholder="Add skill..."
                      />
                    </SkillsWrap>
                    <SkillHint>Press Enter to add</SkillHint>
                    {renderAIPrompt('skills', 'e.g. Prioritize cloud & backend skills, drop the outdated ones.')}
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Experience</EditSectionLabel>
                    {(editData.experience || []).map((exp, i) => {
                      const bullets = exp.bullets || parseBullets(exp.description);
                      return (
                        <ExpCard key={i}>
                          <FieldInput
                            value={exp.title || ''}
                            onChange={e => updateArrayItem('experience', i, 'title', e.target.value)}
                            placeholder="Job Title"
                            style={{ fontWeight: 700, fontSize: 15, border: 'none', padding: '4px 0', color: '#111827' }}
                          />
                          <ExpRow>
                            <FieldInput
                              value={exp.company || ''}
                              onChange={e => updateArrayItem('experience', i, 'company', e.target.value)}
                              placeholder="Company"
                              style={{ fontSize: 13, padding: '6px 10px' }}
                            />
                            <FieldInput
                              value={exp.period || ''}
                              onChange={e => updateArrayItem('experience', i, 'period', e.target.value)}
                              placeholder="Period"
                              style={{ fontSize: 13, padding: '6px 10px', width: 'auto', minWidth: 140 }}
                            />
                          </ExpRow>
                          {bullets.map((bullet, bi) => (
                            <BulletRow key={bi}>
                              <span className="bullet">•</span>
                              <AutoBullet
                                value={bullet}
                                onChange={e => updateBullet(i, bi, e.target.value)}
                                placeholder="Describe what you did..."
                              />
                              <button type="button" className="remove" onClick={() => removeBullet(i, bi)}>
                                <CloseIcon />
                              </button>
                            </BulletRow>
                          ))}
                          <AddBulletBtn onClick={() => addBullet(i)}>
                            + Add bullet point
                          </AddBulletBtn>
                        </ExpCard>
                      );
                    })}
                    <AddSectionBtn onClick={addExperience}>
                      <AddIcon /> Add Experience
                    </AddSectionBtn>
                    {renderAIPrompt('experience', 'e.g. Quantify every bullet with metrics and use strong action verbs.')}
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Education</EditSectionLabel>
                    {(editData.education || []).map((edu, i) => (
                      <ExpCard key={i}>
                        <FieldInput
                          value={edu.degree || ''}
                          onChange={e => updateEducation(i, 'degree', e.target.value)}
                          placeholder="Degree (e.g. B.S. Computer Science)"
                          style={{ fontWeight: 700, fontSize: 15, border: 'none', padding: '4px 0', color: '#111827' }}
                        />
                        <ExpRow>
                          <FieldInput
                            value={edu.school || edu.institution || ''}
                            onChange={e => updateEducation(i, 'school', e.target.value)}
                            placeholder="School"
                            style={{ fontSize: 13, padding: '6px 10px' }}
                          />
                          <FieldInput
                            value={edu.year || edu.graduationYear || ''}
                            onChange={e => updateEducation(i, 'year', e.target.value)}
                            placeholder="Year"
                            style={{ fontSize: 13, padding: '6px 10px', width: 'auto', minWidth: 120 }}
                          />
                        </ExpRow>
                        {edu.field && (
                          <FieldInput
                            value={edu.field || ''}
                            onChange={e => updateEducation(i, 'field', e.target.value)}
                            placeholder="Field of Study"
                            style={{ fontSize: 13, padding: '6px 10px', marginTop: 4 }}
                          />
                        )}
                        <button type="button"
                          className="remove"
                          onClick={() => removeEducation(i)}
                          style={{ position: 'absolute', top: 8, right: 8, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#dc2626', padding: 4 }}
                        >
                          <DeleteIcon style={{ fontSize: 16 }} />
                        </button>
                      </ExpCard>
                    ))}
                    <AddSectionBtn onClick={addEducation}>
                      <AddIcon /> Add Education
                    </AddSectionBtn>
                    {renderAIPrompt('education', 'e.g. Keep it concise — just degree, school, and year.')}
                  </EditSection>

                  <EditSection>
                    <EditSectionLabel>Projects</EditSectionLabel>
                    {(editData.projects || []).map((proj, i) => {
                      const techs = Array.isArray(proj.technologies) ? proj.technologies : [];
                      return (
                        <ExpCard key={i}>
                          <FieldInput
                            value={proj.title || proj.name || ''}
                            onChange={e => updateProject(i, 'title', e.target.value)}
                            placeholder="Project Name"
                            style={{ fontWeight: 700, fontSize: 15, border: 'none', padding: '4px 0', color: '#111827' }}
                          />
                          {(proj.link || proj.url) !== undefined && (
                            <FieldInput
                              value={proj.link || proj.url || ''}
                              onChange={e => updateProject(i, 'link', e.target.value)}
                              placeholder="Project link (optional)"
                              style={{ fontSize: 13, padding: '6px 10px', marginTop: 4 }}
                            />
                          )}
                          <AutoTextarea
                            value={proj.description || ''}
                            onChange={e => updateProject(i, 'description', e.target.value)}
                            placeholder="What did you build, what was the impact..."
                            style={{ marginTop: 6 }}
                          />
                          <FieldInput
                            value={techs.join(', ')}
                            onChange={e => updateProject(i, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Technologies (comma separated)"
                            style={{ fontSize: 13, padding: '6px 10px', marginTop: 6 }}
                          />
                          <button type="button"
                            className="remove"
                            onClick={() => removeProject(i)}
                            style={{ position: 'absolute', top: 8, right: 8, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#dc2626', padding: 4 }}
                          >
                            <DeleteIcon style={{ fontSize: 16 }} />
                          </button>
                        </ExpCard>
                      );
                    })}
                    <AddSectionBtn onClick={addProject}>
                      <AddIcon /> Add Project
                    </AddSectionBtn>
                    {renderAIPrompt('projects', 'e.g. Emphasize impact and the tech stack for each project.')}
                  </EditSection>

                  <DoneEditingBtn onClick={() => { loadPreview(editData, templateId); setActiveTab('preview'); }}>
                    Done Editing, Back to Download
                  </DoneEditingBtn>
                </EditScroll>
              </RightPane>
            </TwoColLayout>
          </>
        )}
      </ModalContainer>
    </Dialog>
  );
}

function parseBullets(description) {
  if (!description) return [''];
  return description
    .split(/\n/)
    .map(line => line.replace(/^[\s•\-\*]+/, '').trim())
    .filter(Boolean);
}
