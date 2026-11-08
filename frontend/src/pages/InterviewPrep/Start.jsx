import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { tailoredProfileAPI } from '@/services/api';
import { interviewPrepAPI } from '@/services/interviewPrep';
import NoteField from '@/components/flow/NoteField';
import { monthYear } from './prepLogic';
import {
  LEVELS, DEFAULT_LEVEL, isPaidUser, validateJobInput, parseJobBody, normalizeJob, validateConfirm, jobStartBody,
  validateRoleForm, roleStartBody, tailoredRows, prepRows, apiErrorState,
} from './startLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', brandText: '#4b4fc4', soft: '#f0f0fc', bg: '#f4f5fa', bad: '#b42318', ok: '#1f8f55', body: '#4a4d63', field: '#d9dbe5' };
const MODES = [
  { id: 'job', label: 'I have a job', line: 'Paste the link or the job description.', icon: 'link' },
  { id: 'tailored', label: 'I have a tailored resume', line: 'Use one you already made for a job.', icon: 'doc' },
  { id: 'role', label: 'I am preparing for a level', line: 'A role and level, no company needed.', icon: 'target' },
];

const Page = styled.div`
  min-height: 100%; background: ${C.bg}; padding: 24px 16px 72px; color: ${C.ink};
  .wrap { max-width: 1200px; margin: 0 auto; }
  .head { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
  .chip { align-self: flex-start; padding: 4px 12px; border-radius: 999px; background: #ecedfb; color: ${C.brandText}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
  h1 { margin: 0; font-size: 30px; line-height: 1.12; font-weight: 800; letter-spacing: -0.02em; }
  .lead { margin: 0; font-size: 16px; line-height: 1.5; color: ${C.body}; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; margin-top: 24px; align-items: start; }
  .main, .rail { min-width: 0; display: flex; flex-direction: column; gap: 20px; }
  @media (min-width: 700px) {
    padding: 40px 32px 80px;
    h1 { font-size: 40px; }
    .lead { font-size: 18px; }
    .cols { margin-top: 36px; gap: 24px; }
    .main, .rail { gap: 24px; }
  }
  @media (min-width: 1040px) {
    padding: 48px 40px 96px;
    h1 { font-size: 44px; }
    .cols { grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); }
  }
`;
const Card = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  .sub { margin: 0 0 16px; font-size: 15px; color: ${C.muted}; line-height: 1.45; }
  .sub.flush { margin-bottom: 0; }
  .err { margin: 8px 0 0; font-size: 14px; color: ${C.bad}; line-height: 1.4; }
  @media (min-width: 700px) { padding: 28px; }
`;
const RailCard = styled(Card)`
  padding: 20px;
  h2 { margin: 0; font-size: 18px; }
  .top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
  .count { font-size: 13px; color: ${C.muted}; }
  @media (min-width: 700px) { padding: 24px; }
`;
const Tiles = styled.div`
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px;
  @media (min-width: 700px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;
const Tile = styled.button`
  display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-height: 44px; padding: ${(p) => (p.$on ? '15px' : '16px')}; border-radius: 16px; font: inherit; text-align: left; cursor: pointer; color: ${C.ink};
  border: ${(p) => (p.$on ? `2px solid ${C.brand}` : `1.5px solid ${C.line}`)};
  background: ${(p) => (p.$on ? C.soft : '#fff')};
  &:focus-visible { outline: 3px solid rgba(91, 95, 214, 0.35); outline-offset: 2px; }
  .ico { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ${(p) => (p.$on ? C.brand : C.soft)}; color: ${(p) => (p.$on ? '#fff' : C.brandText)}; flex: none; }
  .tt { font-size: 16px; font-weight: 700; }
  .tl { font-size: 13.5px; line-height: 1.4; color: ${C.body}; }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  @media (max-width: 699px) {
    flex-direction: row; align-items: center; gap: 12px;
  }
`;
const Panel = styled.div`
  margin-top: 20px;
  .lbl { display: block; margin: 0; font-size: 14px; font-weight: 600; }
  label.field { display: block; margin-top: 14px; font-size: 14px; font-weight: 600; }
  .actions { display: flex; align-items: center; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
  .helper { font-size: 14px; color: ${C.muted}; line-height: 1.4; }
  .err { margin: 8px 0 0; font-size: 14px; color: ${C.bad}; line-height: 1.4; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 12px; }
  @media (min-width: 700px) { .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;
const NoteWrap = styled.div`
  margin-top: 8px;
  && > div { margin-top: 0; }
  && textarea { min-height: 120px; padding: 14px 64px 14px 16px; border: 1.5px solid ${C.field}; border-style: solid; border-radius: 14px; background: #f8f9fc; }
  && textarea:focus { border-color: ${C.brand}; background: #fff; }
  && button { top: auto; bottom: 10px; right: 10px; width: 44px; height: 44px; border-radius: 12px; }
`;
const Confirm = styled.div`
  margin-top: 24px; border: 1.5px dashed #c9cbe6; border-radius: 16px; padding: 16px; background: #fbfbff;
  .ok { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 14px; font-weight: 700; color: ${C.ok}; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .cap { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${C.muted}; }
  .summary { margin: 12px 0 0; font-size: 14.5px; line-height: 1.5; color: ${C.body}; }
  .err { margin: 8px 0 0; font-size: 14px; color: ${C.bad}; line-height: 1.4; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
  @media (min-width: 700px) { padding: 20px; .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
`;
const Input = styled.input`
  width: 100%; box-sizing: border-box; min-height: 48px; margin-top: 6px; padding: 0 14px; font: inherit; font-size: 16px; color: ${C.ink};
  border: 1.5px solid ${(p) => (p.$bad ? C.bad : C.field)}; border-radius: 12px; background: #fff;
  &:focus { outline: none; border-color: ${(p) => (p.$bad ? C.bad : C.brand)}; }
  .cap + & { margin-top: 0; }
`;
const Select = styled.select`
  width: 100%; box-sizing: border-box; min-height: 48px; margin-top: 6px; padding: 0 12px; font: inherit; font-size: 16px; color: ${C.ink};
  border: 1.5px solid ${(p) => (p.$bad ? C.bad : C.field)}; border-radius: 12px; background: #fff;
  &:focus { outline: none; border-color: ${C.brand}; }
  .cap + & { margin-top: 0; }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 24px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: ${(p) => (p.$flush ? '0' : '14px')};
  width: 100%;
  border: ${(p) => (p.$ghost ? `1.5px solid ${C.line}` : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : '#fff')};
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 3px solid rgba(91, 95, 214, 0.35); outline-offset: 2px; }
  @media (min-width: 700px) { width: auto; }
`;
const PickRows = styled.ul`
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px;
  button { width: 100%; text-align: left; display: block; min-height: 56px; padding: 10px 12px; border: none; border-radius: 14px; background: none; font: inherit; cursor: pointer; }
  button:hover { background: #f8f9fc; }
  .t, .m { display: block; }
  .t { font-size: 15px; font-weight: 700; color: ${C.ink}; }
  .m { margin-top: 3px; font-size: 13px; color: ${C.muted}; line-height: 1.4; }
`;
const PrepList = styled.ul`
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px;
  button { width: 100%; display: flex; gap: 12px; align-items: center; min-height: 64px; padding: 12px; border: none; border-radius: 14px; background: none; font: inherit; text-align: left; cursor: pointer; color: ${C.ink}; }
  button:hover { background: #f8f9fc; }
  button:focus-visible { outline: 3px solid rgba(91, 95, 214, 0.35); outline-offset: -2px; }
  .av { flex: none; width: 40px; height: 40px; border-radius: 10px; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .mid { flex: 1; min-width: 0; }
  .nm, .rl, .ct { display: block; }
  .nm { font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rl { font-size: 13px; color: ${C.muted}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .end { flex: none; text-align: right; }
  .pill { display: inline-block; margin-bottom: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #fdf1e4; color: #8a4a08; }
  .good { background: #e5f6ec; color: #1f7a49; }
  .thin { background: #fdf1e4; color: #8a4a08; }
  .ct { font-size: 12px; color: ${C.muted}; margin-top: 4px; }
`;
const Steps = styled.ol`
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px;
  li { display: flex; gap: 12px; }
  .n { flex: none; width: 28px; height: 28px; border-radius: 50%; background: ${C.soft}; color: ${C.brandText}; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .st { font-size: 15px; font-weight: 700; }
  .sd { font-size: 14px; line-height: 1.45; color: ${C.body}; }
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 28px 20px; text-align: center; max-width: 640px;
  h2 { margin: 0 0 8px; font-size: 20px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: ${C.body}; }
`;

const HOW = [
  { t: 'We research it', d: 'Reports from Blind, Glassdoor, LeetCode and interview sites, with dates and links.' },
  { t: 'We read your experience', d: 'Questions that match your profile, and the gaps to work on.' },
  { t: 'You build your stories', d: 'Real examples from your work, in your own words.' },
  { t: 'You practice out loud', d: 'Rehearse with the voice coach before the real thing.' },
];

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'link') return <svg {...common}><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5" /></svg>;
  if (name === 'doc') return <svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>;
  if (name === 'check') return <svg {...common} strokeWidth={2.4}><path d="M5 12l4.5 4.5L19 7" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>;
}

function Upgrade({ onPlans }) {
  return (
    <Center>
      <h2>Interview prep is a Pro feature</h2>
      <p>Pro and Pro Plus read what candidates recently shared about a role, then plan your prep around your own experience and gaps.</p>
      <Btn type="button" $flush onClick={onPlans}>See plans</Btn>
    </Center>
  );
}

function JobPath({ onStart, busy, setBusy }) {
  const [text, setText] = useState('');
  const [stage, setStage] = useState('input'); // input | confirm
  const [msg, setMsg] = useState('');
  const [job, setJob] = useState(null);
  const [form, setForm] = useState({ company: '', role: '', level: '' });
  const [touched, setTouched] = useState(false);

  const read = async () => {
    const check = validateJobInput(text);
    if (!check.ok) { setMsg(check.error); return; }
    setMsg(''); setBusy(true);
    try {
      const res = await interviewPrepAPI.parseJob(parseJobBody(check));
      const j = normalizeJob(res.data?.job);
      setJob(j); setForm({ company: j.company, role: j.role, level: j.level }); setTouched(false); setStage('confirm');
    } catch (e) {
      const st = apiErrorState(e);
      if (st.kind === 'upgrade') setMsg('Interview prep is a Pro feature. See plans to continue.');
      else setMsg(st.message || 'We could not read that job. Paste the job description instead.');
    } finally { setBusy(false); }
  };

  const begin = () => {
    setTouched(true);
    if (!validateConfirm(form).ok) return;
    onStart(jobStartBody(form, job?.source), setMsg);
  };
  const v = validateConfirm(form);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const confirming = stage === 'confirm' && job;

  return (
    <Panel aria-label="Start from a job">
      <span className="lbl">Paste a job link or the job description</span>
      <NoteWrap>
        <NoteField
          multiline
          value={text}
          onChange={setText}
          maxLength={8000}
          label="Paste a job link or the job description"
          placeholder="https://jobs.example.com/staff-frontend-engineer"
          hints="job description, job link"
        />
      </NoteWrap>
      <div className="actions">
        <Btn type="button" $flush onClick={read} disabled={busy || !text.trim()}>{busy ? 'Reading the job' : 'Read the job'}</Btn>
        <span className="helper">Takes a few seconds.</span>
      </div>
      {!confirming && msg && <p className="err" role="alert">{msg}</p>}

      {confirming && (
        <Confirm aria-label="Confirm the job">
          <div className="ok"><Icon name="check" size={18} /><span>We read the job. Check it is right.</span></div>
          <div className="grid">
            <div>
              <label className="cap" htmlFor="ip-company">Company</label>
              <Input id="ip-company" value={form.company} onChange={set('company')} $bad={touched && !!v.errors.company} aria-invalid={touched && !!v.errors.company} aria-required="true" placeholder="Company name" />
              {(touched || !job.company) && v.errors.company && <p className="err" role="alert">{v.errors.company}</p>}
            </div>
            <div>
              <label className="cap" htmlFor="ip-role">Role</label>
              <Input id="ip-role" value={form.role} onChange={set('role')} $bad={touched && !!v.errors.role} aria-invalid={touched && !!v.errors.role} placeholder="Job title" />
              {touched && v.errors.role && <p className="err" role="alert">{v.errors.role}</p>}
            </div>
            <div>
              <label className="cap" htmlFor="ip-level">Level</label>
              <Select id="ip-level" value={form.level} onChange={set('level')}>
                <option value="">Not sure</option>
                {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </Select>
            </div>
          </div>
          {job.summary && <p className="summary">{job.summary}</p>}
          {msg && <p className="err" role="alert">{msg}</p>}
          <div className="row">
            <Btn type="button" $flush onClick={begin} disabled={busy}>Start my prep</Btn>
            <Btn type="button" $flush $ghost onClick={() => { setStage('input'); setMsg(''); }} disabled={busy}>Use a different job</Btn>
          </div>
        </Confirm>
      )}
    </Panel>
  );
}

function TailoredPath({ navigate }) {
  const [state, setState] = useState({ loading: true, rows: [], error: false });
  useEffect(() => {
    let alive = true;
    tailoredProfileAPI.getAll()
      .then((res) => { if (alive) setState({ loading: false, rows: tailoredRows(res.data), error: false }); })
      .catch(() => { if (alive) setState({ loading: false, rows: [], error: true }); });
    return () => { alive = false; };
  }, []);
  return (
    <Panel aria-label="Start from a tailored resume">
      <span className="lbl">Pick the resume you tailored for the job.</span>
      {state.loading && <div style={{ padding: '12px 0' }}><CircularProgress size={22} /></div>}
      {!state.loading && state.error && <p className="helper" style={{ marginTop: 8 }}>We could not load your resumes just now. Please try again in a moment.</p>}
      {!state.loading && !state.error && state.rows.length === 0 && (
        <p className="helper" style={{ marginTop: 8 }}>You have no tailored resumes yet. Tailor one from a job, or start from a job link.</p>
      )}
      {state.rows.length > 0 && (
        <PickRows style={{ marginTop: 8 }}>
          {state.rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/interview-prep/${r.id}`)}>
                <span className="t">{r.company || r.title}</span>
                <span className="m">{[r.company ? r.title : '', monthYear(r.date)].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </PickRows>
      )}
    </Panel>
  );
}

function RolePath({ onStart, busy }) {
  const [form, setForm] = useState({ role: '', level: DEFAULT_LEVEL, company: '' });
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState('');
  const v = validateRoleForm(form);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = () => {
    setTouched(true);
    if (!v.ok) return;
    onStart(roleStartBody(form), setMsg);
  };
  return (
    <Panel aria-label="Start from a level">
      <span className="lbl">No company needed. We research what candidates for that role and level report, then plan around your gaps.</span>
      <label className="field" htmlFor="ip-r-role">Role</label>
      <Input id="ip-r-role" value={form.role} onChange={set('role')} placeholder="Full stack frontend developer" $bad={touched && !!v.errors.role} aria-invalid={touched && !!v.errors.role} aria-required="true" />
      {touched && v.errors.role && <p className="err" role="alert">{v.errors.role}</p>}
      <div className="grid two">
        <div>
          <label className="field" htmlFor="ip-r-level">Level</label>
          <Select id="ip-r-level" value={form.level} onChange={set('level')} $bad={touched && !!v.errors.level} aria-required="true">
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="field" htmlFor="ip-r-company">Company (optional)</label>
          <Input id="ip-r-company" value={form.company} onChange={set('company')} placeholder="Leave empty to research across companies" />
        </div>
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
      <Btn type="button" onClick={go} disabled={busy}>Plan my prep</Btn>
    </Panel>
  );
}

export default function Start() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const paid = isPaidUser(user);
  const [mode, setMode] = useState('job');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mine, setMine] = useState({ loading: true, rows: [], error: false });

  useEffect(() => {
    if (!paid) return undefined;
    let alive = true;
    interviewPrepAPI.mine()
      .then((res) => { if (alive) setMine({ loading: false, rows: prepRows(res.data?.preps), error: false }); })
      .catch(() => { if (alive) setMine({ loading: false, rows: [], error: true }); });
    return () => { alive = false; };
  }, [paid]);

  const begin = useCallback(async (body, showError) => {
    setBusy(true); showError('');
    try {
      const res = await interviewPrepAPI.start(body.company, body.jobTitle, false, { level: body.level, source: body.source });
      const id = res.data?.id;
      if (!id) { showError('Something went wrong on our side. Please try again.'); return; }
      navigate(`/interview-prep/prep/${encodeURIComponent(id)}`);
    } catch (e) {
      const st = apiErrorState(e);
      if (st.kind === 'upgrade') setLocked(true);
      else if (st.kind === 'limit') showError('You have used this month’s interview research. Your allowance renews next month.');
      else if (st.kind === 'unavailable') showError('Interview research is not available yet. We will turn it on soon.');
      else showError(st.message || 'Something went wrong on our side. Please try again.');
    } finally { setBusy(false); }
  }, [navigate]);

  const gated = !paid || locked;

  return (
    <Page>
      <div className="wrap">
        <header className="head">
          <span className="chip">PRO</span>
          <h1>Get ready for the interview</h1>
          <p className="lead">Tell us what you are preparing for. We find what candidates reported, then prepare you from your own experience.</p>
        </header>

        {gated ? (
          <div style={{ marginTop: 24 }}><Upgrade onPlans={() => navigate('/pricing')} /></div>
        ) : (
          <div className="cols">
            <div className="main">
              <Card aria-label="What are you preparing for">
                <h2>What are you preparing for?</h2>
                <p className="sub">Pick the one that fits. You can start another any time.</p>
                <Tiles role="tablist" aria-label="How do you want to start">
                  {MODES.map((m) => (
                    <Tile key={m.id} type="button" role="tab" id={`ip-tab-${m.id}`} aria-selected={mode === m.id} aria-controls="ip-panel" $on={mode === m.id} onClick={() => setMode(m.id)}>
                      <span className="ico"><Icon name={m.icon} /></span>
                      <span className="txt">
                        <span className="tt">{m.label}</span>
                        <span className="tl">{m.line}</span>
                      </span>
                    </Tile>
                  ))}
                </Tiles>
                <div role="tabpanel" id="ip-panel" aria-labelledby={`ip-tab-${mode}`}>
                  {mode === 'job' && <JobPath onStart={begin} busy={busy} setBusy={setBusy} />}
                  {mode === 'tailored' && <TailoredPath navigate={navigate} />}
                  {mode === 'role' && <RolePath onStart={begin} busy={busy} />}
                </div>
              </Card>
            </div>

            <div className="rail">
              <RailCard aria-label="Your preps">
                <div className="top">
                  <h2>Your preps</h2>
                  {mine.rows.length > 0 && <span className="count">{`${mine.rows.length} saved`}</span>}
                </div>
                {mine.loading && <div style={{ padding: '8px 0' }}><CircularProgress size={22} /></div>}
                {!mine.loading && mine.error && <p className="sub flush">We could not load your preps just now.</p>}
                {!mine.loading && !mine.error && mine.rows.length === 0 && (
                  <p className="sub flush">Nothing here yet. Start one and it will be saved for you.</p>
                )}
                {mine.rows.length > 0 && (
                  <PrepList>
                    {mine.rows.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => navigate(`/interview-prep/prep/${encodeURIComponent(r.id)}`)}>
                          <span className="av" style={{ background: r.isRole ? C.ink : r.color }}>
                            {r.isRole ? <Icon name="target" /> : r.initial}
                          </span>
                          <span className="mid">
                            <span className="nm">{r.title}</span>
                            {r.sub && <span className="rl">{r.sub}</span>}
                          </span>
                          <span className="end">
                            {r.pending && <span className="pill">Researching</span>}
                            <span className="ct">{r.stories}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </PrepList>
                )}
              </RailCard>

              <RailCard aria-label="How it works">
                <div className="top"><h2>How it works</h2></div>
                <Steps>
                  {HOW.map((h, i) => (
                    <li key={h.t}>
                      <span className="n">{String(i + 1)}</span>
                      <div><div className="st">{h.t}</div><div className="sd">{h.d}</div></div>
                    </li>
                  ))}
                </Steps>
              </RailCard>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
