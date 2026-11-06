import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Drawer, useMediaQuery } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { externalApplicationAPI } from '../services/api';
import { relativeTimeAgo } from '../utils/relativeTime';

/**
 * Asks "Did you apply?" once, later, for an application the person started
 * (tapped Apply, downloaded a resume) and then left quiet. Mounted once in the
 * app shell. Loads after sign-in and when the tab becomes visible again, at
 * most once a minute; shows one item at a time; shows nothing on any failure.
 */
const MIN_GAP_MS = 60 * 1000;

const Sheet = styled.div`
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  .grab { width: 40px; height: 5px; margin: 0 auto 16px; border-radius: 3px; background: #d9dbe5; }
`;
const Card = styled.div`
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1300;
  width: 360px;
  max-width: calc(100vw - 40px);
  padding: 18px;
  background: #fff;
  border: 1px solid #e5e7f0;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(19, 21, 42, 0.16);
`;
const Body = styled.div`
  h3 { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #13152a; line-height: 1.3; }
  p { margin: 0 0 16px; font-size: 14.5px; color: #6b7280; }
  .row { display: flex; gap: 10px; }
  button { font: inherit; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  .primary, .secondary {
    flex: 1; height: 46px; border-radius: 12px; font-size: 15.5px; font-weight: 650;
  }
  .primary { border: none; background: #4b4fc4; color: #fff; }
  .secondary { border: 1px solid #d9dbe5; background: #fff; color: #13152a; }
  .quiet {
    display: block; width: 100%; margin-top: 10px; height: 40px; border: none;
    background: none; color: #6b7280; font-size: 14.5px; font-weight: 600;
  }
`;

export default function PendingApplicationCard() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const isPhone = useMediaQuery('(max-width:640px)');
  const [item, setItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const lastLoad = useRef(0);
  const dismissed = useRef(new Set());
  const loading = useRef(false);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (loading.current || (!force && now - lastLoad.current < MIN_GAP_MS)) return;
    loading.current = true;
    lastLoad.current = now;
    try {
      const { data } = await externalApplicationAPI.getPending();
      const next = (data?.pending || []).find((p) => p?.id && !dismissed.current.has(p.id));
      setItem((cur) => cur || next || null);
    } catch (_) {
      /* show nothing */
    } finally {
      loading.current = false;
    }
  }, []);

  const userId = user?.id || user?._id;
  useEffect(() => {
    if (!isAuthenticated || user?.role === 'recruiter' || user?.role === 'admin') {
      setItem(null);
      return undefined;
    }
    load(true);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, userId, user?.role, load]);

  if (!item) return null;

  const answer = async (value) => {
    if (busy) return;
    setBusy(true);
    const current = item;
    dismissed.current.add(current.id);
    try {
      await externalApplicationAPI.answer(current.id, value);
      if (value === 'applied') {
        window.dispatchEvent(new CustomEvent('job-application-confirmed', {
          detail: { jobId: current.externalJobId || undefined },
        }));
        toast.success(`Moved ${current.jobTitle || 'this job'} to Applied.`);
      }
    } catch (_) {
      /* the question simply comes back later */
    } finally {
      setItem(null);
      setBusy(false);
    }
  };

  const content = (
    <Body>
      <h3>Did you apply to {current_title(item)} at {item.company || 'this company'}?</h3>
      <p>You started it {relativeTimeAgo(item.startedAt || item.lastActivityAt)}.</p>
      <div className="row">
        <button type="button" className="secondary" disabled={busy} onClick={() => answer('not_yet')}>Not yet</button>
        <button type="button" className="primary" disabled={busy} onClick={() => answer('applied')}>Yes, I applied</button>
      </div>
      <button type="button" className="quiet" disabled={busy} onClick={() => answer('not_applying')}>I am not applying</button>
    </Body>
  );

  if (isPhone) {
    return (
      <Drawer
        anchor="bottom"
        open
        sx={{ zIndex: 1400 }}
        onClose={() => { dismissed.current.add(item.id); setItem(null); }}
        PaperProps={{ style: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxWidth: 560, margin: '0 auto' } }}
      >
        <Sheet><div className="grab" />{content}</Sheet>
      </Drawer>
    );
  }
  return <Card role="dialog" aria-label="Did you apply?">{content}</Card>;
}

function current_title(item) {
  return item.jobTitle || 'this job';
}
