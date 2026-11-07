import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { interviewPrepAPI } from '@/services/interviewPrep';
import {
  splitSpoken, firstLine, experienceLabel, canWrite, writePayload, nextRadioIndex, storyError, cleanStories, safeList, safeBeats,
} from './storyLogic';

const C = { ink: '#13152a', muted: '#6b7280', line: '#e8e9f0', brand: '#5b5fd6', soft: '#f0f0fc' };

const Wrap = styled.section`
  background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 16px; scroll-margin-top: 12px;
  h2 { margin: 0 0 4px; font-size: 18px; }
  h3 { margin: 0; font-size: 16px; }
  .sub { margin: 0 0 12px; font-size: 14.5px; color: ${C.muted}; line-height: 1.45; }
  .stack { display: flex; flex-direction: column; gap: 10px; }
  .busy { display: flex; align-items: center; gap: 12px; padding: 14px 0; font-size: 16px; color: ${C.ink}; }
  .err { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #fdf1e4; color: #8a4a08; font-size: 14.5px; line-height: 1.45; }
  .center { text-align: center; padding: 8px 0; }
  .center p { margin: 0 0 14px; font-size: 15.5px; line-height: 1.45; color: #4a4d63; }
  .divider { margin: 18px 0 10px; font-size: 14px; font-weight: 700; color: ${C.muted}; }
`;
const B = styled.button`
  min-height: 48px; padding: 0 20px; border-radius: 12px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
  border: ${(p) => (p.$ghost ? '1.5px solid #e2e4ec' : 'none')};
  background: ${(p) => (p.$ghost ? '#fff' : C.brand)};
  color: ${(p) => (p.$danger ? '#b3261e' : p.$ghost ? C.ink : '#fff')};
  width: 100%;
  &:disabled { opacity: 0.5; cursor: default; }
  @media (min-width: 600px) { width: ${(p) => (p.$auto ? 'auto' : '100%')}; }
`;
const Link = styled.button`
  border: none; background: none; padding: 10px 0; min-height: 44px; font: inherit; font-size: 14.5px; font-weight: 700; color: ${C.brand}; cursor: pointer;
`;
const TopicCard = styled.div`
  border: 1px solid ${C.line}; border-radius: 16px; padding: 14px; margin-top: 12px;
  .why { margin: 4px 0 12px; font-size: 14.5px; line-height: 1.45; color: #3b3e52; }
`;
const Radio = styled.div`
  display: block; text-align: left; min-height: 64px; padding: 12px 14px; border-radius: 14px; cursor: pointer; outline: none;
  border: 2px solid ${(p) => (p.$on ? C.brand : '#e2e4ec')}; background: ${(p) => (p.$on ? C.soft : '#fff')};
  &:focus-visible { box-shadow: 0 0 0 3px rgba(91, 95, 214, 0.35); }
  .t { font-size: 16px; font-weight: 700; line-height: 1.3; color: ${C.ink}; }
  .a { margin-top: 4px; font-size: 14.5px; line-height: 1.4; color: #3b3e52; }
  .f { margin-top: 6px; font-size: 13px; color: ${C.muted}; }
`;
const Compact = styled.button`
  display: block; width: 100%; text-align: left; min-height: 56px; padding: 12px 14px; border-radius: 14px; border: 1px solid ${C.line}; background: #fff; cursor: pointer; font: inherit;
  .t { font-size: 16px; font-weight: 700; color: ${C.ink}; line-height: 1.3; }
  .th { margin-top: 2px; font-size: 13px; font-weight: 600; color: ${C.brand}; }
  .l { margin-top: 4px; font-size: 14.5px; color: #3b3e52; line-height: 1.4; }
`;
const Card = styled.article`
  border: 1px solid ${C.line}; border-radius: 16px; padding: 14px; background: #fff;
  .theme { font-size: 13px; font-weight: 700; color: ${C.brand}; }
  .title { margin: 2px 0 10px; font-size: 18px; line-height: 1.3; }
  .spoken { font-size: 17px; line-height: 1.7; color: ${C.ink}; white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; border-radius: 14px; background: #fafaff; border: 1px solid ${C.line}; }
  .ph { background: #fff1b8; border-radius: 4px; padding: 0 3px; font-weight: 600; }
  textarea { width: 100%; box-sizing: border-box; min-height: 260px; padding: 12px 14px; font: inherit; font-size: 17px; line-height: 1.6; border: 1.5px solid #d5d8e3; border-radius: 12px; resize: vertical; }
  .needs { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #fdf1e4; color: #8a4a08; font-size: 14.5px; line-height: 1.45; }
  .needs strong { display: block; margin-bottom: 4px; }
  .needs ul, .tips ul { margin: 0; padding-left: 20px; }
  .tips { margin-top: 12px; font-size: 15px; line-height: 1.5; }
  .tips strong { display: block; margin-bottom: 4px; }
  .beat { margin-top: 10px; font-size: 15px; line-height: 1.5; }
  .beat b { display: block; font-size: 13px; color: ${C.brand}; text-transform: uppercase; letter-spacing: 0.03em; }
  .acts { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
  @media (min-width: 600px) { .acts { flex-direction: row; flex-wrap: wrap; } }
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
  const [beatsOpen, setBeatsOpen] = useState(false);
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
      {story.theme && <div className="theme">{story.theme}</div>}
      <h3 className="title">{story.title || 'Your story'}</h3>
      {editing ? (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit your story" />
          <div className="acts">
            <B type="button" $auto disabled={saving || !draft.trim()} onClick={save}>{saving ? 'Saving...' : 'Save'}</B>
            <B type="button" $ghost $auto disabled={saving} onClick={() => { setEditing(false); setDraft(story.spoken); setMsg(''); }}>Cancel</B>
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
          {beats.length > 0 && (
            <>
              <Link type="button" aria-expanded={beatsOpen} onClick={() => setBeatsOpen((v) => !v)}>
                {beatsOpen ? 'Hide how it is built' : 'How it is built'}
              </Link>
              {beatsOpen && beats.map((b, i) => (
                <div className="beat" key={i}>{b.label && <b>{b.label}</b>}{b.text}</div>
              ))}
            </>
          )}
          {tips.length > 0 && (
            <div className="tips">
              <strong>How to say it</strong>
              <ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {confirmDel ? (
            <div className="acts" role="alertdialog" aria-label="Confirm delete">
              <div style={{ fontSize: 15, width: '100%' }}>Delete this story? This cannot be undone.</div>
              <B type="button" $danger $ghost $auto disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Yes, delete'}</B>
              <B type="button" $ghost $auto disabled={busy} onClick={() => setConfirmDel(false)}>Keep it</B>
            </div>
          ) : (
            <div className="acts">
              <B type="button" $ghost $auto onClick={() => { setDraft(story.spoken); setEditing(true); }}>Edit</B>
              <B type="button" $ghost $auto onClick={copy}>{copied ? 'Copied' : 'Copy'}</B>
              <B type="button" $auto onClick={onPractice}>Practice out loud</B>
              <B type="button" $ghost $danger $auto onClick={() => setConfirmDel(true)}>Delete</B>
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
export default function Stories({ prepId, tailoredId, open, openSignal, onPractice }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const alive = useRef(true);
  const [stories, setStories] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | findingTopics | topics | writing
  const [topics, setTopics] = useState([]);
  const [sel, setSel] = useState(null);
  const [problem, setProblem] = useState(null); // { kind, message }
  const [lastAction, setLastAction] = useState('topics');

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!prepId) return;
    let live = true;
    interviewPrepAPI.listStories(prepId)
      .then((res) => { if (live) setStories(cleanStories(res.data?.stories)); })
      .catch(() => {});
    return () => { live = false; };
  }, [prepId]);

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

  const write = useCallback(async () => {
    const body = writePayload(tailoredId, topics, sel);
    if (!body) return;
    setLastAction('write'); setProblem(null); setPhase('writing');
    try {
      const res = await interviewPrepAPI.writeStory(prepId, body);
      if (!alive.current) return;
      const story = res.data?.story;
      if (!story || !story.id || !story.spoken) { setProblem({ kind: 'retry', message: '' }); setPhase('topics'); return; }
      setStories((prev) => cleanStories([story, ...prev.filter((s) => s.id !== story.id)]));
      setExpanded(story.id); setPhase('idle'); setSel(null);
    } catch (e) {
      if (!alive.current) return;
      setProblem(storyError(e)); setPhase(topics.length ? 'topics' : 'idle');
    }
  }, [prepId, tailoredId, topics, sel]);

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

  return (
    <Wrap ref={rootRef} aria-labelledby="stories-h">
      <h2 id="stories-h">Your stories</h2>

      {showFlow && !planBlocked && phase === 'idle' && (
        <>
          <p className="sub">A story is the best answer to most behavioral and experience questions. We will find the ones this interviewer cares about, using your real work.</p>
          <B type="button" onClick={findTopics}>{stories.length ? 'Write another' : 'Find my stories'}</B>
        </>
      )}

      <div aria-live="polite">
        {phase === 'findingTopics' && <div className="busy"><CircularProgress size={22} />Reading your experience against what candidates were asked</div>}
        {phase === 'writing' && <div className="busy"><CircularProgress size={22} />Writing it the way you would say it</div>}
      </div>

      {phase === 'topics' && (
        <>
          <p className="sub">Pick the story you want to tell. You can write more afterwards.</p>
          <TopicPicker topics={topics} sel={sel} onSelect={setSel} />
          <div className="stack" style={{ marginTop: 14 }}>
            <B type="button" disabled={!canWrite(topics, sel)} onClick={write}>Write this story</B>
          </div>
        </>
      )}

      {problemView}

      {stories.length > 0 && (
        <>
          <div className="divider">Saved stories ({stories.length})</div>
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
