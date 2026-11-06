import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress, Drawer } from '@mui/material';
import {
  Check as CheckIcon,
  ExpandMore as DownIcon,
  ExpandLess as UpIcon,
  AutoAwesome as SparkIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { profileAPI, tailoredProfileAPI, subscriptionAPI, externalApplicationAPI } from '../services/api';
import { extractApiError } from '../utils/apiError';
import { parseLimitError } from '../utils/aiLimit';
import { useBackgroundTasks, useMountedRef } from '@/contexts/BackgroundTasksContext';
import { useToast } from '@/contexts/ToastContext';
import { FlowDialog, PrimaryBtn, SecondaryBtn, Centered, Hint, ChangeCard, KeepBtn, ErrorText } from './flow/FlowLayout';
import NoteField from './flow/NoteField';
import ResumePreviewModal from './ResumePreviewModal';

/**
 * Tailor for a Job, started from a job's page. One full screen, four steps:
 *   Fit    - the match (/job-match, free when cached) and each gap as a plain
 *            question: "I have this" (with one line of where) or "I don't".
 *            Only what the candidate confirms reaches the resume.
 *   Plan   - per section, the changes picked for this job from the match;
 *            tap to adjust, say anything else, choose 1 or 2 pages.
 *   Review - the tailoring runs (as a background task, so it can be hidden),
 *            then each changed section before and after, to keep or skip or
 *            refine with Ask AI. Saving updates the tailored copy.
 *   Apply  - the Download Resume screen as it is everywhere else, plus Apply:
 *            the job's page opens, the PDF downloads, and the start is tracked
 *            quietly. A sheet offers their details to copy; the "Did you
 *            apply?" question comes later, from PendingApplicationCard.
 */

const STEPS = ['Fit', 'Plan', 'Review', 'Apply'];
// Years come from the dates on the roles, a degree from Education, the job
// family from the titles: saying "I have this" cannot add any of them.
const UNASKED_TYPES = new Set(['responsibility', 'experience_years', 'education', 'title']);
const PROGRESS = ['Reading the job post', 'Applying your answers', 'Rewriting each section', 'Checking keywords & length'];
const PROGRESS_AT = [3000, 9000, 30000];
const SENIOR_WORD = /\b(staff|lead|principal|senior|head|director)\b/i;
const REFINE_OPTIONS = {
  title: ['Shorter', 'Match job title exactly'],
  summary: ['Shorter', 'Add a metric', 'More job keywords'],
  skills: ['Fewer skills', 'Job keywords first'],
  experience: ['Shorter', 'Add a metric', 'Lead with impact'],
};
const REFINE_PLACEHOLDER = {
  title: 'e.g. keep "Frontend" first',
  summary: 'e.g. mention the checkout redesign',
  skills: 'e.g. drop jQuery',
  experience: 'e.g. lead with the load-time win',
};

const label = (r) => String(r?.requirement || '').trim();
// A tap while a note field has the keyboard up: blurring first brings the
// footer back and shifts the page under the finger, so the tap was lost.
// Keep the focus through the tap, then close the keyboard.
const keepFocus = { onPointerDown: (e) => e.preventDefault(), onMouseDown: (e) => e.preventDefault() };
const closeKeyboard = () => document.activeElement?.blur?.();
const flatSkills = (skills) => (Array.isArray(skills) ? skills : skills && typeof skills === 'object' ? Object.values(skills).flat() : [])
  .map((s) => (typeof s === 'string' ? s : s?.name || ''))
  .filter(Boolean);
const same = (a, b) => String(a || '').replace(/\s+/g, ' ').trim().toLowerCase() === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
const applyUrlOf = (job) => job?.applyUrl || job?.sourceUrl || job?.url || '';
/**
 * Opens a posting in a new tab and says whether it worked. window.open with the
 * noopener feature returns null even on success, so a blank tab is opened first
 * (in the tap, so it is allowed), cut loose from this page, and then pointed at
 * the posting.
 */
function openInNewTab(url) {
  try {
    const win = window.open('about:blank', '_blank');
    if (!win) return false;
    try { win.opener = null; } catch (_) { /* cross-origin handle: nothing to cut */ }
    win.location.replace(url);
    return true;
  } catch (_) {
    return false;
  }
}
const lowerFirst = (s) => (s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** The tailored resume as plain text, for the "Enter manually" box on a company's form. */
function resumeAsText(copy = {}, user = {}, profile = {}) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const contact = [user?.email, profile?.phone, profile?.location, profile?.linkedinUrl].filter(Boolean).join(' | ');
  const lines = [name, copy.title, contact].filter(Boolean);
  if (copy.summary) lines.push('', 'SUMMARY', String(copy.summary).trim());
  const roles = (copy.experience || []).filter((e) => e && (e.title || e.company));
  if (roles.length) {
    lines.push('', 'EXPERIENCE');
    roles.forEach((e) => {
      const dates = [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' to ');
      lines.push('', [e.title, e.company].filter(Boolean).join(', ') + (dates ? ` (${dates})` : ''));
      String(e.description || '').split('\n').map((l) => l.replace(/^[\s\u2022*-]+/, '').trim()).filter(Boolean)
        .forEach((l) => lines.push(`- ${l}`));
    });
  }
  const skills = flatSkills(copy.skillsGrouped || copy.skills);
  if (skills.length) lines.push('', 'SKILLS', skills.join(', '));
  const edu = (copy.education || []).filter((e) => e && (e.institution || e.school || e.degree));
  if (edu.length) {
    lines.push('', 'EDUCATION');
    edu.forEach((e) => lines.push([e.degree, e.field, e.institution || e.school].filter(Boolean).join(', ')));
  }
  return lines.join('\n');
}

function resumeText(p = {}) {
  return [
    p.title, p.summary, flatSkills(p.skillsGrouped || p.skills).join(', '),
    ...(p.experience || []).map((e) => `${e?.title || ''} ${e?.description || ''}`),
    ...(p.projects || []).map((x) => `${x?.title || x?.name || ''} ${x?.description || ''}`),
  ].join('\n').toLowerCase();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function countKeywords(keywords, text) {
  return keywords.filter((k) => new RegExp(`(^|[^a-z0-9+#])${escapeRe(k.toLowerCase())}($|[^a-z0-9+#])`).test(text)).length;
}

/** The model's changelog note for a section, when it reads as a reason. */
const INTERNAL_ACTIONS = /corrected|restored|reconciled|repair|tenure|foundation|drift|enforce/i;
function changelogReason(changelog, keys) {
  const hit = (Array.isArray(changelog) ? changelog : []).find((c) => c
    && keys.includes(String(c.section || '').toLowerCase())
    && !INTERNAL_ACTIONS.test(String(c.action || ''))
    && typeof c.detail === 'string' && c.detail.trim().length > 8 && c.detail.length < 160);
  if (!hit) return '';
  const d = hit.detail.trim().replace(/\s+/g, ' ');
  return /[.!?]$/.test(d) ? d : `${d}.`;
}

/** The tailored copy's changes, one card per section (one per role for Experience). */
function buildChanges(original, tailored, jobKeywords) {
  const out = [];
  const log = tailored.changelog;
  const usesKeywords = (text) => countKeywords(jobKeywords, String(text || '').toLowerCase());
  const beforeTitle = String(original.title || original.headline || '').trim();
  if (tailored.title && !same(beforeTitle, tailored.title)) {
    out.push({ id: 'title', section: 'title', label: 'Title', before: beforeTitle, after: String(tailored.title).trim(),
      reason: changelogReason(log, ['title', 'headline']) || 'Matches the title on the posting.' });
  }
  if (tailored.summary && !same(original.summary, tailored.summary)) {
    const n = usesKeywords(tailored.summary);
    out.push({ id: 'summary', section: 'summary', label: 'Summary', before: String(original.summary || '').trim(), after: String(tailored.summary).trim(),
      reason: changelogReason(log, ['summary']) || (n ? `Uses ${n} of the job's keywords.` : 'Rewritten for this job.') });
  }
  const beforeSkills = flatSkills(original.skills);
  const afterSkills = flatSkills(tailored.skillsGrouped || tailored.skills);
  if (afterSkills.length && !same(beforeSkills.join(', '), afterSkills.join(', '))) {
    out.push({ id: 'skills', section: 'skills', label: 'Skills', before: beforeSkills.join(', '), after: afterSkills.join(', '),
      reason: changelogReason(log, ['skills']) || `${afterSkills.length} skills, ordered for this job.` });
  }
  (tailored.experience || []).forEach((role, i) => {
    const was = (original.experience || [])[i];
    if (!role || !was || same(was.description, role.description)) return;
    out.push({ id: `exp-${i}`, section: 'experience', index: i,
      label: [role.title || was.title, role.company || was.company].filter(Boolean).join(' · ') || `Role ${i + 1}`,
      before: String(was.description || '').trim(), after: String(role.description || '').trim(),
      reason: changelogReason(log, [`experience_${i + 1}`]) || (i === 0 ? changelogReason(log, ['experience']) : '') || 'Rewritten for this job.' });
  });
  return out;
}

const Logo = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef0ff;
  color: #4b4fc4;
  font-size: 19px;
  font-weight: 800;
  img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
`;

const Card = styled.section`
  margin-bottom: 14px;
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${(p) => (p.$on ? '#d9dafa' : '#e8e9f0')};

  h4 { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3; color: #13152a; }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .note { margin: 8px 0 0; font-size: 15px; line-height: 1.5; color: #6b7280; }
`;

const ScoreCard = styled(Card)`
  .top { display: flex; align-items: center; gap: 16px; }
  .text strong { display: block; font-size: 18px; color: #13152a; }
  .text span { font-size: 14.5px; color: #6b7280; }
  .warn { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #fdf6e7; color: #7a4f0c; font-size: 14.5px; line-height: 1.45; }
`;

const Ring = ({ score }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${score}% match`} style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="#e7e8f7" strokeWidth="8" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="#5b5fd6" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
        transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      <text x="42" y="48" textAnchor="middle" fontSize="20" fontWeight="800" fill="#13152a">{score}%</text>
    </svg>
  );
};

const Badge = styled.span`
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: ${(p) => (p.$must ? '#fdecec' : '#fdf1e4')};
  color: ${(p) => (p.$must ? '#b42318' : '#b45309')};
`;

const SectionTitle = styled.h3`
  margin: 22px 2px 2px;
  font-size: 19px;
  font-weight: 700;
  color: #13152a;
`;

const Choice = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;

  button {
    height: 48px;
    border-radius: 12px;
    border: 1.5px solid #e2e4ec;
    background: #fff;
    color: #13152a;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    svg { font-size: 18px; }
  }
  button[aria-pressed='true'] { background: #5b5fd6; border-color: #5b5fd6; color: #fff; }
  button.no[aria-pressed='true'] { background: #f1f2f6; border-color: #c9ccd8; color: #13152a; }
`;

const Covered = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1.5px solid #cfe9d8;
  background: #effaf3;
  color: #1f6b3a;
  font: inherit;
  font-size: 15.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  span { flex: 1; }
  svg { font-size: 20px; }
`;

const CoveredList = styled.ul`
  margin: -6px 0 16px;
  padding: 0 4px;
  list-style: none;
  li { display: flex; gap: 8px; padding: 6px 0; font-size: 15px; color: #374151; }
  svg { font-size: 18px; color: #16a34a; flex-shrink: 0; margin-top: 1px; }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 40px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$on ? '#5b5fd6' : '#e2e4ec')};
  background: ${(p) => (p.$on ? '#eef0ff' : '#fff')};
  color: ${(p) => (p.$on ? '#4b4fc4' : '#13152a')};
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  svg { font-size: 16px; }
  &:disabled { opacity: 0.55; cursor: default; }
`;

const Count = styled.span`
  font-size: 14px;
  color: #9ca3af;
  white-space: nowrap;
`;

const Pages = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-top: 12px;
  padding: 4px;
  border-radius: 14px;
  background: #f1f2f6;

  button {
    height: 44px;
    border: none;
    border-radius: 11px;
    background: transparent;
    font: inherit;
    font-size: 15.5px;
    font-weight: 600;
    color: #5a5e7a;
    cursor: pointer;
  }
  button[aria-pressed='true'] { background: #fff; color: #13152a; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.12); }
`;

const Progress = styled.ol`
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #e8e9f0;
  overflow: hidden;

  li { display: flex; align-items: center; gap: 14px; padding: 18px; font-size: 16.5px; font-weight: 500; color: #9ca3af; }
  li + li { border-top: 1px solid #eef0f4; }
  li[data-state='done'], li[data-state='active'] { color: #13152a; }
  .dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #f1f2f6; }
  li[data-state='done'] .dot { background: #4caf6e; color: #fff; }
  .dot svg { font-size: 18px; }
`;

const Gain = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #f0f0fc;
  border: 1.5px solid #e1e2f8;

  .k { font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #5a5e7a; }
  .v { margin-top: 4px; font-size: 30px; font-weight: 800; color: #16794a; font-variant-numeric: tabular-nums; }
  .v small { font-size: 16px; font-weight: 600; color: #9ca3af; }
  .was { font-size: 13.5px; color: #6b7280; }
`;

const ChangeFoot = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  .why { flex: 1; min-width: 0; font-size: 14px; line-height: 1.4; color: #6b7280; }
`;

const AskBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid ${(p) => (p.$open ? '#5b5fd6' : '#e1e2f8')};
  background: #f0f0fc;
  color: #4b4fc4;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  svg { font-size: 16px; }
`;

const AskRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  > div { flex: 1; min-width: 0; }
  > button {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    margin-top: 12px;
    border: none;
    border-radius: 14px;
    background: #5b5fd6;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    &:disabled { opacity: 0.4; cursor: default; }
  }
`;

const Sheet = styled.div`
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  .grab { width: 40px; height: 5px; margin: 0 auto 16px; border-radius: 3px; background: #d9dbe5; }
  h3 { margin: 0 0 6px; font-size: 21px; font-weight: 700; color: #13152a; }
  p { margin: 0 0 18px; font-size: 15.5px; line-height: 1.45; color: #6b7280; }
  .calm { margin: 12px 0 0; font-size: 13.5px; text-align: center; }
  .open { margin-bottom: 14px; }
  /* The shared buttons are built for a footer row (flex: 1); in this sheet they fill the width. */
  .open button, & > button { display: block; width: 100%; box-sizing: border-box; padding: 0 20px; }
  .kit {
    margin: 0 0 16px;
    border: 1px solid #e5e7f0;
    border-radius: 14px;
    background: #f8f9fc;
    overflow: hidden;
  }
  .kit summary {
    list-style: none;
    padding: 13px 16px;
    font-size: 15px;
    font-weight: 650;
    color: #13152a;
    cursor: pointer;
  }
  .kit summary::-webkit-details-marker { display: none; }
  .kit summary::after { content: '+'; float: right; color: #6b7280; font-weight: 500; }
  .kit[open] summary::after { content: '\\2212'; }
  .kit button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 8px 16px;
    border: none;
    border-top: 1px solid #e5e7f0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
  }
  .kit .k { flex: 0 0 64px; font-size: 13px; color: #6b7280; }
  .kit .v { flex: 1; min-width: 0; font-size: 15px; color: #13152a; overflow-wrap: anywhere; }
  .kit .c { flex: 0 0 auto; font-size: 14px; font-weight: 650; color: #4b4fc4; white-space: nowrap; }
  .links { display: flex; flex-direction: column; margin-top: 12px; }
  .links button {
    height: 48px;
    border: none;
    background: none;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    color: #4b4fc4;
    cursor: pointer;
  }
`;

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object} props.job - the posting (CandidateJobs shape)
 * @param {Object} props.profile - the candidate's profile
 * @param {Object} props.user
 * @param {string} props.jobDescription - the posting as text
 * @param {Object} [props.initialCopy] - an existing tailored copy: opens at Apply
 * @param {(limit) => void} props.onLimit
 * @param {(pending: boolean) => void} [props.onPendingChange] - a result waits at Review
 */
export default function JobTailorFlow({ open, onClose, job, profile, user, jobDescription, initialCopy, onLimit, onPendingChange }) {
  const toast = useToast();
  const { startTask, dismissTask } = useBackgroundTasks();
  const mountedRef = useMountedRef();
  const [step, setStep] = useState('fit'); // fit | plan | tailoring | review | apply
  const [hidden, setHidden] = useState(false);
  const [match, setMatch] = useState(null);
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({}); // label -> 'yes' | 'no'
  const [proof, setProof] = useState({}); // label -> text
  const [showCovered, setShowCovered] = useState(false);
  const [plan, setPlan] = useState(null);
  const [notes, setNotes] = useState({});
  const [pages, setPages] = useState(1);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { tailored, savedId }
  const [kept, setKept] = useState({});
  const [overrides, setOverrides] = useState({});
  const [asking, setAsking] = useState(null);
  const [askText, setAskText] = useState('');
  const [refining, setRefining] = useState(null);
  const [afterScore, setAfterScore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finalCopy, setFinalCopy] = useState(null);
  const [applySheet, setApplySheet] = useState(false);
  // Whether the company's page really opened: a phone may block the new tab.
  const [applyOpened, setApplyOpened] = useState(true);
  const [creditLabel, setCreditLabel] = useState('1 credit');
  const bodyRef = useRef(null);
  const rescoreRef = useRef(0);
  const hiddenRef = useRef(false);
  hiddenRef.current = hidden;
  const taskId = `tailor:${job?.id || `${job?.title}|${job?.company}`}`;
  const applyUrl = applyUrlOf(job);
  const company = job?.company || 'the company';

  useEffect(() => { onPendingChange?.(step === 'tailoring' || (step === 'review' && !!result)); }, [step, result, onPendingChange]);
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [step]);

  // Opening: an existing copy goes straight to Apply; work in flight or a
  // result waiting at Review is picked up where it was; anything else starts
  // over at Fit.
  useEffect(() => {
    if (!open) return;
    setHidden(false);
    if (initialCopy) { setFinalCopy(initialCopy); setStep('apply'); return; }
    if (step === 'tailoring' || (step === 'review' && result)) return;
    setStep('fit');
    setError('');
    setAnswers({});
    setProof({});
    setPlan(null);
    setNotes({});
    setResult(null);
    loadMatch();
    subscriptionAPI.getUsage().then(({ data }) => {
      const t = data?.usage?.tailor_profile;
      const unlimited = t && [t.weeklyLimit, t.monthlyLimit, t.dailyLimit ?? -1, t.lifetimeLimit ?? -1].every((v) => v === -1);
      setCreditLabel(unlimited ? '' : '1 credit');
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCopy]);

  const fail = (err, fallback) => {
    const limit = parseLimitError(err);
    if (limit) { onLimit?.(limit); onClose?.(); return; }
    setError(extractApiError(err, fallback));
  };

  const loadMatch = async () => {
    setMatch(null);
    setScore(null);
    try {
      const { data } = await profileAPI.jobMatch(job?._isExternal && job?.id
        ? { externalJobId: job.id }
        : { jobDescription, jobTitle: job?.title });
      if (!data?.success || !data.data) throw new Error(data?.error || 'Could not score this job');
      setMatch(data.data);
      setScore(data.data.score);
    } catch (err) {
      fail(err, 'Could not read this job. Please try again.');
    }
  };

  const scored = useMemo(() => (match?.requirements || []).filter((r) => label(r) && r.type !== 'responsibility'), [match]);
  const covered = scored.filter((r) => r.coverage === 'strong');
  const questions = useMemo(() => scored
    .filter((r) => r.coverage !== 'strong' && !UNASKED_TYPES.has(r.type))
    .sort((a, b) => (a.hardness === 'must' ? 0 : 1) - (b.hardness === 'must' ? 0 : 1)), [scored]);
  const yesReqs = questions.filter((r) => answers[label(r)] === 'yes');
  const answered = questions.filter((r) => answers[label(r)]).length;

  const c = match?.components || {};
  const overqualified = !!(c.requiredYears && c.candidateYears && c.candidateYears >= c.requiredYears * 2);
  const seniorWord = (SENIOR_WORD.exec(profile?.title || '') || [])[1];
  const seniorityNote = overqualified
    ? `This role asks for ${c.requiredYears}+ years and you have about ${Math.round(c.candidateYears)}. We'll keep your experience but tone down ${seniorWord ? `${seniorWord[0].toUpperCase()}${seniorWord.slice(1).toLowerCase()} wording` : 'senior wording'}.`
    : '';

  const answer = (r, value) => {
    const key = label(r);
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  };

  // The score follows the answers; the latest answer wins. Free: arithmetic
  // over the match already read.
  const confirmedKey = yesReqs.map(label).join('\n');
  useEffect(() => {
    if (!match) return;
    const ticket = ++rescoreRef.current;
    if (!confirmedKey) { setScore(match.score); return; }
    profileAPI.jobMatchRescore({ requirements: match.requirements, components: match.components, confirmed: confirmedKey.split('\n') })
      .then(({ data }) => { if (ticket === rescoreRef.current && data?.success) setScore(data.score); })
      .catch(() => {});
  }, [confirmedKey, match]);

  const noteFor = (r) => {
    if (r.note) return r.note;
    if (r.coverage === 'partial' && r.evidence) return `Partly shown: ${String(r.evidence).replace(/^\[\d+\]\s*/, '')}`;
    return 'Not mentioned anywhere on your resume.';
  };

  // The Plan step's picks, from the match: what this job wants and how the
  // resume stands against it.
  const buildPlan = (pageCount) => {
    // A theme to open on ("consumer-facing product impact"); a tool name is
    // not one, and keeps its capitals.
    const lead = [...yesReqs, ...covered].find((r) => ['domain', 'experience', 'soft'].includes(r.type) && label(r).length <= 34);
    const titleMatches = same(profile?.title, job?.title);
    const yesSkills = yesReqs.filter((r) => r.type === 'skill');
    const skillCount = flatSkills(profile?.skills).length;
    return [
      { key: 'title', label: 'Title', options: [
        { id: 'match', label: 'Match job title', on: !titleMatches, excludes: 'keep' },
        { id: 'keep', label: 'Keep current title', on: titleMatches, excludes: 'match' },
        ...(overqualified ? [{ id: 'tone', label: 'Tone down seniority', on: true }] : []),
      ] },
      { key: 'summary', label: 'Summary', options: [
        { id: 'lead', label: lead ? `Lead with ${lowerFirst(label(lead))}` : 'Lead with what this job wants most', on: true },
        { id: 'keywords', label: 'Use job keywords', on: true },
        { id: 'short', label: 'Keep to 3 lines', on: true },
        ...(job?.company ? [{ id: 'company', label: `Mention ${job.company}`, on: false }] : []),
      ] },
      { key: 'skills', label: 'Skills', options: [
        { id: 'order', label: 'Order by job relevance', on: true },
        ...(skillCount > 15 ? [{ id: 'trim', label: 'Trim to 15', on: true }] : []),
        ...(yesSkills.length ? [{ id: 'confirmed', label: 'Add confirmed skills', on: true }] : []),
      ] },
      { key: 'experience', label: 'Experience', options: [
        { id: 'rewrite', label: 'Rewrite bullets for this job', on: true },
        { id: 'metrics', label: 'Lead with results and metrics', on: true },
        { id: 'cut', label: 'Cut unrelated bullets', on: pageCount === 1 },
      ] },
    ];
  };

  const toPlan = () => {
    if (!plan) {
      const pageCount = (profile?.experience || []).length > 4 ? 2 : 1;
      setPages(pageCount);
      setPlan(buildPlan(pageCount));
    }
    setStep('plan');
  };

  const toggleOption = (sectionKey, id) => {
    setPlan((prev) => prev.map((s) => {
      if (s.key !== sectionKey) return s;
      const target = s.options.find((o) => o.id === id);
      // Match and Keep are a pair: one of them is always on.
      if (target.excludes && target.on) return s;
      return { ...s, options: s.options.map((o) => {
        if (o.id === id) return { ...o, on: !o.on };
        if (!target.on && target.excludes === o.id) return { ...o, on: false };
        return o;
      }) };
    }));
  };

  const tailor = async () => {
    setError('');
    setStep('tailoring');
    setProgress(0);
    const timers = PROGRESS_AT.map((ms, i) => setTimeout(() => mountedRef.current && setProgress(i + 1), ms));
    const on = (key) => (plan.find((s) => s.key === key)?.options || []).filter((o) => o.on);
    const has = (key, id) => on(key).some((o) => o.id === id);
    const yesSkills = yesReqs.filter((r) => r.type === 'skill');
    const evidence = (r) => String(proof[label(r)] || '').trim();
    const gapSelections = yesReqs.length ? {
      acceptedGaps: yesSkills.map(label),
      skippedGaps: [],
      acceptedGapObjects: yesSkills.map((r) => ({
        skill: label(r),
        type: r.hardness === 'must' ? 'required' : 'nice_to_have',
        severity: r.hardness === 'must' ? 'critical' : 'nice_to_have',
        customPrompt: evidence(r),
        status: 'pending',
      })),
      confirmedEvidence: yesReqs.map((r) => ({ requirement: label(r), evidence: evidence(r) || 'Confirmed by the candidate; no details given.' })),
    } : undefined;
    const tailorSettings = {
      tone: 'professional',
      summaryLines: has('summary', 'short') ? 3 : undefined,
      maxSkills: has('skills', 'trim') ? 15 : undefined,
      experienceLines: pages === 1 ? 3 : 5,
      pages,
      plan: {
        title: on('title').map((o) => o.label),
        summary: on('summary').map((o) => o.label),
        skills: on('skills').map((o) => o.label),
        experience: on('experience').map((o) => o.label),
        keepTitle: has('title', 'keep'),
      },
      sectionNotes: notes,
    };
    const stillMissing = scored
      .filter((r) => r.coverage !== 'strong' && answers[label(r)] !== 'yes')
      .map((r) => ({ skill: label(r), severity: r.hardness === 'must' ? 'critical' : 'nice_to_have', status: 'pending' }));

    try {
      // A background task: it takes about a minute, the screen can be hidden,
      // and the copy is saved inside the task, so leaving loses nothing.
      const outcome = await startTask({
        id: taskId,
        label: `Tailoring your resume for ${job?.title || 'this job'}`,
        doneLabel: `Resume tailored for ${job?.title || 'this job'}`,
        openPath: '/profile?tab=tailored',
        ownerAlive: () => mountedRef.current,
        run: async () => {
          const { data } = await profileAPI.tailorProfileForJob({
            jobDescription, jobTitle: job?.title, company: job?.company, gapSelections, tailorSettings,
          });
          if (!data?.success) throw new Error(data?.error || 'Tailoring failed');
          let savedId = null;
          try {
            const saved = await tailoredProfileAPI.save({
              jobTitle: job?.title || data.data.jobTitle || 'Untitled position',
              companyName: job?.company || '',
              jobUrl: applyUrl || undefined,
              tailoredData: data.data,
              originalProfileSnapshot: profile,
              matchScore: score,
              skillGaps: stillMissing,
            });
            savedId = saved.data?.id || null;
          } catch (_) { /* saved again from Review */ }
          return { tailored: data.data, savedId };
        },
      });
      if (!mountedRef.current) return;
      dismissTask(taskId);
      setResult(outcome);
      const tailored = outcome.tailored;
      const changes = buildChanges(profile || {}, tailored, tailored._jobKeywords || []);
      setKept(Object.fromEntries(changes.map((ch) => [ch.id, true])));
      setOverrides({});
      setAsking(null);
      setStep('review');
      // The score once the gaps you confirmed and the ones tailoring can
      // surface (partly shown, or related work) are covered.
      const confirmed = [...new Set([...yesReqs.map(label), ...(match?.surfaceable || [])])];
      setAfterScore(null);
      profileAPI.jobMatchRescore({ requirements: match.requirements, components: match.components, confirmed })
        .then(({ data }) => { if (mountedRef.current && data?.success) setAfterScore(data.score); })
        .catch(() => {});
      if (hiddenRef.current) toast.success(`Your resume for ${job?.title || 'this job'} is ready. Tap Tailor resume to review it.`);
    } catch (err) {
      if (!mountedRef.current) return;
      dismissTask(taskId);
      setStep('plan');
      fail(err, 'Tailoring failed. No credit was used. Please try again.');
    } finally {
      timers.forEach(clearTimeout);
    }
  };
  const tailored = result?.tailored;
  const jobKeywords = tailored?._jobKeywords || [];
  const changes = useMemo(() => (tailored ? buildChanges(profile || {}, tailored, jobKeywords) : []), [tailored, profile, jobKeywords]);
  const shown = changes.map((ch) => (overrides[ch.id] !== undefined ? { ...ch, after: overrides[ch.id] } : ch));

  // The tailored copy with skipped sections put back and refinements applied.
  const buildCopy = (keptMap = kept, over = overrides) => {
    const out = { ...tailored, experience: (tailored.experience || []).map((e) => ({ ...e })) };
    for (const ch of changes) {
      const isKept = keptMap[ch.id];
      const after = over[ch.id] !== undefined ? over[ch.id] : ch.after;
      if (ch.section === 'title') out.title = isKept ? after : ch.before;
      else if (ch.section === 'summary') out.summary = isKept ? after : ch.before;
      else if (ch.section === 'skills') {
        if (!isKept) { out.skills = profile?.skills; delete out.skillsGrouped; } else if (over[ch.id] !== undefined) {
          out.skills = after.split(',').map((s) => s.trim()).filter(Boolean);
          delete out.skillsGrouped;
        }
      } else if (ch.section === 'experience' && out.experience[ch.index]) {
        out.experience[ch.index].description = isKept ? after : ch.before;
      }
    }
    return out;
  };

  const refine = async (ch, instruction) => {
    const text = String(instruction || '').trim();
    if (!text || refining) return;
    setRefining(ch.id);
    setError('');
    const copy = buildCopy();
    const context = ` This resume is tailored for the ${job?.title || ''} role at ${company}.`;
    const role = ch.section === 'experience' ? copy.experience[ch.index] : null;
    const instructions = ch.section === 'experience'
      ? { experience: `Rewrite ONLY entry ${ch.index + 1} ("${role?.title || ''}" at ${role?.company || ''}) and return every other entry exactly as given. ${text}.${context}` }
      : { [ch.section]: `${text}.${context}` };
    try {
      const { data } = await profileAPI.regenerateSections({
        profileData: { title: copy.title, summary: copy.summary, skills: flatSkills(copy.skillsGrouped || copy.skills), experience: copy.experience },
        instructions,
      });
      const d = data?.data || {};
      const next = ch.section === 'experience' ? d.experience?.[ch.index]?.description
        : ch.section === 'skills' ? flatSkills(d.skills).join(', ')
          : d[ch.section];
      if (!next || typeof next !== 'string') throw new Error('The AI returned nothing for this section. Please try again.');
      setOverrides((p) => ({ ...p, [ch.id]: next.trim() }));
      setKept((p) => ({ ...p, [ch.id]: true }));
      setAsking(null);
      setAskText('');
    } catch (err) {
      fail(err, 'Could not rewrite this section. Please try again.');
    } finally {
      setRefining(null);
    }
  };

  const keptCount = changes.filter((ch) => kept[ch.id]).length;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const copy = buildCopy();
      const record = { tailoredData: copy, matchScore: afterScore ?? score };
      if (result.savedId) await tailoredProfileAPI.update(result.savedId, record);
      else {
        const saved = await tailoredProfileAPI.save({
          ...record, jobTitle: job?.title || 'Untitled position', companyName: job?.company || '', jobUrl: applyUrl || undefined,
        });
        setResult((r) => ({ ...r, savedId: saved.data?.id || null }));
      }
      setFinalCopy(copy);
      setStep('apply');
    } catch (err) {
      setError(extractApiError(err, 'Could not save your tailored resume. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    setApplySheet(false);
    setStep('fit');
    setResult(null);
    setFinalCopy(null);
    onClose?.();
  };

  // In the tap itself, so the new tab isn't blocked; the PDF downloads next.
  const handleApply = () => {
    setApplyOpened(openInNewTab(applyUrl));
    // Tracked quietly; never blocks the tap. 409 means it is already tracked.
    if (applyUrl) {
      const body = {
        jobTitle: job?.title || 'Untitled position',
        company: job?.company || '',
        jobUrl: applyUrl,
        stage: 'in_progress',
        confirmedBy: 'tailored_resume',
      };
      if (job?._isExternal && job?.id) body.externalJobId = job.id;
      if (result?.savedId) body.tailoredProfileId = result.savedId;
      if (typeof score === 'number') body.matchScore = score;
      try { Promise.resolve(externalApplicationAPI.create(body)).catch(() => {}); } catch (_) { /* ignore */ }
    }
    // Only postings we hold can be tracked as applications.
    if (!job?._isExternal) return;
    window.dispatchEvent(new CustomEvent('job-application-started', { detail: { jobId: job.id } }));
    setTimeout(() => mountedRef.current && setApplySheet(true), 600);
  };

  // A phone has no extension to fill the company's form, so the details are one tap away here.
  const detailRows = [
    ['Name', [user?.firstName, user?.lastName].filter(Boolean).join(' ')],
    ['Email', user?.email],
    ['Phone', profile?.phone],
    ['LinkedIn', profile?.linkedinUrl],
    ['Location', profile?.location],
  ].filter(([, value]) => value).map(([label, value]) => ({ label, shown: value, text: value }));
  if (finalCopy) {
    // "Enter manually" on the company's form takes pasted text: no file to hunt for.
    detailRows.unshift({ label: 'Resume', shown: 'As text, to paste into Enter manually', text: resumeAsText(finalCopy, user, profile) });
  }
  const copyDetail = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} copied`);
    } catch (_) {
      toast.error('Could not copy. Press and hold the text instead.');
    }
  };

  const findSimilar = () => {
    finish();
    setTimeout(() => document.getElementById('similar-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };

  const logo = (
    <Logo aria-hidden>
      {job?.companyInfo?.logoUrl ? <img src={job.companyInfo.logoUrl} alt="" /> : String(job?.company || '?').trim()[0]?.toUpperCase()}
    </Logo>
  );

  const renderFit = () => {
    if (!match) {
      return error
        ? <><ErrorText role="alert">{error}</ErrorText><SecondaryBtn type="button" style={{ width: '100%' }} onClick={() => { setError(''); loadMatch(); }}>Try again</SecondaryBtn></>
        : (
          <Centered>
            <CircularProgress size={32} sx={{ color: '#5b5fd6' }} />
            <strong>Reading the job</strong>
            <span>Checking each requirement against your resume.</span>
          </Centered>
        );
    }
    return (
      <>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <ScoreCard>
          <div className="top">
            <Ring score={score ?? match.score} />
            <div className="text">
              <strong>Your resume vs this job</strong>
              <span>{covered.length} requirement{covered.length === 1 ? '' : 's'} covered · {scored.length - covered.length} gap{scored.length - covered.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          {seniorityNote && <div className="warn">{seniorityNote}</div>}
        </ScoreCard>

        {covered.length > 0 && (
          <>
            <Covered type="button" aria-expanded={showCovered} onClick={() => setShowCovered((v) => !v)}>
              <CheckIcon /><span>{covered.length} requirement{covered.length === 1 ? '' : 's'} already covered</span>{showCovered ? <UpIcon /> : <DownIcon />}
            </Covered>
            {showCovered && (
              <CoveredList>{covered.map((r) => <li key={label(r)}><CheckIcon />{label(r)}</li>)}</CoveredList>
            )}
          </>
        )}

        {questions.length > 0 ? (
          <>
            <SectionTitle>Do you have these?</SectionTitle>
            <Hint>We only add what you confirm.</Hint>
            {questions.map((r) => {
              const key = label(r);
              const a = answers[key];
              return (
                <Card key={key} $on={a === 'yes'}>
                  <div className="row">
                    <h4>{key}</h4>
                    <Badge $must={r.hardness === 'must'}>{r.hardness === 'must' ? 'Required' : 'Preferred'}</Badge>
                  </div>
                  <p className="note">{noteFor(r)}</p>
                  <Choice>
                    <button type="button" {...keepFocus} aria-pressed={a === 'yes'} onClick={() => { closeKeyboard(); answer(r, 'yes'); }}>{a === 'yes' && <CheckIcon />}I have this</button>
                    <button type="button" {...keepFocus} className="no" aria-pressed={a === 'no'} onClick={() => { closeKeyboard(); answer(r, 'no'); }}>I don&rsquo;t</button>
                  </Choice>
                  {a === 'yes' && (
                    <NoteField
                      value={proof[key] || ''}
                      onChange={(v) => setProof((p) => ({ ...p, [key]: v }))}
                      placeholder="Where? One line, e.g. the role and what you did"
                      label={`Where you have ${key}`}
                      hints={key}
                      maxLength={200}
                    />
                  )}
                </Card>
              );
            })}
          </>
        ) : (
          <Hint style={{ marginTop: 18 }}>Nothing to ask: your resume already shows what this job asks for that a resume can show.</Hint>
        )}
      </>
    );
  };

  const renderPlan = () => (
    <>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <Hint>Picked for this job from your match. Tap to adjust.</Hint>
      {plan.map((s) => {
        const n = s.options.filter((o) => o.on).length;
        return (
          <Card key={s.key}>
            <div className="row">
              <h4>{s.label}</h4>
              <Count>{n} change{n === 1 ? '' : 's'}</Count>
            </div>
            <Chips>
              {s.options.map((o) => (
                <Chip key={o.id} type="button" {...keepFocus} $on={o.on} aria-pressed={o.on} onClick={() => { closeKeyboard(); toggleOption(s.key, o.id); }}>
                  {o.on && <CheckIcon />}{o.label}
                </Chip>
              ))}
            </Chips>
            <NoteField
              value={notes[s.key] || ''}
              onChange={(v) => setNotes((p) => ({ ...p, [s.key]: v }))}
              placeholder={REFINE_PLACEHOLDER[s.key]}
              label={`Anything else for ${s.label}`}
              hints={job?.title || ''}
            />
          </Card>
        );
      })}
      <Card>
        <h4>Length</h4>
        <Pages role="group" aria-label="Resume length">
          {[1, 2].map((n) => (
            <button key={n} type="button" {...keepFocus} aria-pressed={pages === n} onClick={() => { closeKeyboard(); setPages(n); }}>{n} page{n === 1 ? '' : 's'}</button>
          ))}
        </Pages>
      </Card>
    </>
  );

  const renderTailoring = () => (
    <>
      <SectionTitle style={{ marginTop: 6 }}>Tailoring your resume…</SectionTitle>
      <Hint>About a minute. You can leave; we&rsquo;ll let you know when it&rsquo;s ready.</Hint>
      <Progress>
        {PROGRESS.map((name, i) => {
          const state = i < progress ? 'done' : i === progress ? 'active' : 'pending';
          return (
            <li key={name} data-state={state}>
              <span className="dot">
                {state === 'done' ? <CheckIcon /> : state === 'active' ? <CircularProgress size={18} sx={{ color: '#5b5fd6' }} /> : null}
              </span>
              {name}
            </li>
          );
        })}
      </Progress>
    </>
  );

  const renderReview = () => {
    const copyText = resumeText(buildCopy());
    const kwBefore = countKeywords(jobKeywords, resumeText(profile || {}));
    const kwAfter = countKeywords(jobKeywords, copyText);
    return (
      <>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <Gain>
          <div>
            <div className="k">Match</div>
            <div className="v">{afterScore ?? '…'}{afterScore != null && <small>%</small>}</div>
            <div className="was">was {match?.score}%</div>
          </div>
          {jobKeywords.length > 0 && (
            <div>
              <div className="k">Job keywords</div>
              <div className="v">{kwAfter}<small> / {jobKeywords.length}</small></div>
              <div className="was">was {kwBefore}</div>
            </div>
          )}
        </Gain>
        {shown.length === 0 && <Hint>Your resume already reads well for this job, so the copy keeps your wording.</Hint>}
        {shown.map((ch) => {
          const isKept = !!kept[ch.id];
          const open = asking === ch.id;
          const busy = refining === ch.id;
          return (
            <ChangeCard key={ch.id} $kept={isKept} data-change={ch.id}>
              <div className="head">
                <span className="label">{ch.label}</span>
                <KeepBtn type="button" {...keepFocus} $kept={isKept} aria-pressed={isKept} onClick={() => { closeKeyboard(); setKept((p) => ({ ...p, [ch.id]: !p[ch.id] })); }}>
                  {isKept ? <><CheckIcon />Keep</> : 'Skip'}
                </KeepBtn>
              </div>
              {ch.before && <p className="before">{ch.before}</p>}
              <p className="after">{busy ? 'Rewriting…' : ch.after}</p>
              <ChangeFoot>
                <span className="why">{overrides[ch.id] !== undefined ? 'Rewritten with your request.' : ch.reason}</span>
                <AskBtn type="button" {...keepFocus} $open={open} onClick={() => { closeKeyboard(); setAsking(open ? null : ch.id); setAskText(''); }} disabled={busy}>
                  {open ? 'Close' : <><SparkIcon />Ask AI</>}
                </AskBtn>
              </ChangeFoot>
              {open && (
                <>
                  <AskRow>
                    <NoteField
                      value={askText}
                      onChange={setAskText}
                      placeholder={REFINE_PLACEHOLDER[ch.section]}
                      label={`What to change in ${ch.label}`}
                      hints={job?.title || ''}
                    />
                    <button type="button" {...keepFocus} aria-label="Rewrite this section" disabled={!askText.trim() || busy} onClick={() => { closeKeyboard(); refine(ch, askText); }}>
                      {busy ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon />}
                    </button>
                  </AskRow>
                  <Chips>
                    {REFINE_OPTIONS[ch.section].map((q) => (
                      <Chip key={q} type="button" {...keepFocus} disabled={busy} onClick={() => { closeKeyboard(); refine(ch, q); }}>{q}</Chip>
                    ))}
                  </Chips>
                </>
              )}
            </ChangeCard>
          );
        })}
      </>
    );
  };

  let footer = null;
  if (step === 'fit' && match) {
    footer = (
      <PrimaryBtn type="button" onClick={toPlan}>
        Continue{questions.length ? ` · ${answered} of ${questions.length} answered` : ''}
      </PrimaryBtn>
    );
  } else if (step === 'plan') {
    footer = (
      <>
        {result
          ? <SecondaryBtn type="button" onClick={() => setStep('review')}>Review</SecondaryBtn>
          : <SecondaryBtn type="button" onClick={() => setStep('fit')}>Back</SecondaryBtn>}
        <PrimaryBtn type="button" onClick={tailor}>
          {result ? 'Tailor again' : 'Tailor resume'}{creditLabel ? ` · ${creditLabel}` : ''}
        </PrimaryBtn>
      </>
    );
  } else if (step === 'tailoring') {
    footer = <SecondaryBtn type="button" style={{ flex: 1 }} onClick={() => { setHidden(true); onClose?.(); }}>Hide and keep working</SecondaryBtn>;
  } else if (step === 'review') {
    footer = (
      <>
        <SecondaryBtn type="button" onClick={() => setStep('plan')} disabled={saving}>Back</SecondaryBtn>
        <PrimaryBtn type="button" onClick={save} disabled={saving || !!refining}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : keptCount ? `Save ${keptCount} change${keptCount === 1 ? '' : 's'}` : 'Save resume'}
        </PrimaryBtn>
      </>
    );
  }

  const stepIndex = { fit: 0, plan: 1, tailoring: 2, review: 2, apply: 3 }[step];

  return (
    <>
      <FlowDialog
        open={open && step !== 'apply'}
        onClose={step === 'tailoring' ? () => { setHidden(true); onClose?.(); } : onClose}
        title={`Tailor for ${job?.company || 'this job'}`}
        subtitle={job?.title || ''}
        icon={logo}
        steps={STEPS}
        stepIndex={stepIndex}
        busy={saving}
        footer={footer}
        bodyRef={bodyRef}
      >
        {step === 'fit' && renderFit()}
        {step === 'plan' && plan && renderPlan()}
        {step === 'tailoring' && renderTailoring()}
        {step === 'review' && tailored && renderReview()}
      </FlowDialog>

      <ResumePreviewModal
        open={open && step === 'apply' && !!finalCopy}
        onClose={finish}
        profileData={profile}
        tailoredProfileData={finalCopy}
        jobTitle={job?.title}
        user={user}
        onApply={applyUrl ? handleApply : undefined}
        applyNote={applyUrl ? `Apply downloads this PDF and opens ${company}'s page in a new tab.` : undefined}
      />

      <Drawer
        anchor="bottom"
        open={applySheet}
        sx={{ zIndex: 1400 }}
        onClose={() => setApplySheet(false)}
        PaperProps={{ style: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxWidth: 560, margin: '0 auto' } }}
      >
        <Sheet>
          <div className="grab" />
          <h3>Your resume is ready</h3>
          <p>
            {applyOpened
              ? `We opened ${company}\u2019s application in a new tab. Come back to this tab any time to copy your details or save your resume again.`
              : `Your browser blocked the new tab, so tap below to open ${company}\u2019s application.`}
          </p>
          {!applyOpened && applyUrl && (
            <div className="open">
              <PrimaryBtn
                type="button"
                onClick={() => setApplyOpened(openInNewTab(applyUrl))}
              >
                Open {company}&rsquo;s application
              </PrimaryBtn>
            </div>
          )}
          {detailRows.length > 0 && (
            <details className="kit">
              <summary>Your details, tap to copy</summary>
              {detailRows.map(({ label, shown, text }) => (
                <button type="button" key={label} onClick={() => copyDetail(label, text)}>
                  <span className="k">{label}</span>
                  <span className="v">{shown}</span>
                  <span className="c">Copy</span>
                </button>
              ))}
            </details>
          )}
          <PrimaryBtn type="button" onClick={() => setApplySheet(false)}>Done</PrimaryBtn>
          <p className="calm">We will ask you about this application next time you are here.</p>
          <div className="links">
            {applyUrl && applyOpened && <button type="button" onClick={() => openInNewTab(applyUrl)}>Open {company}&rsquo;s page again</button>}
            {typeof document !== 'undefined' && document.getElementById('similar-jobs') && (
              <button type="button" onClick={findSimilar}>Find similar jobs</button>
            )}
            <button type="button" onClick={finish}>Back to the job</button>
          </div>
        </Sheet>
      </Drawer>
    </>
  );
}
