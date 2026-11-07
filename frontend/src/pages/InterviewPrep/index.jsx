import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { tailoredProfileAPI } from '@/services/api';
import { interviewPrepAPI } from '@/services/interviewPrep';
import Stories from './Stories';
import { companyOf } from '@/components/tailored/tailoredModel';
import {
  CATEGORIES, filterQuestions, categoryCounts, monthYear, reportedBy, sourcesFor, safeUrl, pollExpired, progressStep, companyFromUrl, POLL_MS,
} from './prepLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', soft: '#f0f0fc', bg: '#f3f4f8' };
const STEPS = ['Searching recent interview reports', 'Reading the sources', 'Grouping the questions', 'Checking dates'];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
CAT_LABEL.other = 'Other';

const Page = styled.div`
  min-height: 100%;
  background: ${C.bg};
  padding: 16px 16px 72px;
  color: ${C.ink};
  .wrap { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 900px) { padding: 32px 24px 96px; }
`;
const Back = styled.button`
  align-self: flex-start; border: none; background: none; padding: 8px 0; min-height: 44px;
  font: inherit; font-size: 15px; font-weight: 600; color: ${C.brand}; cursor: pointer;
`;
const Head = styled.header`
  h1 { margin: 0; font-size: 24px; line-height: 1.2; }
  .role { margin-top: 4px; font-size: 16px; color: #4a4d63; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 8px; font-size: 14px; color: ${C.muted}; }
`;
const TextBtn = styled.button`
  border: none; background: none; padding: 10px 0; min-height: 44px; font: inherit; font-size: 14.5px; font-weight: 700;
  color: ${C.brand}; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 20px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #e2e4ec' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : '#fff')};
`;
const Section = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 16px;
  h2 { margin: 0 0 4px; font-size: 18px; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  p { margin: 0; font-size: 16px; line-height: 1.5; }
`;
const Note = styled.div`
  margin-top: 12px; padding: 10px 12px; border-radius: 12px; font-size: 14.5px; line-height: 1.45;
  background: #fdf1e4; color: #8a4a08;
`;
const Rounds = styled.ol`
  list-style: none; margin: 12px 0 0; padding: 0;
  li { position: relative; padding: 0 0 16px 28px; border-left: 2px solid ${C.line}; margin-left: 7px; }
  li:last-child { border-left-color: transparent; padding-bottom: 0; }
  li::before { content: ''; position: absolute; left: -8px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: ${C.brand}; border: 3px solid #fff; box-shadow: 0 0 0 1px ${C.brand}; }
  .name { font-size: 16px; font-weight: 700; }
  .fmt { font-size: 14px; color: ${C.brand}; font-weight: 600; margin-top: 2px; }
  .notes { margin-top: 4px; font-size: 15px; line-height: 1.45; color: #3b3e52; }
`;
const Chips = styled.div`
  display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 12px;
  @media (max-width: 600px) { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
`;
const Chip = styled.button`
  flex-shrink: 0; min-height: 40px; padding: 0 14px; border-radius: 999px; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer;
  border: 1.5px solid ${(p) => (p.$on ? C.brand : '#e2e4ec')};
  background: ${(p) => (p.$on ? C.soft : '#fff')};
  color: ${(p) => (p.$on ? C.brand : '#4a4d63')};
`;
const Q = styled.li`
  list-style: none; border-top: 1px solid ${C.line};
  &:first-child { border-top: none; }
  button.head { width: 100%; text-align: left; display: block; padding: 14px 0; border: none; background: none; font: inherit; cursor: pointer; min-height: 44px; }
  .text { font-size: 16px; line-height: 1.4; font-weight: 600; color: ${C.ink}; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; font-size: 13.5px; color: ${C.muted}; }
  .badge { padding: 2px 10px; border-radius: 999px; background: ${C.soft}; color: ${C.brand}; font-weight: 600; }
  .src { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 0 14px; }
`;
const Link = styled.a`
  display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid #e2e4ec;
  font-size: 13.5px; color: ${C.ink}; text-decoration: none; background: #fff;
  &:hover { border-color: ${C.brand}; }
`;
const Topic = styled.button`
  min-height: 40px; padding: 0 14px; border-radius: 999px; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer;
  border: 1.5px solid ${(p) => (p.$on ? C.brand : '#e2e4ec')}; background: ${(p) => (p.$on ? C.soft : '#fff')}; color: ${C.ink};
`;
const Probe = styled.li`
  list-style: none; padding: 14px 0; border-top: 1px solid ${C.line};
  &:first-child { border-top: none; }
  .q { font-size: 16px; font-weight: 600; line-height: 1.4; }
  .why { margin-top: 6px; font-size: 14.5px; line-height: 1.45; color: #3b3e52; }
  .based { margin-top: 6px; font-size: 13.5px; color: ${C.muted}; }
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
const Sheet = styled.div`
  position: fixed; inset: 0; z-index: 1300; background: rgba(19, 21, 42, 0.45); display: flex; align-items: flex-end; justify-content: center;
  .panel { width: 100%; max-width: 520px; background: #fff; border-radius: 20px 20px 0 0; padding: 22px 20px calc(20px + env(safe-area-inset-bottom, 0px)); }
  .panel h3 { margin: 0 0 6px; font-size: 18px; }
  .panel p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
  @media (min-width: 700px) { align-items: center; .panel { border-radius: 20px; } }
`;
const Foot = styled.p`
  margin: 0; font-size: 13.5px; line-height: 1.5; color: ${C.muted};
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
`;

function SourceLinks({ list }) {
  return list.map((s) => {
    const href = safeUrl(s.url);
    const label = [s.site || s.title, monthYear(s.date)].filter(Boolean).join(', ');
    return href
      ? <Link key={s.id} href={href} target="_blank" rel="noopener noreferrer">{label || href}</Link>
      : <span key={s.id} style={{ fontSize: 13.5, color: C.muted }}>{label}</span>;
  });
}

function QuestionRow({ q, sources }) {
  const [open, setOpen] = useState(false);
  const list = sourcesFor(q.sourceIds, sources);
  const latest = monthYear(q.mostRecent);
  return (
    <Q>
      <button type="button" className="head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <div className="text">{q.text}</div>
        <div className="meta">
          <span className="badge">{reportedBy(q)}</span>
          {latest && <span>Latest: {latest}</span>}
          <span>{CAT_LABEL[q.category] || 'Other'}</span>
        </div>
      </button>
      {open && (
        <div className="src">
          {list.length ? <SourceLinks list={list} /> : <span style={{ fontSize: 14, color: C.muted }}>No source links for this question.</span>}
        </div>
      )}
    </Q>
  );
}

function Progress({ elapsed }) {
  const now = progressStep(elapsed);
  return (
    <Section aria-live="polite">
      <h2>Researching</h2>
      <p className="sub">This can take one to three minutes the first time for a company. You can leave this page, the research keeps going and will be here when you come back. {Math.floor(elapsed / 1000)}s so far.</p>
      <Steps>
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < now ? 'done' : i === now ? 'now' : 'todo'}>
            <span className="dot">{i < now ? '✓' : ''}</span>{s}
          </li>
        ))}
      </Steps>
    </Section>
  );
}

export default function InterviewPrep() {
  const { tailoredId } = useParams();
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
  const [sheet, setSheet] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [storiesSignal, setStoriesSignal] = useState(0);
  const run = useRef(0);
  const prepId = useRef(null);
  const typed = useRef('');

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

  // Tick the progress lines while waiting.
  useEffect(() => {
    if (phase !== 'researching') return undefined;
    const t0 = Date.now() - elapsed;
    const t = setInterval(() => setElapsed(Date.now() - t0), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
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
  }, [tailoredId, start]);

  const company = tp ? companyOf(tp) || tp.jobTitle : '';
  const role = tp && companyOf(tp) ? tp.jobTitle : '';
  const questions = prep ? filterQuestions(prep.questions, cat) : [];
  const counts = prep ? categoryCounts(prep.questions) : {};
  const coverage = prep?.coverage;
  const generated = prep?.generatedAt ? monthYear(prep.generatedAt) : '';
  const generatedFull = prep?.generatedAt && Number.isFinite(Date.parse(prep.generatedAt))
    ? new Date(prep.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : generated;
  const rounds = prep?.process?.rounds || [];
  const sources = Array.isArray(prep?.sources) ? prep.sources : [];

  return (
    <Page>
      <div className="wrap">
        <Back type="button" onClick={() => navigate(-1)}>Back to resumes</Back>
        <Head>
          <h1>{company ? `Interview prep: ${company}` : 'Interview prep'}</h1>
          {role && <div className="role">{role}</div>}
          {phase === 'ready' && (
            <div className="row">
              {generatedFull && <span>Last researched {generatedFull}</span>}
              <TextBtn type="button" onClick={() => start(tp, true)}>Refresh research</TextBtn>
            </div>
          )}
        </Head>

        {phase === 'loading' && <Center><CircularProgress size={26} /></Center>}
        {phase === 'missing' && (
          <Center>
            <h2>We could not find that resume</h2>
            <p>It may have been deleted. Go back and pick another one.</p>
            <Btn type="button" onClick={() => navigate(-1)}>Go back</Btn>
          </Center>
        )}
        {phase === 'unavailable' && (
          <Center>
            <h2>Interview research is not available yet</h2>
            <p>We will turn it on soon.</p>
            <Btn type="button" $ghost onClick={() => navigate(-1)}>Go back</Btn>
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
            <h2>{errMsg === 'upgrade' ? 'Recent interview questions are a Pro feature' : 'You have used this month\u2019s interview research'}</h2>
            <p>{errMsg === 'upgrade'
              ? 'Pro and Pro Plus read what candidates recently shared about this role at this company, and show you the likely questions with their sources and dates.'
              : 'Your allowance renews next month. Pro Plus includes more research each month.'}</p>
            <Btn type="button" onClick={() => navigate('/pricing')}>See plans</Btn>
            <Btn type="button" $ghost onClick={() => navigate(-1)}>Go back</Btn>
          </Center>
        )}
        {phase === 'researching' && <Progress elapsed={elapsed} />}
        {phase === 'timeout' && (
          <Center>
            <h2>This is taking longer than expected</h2>
            <p>The research did not finish in time. Please try again in a moment.</p>
            <Btn type="button" onClick={() => start(tp, false)}>Try again</Btn>
          </Center>
        )}
        {phase === 'failed' && (
          <Center>
            <h2>We could not finish the research</h2>
            <p>{errMsg || 'Something went wrong on our side. Please try again.'}</p>
            <Btn type="button" onClick={() => start(tp, true)}>Retry</Btn>
          </Center>
        )}

        {phase === 'ready' && prep && (
          <>
            <Section>
              <h2>Summary</h2>
              {prep.summary ? <p>{prep.summary}</p> : <p className="sub">No summary was written for this role.</p>}
              {coverage === 'thin' && <Note>We found limited public information for this role, so treat this as a starting point.</Note>}
              {coverage === 'none' && (
                <Note>
                  We did not find public interview reports for this company and role, so the general role questions are not available.
                  The questions based on your own resume are below.
                </Note>
              )}
            </Section>

            {coverage !== 'none' && rounds.length > 0 && (
              <Section>
                <h2>How the process usually goes</h2>
                <Rounds>
                  {rounds.map((r, i) => (
                    <li key={`${r.name}-${i}`}>
                      <div className="name">{r.name}</div>
                      {r.format && <div className="fmt">{r.format}</div>}
                      {r.notes && <div className="notes">{r.notes}</div>}
                    </li>
                  ))}
                </Rounds>
                {prep.process?.timeline && <p className="sub" style={{ marginTop: 14, marginBottom: 0 }}>{prep.process.timeline}</p>}
                {Array.isArray(prep.process?.tips) && prep.process.tips.length > 0 && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 15, lineHeight: 1.5 }}>
                    {prep.process.tips.map((t, i) => <li key={i}>{typeof t === "string" ? t : t?.text}</li>)}
                  </ul>
                )}
              </Section>
            )}

            {coverage !== 'none' && (
              <Section>
                <h2>Questions candidates reported</h2>
                <p className="sub">Tap a question to see where it was reported.</p>
                {(prep.questions || []).length === 0 ? (
                  <p className="sub" style={{ marginBottom: 0 }}>No specific questions were reported for this role yet.</p>
                ) : (
                  <>
                    <Chips role="group" aria-label="Filter by category">
                      {CATEGORIES.map((c) => (
                        <Chip key={c.id} type="button" $on={cat === c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                          {c.label} ({counts[c.id] || 0})
                        </Chip>
                      ))}
                    </Chips>
                    {questions.length === 0 ? (
                      <p className="sub" style={{ marginBottom: 0 }}>No questions in this category.</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0 }}>
                        {questions.map((q, i) => <QuestionRow key={q.id || i} q={q} sources={sources} />)}
                      </ul>
                    )}
                  </>
                )}
              </Section>
            )}

            {coverage !== 'none' && Array.isArray(prep.topics) && prep.topics.length > 0 && (
              <Section>
                <h2>Topics to review</h2>
                <p className="sub">Tap a topic to see why it matters.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {prep.topics.map((t, i) => (
                    <Topic key={`${t.name}-${i}`} type="button" $on={topicOpen === i} aria-expanded={topicOpen === i} onClick={() => setTopicOpen(topicOpen === i ? null : i)}>{t.name}</Topic>
                  ))}
                </div>
                {topicOpen != null && prep.topics[topicOpen]?.why && (
                  <Note style={{ background: C.soft, color: C.ink }}>{prep.topics[topicOpen].why}</Note>
                )}
              </Section>
            )}

            <Section>
              <h2>What they may ask about your resume</h2>
              <p className="sub">These questions are based on your own resume, not on public reports.</p>
              {probes.state === 'loading' && <div style={{ padding: '8px 0' }}><CircularProgress size={22} /></div>}
              {probes.state === 'error' && (
                <>
                  <p className="sub">We could not build these just now.</p>
                  <TextBtn type="button" onClick={() => personalize(prepId.current, run.current)}>Try again</TextBtn>
                </>
              )}
              {probes.state === 'done' && probes.list.length === 0 && <p className="sub" style={{ marginBottom: 0 }}>No resume questions came back this time.</p>}
              {probes.state === 'done' && probes.list.length > 0 && (
                <ul style={{ margin: 0, padding: 0 }}>
                  {probes.list.map((p, i) => (
                    <Probe key={i}>
                      <div className="q">{p.question}</div>
                      {p.why && <div className="why">{p.why}</div>}
                      {p.basedOn && <div className="based">From your resume: {p.basedOn}</div>}
                    </Probe>
                  ))}
                </ul>
              )}
            </Section>

            <Section>
              <h2>Practice</h2>
              <p className="sub">Rehearse your answers before the interview.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Btn type="button" onClick={() => setSheet(true)}>Practice out loud</Btn>
                <Btn type="button" $ghost onClick={() => { setStoriesOpen(true); setStoriesSignal((n) => n + 1); }}>Build my stories</Btn>
              </div>
            </Section>

            <Stories prepId={prepId.current} tailoredId={tailoredId} open={storiesOpen} openSignal={storiesSignal} onPractice={() => setSheet(true)} />

            {sources.length > 0 && (
              <Section>
                <h2>Sources</h2>
                <p className="sub">Public pages this research is based on.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><SourceLinks list={sources} /></div>
              </Section>
            )}
            {prep.disclaimer && <Foot>{prep.disclaimer}</Foot>}
          </>
        )}
      </div>

      {sheet && (
        <Sheet role="dialog" aria-modal="true" aria-label="Coming next" onClick={() => setSheet(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <h3>Coming next: practice with the voice coach</h3>
            <p>We are still building this part. Your research and questions stay here for now.</p>
            <Btn type="button" onClick={() => setSheet(false)} style={{ width: '100%' }}>Got it</Btn>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
