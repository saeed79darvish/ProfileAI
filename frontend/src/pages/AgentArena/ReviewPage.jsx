import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import RequestEditModal from './RequestEditModal';
import TailorSettingsModal from '../../components/TailorSettingsModal';
import TailoringProgressModal from '../../components/TailoringProgressModal';
import ResumePreviewModal from '../../components/ResumePreviewModal';
import GapReviewDialog from '../../components/GapReviewDialog';
import CoverLetterModal from '../../components/CoverLetterModal';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowBack as BackIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  MoreHoriz as MoreIcon,
  Edit as EditPencilIcon,
} from '@mui/icons-material';
import {
  Page,
  ReviewShell,
  ReviewHead,
  BackButton,
  ReviewProgress,
  HeaderActions,
  Btn,
  Kbd,
  ReviewBody,
  ReviewQueue,
  QueueHeadR,
  QueueItemR,
  MatchBadge,
  ReviewDetail,
  ReviewDetailHead,
  ReviewHero,
  SkillToken,
  ReviewTabs,
  RTab,
  ReviewContent,
  ReviewPanel,
  ReviewSectionTitle,
  DiffLine,
  WhyBox,
  ReviewFooter,
  MoreMenu,
  TimelineCard,
  TimelineList,
  TimelineItem,
  PreparingBanner,
  FocusHeader,
} from './styled';
import CompanyAvatar from './CompanyAvatar';
import { MOCK_DIFF } from './constants';
import {
  useReviewQueue,
  useApplicationDetail,
  previewApplication,
  approveApplication,
  rejectApplication,
  reopenApplication,
  deleteApplication,
  requestApplicationEdit,
  regenerateResume,
  regenerateCoverLetter,
  regenerateAnswer,
  patchAnswers,
  markApplied,
  patchTracking,
  downloadResumePdf,
  analyzeApplicationGaps,
} from '../../hooks/useApplyPilot';
import { useToast } from '../../contexts/ToastContext';
import { featureFlags } from '../../config/featureFlags';

const TABS = ['Tailored resume', 'Cover letter', 'Application Q&A', 'Job description', 'Match score', 'How to apply', 'Submission status'];
const SHORTCUT_TIP_KEY = 'applypilot_review_shortcut_tip_seen';

const STATUS_STYLES = {
  submitted:       { bg: '#E8FAF0', bd: '#BBEBD0', color: '#147A41', label: 'Submitted' },
  submitting:      { bg: '#EFF4FF', bd: '#C7D7F7', color: '#1D4ED8', label: 'Submitting…' },
  approved:        { bg: '#EFF4FF', bd: '#C7D7F7', color: '#1D4ED8', label: 'Approved, queued' },
  needs_attention: { bg: '#FFF0E0', bd: '#F4D9A1', color: '#8A3F00', label: 'Needs attention' },
  failed:          { bg: '#FFF0F0', bd: '#F4B5B5', color: '#C42B35', label: 'Failed' },
  prepared:        { bg: '#EFECFB', bd: '#D7CFF5', color: '#5948C9', label: 'Ready to apply' },
  pending:         { bg: '#EFECFB', bd: '#D7CFF5', color: '#5948C9', label: 'Pending' },
  rejected:        { bg: '#F4F2FB', bd: '#E4DFF5', color: '#6B6787', label: 'Rejected' },
};

// Hybrid manual-tracking pipeline (separate from the prep/auto-submit
// `status` enum). Surfaced as a secondary chip so candidates can see at
// a glance where each application stands after they apply.
const TRACKING_STYLES = {
  not_applied:         { bg: '#F4F2FB', bd: '#E4DFF5', color: '#6B6787', label: 'Not applied' },
  applied:             { bg: '#E8FAF0', bd: '#BBEBD0', color: '#147A41', label: 'Applied' },
  interviewing:        { bg: '#EFF4FF', bd: '#C7D7F7', color: '#1D4ED8', label: 'Interviewing' },
  offer:               { bg: '#FFF7E0', bd: '#F4DC91', color: '#8A6A00', label: 'Offer' },
  hired:               { bg: '#DCFCE7', bd: '#86EFAC', color: '#15803D', label: 'Hired' },
  rejected_by_company: { bg: '#FFF0F0', bd: '#F4B5B5', color: '#C42B35', label: 'Rejected' },
  withdrawn:           { bg: '#F4F2FB', bd: '#E4DFF5', color: '#6B6787', label: 'Withdrawn' },
};

const TRACKING_OPTIONS = [
  { value: 'not_applied',         label: 'Not applied' },
  { value: 'applied',             label: 'Applied' },
  { value: 'interviewing',        label: 'Interviewing' },
  { value: 'offer',               label: 'Offer' },
  { value: 'hired',               label: 'Hired' },
  { value: 'rejected_by_company', label: 'Rejected by company' },
  { value: 'withdrawn',           label: 'Withdrawn' },
];

const StatusChip = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.bd}`,
    }}>
      {s.label}
    </span>
  );
};

const TrackingChip = ({ status }) => {
  if (!status || status === 'not_applied') return null;
  const s = TRACKING_STYLES[status] || TRACKING_STYLES.not_applied;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.bd}`,
    }}>
      {s.label}
    </span>
  );
};

// Per-field card on the Application form tab. Owns local edit state so
// the candidate can tweak the AI-drafted answer inline (then Save → bulk
// PATCH) or ask the model to redraft just this one. We treat
// `[email not provided]`-style placeholders the backend emits as
// "missing" so the UI nudges the candidate to fill them rather than
// pasting the placeholder verbatim into a real form.
const PLACEHOLDER_RE = /^\s*\[([\w\s]+) not provided\]\s*$/i;

/* ─────────────────────────────────────────────────────────────────
   ATS source-param helper
   When the candidate clicks "Apply" we redirect to the employer's
   ATS page. Most ATSes accept a "source" query param that tags the
   application as coming from us, useful for partnership reporting
   and (eventually) for ATSes that round-trip the param back into
   webhooks. Detection is host-based, append rules are per-vendor.
   ───────────────────────────────────────────────────────────────── */
const ATS_SOURCE_TAG = 'profileai';
function appendAtsSourceParam(rawUrl) {
  if (!rawUrl) return rawUrl;
  let u;
  try { u = new URL(rawUrl); } catch { return rawUrl; }
  const host = u.hostname.toLowerCase();
  // Map host pattern → query param name. Each vendor uses a different
  // key, so we set the right one and leave existing params alone.
  const rules = [
    { match: /greenhouse\.io|grnh\.se/, key: 'gh_src' },
    { match: /lever\.co/,                key: 'lever-source' },
    { match: /workday|myworkdayjobs/,    key: 'source' },
    { match: /ashbyhq\.com/,             key: 'utm_source' },
    { match: /workable\.com/,            key: 'utm_source' },
    { match: /smartrecruiters\.com/,     key: 'trid' },
    { match: /icims\.com/,               key: 'iis' },
    { match: /jobvite\.com/,             key: 'sourceType' },
    { match: /bamboohr\.com/,            key: 'source' },
    { match: /breezy\.hr/,               key: 'source' },
  ];
  const rule = rules.find((r) => r.match.test(host));
  // Always set utm_source as a fallback. Won't hurt sites that ignore it.
  if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', ATS_SOURCE_TAG);
  if (rule && !u.searchParams.has(rule.key)) u.searchParams.set(rule.key, ATS_SOURCE_TAG);
  return u.toString();
}

/* ─────────────────────────────────────────────────────────────────
   Job-description renderer
   Scrapers usually concatenate everything into one giant blob with
   no line breaks ("…About the role …Key Responsibilities Own the
   technical strategy… Required field of study Bachelor's degree…").
   parseJDBlocks() walks the text, hunts for known section headers
   (case-insensitive), and emits an ordered list of
   { type: 'heading' | 'paragraph' | 'bullet', text }
   so we can render real H4s, paragraphs, and a bulleted list of
   responsibilities/qualifications without changing the source data.
   ───────────────────────────────────────────────────────────────── */

// Headings we want to promote whenever they show up mid-blob. Order
// matters, longer phrases first so "Preferred Qualifications" wins
// over "Qualifications". Each entry is the canonical heading we
// display; the regex matches with optional trailing ":".
const JD_HEADINGS = [
  'About the role', 'About the team', 'About Anthropic', 'About us',
  'About the company', 'About', 'Overview',
  'Key Responsibilities', 'Responsibilities', 'What you will do',
  "What you'll do", 'Your role',
  'Required Qualifications', 'Minimum Qualifications', 'Minimum qualifications',
  'Preferred Qualifications', 'Nice to have', 'Bonus points',
  'Qualifications', 'Requirements', 'Skills',
  'Benefits', 'Perks', 'Compensation', 'Annual Salary',
  'Location-based hybrid policy', 'Location', 'Logistics',
  'Education', 'Experience',
];

function parseJDBlocks(raw) {
  if (!raw || typeof raw !== 'string') return [];
  // First normalize: collapse repeated whitespace, but keep newlines
  // if the scraper preserved them.
  let text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  // Build a regex that captures any heading on a word boundary,
  // optionally preceded by punctuation/space.
  const escaped = JD_HEADINGS.map((h) => h.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const headingRe = new RegExp(
    `(?:^|[\\.\\!\\?\\n]\\s*)(${escaped.join('|')})\\s*[:\\.\\-]?\\s+`,
    'gi',
  );

  // Split the blob into segments around heading matches.
  const segments = [];
  let lastIndex = 0;
  let lastHeading = null;
  let m;
  while ((m = headingRe.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index).trim();
    if (before) segments.push({ heading: lastHeading, body: before });
    lastHeading = m[1];
    lastIndex = m.index + m[0].length;
  }
  const tail = text.slice(lastIndex).trim();
  if (tail) segments.push({ heading: lastHeading, body: tail });

  // Now turn each segment's body into paragraph/bullet blocks.
  const blocks = [];
  for (const seg of segments) {
    if (seg.heading) blocks.push({ type: 'heading', text: seg.heading });
    const body = seg.body;
    // Heuristic bullet split: sentences in a Responsibilities or
    // Qualifications section read like a list, so split on sentence
    // boundaries when the section is bullet-ish; otherwise keep as
    // paragraphs separated by 2+ newlines.
    const isBulletSection = /respons|qualif|require|skill|benefit|perks|nice to have|bonus/i
      .test(seg.heading || '');
    if (isBulletSection) {
      const parts = body
        .split(/(?<=[.!?])\s+(?=[A-Z(])/) // sentence boundary heuristic
        .map((s) => s.trim())
        .filter(Boolean);
      // Keep short list items; merge tiny fragments back into the
      // previous one so we don't split mid-phrase.
      const merged = [];
      for (const p of parts) {
        if (merged.length && p.length < 40) {
          merged[merged.length - 1] += ' ' + p;
        } else {
          merged.push(p);
        }
      }
      merged.forEach((b) => blocks.push({ type: 'bullet', text: b }));
    } else {
      const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      paras.forEach((p) => blocks.push({ type: 'paragraph', text: p }));
    }
  }
  return blocks;
}

const JDBlocks = ({ raw }) => {
  const blocks = useMemo(() => parseJDBlocks(raw), [raw]);
  if (!blocks.length) {
    // Fall back to the raw text so we never lose content.
    return (
      <div style={{
        fontSize: 14, lineHeight: 1.65, color: '#2D2A3E',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{raw}</div>
    );
  }
  // Group consecutive bullets so they share one <ul>.
  const out = [];
  let pendingBullets = null;
  const flushBullets = () => {
    if (pendingBullets) {
      out.push(
        <ul key={`ul-${out.length}`} style={{
          margin: '4px 0 14px',
          paddingLeft: 22,
          fontSize: 14,
          lineHeight: 1.65,
          color: '#2D2A3E',
        }}>
          {pendingBullets.map((b, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{b}</li>
          ))}
        </ul>
      );
      pendingBullets = null;
    }
  };
  blocks.forEach((b, i) => {
    if (b.type === 'bullet') {
      pendingBullets = pendingBullets || [];
      pendingBullets.push(b.text);
      return;
    }
    flushBullets();
    if (b.type === 'heading') {
      out.push(
        <h4 key={`h-${i}`} style={{
          margin: '18px 0 6px',
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: '#5B57A6',
        }}>{b.text}</h4>
      );
    } else {
      out.push(
        <p key={`p-${i}`} style={{
          margin: '0 0 12px',
          fontSize: 14,
          lineHeight: 1.65,
          color: '#2D2A3E',
        }}>{b.text}</p>
      );
    }
  });
  flushBullets();
  return <>{out}</>;
};

const FormAnswerCard = ({ fa, index, disabled, onSave, onRegenerate }) => {
  const fieldKey = fa.fieldId || fa.label || fa.question || `field-${index}`;
  const initial = fa.answer || fa.value || '';
  const isPlaceholder = PLACEHOLDER_RE.test(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setDraft(initial); setEditing(false); }, [initial]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(initial);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }, [initial]);

  const save = async () => {
    if (draft === initial) { setEditing(false); return; }
    await onSave(fieldKey, draft);
    setEditing(false);
  };

  return (
    <div style={{
      background: isPlaceholder ? '#FFF8EE' : '#F8F7FC',
      border: `1px solid ${isPlaceholder ? '#F4DC91' : '#E4DFF5'}`,
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2D2A3E', flex: 1 }}>
          {fa.label || fa.question || `Field ${index + 1}`}
          {fa.required && <span style={{ color: '#C42B35', marginLeft: 4 }}>*</span>}
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!initial || isPlaceholder}
          title="Copy answer"
          style={{
            fontSize: 11, fontWeight: 700, color: '#5948C9',
            background: 'transparent', border: '1px solid #D7CFF5',
            borderRadius: 6, padding: '3px 8px',
            cursor: !initial || isPlaceholder ? 'not-allowed' : 'pointer',
            opacity: !initial || isPlaceholder ? 0.5 : 1,
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => onRegenerate(fa)}
          disabled={disabled}
          title="Ask AI to redraft this answer"
          style={{
            fontSize: 11, fontWeight: 700, color: '#5948C9',
            background: 'transparent', border: '1px solid #D7CFF5',
            borderRadius: 6, padding: '3px 8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Regenerate
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit inline"
            style={{
              fontSize: 11, fontWeight: 700, color: '#2D2A3E',
              background: 'transparent', border: '1px solid #E4DFF5',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, Math.max(2, draft.split('\n').length + 1))}
            style={{
              width: '100%', resize: 'vertical',
              fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.6,
              color: '#2D2A3E', padding: '8px 10px',
              border: '1px solid #D7CFF5', borderRadius: 8, background: '#FFF',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setDraft(initial); setEditing(false); }}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 6,
                border: '1px solid #E4DFF5', background: '#FFF', color: '#6B6787', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={disabled}
              style={{
                fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 6,
                border: '1px solid #5948C9', background: '#6C5CE7', color: '#FFF', cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : isPlaceholder ? (
        <div style={{ fontSize: 13, color: '#8A6A00', fontStyle: 'italic' }}>
          ⚠ Missing from your profile, click <strong>Edit</strong> to add it, or update your{' '}
          <a href="/profile" style={{ color: '#5948C9', textDecoration: 'underline' }}>profile</a>.
        </div>
      ) : initial ? (
        <div style={{ fontSize: 13.5, color: '#2D2A3E', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {initial}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#9C99B5', fontStyle: 'italic' }}>
          (blank, click Edit to fill in)
        </div>
      )}
    </div>
  );
};

// Hybrid filter buckets. The underlying status enum still includes
// `approved`/`submitting` for legacy auto-submit rows, but in the
// candidate-driven flow the buckets that matter are:
//   • Ready to apply  → status === 'pending' (preparing or prepared)
//   • Applied         → status === 'submitted' (user clicked “I applied”)
//   • Needs attention → status === 'needs_attention' (form scan flagged it)
//   • Archived        → status === 'rejected' (user dismissed)
const FILTER_OPTIONS = [
  { key: null,              label: 'All',             tone: 'muted' },
  { key: 'pending',         label: 'Ready to apply',  tone: 'brand' },
  { key: 'submitted',       label: 'Applied',         tone: 'good'  },
  { key: 'needs_attention', label: 'Needs attention', tone: 'warn'  },
  { key: 'rejected',        label: 'Archived',        tone: 'muted' },
];

const FILTER_TONE = {
  brand: { fg: '#5948C9', line: '#6C5CE7', pillBg: '#6C5CE7', pillFg: '#FFFFFF' },
  warn:  { fg: '#8A3F00', line: '#D97706', pillBg: '#D97706', pillFg: '#FFFFFF' },
  blue:  { fg: '#1D4ED8', line: '#2563EB', pillBg: '#2563EB', pillFg: '#FFFFFF' },
  good:  { fg: '#147A41', line: '#22C55E', pillBg: '#22C55E', pillFg: '#FFFFFF' },
  muted: { fg: '#2D2A3E', line: '#6B6787', pillBg: '#E4DFF5', pillFg: '#2D2A3E' },
};

/* ─────────────────────────────────────────────────────────────
   Tailored resume preview, renders the actual rewritten CV from
   the `rich` payload produced by `resumeParserService.tailorProfileForJob`
   (the SAME backend service the Jobs/Profile pages use; ApplyPilot
   stores the result on the application row and renders it here).
   Falls back to a minimal render from the legacy diff if `rich` is
   missing.
   ───────────────────────────────────────────────────────────── */

const ResumeShell = styled.div`
  position: relative;
  background: #fff;
  border: 1px solid #E4DFF5;
  border-radius: 14px;
  padding: 32px 36px 36px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  font-size: 13.5px;
  color: #2D2A3E;
  line-height: 1.6;
  box-shadow: 0 1px 2px rgba(23,21,42,0.04), 0 8px 24px -12px rgba(108,92,231,0.10);
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    border-radius: 14px 0 0 14px;
    background: linear-gradient(180deg, #6C5CE7 0%, #A89BF5 100%);
  }

  @media (max-width: 768px) {
    padding: 22px 20px 26px 24px;
    gap: 18px;
    font-size: 13px;
  }
`;
const ResumeHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  border-bottom: 2px solid #EFECFB;
`;
const ResumeName = styled.div`
  font-size: 24px;
  font-weight: 800;
  color: #17152A;
  letter-spacing: -0.4px;
  line-height: 1.2;
`;
const ResumeTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #6C5CE7;
  letter-spacing: 0.1px;
`;
const ResumeContact = styled.div`
  font-size: 12px;
  color: #6B6787;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 6px;
  & > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  & > span + span::before {
    content: '·';
    color: #C9C2E8;
    margin-right: 8px;
  }
`;
const ResumeSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const ResumeSectionTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #6C5CE7;
  border-bottom: 1px solid #E4DFF5;
  padding-bottom: 4px;
`;
const ResumeItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const ResumeItemHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
`;
const ResumeItemTitle = styled.div`
  font-weight: 700;
  color: #17152A;
  font-size: 14px;
`;
const ResumeItemCompany = styled.span`
  font-weight: 600;
  color: #6C5CE7;
  margin-left: 6px;
`;
const ResumeItemSub = styled.div`
  color: #6B6787;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
`;
const ResumeItemBody = styled.div`
  white-space: pre-wrap;
  color: #2D2A3E;
  font-size: 13px;
`;
const ResumeBullets = styled.ul`
  margin: 4px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  & > li { font-size: 13px; color: #2D2A3E; }
`;
const ResumeChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
const ResumeChip = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${(p) => (p.$priority ? '#6C5CE7' : '#EFECFB')};
  color: ${(p) => (p.$priority ? '#fff' : '#5948C9')};
  border: 1px solid ${(p) => (p.$priority ? '#6C5CE7' : '#D7CFF5')};
  font-weight: ${(p) => (p.$priority ? 700 : 500)};
`;
const ViewToggle = styled.div`
  display: inline-flex;
  background: #F4F2FB;
  border: 1px solid #E4DFF5;
  border-radius: 8px;
  padding: 2px;

  @media (max-width: 768px) {
    border-radius: 10px;
    padding: 3px;
  }
`;
const ViewToggleBtn = styled.button`
  border: 0;
  background: ${(p) => (p.$active ? '#fff' : 'transparent')};
  color: ${(p) => (p.$active ? '#17152A' : '#6B6787')};
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: ${(p) => (p.$active ? '0 1px 2px rgba(23,21,42,0.08)' : 'none')};
  transition: background 120ms, color 120ms;
  &:hover { color: #17152A; }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 8px;
  }
`;
const ResumeEmpty = styled.div`
  padding: 40px 24px;
  text-align: center;
  color: #6B6787;
  font-size: 13px;
  background: #F8F7FC;
  border: 1px dashed #E4DFF5;
  border-radius: 10px;
`;

// Empty / no-selection state for the right pane of the inbox. Dedicated
// container because reusing ReviewHero broke at narrow viewports — the
// mobile breakpoint puts content into a 40px logo column and the empty
// state copy was wrapping word-by-word.
const EmptyDetailState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 32px;
  flex: 1;
  min-height: 0;

  h2 {
    margin: 0 0 8px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #100C28;
    max-width: 520px;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: #6B6787;
    max-width: 520px;
  }

  @media (max-width: 1199px) {
    padding: 40px 20px;
    h2 { font-size: 19px; }
    p { font-size: 13.5px; }
  }
`;

function arrayifyBullets(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    return v.split(/\r?\n|•|·/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

const TailoredResumeRender = ({ rendered, rich, diff, company }) => {
  // Prefer the merged `renderedResume` from the backend (rich AI output
  // overlaid on the user's saved Profile). Fall back to `rich` / `diff`
  // for backward compat.
  const r = rendered || rich || {};
  const hasAny =
    rendered ||
    rich ||
    diff?.summary?.new ||
    (Array.isArray(diff?.experience) && diff.experience.length > 0);
  if (!hasAny) {
    return (
      <ResumeEmpty>
        The tailored resume isn’t ready yet. The agent is still preparing this application, usually under a minute.
      </ResumeEmpty>
    );
  }

  const name = r.name || '';
  const title = r.title || r.headline || '';
  const summary = r.summary || diff?.summary?.new || '';
  const skills = Array.isArray(r.skills) ? r.skills : [];
  const experience = Array.isArray(r.experience) ? r.experience : [];
  const education = Array.isArray(r.education) ? r.education : [];
  const projects = Array.isArray(r.projects) ? r.projects : [];
  const certifications = Array.isArray(r.certifications) ? r.certifications : [];
  const contactBits = [r.email, r.phone, r.location, r.linkedinUrl, r.portfolioUrl].filter(Boolean);

  return (
    <ResumeShell>
      {(name || title || contactBits.length > 0) && (
        <ResumeHeader>
          {name && <ResumeName>{name}</ResumeName>}
          {title && <ResumeTitle>{title}</ResumeTitle>}
          {contactBits.length > 0 && (
            <ResumeContact>
              {contactBits.map((c, i) => (<span key={i}>{c}</span>))}
            </ResumeContact>
          )}
        </ResumeHeader>
      )}

      {summary && (
        <ResumeSection>
          <ResumeSectionTitle>Professional Summary</ResumeSectionTitle>
          <ResumeItemBody dangerouslySetInnerHTML={{ __html: summary }} />
        </ResumeSection>
      )}

      {skills.length > 0 && (
        <ResumeSection>
          <ResumeSectionTitle>Skills · Prioritized for {company || 'this role'}</ResumeSectionTitle>
          <ResumeChips>
            {skills.map((s, i) => (
              <ResumeChip key={`${s}-${i}`} $priority={i < 5}>{s}</ResumeChip>
            ))}
          </ResumeChips>
        </ResumeSection>
      )}

      {experience.length > 0 && (
        <ResumeSection>
          <ResumeSectionTitle>Experience</ResumeSectionTitle>
          {experience.map((exp, i) => {
            const expTitle = exp.title || exp.role || '';
            const expCompany = exp.company || exp.employer || '';
            const expPeriod = exp.period || [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
            const bullets = arrayifyBullets(exp.bullets || exp.highlights || exp.achievements);
            const desc = stripHtml(exp.description || '');
            return (
              <ResumeItem key={i}>
                <ResumeItemHead>
                  <ResumeItemTitle>
                    {expTitle}
                    {expCompany && <ResumeItemCompany>· {expCompany}</ResumeItemCompany>}
                  </ResumeItemTitle>
                  {expPeriod && <ResumeItemSub>{expPeriod}</ResumeItemSub>}
                </ResumeItemHead>
                {desc && <ResumeItemBody>{desc}</ResumeItemBody>}
                {bullets.length > 0 && (
                  <ResumeBullets>
                    {bullets.map((b, j) => (<li key={j}>{stripHtml(b)}</li>))}
                  </ResumeBullets>
                )}
              </ResumeItem>
            );
          })}
        </ResumeSection>
      )}

      {projects.length > 0 && (
        <ResumeSection>
          <ResumeSectionTitle>Projects</ResumeSectionTitle>
          {projects.map((p, i) => (
            <ResumeItem key={i}>
              <ResumeItemHead>
                <ResumeItemTitle>{p.name || p.title || 'Project'}</ResumeItemTitle>
                {(p.period || p.year) && <ResumeItemSub>{p.period || p.year}</ResumeItemSub>}
              </ResumeItemHead>
              {p.description && <ResumeItemBody>{stripHtml(p.description)}</ResumeItemBody>}
            </ResumeItem>
          ))}
        </ResumeSection>
      )}

      {education.length > 0 && (
        <ResumeSection>
          <ResumeSectionTitle>Education</ResumeSectionTitle>
          {education.map((ed, i) => (
            <ResumeItem key={i}>
              <ResumeItemHead>
                <ResumeItemTitle>
                  {[ed.degree, ed.field].filter(Boolean).join(', ') || ed.title || 'Education'}
                </ResumeItemTitle>
                {(ed.period || ed.year) && <ResumeItemSub>{ed.period || ed.year}</ResumeItemSub>}
              </ResumeItemHead>
              {(ed.school || ed.institution) && (
                <ResumeItemSub>{ed.school || ed.institution}</ResumeItemSub>
              )}
            </ResumeItem>
          ))}
        </ResumeSection>
      )}

      {certifications.length > 0 && (
        <ResumeSection>
          <ResumeSectionTitle>Certifications</ResumeSectionTitle>
          <ResumeChips>
            {certifications.map((c, i) => (
              <ResumeChip key={i}>{typeof c === 'string' ? c : (c.name || c.title)}</ResumeChip>
            ))}
          </ResumeChips>
        </ResumeSection>
      )}
    </ResumeShell>
  );
};

const ReviewPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: authUser } = useAuth();
  const { appId } = useParams();
  const { queue, isOffline, refetch, statusFilter, setStatusFilter } = useReviewQueue();

  // Determine selected app: if :appId provided use it, otherwise default to
  // the first "pending" item in the queue so the page is never empty.
  const initialId =
    appId ||
    queue?.find(a => a.status === 'pending')?.id ||
    queue?.[0]?.id ||
    null;

  const [selectedId, setSelectedId] = useState(initialId);
  const [activeTab, setActiveTab] = useState(0);
  // 'resume' = render the tailored CV directly (default, what most users
  // want). 'diff' = old red/green compare view for power-users.
  const [resumeView, setResumeView] = useState('resume');
  const [statuses, setStatuses] = useState({});
  const [actionInFlight, setActionInFlight] = useState(false);
  const [previewState, setPreviewState] = useState({
    loading: false,
    error: '',
    errorCode: '',
    unsupported: false,
    screenshots: [],
    blockers: [],
    resolutions: [],
  });
  const [showShortcutTip, setShowShortcutTip] = useState(false);

  // Fetch full detail for the selected application (diff, cover letter,
  // form answers, submission telemetry).
  const appDetailResult = useApplicationDetail(selectedId);
  // Only treat the fetched detail as belonging to the current selection, the
  // hook briefly returns the previous response while a new fetch is in flight,
  // and we don't want the Submission tab to show another application's
  // provider / attempt count. (See useFetch reset effect for the primary fix.)
  const appDetail = appDetailResult?.data && appDetailResult.data.id === selectedId
    ? appDetailResult.data
    : null;
  const refetchAppDetail = appDetailResult?.refetch;

  // Keep selection in sync once the queue loads / changes.
  React.useEffect(() => {
    if (!queue?.length) return;
    setStatuses(prev => {
      const next = { ...prev };
      for (const a of queue) {
        if (next[a.id] === undefined) next[a.id] = a.status ?? 'pending';
      }
      return next;
    });
    if (!selectedId) {
      const pick = queue.find(a => a.status === 'pending') || queue[0];
      if (pick) setSelectedId(pick.id);
    }
  }, [queue, selectedId]);

  const selected = useMemo(
    () => {
      if (!queue?.length) return null;
      // Filter queue based on status filter
      const filtered = statusFilter
        ? queue.filter(a => {
            const s = statuses[a.id] ?? a.status ?? 'pending';
            return s === statusFilter;
          })
        : queue;
      return filtered.find(a => a.id === selectedId) || filtered[0] || null;
    },
    [queue, selectedId, statusFilter, statuses]
  );

  const reviewedCount = Object.values(statuses).filter(
    s => s === 'approved' || s === 'rejected'
  ).length;
  const approvedCount = Object.values(statuses).filter(s => s === 'approved').length;
  const rejectedCount = Object.values(statuses).filter(s => s === 'rejected').length;
  const total = queue?.length || 0;
  const remainingCount = Math.max(0, total - reviewedCount);
  // Hybrid counters: each row carries an effective queue-status (from
  // local `statuses` overrides or the server) plus a tracking-status
  // for the manual pipeline. We surface applied/ready/preparing so the
  // header reflects what the candidate still needs to do.
  const effectiveStatusFor = (a) => statuses[a.id] ?? a.status ?? 'pending';
  const appliedCount = (queue || []).filter(
    (a) => effectiveStatusFor(a) === 'submitted' || a.trackingStatus === 'applied' || a.manuallyAppliedAt
  ).length;
  const readyToApplyCount = (queue || []).filter((a) => {
    const st = effectiveStatusFor(a);
    return st === 'pending' && a.dbStatus === 'prepared';
  }).length;
  const preparingCount = (queue || []).filter((a) => {
    const st = effectiveStatusFor(a);
    return st === 'pending' && (a.dbStatus === 'preparing' || a.dbStatus === 'pending' || !a.dbStatus);
  }).length;
  const progressPct = total ? Math.round((appliedCount / total) * 100) : 0;

  const setStatus = async (id, status) => {
    if (!id || actionInFlight) return;
    const app = (queue || []).find((a) => a.id === id);
    
    // Prevent approval while preparation is still in progress
    // Check the current application detail (not the stale queue item)
    if (status === 'approved' && (appDetail?.dbStatus === 'preparing' || appDetail?.dbStatus === 'pending')) {
      toast?.error?.('This application is still preparing. Please wait until preparation completes.');
      return;
    }
    // Fallback to queue data if detail not loaded yet
    if (status === 'approved' && !appDetail && (app?.dbStatus === 'preparing' || app?.dbStatus === 'pending')) {
      toast?.error?.('This application is still preparing. Please wait until preparation completes.');
      return;
    }

    setActionInFlight(true);
    try {
      let res = null;
      if (status === 'approved') res = await approveApplication(id);
      else if (status === 'rejected') await rejectApplication(id);

      setStatuses(prev => ({ ...prev, [id]: status }));

      // Tell the user what just happened. In hybrid mode (autoSubmit
      // off, the production default) the row is marked approved but
      // ApplyPilot will NOT auto-submit — the candidate clicks through
      // to the ATS apply URL and submits manually, then marks the row
      // as applied. In auto mode the submit worker takes over.
      if (status === 'approved') {
        const autoSubmit = res?.data?.autoSubmit ?? res?.autoSubmit;
        if (autoSubmit) {
          toast?.success?.('Approved — queued for auto-submit.');
        } else {
          toast?.success?.('Approved. Click “Apply on company site” to submit when ready.');
        }
      }

      // Advance only after a confirmed success.
      const nextPending = (queue || []).find(
        (a) => a.id !== id && (statuses[a.id] ?? a.status ?? 'pending') === 'pending',
      );
      if (nextPending) {
        setSelectedId(nextPending.id);
        navigate(`/applypilot/inbox/${nextPending.id}`, { replace: true });
      }
      if (status === 'rejected') {
        showUndoRejectToast(id);
      }
      // Refresh both queue and detail so UI reflects latest state
      await refetch();
      if (id === selectedId && refetchAppDetail) {
        await refetchAppDetail();
      }
    } catch (e) {
      const code = e?.response?.status;
      const serverMessage = e?.response?.data?.error || e?.response?.data?.message;
      const fallback = status === 'approved' ? 'Approve failed. Please try again.' : 'Reject failed. Please try again.';
      // Map known error codes / server error strings to human copy so
      // the user never sees raw codes like 'autosubmit_disabled' or 410.
      let message = fallback;
      if (code === 409) {
        message = serverMessage === 'already_submitted'
          ? 'This application was already submitted.'
          : serverMessage === 'wrong_status'
            ? 'This application isn’t ready to approve yet.'
            : (serverMessage || 'Application is not ready to approve yet.');
      } else if (code === 410 || serverMessage === 'autosubmit_disabled') {
        // Legacy server (pre-hybrid-fix). Just tell the user it worked
        // even though the backend refused — we can’t fully recover
        // here, but spelling out the server error helps support triage.
        message = 'Auto-submit is disabled on the server. Please apply manually via the company site.';
      } else if (code === 503) {
        message = 'Submit queue is temporarily unavailable. Try again in a minute.';
      } else if (serverMessage) {
        message = serverMessage;
      }
      toast?.error?.(message);
      console.warn('[ApplyPilot] review action failed:', e?.message || e);
    } finally {
      setActionInFlight(false);
    }
  };

  const [editModalOpen, setEditModalOpen] = useState(false);
  // Tailor settings modal, same component used on the Jobs page so
  // the candidate gets a consistent UX (tone, lengths, focus areas)
  // when re-tailoring a resume from ApplyPilot.
  const [tailorModalOpen, setTailorModalOpen] = useState(false);
  // Progress + preview modals reuse the Jobs-page tailoring flow so
  // the regen experience inside ApplyPilot matches what users already
  // know: settings → progress (with steps) → preview (download/save).
  const [tailoringProgressOpen, setTailoringProgressOpen] = useState(false);
  const [tailoringComplete, setTailoringComplete] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  // Which tab the ResumePreviewModal lands on when it opens
  //, 'preview' for Download, 'edit' for the Edit CTA on the
  // Tailored resume tab.
  const [resumePreviewMode, setResumePreviewMode] = useState('preview');
  // Gap review wizard, same component the Jobs page uses. Sits
  // between the settings modal and the progress modal so the candidate
  // can accept or skip detected skill gaps before re-tailoring.
  const [gapDialogOpen, setGapDialogOpen] = useState(false);
  const [gapDialogLoading, setGapDialogLoading] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState([]);
  const [satisfiedAlternatives, setSatisfiedAlternatives] = useState([]);
  // We hold the user's tailorSettings between the settings modal and
  // the gap dialog so we can pass them through to regenerate when the
  // user finishes the gap review.
  const [pendingTailorSettings, setPendingTailorSettings] = useState(null);
  const [editDefaultSection, setEditDefaultSection] = useState('summary');
  // Cover letter settings modal, reuses the Jobs page CoverLetterModal
  // so candidates get the same tone + length controls when re-drafting
  // from ApplyPilot.
  const [coverLetterModalOpen, setCoverLetterModalOpen] = useState(false);

  const openEditModal = useCallback((section = 'summary') => {
    if (!selected?.id) return;
    // Sections align with ReviewPage tabs:
    //   0 Tailored resume  → summary/experience
    //   1 Cover letter     → cover
    //   2 Application form → answers
    setEditDefaultSection(section);
    setEditModalOpen(true);
  }, [selected?.id]);

  const submitEdit = useCallback(async ({ section, instruction }) => {
    if (!selected?.id) return;
    await requestApplicationEdit(selected.id, section, instruction);
    // Refresh queue so any status change (e.g. back to "preparing") shows up.
    refetch();
  }, [selected?.id, refetch]);

  useEffect(() => {
    setPreviewState({
      loading: false,
      error: '',
      errorCode: '',
      unsupported: false,
      screenshots: [],
      blockers: [],
      resolutions: [],
    });
  }, [selectedId]);

  useEffect(() => {
    try {
      setShowShortcutTip(localStorage.getItem(SHORTCUT_TIP_KEY) !== '1');
    } catch {
      setShowShortcutTip(true);
    }
  }, []);

  const dismissShortcutTip = useCallback(() => {
    setShowShortcutTip(false);
    try {
      localStorage.setItem(SHORTCUT_TIP_KEY, '1');
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (!showShortcutTip) return undefined;
    const onInteraction = () => dismissShortcutTip();
    window.addEventListener('keydown', onInteraction, { once: true });
    window.addEventListener('click', onInteraction, { once: true });
    return () => {
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('click', onInteraction);
    };
  }, [dismissShortcutTip, showShortcutTip]);

  const handlePreview = useCallback(async () => {
    if (!selected?.id || previewState.loading) return;
    setPreviewState({
      loading: true,
      error: '',
      errorCode: '',
      unsupported: false,
      screenshots: [],
      blockers: [],
      resolutions: [],
    });
    try {
      const res = await previewApplication(selected.id);
      const preview = res?.data?.preview || {};
      const previewError = preview.error || '';
      const isUnsupported = !!preview.unsupported
        || preview.errorCode === 'unsupported_ats'
        || /No preview adapter available/i.test(previewError);
      setPreviewState({
        loading: false,
        error: isUnsupported
          ? 'Preview screenshots are not available for this ATS yet. You can still approve and submit.'
          : previewError,
        errorCode: isUnsupported ? 'unsupported_ats' : (preview.errorCode || ''),
        unsupported: isUnsupported,
        screenshots: Array.isArray(preview.screenshots) ? preview.screenshots : [],
        blockers: Array.isArray(preview.blockers) ? preview.blockers : [],
        resolutions: Array.isArray(preview.resolutions) ? preview.resolutions : [],
      });
      setActiveTab(6);
    } catch (e) {
      const code = e?.response?.data?.error || '';
      const rawError = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Preview failed';
      const unsupported = code === 'unsupported_ats' || /No preview adapter available/i.test(rawError);
      setPreviewState({
        loading: false,
        error: unsupported
          ? 'Preview screenshots are not available for this ATS yet. You can still approve and submit.'
          : rawError,
        errorCode: unsupported ? 'unsupported_ats' : code,
        unsupported,
        screenshots: [],
        blockers: [],
        resolutions: [],
      });
    }
  }, [selected?.id, previewState.loading]);

  const handleSelect = id => {
    setSelectedId(id);
    navigate(`/applypilot/inbox/${id}`, { replace: true });
  };

  const selectedDbStatus = selected?.dbStatus || '';
  const isSelectedPreparing = selectedDbStatus === 'preparing' || selectedDbStatus === 'pending';
  const pendingCount = (queue || []).filter(
    (a) => (statuses[a.id] ?? a.status ?? 'pending') === 'pending',
  ).length;
  const actionablePendingCount = (queue || []).filter(
    (a) => (statuses[a.id] ?? a.status ?? 'pending') === 'pending' && a.dbStatus !== 'preparing' && a.dbStatus !== 'pending',
  ).length;

  const tabReadiness = useMemo(() => {
    // Check if resume diff has actual content (not just empty arrays/strings)
    const hasDiffContent = appDetail?.diff && (
      (appDetail.diff.summary?.old && appDetail.diff.summary.old.trim()) ||
      (appDetail.diff.summary?.new && appDetail.diff.summary.new.trim()) ||
      (Array.isArray(appDetail.diff.experience) && appDetail.diff.experience.length > 0) ||
      (Array.isArray(appDetail.diff.added) && appDetail.diff.added.length > 0) ||
      (Array.isArray(appDetail.diff.newSkills) && appDetail.diff.newSkills.length > 0)
    );
    
    const coverText = typeof appDetail?.coverLetter === 'string' ? appDetail.coverLetter.trim() : '';
    const answers = Array.isArray(appDetail?.formAnswers) ? appDetail.formAnswers : [];
    const hasFormAnswers = answers.some((fa) => {
      const value = fa?.answer ?? fa?.value;
      if (value === 0) return true;
      if (typeof value === 'string') return value.trim().length > 0;
      return Boolean(value);
    });

    return [
      hasDiffContent || Boolean(selected?.prepared?.resume),
      coverText.length > 0,
      hasFormAnswers,
    ];
  }, [appDetail, selected?.prepared?.resume]);

  // Approve every pending application in one shot. Each call fires the
  // normal approval pipeline so the submit-worker picks them up in the
  // background. We don't block on each, we fan out, then refetch.
  const [bulkApproving, setBulkApproving] = useState(false);
  const [undoReject, setUndoReject] = useState({ open: false, appId: null });
  const undoTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const showUndoRejectToast = useCallback((id) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoReject({ open: true, appId: id });
    undoTimerRef.current = setTimeout(() => {
      setUndoReject({ open: false, appId: null });
      undoTimerRef.current = null;
    }, 5000);
  }, []);

  const handleUndoReject = useCallback(async () => {
    if (!undoReject.appId) return;
    const appIdToRestore = undoReject.appId;
    try {
      await reopenApplication(appIdToRestore);
      setStatuses(prev => ({ ...prev, [appIdToRestore]: 'pending' }));
      setSelectedId(appIdToRestore);
      setMobileShowDetail(true);
      navigate(`/applypilot/inbox/${appIdToRestore}`, { replace: true });
      await refetch();
    } catch (e) {
      console.warn('[ApplyPilot] undo reject failed:', e?.message);
      // Restore the rejected status if undo failed
      setStatuses(prev => ({ ...prev, [appIdToRestore]: 'rejected' }));
    } finally {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      setUndoReject({ open: false, appId: null });
    }
  }, [navigate, refetch, undoReject.appId]);

  const handleReopen = useCallback(async () => {
    if (!selected?.id) return;
    try {
      await reopenApplication(selected.id);
      setStatuses(prev => ({ ...prev, [selected.id]: 'pending' }));
      await refetch();
    } catch (e) {
      console.warn('[ApplyPilot] reopen failed:', e?.message);
      toast?.error?.('Failed to reopen application');
    }
  }, [selected?.id, refetch, toast]);

  // ---- Hybrid manual-submit handlers --------------------------------
  // ApplyPilot prepares the materials; the candidate opens the
  // employer's apply page and submits there. These handlers cover:
  //   - Open application URL in a new tab
  //   - Mark as applied (records timestamp + flips trackingStatus)
  //   - Regenerate resume / cover letter on demand
  //   - Update tracking status (interviewing, offer, …)

  const handleOpenApplication = useCallback(() => {
    const url = appDetail?.applicationUrl || selected?.applicationUrl || appDetail?.jobUrl || selected?.jobUrl;
    if (!url) {
      toast?.error?.('No application URL on file for this job.');
      return;
    }
    window.open(appendAtsSourceParam(url), '_blank', 'noopener,noreferrer');
  }, [appDetail, selected, toast]);

  const handleMarkApplied = useCallback(async () => {
    if (!selected?.id || actionInFlight) return;
    // Open the employer's ATS page first, in the SAME click so the
    // browser's popup-blocker treats it as a user gesture. We then
    // record the click as "applied" in our DB. The candidate still
    // submits the form on the employer's site themselves; this just
    // moves the row into our Sent + tracking pipeline.
    const url = appDetail?.applicationUrl || selected?.applicationUrl || appDetail?.jobUrl || selected?.jobUrl;
    if (url) {
      window.open(appendAtsSourceParam(url), '_blank', 'noopener,noreferrer');
    }
    setActionInFlight(true);
    try {
      await markApplied(selected.id);
      setStatuses(prev => ({ ...prev, [selected.id]: 'submitted' }));
      toast?.success?.(url ? 'Apply page opened, tracking started.' : 'Marked as applied. Good luck!');
      if (refetchAppDetail) await refetchAppDetail();
      await refetch();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not mark as applied.';
      toast?.error?.(msg);
    } finally {
      setActionInFlight(false);
    }
  }, [selected?.id, actionInFlight, appDetail, selected, refetch, refetchAppDetail, toast]);

  // Internal: actually fire the regenerate request once we have
  // settings AND (optionally) gap selections.
  const runRegenerateResume = useCallback(async (tailorSettings, gapSelections) => {
    if (!selected?.id || actionInFlight) return;
    setActionInFlight(true);
    setTailoringComplete(false);
    setTailoringProgressOpen(true);
    try {
      const payload = {};
      if (tailorSettings) payload.tailorSettings = tailorSettings;
      if (gapSelections) payload.gapSelections = gapSelections;
      await regenerateResume(selected.id, payload);
      if (refetchAppDetail) await refetchAppDetail();
      setTailoringComplete(true);
      // Brief pause so the user can see the "Done" state on the
      // progress modal before we transition to the preview.
      setTimeout(() => {
        setTailoringProgressOpen(false);
        setResumePreviewOpen(true);
      }, 600);
      toast?.success?.('Resume regenerated.');
    } catch (e) {
      setTailoringProgressOpen(false);
      toast?.error?.(e?.response?.data?.message || 'Failed to regenerate resume.');
    } finally {
      setActionInFlight(false);
    }
  }, [selected?.id, actionInFlight, refetchAppDetail, toast]);

  // Public entry point: settings modal Continue → analyze gaps → if
  // gaps exist, show GapReviewDialog (user picks accept/skip) →
  // regenerate. If no gaps, skip the dialog and go straight to
  // regenerate. Mirrors handleTailorSettingsContinue() in JobAIToolsPanel.
  const handleRegenerateResume = useCallback(async (tailorSettings) => {
    if (!selected?.id || actionInFlight) return;
    setPendingTailorSettings(tailorSettings || null);
    // Don't open the GapReviewDialog yet, it has no native loading
    // state for "analyzing" (loading=true just means "tailoring in
    // progress after Continue"). Show a toast + use actionInFlight to
    // disable the trigger while we analyze, then only open the dialog
    // if we have something to review.
    setActionInFlight(true);
    const analyzingToast = toast?.info?.('Analyzing skill gaps…');
    try {
      const result = await analyzeApplicationGaps(selected.id);
      const gaps = Array.isArray(result?.gaps) ? result.gaps : [];
      const sats = Array.isArray(result?.satisfiedAlternatives) ? result.satisfiedAlternatives : [];
      setActionInFlight(false);
      if (gaps.length > 0) {
        setDetectedGaps(gaps);
        setSatisfiedAlternatives(sats);
        setGapDialogLoading(false);
        setGapDialogOpen(true);
        return;
      }
      // No gaps detected, go straight to regen.
      toast?.success?.('No skill gaps, tailoring now.');
      await runRegenerateResume(tailorSettings, null);
    } catch (err) {
      // Gap analysis failed (rate-limited, transient, etc.), fall
      // back to the unattended path: regenerate without selections,
      // letting the backend service auto-accept critical gaps.
      setActionInFlight(false);
      console.warn('[ApplyPilot] gap analysis failed, regenerating without selections:', err?.message);
      await runRegenerateResume(tailorSettings, null);
    }
  }, [selected?.id, actionInFlight, runRegenerateResume, toast]);

  // GapReviewDialog Continue handler, receives the user's accept/skip
  // selections and fires the actual regen with them.
  const handleGapReviewContinue = useCallback(async (selections) => {
    setGapDialogOpen(false);
    const gapSelections = {
      acceptedGaps: selections.acceptedGaps || [],
      skippedGaps: selections.skippedGaps || [],
      acceptedGapObjects: selections.acceptedGapObjects || [],
    };
    await runRegenerateResume(pendingTailorSettings, gapSelections);
    setPendingTailorSettings(null);
  }, [pendingTailorSettings, runRegenerateResume]);

  // Download the tailored resume as a PDF. The backend route returns
  // either a redirect to a hosted URL or an inline PDF stream; either
  // way we treat the response as a blob and force a download.
  const handleDownloadResume = useCallback(async () => {
    if (!selected?.id) return;
    try {
      const res = await downloadResumePdf(selected.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeRole = (selected.role || 'resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const safeCo = (selected.company || 'job').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      a.href = url;
      a.download = `${safeRole}-${safeCo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      toast?.error?.('Failed to download resume PDF.');
    }
  }, [selected?.id, selected?.role, selected?.company, toast]);

  // Open the cover letter settings modal. The actual regen happens in
  // handleGenerateCoverLetterFromModal below, after the user picks tone
  // + length, same UX as the Jobs page CoverLetterModal.
  const handleRegenerateCoverLetter = useCallback(() => {
    if (!selected?.id || actionInFlight) return;
    setCoverLetterModalOpen(true);
  }, [selected?.id, actionInFlight]);

  // Called by CoverLetterModal once the user clicks Generate. Returns
  // the new cover letter string so the modal can preview it inline,
  // and refreshes the application detail so the page reflects the new
  // copy when the modal is closed.
  const handleGenerateCoverLetterFromModal = useCallback(async ({ tone, lines } = {}) => {
    if (!selected?.id) return '';
    setActionInFlight(true);
    try {
      const res = await regenerateCoverLetter(selected.id, { tone, lines });
      const newLetter = res?.data?.coverLetter || '';
      if (refetchAppDetail) await refetchAppDetail();
      toast?.success?.('Cover letter regenerated.');
      return newLetter;
    } catch (e) {
      toast?.error?.(e?.response?.data?.message || 'Failed to regenerate cover letter.');
      throw e;
    } finally {
      setActionInFlight(false);
    }
  }, [selected?.id, refetchAppDetail, toast]);

  const handleTrackingChange = useCallback(async (nextStatus) => {
    if (!selected?.id) return;
    try {
      await patchTracking(selected.id, { status: nextStatus });
      if (refetchAppDetail) await refetchAppDetail();
      await refetch();
    } catch (e) {
      toast?.error?.(e?.response?.data?.message || 'Failed to update tracking.');
    }
  }, [selected?.id, refetch, refetchAppDetail, toast]);

  // Per-field answer handlers. Save uses the bulk PATCH /answers route
  // (we resend the whole array with one entry replaced) because that's
  // the only mutation endpoint we expose for answers; regenerate calls
  // the dedicated /regenerate-answer endpoint which lets the AI redraft
  // a single field.
  const handleSaveAnswer = useCallback(async (fieldKey, newAnswer) => {
    if (!selected?.id) return;
    const current = Array.isArray(appDetail?.formAnswers) ? appDetail.formAnswers : [];
    const next = current.map((fa) => {
      const key = fa.fieldId || fa.label || fa.question;
      if (key === fieldKey) return { ...fa, answer: newAnswer, value: newAnswer };
      return fa;
    });
    try {
      await patchAnswers(selected.id, next);
      toast?.success?.('Answer saved.');
      if (refetchAppDetail) await refetchAppDetail();
    } catch (e) {
      toast?.error?.(e?.response?.data?.message || 'Failed to save answer.');
    }
  }, [selected?.id, appDetail?.formAnswers, refetchAppDetail, toast]);

  const handleRegenerateAnswerFor = useCallback(async (fa, guidance) => {
    if (!selected?.id || actionInFlight) return;
    setActionInFlight(true);
    try {
      await regenerateAnswer(selected.id, {
        question: fa.label || fa.question || '',
        fieldId: fa.fieldId,
        guidance: guidance || undefined,
      });
      toast?.success?.('Answer regenerated.');
      if (refetchAppDetail) await refetchAppDetail();
    } catch (e) {
      toast?.error?.(e?.response?.data?.message || 'Failed to regenerate answer.');
    } finally {
      setActionInFlight(false);
    }
  }, [selected?.id, actionInFlight, refetchAppDetail, toast]);

  // Hard-delete a row from the inbox (permanent). Confirms first so a
  // stray click on the small × in the queue list doesn't silently nuke
  // a job. Used primarily from the Rejected filter when the user has
  // already decided they don't want it back.
  const handleDelete = useCallback(async (appId) => {
    if (!appId) return;
    if (!window.confirm('Permanently remove this application from your inbox? This cannot be undone.')) {
      return;
    }
    try {
      await deleteApplication(appId);
      setStatuses(prev => {
        const next = { ...prev };
        delete next[appId];
        return next;
      });
      if (appId === selectedId) {
        setSelectedId(null);
        navigate('/applypilot/inbox', { replace: true });
      }
      await refetch();
      toast?.success?.('Application removed');
    } catch (e) {
      console.warn('[ApplyPilot] delete failed:', e?.message);
      toast?.error?.(e?.response?.data?.message || 'Failed to remove application');
    }
  }, [selectedId, navigate, refetch, toast]);

  const handleApproveAll = useCallback(async () => {
    const pending = (queue || []).filter(
      (a) => (statuses[a.id] ?? a.status ?? 'pending') === 'pending' && a.dbStatus !== 'preparing' && a.dbStatus !== 'pending',
    );
    if (pending.length === 0) return;
    if (!window.confirm(`Approve all ${pending.length} pending application${pending.length === 1 ? '' : 's'}? They'll be submitted in the background.`)) {
      return;
    }

    setBulkApproving(true);
    const results = await Promise.allSettled(pending.map((a) => approveApplication(a.id, {})));
    const succeeded = [];
    const failed = [];
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') succeeded.push(pending[idx].id);
      else failed.push(r);
    });

    if (succeeded.length > 0) {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const id of succeeded) next[id] = 'approved';
        return next;
      });
      toast?.success?.(`${succeeded.length} application${succeeded.length === 1 ? '' : 's'} queued.`);
    }
    if (failed.length > 0) {
      toast?.error?.(`${failed.length} application${failed.length === 1 ? '' : 's'} failed to approve.`);
      console.warn(`[ApplyPilot] approve-all: ${failed.length} failed`);
    }
    setBulkApproving(false);
    refetch();
  }, [queue, statuses, refetch, toast]);

  // Mobile list/detail swap: shows list until user picks an app
  const [mobileShowDetail, setMobileShowDetail] = useState(!!appId);

  // Mobile-only "Open full" focus mode, hides the page chrome (top
  // tabs, hero card, queue, panel toolbar) and shows a compact header
  // so the resume reads like a clean document. Toggled by tapping
  // "Open full ↗" on the resume tab.
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (focusMode) {
      document.body.classList.add('applypilot-focus');
      return () => document.body.classList.remove('applypilot-focus');
    }
    return undefined;
  }, [focusMode]);

  // Footer overflow menu (mobile): hosts View original / Skip session.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  /* ----------------------------------------------------------------
   * Keyboard shortcuts.
   *   R        → reject current
   *   A / ⏎    → approve current
   *   ⇧A       → approve all pending
   *   J        → select next in queue
   *   K        → select previous in queue
   *   E        → open request-edit modal
   *   ESC      → on mobile, go back to list
   *
   * All shortcuts bail out if the user is typing in an input / textarea
   * / contenteditable so we don't steal keystrokes from the modal or
   * filter buttons.
   * ----------------------------------------------------------------*/
  const isEditableTarget = (el) => {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  };

  useEffect(() => {
    const handler = (e) => {
      if (editModalOpen || actionInFlight) return; // modal or action owns keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (!queue?.length) return;

      const list = queue;
      const currentIdx = Math.max(0, list.findIndex((a) => a.id === selectedId));

      const move = (delta) => {
        const nextIdx = Math.min(list.length - 1, Math.max(0, currentIdx + delta));
        const nextId = list[nextIdx]?.id;
        if (nextId && nextId !== selectedId) handleSelect(nextId);
      };

      switch (e.key) {
        case 'r':
        case 'R':
          if (selected?.id) {
            e.preventDefault();
            setStatus(selected.id, 'rejected');
          }
          break;
        // 'a' / 'Enter' / 'Shift+A' previously approved + auto-submitted.
        // In hybrid mode the candidate submits manually on the employer's
        // site, so these shortcuts intentionally do nothing, see the
        // "Open application" / "I applied" buttons in the footer.
        case 'j':
        case 'J':
          e.preventDefault();
          move(1);
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          move(-1);
          break;
        case 'e':
        case 'E':
          if (selected?.id) {
            e.preventDefault();
            openEditModal(activeTab === 1 ? 'cover' : activeTab === 2 ? 'answers' : 'summary');
          }
          break;
        case 'Escape':
          if (focusMode) {
            setFocusMode(false);
          } else if (mobileShowDetail) {
            setMobileShowDetail(false);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editModalOpen, actionInFlight, queue, selectedId, selected?.id, mobileShowDetail, activeTab, handleApproveAll, openEditModal]);

  return (
    <Page>
      {isOffline && (
        <div style={{
          background: '#FFF0F0', border: '1px solid #F4B5B5', color: '#6B1F24',
          padding: '12px 16px', borderRadius: 12, margin: '0 0 16px',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <b style={{ color: '#C42B35' }}>Backend unreachable.</b>{' '}
          Start the backend (<code style={{ background: '#FFF', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>npm run dev</code> in <code style={{ background: '#FFF', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>/backend</code>)
          then refresh this page.
        </div>
      )}
      <ReviewShell>
        {showShortcutTip && (
          <div style={{
            margin: '0 0 10px',
            background: '#EFECFB',
            border: '1px solid #D7CFF5',
            color: '#2D2A3E',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span aria-hidden style={{ fontSize: 14 }}>⌨</span>
            <span>
              Press <b>R</b> to reject, <b>E</b> to request an edit, <b>J/K</b> to navigate.
            </span>
            <button
              type="button"
              onClick={dismissShortcutTip}
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'transparent',
                color: '#5948C9',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <ReviewHead>
          <BackButton
            onClick={() => {
              if (focusMode) {
                setFocusMode(false);
              } else if (mobileShowDetail) {
                setMobileShowDetail(false);
              } else {
                navigate('/applypilot/dashboard');
              }
            }}
            aria-label="Back"
          >
            <BackIcon style={{ fontSize: 18 }} />
          </BackButton>
          <h1>
            <span className="hd-desktop-text">ApplyPilot inbox</span>
            <span className="hd-mobile-text">ApplyPilot</span>
          </h1>
          {/* Hybrid progress bar, simplified to a single counter
              plus the bar. Filter chips below already show
              ready/applied/needs-attention counts so we don't repeat
              them in the header. */}
          <ReviewProgress>
            <span className="verbose-counts">
              <b>{appliedCount} of {total}</b> applied
            </span>
            <span className="summary-count">
              <b>{appliedCount}</b>/{total}
            </span>
            <div className="bar">
              <div className="fill" style={{ width: `${progressPct}%` }} />
            </div>
          </ReviewProgress>
          <HeaderActions>
            {/* Hybrid mode: candidates submit manually on the employer's
                site. The old bulk "Approve all" CTA would have queued
                auto-submissions, which is no longer supported by
                default. We still surface "Preparing N…" so the user
                knows the agent is working through their queue. */}
            {pendingCount > 0 && (
              <span className="header-preparing" style={{ fontSize: 12, color: '#8A87A3', alignSelf: 'center' }}>
                {actionablePendingCount > 0
                  ? `${actionablePendingCount} ready to apply`
                  : `Preparing ${pendingCount}…`}
              </span>
            )}
            <Btn
              className="header-action--desktop-only"
              $variant="ghost"
              onClick={() => navigate('/applypilot/dashboard')}
            >
              Back to dashboard
            </Btn>
          </HeaderActions>
        </ReviewHead>

        <ReviewBody>
          <ReviewQueue $hideOnMobile={mobileShowDetail}>
            <QueueHeadR>Applications · {total}</QueueHeadR>
            <div style={{
              display: 'flex', gap: 2, padding: '0 12px 6px',
              borderBottom: '1px solid #E4DFF5',
              overflowX: 'auto',
            }}>
              {FILTER_OPTIONS.map(f => {
                const count = f.key === null
                  ? (queue || []).filter(a => (statuses[a.id] ?? a.status ?? 'pending') !== 'rejected').length
                  : (queue || []).filter(a => (statuses[a.id] ?? a.status ?? 'pending') === f.key).length;
                const active = statusFilter === f.key;
                const tone = FILTER_TONE[f.tone];
                return (
                  <button
                    key={f.key ?? 'all'}
                    onClick={() => setStatusFilter(f.key)}
                    type="button"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '8px 10px',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      color: active ? tone.fg : '#6B6787',
                      position: 'relative', whiteSpace: 'nowrap',
                      borderBottom: active ? `2px solid ${tone.line}` : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {f.label}
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, padding: '2px 7px',
                      borderRadius: 999, minWidth: 18, textAlign: 'center',
                      background: active ? tone.pillBg : '#F4F2FB',
                      color: active ? tone.pillFg : '#6B6787',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {((statusFilter
              ? (queue || []).filter(a => (statuses[a.id] ?? a.status ?? 'pending') === statusFilter)
              : (queue || []).filter(a => (statuses[a.id] ?? a.status ?? 'pending') !== 'rejected')
            ) || []).map(a => {
              const st = statuses[a.id] ?? a.status ?? 'pending';
              return (
                <QueueItemR
                  key={a.id}
                  $selected={selectedId === a.id}
                  onClick={() => {
                    handleSelect(a.id);
                    setMobileShowDetail(true);
                  }}
                >
                  <CompanyAvatar
                    company={a.company}
                    companyKey={a.companyKey}
                    letter={a.logoText}
                    size={36}
                    radius={10}
                  />
                  <div>
                    <div className="q-title">{a.role}</div>
                    <div className="q-sub">
                      {a.company} · {a.match}%
                    </div>
                    {st === 'approved' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>✓ Approved, queued</div>
                    )}
                    {st === 'submitted' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#147A41' }}>
                        ✓ {a.manuallyAppliedAt ? 'Applied' : 'Submitted'}
                      </div>
                    )}
                    {/* Hybrid tracking chip, only render once the
                        candidate has progressed past `applied` so the
                        list isn't a wall of identical green pills. */}
                    {a.trackingStatus && !['not_applied', 'applied'].includes(a.trackingStatus) && (
                      <div style={{ marginTop: 4 }}>
                        <TrackingChip status={a.trackingStatus} />
                      </div>
                    )}
                    {st === 'submitting' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>⏳ Submitting…</div>
                    )}
                    {st === 'needs_attention' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8A3F00' }}>⚠ Needs attention</div>
                    )}
                    {st === 'failed' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#C42B35' }}>✗ Failed</div>
                    )}
                    {st === 'rejected' && (
                      <div className="q-state-rejected">Rejected</div>
                    )}
                    {a.matchBreakdown?.belowThreshold && st !== 'rejected' && st !== 'submitted' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8A3F00' }}>
                        ⚠ Below your match floor, manual review only
                      </div>
                    )}
                    {st === 'pending' && (
                      <div className="q-ready">
                        {a.prepared.resume && <span className="dot" />}
                        {a.prepared.cover && <span className="dot" />}
                        {a.prepared.form && <span className="dot" />}
                      </div>
                    )}
                  </div>
                  {st === 'pending' && (
                    <MatchBadge $fair={a.match < 80}>{a.match}%</MatchBadge>
                  )}
                  {(st === 'rejected' || st === 'failed' || st === 'needs_attention') && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                      title="Remove permanently"
                      aria-label="Remove application"
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 6,
                        border: '1px solid #E4DFF5', background: '#FFFFFF',
                        color: '#6B6787', cursor: 'pointer',
                        fontSize: 14, lineHeight: 1, padding: 0,
                      }}
                    >×</button>
                  )}
                </QueueItemR>
              );
            })}
          </ReviewQueue>

          <ReviewDetail $showOnMobile={mobileShowDetail}>
            {!selected ? (
              // Empty / no-selection state. Render its OWN container instead
              // of reusing ReviewHero — ReviewHero's narrow-viewport breakpoint
              // uses a CSS grid that maps `> :first-child` to a 40px logo
              // column. With only a single text child the empty-state copy
              // got crammed into that 40px column and wrapped word-by-word
              // ("All / caught / up!" stacking vertically).
              <EmptyDetailState>
                {queue?.length === 0 ? (
                  <>
                    <h2>All caught up!</h2>
                    <p>No applications waiting for review. Your agent will scout new matches and add them here.</p>
                    <Btn
                      $variant="primary"
                      style={{ marginTop: 16 }}
                      onClick={() => navigate('/applypilot/dashboard')}
                    >
                      Back to dashboard
                    </Btn>
                  </>
                ) : (
                  <>
                    <h2>Loading applications…</h2>
                    <p>Your agent is preparing the queue.</p>
                  </>
                )}
              </EmptyDetailState>
            ) : (
            <>
            <ReviewDetailHead>
              <ReviewHero>
                <CompanyAvatar
                  company={selected.company}
                  companyKey={selected.companyKey}
                  letter={selected.logoText}
                  size={48}
                  radius={12}
                />
                <div className="r-title">
                  <h2>{selected.role}</h2>
                  <p>
                    {selected.company} · {selected.location} · {selected.salary}
                    {selected.postedAgo ? ` · Posted ${selected.postedAgo}` : ''}
                  </p>
                </div>
                <div
                  className="r-match"
                  style={{ '--match-deg': `${Math.round((selected.match || 0) * 3.6)}deg` }}
                >
                  <div className="m-pct">{selected.match}%</div>
                  <div className="m-lab">Match</div>
                </div>
<div className="r-skills">
                  {(() => {
                    // Pull real skills overlap from the deterministic
                    // scout's matchBreakdown when the detail payload
                    // has loaded; fall back to a minimal indicator so
                    // the row never looks broken before the fetch.
                    const have = Array.isArray(appDetail?.matchBreakdown?.haveSkills)
                      ? appDetail.matchBreakdown.haveSkills
                      : [];
                    const missing = Array.isArray(appDetail?.matchBreakdown?.missingSkills)
                      ? appDetail.matchBreakdown.missingSkills
                      : [];
                    const chips = [
                      ...have.slice(0, 4).map(name => ({ name, have: true })),
                      ...missing.slice(0, 2).map(name => ({ name, missing: true })),
                    ];
                    if (chips.length === 0) return null;
                    return chips.map(s => (
                      <SkillToken key={`${s.name}-${s.have ? 'h' : 'm'}`} $have={s.have} $missing={s.missing}>
                        {s.name}
                      </SkillToken>
                    ));
                  })()}
                  <SkillToken className="r-skills-fit" $fit>
                    {selected.match >= 85 ? 'Strong fit' : selected.match >= 60 ? 'Good fit' : 'Light fit'}
                  </SkillToken>
                </div>
              </ReviewHero>
            </ReviewDetailHead>

            {/* Mobile-only compact header for "Open full" focus mode. */}
            <FocusHeader>
              <button
                type="button"
                className="fh-back"
                onClick={() => setFocusMode(false)}
                aria-label="Exit focus mode"
              >
                <BackIcon style={{ fontSize: 18 }} />
              </button>
              <div className="fh-title">
                <div className="fh-line1">
                  {selected.company} · {selected.role}
                </div>
                <div className="fh-line2">
                  Application {Math.min(appliedCount + 1, total)} of {total}
                </div>
              </div>
              <div className="fh-match">{selected.match}%</div>
            </FocusHeader>

            <ReviewTabs>
              {TABS.map((t, i) => (
                <RTab
                  key={t}
                  $on={activeTab === i}
                  onClick={() => setActiveTab(i)}
                  type="button"
                >
                  {i < 3 && (
                    tabReadiness[i] ? (
                      <span className="ok" title="Ready">✓</span>
                    ) : (
                      <span className="pending" title="Will generate after approval">
                        ⏳ Pending
                      </span>
                    )
                  )}
                  {t}
                  {i === 2 && (appDetail?.formAnswers || []).length > 0 &&
                    ` (${(appDetail.formAnswers || []).length} field${(appDetail.formAnswers || []).length === 1 ? '' : 's'})`}
                </RTab>
              ))}
            </ReviewTabs>

            <ReviewContent>
              <ReviewPanel>
                {/* ── Tab 0: Tailored resume ── */}
                {activeTab === 0 && (
                  <>
                    <div className="panel-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                      <h3 className="panel-title" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        Tailored resume
                      </h3>
                      <span className="panel-subtitle" style={{ fontSize: 11.5, color: '#6B6787' }}>
                        based on {selected.company} JD
                      </span>
                      <div className="panel-toolbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Download CTA, opens the same
                            ResumePreviewModal the Jobs page uses
                            after tailoring; that modal hosts the
                            preview, format toggle, filename edit, and
                            the actual PDF/DOCX download buttons. */}
                        <Btn
                          className="download-pdf-action"
                          $size="sm"
                          $variant="primary"
                          onClick={() => { setResumePreviewMode('preview'); setResumePreviewOpen(true); }}
                          title="Preview & download tailored resume"
                        >
                          Download
                        </Btn>
                        <Btn
                          className="edit-resume-action"
                          $size="sm"
                          $variant="primary"
                          onClick={() => { setResumePreviewMode('edit'); setResumePreviewOpen(true); }}
                          title="Edit the tailored resume inline"
                        >
                          Edit
                        </Btn>
                        <Btn
                          className="regenerate-resume-action"
                          $size="sm"
                          $variant="primary"
                          onClick={() => setTailorModalOpen(true)}
                          disabled={actionInFlight}
                          title="Re-tailor the resume for this job with custom settings"
                        >
                          {actionInFlight ? 'Regenerating…' : 'Regenerate'}
                        </Btn>
                        <Btn
                          className="open-full-action"
                          $size="sm"
                          onClick={() => {
                            // Always enter distraction-free focus mode
                            // in-place rather than navigating away.
                            setFocusMode(true);
                          }}
                          title="View full tailored resume"
                        >
                          <span className="open-full-mobile">Open full ↗</span>
                          <span className="open-full-desktop">Open full resume</span>
                        </Btn>
                      </div>
                    </div>

                    <TailoredResumeRender
                      rendered={appDetail?.renderedResume}
                      rich={appDetail?.diff?.rich}
                      diff={appDetail?.diff}
                      company={selected?.company}
                    />

                    <WhyBox>
                      <b>Why these changes?</b>{' '}
                      {appDetail?.whyPicked
                        ? appDetail.whyPicked
                        : `${selected.company}'s JD emphasizes payment experience, measurable conversion impact, and design systems at scale. The agent surfaced your relevant work to match. You can reject any single change before approving.`}
                    </WhyBox>
                  </>
                )}

                {/* ── Tab 1: Cover letter ── */}
                {activeTab === 1 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        Cover letter
                      </h3>
                      {appDetail?.coverLetter && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <Btn
                            $size="sm"
                            $variant="primary"
                            onClick={handleRegenerateCoverLetter}
                            disabled={actionInFlight}
                            title="Re-draft the cover letter for this job"
                          >
                            {actionInFlight ? 'Regenerating…' : 'Regenerate'}
                          </Btn>
                          <Btn $size="sm" onClick={() => openEditModal('cover')}>
                            Request edit
                          </Btn>
                        </div>
                      )}
                    </div>
                    {appDetail?.coverLetter ? (
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.7, color: '#2D2A3E' }}>
                        {appDetail.coverLetter}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ color: '#6B6787', fontSize: 13, margin: 0 }}>
                          A cover letter will be generated as part of preparation. You can also draft one now.
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn $size="sm" onClick={handleRegenerateCoverLetter} disabled={actionInFlight}>
                            {actionInFlight ? 'Generating…' : 'Generate cover letter'}
                          </Btn>
                          <Btn $size="sm" $variant="ghost" onClick={() => openEditModal('cover')}>
                            Request edit
                          </Btn>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Tab 2: Application questions & answers ──
                     Only AI-worthy items show as full cards: textareas
                     and long-form prompts ("Why are you interested?",
                     "Tell us about a time…"). Trivial identity fields
                     (name, email, phone, location, url) collapse into
                     a small "Standard fields" summary so the candidate
                     focuses on what actually needs writing. */}
                {activeTab === 2 && (() => {
                  const STANDARD_TYPES = new Set([
                    'text', 'email', 'phone', 'url', 'number', 'date',
                    'select', 'multiselect', 'checkbox', 'radio',
                  ]);
                  // Heuristic: long-form prompts the AI needs to draft.
                  const AI_PROMPT_RE = /\?|why|how|describe|tell us|explain|what makes|interest|motivat|why do you|tell me|cover\s*letter|biggest|proud|challeng/i;
                  const all = Array.isArray(appDetail?.formAnswers) ? appDetail.formAnswers : [];
                  const aiQuestions = [];
                  const standardFields = [];
                  for (const fa of all) {
                    const q = fa.label || fa.question || '';
                    const isLongType = !STANDARD_TYPES.has((fa.type || 'text').toLowerCase());
                    if (isLongType || AI_PROMPT_RE.test(q)) aiQuestions.push(fa);
                    else standardFields.push(fa);
                  }
                  return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        Application questions & answers
                      </h3>
                      <span style={{ fontSize: 12, color: '#6B6787' }}>
                        AI-drafted answers for the open-ended questions on this application, refine, edit, or copy each one.
                      </span>
                    </div>
                    {aiQuestions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {aiQuestions.map((fa, i) => (
                          <FormAnswerCard
                            key={fa.fieldId || `${fa.label || fa.question || 'field'}-${i}`}
                            fa={fa}
                            index={i}
                            disabled={actionInFlight}
                            onSave={handleSaveAnswer}
                            onRegenerate={handleRegenerateAnswerFor}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ color: '#6B6787', fontSize: 13, margin: 0 }}>
                          {selected?.dbStatus === 'preparing' || selected?.dbStatus === 'pending' || selected?.dbStatus === 'scouting'
                            ? 'The agent is still preparing this application. Drafted answers will appear here once tailoring is done, usually within a minute.'
                            : 'No open-ended screener questions were detected on this posting beyond the standard identity fields (name, email, resume).'}
                        </p>
                      </div>
                    )}
                    {standardFields.length > 0 && (
                      <div style={{
                        marginTop: 18,
                        padding: '14px 16px',
                        background: '#F8F7FC',
                        border: '1px solid #E4DFF5',
                        borderRadius: 10,
                      }}>
                        <div style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: '#5B57A6',
                          marginBottom: 8,
                        }}>
                          Standard fields ({standardFields.length}), auto-filled from your profile
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 13, color: '#2D2A3E' }}>
                          {standardFields.map((fa, i) => (
                            <span key={fa.fieldId || `${fa.label || fa.question}-${i}`}>
                              <strong style={{ fontWeight: 600 }}>{fa.label || fa.question}:</strong>{' '}
                              <span style={{ color: '#6B6787' }}>{fa.answer || '—'}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                  );
                })()}

                {/* ── Tab 3: Job description, raw JD the AI used
                     when tailoring resume + cover letter + answers.
                     Lets the candidate verify the source material. ── */}
                {activeTab === 3 && (
                  <>
                    <div className="panel-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                      <h3 className="panel-title" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        Job description
                      </h3>
                      <span className="panel-subtitle" style={{ fontSize: 11.5, color: '#6B6787' }}>
                        Source material the AI used to tailor everything
                      </span>
                      {(appDetail?.job?.jobUrl || selected?.jobUrl) && (
                        <Btn
                          $size="sm"
                          $variant="primary"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => window.open(appDetail?.job?.jobUrl || selected?.jobUrl, '_blank', 'noopener,noreferrer')}
                          title="Open the original job posting"
                        >
                          Open original posting ↗
                        </Btn>
                      )}
                    </div>
                    {appDetail?.job ? (
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E4DFF5',
                        borderRadius: 12,
                        padding: '24px 28px',
                        maxWidth: 820,
                      }}>
                        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F0EDF7' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#2D2A3E', lineHeight: 1.3 }}>
                            {appDetail.job.title || selected?.role || 'Role'}
                          </div>
                          <div style={{ fontSize: 13, color: '#6B6787', marginTop: 4 }}>
                            {[appDetail.job.company || selected?.company, appDetail.job.location].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {appDetail.job.description && (
                          <JDBlocks raw={appDetail.job.description} />
                        )}
                        {appDetail.job.requirements && (
                          <>
                            <h4 style={{
                              margin: '18px 0 6px',
                              fontSize: 13,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#5B57A6',
                            }}>Requirements</h4>
                            <JDBlocks raw={appDetail.job.requirements} />
                          </>
                        )}
                        {!appDetail.job.description && !appDetail.job.requirements && (
                          <div style={{ fontSize: 13, color: '#6B6787', fontStyle: 'italic' }}>
                            No description text was captured for this posting.
                            Open the original posting to read the full job ad.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#6B6787', fontStyle: 'italic' }}>
                        Loading job description…
                      </div>
                    )}
                  </>
                )}

                {/* ── Tab 4: Match score, breakdown of why this
                     job scored where it did + which skills matched. ── */}
                {activeTab === 4 && (
                  <div style={{ maxWidth: 820 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
                      Match score analysis
                    </h3>
                    <div style={{ fontSize: 12, color: '#6B6787', marginBottom: 16 }}>
                      How this role compares against your profile and criteria.
                    </div>

                    {/* Hero score card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 20,
                      background: '#FFFFFF',
                      border: '1px solid #E4DFF5',
                      borderRadius: 12,
                      padding: '20px 24px',
                      marginBottom: 18,
                    }}>
                      <div style={{
                        width: 96,
                        height: 96,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: `conic-gradient(#7C5CFA 0 ${(selected.match || 0) * 3.6}deg, #EDE9FE ${(selected.match || 0) * 3.6}deg 360deg)`,
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: 76,
                          height: 76,
                          borderRadius: '50%',
                          background: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          flexDirection: 'column',
                        }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#2D2A3E', lineHeight: 1 }}>
                            {selected.match ?? '—'}<span style={{ fontSize: 12, fontWeight: 600, color: '#6B6787' }}>%</span>
                          </div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.4px', color: '#6B6787', textTransform: 'uppercase' }}>Match</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2D2A3E', marginBottom: 4 }}>
                          {selected.match >= 85 ? 'Strong fit' : selected.match >= 70 ? 'Good fit' : selected.match >= 55 ? 'Moderate fit' : 'Light fit'}
                        </div>
                        <div style={{ fontSize: 13, color: '#4A4763', lineHeight: 1.5 }}>
                          {appDetail?.whyPicked
                            || `Your profile aligns with the core requirements at ${selected.company}. The agent surfaced this role because it matches your titles, locations, and skills criteria.`}
                        </div>
                      </div>
                    </div>

                    {/* Skills overlap, real data from matchBreakdown.
                         haveSkills = JD terms found in the candidate's
                         profile, missingSkills = JD terms the candidate
                         doesn't have yet (worth highlighting in cover
                         letter / Q&A). Falls back to a friendly empty
                         state when the deterministic scorer didn't
                         capture skill terms (e.g. very thin JD). */}
                    {(() => {
                      const mb = appDetail?.matchBreakdown || {};
                      const have = Array.isArray(mb.haveSkills) ? mb.haveSkills : [];
                      const missing = Array.isArray(mb.missingSkills) ? mb.missingSkills : [];
                      const total = have.length + missing.length;
                      const coverage = total > 0 ? Math.round((have.length / total) * 100) : null;
                      return (
                        <div style={{
                          background: '#FFFFFF',
                          border: '1px solid #E4DFF5',
                          borderRadius: 12,
                          padding: '18px 22px',
                          marginBottom: 14,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#5B57A6',
                            }}>Skills overlap</h4>
                            {total > 0 && (
                              <span style={{ fontSize: 12, color: '#4A4763' }}>
                                <b>{have.length}</b> of <b>{total}</b> JD skills present {coverage != null && (
                                  <span style={{ color: '#6B6787' }}>· {coverage}% coverage</span>
                                )}
                              </span>
                            )}
                          </div>

                          {total === 0 ? (
                            <span style={{ fontSize: 12, color: '#6B6787', fontStyle: 'italic' }}>
                              No explicit skill keywords were extracted from this posting. The match score reflects title, experience level, and location alignment only.
                            </span>
                          ) : (
                            <>
                              {have.length > 0 && (
                                <div style={{ marginBottom: missing.length > 0 ? 14 : 0 }}>
                                  <div style={{ fontSize: 11.5, color: '#1A7A4A', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    ✓ In your profile ({have.length})
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {have.map((name) => (
                                      <SkillToken key={`h-${name}`} $have>
                                        ✓ {name}
                                      </SkillToken>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {missing.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11.5, color: '#B45309', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    + Worth highlighting ({missing.length})
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {missing.map((name) => (
                                      <SkillToken key={`m-${name}`} $missing>
                                        + {name}
                                      </SkillToken>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#6B6787', marginTop: 8, lineHeight: 1.5 }}>
                                    These keywords appear in the JD but not in your profile. If you have related experience, add it to the Application Q&amp;A or weave it into your cover letter.
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Score breakdown, the 5 sub-scores from the
                         deterministic scout (title / skills / level /
                         location / recency). Each is a 0–40-ish raw
                         number; we render relative bars so the user
                         can see which axis is dragging the score. */}
                    {(() => {
                      const b = appDetail?.matchBreakdown?.breakdown;
                      if (!b) return null;
                      const rows = [
                        { key: 'titleMatch', label: 'Title alignment', value: b.titleMatch, max: 35, hint: 'How closely the role title matches the titles you target.' },
                        { key: 'skillsMatch', label: 'Skills match', value: b.skillsMatch, max: 35, hint: 'JD keywords found in your profile.' },
                        { key: 'experienceMatch', label: 'Seniority fit', value: b.experienceMatch, max: 15, hint: 'Whether the seniority signal matches your level.' },
                        { key: 'locationMatch', label: 'Location fit', value: b.locationMatch, max: 10, hint: 'Remote / metro / country alignment with your criteria.' },
                        { key: 'recencyBonus', label: 'Posting recency', value: b.recencyBonus, max: 5, hint: 'Newer postings get a small boost so stale jobs don’t crowd the list.' },
                      ];
                      const hasAny = rows.some(r => typeof r.value === 'number');
                      if (!hasAny) return null;
                      return (
                        <div style={{
                          background: '#FFFFFF',
                          border: '1px solid #E4DFF5',
                          borderRadius: 12,
                          padding: '18px 22px',
                          marginBottom: 14,
                        }}>
                          <h4 style={{
                            margin: '0 0 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: '#5B57A6',
                          }}>Score breakdown</h4>
                          <div style={{ display: 'grid', gap: 10 }}>
                            {rows.map((r) => {
                              const v = typeof r.value === 'number' ? r.value : 0;
                              const pct = Math.max(0, Math.min(100, Math.round((v / r.max) * 100)));
                              const tone =
                                pct >= 70 ? '#1A7A4A' :
                                pct >= 40 ? '#7C5CFA' :
                                '#B45309';
                              return (
                                <div key={r.key}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#2D2A3E', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600 }} title={r.hint}>{r.label}</span>
                                    <span style={{ color: '#6B6787', fontVariantNumeric: 'tabular-nums' }}>
                                      {v} / {r.max}
                                    </span>
                                  </div>
                                  <div style={{ height: 6, background: '#EDE9FE', borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: tone,
                                      borderRadius: 999,
                                      transition: 'width 200ms ease',
                                    }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {appDetail?.matchBreakdown?.belowThreshold && (
                            <div style={{
                              marginTop: 12,
                              padding: '8px 12px',
                              background: '#FFF4CF',
                              border: '1px solid #E7C66A',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#5C4300',
                            }}>
                              This role is below your auto-apply threshold but was surfaced because nothing else cleared it. Review carefully before applying.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* What this means + next steps */}
                    <div style={{
                      background: '#F8F7FC',
                      border: '1px solid #E4DFF5',
                      borderRadius: 12,
                      padding: '16px 20px',
                    }}>
                      <h4 style={{
                        margin: '0 0 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#5B57A6',
                      }}>What this score means</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4A4763', lineHeight: 1.6 }}>
                        <li>Your tailored resume is already aligned with the keywords this role emphasizes.</li>
                        <li>Strong matches (80%+) typically pass ATS screens, focus your energy on the cover letter and Q&amp;A.</li>
                        <li>For lighter matches, review the Job description tab and add any missing keywords before applying.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* ── Tab 5: How to apply, walks the candidate
                     through downloading the resume + using the
                     Chrome extension to auto-fill the form. ── */}
                {activeTab === 5 && (
                  <div style={{ maxWidth: 820 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
                      How to apply
                    </h3>
                    <div style={{ fontSize: 12, color: '#6B6787', marginBottom: 18 }}>
                      Two quick paths to send this application, pick whichever you prefer.
                    </div>

                    {/* Step cards */}
                    <div style={{ display: 'grid', gap: 14 }}>
                      {/* Step 1 — Download resume */}
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E4DFF5',
                        borderRadius: 12,
                        padding: '18px 22px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#7C5CFA',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                          }}>1</span>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2D2A3E' }}>
                            Download your tailored resume &amp; cover letter
                          </h4>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4A4763', lineHeight: 1.55 }}>
                          The agent already prepared a PDF resume and cover letter tuned for this role.
                          Download them, then upload to the application form.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Btn
                            $variant="primary"
                            onClick={() => { setResumePreviewMode('preview'); setResumePreviewOpen(true); }}
                          >
                            Download resume PDF
                          </Btn>
                          <Btn $variant="ghost" onClick={() => setActiveTab(1)}>
                            View cover letter
                          </Btn>
                        </div>
                      </div>

                      {/* Step 2 — Chrome extension */}
                      <div style={{
                        background: 'linear-gradient(135deg, #F5F2FF 0%, #FFFFFF 100%)',
                        border: '1px solid #D4CCF5',
                        borderRadius: 12,
                        padding: '18px 22px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#7C5CFA',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                          }}>2</span>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2D2A3E' }}>
                            Auto-fill the form with our Chrome extension
                          </h4>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#5B57A6',
                            background: '#EDE9FE',
                            padding: '2px 8px',
                            borderRadius: 999,
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase',
                          }}>Recommended</span>
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#4A4763', lineHeight: 1.55 }}>
                          Skip the copy-paste. The ProfilleAI extension fills name, email, work history,
                          links, and the AI-drafted answers directly into the company&apos;s form, in seconds.
                        </p>
                        <ol style={{ margin: '0 0 14px 18px', padding: 0, fontSize: 12.5, color: '#4A4763', lineHeight: 1.7 }}>
                          <li>Install the extension from the Chrome Web Store.</li>
                          <li>Click <b>Open application</b> below to launch the company&apos;s form.</li>
                          <li>Tap the ProfilleAI icon in your toolbar, the extension auto-fills every field.</li>
                          <li>Upload your downloaded resume + cover letter, review, and submit.</li>
                        </ol>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Btn
                            $variant="primary"
                            onClick={() => window.open('https://chromewebstore.google.com/', '_blank', 'noopener,noreferrer')}
                          >
                            Get the Chrome extension ↗
                          </Btn>
                          {(appDetail?.job?.jobUrl || selected?.applicationUrl || selected?.jobUrl) && (
                            <Btn
                              $variant="ghost"
                              onClick={() => window.open(selected?.applicationUrl || appDetail?.job?.jobUrl || selected?.jobUrl, '_blank', 'noopener,noreferrer')}
                            >
                              Open application ↗
                            </Btn>
                          )}
                        </div>
                      </div>

                      {/* Step 3 — Manual fallback */}
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E4DFF5',
                        borderRadius: 12,
                        padding: '18px 22px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#A29BC8',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'grid',
                            placeItems: 'center',
                          }}>3</span>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2D2A3E' }}>
                            Prefer to apply manually? Use the Q&amp;A drafts
                          </h4>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4A4763', lineHeight: 1.55 }}>
                          Open the <b>Application Q&amp;A</b> tab and copy each AI-drafted answer into the form yourself.
                        </p>
                        <Btn $variant="ghost" onClick={() => setActiveTab(2)}>
                          Open Application Q&amp;A
                        </Btn>
                      </div>
                    </div>

                    <div style={{
                      marginTop: 16,
                      padding: '12px 16px',
                      background: '#FFF8E6',
                      border: '1px solid #FCE4A1',
                      borderRadius: 10,
                      fontSize: 12.5,
                      color: '#7A5A00',
                      lineHeight: 1.5,
                    }}>
                      <b>Reminder:</b> ApplyPilot never submits on your behalf. Once you&apos;ve sent the application,
                      hit <b>I applied</b> below so we can start tracking responses.
                    </div>
                  </div>
                )}

                {/* ── Tab 6: Submission status ── */}
                {activeTab === 6 && (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
                      Submission status
                    </h3>

                    {/* Hybrid manual-tracking widget. Shows the
                        candidate-driven pipeline (applied →
                        interviewing → offer/hired/rejected). Lives at
                        the top of the panel because once the candidate
                        marks a row applied, this is the section they'll
                        return to as they hear back. */}
                    <div style={{
                      background: '#F8F7FC',
                      border: '1px solid #E4DFF5',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 16,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#2D2A3E', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Tracking
                        </span>
                        <TrackingChip status={appDetail?.tracking?.status} />
                        {appDetail?.tracking?.manuallyAppliedAt && (
                          <span style={{ fontSize: 11, color: '#6B6787' }}>
                            applied {new Date(appDetail.tracking.manuallyAppliedAt).toLocaleDateString()}
                          </span>
                        )}
                        <select
                          value={appDetail?.tracking?.status || 'not_applied'}
                          onChange={(e) => handleTrackingChange(e.target.value)}
                          style={{
                            marginLeft: 'auto',
                            fontSize: 12,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #D7CFF5',
                            background: '#FFFFFF',
                            color: '#2D2A3E',
                            cursor: 'pointer',
                          }}
                        >
                          {TRACKING_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Preview-screenshots dry-run is only useful
                        before the candidate has manually submitted.
                        Once applied, hide the toolbar + any leftover
                        error / blocker / screenshot output that's
                        irrelevant to a sent application. */}
                    {!appDetail?.tracking?.manuallyAppliedAt && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <Btn $size="sm" onClick={handlePreview} disabled={!selected?.id || previewState.loading || previewState.unsupported}>
                            {previewState.loading
                              ? 'Building preview…'
                              : previewState.unsupported
                                ? 'Preview unavailable for this ATS'
                                : 'Preview screenshots'}
                          </Btn>
                          <span style={{ fontSize: 12, color: '#6B6787' }}>
                            Runs a dry-run fill (no submit click) and captures screenshots.
                          </span>
                        </div>

                        {previewState.error && (
                          <div style={{
                            background: previewState.unsupported ? '#FFF4CF' : '#FFF0F0',
                            border: previewState.unsupported ? '1px solid #E7C66A' : '1px solid #FFD4D4',
                            borderRadius: 8,
                            padding: '10px 14px',
                            fontSize: 13,
                            color: previewState.unsupported ? '#5C4300' : '#8B2020',
                            marginBottom: 10,
                          }}>
                            <b>{previewState.unsupported ? 'Preview unavailable:' : 'Preview error:'}</b> {previewState.error}
                          </div>
                        )}

                        {Array.isArray(previewState.blockers) && previewState.blockers.length > 0 && (
                          <div style={{ background: '#FFF4CF', border: '1px solid #E7C66A', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#5C4300', marginBottom: 6 }}>
                              Preview blockers, manual input needed:
                            </div>
                            {previewState.blockers.map((b, i) => (
                              <div key={i} style={{ fontSize: 13, color: '#5C4300', marginBottom: 2 }}>
                                • {b.label || b.name || 'Unknown field'}: {b.reason || 'Needs manual answer'}
                              </div>
                            ))}
                          </div>
                        )}

                        {Array.isArray(previewState.screenshots) && previewState.screenshots.length > 0 && (
                          <TimelineCard>
                            <h4>Pre-submit preview · {previewState.screenshots.length} step{previewState.screenshots.length === 1 ? '' : 's'}</h4>
                            <TimelineList>
                              {previewState.screenshots.map((s, i) => (
                                <TimelineItem key={`${s.url || 'preview'}-${i}`}>
                                  <div className="step">{i + 1}</div>
                                  <div className="body">
                                    <div className="label">{s.label || `Step ${i + 1}`}</div>
                                    <div className="when">
                                      {s.capturedAt ? new Date(s.capturedAt).toLocaleTimeString() : ''}
                                    </div>
                                  </div>
                                  {s.url ? (
                                    <a
                                      className="thumb"
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ backgroundImage: `url(${s.url})` }}
                                      title={`Open ${s.label || 'preview screenshot'} in new tab`}
                                    />
                                  ) : (
                                    <div className="thumb-missing">No screenshot</div>
                                  )}
                                </TimelineItem>
                              ))}
                            </TimelineList>
                          </TimelineCard>
                        )}
                      </>
                    )}

                    {appDetail?.submission ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <StatusChip status={appDetail.submission.status} />
                          {appDetail.submission.provider && (
                            <span style={{ fontSize: 12, color: '#6B6787', padding: '4px 8px', background: '#F0EFF5', borderRadius: 6 }}>
                              via {appDetail.submission.provider}
                            </span>
                          )}
                        </div>
                        {appDetail.submission.submittedAt && (
                          <div style={{ fontSize: 13, color: '#2D2A3E' }}>
                            <b>Submitted:</b> {new Date(appDetail.submission.submittedAt).toLocaleString()}
                          </div>
                        )}
                        {appDetail.submission.attempts > 0 && (
                          <div style={{ fontSize: 13, color: '#6B6787' }}>
                            Attempts: {appDetail.submission.attempts}
                            {appDetail.submission.lastAttemptAt && ` · Last: ${new Date(appDetail.submission.lastAttemptAt).toLocaleString()}`}
                          </div>
                        )}
                        {appDetail.submission.resumePdfUrl && (
                          <div style={{ fontSize: 13 }}>
                            <a href={appDetail.submission.resumePdfUrl} target="_blank" rel="noopener noreferrer"
                               style={{ color: '#6C5CE7' }}>
                              View submitted resume PDF
                            </a>
                          </div>
                        )}
                        {appDetail.submission.error && (
                          <div style={{ background: '#FFF0F0', border: '1px solid #FFD4D4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8B2020' }}>
                            <b>Error:</b> {appDetail.submission.error}
                          </div>
                        )}
                        {appDetail.submission.receipt?.blockers?.length > 0 && (
                          <div style={{ background: '#FFF4CF', border: '1px solid #E7C66A', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#5C4300', marginBottom: 6 }}>
                              Blockers, manual input needed:
                            </div>
                            {appDetail.submission.receipt.blockers.map((b, i) => (
                              <div key={i} style={{ fontSize: 13, color: '#5C4300', marginBottom: 2 }}>
                                • {b.field?.label || b.field?.name || 'Unknown field'}: {b.reason}
                              </div>
                            ))}
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E7C66A', fontSize: 12, color: '#5C4300' }}>
                              The agent saw these fields for the first time. Teach it how to answer once
                              and it will reuse the answer for every future application.
                              {featureFlags.applyPilotCoach && (
                                <>
                                  {' '}
                                  <a
                                    href="/applypilot/agent/coach"
                                    onClick={(e) => { e.preventDefault(); navigate('/applypilot/agent/coach'); }}
                                    style={{ color: '#6C5CE7', fontWeight: 600, textDecoration: 'underline' }}
                                  >
                                    Train the agent →
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Submission timeline, renders one row per
                             screenshot the Puppeteer adapter captured.
                             Missing URL means the adapter ran without
                             Cloudinary creds (dev mode), we still
                             render the step label so the sequence is
                             clear. */}
                        {Array.isArray(appDetail.submission.screenshots) && appDetail.submission.screenshots.length > 0 && (
                          <TimelineCard>
                            <h4>Submission timeline · {appDetail.submission.screenshots.length} step{appDetail.submission.screenshots.length === 1 ? '' : 's'}</h4>
                            <TimelineList>
                              {appDetail.submission.screenshots.map((s, i) => (
                                <TimelineItem key={`${s.url || 'step'}-${i}`}>
                                  <div className="step">{i + 1}</div>
                                  <div className="body">
                                    <div className="label">{s.label || `Step ${i + 1}`}</div>
                                    <div className="when">
                                      {s.capturedAt ? new Date(s.capturedAt).toLocaleTimeString() : ''}
                                    </div>
                                  </div>
                                  {s.url ? (
                                    <a
                                      className="thumb"
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ backgroundImage: `url(${s.url})` }}
                                      title={`Open ${s.label || 'screenshot'} in new tab`}
                                    />
                                  ) : (
                                    <div className="thumb-missing">No screenshot</div>
                                  )}
                                </TimelineItem>
                              ))}
                            </TimelineList>
                          </TimelineCard>
                        )}
                        {/* Consent-heuristic audit trail. Rendered
                            separately from screenshots so the user can
                            see exactly which attestation checkboxes the
                            agent auto-ticked (and why) alongside the
                            visual timeline. */}
                        {Array.isArray(appDetail.submission.resolutions) && appDetail.submission.resolutions.length > 0 && (
                          <TimelineCard>
                            <h4>
                              Auto-resolved fields · {appDetail.submission.resolutions.length}
                            </h4>
                            <TimelineList>
                              {appDetail.submission.resolutions.map((r, i) => (
                                <TimelineItem key={`${r.fieldName || 'res'}-${i}`}>
                                  <div className="step">{r.value === 'yes' ? '✓' : '–'}</div>
                                  <div className="body">
                                    <div className="label">
                                      {r.label || r.fieldName || 'Unnamed field'}
                                    </div>
                                    <div className="when">
                                      {r.resolvedVia === 'consent-heuristic'
                                        ? 'Heuristic · universal attestation'
                                        : r.resolvedVia === 'training-memory'
                                          ? 'Training memory · you taught me this'
                                          : r.resolvedVia || 'auto-resolved'}
                                      {r.at ? ` · ${new Date(r.at).toLocaleTimeString()}` : ''}
                                    </div>
                                  </div>
                                </TimelineItem>
                              ))}
                            </TimelineList>
                          </TimelineCard>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#6B6787', fontSize: 13 }}>
                        Not yet submitted. Use “Open application” to apply on the employer’s site, then click “I applied” to track it here.
                      </p>
                    )}
                  </>
                )}
              </ReviewPanel>
            </ReviewContent>

            <ReviewFooter>
              <div className="left">
                {focusMode ? (
                  <Btn
                    className="reject-action exit-focus-action"
                    $variant="default"
                    onClick={() => setFocusMode(false)}
                    title="Exit full view"
                    aria-label="Exit full view"
                  >
                    <CloseIcon style={{ fontSize: 22 }} />
                  </Btn>
                ) : statuses[selected?.id] === 'rejected' ? (
                  <Btn
                    className="reject-action"
                    $variant="default"
                    onClick={handleReopen}
                    title="Reopen this application to approve it again"
                    disabled={actionInFlight}
                  >
                    <span className="action-text">Reopen</span>
                  </Btn>
                ) : (
                  <Btn
                    className="reject-action"
                    $variant="default"
                    onClick={() => setStatus(selected.id, 'rejected')}
                    title="Archive (R), hide this from your queue"
                    disabled={actionInFlight}
                    aria-label="Archive"
                  >
                    <CloseIcon style={{ fontSize: 18 }} />
                    <span className="action-text">Archive</span>
                    <Kbd>R</Kbd>
                  </Btn>
                )}
                <div className="more-menu-wrap" ref={moreMenuRef}>
                  <Btn
                    $variant="ghost"
                    onClick={() => setMoreMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={moreMenuOpen}
                    aria-label="More actions"
                    title="More actions"
                  >
                    <MoreIcon style={{ fontSize: 18 }} />
                  </Btn>
                  {moreMenuOpen && (() => {
                    const readyCount = tabReadiness.filter(Boolean).length;
                    const total = tabReadiness.length;
                    const allReady = readyCount === total;
                    const isRejected = statuses[selected?.id] === 'rejected';
                    return (
                      <MoreMenu role="menu">
                        <div
                          className="status-row"
                          style={{
                            padding: '8px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: allReady ? '#1A7A4A' : '#8A6A00',
                            borderBottom: '1px solid #EFEAFB',
                            marginBottom: 4,
                          }}
                        >
                          {readyCount} of {total} section{total === 1 ? '' : 's'}{' '}
                          {allReady ? 'look good' : 'ready · others still preparing'}
                        </div>
                        {isRejected ? (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={actionInFlight}
                            onClick={() => { setMoreMenuOpen(false); handleReopen(); }}
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={actionInFlight}
                            onClick={() => { setMoreMenuOpen(false); setStatus(selected.id, 'rejected'); }}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!selected?.id || previewState.loading}
                          onClick={() => { setMoreMenuOpen(false); handlePreview(); }}
                        >
                          {previewState.loading ? 'Building preview…' : 'Preview screenshots'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMoreMenuOpen(false); navigate('/applypilot/dashboard'); }}
                        >
                          Back to dashboard
                        </button>
                      </MoreMenu>
                    );
                  })()}
                </div>
              </div>
              <div className="right">
                {(() => {
                  const readyCount = tabReadiness.filter(Boolean).length;
                  const total = tabReadiness.length;
                  const allReady = readyCount === total;
                  return (
                    <span
                      className="footer-status"
                      style={{
                        color: allReady ? '#1A7A4A' : '#8A6A00',
                      }}
                    >
                      {readyCount} of {total} section{total === 1 ? '' : 's'}{' '}
                      {allReady ? 'look good' : 'ready · others still preparing'}
                    </span>
                  );
                })()}
                {/* Hybrid mode: candidate opens the apply page in a new
                    tab, completes the form on the employer's site, then
                    clicks "I applied" to move the row to Sent and start
                    manual tracking. The old "Approve & send" CTA would
                    have queued auto-submission, gated off by default. */}
                {appDetail?.tracking?.manuallyAppliedAt ? (
                  <Btn
                    className="primary-cta"
                    $variant="default"
                    $size="big"
                    disabled
                    title={`Marked as applied ${new Date(appDetail.tracking.manuallyAppliedAt).toLocaleString()}`}
                  >
                    <CheckIcon style={{ fontSize: 14 }} />
                    <span className="cta-label">Applied ✓</span>
                  </Btn>
                ) : (
                  <Btn
                    className="primary-cta"
                    $variant="primary"
                    $size="big"
                    onClick={handleMarkApplied}
                    title={
                      isSelectedPreparing
                        ? 'Application is still preparing'
                        : 'Opens the employer’s apply page and starts tracking'
                    }
                    disabled={actionInFlight || isSelectedPreparing || tabReadiness.some((r) => !r)}
                  >
                    <span className="cta-label">
                      {isSelectedPreparing
                        ? 'Still preparing…'
                        : tabReadiness.some((r) => !r)
                          ? 'Sections preparing…'
                          : (actionInFlight ? 'Saving…' : 'Apply ↗')}
                    </span>
                  </Btn>
                )}
              </div>
            </ReviewFooter>
            </>
            )}
          </ReviewDetail>
        </ReviewBody>
      </ReviewShell>

      <RequestEditModal
        open={editModalOpen}
        defaultSection={editDefaultSection}
        companyName={selected?.company}
        onClose={() => setEditModalOpen(false)}
        onSubmit={submitEdit}
      />

      <TailorSettingsModal
        open={tailorModalOpen}
        onClose={() => setTailorModalOpen(false)}
        jobTitle={selected?.role}
        company={selected?.company}
        onContinue={(settings) => {
          setTailorModalOpen(false);
          handleRegenerateResume(settings);
        }}
      />

      <CoverLetterModal
        open={coverLetterModalOpen}
        onClose={() => setCoverLetterModalOpen(false)}
        jobTitle={selected?.role}
        company={selected?.company}
        onGenerate={handleGenerateCoverLetterFromModal}
      />

      <GapReviewDialog
        open={gapDialogOpen}
        onClose={() => {
          setGapDialogOpen(false);
          setPendingTailorSettings(null);
        }}
        gaps={detectedGaps}
        satisfiedAlternatives={satisfiedAlternatives}
        loading={gapDialogLoading}
        onContinue={handleGapReviewContinue}
      />

      <TailoringProgressModal
        open={tailoringProgressOpen}
        completed={tailoringComplete}
        jobTitle={selected?.role}
        company={selected?.company}
        onMinimize={() => setTailoringProgressOpen(false)}
        onViewResult={() => {
          setTailoringProgressOpen(false);
          setResumePreviewOpen(true);
        }}
      />

      <ResumePreviewModal
        open={resumePreviewOpen}
        onClose={() => setResumePreviewOpen(false)}
        profileData={appDetail?.profile || null}
        tailoredProfileData={appDetail?.diff?.rich || appDetail?.renderedResume || null}
        jobTitle={selected?.role}
        user={authUser}
        initialTab={resumePreviewMode}
      />

      {undoReject.open && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 1200,
            background: '#2D2A3E',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
            fontSize: 13,
          }}
        >
          <span>Rejected</span>
          <button type="button"
            onClick={handleUndoReject}
            style={{
              border: 'none',
              background: '#fff',
              color: '#2D2A3E',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </div>
      )}
    </Page>
  );
};

export default ReviewPage;
