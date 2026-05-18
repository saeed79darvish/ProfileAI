import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Btn } from './styled';
import {
  startPilot,
  pausePilot,
  useApplyPilotConfig,
} from '../../hooks/useApplyPilot';
import { useToast } from '../../contexts/ToastContext';

/**
 * PilotStatusStrip · always-visible pilot state banner.
 *
 * Answers "is the agent running?" without the user having to hunt for
 * it. Sits above the Ready-for-review list and is sticky-adjacent:
 * always the first thing the eye lands on.
 */
const PilotStatusStrip = ({
  readyCount = 0,
  inFlightCount = 0,
  blockerCount = 0,
  onRefresh,
  isOffline = false,
}) => {
  const { data: cfg, refetch } = useApplyPilotConfig();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // `/config` emits the pilot state under `status`. Map unknown values
  // onto a safe default so the strip never errors out.
  const state = isOffline ? 'offline' : (cfg?.status || 'idle');
  const running = state === 'running';

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (running) {
        await pausePilot();
        toast?.success?.('Pilot paused.');
      } else {
        await startPilot();
        toast?.success?.('Pilot started.');
      }
      await refetch();
      onRefresh?.();
    } catch (err) {
      toast?.error?.(err?.message || 'Could not change pilot state.');
    } finally {
      setBusy(false);
    }
  };

  const label = LABELS[state] || LABELS.idle;

  return (
    <Wrapper $tone={label.tone}>
      <Dot $tone={label.tone} $pulse={running} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <HeadLine>{label.head}</HeadLine>
        <SubLine>
          {isOffline ? (
            <>Backend not reachable, start the server then refresh.</>
          ) : (
            <>
              <strong>{readyCount}</strong> ready for review
              {inFlightCount > 0 && <> · <strong>{inFlightCount}</strong> submitting</>}
              {blockerCount > 0 && <> · <strong style={{ color: '#C42B35' }}>{blockerCount}</strong> need your input</>}
            </>
          )}
        </SubLine>
      </div>

      <Actions>
        <Btn $size="sm" $variant="ghost" onClick={() => { refetch(); onRefresh?.(); }}>
          Refresh
        </Btn>
        {!isOffline && (
          <Btn
            $size="sm"
            $variant={running ? 'ghost' : 'primary'}
            disabled={busy}
            onClick={handleToggle}
          >
            {busy ? '…' : (running ? 'Pause pilot' : 'Start pilot')}
          </Btn>
        )}
      </Actions>
    </Wrapper>
  );
};

const LABELS = {
  running:  { head: 'Pilot is running',    tone: 'good' },
  paused:   { head: 'Pilot is paused',     tone: 'warn' },
  idle:     { head: 'Pilot is idle',       tone: 'neutral' },
  offline:  { head: 'Pilot is offline',    tone: 'bad' },
};

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(59, 180, 74, 0.55); }
  70%  { box-shadow: 0 0 0 8px rgba(59, 180, 74, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 180, 74, 0); }
`;

const TONE_BG = {
  good:    '#EFFAF0',
  warn:    '#FFF4CF',
  neutral: '#F4F2FB',
  bad:     '#FFF0F0',
};
const TONE_BORDER = {
  good:    '#B9E5C1',
  warn:    '#E7C66A',
  neutral: '#E4DFF5',
  bad:     '#F4B5B5',
};
const TONE_DOT = {
  good:    '#3BB44A',
  warn:    '#D99717',
  neutral: '#8881A8',
  bad:     '#C42B35',
};

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  background: ${(p) => TONE_BG[p.$tone] || TONE_BG.neutral};
  border: 1px solid ${(p) => TONE_BORDER[p.$tone] || TONE_BORDER.neutral};
  border-radius: 12px;
  padding: 14px 16px;
`;

const Dot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => TONE_DOT[p.$tone] || TONE_DOT.neutral};
  ${(p) => p.$pulse && css`animation: ${pulse} 2s infinite;`}
`;

const HeadLine = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #2D2A3E;
`;

const SubLine = styled.div`
  font-size: 13px;
  color: #6B6787;
`;

const Actions = styled.div`
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
`;

export default PilotStatusStrip;
