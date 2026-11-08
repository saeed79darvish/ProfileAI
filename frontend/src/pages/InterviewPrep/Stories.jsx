import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { interviewPrepAPI } from '@/services/interviewPrep';
import NoteField from '@/components/flow/NoteField';
import {
  splitSpoken, firstLine, experienceLabel, canWrite, findSelection, writePayload, answersFor, nextRadioIndex, storyError, cleanStories, cleanQuestions, safeList, safeBeats, storyStep, stepStates,
} from './storyLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', soft: '#f0f0fc', ok: '#1f8f55', rule: '#d9dbe5' };

const Wrap = styled.section`
  container-type: inline-size;
  background: #fff; border: 1px solid ${C.line}; border-radius: 20px; padding: 18px; scroll-margin-top: 12px; color: ${C.ink};
  @container (min-width: 560px) { & { padding: 26px; } }
  h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  h3 { margin: 0; font-size: 16px; }
  .sub { margin: 0 0 14px; font-size: 15px; color: #4a4d63; line-height: 1.5; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .busy { display: flex; align-items: center; gap: 12px; padding: 14px 0; font-size: 16px; color: ${C.ink}; }
  .err { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #fdf1e4; color: #8a4a08; font-size: 14.5px; line-height: 1.45; }
  .center { text-align: center; padding: 8px 0; }
  .center p { margin: 0 0 14px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
  .divider { display: flex; align-items: baseline; justify-content: space-between; margin: 24px 0 12px; font-size: 18px; font-weight: 700; color: ${C.ink}; }
  .divider span { font-size: 13.5px; font-weight: 400; color: ${C.muted}; }
  .eyebrow { margin-bottom: 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: ${C.muted}; }
  .picked { margin: 0 0 18px; padding: 18px; border: 1px solid ${C.line}; border-radius: 16px; }
  .picked .pt { font-size: 18px; font-weight: 700; line-height: 1.35; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip { padding: 3px 10px; border-radius: 999px; background: ${C.soft}; color: #3b3f9e; font-size: 12.5px; font-weight: 600; }
  .chip.grey { background: #ecedf3; color: #3b3e52; }
  .q { margin-top: 22px; }
  .q:first-of-type { margin-top: 0; }
  .qt { font-size: 15.5px; font-weight: 700; line-height: 1.4; }
  .qh { margin-top: 2px; font-size: 13.5px; color: ${C.muted}; line-height: 1.4; }
  .qs { display: flex; flex-direction: column; gap: 22px; }
  .row { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  @container (min-width: 480px) { .row { flex-direction: row; flex-wrap: wrap; } }
`;
const B = styled.button`
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: ${(p) => (p.$sm ? '44px' : '48px')}; padding: 0 ${(p) => (p.$sm ? '18px' : '24px')}; border-radius: 12px; font: inherit; font-size: ${(p) => (p.$sm ? '15px' : '16px')}; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? `1.5px solid ${C.rule}` : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$danger ? '#b42318' : p.$ghost ? C.ink : '#fff')};
  width: 100%;
  &:disabled { opacity: 0.5; cursor: default; }
  &:focus-visible { outline: 3px solid rgba(91, 95, 214, 0.4); outline-offset: 2px; }
  @container (min-width: 480px) { & { width: ${(p) => (p.$auto ? 'auto' : '100%')}; } }
`;
const Link = styled.button`
  border: none; background: none; padding: 10px 0; min-height: 44px; font: inherit; font-size: 14.5px; font-weight: 700; color: ${C.brand}; cursor: pointer;
`;
const Steps = styled.ol`
  list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px;
  li { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: ${C.muted}; }
  li[data-state='current'] { color: #4b4fc4; font-weight: 700; }
  li[data-state='done'] { color: ${C.ink}; }
  .dot { flex: none; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; border: 2px solid ${C.rule}; color: ${C.muted}; box-sizing: border-box; }
  li[data-state='current'] .dot { background: ${C.brand}; border-color: ${C.brand}; color: #fff; }
  li[data-state='done'] .dot { background: ${C.ok}; border-color: ${C.ok}; color: #fff; }
  .bar { flex: none; width: 24px; height: 2px; background: ${C.line}; }
  .bar.on { background: #c9cbe6; }
  @container (max-width: 420px) { .bar { display: none; } }
`;
const TopicCard = styled.div`
  margin-top: 22px;
  &:first-of-type { margin-top: 0; }
  .why { margin: 4px 0 12px; font-size: 14.5px; line-height: 1.45; color: #4a4d63; }
`;
const Radio = styled.div`
  display: block; text-align: left; min-height: 64px; padding: 16px 18px; border-radius: 16px; cursor: pointer; outline: none;
  border: 2px solid ${(p) => (p.$on ? C.brand : C.line)}; background: ${(p) => (p.$on ? C.soft : '#fff')};
  &:focus-visible { box-shadow: 0 0 0 3px rgba(91, 95, 214, 0.35); }
  .t { font-size: 16px; font-weight: 700; line-height: 1.35; color: ${C.ink}; }
  .a { margin-top: 6px; font-size: 14.5px; line-height: 1.5; color: #4a4d63; }
  .f { display: inline-block; margin-top: 10px; padding: 3px 10px; border-radius: 999px; background: #ecedf3; color: #3b3e52; font-size: 12.5px; font-weight: 600; }
`;
const Compact = styled.button`
  display: block; width: 100%; text-align: left; min-height: 56px; padding: 16px; border-radius: 14px; border: 1px solid ${C.line}; background: #fff; cursor: pointer; font: inherit; color: ${C.ink};
  &:focus-visible { outline: 3px solid rgba(91, 95, 214, 0.4); outline-offset: 2px; }
  .t { font-size: 15.5px; font-weight: 700; line-height: 1.4; }
  .th { margin-top: 4px; font-size: 13.5px; color: ${C.muted}; }
  .l { margin-top: 6px; font-size: 14.5px; color: #4a4d63; line-height: 1.45; }
`;
const Card = styled.article`
  .head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .label { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: #4b4fc4; }
  .saved { padding: 3px 10px; border-radius: 999px; background: #e5f6ec; color: #1f7a49; font-size: 12px; font-weight: 700; }
  .title { margin: 0 0 14px; font-size: 20px; font-weight: 700; line-height: 1.35; }
  .spoken { font-size: 17.5px; line-height: 1.75; color: ${C.ink}; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ph { background: #fdecc8; color: #8a4a08; border-radius: 6px; padding: 1px 6px; font-weight: 600; }
  textarea { width: 100%; box-sizing: border-box; min-height: 260px; padding: 12px 14px; font: inherit; font-size: 17px; line-height: 1.6; border: 1.5px solid ${C.rule}; border-radius: 12px; resize: vertical; }
  .needs { margin: 18px 0 0; padding: 14px 16px; border-radius: 12px; background: #fff7e8; border: 1px solid #f1d9b8; color: #5e3a0a; font-size: 14px; line-height: 1.5; }
  .needs strong { display: block; margin-bottom: 4px; font-size: 13px; color: #8a4a08; }
  .needs ul { margin: 0; padding-left: 18px; }
  .acts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  .acts > * { flex: 1 1 140px; }
  .acts .full { flex-basis: 100%; font-size: 15px; }
  @container (min-width: 560px) { .acts > * { flex: 0 0 auto; } }
  .panel { margin-top: 20px; padding: 20px; border: 1px solid ${C.line}; border-radius: 16px; }
  .panel h4 { margin: 0 0 14px; font-size: 17px; font-weight: 700; }
  .tip { display: flex; gap: 12px; align-items: flex-start; margin-top: 12px; font-size: 15px; line-height: 1.5; }
  .tip:first-of-type { margin-top: 0; }
  .num { flex: none; width: 22px; height: 22px; border-radius: 50%; background: ${C.soft}; color: #4b4fc4; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .built { margin-top: 18px; padding-top: 16px; border-top: 1px solid #eef0f5; }
  .built.alone { margin-top: 0; padding-top: 0; border-top: none; }
  .built h5 { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  @container (min-width: 560px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .beat { padding: 10px; border-radius: 10px; background: #f8f9fc; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
  .beat b { display: block; margin-bottom: 2px; }
`;

function Spoken({ text }) {
  return (
    <div className="spoken">
      {splitSpoken(text).map((s, i) => (s.placeholder ? <mark key={i} className="ph">{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </div>
  );
}

function StoryCard({ story, prepId, onChanged, onDeleted, onPractice, onError }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(story.spoken);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const beats = safeBeats(story.beats);
  const tips = safeList(story.tips);
  const needs = safeList(story.needsYou);

  const save = async () => {
    const spoken = draft.trim();
    if (!spoken) { setMsg('The story cannot be empty.'); return; }
    setSaving(true); setMsg('');
    try {
      const res = await interviewPrepAPI.updateStory(prepId, story.id, spoken);
      onChanged(res.data?.story && res.data.story.id ? res.data.story : { ...story, spoken });
      setEditing(false);
    } catch (e) {
      const er = storyError(e);
      if (er.kind === 'retry') setMsg('We could not save that. Please try again.');
      else onError(er);
    } finally { setSaving(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(story.spoken); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setMsg('Copy is not available here. Select the text and copy it.'); }
  };
  const remove = async () => {
    setBusy(true); setMsg('');
    try { await interviewPrepAPI.deleteStory(prepId, story.id); onDeleted(story.id); } catch { setMsg('We could not delete that. Please try again.'); setBusy(false); }
  };

  return (
    <Card aria-label={`Story: ${story.title || 'Untitled'}`}>
      <div className="head">
        <div className="label">YOUR STORY, ABOUT A MINUTE OUT LOUD</div>
        <span className="saved">Saved</span>
      </div>
      <h3 className="title">{story.title || 'Your story'}</h3>
      {editing ? (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit your story" />
          <div className="acts">
            <B type="button" $sm $auto disabled={saving || !draft.trim()} onClick={save}>{saving ? 'Saving...' : 'Save'}</B>
            <B type="button" $sm $ghost $auto disabled={saving} onClick={() => { setEditing(false); setDraft(story.spoken); setMsg(''); }}>Cancel</B>
          </div>
        </>
      ) : (
        <>
          <Spoken text={story.spoken} />
          {needs.length > 0 && (
            <div className="needs">
              <strong>Add your own details</strong>
              <ul>{needs.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
          {confirmDel ? (
            <div className="acts" role="alertdialog" aria-label="Confirm delete">
              <div className="full">Delete this story? This cannot be undone.</div>
              <B type="button" $sm $danger $ghost $auto disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Yes, delete'}</B>
              <B type="button" $sm $ghost $auto disabled={busy} onClick={() => setConfirmDel(false)}>Keep it</B>
            </div>
          ) : (
            <div className="acts">
              <B type="button" $sm $ghost $auto onClick={() => { setDraft(story.spoken); setEditing(true); }}>Edit</B>
              <B type="button" $sm $ghost $auto onClick={copy}>{copied ? 'Copied' : 'Copy'}</B>
              <B type="button" $sm $auto onClick={onPractice}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                Practice out loud
              </B>
              <B type="button" $sm $ghost $danger $auto onClick={() => setConfirmDel(true)}>Delete</B>
            </div>
          )}
          {(tips.length > 0 || beats.length > 0) && (
            <div className="panel">
              {tips.length > 0 && (
                <>
                  <h4>How to say it</h4>
                  <div>
                    {tips.map((t, i) => (
                      <div className="tip" key={i}><span className="num" aria-hidden="true">{i + 1}</span><span>{t}</span></div>
                    ))}
                  </div>
                </>
              )}
              {beats.length > 0 && (
                <div className={tips.length ? 'built' : 'built alone'}>
                  <h5>How it is built</h5>
                  <div className="grid">
                    {beats.map((b, i) => (
                      <div className="beat" key={i}>{b.label && <b>{b.label}</b>}{b.text}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div aria-live="polite">{msg && <div className="err">{msg}</div>}</div>
    </Card>
  );
}

function TopicPicker({ topics, sel, onSelect }) {
  const refs = useRef({});
  return topics.map((t) => (
    <TopicCard key={t.id}>
      <h3>{t.theme}</h3>
      {t.why && <p className="why">{t.why}</p>}
      <div className="stack" role="radiogroup" aria-label={`Story options for ${t.theme}`}>
        {(t.titles || []).map((ti, i, arr) => {
          const on = sel?.topicId === t.id && sel?.titleId === ti.id;
          // Roving tabindex: the selected one, or the first when this group has no selection.
          const groupHas = sel?.topicId === t.id;
          const tab = on || (!groupHas && i === 0) ? 0 : -1;
          const pick = (idx) => { const nx = arr[idx]; if (nx) { onSelect({ topicId: t.id, titleId: nx.id }); refs.current[`${t.id}:${nx.id}`]?.focus(); } };
          const from = experienceLabel(ti.experienceRef);
          return (
            <Radio
              key={ti.id}
              ref={(el) => { refs.current[`${t.id}:${ti.id}`] = el; }}
              role="radio"
              aria-checked={on}
              tabIndex={tab}
              $on={on}
              onClick={() => onSelect({ topicId: t.id, titleId: ti.id })}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onSelect({ topicId: t.id, titleId: ti.id }); return; }
                const n = nextRadioIndex(e.key, i, arr.length);
                if (n != null) { e.preventDefault(); pick(n); }
              }}
            >
              <div className="t">{ti.title}</div>
              {ti.angle && <div className="a">{ti.angle}</div>}
              {from && <div className="f">{from}</div>}
            </Radio>
          );
        })}
      </div>
    </TopicCard>
  ));
}

// open: user tapped "Build my stories". Saved stories always show once loaded.
export default function Stories({ prepId, tailoredId, open, openSignal, onPractice, onStoriesChange }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const alive = useRef(true);
  const [stories, setStories] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const changeRef = useRef(onStoriesChange);
  const [expanded, setExpanded] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | findingTopics | topics | details | writing
  const [details, setDetails] = useState('');
  const [questions, setQuestions] = useState([]); // the coach's questions about the chosen story
  const [answerMap, setAnswerMap] = useState({});
  const [askingQuestions, setAskingQuestions] = useState(false);
  const [topics, setTopics] = useState([]);
  const [sel, setSel] = useState(null);
  const [problem, setProblem] = useState(null); // { kind, message }
  const [lastAction, setLastAction] = useState('topics');

  changeRef.current = onStoriesChange;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!prepId) return;
    let live = true;
    interviewPrepAPI.listStories(prepId)
      .then((res) => { if (live) { setStories(cleanStories(res.data?.stories)); setLoaded(true); } })
      .catch(() => {});
    return () => { live = false; };
  }, [prepId]);

  // Tell the page about the saved stories after the first load and after every add, edit or delete.
  useEffect(() => {
    if (loaded && typeof changeRef.current === 'function') changeRef.current(stories);
  }, [stories, loaded]);

  useEffect(() => {
    if (openSignal && rootRef.current) rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openSignal]);

  const findTopics = useCallback(async () => {
    setLastAction('topics'); setProblem(null); setPhase('findingTopics'); setSel(null);
    try {
      const res = await interviewPrepAPI.storyTopics(prepId, tailoredId);
      if (!alive.current) return;
      const list = (Array.isArray(res.data?.topics) ? res.data.topics : []).filter((t) => t && t.id && Array.isArray(t.titles) && t.titles.length);
      if (!list.length) { setProblem({ kind: 'message', message: 'We could not find a story topic from your experience yet. Add more detail to your resume and try again.' }); setPhase('idle'); return; }
      setTopics(list); setPhase('topics');
    } catch (e) {
      if (!alive.current) return;
      setProblem(storyError(e)); setPhase('idle');
    }
  }, [prepId, tailoredId]);

  // After a title is picked, the coach asks a few questions about that story before it writes.
  const askQuestions = useCallback(async () => {
    const picked = findSelection(topics, sel);
    if (!picked) return;
    setProblem(null); setQuestions([]); setAnswerMap({}); setDetails('');
    setAskingQuestions(true); setPhase('details');
    try {
      const res = await interviewPrepAPI.storyQuestions(prepId, {
        tailoredProfileId: tailoredId, theme: picked.topic.theme, title: picked.title.title, experienceRef: picked.title.experienceRef || {},
      });
      if (!alive.current) return;
      const list = cleanQuestions(res.data?.questions);
      setQuestions(list); // none: the page falls back to one free box
    } catch (e) {
      if (!alive.current) return;
      const pr = storyError(e);
      if (pr.kind === 'upgrade' || pr.kind === 'limit') { setProblem(pr); setPhase('topics'); } // a plan problem is shown, not hidden
    } finally {
      if (alive.current) setAskingQuestions(false);
    }
  }, [prepId, tailoredId, topics, sel]);

  const write = useCallback(async () => {
    const body = writePayload(tailoredId, topics, sel, questions.length ? answersFor(questions, answerMap) : details);
    if (!body) return;
    setLastAction('write'); setProblem(null); setPhase('writing');
    try {
      const res = await interviewPrepAPI.writeStory(prepId, body);
      if (!alive.current) return;
      const story = res.data?.story;
      if (!story || !story.id || !story.spoken) { setProblem({ kind: 'retry', message: '' }); setPhase('topics'); return; }
      setStories((prev) => cleanStories([story, ...prev.filter((s) => s.id !== story.id)]));
      setExpanded(story.id); setPhase('idle'); setSel(null); setDetails(''); setQuestions([]); setAnswerMap({});
    } catch (e) {
      if (!alive.current) return;
      setProblem(storyError(e)); setPhase(topics.length ? 'details' : 'idle');
    }
    // questions, answerMap and details must be here: without them the memoized copy sends the story
    // request with no answers at all, and a retry sends the same stale copy.
  }, [prepId, tailoredId, topics, sel, questions, answerMap, details]);

  const retry = () => (lastAction === 'write' ? write() : findTopics());

  const visible = open || stories.length > 0;
  if (!visible) return null;
  const showFlow = open || phase !== 'idle';

  const upsert = (s) => setStories((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...s } : x)));
  const drop = (id) => { setStories((prev) => prev.filter((x) => x.id !== id)); setExpanded((e) => (e === id ? null : e)); };

  let problemView = null;
  if (problem && (problem.kind === 'upgrade' || problem.kind === 'limit')) {
    problemView = (
      <div className="center">
        <h3 style={{ marginBottom: 8 }}>{problem.kind === 'upgrade' ? 'Interview stories are part of Pro' : 'You have used this month’s AI allowance'}</h3>
        <p>{problem.kind === 'upgrade' ? 'Pro writes stories from your real work, tuned to what this interviewer asks.' : 'Your allowance renews next month. Pro Plus includes more each month.'}</p>
        <B type="button" onClick={() => navigate('/pricing')}>See plans</B>
      </div>
    );
  } else if (problem) {
    problemView = (
      <div className="err" role="alert">
        {problem.kind === 'message' ? problem.message : 'Something went wrong on our side. Please try again.'}
        {problem.kind === 'retry' && <div style={{ marginTop: 8 }}><B type="button" $auto onClick={retry}>Try again</B></div>}
      </div>
    );
  }
  const planBlocked = problem && (problem.kind === 'upgrade' || problem.kind === 'limit');

  const stepStatesNow = stepStates(storyStep(phase, expanded != null && stories.some((x) => x.id === expanded)));
  const stepNames = ['Pick a story', 'Make it yours', 'Your story'];
  const check = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7" /></svg>;

  return (
    <Wrap ref={rootRef} aria-labelledby="stories-h">
      <h2 id="stories-h">Your stories</h2>
      <p className="sub">A story is the best answer to most experience questions. We build each one from your real work, in words you would actually say.</p>

      <Steps aria-label="Story steps">
        {stepNames.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && <li className={`bar${stepStatesNow[i] !== 'todo' ? ' on' : ''}`} aria-hidden="true" role="presentation" />}
            <li data-state={stepStatesNow[i]} aria-current={stepStatesNow[i] === 'current' ? 'step' : undefined}>
              <span className="dot">{stepStatesNow[i] === 'done' ? check : i + 1}</span>
              <span>{n}{stepStatesNow[i] === 'done' ? ' (done)' : ''}</span>
            </li>
          </React.Fragment>
        ))}
      </Steps>

      {showFlow && !planBlocked && phase === 'idle' && (
        <B type="button" $auto onClick={findTopics}>{stories.length ? 'Write another story' : 'Find my stories'}</B>
      )}

      <div aria-live="polite">
        {phase === 'findingTopics' && <div className="busy"><CircularProgress size={22} />Reading your experience against what candidates were asked</div>}
        {phase === 'writing' && <div className="busy"><CircularProgress size={22} />Writing it the way you would say it</div>}
      </div>

      {phase === 'topics' && (
        <>
          <p className="sub">Pick the story you want to tell. You can write more afterwards.</p>
          <TopicPicker topics={topics} sel={sel} onSelect={setSel} />
          <div className="row">
            <B type="button" $auto disabled={!canWrite(topics, sel)} onClick={askQuestions}>Continue</B>
          </div>
        </>
      )}

      {phase === 'details' && (() => {
        const picked = findSelection(topics, sel);
        const title = picked ? picked.title.title : '';
        const from = picked ? experienceLabel(picked.title.experienceRef) : '';
        const answered = questions.length ? answersFor(questions, answerMap).length : details.trim() ? 1 : 0;
        return (
          <>
            {picked && (
              <div className="picked">
                <div className="eyebrow">YOU PICKED</div>
                <div className="pt">{title}</div>
                <div className="chips">
                  {picked.topic.theme && <span className="chip">{picked.topic.theme}</span>}
                  {from && <span className="chip grey">{from}</span>}
                </div>
              </div>
            )}
            <h3 style={{ fontSize: 20 }}>Make it yours</h3>
            <p className="sub" style={{ marginTop: 6 }}>
              A few questions so the story is really yours. Answer the ones you can, the way you would tell a friend, or tap the mic and talk. Skip any you like.
            </p>
            {askingQuestions && <div className="busy" aria-live="polite"><CircularProgress size={22} />Thinking about what to ask you</div>}
            {!askingQuestions && questions.length > 0 && (
              <div className="qs">
                {questions.map((q) => (
                  <div key={q.id}>
                    <div className="qt">{q.question}</div>
                    {q.hint && <div className="qh">{q.hint}</div>}
                    <NoteField
                      multiline
                      value={answerMap[q.id] || ''}
                      onChange={(v) => setAnswerMap((m) => ({ ...m, [q.id]: v }))}
                      maxLength={600}
                      hints={`${title}. ${q.question}`}
                      label={q.question}
                      placeholder="Type or tap the mic"
                    />
                  </div>
                ))}
              </div>
            )}
            {!askingQuestions && questions.length === 0 && (
              <NoteField
                multiline
                value={details}
                onChange={setDetails}
                maxLength={1200}
                hints={title}
                label="Your own words about this story"
                placeholder="What was the real problem, what did you do, and what changed? Numbers help."
              />
            )}
            <div className="row">
              <B type="button" $auto disabled={askingQuestions} onClick={write}>{answered ? 'Write my story' : 'Write it without extra details'}</B>
              <B type="button" $auto $ghost onClick={() => { setProblem(null); setPhase('topics'); }}>Back to titles</B>
            </div>
          </>
        );
      })()}

      {problemView}

      {stories.length > 0 && (
        <>
          <div className="divider">Saved stories<span>{stories.length} for this prep</span></div>
          <div className="stack">
            {stories.map((s) => (expanded === s.id ? (
              <div key={s.id}>
                <StoryCard
                  story={s}
                  prepId={prepId}
                  onChanged={upsert}
                  onDeleted={drop}
                  onPractice={onPractice}
                  onError={setProblem}
                />
                <Link type="button" onClick={() => setExpanded(null)}>Close story</Link>
              </div>
            ) : (
              <Compact key={s.id} type="button" aria-expanded="false" onClick={() => setExpanded(s.id)}>
                <div className="t">{s.title || 'Your story'}</div>
                {s.theme && <div className="th">{s.theme}</div>}
                <div className="l">{firstLine(s.spoken)}</div>
              </Compact>
            )))}
          </div>
        </>
      )}
    </Wrap>
  );
}
