import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { interviewPrepAPI } from '@/services/interviewPrep';
import { cleanStories } from './storyLogic';
import { usePracticeCall, PRACTICE_STATES } from './usePracticeCall';
import {
  formatElapsed, spokenDuration, errorCopy, pickTopQuestions, sessionBody, noteChips, questionStates, buildSaveBody, hasSessionContent, storyForQuestion,
} from './practiceLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', brandInk: '#4b4fc4', soft: '#f0f0fc', bg: '#f4f5fa', success: '#1f8f55', danger: '#b42318' };

const Page = styled.div`
  min-height: 100%; background: ${C.bg}; padding: 16px 16px 72px; color: ${C.ink};
  .wrap { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .layout { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .main { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .rail { flex: 1 1 320px; max-width: 400px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  @media (max-width: 740px) { .rail { max-width: none; flex-basis: 100%; } }
  @media (min-width: 900px) { padding: 32px 40px 96px; .wrap { gap: 20px; } .main, .rail { gap: 20px; } }
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
const Card = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 4px; font-size: 19px; font-weight: 700; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  @media (min-width: 900px) { padding: 28px; h2 { font-size: 22px; } }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 22px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #d9dbe5' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : p.$plain ? 'transparent' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : p.$plain ? C.danger : '#fff')};
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
`;
const Row = styled.div`
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: ${(p) => p.$center ? 'center' : 'flex-start'}; margin-top: 20px;
  @media (max-width: 480px) { button { flex: 1 1 100%; } }
`;
const Note = styled.div`
  margin-top: 14px; padding: 10px 12px; border-radius: 12px; font-size: 14.5px; line-height: 1.45;
  background: ${(p) => (p.$info ? C.soft : '#fdf1e4')}; color: ${(p) => (p.$info ? '#3b3f9e' : '#8a4a08')};
`;
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 19px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
  button + button { margin-left: 8px; }
`;
const QList = styled.ol`
  list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
  li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: #f8f9fc; }
  .n { flex: none; width: 24px; height: 24px; border-radius: 50%; background: ${C.soft}; color: ${C.brandInk}; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .t { flex: 1; min-width: 0; font-size: 15.5px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
`;
const Tag = styled.span`
  display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
  background: ${(p) => (p.$resume ? C.soft : '#e8f0ff')}; color: ${(p) => (p.$resume ? C.brandInk : '#2a56b8')};
`;
const Live = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  .top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 12px; }
  .count { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 700; }
  .dots { display: flex; gap: 6px; margin-left: 4px; }
  .dot { width: 24px; height: 6px; border-radius: 999px; background: ${C.line}; }
  .dot[data-s='done'] { background: ${C.success}; }
  .dot[data-s='current'] { background: ${C.brand}; }
  .q { margin-top: 18px; font-size: 22px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; overflow-wrap: anywhere; }
  .story { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: ${C.soft}; font-size: 14.5px; color: #3b3f9e; overflow-wrap: anywhere; }
  .stage { display: flex; flex-direction: column; align-items: center; margin: 28px 0 8px; }
  .orbwrap { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; }
  .ring { position: absolute; border-radius: 50%; transition: transform 0.1s linear; }
  .ring.a { inset: 0; background: #eef0ff; transform: scale(calc(1 + var(--lvl, 0) * 0.12)); }
  .ring.b { inset: 16px; background: #dfe2ff; transform: scale(calc(1 + var(--lvl, 0) * 0.2)); }
  .core { position: absolute; inset: 34px; border-radius: 50%; background: ${C.brand}; display: flex; align-items: center; justify-content: center; transform: scale(calc(1 + var(--lvl, 0) * 0.1)); transition: transform 0.1s linear; }
  .core[data-muted='true'] { background: #9aa0b4; }
  .bars { display: flex; align-items: center; gap: 5px; height: 40px; margin-top: 16px; }
  .bar { width: 5px; border-radius: 3px; background: #8b8fe6; transition: height 0.1s linear; }
  .time { margin-top: 12px; font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .hint { margin-top: 2px; font-size: 14px; color: ${C.muted}; text-align: center; }
  .status { margin-top: 6px; font-size: 14.5px; font-weight: 600; color: ${C.brandInk}; text-align: center; min-height: 22px; }
  .heard { margin-top: 18px; padding: 16px; border-radius: 16px; background: #f8f9fc; border: 1px solid #eef0f5; }
  .heard .lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: ${C.muted}; margin-bottom: 8px; }
  .heard p { margin: 0; font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
  .heard p.empty { color: #9ca3af; }
  @media (min-width: 900px) { padding: 32px; .q { font-size: 28px; } .orbwrap { width: 176px; height: 176px; } }
  @media (prefers-reduced-motion: reduce) { .ring, .core, .bar { transition: none; transform: none; } }
`;
const Side = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 14px; font-size: 18px; font-weight: 700; }
  .headrow { display: flex; align-items: baseline; justify-content: space-between; }
  .headrow h2 { margin: 0 0 14px; }
  .live { font-size: 13px; color: ${C.muted}; }
  ul, ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .empty { margin: 0; font-size: 14.5px; line-height: 1.45; color: ${C.muted}; }
  .note { padding: 12px; border-radius: 12px; background: #f8f9fc; }
  .nq { font-size: 14px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
  .nl { margin-top: 6px; font-size: 14px; line-height: 1.45; color: #3b3e52; overflow-wrap: anywhere; }
  .nl b { color: ${C.ink}; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .chip[data-tone='good'] { background: #e5f6ec; color: #1f7a49; }
  .chip[data-tone='warn'] { background: #fdf1e4; color: #8a4a08; }
  .qrow { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1.5px solid transparent; }
  .qrow[data-s='current'] { background: ${C.soft}; border-color: ${C.brand}; }
  .qn { flex: none; width: 22px; height: 22px; box-sizing: border-box; border-radius: 50%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #d9dbe5; color: ${C.muted}; }
  .qrow[data-s='done'] .qn { background: ${C.success}; border-color: ${C.success}; }
  .qrow[data-s='current'] .qn { background: ${C.brand}; border-color: ${C.brand}; color: #fff; }
  .qt { flex: 1; min-width: 0; font-size: 14px; line-height: 1.35; color: #4a4d63; overflow-wrap: anywhere; }
  .qrow[data-s='current'] .qt { font-weight: 700; color: ${C.ink}; }
  @media (min-width: 900px) { padding: 24px; }
`;
const Done = styled.div`
  .summary { margin: 0; font-size: 17px; line-height: 1.6; }
  .tip { margin-top: 16px; padding: 14px 16px; border-radius: 12px; background: ${C.soft}; font-size: 15.5px; line-height: 1.5; color: #3b3f9e; }
  .tip b { display: block; margin-bottom: 4px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
  .meta { margin-top: 14px; font-size: 14px; color: ${C.muted}; }
  .notes { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .n { padding: 16px; border-radius: 14px; border: 1px solid ${C.line}; }
  .nq { font-size: 16px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
  .nl { margin-top: 8px; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
  .nl b { display: block; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: ${C.muted}; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
  .chip[data-tone='good'] { background: #e5f6ec; color: #1f7a49; }
  .chip[data-tone='warn'] { background: #fdf1e4; color: #8a4a08; }
`;

function Svg({ children, size = 16, stroke = 'currentColor', width = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const ChevronLeft = () => <Svg width={2.4}><path d="M15 6l-6 6 6 6" /></Svg>;
const MicIcon = ({ size = 40 }) => <Svg size={size} stroke="#ffffff" width={2}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
const BookIcon = () => <Svg size={18} stroke={C.brandInk} width={2}><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></Svg>;
const CheckIcon = ({ size = 12 }) => <Svg size={size} stroke="#ffffff" width={3.4}><path d="M5 12l4.5 4.5L19 7" /></Svg>;

const BAR_SHAPE = [0.35, 0.55, 0.85, 0.6, 1, 0.75, 0.4, 0.9, 0.55, 0.35, 0.7, 0.3];

function NoteBlock({ note }) {
  return (
    <>
      {note.worked && <div className="nl"><b>What worked</b>{note.worked}</div>}
      {note.improve && <div className="nl"><b>To improve</b>{note.improve}</div>}
      {noteChips(note).length > 0 && (
        <div className="chips">{noteChips(note).map((c) => <span key={c.key} className="chip" data-tone={c.tone}>{c.label}</span>)}</div>
      )}
    </>
  );
}

export default function Practice() {
  const { prepId } = useParams();
  const navigate = useNavigate();
  const call = usePracticeCall();
  const { ended, notes, finished, start: startCall, stop: stopCall } = call;

  const [phase, setPhase] = useState('loading'); // loading | pending | failed | missing | ready
  const [prep, setPrep] = useState(null);
  const [stories, setStories] = useState(null); // null until known
  const [screen, setScreen] = useState('ready'); // ready | done
  const [notice, setNotice] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed
  const handledRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setPhase('loading'); setPrep(null); setStories(null);
    interviewPrepAPI.get(prepId).then((res) => {
      if (!alive) return;
      const d = res.data || {};
      if (d.status === 'ready' && d.prep) { setPrep(d.prep); setPhase('ready'); } else if (d.status === 'failed') setPhase('failed'); else setPhase('pending');
    }).catch((e) => { if (alive) setPhase(e?.response?.status === 404 ? 'missing' : 'failed'); });
    return () => { alive = false; };
  }, [prepId]);

  useEffect(() => {
    if (phase !== 'ready') return undefined;
    let alive = true;
    interviewPrepAPI.listStories(prepId)
      .then((res) => { if (alive) setStories(cleanStories(res.data?.stories)); })
      .catch(() => { if (alive) setStories(null); });
    return () => { alive = false; };
  }, [phase, prepId]);

  // When a session ends: show the summary and save its text once, or return to the start with a note.
  useEffect(() => {
    if (!ended || handledRef.current === ended) return;
    handledRef.current = ended;
    if (!hasSessionContent(notes, finished)) {
      setScreen('ready');
      setNotice(ended.dropped ? 'The connection dropped before any answer was reviewed.' : 'The session ended before any answer was reviewed.');
      return;
    }
    setScreen('done');
    setSaveState('saving');
    interviewPrepAPI.savePractice(prepId, buildSaveBody({ startedAt: ended.startedAt, seconds: ended.seconds, notes, summary: finished?.summary, topTip: finished?.topTip }))
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('failed'));
  }, [ended, notes, finished, prepId]);

  const top = useMemo(() => pickTopQuestions(prep, 5), [prep]);
  const running = call.state !== PRACTICE_STATES.idle;
  const goPrep = useCallback(() => navigate(`/interview-prep/prep/${prepId}`), [navigate, prepId]);
  const begin = useCallback(() => {
    setNotice(''); setScreen('ready'); setSaveState('idle');
    startCall(prepId, sessionBody(top));
  }, [startCall, prepId, top]);

  const list = call.questions;
  const total = list.length;
  const current = list[call.currentIndex - 1] || null;
  const states = questionStates(total, call.currentIndex);
  const story = current ? storyForQuestion(current.text, stories) : null;
  const heading = prep ? [prep.scope === 'role' ? '' : prep.company, prep.role].filter((x) => typeof x === 'string' && x).join(', ') : '';
  const level = Math.max(0, Math.min(1, call.level));
  const status = call.state === PRACTICE_STATES.connecting ? 'Connecting to your coach...'
    : call.state === PRACTICE_STATES.ending ? 'Wrapping up...'
    : call.muted ? 'Paused. Your microphone is off.'
    : call.speaking ? 'Your coach is speaking' : 'Your turn. Answer when you are ready.';

  const errBox = call.error ? errorCopy(call.error, call.errorMessage) : null;

  return (
    <Page>
      <div className="wrap">
        <Back type="button" onClick={goPrep}><ChevronLeft />{heading ? `Back to ${heading}` : 'Back to your prep'}</Back>
        <Title>
          <h1>Practice out loud</h1>
          <p className="sub">{running || screen === 'done' ? 'A coach asks the questions. You answer by voice.' : heading || 'A coach asks the questions. You answer by voice, using your own stories.'}</p>
        </Title>

        {phase === 'loading' && <Center role="status" aria-label="Loading"><CircularProgress size={26} /></Center>}
        {phase === 'missing' && (
          <Center>
            <h2>We could not find that prep</h2>
            <p>It may have been deleted. Go back and pick another one.</p>
            <Btn type="button" onClick={() => navigate(-1)}>Go back</Btn>
          </Center>
        )}
        {phase === 'failed' && (
          <Center>
            <h2>We could not open this prep</h2>
            <p>Something went wrong on our side. Please try again in a moment.</p>
            <Btn type="button" onClick={goPrep}>Back to your prep</Btn>
          </Center>
        )}
        {phase === 'pending' && (
          <Center>
            <h2>Still researching, come back in a moment</h2>
            <p>Practice opens once the research has finished.</p>
            <Btn type="button" onClick={goPrep}>Back to your prep</Btn>
          </Center>
        )}

        {phase === 'ready' && !running && screen === 'ready' && (
          <Card aria-labelledby="ready-h">
            <h2 id="ready-h">Before you start</h2>
            <p className="sub">{top.length ? 'You will be asked these questions, one at a time.' : 'We will pick the questions from your resume and this role.'}</p>
            {top.length > 0 && (
              <QList>
                {top.map((q, i) => <li key={q.text}><span className="n">{i + 1}</span><span className="t">{q.text}</span></li>)}
              </QList>
            )}
            <Note $info>About 1 minute per answer. We keep your notes, never the recording.</Note>
            <Note $info>
              {Array.isArray(stories) && stories.length > 0
                ? 'We will notice when you use your saved stories.'
                : 'You have no saved stories yet. Build a few on your prep and the coach will notice when you use them.'}
              {Array.isArray(stories) && stories.length === 0 && (
                <>{' '}<a href={`/interview-prep/prep/${prepId}`} onClick={(e) => { e.preventDefault(); goPrep(); }} style={{ color: C.brandInk, fontWeight: 600 }}>Build my stories</a></>
              )}
            </Note>
            <Note $info>
              Coding questions are not asked out loud. Practice those in the{' '}
              <a href={`/interview-prep/code/${prepId}`} onClick={(e) => { e.preventDefault(); navigate(`/interview-prep/code/${prepId}`); }} style={{ color: C.brandInk, fontWeight: 600 }}>code editor</a>
              , where you get a review and your attempts are saved.
            </Note>
            <Note $info>Your browser will ask to use the microphone. Find a quiet spot and allow it so the coach can hear you.</Note>
            {notice && <Note role="status">{notice}</Note>}
            {errBox && (
              <Note role="alert">
                <b>{errBox.title}.</b> {errBox.body}
                {errBox.plans && <div style={{ marginTop: 10 }}><Btn type="button" onClick={() => navigate('/pricing')}>See plans</Btn></div>}
              </Note>
            )}
            <Row>
              <Btn type="button" onClick={begin} disabled={call.state === PRACTICE_STATES.connecting}>Start practice</Btn>
            </Row>
          </Card>
        )}

        {phase === 'ready' && running && (
          <div className="layout">
            <div className="main">
              <Live aria-label="Practice session">
                <div className="top">
                  <div className="count">
                    <span>{current ? `Question ${call.currentIndex} of ${total}` : total ? 'All questions answered' : 'Getting ready'}</span>
                    {total > 0 && <span className="dots" aria-hidden="true">{states.map((s, i) => <span key={i} className="dot" data-s={s} />)}</span>}
                  </div>
                  {current && <Tag $resume={current.kind === 'resume'}>{current.kind === 'resume' ? 'From your resume' : 'Reported'}</Tag>}
                </div>
                <div className="q">{current ? current.text : total ? 'Your coach is wrapping up.' : 'Your coach is joining.'}</div>
                {story && <div className="story"><BookIcon /><span><b>Your story for this:</b> {story.title || story.theme}</span></div>}

                <div className="stage">
                  <div className="orbwrap" style={{ '--lvl': level }} aria-hidden="true">
                    <div className="ring a" /><div className="ring b" />
                    <div className="core" data-muted={call.muted ? 'true' : 'false'}><MicIcon /></div>
                  </div>
                  <div className="bars" aria-hidden="true">
                    {BAR_SHAPE.map((s, i) => <span key={i} className="bar" style={{ height: `${Math.round(6 + s * level * 34)}px` }} />)}
                  </div>
                  <div className="time" role="timer" aria-label="Time elapsed">{formatElapsed(call.elapsedMs)}</div>
                  <div className="hint">About a minute is a good answer</div>
                  <div className="status" role="status" aria-live="polite">{status}</div>
                </div>

                <div className="heard">
                  <div className="lbl" id="heard-l">WHAT WE HEARD</div>
                  <p aria-labelledby="heard-l" aria-live="polite" aria-atomic="false" className={call.heardText ? '' : 'empty'}>
                    {call.heardText || 'Your words show up here as you speak.'}
                  </p>
                </div>

                <Row $center>
                  <Btn type="button" $ghost aria-pressed={call.muted} onClick={call.toggleMute} disabled={!call.live}>{call.muted ? 'Resume' : 'Pause'}</Btn>
                  <Btn type="button" onClick={call.requestNext} disabled={!call.live || call.speaking || call.muted || !current}>I am done, next question</Btn>
                  <Btn type="button" $plain onClick={stopCall}>End session</Btn>
                </Row>
              </Live>
            </div>

            <aside className="rail" aria-label="Session progress">
              <Side aria-labelledby="notes-h">
                <div className="headrow"><h2 id="notes-h">Coach notes</h2><span className="live">Live</span></div>
                {notes.length === 0 ? (
                  <p className="empty">Notes appear here after each answer.</p>
                ) : (
                  <ul aria-live="polite">
                    {notes.map((n) => (
                      <li key={n.questionIndex} className="note">
                        <div className="nq">{n.questionIndex}. {n.question || (list[n.questionIndex - 1]?.text || 'Question')}</div>
                        <NoteBlock note={n} />
                      </li>
                    ))}
                  </ul>
                )}
              </Side>
              <Side aria-labelledby="sess-h">
                <h2 id="sess-h">This session</h2>
                <ol>
                  {list.map((q, i) => (
                    <li key={q.id} className="qrow" data-s={states[i]} aria-current={states[i] === 'current' ? 'step' : undefined}>
                      <span className="qn">{states[i] === 'done' ? <CheckIcon /> : i + 1}</span>
                      <span className="qt">{q.text}</span>
                    </li>
                  ))}
                </ol>
              </Side>
            </aside>
          </div>
        )}

        {phase === 'ready' && !running && screen === 'done' && (
          <Card aria-labelledby="done-h">
            <Done>
              <h2 id="done-h">Your session</h2>
              <p className="summary">{finished?.summary || 'Here are the notes from your session.'}</p>
              {finished?.topTip && <div className="tip"><b>Top tip</b>{finished.topTip}</div>}
              <div className="meta">
                {notes.length} {notes.length === 1 ? 'question' : 'questions'} reviewed, {spokenDuration(ended?.seconds || 0)} in total.
                {saveState === 'saving' && ' Saving your notes...'}
                {saveState === 'saved' && ' Your notes were saved.'}
              </div>
              {saveState === 'failed' && <Note role="status">We could not save these notes just now. They are still on this screen.</Note>}
              {ended?.dropped && <Note role="status">The connection dropped, so the session ended early.</Note>}
              <ul className="notes">
                {notes.map((n) => (
                  <li key={n.questionIndex} className="n">
                    <div className="nq">{n.questionIndex}. {n.question || (list[n.questionIndex - 1]?.text || 'Question')}</div>
                    <NoteBlock note={n} />
                  </li>
                ))}
              </ul>
              <Row>
                <Btn type="button" onClick={begin}>Practice again</Btn>
                <Btn type="button" $ghost onClick={goPrep}>Back to your prep</Btn>
              </Row>
            </Done>
          </Card>
        )}
      </div>
    </Page>
  );
}
