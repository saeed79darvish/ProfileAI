import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  useTrainingState,
  sendTrainingMessage,
  advanceTrainingTopic,
  resetTraining,
} from '../../hooks/useApplyPilot';
import { applyPilotAPI } from '../../services/api';

/* ================================================================
   ApplyPilot · Coach (chat-based agent training)

   Lives at /applypilot/agent/coach. Drives the
   /api/applypilot/training/* endpoints already implemented in
   backend/routes/applyPilot.js. Each user reply is persisted as
   ApplyPilotTrainingMessage; the backend asks Claude for the next
   coach question and may persist new ApplyPilotTrainingMemory rows.
   Those memory rows are passed to Claude during form-fill so the
   agent can answer screener questions like "EXPORT CONTROLS" or
   "Why us?" in your own voice on every future application.
   ================================================================ */

const BRAND = '#7C5CFF';
const BRAND_50 = '#F2EEFF';
const BRAND_100 = '#E4DBFF';
const BRAND_600 = '#6D4AE8';
const INK_900 = '#0E0B1F';
const INK_500 = '#6B6787';
const INK_400 = '#8A87A3';
const LINE = '#E9E7EF';
const BG = '#FAFAFC';
const GOOD = '#1DA34A';

const Wrap = styled.div`
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    padding: 16px;
  }
`;

const ChatCard = styled.div`
  background: #fff;
  border: 1px solid ${LINE};
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(16,12,40,.04);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  min-height: 520px;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 18px 22px;
  border-bottom: 1px solid ${LINE};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: ${INK_900};
    letter-spacing: -0.01em;
  }
  p {
    margin: 2px 0 0;
    font-size: 12.5px;
    color: ${INK_500};
  }
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, ${BRAND} 0%, #B8A3FF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  letter-spacing: -0.02em;
`;

const ResetBtn = styled.button`
  background: transparent;
  border: 1px solid ${LINE};
  color: ${INK_500};
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 8px;
  padding: 7px 12px;
  cursor: pointer;
  &:hover { background: ${BG}; color: ${INK_900}; }
`;

const TopicStrip = styled.div`
  padding: 14px 22px;
  border-bottom: 1px solid ${LINE};
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: ${BG};
`;

const TopicChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? BRAND : p.$done ? '#C8E9D5' : LINE)};
  background: ${(p) => (p.$active ? BRAND_50 : p.$done ? '#E5F9EE' : '#fff')};
  color: ${(p) => (p.$active ? BRAND_600 : p.$done ? GOOD : INK_500)};
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all .12s;
  &:hover { border-color: ${BRAND}; color: ${BRAND_600}; }

  span.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  span.pct {
    font-size: 11px;
    color: ${INK_400};
    font-weight: 500;
  }
`;

const Stream = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Bubble = styled.div`
  max-width: 78%;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.5;
  border-radius: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;

  ${(p) => p.$role === 'me'
    ? `
      align-self: flex-end;
      background: ${BRAND};
      color: #fff;
      border-bottom-right-radius: 4px;
    `
    : `
      align-self: flex-start;
      background: ${BG};
      color: ${INK_900};
      border: 1px solid ${LINE};
      border-bottom-left-radius: 4px;
    `}
`;

const Empty = styled.div`
  color: ${INK_500};
  font-size: 14px;
  text-align: center;
  padding: 40px 20px;
  line-height: 1.55;

  strong { color: ${INK_900}; }
`;

const Composer = styled.form`
  border-top: 1px solid ${LINE};
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: #fff;
`;

const Input = styled.textarea`
  flex: 1;
  resize: none;
  min-height: 64px;
  max-height: 160px;
  padding: 10px 12px;
  border: 1px solid ${LINE};
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  line-height: 1.4;
  color: ${INK_900};
  outline: none;
  background: ${BG};
  white-space: pre-wrap;
  &::placeholder { white-space: pre-line; }
  &:focus { border-color: ${BRAND}; background: #fff; }
  @media (min-width: 720px) {
    min-height: 48px;
  }
`;

const SendBtn = styled.button`
  background: ${BRAND};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0 18px;
  height: 42px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  &:disabled { opacity: .5; cursor: not-allowed; }
  &:hover:not(:disabled) { background: ${BRAND_600}; }
`;

const Side = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SideCard = styled.div`
  background: #fff;
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 16px;
`;

const SideTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${INK_900};
  margin-bottom: 4px;
  letter-spacing: -0.01em;
`;

const SideSub = styled.div`
  font-size: 12px;
  color: ${INK_500};
  margin-bottom: 12px;
  line-height: 1.5;
`;

const MemoryRow = styled.div`
  padding: 10px 0;
  border-top: 1px solid ${LINE};
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  &:first-of-type { border-top: none; padding-top: 0; }

  .k {
    font-size: 11.5px;
    text-transform: uppercase;
    color: ${INK_400};
    letter-spacing: 0.04em;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .v {
    font-size: 13px;
    color: ${INK_900};
    line-height: 1.45;
    word-break: break-word;
  }
  button {
    background: transparent;
    border: none;
    color: ${INK_400};
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    &:hover { color: #C42B35; }
  }
`;

const RingWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
`;

const Ring = styled.div`
  --p: ${(p) => p.$pct || 0};
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background:
    conic-gradient(${BRAND} calc(var(--p) * 1%), ${BRAND_50} 0);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    inset: 5px;
    background: #fff;
    border-radius: 50%;
  }
  span {
    position: relative;
    z-index: 1;
    font-size: 12px;
    font-weight: 800;
    color: ${BRAND_600};
  }
`;

const Typing = styled.div`
  align-self: flex-start;
  display: inline-flex;
  gap: 4px;
  padding: 12px 14px;
  background: ${BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  border-bottom-left-radius: 4px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${INK_400};
    animation: bounce 1.2s infinite ease-in-out both;
  }
  span:nth-child(2) { animation-delay: .15s; }
  span:nth-child(3) { animation-delay: .3s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: .4; }
    40% { transform: translateY(-4px); opacity: 1; }
  }
`;

/* ================================================================ */
const CoachPage = () => {
  const { data, loading, refetch } = useTrainingState();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState([]); // [{role,content}]
  const streamRef = useRef(null);

  const messages = useMemo(() => {
    const real = Array.isArray(data?.messages) ? data.messages : [];
    return [...real, ...optimistic];
  }, [data, optimistic]);

  const topics = data?.topics || [];
  const currentTopic = data?.currentTopic || 'motive';
  const memory = data?.memory || [];
  const overallPct = typeof data?.overallPct === 'number' ? data.overallPct : 0;

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const onSend = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    setOptimistic([{ role: 'me', content: text }]);
    try {
      await sendTrainingMessage(text, currentTopic);
      setOptimistic([]);
      await refetch();
    } catch (err) {
      console.error('[coach] send failed', err);
      setOptimistic((prev) => [
        ...prev,
        { role: 'ai', content: "Sorry, I couldn't save that. Try again?" },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onPickTopic = async (key) => {
    if (key === currentTopic) return;
    try {
      await advanceTrainingTopic(key);
      await refetch();
    } catch (err) {
      console.error('[coach] advance failed', err);
    }
  };

  const onReset = async () => {
    const ok = window.confirm(
      'Reset all coach training? This wipes the chat history and everything your agent has memorised about you.'
    );
    if (!ok) return;
    try {
      await resetTraining();
      setOptimistic([]);
      await refetch();
    } catch (err) {
      console.error('[coach] reset failed', err);
    }
  };

  const onDeleteMemory = async (id) => {
    try {
      await applyPilotAPI.deleteMemory(id);
      await refetch();
    } catch (err) {
      console.error('[coach] delete memory failed', err);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(e);
    }
  };

  return (
    <Wrap>
      <ChatCard>
        <Header>
          <HeaderTitle>
            <Avatar>AI</Avatar>
            <div>
              <h2>Train your agent</h2>
              <p>
                Anything you say here gets baked into resume tailoring and
                form-fill on every future application.
              </p>
            </div>
          </HeaderTitle>
          {messages.length > 0 && (
            <ResetBtn onClick={onReset}>Reset</ResetBtn>
          )}
        </Header>

        {topics.length > 0 && (
          <TopicStrip>
            {topics.map((t) => {
              const done = t.pct >= 100;
              const active = t.key === currentTopic;
              return (
                <TopicChip
                  key={t.key}
                  $active={active}
                  $done={done}
                  type="button"
                  onClick={() => onPickTopic(t.key)}
                  title={t.sub}
                >
                  <span className="dot" />
                  {t.label}
                  <span className="pct">{done ? '✓' : `${t.pct || 0}%`}</span>
                </TopicChip>
              );
            })}
          </TopicStrip>
        )}

        <Stream ref={streamRef}>
          {!loading && messages.length === 0 && (
            <Empty>
              <strong>Say hi to your agent.</strong>
              <br />
              Tell it what role you're chasing and what you actually
              care about. It'll ask follow-ups and remember your
              answers for every future application.
            </Empty>
          )}

          {messages.map((m, i) => (
            <Bubble key={m.id ?? `o-${i}`} $role={m.role}>
              {m.content}
            </Bubble>
          ))}

          {sending && (
            <Typing>
              <span /><span /><span />
            </Typing>
          )}
        </Stream>

        <Composer onSubmit={onSend}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              typeof window !== 'undefined' && window.innerWidth < 480
                ? 'Tell your agent something…'
                : 'Tell your agent something…\n(Enter to send, Shift+Enter for newline)'
            }
            title="Enter to send, Shift+Enter for newline"
            rows={2}
          />
          <SendBtn type="submit" disabled={!draft.trim() || sending}>
            Send
          </SendBtn>
        </Composer>
      </ChatCard>

      <Side>
        <SideCard>
          <RingWrap>
            <Ring $pct={overallPct}>
              <span>{overallPct}%</span>
            </Ring>
            <div>
              <SideTitle>Coverage</SideTitle>
              <SideSub style={{ margin: 0 }}>
                {overallPct >= 100
                  ? "Your agent's well-trained."
                  : 'Keep teaching. The more you tell it, the sharper its answers get.'}
              </SideSub>
            </div>
          </RingWrap>
        </SideCard>

        <SideCard>
          <SideTitle>What I've taught my agent</SideTitle>
          <SideSub>
            {memory.length === 0
              ? 'Nothing yet. Your answers in the chat get distilled into facts your agent can quote on applications.'
              : `${memory.length} fact${memory.length === 1 ? '' : 's'} memorised.`}
          </SideSub>
          {memory.map((m) => (
            <MemoryRow key={m.id}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="k">{(m.topic || 'general')} · {m.key}</div>
                <div className="v">{m.value}</div>
              </div>
              <button
                type="button"
                title="Forget this"
                onClick={() => onDeleteMemory(m.id)}
              >
                ✕
              </button>
            </MemoryRow>
          ))}
        </SideCard>
      </Side>
    </Wrap>
  );
};

export default CoachPage;
