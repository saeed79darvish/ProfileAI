import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { interviewPrepAPI } from '@/services/interviewPrep';
import { sourcesFor, safeUrl, sourcePillLabel } from './prepLogic';
import { cleanFocus, focusSummary } from './targeting';
import {
  TABS, TYPE_TABS, reportedByType, reportedCounts, defaultTypeTab, suggestedCards, areasOf, inArea, questionMeta, practiceRoute, savedNotes, probeCards,
} from './questionsLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', brandInk: '#4b4fc4', soft: '#f0f0fc', bg: '#f4f5fa' };

const Page = styled.div`
  min-height: 100%; background: ${C.bg}; padding: 16px 16px 72px; color: ${C.ink};
  .wrap { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
  .layout { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .main { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .rail { flex: 1 1 300px; max-width: 360px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  @media (max-width: 740px) { .rail { max-width: none; flex-basis: 100%; } }
  @media (min-width: 900px) { padding: 32px 40px 96px; .wrap { gap: 24px; } }
`;
const Back = styled.button`
  align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; min-height: 44px;
  font: inherit; font-size: 14.5px; font-weight: 600; color: ${C.brandInk}; cursor: pointer; text-align: left;
`;
const Title = styled.header`
  h1 { margin: 0; font-size: 28px; line-height: 1.1; font-weight: 800; letter-spacing: -0.02em; }
  .sub { margin: 6px 0 0; font-size: 16px; line-height: 1.45; color: #4a4d63; overflow-wrap: anywhere; }
  @media (min-width: 900px) { h1 { font-size: 34px; } }
`;
const Tabs = styled.div`
  display: flex; gap: 6px; padding: 5px; border-radius: 16px; background: #e8e9f3; align-self: flex-start; flex-wrap: wrap; max-width: 100%;
  button { min-height: 44px; padding: 0 16px; border-radius: 12px; border: none; background: transparent; color: #4a4d63; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  button[aria-selected='true'] { background: #fff; color: ${C.ink}; box-shadow: 0 1px 3px rgba(19, 21, 42, 0.12); }
  button:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
  .n { margin-left: 6px; opacity: 0.65; }
`;
const Filters = styled.div`
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  .lbl { font-size: 13px; font-weight: 700; color: ${C.muted}; margin-right: 4px; }
  button { min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1.5px solid #d9dbe5; background: #fff; color: ${C.ink}; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
  button[aria-pressed='true'] { border-color: ${C.brand}; background: ${C.soft}; color: ${C.brandInk}; }
  button:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
`;
const Item = styled.li`
  list-style: none; background: #fff; border: 1.5px solid ${(p) => (p.$open ? C.brand : C.line)}; border-radius: 18px; overflow: hidden;
  .head { width: 100%; text-align: left; border: none; background: none; padding: 18px 20px; cursor: pointer; display: flex; gap: 16px; align-items: flex-start; min-height: 44px; font: inherit; color: ${C.ink}; }
  .head:focus-visible { outline: 2px solid ${C.brand}; outline-offset: -2px; }
  .text { font-size: 17px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
  .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13.5px; color: ${C.muted}; }
  .tag { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .sign { flex: none; width: 28px; height: 28px; border-radius: 50%; background: ${C.soft}; color: ${C.brandInk}; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .body { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 14px; }
  .prep { padding: 16px; border-radius: 14px; background: #f8f9fc; }
  .prep .lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: ${C.brandInk}; margin-bottom: 8px; }
  .prep ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5; }
  .prep .none { margin: 0; font-size: 14.5px; color: ${C.muted}; }
  .actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .src { display: flex; flex-wrap: wrap; gap: 8px; }
  .src a { padding: 4px 12px; border-radius: 999px; background: #f3f4f9; color: #3b3e52; font-size: 13.5px; font-weight: 600; text-decoration: none; }
  .src a:hover { background: #e9ebf4; }
  .why { font-size: 14.5px; line-height: 1.5; color: #4a4d63; }
  @media (max-width: 480px) { .actions button { flex: 1 1 100%; } }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 22px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #5b5fd6' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)}; color: ${(p) => (p.$ghost ? C.brandInk : '#fff')};
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
`;
const TextBtn = styled.button`
  border: none; background: none; padding: 0; min-height: 44px; font: inherit; font-size: 14px; font-weight: 600; color: ${C.brandInk}; cursor: pointer;
  &:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
`;
const Side = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 22px; display: flex; flex-direction: column; gap: 12px;
  h2 { margin: 0; font-size: 18px; font-weight: 700; }
  p { margin: 0; font-size: 14.5px; line-height: 1.5; color: #4a4d63; }
`;
const Aim = styled.div`
  padding: 16px 20px; border-radius: 16px; background: ${C.soft}; font-size: 14.5px; line-height: 1.5; color: #3b3f9e;
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 19px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
`;
const Section = styled.section`
  display: flex; flex-direction: column; gap: 12px;
  h2 { margin: 0; font-size: 20px; font-weight: 700; }
  .sub { margin: 0; font-size: 14.5px; line-height: 1.5; color: #4a4d63; }
  .areas { display: flex; gap: 8px; flex-wrap: wrap; }
  .areas button { min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1.5px solid #d9dbe5; background: #fff; color: #13152a; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
  .areas button[aria-pressed='true'] { border-color: #5b5fd6; background: #f0f0fc; color: #4b4fc4; }
  .areas button:focus-visible { outline: 2px solid #5b5fd6; outline-offset: 2px; }
`;
const Empty = styled.p`
  margin: 0; padding: 20px; border-radius: 16px; background: #fff; border: 1px dashed #d9dbe5; font-size: 15px; line-height: 1.5; color: ${C.muted};
`;

const Svg = ({ children, width = 2 }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ChevronLeft = () => <Svg width={2.4}><path d="M15 6l-6 6 6 6" /></Svg>;

const KIND_TAG = {
  code: { label: 'Write code', bg: '#e8f0ff', fg: '#2a56b8' },
  spoken: { label: 'Say it out loud', bg: '#efe8ff', fg: '#5b34b8' },
};

function QuestionItem({ q, prepId, prep, sources, notes, onNeedNotes, onPractice }) {
  const [open, setOpen] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const tag = KIND_TAG[q.kind] || KIND_TAG.spoken;
  const route = practiceRoute(prepId, q);
  const links = sourcesFor(q.sourceIds, sources);
  const note = notes[q.id] || { state: 'idle', list: savedNotes(prep, q.id) };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !q.fromResume && note.state === 'idle' && note.list.length === 0) onNeedNotes(q.id);
  };

  return (
    <Item $open={open}>
      <button type="button" className="head" aria-expanded={open} onClick={toggle}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="text" style={{ display: 'block' }}>{q.text}</span>
          <span className="meta">
            <span className="tag" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
            {q.fromResume ? <span>From your resume</span> : q.suggested ? <span>{q.area}</span> : <span>{questionMeta(q)}</span>}
          </span>
        </span>
        <span className="sign" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="body">
          {q.fromResume ? (
            <div className="prep">
              <div className="lbl">WHY THEY MAY ASK</div>
              {q.why && <p className="why" style={{ margin: 0 }}>{q.why}</p>}
              {q.basedOn && <p className="why" style={{ margin: '8px 0 0' }}>{q.basedOn}</p>}
            </div>
          ) : (
            <div className="prep">
              <div className="lbl">HOW TO PREPARE</div>
              {note.state === 'loading' && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CircularProgress size={18} /><span className="none">Writing your notes</span></div>}
              {note.state === 'error' && (
                <>
                  <p className="none">We could not write these just now.</p>
                  <TextBtn type="button" onClick={() => onNeedNotes(q.id)}>Try again</TextBtn>
                </>
              )}
              {note.list.length > 0 && <ul>{note.list.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            </div>
          )}
          <div className="actions">
            <Btn type="button" onClick={() => onPractice(route)}>{route.label}</Btn>
            {!q.fromResume && !q.suggested && links.length > 0 && (
              <TextBtn type="button" aria-expanded={showSrc} onClick={() => setShowSrc((v) => !v)}>
                {showSrc ? 'Hide where it was reported' : `Where it was reported (${links.length} ${links.length === 1 ? 'source' : 'sources'})`}
              </TextBtn>
            )}
          </div>
          {showSrc && (
            <div className="src">
              {links.map((s) => {
                const href = safeUrl(s.url);
                const label = sourcePillLabel(s) || href;
                return href ? <a key={s.id} href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <span key={s.id}>{label}</span>;
              })}
            </div>
          )}
        </div>
      )}
    </Item>
  );
}

export default function Questions() {
  const { prepId } = useParams();
  const [search] = useSearchParams();
  const tailoredId = search.get('tailored') || undefined;
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | missing | failed | pending | ready
  const [prep, setPrep] = useState(null);
  const [focus, setFocus] = useState(null);
  const [tab, setTab] = useState('technical');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState({}); // question id -> { state, list }
  const [suggested, setSuggested] = useState({}); // type -> { state, list }
  const [probes, setProbes] = useState({ state: 'idle', list: [] });

  useEffect(() => {
    let alive = true;
    setPhase('loading'); setPrep(null); setNotes({}); setSuggested({}); setProbes({ state: 'idle', list: [] });
    interviewPrepAPI.get(prepId).then((res) => {
      if (!alive) return;
      const d = res.data || {};
      if (d.status === 'ready' && d.prep) { setPrep(d.prep); setTab(defaultTypeTab(d.prep)); setPhase('ready'); } else if (d.status === 'failed') setPhase('failed'); else setPhase('pending');
    }).catch((e) => { if (alive) setPhase(e?.response?.status === 404 ? 'missing' : 'failed'); });
    interviewPrepAPI.getFocus(prepId).then((res) => { if (alive) setFocus(cleanFocus(res.data?.focus)); }).catch(() => {});
    return () => { alive = false; };
  }, [prepId]);

  useEffect(() => { setArea(''); }, [tab]);

  // Suggestions for a kind cost a model call the first time, so they are only asked for when that tab is opened.
  const loadSuggested = (type) => {
    setSuggested((m) => ({ ...m, [type]: { state: 'loading', list: [] } }));
    interviewPrepAPI.suggestedQuestions(prepId, type, tailoredId)
      .then((res) => setSuggested((m) => ({ ...m, [type]: { state: 'done', list: suggestedCards(res.data?.questions) } })))
      .catch(() => setSuggested((m) => ({ ...m, [type]: { state: 'error', list: [] } })));
  };
  const isType = TYPE_TABS.some((t) => t.id === tab);
  useEffect(() => {
    if (phase === 'ready' && isType && !suggested[tab]) loadSuggested(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tab, isType]);

  // The resume questions cost a model call, so they are only built when that tab is opened.
  useEffect(() => {
    if (tab !== 'resume' || probes.state !== 'idle' || phase !== 'ready') return;
    setProbes({ state: 'loading', list: [] });
    interviewPrepAPI.personalize(prepId, tailoredId)
      .then((res) => setProbes({ state: 'done', list: probeCards(res.data?.probes) }))
      .catch(() => setProbes({ state: 'error', list: [] }));
  }, [tab, probes.state, phase, prepId, tailoredId]);

  const sources = Array.isArray(prep?.sources) ? prep.sources : [];
  const counts = useMemo(() => reportedCounts(prep), [prep]);
  const reported = useMemo(() => (isType && prep ? reportedByType(prep, tab) : { list: [], order: 'most' }), [prep, tab, isType]);
  const sug = suggested[tab] || { state: 'idle', list: [] };
  const areas = useMemo(() => areasOf(sug.list), [sug.list]);
  const sugList = useMemo(() => inArea(sug.list, area), [sug.list, area]);
  const tabInfo = TYPE_TABS.find((t) => t.id === tab);
  const roleText = prep ? [prep.role, prep.company && prep.scope !== 'role' ? `at ${prep.company}` : ''].filter(Boolean).join(' ') : 'this role';

  const heading = prep ? [prep.scope === 'role' ? '' : prep.company, prep.role].filter((x) => typeof x === 'string' && x).join(', ') : '';
  const goPrep = () => navigate(`/interview-prep/prep/${prepId}`);
  const goPractice = (route) => navigate(route.path, route.state ? { state: route.state } : undefined);

  const needNotes = (id) => {
    setNotes((n) => ({ ...n, [id]: { state: 'loading', list: [] } }));
    interviewPrepAPI.prepareQuestion(prepId, id)
      .then((res) => setNotes((n) => ({ ...n, [id]: { state: 'done', list: Array.isArray(res.data?.prepare) ? res.data.prepare : [] } })))
      .catch(() => setNotes((n) => ({ ...n, [id]: { state: 'error', list: [] } })));
  };

  const aim = focusSummary(focus);
  const renderItems = (items, keyPrefix) => (
    <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((q) => (
        <QuestionItem key={`${keyPrefix}-${q.id}`} q={q} prepId={prepId} prep={prep} sources={sources} notes={notes} onNeedNotes={needNotes} onPractice={goPractice} />
      ))}
    </ul>
  );

  return (
    <Page>
      <div className="wrap">
        <Back type="button" onClick={goPrep}><ChevronLeft />{heading ? `Back to ${heading}` : 'Back to your prep'}</Back>
        <Title>
          <h1>Interview questions</h1>
          <p className="sub">What people reported being asked, plus common questions for the role, and how to prepare for each one.</p>
        </Title>

        {phase === 'loading' && <Center role="status" aria-label="Loading"><CircularProgress size={26} /></Center>}
        {phase === 'missing' && (
          <Center><h2>We could not find that prep</h2><p>It may have been deleted. Go back and pick another one.</p><Btn type="button" onClick={() => navigate(-1)}>Go back</Btn></Center>
        )}
        {phase === 'failed' && (
          <Center><h2>We could not open this prep</h2><p>Something went wrong on our side. Please try again in a moment.</p><Btn type="button" onClick={goPrep}>Back to your prep</Btn></Center>
        )}
        {phase === 'pending' && (
          <Center><h2>Still researching, come back in a moment</h2><p>The questions appear once the research has finished.</p><Btn type="button" onClick={goPrep}>Back to your prep</Btn></Center>
        )}

        {phase === 'ready' && (
          <div className="layout">
            <div className="main">
              <Tabs role="tablist" aria-label="Kind of question">
                {TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                    {t.label}{counts[t.id] != null && <span className="n">{counts[t.id]}</span>}
                  </button>
                ))}
              </Tabs>

              {isType && (
                <>
                  <Section aria-labelledby="rep-h">
                    <h2 id="rep-h">Reported for this role</h2>
                    <p className="sub">
                      {tabInfo.about} {reported.list.length > 0 ? (reported.order === 'newest' ? 'Newest first.' : 'Most reported first.') : ''}
                    </p>
                    {reported.list.length === 0
                      ? <Empty>No {tabInfo.label.toLowerCase()} questions were reported for this role yet. See the common ones below.</Empty>
                      : renderItems(reported.list, 'rep')}
                  </Section>

                  <Section aria-labelledby="com-h">
                    <h2 id="com-h">Common for this role</h2>
                    <p className="sub">Suggested for {roleText}{tailoredId ? ', using the job you tailored your resume for' : ''}. Candidates did not report these, so use them to practice. Open one for a note on how to prepare.</p>
                    {sug.state === 'loading' && <Center role="status"><CircularProgress size={24} /><p style={{ margin: '12px 0 0' }}>Finding common questions</p></Center>}
                    {sug.state === 'error' && (
                      <Center><h2>We could not suggest questions just now</h2><Btn type="button" onClick={() => loadSuggested(tab)}>Try again</Btn></Center>
                    )}
                    {sug.state === 'done' && areas.length > 1 && (
                      <div className="areas" role="group" aria-label="Area">
                        <button type="button" aria-pressed={!area} onClick={() => setArea('')}>All</button>
                        {areas.map((a) => <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(area === a ? '' : a)}>{a}</button>)}
                      </div>
                    )}
                    {sug.state === 'done' && (sugList.length === 0 ? <Empty>No suggestions came back this time.</Empty> : renderItems(sugList, 'sug'))}
                  </Section>
                </>
              )}

              {tab === 'resume' && (
                <Section aria-labelledby="res-h">
                  <h2 id="res-h">About your resume</h2>
                  <p className="sub">Questions an interviewer may ask about your own experience, and the gaps they may probe.</p>
                  {probes.state === 'loading' && <Center role="status"><CircularProgress size={24} /><p style={{ margin: '12px 0 0' }}>Reading your resume</p></Center>}
                  {probes.state === 'error' && <Center><h2>We could not build these just now</h2><Btn type="button" onClick={() => setProbes({ state: 'idle', list: [] })}>Try again</Btn></Center>}
                  {probes.state === 'done' && (probes.list.length === 0 ? <Empty>No resume questions came back this time.</Empty> : renderItems(probes.list, 'res'))}
                </Section>
              )}
            </div>

            <aside className="rail" aria-label="Practice">
              <Side>
                <h2>Practice these</h2>
                <p>Say answers out loud with a coach, or write code and get a review.</p>
                <Btn type="button" onClick={() => navigate(`/interview-prep/practice/${prepId}`)}>Practice out loud</Btn>
                <Btn type="button" $ghost onClick={() => navigate(`/interview-prep/code/${prepId}`)}>Practice coding</Btn>
              </Side>
              {aim && <Aim><b>You are aiming at</b><br />{aim}</Aim>}
            </aside>
          </div>
        )}
      </div>
    </Page>
  );
}
