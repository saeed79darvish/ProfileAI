import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { subscribeApiErrors } from '../services/errorBus';
import { API_ERROR_KIND } from '../utils/apiErrorMessage';
import { media } from '../styles/breakpoints';

// Global banner for systemic API failures. Sits under the navbar, auto-dismisses
// on a timeout the user can pause by hovering, and collapses repeats of the same
// failure into one row with a count — a cold backend fails every boot call at
// once, and six identical banners is worse than none.

const MAX_VISIBLE = 3;
const EXIT_MS = 250;

const slideDown = keyframes`
  from { transform: translateY(-12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-12px); opacity: 0; }
`;

const shrink = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;

const SEVERITY = {
  error: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', accent: '#ef4444' },
  info: { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', accent: '#3b82f6' },
  success: { bg: '#ecfdf5', border: '#6ee7b7', color: '#065f46', accent: '#10b981' },
};

const tone = (p) => SEVERITY[p.$severity] || SEVERITY.error;

const Container = styled.div`
  position: fixed;
  top: 82px;
  left: 0;
  right: 0;
  z-index: 9990;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  pointer-events: none;

  ${media.tabletDown} { top: 76px; }
  ${media.mobile} { top: 64px; padding: 0 12px; }
`;

const Banner = styled.div`
  position: relative;
  width: 100%;
  max-width: 640px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  overflow: hidden;
  background: ${(p) => tone(p).bg};
  border: 1px solid ${(p) => tone(p).border};
  color: ${(p) => tone(p).color};
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
  animation: ${(p) => (p.$exiting
    ? css`${slideUp} ${EXIT_MS}ms ease forwards`
    : css`${slideDown} 0.25s ease`)};
`;

const IconSlot = styled.div`
  display: flex;
  flex-shrink: 0;
  padding-top: 1px;
  color: ${(p) => tone(p).accent};
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Message = styled.div`
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.4;
`;

const Detail = styled.div`
  margin-top: 3px;
  font-size: 11.5px;
  font-weight: 500;
  opacity: 0.72;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const Count = styled.span`
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: ${(p) => tone(p).accent};
  color: #fff;
`;

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid ${(p) => tone(p).border};
  background: rgba(255, 255, 255, 0.65);
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #fff; }
`;

const CloseButton = styled.button`
  display: flex;
  padding: 3px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;

  &:hover { opacity: 1; }
`;

const Progress = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  transform-origin: left center;
  background: ${(p) => tone(p).accent};
  opacity: 0.55;
  animation: ${shrink} ${(p) => p.$duration}ms linear forwards;
  animation-play-state: ${(p) => (p.$paused ? 'paused' : 'running')};
`;

const KIND_ICON = {
  [API_ERROR_KIND.OFFLINE]: WifiOffIcon,
  restored: CloudDoneIcon,
};

function BannerItem({ item, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const Icon = KIND_ICON[item.kind] || ErrorOutlineIcon;

  // A repeat of the same failure restarts the clock rather than stacking a row.
  useEffect(() => {
    remaining.current = item.duration;
  }, [item.duration, item.resetToken]);

  useEffect(() => {
    if (!item.duration || paused || item.exiting) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(item.id), Math.max(0, remaining.current));
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [item.duration, item.exiting, item.id, item.resetToken, onDismiss, paused]);

  return (
    <Banner
      $severity={item.severity}
      $exiting={item.exiting}
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <IconSlot $severity={item.severity}>
        <Icon sx={{ fontSize: 20 }} />
      </IconSlot>
      <Body>
        <Message>{item.message}</Message>
        {item.detail && <Detail>{item.detail}</Detail>}
      </Body>
      <Actions>
        {item.count > 1 && <Count $severity={item.severity}>{item.count}</Count>}
        {item.canReload && (
          <RetryButton
            type="button"
            $severity={item.severity}
            onClick={() => window.location.reload()}
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
            Reload
          </RetryButton>
        )}
        <CloseButton type="button" aria-label="Dismiss" onClick={() => onDismiss(item.id)}>
          <CloseIcon sx={{ fontSize: 17 }} />
        </CloseButton>
      </Actions>
      {item.duration > 0 && !item.exiting && (
        <Progress
          key={item.resetToken}
          $severity={item.severity}
          $duration={item.duration}
          $paused={paused}
        />
      )}
    </Banner>
  );
}

export default function ApiErrorBanner() {
  const [items, setItems] = useState([]);
  const exitTimers = useRef(new Set());

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, exiting: true } : i)));
    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      exitTimers.current.delete(timer);
    }, EXIT_MS);
    exitTimers.current.add(timer);
  }, []);

  const push = useCallback((entry) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.dedupeKey === entry.dedupeKey && !i.exiting);
      if (existing) {
        // Same failure again: bump the count and restart the clock. A *different*
        // kind on the same key (offline replaced by "back online") takes the row
        // over instead, so the count starts fresh.
        const repeat = existing.kind === entry.kind;
        return prev.map((i) => (i === existing
          ? {
            ...i,
            ...entry,
            id: i.id,
            count: repeat ? i.count + 1 : 1,
            resetToken: i.resetToken + 1,
          }
          : i));
      }
      return [...prev, { ...entry, count: 1, resetToken: 0, exiting: false }].slice(-MAX_VISIBLE);
    });
  }, []);

  useEffect(() => subscribeApiErrors(push), [push]);

  // Clean up pending exit timers on unmount.
  useEffect(() => {
    const timers = exitTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // Connection state. The browser tells us directly here, so we don't have to
  // wait for a request to fail to say something useful.
  useEffect(() => {
    const handleOffline = () => push({
      id: `offline-${Date.now()}`,
      kind: API_ERROR_KIND.OFFLINE,
      severity: 'error',
      message: "You're offline. We'll pick up where you left off once the connection is back.",
      detail: null,
      dedupeKey: 'connection',
      duration: 0,
      canReload: false,
    });
    const handleOnline = () => push({
      id: `online-${Date.now()}`,
      kind: 'restored',
      severity: 'success',
      message: "You're back online.",
      detail: null,
      dedupeKey: 'connection',
      duration: 3000,
      canReload: false,
    });

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [push]);

  if (items.length === 0) return null;

  return (
    <Container>
      {items.map((item) => (
        <BannerItem key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </Container>
  );
}
