import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { profileAPI, tailoredProfileAPI } from '../services/api';
import { extractApiError } from '../utils/apiError';
import { parseLimitError } from '../utils/aiLimit';
import { replaceBullet, removeBullet } from '../utils/enhanceApply';
import {
  FlowDialog, PrimaryBtn, SecondaryBtn, Label, TextInput, Centered, Hint, ChangeCard, KeepBtn, ErrorText,
} from './flow/FlowLayout';

/**
 * Tailor for a Job, in three steps:
 *   Paste job - the posting's text.
 *   Match     - the code-computed match score (/job-match), the requirements
 *               the profile already evidences, and the missing ones the
 *               candidate can tap to say "I have this". Each tap rescores in
 *               code; nothing is added unless confirmed.
 *   Save      - the tailoring run, then its three most visible changes (title,
 *               summary, one key bullet) to keep or skip, and a name for the
 *               tailored copy. The main profile is never changed.
 */

const STEPS = ['Paste job', 'Match', 'Save'];
// /job-match refuses anything shorter: a score from a fragment looks
// authoritative and is arbitrary.
const MIN_CHARS = 200;
// Responsibilities carry no weight in the score, so they are not listed.
const UNSCORED_TYPES = new Set(['responsibility']);
// Years come from the dates on the roles; tapping cannot add them.
const UNCONFIRMABLE_TYPES = new Set(['experience_years']);

const PasteBox = styled.div`
  flex: 1;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  border: 1.5px solid ${p => (p.$focused ? '#5b5fd6' : '#e2e4ec')};
  border-radius: 18px;
  background: #fff;
  overflow: hidden;

  textarea {
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    padding: 16px;
    border: none;
    resize: none;
    outline: none;
    font: inherit;
    font-size: 16px;
    line-height: 1.5;
    color: #13152a;
    background: transparent;
    &::placeholder { color: #9ca3af; }
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-top: 1px solid #eceef4;
    font-size: 14px;
    color: ${p => (p.$enough ? '#16a34a' : '#9ca3af')};
  }

  .paste {
    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 12px;
    background: #f0f0fc;
    color: #4b4fc4;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }
`;

const PasteStep = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;

  p { margin: 0 2px; font-size: 14.5px; line-height: 1.45; color: #6b7280; }
`;

const Score = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid #e8e9f0;

  .num {
    flex-shrink: 0;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    color: ${p => (p.$score >= 75 ? '#16a34a' : p.$score >= 50 ? '#b7791f' : '#c2410c')};
    font-variant-numeric: tabular-nums;
  }
  .num small { font-size: 20px; }
  .text { font-size: 14.5px; line-height: 1.45; color: #4a4d63; }
  .text strong { display: block; color: #13152a; font-size: 16px; margin-bottom: 2px; }
`;

const ReqChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
`;

const ReqChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  max-width: 100%;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid ${p => (p.$tone === 'have' ? '#bfe5cc' : p.$on ? '#5b5fd6' : '#e2e4ec')};
  background: ${p => (p.$tone === 'have' ? '#ecf8f0' : p.$on ? '#f0f0fc' : '#fff')};
  color: ${p => (p.$tone === 'have' ? '#256b3d' : p.$on ? '#4b4fc4' : '#13152a')};
  font: inherit;
  font-size: 14.5px;
  font-weight: 600;
  text-align: left;
  cursor: ${p => (p.$tone === 'have' || p.disabled ? 'default' : 'pointer')};
  opacity: ${p => (p.disabled ? 0.55 : 1)};

  svg { font-size: 16px; flex-shrink: 0; }
  .tag { font-weight: 500; opacity: 0.7; }
`;

const Reason = styled.p`
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: #6b7280;
`;

const reqLabel = (r) => String(r.requirement || '').trim();

export default function TailorFlow({ open, onClose, profile, onSaved, onLimit, creditLabel = '1 credit' }) {
  const [step, setStep] = useState('paste');
  const [jobText, setJobText] = useState('');
  const [focused, setFocused] = useState(false);
  const [match, setMatch] = useState(null);
  const [matching, setMatching] = useState(false);
  const [confirmed, setConfirmed] = useState(new Set());
  const [score, setScore] = useState(null);
  const [tailored, setTailored] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [kept, setKept] = useState({});
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);
  const textRef = useRef(null);
  const rescoreRef = useRef(0);
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

  useEffect(() => {
    if (!open) return;
    setStep('paste');
    setJobText('');
    setMatch(null);
    setConfirmed(new Set());
    setScore(null);
    setTailored(null);
    setSuggestions([]);
    setError('');
  }, [open]);

  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [step]);

  const scoredReqs = useMemo(
    () => (match?.requirements || []).filter((r) => r && reqLabel(r) && !UNSCORED_TYPES.has(r.type)),
    [match]
  );
  const have = scoredReqs.filter((r) => r.coverage === 'strong' || r.coverage === 'partial');
  const missing = scoredReqs
    .filter((r) => r.coverage !== 'strong' && r.coverage !== 'partial')
    .sort((a, b) => (a.hardness === 'must' ? 0 : 1) - (b.hardness === 'must' ? 0 : 1));

  const fail = (err, fallback) => {
    const limit = parseLimitError(err);
    if (limit) { onLimit?.(limit); onClose?.(); return; }
    setError(extractApiError(err, fallback));
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setJobText(text);
    } catch (_) {
      // Permission refused: long-press paste still works in the box.
      textRef.current?.focus();
    }
  };

  const analyze = async () => {
    setError('');
    setMatching(true);
    setStep('match');
    try {
      const { data } = await profileAPI.jobMatch({ jobDescription: jobText.trim() });
      if (!data?.success || !data.data) throw new Error(data?.error || 'Could not score this job');
      setMatch(data.data);
      setScore(data.data.score);
      setName(String(data.data.jobTitle || '').trim());
    } catch (err) {
      setStep('paste');
      fail(err, 'Could not read this job description. Please try again.');
    } finally {
      setMatching(false);
    }
  };

  const toggle = (r) => {
    if (UNCONFIRMABLE_TYPES.has(r.type)) return;
    const next = new Set(confirmed);
    const key = reqLabel(r);
    if (next.has(key)) next.delete(key); else next.add(key);
    setConfirmed(next);
    // The score updates as you tap; the latest tap wins.
    const ticket = ++rescoreRef.current;
    profileAPI.jobMatchRescore({ requirements: match.requirements, components: match.components, confirmed: [...next] })
      .then(({ data }) => { if (ticket === rescoreRef.current && data?.success) setScore(data.score); })
      .catch(() => {});
  };

  const tailor = async () => {
    setError('');
    setStep('tailoring');
    const confirmedReqs = missing.filter((r) => confirmed.has(reqLabel(r)));
    try {
      const { data } = await profileAPI.tailorProfileForJob({
        jobDescription: jobText.trim(),
        jobTitle: match?.jobTitle || undefined,
        // Confirmed means "I have this; put it on the resume". Unconfirmed
        // requirements are not sent: they stay gaps in the tailored copy.
        gapSelections: confirmedReqs.length ? {
          acceptedGaps: confirmedReqs.map(reqLabel),
          skippedGaps: [],
          acceptedGapObjects: confirmedReqs.map((r) => ({
            skill: reqLabel(r),
            type: r.hardness === 'must' ? 'required' : 'nice_to_have',
            severity: r.hardness === 'must' ? 'critical' : 'nice_to_have',
            status: 'pending',
          })),
        } : undefined,
      });
      if (!data?.success) throw new Error(data?.error || 'Tailoring failed');
      setTailored(data.data);
      setSuggestions(data.suggestions || []);
      setKept(Object.fromEntries((data.suggestions || []).map((s) => [s.id, true])));
      if (!name) setName(String(data.data.jobTitle || data.data.title || '').trim());
      setStep('save');
    } catch (err) {
      setStep('match');
      fail(err, 'Tailoring failed. No credit was used. Please try again.');
    }
  };

  // The tailored copy, with every skipped suggestion put back to the original.
  const buildCopy = () => {
    const out = { ...tailored, experience: (tailored.experience || []).map((e) => ({ ...e })) };
    for (const s of suggestions) {
      if (kept[s.id]) continue;
      if (s.kind === 'title') out.title = s.before;
      else if (s.kind === 'summary') out.summary = s.before;
      else if (s.kind === 'bullet' && out.experience[s.index]) {
        const entry = out.experience[s.index];
        entry.description = s.added ? removeBullet(entry.description, s.bullet) : replaceBullet(entry.description, s.bullet, s.before);
      }
    }
    return out;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const copy = buildCopy();
      const jobTitle = name.trim() || match?.jobTitle || copy.title || 'Untitled position';
      await tailoredProfileAPI.save({
        jobTitle,
        companyName: '',
        tailoredData: {
          title: copy.title || profile?.title || '',
          summary: copy.summary || profile?.summary || '',
          skills: copy.skills || Object.values(profile?.skills || {}).flat(),
          experience: copy.experience?.length ? copy.experience : profile?.experience || [],
          education: profile?.education || [],
          projects: copy.projects || profile?.projects || [],
          location: profile?.location || '',
          phone: profile?.phone || '',
          linkedinUrl: profile?.linkedinUrl || '',
          githubUrl: profile?.githubUrl || '',
          matchAnalysis: copy.matchAnalysis || null,
        },
        matchScore: score,
        // What is still missing after the candidate's confirmations.
        skillGaps: missing
          .filter((r) => !confirmed.has(reqLabel(r)))
          .map((r) => ({ skill: reqLabel(r), severity: r.hardness === 'must' ? 'critical' : 'nice_to_have', status: 'pending' })),
      });
      onSaved?.(jobTitle);
    } catch (err) {
      setError(extractApiError(err, 'Could not save the tailored copy. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const enough = jobText.trim().length >= MIN_CHARS;
  const stepIndex = step === 'paste' ? 0 : step === 'match' ? 1 : 2;
  const subtitle = {
    paste: 'Paste the job description',
    match: 'See how you match',
    tailoring: 'Tailoring your resume',
    save: 'Review and save a tailored copy',
  }[step];

  const renderPaste = () => (
    <PasteStep>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <PasteBox $focused={focused} $enough={enough}>
        <textarea
          ref={textRef}
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Paste the full job description here"
          aria-label="Job description"
        />
        <div className="bar">
          <span>{Math.min(jobText.trim().length, 99999)}/{MIN_CHARS} characters minimum</span>
          {canPaste && <button type="button" className="paste" onClick={paste}>Paste</button>}
        </div>
      </PasteBox>
      <p>Include responsibilities and requirements. Your profile stays the same; we create a separate tailored copy.</p>
    </PasteStep>
  );

  const renderMatch = () => {
    if (matching || !match) {
      return (
        <Centered>
          <CircularProgress size={32} sx={{ color: '#5b5fd6' }} />
          <strong>Reading the job</strong>
          <span>Finding what it asks for and where your profile shows it.</span>
        </Centered>
      );
    }
    return (
      <>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <Score $score={score ?? 0}>
          <span className="num">{score}<small>%</small></span>
          <span className="text">
            <strong>{match.jobTitle || 'Your match'}</strong>
            {match.verdict || `You show ${have.length} of ${scoredReqs.length} things this job asks for.`}
          </span>
        </Score>
        {have.length > 0 && (
          <>
            <Label>Skills you have</Label>
            <ReqChips>
              {have.map((r) => (
                <ReqChip key={reqLabel(r)} as="span" $tone="have">
                  <CheckIcon />{reqLabel(r)}{r.coverage === 'partial' && <span className="tag">· partly</span>}
                </ReqChip>
              ))}
            </ReqChips>
          </>
        )}
        {missing.length > 0 && (
          <>
            <Label>Missing · tap any you have</Label>
            <ReqChips>
              {missing.map((r) => {
                const key = reqLabel(r);
                const on = confirmed.has(key);
                const locked = UNCONFIRMABLE_TYPES.has(r.type);
                return (
                  <ReqChip
                    key={key}
                    type="button"
                    $on={on}
                    disabled={locked}
                    aria-pressed={on}
                    title={locked ? 'Comes from the dates on your roles' : undefined}
                    onClick={() => toggle(r)}
                  >
                    {on && <CheckIcon />}{key}{r.hardness === 'must' && <span className="tag">· required</span>}
                  </ReqChip>
                );
              })}
            </ReqChips>
          </>
        )}
        <Hint>Only skills you confirm are added to the tailored copy.</Hint>
      </>
    );
  };

  const renderSave = () => {
    if (step === 'tailoring') {
      return (
        <Centered>
          <CircularProgress size={32} sx={{ color: '#5b5fd6' }} />
          <strong>Tailoring your resume</strong>
          <span>This takes about a minute. Your main profile isn't changed.</span>
        </Centered>
      );
    }
    return (
      <>
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <Hint>
          {suggestions.length
            ? 'The changes that matter most. Keep or skip each one; the rest of the copy is tailored too.'
            : 'Your resume already reads well for this job, so the copy keeps your wording.'}
        </Hint>
        {suggestions.map((s) => {
          const isKept = !!kept[s.id];
          return (
            <ChangeCard key={s.id} $kept={isKept}>
              <div className="head">
                <span className="label">{s.label}</span>
                <KeepBtn type="button" $kept={isKept} aria-pressed={isKept} onClick={() => setKept((p) => ({ ...p, [s.id]: !p[s.id] }))}>
                  {isKept ? <><CheckIcon />Keep</> : 'Skip'}
                </KeepBtn>
              </div>
              {s.before ? <p className="before">{s.before}</p> : <Reason style={{ margin: '0 0 10px' }}>Added line</Reason>}
              <p className="after">{s.after}</p>
              {s.reason && <Reason>{s.reason}</Reason>}
            </ChangeCard>
          );
        })}
        <Label as="label" htmlFor="tailor-name" style={{ marginTop: 22 }}>Save as</Label>
        <TextInput
          id="tailor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Frontend Engineer at Stripe"
          maxLength={120}
        />
      </>
    );
  };

  let footer = null;
  if (step === 'paste') {
    footer = <PrimaryBtn type="button" onClick={analyze} disabled={!enough}>Analyze match</PrimaryBtn>;
  } else if (step === 'match' && match && !matching) {
    footer = (
      <>
        <SecondaryBtn type="button" onClick={() => setStep('paste')}>Back</SecondaryBtn>
        <PrimaryBtn type="button" onClick={tailor}>Tailor resume{creditLabel ? ` · ${creditLabel}` : ''}</PrimaryBtn>
      </>
    );
  } else if (step === 'save') {
    footer = (
      <PrimaryBtn type="button" onClick={save} disabled={saving || !name.trim()}>
        {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save tailored copy'}
      </PrimaryBtn>
    );
  }

  return (
    <FlowDialog
      open={open}
      onClose={onClose}
      title="Tailor for a Job"
      subtitle={subtitle}
      steps={STEPS}
      stepIndex={stepIndex}
      busy={matching || step === 'tailoring' || saving}
      footer={footer}
      bodyRef={bodyRef}
    >
      {step === 'paste' && renderPaste()}
      {step === 'match' && renderMatch()}
      {(step === 'tailoring' || step === 'save') && renderSave()}
    </FlowDialog>
  );
}
