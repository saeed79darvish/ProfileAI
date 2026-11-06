import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Drawer, useMediaQuery } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { externalApplicationAPI, externalJobAPI } from '../services/api';
import { relativeTimeAgo } from '../utils/relativeTime';
import { load as loadDeparture, clear as clearDeparture, shouldAskOnReturn } from '../utils/applyDeparture';
import { fetchNextJobs, matchPercent } from '../utils/nextJobs';

const FIRST_APPLIED_KEY = 'profilleai.firstAppliedSeen';
const TIP_DISMISSED_KEY = 'profilleai.homeScreenTipDismissed';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* ignore */ } },
};
const UA = () => (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
const isIOS = () => /iPhone|iPad/.test(UA());
const isAndroid = () => /Android/.test(UA());
const isStandalone = () => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (_) { return false; }
};

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
  .link {
    display: block; width: 100%; margin-top: 10px; height: 40px; border: none;
    background: none; color: #4b4fc4; font-size: 14.5px; font-weight: 650;
  }
  .jobs { display: flex; flex-direction: column; gap: 8px; margin: 0 0 6px; }
  .jobs-empty { margin: 0 0 12px; }
  .job {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px;
    border: 1px solid #e5e7f0; border-radius: 14px;
  }
  .logo {
    flex: none; width: 40px; height: 40px; border-radius: 10px; background: #eef0fb; color: #4b4fc4;
    display: flex; align-items: center; justify-content: center; font-weight: 700; overflow: hidden;
  }
  .logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .info { flex: 1; min-width: 0; }
  .info .t { font-size: 14.5px; font-weight: 650; color: #13152a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .c { font-size: 13px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .m { color: #1f7a45; font-weight: 650; }
  .tailor {
    flex: none; height: 36px; padding: 0 14px; border: none; border-radius: 10px;
    background: #4b4fc4; color: #fff; font-size: 14px; font-weight: 650;
  }
  .tip { margin-top: 12px; padding: 12px; border-radius: 12px; background: #f4f5fb; }
  .tip p { margin: 0 0 8px; font-size: 13.5px; color: #3c3f5a; }
  .tip .row { gap: 8px; }
  .tip button { flex: 1; height: 36px; border-radius: 10px; border: 1px solid #d9dbe5; background: #fff; font-size: 14px; font-weight: 600; color: #13152a; }
  .quiet {
    display: block; width: 100%; margin-top: 10px; height: 40px; border: none;
    background: none; color: #6b7280; font-size: 14.5px; font-weight: 600;
  }
`;

export default function PendingApplicationCard() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isPhone = useMediaQuery('(max-width:640px)');
  const [item, setItem] = useState(null);
  const [stage, setStage] = useState('ask'); // ask | applied | later
  const [nextJobs, setNextJobs] = useState(null); // null loading, [] none
  const [tip, setTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastLoad = useRef(0);
  const dismissed = useRef(new Set());
  const askedReturn = useRef(new Set());
  const hiddenAt = useRef(null);
  const installEvent = useRef(null);
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

  // The person just came back from the company's page: ask about that application at once,
  // without waiting for the server's quiet period. Once per departure.
  const checkReturn = useCallback((hiddenForMs) => {
    const dep = loadDeparture();
    if (!dep || askedReturn.current.has(dep.at)) return;
    if (!shouldAskOnReturn(dep, Date.now(), hiddenForMs)) return;
    askedReturn.current.add(dep.at);
    setStage('ask');
    setItem((cur) => (cur && (cur.fromReturn || stageRef.current !== 'ask') ? cur : {
      id: dep.applicationId || null,
      fromReturn: true,
      departureAt: dep.at,
      jobTitle: dep.title,
      company: dep.company,
      jobUrl: dep.applyUrl,
      externalJobId: dep.jobId || null,
      listQuery: dep.listQuery || '',
      startedAt: new Date(dep.at).toISOString(),
    }));
  }, []);
  const stageRef = useRef('ask');
  stageRef.current = stage;

  const userId = user?.id || user?._id;
  useEffect(() => {
    if (!isAuthenticated || user?.role === 'recruiter' || user?.role === 'admin') {
      setItem(null);
      return undefined;
    }
    checkReturn(null);
    load(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : null;
      hiddenAt.current = null;
      checkReturn(away);
      load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isAuthenticated, userId, user?.role, load, checkReturn]);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); installEvent.current = e; };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Never ask over something the person is in the middle of (the tailor flow, the download
  // screen, a menu): wait until nothing else is open, then show it.
  const [otherOpen, setOtherOpen] = useState(false);
  useEffect(() => {
    if (!item) return undefined;
    const check = () => setOtherOpen(!!document.querySelector('.MuiModal-root:not(.pending-app-card)'));
    check();
    const t = setInterval(check, 700);
    return () => clearInterval(t);
  }, [item]);

  if (!item || otherOpen) return null;

  const closeAll = () => {
    setItem(null);
    setStage('ask');
    setNextJobs(null);
    setTip(false);
  };

  const showNext = (current) => {
    setNextJobs(null);
    fetchNextJobs(externalJobAPI, {
      jobId: current.externalJobId,
      title: current.jobTitle,
      company: current.company,
      listQuery: current.listQuery || '',
    }).then(setNextJobs).catch(() => setNextJobs([]));
  };

  // A return question can be asked before the server id is known: tracking the start again is
  // idempotent (409 hands back the existing row), so it also resolves the id.
  const resolveId = async (current) => {
    if (current.id) return current.id;
    try {
      const body = {
        jobTitle: current.jobTitle || 'Untitled position',
        company: current.company || '',
        jobUrl: current.jobUrl,
        stage: 'in_progress',
        confirmedBy: 'tailored_resume',
      };
      if (current.externalJobId) body.externalJobId = current.externalJobId;
      const res = await externalApplicationAPI.create(body);
      return res?.data?.id || res?.data?.application?.id || null;
    } catch (err) {
      return err?.response?.data?.application?.id || null;
    }
  };

  const answer = async (value, { silentClose = false } = {}) => {
    if (busy) return;
    setBusy(true);
    const current = item;
    if (current.id) dismissed.current.add(current.id);
    const dep = loadDeparture();
    if (current.fromReturn || (dep && current.id && dep.applicationId === current.id)) clearDeparture();
    let keepOpen = false;
    try {
      const id = await resolveId(current);
      if (id) dismissed.current.add(id);
      if (!id) throw new Error('unknown application');
      await externalApplicationAPI.answer(id, value);
      if (value === 'applied') {
        window.dispatchEvent(new CustomEvent('job-application-confirmed', {
          detail: { jobId: current.externalJobId || undefined },
        }));
        toast.success(`Moved ${current.jobTitle || 'this job'} to Applied.`);
      }
    } catch (_) {
      /* the question simply comes back later */
    }
    if (value === 'applied') {
      keepOpen = true;
      const first = !store.get(FIRST_APPLIED_KEY);
      store.set(FIRST_APPLIED_KEY, '1');
      const platform = isIOS() || isAndroid();
      setTip(first && platform && !isStandalone() && !store.get(TIP_DISMISSED_KEY));
      setStage('applied');
      showNext(current);
    } else if (value === 'not_yet' && current.fromReturn && !silentClose) {
      keepOpen = true;
      setStage('later');
      showNext(current);
    }
    if (!keepOpen) setItem(null);
    setBusy(false);
  };

  const openJob = (job) => {
    closeAll();
    navigate(`/jobs?externalJobId=${encodeURIComponent(job.id)}&tailor=1`);
  };
  const seeMore = () => {
    const q = item.listQuery || '';
    closeAll();
    navigate(`/jobs${q}`);
  };
  const dismissTip = () => { store.set(TIP_DISMISSED_KEY, '1'); setTip(false); };
  const installNow = async () => {
    try {
      const ev = installEvent.current;
      installEvent.current = null;
      await ev.prompt();
    } catch (_) { /* ignore */ }
    dismissTip();
  };

  const nextList = (
    <>
      <div className="jobs">
        {(nextJobs || []).map((job) => {
          const pct = matchPercent(job);
          const logo = job.companyInfo?.logoUrl || job.logoUrl || job.logo;
          return (
            <div className="job" key={job.id}>
              <div className="logo">{logo ? <img src={logo} alt="" /> : String(job.company || job.title || '?').charAt(0).toUpperCase()}</div>
              <div className="info">
                <div className="t">{job.title}</div>
                <div className="c">{job.company}{pct ? <> &middot; <span className="m">{pct}% match</span></> : null}</div>
              </div>
              <button type="button" className="tailor" onClick={() => openJob(job)}>Tailor</button>
            </div>
          );
        })}
      </div>
      {nextJobs && nextJobs.length === 0 && <p className="jobs-empty">We could not find more jobs just now.</p>}
      {nextJobs === null && <p className="jobs-empty">Finding your next jobs.</p>}
      <button type="button" className="link" onClick={seeMore}>See more jobs</button>
    </>
  );

  let content;
  if (stage === 'applied') {
    const iosTip = isIOS();
    const canInstall = !iosTip && !!installEvent.current;
    content = (
      <Body>
        <h3>Applied. Nice work.</h3>
        <p>Your next best matches</p>
        {nextList}
        {tip && (
          <div className="tip">
            <p>
              Add ProfilleAI to your Home Screen to come back in one tap.
              {iosTip ? ' Tap Share, then Add to Home Screen.' : ''}
            </p>
            <div className="row">
              {canInstall && <button type="button" onClick={installNow}>Add</button>}
              <button type="button" onClick={dismissTip}>Not now</button>
            </div>
          </div>
        )}
        <button type="button" className="quiet" onClick={closeAll}>Done</button>
      </Body>
    );
  } else if (stage === 'later') {
    content = (
      <Body>
        <h3>No problem. Finish when you are ready.</h3>
        <p>Your next best matches</p>
        {item.jobUrl && (
          <button
            type="button"
            className="link"
            onClick={() => { try { window.open(item.jobUrl, '_blank', 'noopener'); } catch (_) { /* ignore */ } }}
          >
            Open the application again
          </button>
        )}
        {nextList}
        <button type="button" className="quiet" onClick={closeAll}>Close</button>
      </Body>
    );
  } else {
    content = (
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
  }

  if (isPhone) {
    return (
      <Drawer
        anchor="bottom"
        open
        className="pending-app-card"
        sx={{ zIndex: 1400 }}
        onClose={() => (stage === 'ask' ? answer('not_yet', { silentClose: true }) : closeAll())}
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
