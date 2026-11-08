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

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', soft: '#f0f0fc', bg: '#f3f4f8', bad: '#b42318' };
const MODES = [
  { id: 'job', label: 'I have a job' },
  { id: 'tailored', label: 'I have a tailored resume' },
  { id: 'role', label: 'I am preparing for a level' },
];

const Page = styled.div`
  min-height: 100%; background: ${C.bg}; padding: 16px 16px 72px; color: ${C.ink};
  .wrap { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  h1 { margin: 8px 0 0; font-size: 24px; line-height: 1.2; }
  .lead { margin: 6px 0 0; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
  @media (min-width: 900px) { padding: 32px 24px 96px; }
`;
const Tabs = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 8px;
  @media (min-width: 700px) { grid-template-columns: repeat(3, 1fr); }
`;
const Tab = styled.button`
  min-height: 52px; padding: 10px 14px; border-radius: 14px; font: inherit; font-size: 15.5px; font-weight: 700; text-align: left; cursor: pointer;
  border: 1.5px solid ${(p) => (p.$on ? C.brand : '#e2e4ec')};
  background: ${(p) => (p.$on ? C.soft : '#fff')};
  color: ${(p) => (p.$on ? C.brand : C.ink)};
`;
const Section = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 16px;
  h2 { margin: 0 0 4px; font-size: 18px; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  label.field { display: block; margin-top: 12px; font-size: 14px; font-weight: 700; }
  .hint { margin: 6px 0 0; font-size: 13.5px; color: ${C.muted}; line-height: 1.4; }
  .err { margin: 8px 0 0; font-size: 14px; color: ${C.bad}; line-height: 1.4; }
  .summary { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: ${C.soft}; font-size: 15px; line-height: 1.45; }
`;
const Input = styled.input`
  width: 100%; box-sizing: border-box; min-height: 48px; margin-top: 6px; padding: 0 14px; font: inherit; font-size: 16px; color: ${C.ink};
  border: 1.5px solid ${(p) => (p.$bad ? C.bad : '#d5d8e3')}; border-radius: 12px; background: #fff;
  &:focus { outline: none; border-color: ${(p) => (p.$bad ? C.bad : C.brand)}; }
`;
const Select = styled.select`
  width: 100%; box-sizing: border-box; min-height: 48px; margin-top: 6px; padding: 0 12px; font: inherit; font-size: 16px; color: ${C.ink};
  border: 1.5px solid ${(p) => (p.$bad ? C.bad : '#d5d8e3')}; border-radius: 12px; background: #fff;
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 20px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 14px;
  width: 100%;
  border: ${(p) => (p.$ghost ? '1.5px solid #e2e4ec' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : '#fff')};
  &:disabled { opacity: 0.5; cursor: default; }
  @media (min-width: 700px) { width: auto; }
`;
const Rows = styled.ul`
  list-style: none; margin: 0; padding: 0;
  li { border-top: 1px solid ${C.line}; }
  li:first-child { border-top: none; }
  button { width: 100%; text-align: left; display: block; min-height: 56px; padding: 12px 0; border: none; background: none; font: inherit; cursor: pointer; }
  .t { font-size: 16px; font-weight: 700; color: ${C.ink}; }
  .m { margin-top: 3px; font-size: 14px; color: ${C.muted}; line-height: 1.4; }
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
`;

function Upgrade({ onPlans }) {
  return (
    <Center>
      <h2>Interview prep is a Pro feature</h2>
      <p>Pro and Pro Plus read what candidates recently shared about a role, then plan your prep around your own experience and gaps.</p>
      <Btn type="button" onClick={onPlans} style={{ marginTop: 0 }}>See plans</Btn>
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

  if (stage === 'confirm' && job) {
    return (
      <Section aria-label="Confirm the job">
        <h2>Is this right?</h2>
        <p className="sub">Fix anything we got wrong, then start.</p>
        {job.summary && <p className="summary">{job.summary}</p>}
        <label className="field" htmlFor="ip-company">Company</label>
        <Input id="ip-company" value={form.company} onChange={set('company')} $bad={touched && !!v.errors.company} aria-invalid={touched && !!v.errors.company} aria-required="true" placeholder="Company name" />
        {(touched || !job.company) && v.errors.company && <p className="err" role="alert">{v.errors.company}</p>}
        <label className="field" htmlFor="ip-role">Role</label>
        <Input id="ip-role" value={form.role} onChange={set('role')} $bad={touched && !!v.errors.role} aria-invalid={touched && !!v.errors.role} placeholder="Job title" />
        {touched && v.errors.role && <p className="err" role="alert">{v.errors.role}</p>}
        <label className="field" htmlFor="ip-level">Level</label>
        <Select id="ip-level" value={form.level} onChange={set('level')}>
          <option value="">Not sure</option>
          {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </Select>
        {msg && <p className="err" role="alert">{msg}</p>}
        <Btn type="button" onClick={begin} disabled={busy}>Start my prep</Btn>
        <Btn type="button" $ghost onClick={() => { setStage('input'); setMsg(''); }} disabled={busy} style={{ marginTop: 8 }}>Use a different job</Btn>
      </Section>
    );
  }
  return (
    <Section aria-label="Start from a job">
      <h2>I have a job</h2>
      <p className="sub">We read the job, then research what candidates reported for it.</p>
      <NoteField
        multiline
        value={text}
        onChange={setText}
        maxLength={8000}
        label="Paste a job link or the job description"
        placeholder="Paste a job link or the job description"
        hints="job description, job link"
      />
      <p className="hint">Paste a job link or the job description.</p>
      {msg && <p className="err" role="alert">{msg}</p>}
      <Btn type="button" onClick={read} disabled={busy || !text.trim()}>{busy ? 'Reading the job' : 'Read the job'}</Btn>
    </Section>
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
    <Section aria-label="Start from a tailored resume">
      <h2>I have a tailored resume</h2>
      <p className="sub">Pick the resume you tailored for the job.</p>
      {state.loading && <div style={{ padding: '8px 0' }}><CircularProgress size={22} /></div>}
      {!state.loading && state.error && <p className="sub" style={{ marginBottom: 0 }}>We could not load your resumes just now. Please try again in a moment.</p>}
      {!state.loading && !state.error && state.rows.length === 0 && (
        <p className="sub" style={{ marginBottom: 0 }}>You have no tailored resumes yet. Tailor one from a job, or start from a job link above.</p>
      )}
      {state.rows.length > 0 && (
        <Rows>
          {state.rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => navigate(`/interview-prep/${r.id}`)}>
                <div className="t">{r.company || r.title}</div>
                <div className="m">{[r.company ? r.title : '', monthYear(r.date)].filter(Boolean).join(', ')}</div>
              </button>
            </li>
          ))}
        </Rows>
      )}
    </Section>
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
    <Section aria-label="Start from a level">
      <h2>I am preparing for a level</h2>
      <p className="sub">No company needed. We research what candidates for that role and level report, then plan around your gaps.</p>
      <label className="field" htmlFor="ip-r-role">Role</label>
      <Input id="ip-r-role" value={form.role} onChange={set('role')} placeholder="Full stack frontend developer" $bad={touched && !!v.errors.role} aria-invalid={touched && !!v.errors.role} aria-required="true" />
      {touched && v.errors.role && <p className="err" role="alert">{v.errors.role}</p>}
      <label className="field" htmlFor="ip-r-level">Level</label>
      <Select id="ip-r-level" value={form.level} onChange={set('level')} $bad={touched && !!v.errors.level} aria-required="true">
        {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </Select>
      <label className="field" htmlFor="ip-r-company">Company (optional)</label>
      <Input id="ip-r-company" value={form.company} onChange={set('company')} placeholder="Leave empty to research across companies" />
      {msg && <p className="err" role="alert">{msg}</p>}
      <Btn type="button" onClick={go} disabled={busy}>Plan my prep</Btn>
    </Section>
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

  return (
    <Page>
      <div className="wrap">
        <header>
          <h1>Interview prep</h1>
          <p className="lead">Tell us what you are getting ready for. We find what candidates reported, then prepare you from your own experience.</p>
        </header>

        {(!paid || locked) ? <Upgrade onPlans={() => navigate('/pricing')} /> : (
          <>
            <Tabs role="tablist" aria-label="How do you want to start">
              {MODES.map((m) => (
                <Tab key={m.id} type="button" role="tab" id={`ip-tab-${m.id}`} aria-selected={mode === m.id} aria-controls="ip-panel" $on={mode === m.id} onClick={() => setMode(m.id)}>
                  {m.label}
                </Tab>
              ))}
            </Tabs>
            <div role="tabpanel" id="ip-panel" aria-labelledby={`ip-tab-${mode}`}>
              {mode === 'job' && <JobPath onStart={begin} busy={busy} setBusy={setBusy} />}
              {mode === 'tailored' && <TailoredPath navigate={navigate} />}
              {mode === 'role' && <RolePath onStart={begin} busy={busy} />}
            </div>

            <Section aria-label="Your preps">
              <h2>Your preps</h2>
              {mine.loading && <div style={{ padding: '8px 0' }}><CircularProgress size={22} /></div>}
              {!mine.loading && mine.error && <p className="sub" style={{ marginBottom: 0 }}>We could not load your preps just now.</p>}
              {!mine.loading && !mine.error && mine.rows.length === 0 && (
                <p className="sub" style={{ marginBottom: 0 }}>Nothing here yet. Start one above and it will be saved for you.</p>
              )}
              {mine.rows.length > 0 && (
                <Rows>
                  {mine.rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => navigate(`/interview-prep/prep/${encodeURIComponent(r.id)}`)}>
                        <div className="t">{r.title}</div>
                        <div className="m">{[r.sub, r.pending ? 'Researching' : r.researched, r.stories].filter(Boolean).join(', ')}</div>
                      </button>
                    </li>
                  ))}
                </Rows>
              )}
            </Section>
          </>
        )}
      </div>
    </Page>
  );
}
