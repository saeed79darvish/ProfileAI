import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { interviewPrepAPI } from '@/services/interviewPrep';
import {
  LANGUAGES, MAX_CODE, codeQuestions, applyTab, canReview, reviewBody, verdictTag, cleanAttempts, cleanAttempt, attemptsFor, attemptsLabel, reviewError,
} from './codeLogic';

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
const Center = styled.div`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 28px 20px; text-align: center;
  h2 { margin: 0 0 8px; font-size: 19px; }
  p { margin: 0 0 16px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
`;
const Btn = styled.button`
  min-height: 48px; padding: 0 22px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #d9dbe5' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$ghost ? C.ink : '#fff')};
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
`;
const Row = styled.div`
  display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; align-items: center;
  @media (max-width: 480px) { button { flex: 1 1 100%; } }
`;
const Note = styled.div`
  margin-top: 14px; padding: 10px 12px; border-radius: 12px; font-size: 14.5px; line-height: 1.45;
  background: ${(p) => (p.$info ? C.soft : '#fdf1e4')}; color: ${(p) => (p.$info ? '#3b3f9e' : '#8a4a08')};
`;
const Pick = styled.ul`
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;
  button { width: 100%; text-align: left; font: inherit; font-size: 15px; font-weight: 600; line-height: 1.4; padding: 12px 14px; border-radius: 12px; cursor: pointer;
    border: 1.5px solid ${C.line}; background: #f8f9fc; color: ${C.ink}; overflow-wrap: anywhere; min-height: 44px; }
  button[aria-pressed='true'] { border-color: ${C.brand}; background: ${C.soft}; }
  button:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
  .n { display: block; margin-top: 4px; font-size: 12.5px; font-weight: 600; color: ${C.muted}; }
`;
const Field = styled.div`
  display: flex; flex-direction: column; gap: 6px; margin-top: 14px;
  label { font-size: 13px; font-weight: 700; color: #3b3e52; }
  input, select { font: inherit; font-size: 15px; min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1.5px solid #d9dbe5; background: #fff; color: ${C.ink}; box-sizing: border-box; }
  input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 1px; }
`;
const Editor = styled.textarea`
  width: 100%; box-sizing: border-box; min-height: 340px; resize: vertical; padding: 16px; border-radius: 14px; border: 1.5px solid #d9dbe5;
  background: #14162b; color: #e8eaff; caret-color: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; line-height: 1.6;
  tab-size: 2; white-space: pre; overflow: auto; margin-top: 8px;
`;
const Review = styled.div`
  .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .chip { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
  .sum { margin: 0 0 14px; font-size: 16px; line-height: 1.55; }
  h3 { margin: 18px 0 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; color: #3b3e52; }
  ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.5; }
  .fix { color: ${C.muted}; }
  pre { margin: 8px 0 0; padding: 16px; border-radius: 14px; background: #14162b; color: #e8eaff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13.5px; line-height: 1.6; overflow: auto; white-space: pre; }
`;
const Side = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 20px; box-sizing: border-box;
  h2 { margin: 0 0 14px; font-size: 18px; font-weight: 700; }
  .empty { margin: 0; font-size: 14.5px; line-height: 1.45; color: ${C.muted}; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  button { width: 100%; text-align: left; font: inherit; padding: 12px; border-radius: 12px; border: 1.5px solid ${C.line}; background: #f8f9fc; cursor: pointer; min-height: 44px; color: ${C.ink}; }
  button[aria-pressed='true'] { border-color: ${C.brand}; background: ${C.soft}; }
  button:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
  .d { font-size: 13px; color: ${C.muted}; }
  .q { margin-top: 4px; font-size: 14px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
  .chip { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
`;

const Svg = ({ children, width = 2 }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ChevronLeft = () => <Svg width={2.4}><path d="M15 6l-6 6 6 6" /></Svg>;

const when = (iso) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

export default function CodePractice() {
  const { prepId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | missing | failed | pending | ready
  const [prep, setPrep] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [question, setQuestion] = useState(() => (search.get('question') || '').slice(0, 400)); // sent from the Questions page
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState(null); // the attempt whose review is on screen
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const area = useRef(null);
  const caret = useRef(null);

  useEffect(() => {
    let alive = true;
    setPhase('loading'); setPrep(null); setAttempts([]);
    interviewPrepAPI.get(prepId).then((res) => {
      if (!alive) return;
      const d = res.data || {};
      if (d.status === 'ready' && d.prep) { setPrep(d.prep); setPhase('ready'); } else if (d.status === 'failed') setPhase('failed'); else setPhase('pending');
    }).catch((e) => { if (alive) setPhase(e?.response?.status === 404 ? 'missing' : 'failed'); });
    interviewPrepAPI.listCodeAttempts(prepId).then((res) => { if (alive) setAttempts(cleanAttempts(res.data?.attempts)); }).catch(() => {});
    return () => { alive = false; };
  }, [prepId]);

  useEffect(() => {
    if (caret.current && area.current) {
      area.current.selectionStart = caret.current.start;
      area.current.selectionEnd = caret.current.end;
      caret.current = null;
    }
  }, [code]);

  const questions = useMemo(() => codeQuestions(prep), [prep]);
  const heading = prep ? [prep.scope === 'role' ? '' : prep.company, prep.role].filter((x) => typeof x === 'string' && x).join(', ') : '';
  const goPrep = () => navigate(`/interview-prep/prep/${prepId}`);
  const mine = attemptsFor(attempts, question);

  const pick = (text) => { setQuestion(text); setCurrent(null); setErr(null); };
  const onKeyDown = (e) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const t = e.currentTarget;
    const next = applyTab(code, t.selectionStart, t.selectionEnd, e.shiftKey);
    caret.current = { start: next.start, end: next.end };
    setCode(next.value);
  };

  const submit = async () => {
    if (busy || !canReview(question, code)) return;
    setBusy(true); setErr(null);
    try {
      const res = await interviewPrepAPI.reviewCode(prepId, reviewBody({ question, language, code }));
      const saved = cleanAttempt(res.data?.attempt);
      if (!saved) throw new Error('empty');
      setAttempts((list) => [saved, ...list]);
      setCurrent(saved);
    } catch (e) {
      setErr(reviewError(e));
    } finally {
      setBusy(false);
    }
  };

  const openAttempt = (a) => { setQuestion(a.question); setLanguage(a.language); setCode(a.code); setCurrent(a); setErr(null); };
  const tryImproved = () => { if (current && current.review.improved) { setCode(current.review.improved); setCurrent(null); } };

  const r = current ? current.review : null;
  const tag = r ? verdictTag(r.verdict) : null;

  return (
    <Page>
      <div className="wrap">
        <Back type="button" onClick={goPrep}><ChevronLeft />{heading ? `Back to ${heading}` : 'Back to your prep'}</Back>
        <Title>
          <h1>Code practice</h1>
          <p className="sub">{heading || 'Write your answer. We read it and review it like an interviewer would.'}</p>
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
            <p>Code practice opens once the research has finished.</p>
            <Btn type="button" onClick={goPrep}>Back to your prep</Btn>
          </Center>
        )}

        {phase === 'ready' && (
          <div className="layout">
            <div className="main">
              <Card aria-labelledby="pick-h">
                <h2 id="pick-h">Pick a question</h2>
                <p className="sub">{questions.length ? 'These coding questions came up in the research.' : 'The research has no coding questions for this one. Write your own below.'}</p>
                {questions.length > 0 && (
                  <Pick>
                    {questions.map((q) => {
                      const n = attemptsFor(attempts, q.text).length;
                      return (
                        <li key={q.id}>
                          <button type="button" aria-pressed={question === q.text} onClick={() => pick(q.text)}>
                            {q.text}
                            {n > 0 && <span className="n">{attemptsLabel(n)} so far</span>}
                          </button>
                        </li>
                      );
                    })}
                  </Pick>
                )}
                <Field>
                  <label htmlFor="own-q">Or type any question</label>
                  <input id="own-q" type="text" maxLength={400} value={question} onChange={(e) => pick(e.target.value)} placeholder="For example: implement a debounce function" />
                </Field>
              </Card>

              <Card aria-labelledby="code-h">
                <h2 id="code-h">Your answer</h2>
                <p className="sub">We do not run your code. We read it, like an interviewer would, and tell you what to fix.</p>
                <Field style={{ marginTop: 0, maxWidth: 240 }}>
                  <label htmlFor="lang">Language</label>
                  <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </Field>
                <Editor
                  ref={area} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown} maxLength={MAX_CODE}
                  spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label="Code editor" placeholder="Write your answer here"
                />
                {err && (
                  <Note role="alert">
                    <b>{err.title}.</b> {err.body}
                    {err.plans && <div style={{ marginTop: 10 }}><Btn type="button" onClick={() => navigate('/pricing')}>See plans</Btn></div>}
                  </Note>
                )}
                <Row>
                  <Btn type="button" onClick={submit} disabled={busy || !canReview(question, code)}>{busy ? 'Reviewing' : 'Get my review'}</Btn>
                  {busy && <CircularProgress size={22} aria-label="Reviewing" />}
                </Row>
                {!question.trim() && code.trim().length > 0 && <Note $info>Pick or type a question first, so the review knows what you were asked.</Note>}
              </Card>

              {r && (
                <Card aria-labelledby="rev-h" role="region">
                  <Review>
                    <div className="head">
                      <h2 id="rev-h" style={{ margin: 0 }}>Your review</h2>
                      <span className="chip" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                    </div>
                    {r.summary && <p className="sum">{r.summary}</p>}
                    {r.worked.length > 0 && (<><h3>What worked</h3><ul>{r.worked.map((w, i) => <li key={i}>{w}</li>)}</ul></>)}
                    {r.issues.length > 0 && (
                      <>
                        <h3>What to fix</h3>
                        <ul>{r.issues.map((i, k) => <li key={k}>{i.what}{i.fix && <div className="fix">{i.fix}</div>}</li>)}</ul>
                      </>
                    )}
                    {r.complexity && (<><h3>Speed and memory</h3><p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{r.complexity}</p></>)}
                    {r.tips.length > 0 && (<><h3>Say this out loud next time</h3><ul>{r.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></>)}
                    {r.improved && (<><h3>An improved version</h3><pre>{r.improved}</pre></>)}
                    <Row>
                      {r.improved && <Btn type="button" onClick={tryImproved}>Try the improved version</Btn>}
                      <Btn type="button" $ghost onClick={goPrep}>Back to your prep</Btn>
                    </Row>
                  </Review>
                </Card>
              )}
            </div>

            <aside className="rail" aria-label="Your attempts">
              <Side>
                <h2>Your attempts</h2>
                {mine.length === 0 && (
                  <p className="empty">{question.trim() ? 'No attempts on this question yet. Your reviews are saved here for next time.' : 'Pick a question to see your earlier attempts. Every review is saved for next time.'}</p>
                )}
                {mine.length > 0 && (
                  <ul>
                    {mine.map((a) => {
                      const t = verdictTag(a.review.verdict);
                      return (
                        <li key={a.id}>
                          <button type="button" aria-pressed={current && current.id === a.id} onClick={() => openAttempt(a)}>
                            <div className="d">{when(a.createdAt)}</div>
                            <div className="q">{a.review.summary || 'Reviewed'}</div>
                            <span className="chip" style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Side>
            </aside>
          </div>
        )}
      </div>
    </Page>
  );
}
