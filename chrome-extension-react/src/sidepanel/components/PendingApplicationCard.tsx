import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pickPending, relativeTime, type PendingApplication } from '../pendingApplication';

type Answer = 'applied' | 'not_yet' | 'not_applying';

const MIN_GAP_MS = 60_000;

// Shared by every mounted card so the panel and the tailor flow never ask the
// server more than once a minute between them.
let lastLoadAt = 0;
let cached: PendingApplication[] = [];
let inflight: Promise<PendingApplication[]> | null = null;

async function loadPending(force = false): Promise<PendingApplication[]> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastLoadAt < MIN_GAP_MS) return cached;
  lastLoadAt = Date.now();
  inflight = (async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'PENDING_APPLICATIONS' });
      cached = res?.success && Array.isArray(res.pending) ? res.pending : [];
    } catch {
      cached = [];
    }
    return cached;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

interface Props {
  /** URL of the page the person is on now; its own application is never asked about. */
  currentUrl?: string | null;
  className?: string;
}

/**
 * Asks, once, about an application that was started and then went quiet.
 * Renders nothing when there is none, or when the request fails.
 */
export const PendingApplicationCard: React.FC<Props> = ({ currentUrl, className }) => {
  const [list, setList] = useState<PendingApplication[]>(cached);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState('');
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const next = await loadPending();
    if (mounted.current) setList(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!thanks) return;
    const t = setTimeout(() => setThanks(''), 2500);
    return () => clearTimeout(t);
  }, [thanks]);

  const item = pickPending(list, currentUrl);

  const answer = async (a: Answer) => {
    if (!item || busy) return;
    setBusy(true);
    let ok = false;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'ANSWER_APPLICATION', data: { id: item.id, answer: a } });
      ok = !!res?.success;
    } catch { /* fall through: the card stays so they can try again */ }
    setBusy(false);
    if (!ok) return;
    cached = cached.filter((p) => p.id !== item.id);
    setList(cached);
    setThanks(a === 'applied' ? 'Marked as applied.' : a === 'not_yet' ? 'OK, we will ask again in a couple of days.' : 'Got it. We will not ask again.');
  };

  if (!item) {
    return thanks ? <div className={`pa-thanks ${className || ''}`} role="status">{thanks}</div> : null;
  }

  return (
    <section className={`pa-card ${className || ''}`} aria-label="Application check">
      <h4>Did you apply to {item.jobTitle}{item.company ? ` at ${item.company}` : ''}?</h4>
      <p>You started it {relativeTime(item.startedAt || item.lastActivityAt)}.</p>
      <div className="pa-actions">
        <button type="button" className="pa-btn primary" onClick={() => void answer('applied')} disabled={busy}>Yes, I applied</button>
        <button type="button" className="pa-btn" onClick={() => void answer('not_yet')} disabled={busy}>Not yet</button>
      </div>
      <button type="button" className="pa-quiet" onClick={() => void answer('not_applying')} disabled={busy}>I am not applying</button>
    </section>
  );
};
