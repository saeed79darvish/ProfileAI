import React, { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import {
  useReviewQueue,
  useApplyPilotConfig,
  startPilot,
  pausePilot,
  rejectApplication,
  deleteApplication,
  approveApplication,
} from '../../hooks/useApplyPilot';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import CompanyAvatar from './CompanyAvatar';

/* ───────────── helpers ───────────── */

const RELATIVE = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const isDeadWeight = (app) => {
  const err = String(app?.submissionError || '').toLowerCase();
  if (!err) return false;
  if (err.includes('auto-submit is not implemented')) return true;
  if (err.includes('status 404') || err.includes('status 410')) return true;
  if (err.includes('did not show a clear submission confirmation')) return true;
  return false;
};

const hasCriteria = (cfg) => {
  const titles = cfg?.config?.criteria?.roleTitles;
  return Array.isArray(titles) && titles.length > 0;
};

/**
 * Translate the scout's `lastScoutRun` snapshot into a user-facing
 * diagnostic for the empty-queue state. Without this, a misconfigured
 * pilot looks like a broken pilot — the dashboard just says "watching"
 * forever even when the criteria/profile mismatch guarantees nothing
 * will ever surface.
 */
const interpretScoutFunnel = (lastScoutRun) => {
  if (!lastScoutRun) {
    return {
      title: 'No matches yet, the pilot is watching',
      sub: "We scan 40+ boards every few minutes. Strong matches land here first. Close the tab if you want, we'll ping you.",
      hint: null,
      cta: null,
    };
  }
  const r = lastScoutRun || {};
  const eligible = r.eligible ?? 0;
  const above = r.above ?? 0;
  const below = r.below ?? 0;
  const noUrl = r.noUrl ?? 0;
  const threshold = r.threshold ?? 70;
  const dailyCount = r.dailyCount ?? 0;
  const dailyLimit = r.dailyLimit ?? 10;

  switch (r.reason) {
    case 'no_profile':
      return {
        title: "We can't match jobs without your profile",
        sub: 'Add your title, skills, and experience so the pilot has something to compare jobs against.',
        hint: null,
        cta: { label: 'Complete your profile', to: '/profile' },
      };
    case 'daily_limit_hit':
      return {
        title: `Daily limit reached (${dailyCount} of ${dailyLimit})`,
        sub: "We'll resume scouting tomorrow. Raise your daily limit in Setup if you want more.",
        hint: null,
        cta: { label: 'Adjust limits', to: '/applypilot/setup' },
      };
    case 'no_eligible_jobs':
      return {
        title: 'No jobs match your filters',
        sub: 'Your criteria filtered out every recent posting. Try widening role titles, locations, or lowering the salary floor.',
        hint: null,
        cta: { label: 'Loosen criteria', to: '/applypilot/setup' },
      };
    case 'all_below_threshold':
      return {
        title: `Checked ${eligible} jobs — none cleared your ${threshold}% match`,
        sub: above === 0 && below > 0
          ? `Every job scored below ${threshold}%. Either lower your match threshold or broaden your role titles so the pilot has closer fits to work with.`
          : 'Try lowering your match threshold or refining role titles to better mirror your profile.',
        hint: `eligible ${eligible} · above ${above} · below ${below}`,
        cta: { label: 'Adjust match threshold', to: '/applypilot/setup' },
      };
    case 'no_apply_url':
      return {
        title: `Found ${eligible} jobs but none had a usable apply link`,
        sub: 'These postings link to ATS pages we can\'t auto-submit yet. We\'ll keep watching for ones we can.',
        hint: `noUrl ${noUrl}`,
        cta: null,
      };
    case 'scout_error':
      return {
        title: 'Scout hit an error on its last run',
        sub: r.error ? `Last error: ${r.error}` : "We'll retry on the next cycle.",
        hint: null,
        cta: null,
      };
    case 'surfaced':
    default:
      return {
        title: 'No matches yet, the pilot is watching',
        sub: "We scan 40+ boards every few minutes. Strong matches land here first.",
        hint: r.ranAt ? `Last scan ${RELATIVE(r.ranAt)}` : null,
        cta: null,
      };
  }
};

const matchTier = (m) => {
  if (typeof m !== 'number') return 'neutral';
  if (m >= 88) return 'good';
  if (m >= 75) return 'ok';
  return 'fair';
};

/* ───────────── page ───────────── */

const DashboardPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: cfg, loading: cfgLoading, refetch: refetchCfg } = useApplyPilotConfig();
  const { queue, loading, isOffline, refetch } = useReviewQueue();
  const [busyId, setBusyId] = useState(null);
  const [blockersOpen, setBlockersOpen] = useState(false);
  const [pilotBusy, setPilotBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Wraps the queue + config refetch with a visible spinner state and
  // a confirmation toast. Without this the Refresh buttons fired
  // silently, 304 responses meant nothing visibly changed even when
  // the call succeeded.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchCfg()]);
      toast?.success?.('Up to date');
    } catch (err) {
      toast?.error?.('Refresh failed, is the backend up?');
    } finally {
      // Keep the spinner visible briefly so fast 304s still register
      // as a deliberate action.
      setTimeout(() => setRefreshing(false), 350);
    }
  };

  // Once an item has been classified as auto-dismissed in this
  // session we keep that classification stable, even if the polled
  // queue briefly returns an item with a transient error string that
  // no longer matches the heuristic. Without this the counter would
  // tick down between polls (e.g. "11 auto-dismissed" → "10") for
  // reasons the user can't see, which reads as a bug.
  const deadWeightIdsRef = useRef(new Set());

  const { pending, liveBlockers, deadWeight, inFlight } = useMemo(() => {
    const list = Array.isArray(queue) ? queue : [];
    const blockers = list.filter((a) => a.status === 'needs_attention');
    const flying = list.filter((a) =>
      ['approved', 'submitting'].includes(a.dbStatus || a.status),
    ).length;
    // Add any newly dead-weight blockers to the sticky set.
    for (const a of blockers) {
      if (isDeadWeight(a)) deadWeightIdsRef.current.add(a.id);
    }
    const stickySet = deadWeightIdsRef.current;
    return {
      pending: list.filter((a) => a.status === 'pending'),
      liveBlockers: blockers.filter((a) => !stickySet.has(a.id)),
      deadWeight: blockers.filter((a) => stickySet.has(a.id)),
      inFlight: flying,
    };
  }, [queue]);

  const state = isOffline ? 'offline' : (cfg?.status || 'idle');
  const isRunning = state === 'running';
  const criteria = cfg?.config?.criteria || {};
  const rails = cfg?.config?.reviewRails || {};

  // Which hero to show, picked in priority order.
  //   offline → offline banner
  //   no criteria → welcome redirect (handled below)
  //   pending > 0 → "N ready for your review" with Review CTA
  //   inFlight > 0 + pending = 0 → "Pilot is submitting" soft state
  //   running + empty → "Pilot is scanning 40+ boards"
  //   paused / idle → "You're all set. Start the pilot."
  const heroMode = (() => {
    if (isOffline) return 'offline';
    if (pending.length > 0) return 'review';
    if (isRunning && inFlight > 0) return 'submitting';
    if (isRunning) return 'scanning';
    return 'start';
  })();

  const scheduleLabel = useMemo(() => {
    const m = rails.scheduleMode;
    if (m === 'business') return 'Business hours · 9–5';
    if (m === 'always') return 'Always on · 24/7';
    return 'Extended hours · 14h/day';
  }, [rails.scheduleMode]);

  const kpis = useMemo(() => {
    const list = Array.isArray(queue) ? queue : [];
    // "Need attention" should reflect every blocker the user can act on,
    // including auto-dismissed ones (the dead-weight bucket). The hero
    // section breaks down live vs auto-dismissed below; the counter just
    // needs to be honest that there *are* blocked items.
    const blockerTotal = liveBlockers.length + deadWeight.length;
    // "Total in queue" should count work that's still in motion, not
    // every row in the table. Without this, rejecting or sending an
    // application never decrements the counter, it stays stuck at
    // whatever the all-time row count is.
    const inQueue = list.filter((a) => {
      const s = a.dbStatus || a.status;
      return s !== 'rejected' && s !== 'submitted';
    }).length;
    return [
      { key: 'review', label: 'Ready to review', value: pending.length, tone: 'brand', icon: '📬' },
      { key: 'flight', label: 'In flight', value: inFlight, tone: 'blue', icon: '🚀' },
      { key: 'blockers', label: 'Need attention', value: blockerTotal, tone: blockerTotal > 0 ? 'warn' : 'muted', icon: '⚠️' },
      { key: 'queue', label: 'Total in queue', value: inQueue, tone: 'muted', icon: '🗂️' },
    ];
  }, [queue, pending.length, inFlight, liveBlockers.length, deadWeight.length]);

  // Rail activity feed, derive events from queue items so we don't need a new endpoint.
  const activity = useMemo(() => {
    const list = Array.isArray(queue) ? queue : [];
    const events = [];
    for (const a of list) {
      const s = a.dbStatus || a.status;
      // Pick the most relevant ISO timestamp per state. Falling back
      // to `caughtAt` was wrong, the API serializes that as a
      // relative-time string ("4d ago"), which broke sorting and
      // produced "NaN min ago" labels.
      let when = null;
      let kind = null;
      let label = null;
      if (s === 'pending') {
        kind = 'matched';
        label = 'Matched';
        when = a.scoutedAt || a.updatedAt;
      } else if (s === 'approved') {
        kind = 'approved';
        label = 'Approved';
        when = a.updatedAt;
      } else if (s === 'submitting') {
        kind = 'submitting';
        label = 'Sending';
        when = a.lastSubmitAttemptAt || a.updatedAt;
      } else if (s === 'submitted') {
        kind = 'sent';
        label = 'Sent';
        when = a.submittedAt || a.updatedAt;
      } else if (s === 'rejected') {
        kind = 'rejected';
        label = 'Rejected';
        when = a.updatedAt;
      } else if (s === 'failed') {
        kind = 'blocker';
        label = 'Submit failed';
        when = a.lastSubmitAttemptAt || a.updatedAt;
      } else if (s === 'needs_attention' && !deadWeightIdsRef.current.has(a.id)) {
        kind = 'blocker';
        label = 'Needs input';
        when = a.updatedAt;
      }
      if (!kind || !when) continue;
      events.push({ id: `${a.id}-${kind}`, appId: a.id, kind, label, role: a.role, company: a.company, when, dbStatus: s });
    }
    return events
      .sort((x, y) => new Date(y.when) - new Date(x.when))
      .slice(0, 6);
  }, [queue]);

  const handleTogglePilot = async () => {
    setPilotBusy(true);
    try {
      if (isRunning) {
        await pausePilot();
        toast?.success?.('Pilot paused.');
      } else {
        await startPilot();
        toast?.success?.('Pilot started.');
      }
      await refetchCfg();
      await refetch();
    } catch (err) {
      toast?.error?.(err?.message || 'Could not change pilot state.');
    } finally {
      setPilotBusy(false);
    }
  };

  const quickActions = useMemo(() => ([
    {
      key: 'pilot',
      icon: isRunning ? '⏸' : '▶',
      label: isRunning ? 'Pause pilot' : (state === 'idle' ? 'Start pilot' : 'Resume pilot'),
      onClick: handleTogglePilot,
      disabled: pilotBusy || isOffline,
      tone: isRunning ? 'warn' : 'brand',
    },
    {
      key: 'agent',
      icon: '⚙',
      label: 'Edit criteria',
      onClick: () => navigate('/applypilot/agent'),
    },
    {
      key: 'review',
      icon: '📬',
      label: 'Open inbox',
      count: pending.length || null,
      onClick: () => navigate('/applypilot/review'),
    },
    {
      key: 'sent',
      icon: '✉',
      label: 'Sent history',
      onClick: () => navigate('/applypilot/sent'),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [isRunning, state, pilotBusy, isOffline, navigate, pending.length]);

  const openDetail = (appId) => navigate(`/applypilot/inbox/${appId}`);
  const firstPending = pending[0];
  const goReviewFirst = () => {
    if (firstPending) navigate(`/applypilot/inbox/${firstPending.id}`);
  };

  const handleRetry = async (appId, e) => {
    e?.stopPropagation?.();
    setBusyId(appId);
    try {
      await approveApplication(appId, {});
      await refetch();
    } catch (err) {
      toast?.error?.(err?.message || 'Retry failed, open the application to see why.');
    } finally {
      setBusyId(null);
    }
  };

  // ── In-app confirmation (replaces native window.confirm) ──
  // mode: 'single' | 'bulk', drives wording + which ids get archived.
  const [confirmState, setConfirmState] = useState({ open: false, mode: 'single', appId: null });
  const closeConfirm = () => {
    if (busyId) return;
    setConfirmState({ open: false, mode: 'single', appId: null });
  };

  const handleArchive = (appId, e, opts = {}) => {
    e?.stopPropagation?.();
    setConfirmState({ open: true, mode: 'single', appId, permanent: !!opts.permanent });
  };
  const handleArchiveAllDead = () => {
    if (deadWeight.length === 0) return;
    setConfirmState({ open: true, mode: 'bulk', appId: null });
  };

  const performArchive = async () => {
    if (confirmState.mode === 'bulk') {
      setBusyId('bulk');
      try {
        const ids = deadWeight.map((a) => a.id);
        await Promise.all(ids.map((id) => rejectApplication(id, 'Archived (unsupported / delisted)')));
        await refetch();
        toast?.success?.(`Archived ${ids.length} dead-end application${ids.length === 1 ? '' : 's'}.`);
        setConfirmState({ open: false, mode: 'single', appId: null });
      } catch (err) {
        toast?.error?.(err?.message || 'Bulk archive failed.');
      } finally {
        setBusyId(null);
      }
      return;
    }
    const id = confirmState.appId;
    if (!id) return;
    setBusyId(id);
    try {
      if (confirmState.permanent) {
        await deleteApplication(id);
      } else {
        await rejectApplication(id, 'Archived from Dashboard');
      }
      await refetch();
      toast?.success?.(confirmState.permanent ? 'Removed.' : 'Archived.');
      setConfirmState({ open: false, mode: 'single', appId: null });
    } catch (err) {
      toast?.error?.(err?.message || 'Archive failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (!cfgLoading && cfg && !hasCriteria(cfg)) {
    // Don't redirect — that's what caused the welcome <-> dashboard loop
    // earlier. Render the dashboard chrome with an explicit "finish
    // setup" empty state so the user is in control of when to go back
    // to the wizard. The previous Navigate also raced the SetupPage's
    // unmount-flush save: GET /config could beat the in-flight PUT and
    // see stale empty criteria, bouncing the user back even though
    // their changes had been entered. Rendering inline removes the
    // race entirely.
    return (
      <Page>
        <div style={{ maxWidth: 720, margin: '64px auto 0', padding: '0 24px' }}>
          <EmptyQueue>
            <EmptyEmoji aria-hidden>🛫</EmptyEmoji>
            <EmptyTitle>Finish your pilot setup</EmptyTitle>
            <EmptySub>
              Pick at least one role title and we&apos;ll start the queue. Takes about
              60 seconds.
            </EmptySub>
            <EmptyCta onClick={() => navigate('/applypilot/agent?setup_required=1')}>
              Open setup wizard →
            </EmptyCta>
          </EmptyQueue>
        </div>
      </Page>
    );
  }

  return (
    <Page>
    <DashLayout>
      <Rail>
        <RailNav>
          <RailLabel>Quick actions</RailLabel>
          {quickActions.map((a) => (
            <RailLink
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              $tone={a.tone}
            >
              <RailIcon aria-hidden>{a.icon}</RailIcon>
              <span>{a.label}</span>
              {a.count ? <RailCount>{a.count}</RailCount> : null}
            </RailLink>
          ))}
        </RailNav>

        <RailPanel>
          <RailLabel>Recent activity</RailLabel>
          {activity.length === 0 ? (
            <RailEmpty>
              {isRunning ? 'No events yet, the pilot just started.' : 'Nothing yet. Start the pilot to see activity.'}
            </RailEmpty>
          ) : (
            <ActivityList>
              {activity.map((e) => {
                const isInFlight = e.dbStatus === 'approved' || e.dbStatus === 'submitting';
                const isTerminal = e.dbStatus === 'rejected';
                const removeLabel = isInFlight ? 'Cancel' : 'Remove';
                const isBusy = busyId === e.appId;
                return (
                  <ActivityRow key={e.id} onClick={() => openDetail(e.appId)} role="button" tabIndex={0}>
                    <ActivityDot $kind={e.kind} aria-hidden />
                    <ActivityBody>
                      <ActivityLine>
                        <ActivityKind $kind={e.kind}>
                          {e.label}
                        </ActivityKind>
                        <ActivityTime>{RELATIVE(e.when)}</ActivityTime>
                      </ActivityLine>
                      <ActivityRole>{e.role}</ActivityRole>
                      <ActivityCo>{e.company}</ActivityCo>
                    </ActivityBody>
                    {!isTerminal && (
                      <ActivityRemove
                        type="button"
                        disabled={isBusy}
                        title={isInFlight ? 'Cancel this submission' : 'Remove from queue'}
                        onClick={(ev) => handleArchive(e.appId, ev)}
                      >
                        {isBusy ? '…' : removeLabel}
                      </ActivityRemove>
                    )}
                    {isTerminal && (
                      <ActivityRemove
                        type="button"
                        disabled={isBusy}
                        title="Permanently remove from history"
                        onClick={(ev) => handleArchive(e.appId, ev, { permanent: true })}
                      >
                        {isBusy ? '…' : 'Remove'}
                      </ActivityRemove>
                    )}
                  </ActivityRow>
                );
              })}
            </ActivityList>
          )}
        </RailPanel>

        <RailPanel>
          <RailLabel>Tips</RailLabel>
          <RailTip>
            <b>Close this tab safely.</b> The pilot runs server-side, you only need to come back to review.
          </RailTip>
          <RailTip>
            <b>Nothing is ever sent automatically.</b> Each application waits for your approval.
          </RailTip>
        </RailPanel>
      </Rail>

      <Main>
      {/* ─── Hero, adapts to state ─── */}
      <Hero $mode={heroMode}>
        <HeroBody>
          <HeroEyebrow $mode={heroMode}>
            {heroMode === 'review' && 'TAILORED & READY'}
            {heroMode === 'scanning' && 'AGENT IS WORKING'}
            {heroMode === 'submitting' && 'SUBMITTING'}
            {heroMode === 'start' && "YOU'RE ALL SET"}
            {heroMode === 'offline' && 'CONNECTION LOST'}
          </HeroEyebrow>

          <HeroTitle>
            {heroMode === 'review' && (
              <>
                <Big>{pending.length}</Big>{' '}
                {pending.length === 1 ? 'application is' : 'applications are'} tailored and ready for review &amp; apply
              </>
            )}
            {heroMode === 'scanning' && <>The pilot is scanning 40+ job boards</>}
            {heroMode === 'submitting' && (
              <>
                Sending <Big>{inFlight}</Big> {inFlight === 1 ? 'application' : 'applications'} for you…
              </>
            )}
            {heroMode === 'start' && <>Ready to start your job search?</>}
            {heroMode === 'offline' && <>Backend is unreachable</>}
          </HeroTitle>

          <HeroLede>
            {heroMode === 'review' && (
              <>
                These are your highest-fit matches based on your profile, each one comes with a
                tailored resume, cover letter, and Q&amp;A drafted for the role. Review, then apply
                in one click with our Chrome extension that auto-fills the form for you.
              </>
            )}
            {heroMode === 'scanning' && (
              <>
                We&apos;ll ping you the moment something strong comes in. Close this tab, the pilot
                keeps working.
              </>
            )}
            {heroMode === 'submitting' && (
              <>
                Your approvals are being sent. You&apos;ll see them on the Sent page as each one lands.
              </>
            )}
            {heroMode === 'start' && (
              <>
                Your criteria are saved. One click starts the pilot scanning 40+ boards 24/7, you
                just review and approve.
              </>
            )}
            {heroMode === 'offline' && (
              <>Start the server and click Refresh.</>
            )}
          </HeroLede>

          <HeroActions>
            {heroMode === 'review' && (
              <>
                <PrimaryBig onClick={goReviewFirst}>
                  Review first application
                </PrimaryBig>
                <GhostBtn onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </GhostBtn>
                <PilotToggleBtn
                  $running={isRunning}
                  disabled={pilotBusy}
                  onClick={handleTogglePilot}
                >
                  <ToggleDot $running={isRunning} />
                  {pilotBusy ? '…' : isRunning ? 'Pause pilot' : 'Resume pilot'}
                </PilotToggleBtn>
              </>
            )}
            {heroMode === 'scanning' && (
              <>
                <PrimaryBig
                  $variant="warn"
                  disabled={pilotBusy}
                  onClick={handleTogglePilot}
                >
                  {pilotBusy ? '…' : 'Pause pilot'}
                </PrimaryBig>
                <GhostBtn onClick={() => navigate('/applypilot/agent')}>Edit criteria</GhostBtn>
              </>
            )}
            {heroMode === 'submitting' && (
              <>
                <PrimaryBig onClick={() => navigate('/applypilot/sent')}>
                  See what&apos;s being sent
                </PrimaryBig>
                <GhostBtn onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </GhostBtn>
                <PilotToggleBtn
                  $running={isRunning}
                  disabled={pilotBusy}
                  onClick={handleTogglePilot}
                >
                  <ToggleDot $running={isRunning} />
                  {pilotBusy ? '…' : isRunning ? 'Pause pilot' : 'Resume pilot'}
                </PilotToggleBtn>
              </>
            )}
            {heroMode === 'start' && (
              <>
                <PrimaryBig
                  disabled={pilotBusy || isOffline}
                  onClick={handleTogglePilot}
                >
                  {pilotBusy ? 'Starting…' : 'Start pilot'}
                </PrimaryBig>
                <GhostBtn onClick={() => navigate('/applypilot/agent')}>Edit criteria</GhostBtn>
              </>
            )}
            {heroMode === 'offline' && (
              <GhostBtn onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </GhostBtn>
            )}
          </HeroActions>
        </HeroBody>

        {/* Right-side visual, changes per state */}
        <HeroVisual aria-hidden>
          {heroMode === 'review' && (
            <ReviewStack>
              {[0, 1, 2].slice(0, Math.min(3, pending.length)).map((i) => (
                <StackCard key={i} $depth={i}>
                  <CompanyAvatar
                    company={pending[i]?.company}
                    companyKey={pending[i]?.companyKey}
                    letter={pending[i]?.logoText}
                    size={40}
                    radius={10}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <StackRole>{pending[i]?.role || 'Role'}</StackRole>
                    <StackCo>{pending[i]?.company || 'Company'}</StackCo>
                  </div>
                  <StackPill>{pending[i]?.match ?? 90}%</StackPill>
                </StackCard>
              ))}
            </ReviewStack>
          )}
          {(heroMode === 'scanning' || heroMode === 'submitting') && <ScanAnim />}
          {heroMode === 'start' && <StartAnim />}
        </HeroVisual>
      </Hero>

      {/* ─── KPI tiles ─── */}
      <KpiGrid>
        {kpis.map((k) => (
          <KpiTile key={k.key} $tone={k.tone}>
            <KpiIcon aria-hidden>{k.icon}</KpiIcon>
            <KpiValue $tone={k.tone}>{k.value}</KpiValue>
            <KpiLabel>{k.label}</KpiLabel>
          </KpiTile>
        ))}
      </KpiGrid>

      {/* ─── Agent summary card ─── */}
      <AgentCard>
        <AgentHead>
          <AgentHeadLeft>
            <AgentTitleRow>
              <AgentTitle>Your ApplyPilot agent</AgentTitle>
              <AgentStatus $running={isRunning}>
                <StatusDot $running={isRunning} />
                {isRunning ? 'Running' : 'Paused'}
              </AgentStatus>
            </AgentTitleRow>
            <AgentSub>
              Scanning {(criteria.roleTitles || []).length || 0} role{(criteria.roleTitles || []).length === 1 ? '' : 's'} across
              {' '}{(criteria.locations || []).length || 0} location{(criteria.locations || []).length === 1 ? '' : 's'} · {scheduleLabel}
            </AgentSub>
          </AgentHeadLeft>
          <EditBtn onClick={() => navigate('/applypilot/agent')}>Edit criteria</EditBtn>
        </AgentHead>

        <CritGrid>
          <CritCell>
            <CritK>Roles</CritK>
            <CritV>
              {(criteria.roleTitles || []).length > 0
                ? <ChipRow>{(criteria.roleTitles || []).slice(0, 4).map((r) => <MiniChip key={r}>{r}</MiniChip>)}{(criteria.roleTitles || []).length > 4 && <MiniChip $muted>+{(criteria.roleTitles || []).length - 4}</MiniChip>}</ChipRow>
                : <CritEmpty>Not set</CritEmpty>}
            </CritV>
          </CritCell>

          <CritCell>
            <CritK>Locations</CritK>
            <CritV>
              {(criteria.locations || []).length > 0
                ? <ChipRow>{(criteria.locations || []).slice(0, 3).map((r) => <MiniChip key={r}>{r}</MiniChip>)}{(criteria.locations || []).length > 3 && <MiniChip $muted>+{(criteria.locations || []).length - 3}</MiniChip>}</ChipRow>
                : <CritEmpty>Any</CritEmpty>}
            </CritV>
          </CritCell>

          <CritCell>
            <CritK>Workstyle</CritK>
            <CritV>
              {(criteria.workstyle || []).length > 0
                ? <ChipRow>{(criteria.workstyle || []).map((r) => <MiniChip key={r}>{r}</MiniChip>)}</ChipRow>
                : <CritEmpty>Any</CritEmpty>}
            </CritV>
          </CritCell>

          <CritCell>
            <CritK>Salary floor</CritK>
            <CritV>
              {typeof criteria.salaryFloorK === 'number'
                ? <CritStrong>${criteria.salaryFloorK}k+</CritStrong>
                : <CritEmpty>Not set</CritEmpty>}
            </CritV>
          </CritCell>

          <CritCell>
            <CritK>Daily cap</CritK>
            <CritV>
              <CritStrong>{
                (typeof criteria.dailyLimit === 'number' ? criteria.dailyLimit : null)
                ?? rails.dailyCap
                ?? 20
              }</CritStrong> <CritMuted>apps / day</CritMuted>
            </CritV>
          </CritCell>

          <CritCell>
            <CritK>Blocked</CritK>
            <CritV>
              <CritStrong>
                {((rails.blockedCompanies || []).length + (rails.blockedKeywords || []).length) || 'None'}
              </CritStrong>{' '}
              {((rails.blockedCompanies || []).length + (rails.blockedKeywords || []).length) > 0 && (
                <CritMuted>filter{((rails.blockedCompanies || []).length + (rails.blockedKeywords || []).length) === 1 ? '' : 's'}</CritMuted>
              )}
            </CritV>
          </CritCell>
        </CritGrid>
      </AgentCard>

      {/* ─── Empty-state when pilot running and nothing yet ─── */}
      {isRunning && pending.length === 0 && liveBlockers.length === 0 && inFlight === 0 && (() => {
        const diag = interpretScoutFunnel(cfg?.lastScoutRun);
        return (
          <EmptyQueue>
            <EmptyEmoji aria-hidden>🔭</EmptyEmoji>
            <EmptyTitle>{diag.title}</EmptyTitle>
            <EmptySub>{diag.sub}</EmptySub>
            {diag.hint && <EmptyHint>{diag.hint}</EmptyHint>}
            {diag.cta && (
              <EmptyCta type="button" onClick={() => navigate(diag.cta.to)}>
                {diag.cta.label}
              </EmptyCta>
            )}
          </EmptyQueue>
        );
      })()}

      {/* ─── Ready to review cards ─── */}
      {pending.length > 0 && (
        <>
          <SectionHead>
            <h2>Ready to review</h2>
            <Count>{pending.length}</Count>
          </SectionHead>

          <ReviewGrid>
            {pending.map((a) => (
              <ReviewCard key={a.id} onClick={() => openDetail(a.id)}>
                <CardTop>
                  <CompanyAvatar
                    company={a.company}
                    companyKey={a.companyKey}
                    letter={a.logoText}
                    size={36}
                    radius={10}
                  />
                  {typeof a.match === 'number' && (
                    <MatchPill $tier={matchTier(a.match)}>{a.match}% match</MatchPill>
                  )}
                </CardTop>
                <CardRole>{a.role}</CardRole>
                <CardCo>
                  {a.company}
                  {a.location ? ` · ${a.location}` : ''}
                </CardCo>
                {a.salary && <CardSalary>{a.salary}</CardSalary>}
                <CardBottom>
                  <CardTime>{RELATIVE(a.caughtAt || a.updatedAt)}</CardTime>
                  <ReviewBtn onClick={(e) => { e.stopPropagation(); openDetail(a.id); }}>
                    Review
                  </ReviewBtn>
                </CardBottom>
              </ReviewCard>
            ))}
          </ReviewGrid>
        </>
      )}

      {/* ─── Blockers ─── */}
      {(liveBlockers.length + deadWeight.length) > 0 && (
        <BlockersWrap>
          <BlockersToggle onClick={() => setBlockersOpen((v) => !v)}>
            <span className="caret">{blockersOpen ? '▾' : '▸'}</span>
            <span className="label">Blockers</span>
            {liveBlockers.length > 0 && <CountWarn>{liveBlockers.length}</CountWarn>}
            {deadWeight.length > 0 && (
              <span className="muted">· {deadWeight.length} auto-dismissed</span>
            )}
            <span className="chev">{blockersOpen ? 'Hide' : 'Show'}</span>
          </BlockersToggle>

          {blockersOpen && (
            <BlockersList>
              {liveBlockers.map((a) => (
                <BlockerRow key={a.id} onClick={() => openDetail(a.id)}>
                  <CompanyAvatar
                    company={a.company}
                    companyKey={a.companyKey}
                    letter={a.logoText}
                    size={36}
                    radius={10}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <CardRole style={{ fontSize: 14 }}>{a.role}</CardRole>
                    <CardCo>
                      {a.company}
                      {a.location ? ` · ${a.location}` : ''}
                      {a.submissionError && (
                        <ErrChip> · {String(a.submissionError).slice(0, 90)}</ErrChip>
                      )}
                    </CardCo>
                  </div>
                  <BlockerActions onClick={(e) => e.stopPropagation()}>
                    {a.dbStatus === 'failed' && (
                      <MiniBtn
                        disabled={busyId === a.id}
                        onClick={(e) => handleRetry(a.id, e)}
                      >
                        {busyId === a.id ? '…' : 'Retry'}
                      </MiniBtn>
                    )}
                    <MiniBtnGhost
                      disabled={busyId === a.id}
                      onClick={(e) => handleArchive(a.id, e)}
                    >
                      Archive
                    </MiniBtnGhost>
                  </BlockerActions>
                </BlockerRow>
              ))}

              {deadWeight.length > 0 && (
                <DeadWeightFoot>
                  <span>
                    {deadWeight.length} auto-dismissed, the ATS isn&apos;t supported yet, or the
                    posting was pulled.
                  </span>
                  <MiniBtnGhost
                    disabled={busyId === 'bulk'}
                    onClick={handleArchiveAllDead}
                  >
                    {busyId === 'bulk' ? 'Archiving…' : 'Archive all'}
                  </MiniBtnGhost>
                </DeadWeightFoot>
              )}
            </BlockersList>
          )}
        </BlockersWrap>
      )}
      </Main>
    </DashLayout>
    {confirmState.open && (() => {
      const isBulk = confirmState.mode === 'bulk';
      const targetApp = !isBulk ? (queue || []).find((a) => a.id === confirmState.appId) : null;
      return (
        <ConfirmModal
          show
          variant="danger"
          title={isBulk
            ? `Archive ${deadWeight.length} dead-end application${deadWeight.length === 1 ? '' : 's'}?`
            : (confirmState.permanent ? 'Remove this application?' : 'Archive this application?')}
          subtitle={!isBulk && targetApp ? `${targetApp.role} · ${targetApp.company}` : undefined}
          message={isBulk
            ? 'These were auto-dismissed because the source job is unsupported, delisted, or otherwise unreachable. Archiving removes them from your queue.'
            : (confirmState.permanent
              ? 'This permanently deletes the application from your history. It cannot be undone.'
              : 'This removes the application from your queue. You can’t undo this.')}
          confirmText={isBulk
            ? `Archive ${deadWeight.length}`
            : (confirmState.permanent ? 'Remove' : 'Archive')}
          cancelText="Keep it"
          loading={isBulk ? busyId === 'bulk' : busyId === confirmState.appId}
          loadingText={confirmState.permanent ? 'Removing…' : 'Archiving…'}
          onClose={closeConfirm}
          onConfirm={performArchive}
        />
      );
    })()}
    </Page>
  );
};

export default DashboardPage;

/* ───────────── ScanAnim, animated scanner visual ───────────── */

const ScanAnim = () => (
  <ScanWrap>
    <ScanRings>
      <Ring $delay="0s" />
      <Ring $delay="0.7s" />
      <Ring $delay="1.4s" />
    </ScanRings>
    <ScanChips>
      <ScanChip $d="0s">Greenhouse</ScanChip>
      <ScanChip $d="0.4s">Lever</ScanChip>
      <ScanChip $d="0.8s">Ashby</ScanChip>
      <ScanChip $d="1.2s">Workday</ScanChip>
    </ScanChips>
  </ScanWrap>
);

const StartAnim = () => (
  <StartWrap aria-hidden="true">
    <Orbit>
      <OrbitRing $size={140} $dur="14s" />
      <OrbitRing $size={104} $dur="10s" $reverse />
      <OrbitRing $size={72} $dur="7s" />
      <OrbitDot $orbit={140} $dur="14s" $delay="0s" />
      <OrbitDot $orbit={104} $dur="10s" $delay="-3s" $reverse />
      <OrbitDot $orbit={72}  $dur="7s"  $delay="-1.5s" />
    </Orbit>
    <PulseHalo />
    <CoreOrb />
    <Spark style={{ top: '12%', left: '18%' }} $d="0s" />
    <Spark style={{ top: '72%', left: '80%' }} $d="0.8s" />
    <Spark style={{ top: '30%', left: '82%' }} $d="1.6s" />
    <Spark style={{ top: '78%', left: '16%' }} $d="2.4s" />
  </StartWrap>
);

/* ───────────── tokens ───────────── */

const BRAND = '#6C5CE7';
const BRAND_700 = '#5948C9';
const BRAND_50 = '#EFECFB';
const INK = '#17152A';
const INK_SOFT = '#2D2A3E';
const MUTED = '#6B6787';
const LINE = '#E4DFF5';
const BG = '#F7F6FB';
const CARD_BG = '#FFFFFF';
const GOOD = '#22C55E';

const LOGO_PALETTE = ['#5B8DEF', '#22C55E', '#F59E0B', '#E879F9', '#06B6D4', '#F43F5E', '#A78BFA', '#84CC16'];
const logoColor = (key) => {
  if (!key) return BRAND;
  let h = 0;
  for (let i = 0; i < String(key).length; i += 1) h = (h * 31 + String(key).charCodeAt(i)) | 0;
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length];
};

/* ───────────── styles ───────────── */

const Page = styled.div`
  background: ${BG};
  padding: 24px 32px 80px;
  min-height: calc(100vh - 120px);
  max-width: 1360px;
  margin: 0 auto;

  @media (max-width: 768px) { padding: 18px 16px 60px; }
`;

/* Dashboard-only side rail layout */

const DashLayout = styled.div`
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 24px;
  align-items: start;

  @media (max-width: 1024px) { grid-template-columns: 1fr; gap: 16px; }
`;

const Rail = styled.aside`
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;

  @media (max-width: 1024px) { position: static; }
`;

const Main = styled.div`
  min-width: 0;
`;

const RailNav = styled.nav`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
`;

const RailLabel = styled.div`
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${MUTED};
  padding: 4px 8px 8px;
`;

const RailLink = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: ${(p) => (p.$tone === 'brand' ? BRAND : p.$tone === 'warn' ? '#FFF4E0' : 'transparent')};
  color: ${(p) => (p.$tone === 'brand' ? '#FFFFFF' : p.$tone === 'warn' ? '#8A5A00' : INK_SOFT)};
  border: ${(p) => (p.$tone === 'warn' ? '1px solid #F4D9A1' : '0')};
  border-radius: 9px;
  padding: 9px 10px;
  font-size: 13.5px;
  font-weight: ${(p) => (p.$tone ? 800 : 600)};
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, transform 0.08s;
  &:hover:not(:disabled) {
    background: ${(p) => (p.$tone === 'brand' ? BRAND_700 : p.$tone === 'warn' ? '#FFEBC7' : BRAND_50)};
    color: ${(p) => (p.$tone === 'brand' ? '#FFFFFF' : p.$tone === 'warn' ? '#8A5A00' : BRAND_700)};
  }
  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 11px 12px;
    font-size: 14.5px;
    border-radius: 10px;
  }
`;

const RailIcon = styled.span`
  width: 18px;
  font-size: 13px;
  text-align: center;
  flex-shrink: 0;
  opacity: 0.85;
`;

const RailCount = styled.span`
  margin-left: auto;
  font-size: 11px;
  font-weight: 800;
  background: ${BRAND};
  color: #FFFFFF;
  border-radius: 999px;
  padding: 1px 7px;
  min-width: 18px;
  text-align: center;
`;

const RailPanel = styled.div`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 14px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
`;

const RailEmpty = styled.div`
  font-size: 12.5px;
  color: ${MUTED};
  line-height: 1.5;
  padding: 4px 2px 2px;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ACT_KIND = {
  matched:    { fg: BRAND_700,  dot: BRAND },
  approved:   { fg: '#1D4ED8',  dot: '#3B82F6' },
  submitting: { fg: '#1D4ED8',  dot: '#2563EB' },
  sent:       { fg: '#147A41',  dot: '#22C55E' },
  rejected:   { fg: '#6B6787',  dot: '#9CA3AF' },
  blocker:    { fg: '#8A3F00',  dot: '#D97706' },
};

const ActivityRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  align-items: flex-start;
  &:hover { background: ${BRAND_50}; }
  &:focus-visible { outline: 2px solid ${BRAND}; outline-offset: 1px; }
`;

const ActivityRemove = styled.button`
  flex: 0 0 auto;
  align-self: center;
  background: transparent;
  color: ${MUTED};
  border: 1px solid ${LINE};
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms, background 120ms, color 120ms;
  ${ActivityRow}:hover & { opacity: 1; }
  &:hover { background: #FEF2F2; color: #B91C1C; border-color: #FCA5A5; }
  &:disabled { cursor: wait; opacity: 0.6; }

  @media (max-width: 768px) {
    /* On touch devices there's no hover, so always show. Promote to a
       proper 44pt tap target. */
    opacity: 1;
    min-height: 44px;
    min-width: 44px;
    padding: 0 12px;
    font-size: 13px;
    border-radius: 10px;
  }
`;

const ActivityDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
  background: ${(p) => ACT_KIND[p.$kind]?.dot || MUTED};
`;

const ActivityBody = styled.div`
  min-width: 0;
  flex: 1;
`;

const ActivityLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
`;

const ActivityKind = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${(p) => ACT_KIND[p.$kind]?.fg || INK};
`;

const ActivityTime = styled.span`
  font-size: 10.5px;
  color: ${MUTED};
  white-space: nowrap;
`;

const ActivityRole = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: ${INK};
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActivityCo = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RailTip = styled.div`
  font-size: 12px;
  color: ${MUTED};
  line-height: 1.5;
  padding: 6px 8px;
  background: ${BRAND_50};
  border-radius: 8px;
  b { color: ${INK}; font-weight: 700; }
`;

/* Hero */

const HERO_TONE = {
  review:     { bg: 'linear-gradient(135deg, #EFECFB 0%, #F7F6FB 100%)', accent: BRAND,       border: '#D7CFF5' },
  scanning:   { bg: 'linear-gradient(135deg, #EBFBF0 0%, #F6FDF8 100%)', accent: '#16A34A',   border: '#C8EBD2' },
  submitting: { bg: 'linear-gradient(135deg, #E7F0FF 0%, #F5F8FF 100%)', accent: '#2563EB',   border: '#C7D7F7' },
  start:      { bg: 'linear-gradient(135deg, #FFF6E7 0%, #FFFBF2 100%)', accent: '#CA8A04',   border: '#F0D49A' },
  offline:    { bg: '#FFF0F0',                                           accent: '#C42B35',   border: '#F4B5B5' },
};

const Hero = styled.section`
  background: ${(p) => HERO_TONE[p.$mode].bg};
  border: 1px solid ${(p) => HERO_TONE[p.$mode].border};
  border-radius: 20px;
  padding: 36px 36px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 32px;
  align-items: center;
  margin-bottom: 28px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    padding: 28px 22px;
    gap: 20px;
  }
`;

const HeroBody = styled.div`
  min-width: 0;
`;

const HeroEyebrow = styled.div`
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: ${(p) => HERO_TONE[p.$mode].accent};
  margin-bottom: 10px;
`;

const HeroTitle = styled.h1`
  margin: 0 0 14px;
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.022em;
  line-height: 1.2;
`;

const Big = styled.span`
  color: ${BRAND};
`;

const HeroLede = styled.p`
  margin: 0 0 22px;
  font-size: 15px;
  line-height: 1.6;
  color: ${MUTED};
  max-width: 56ch;
`;

const HeroActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
`;

const PrimaryBig = styled.button`
  background: ${(p) => (p.$variant === 'warn' ? '#FFFFFF' : BRAND)};
  color: ${(p) => (p.$variant === 'warn' ? INK : '#FFFFFF')};
  border: ${(p) => (p.$variant === 'warn' ? `1px solid ${LINE}` : '0')};
  border-radius: 12px;
  padding: 13px 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${(p) => (p.$variant === 'warn' ? 'none' : '0 8px 22px rgba(108, 92, 231, 0.3)')};
  transition: background 0.15s, transform 0.15s;
  &:disabled { opacity: 0.7; cursor: default; transform: none; }
  &:hover { background: ${(p) => (p.$variant === 'warn' ? '#F4F2FB' : BRAND_700)}; transform: translateY(-1px); }
`;

const GhostBtn = styled.button`
  background: #FFFFFF;
  color: ${INK_SOFT};
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 13px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #F4F2FB; }
`;

const PilotToggleBtn = styled.button`
  background: #FFFFFF;
  color: ${(p) => (p.$running ? '#8A5A00' : INK_SOFT)};
  border: 1px solid ${(p) => (p.$running ? '#F0D49A' : LINE)};
  border-radius: 12px;
  padding: 13px 16px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s;
  &:disabled { opacity: 0.6; cursor: default; }
  &:hover { background: ${(p) => (p.$running ? '#FFF7E6' : '#F4F2FB')}; }
`;

const runningPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
`;

const ToggleDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => (p.$running ? '#22C55E' : '#D99717')};
  ${(p) => p.$running && css`animation: ${runningPulse} 1.6s infinite ease-in-out;`}
`;

/* Hero visuals */

const HeroVisual = styled.div`
  position: relative;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 860px) { display: none; }
`;

const ReviewStack = styled.div`
  position: relative;
  width: 260px;
  height: 170px;
`;

const StackCard = styled.div`
  position: absolute;
  left: ${(p) => p.$depth * 10}px;
  top: ${(p) => p.$depth * 18}px;
  right: ${(p) => -p.$depth * 10}px;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 6px 18px rgba(23, 21, 42, 0.08);
  z-index: ${(p) => 10 - p.$depth};
  opacity: ${(p) => 1 - p.$depth * 0.15};
`;

const StackLogo = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: ${BRAND};
  color: #FFFFFF;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
`;

const StackRole = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: ${INK};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StackCo = styled.div`
  font-size: 11px;
  color: ${MUTED};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StackPill = styled.span`
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  background: #E8FAF0;
  color: #147A41;
  flex-shrink: 0;
`;

const ScanWrap = styled.div`
  position: relative;
  width: 260px;
  height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
`;

const scanPulse = keyframes`
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(1.4); opacity: 0; }
`;

const ScanRings = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
`;

const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid #22C55E;
  animation: ${scanPulse} 2.1s infinite ease-out;
  animation-delay: ${(p) => p.$delay};
`;

const ScanChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
`;

const chipPop = keyframes`
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30%           { opacity: 1;   transform: translateY(-2px); }
`;

const ScanChip = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: #FFFFFF;
  border: 1px solid #C8EBD2;
  color: #0F5D2E;
  animation: ${chipPop} 2.4s infinite ease-in-out;
  animation-delay: ${(p) => p.$d};
`;

const StartWrap = styled.div`
  position: relative;
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const spinReverse = keyframes`
  from { transform: rotate(360deg); }
  to   { transform: rotate(0deg); }
`;

const haloPulse = keyframes`
  0%   { transform: scale(0.9); opacity: 0.55; }
  70%  { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
`;

const coreBreath = keyframes`
  0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(108,92,231,0.55), 0 10px 28px rgba(108,92,231,0.35); }
  50%      { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(108,92,231,0),  0 14px 32px rgba(108,92,231,0.4); }
`;

const sparkBlink = keyframes`
  0%, 100% { transform: scale(0.6); opacity: 0; }
  50%      { transform: scale(1);   opacity: 1; }
`;

const Orbit = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
`;

const OrbitRing = styled.div`
  position: absolute;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  border: 1px dashed rgba(108, 92, 231, 0.28);
  animation: ${(p) => (p.$reverse ? spinReverse : spin)} ${(p) => p.$dur} linear infinite;
`;

const OrbitDot = styled.div`
  position: absolute;
  width: ${(p) => p.$orbit}px;
  height: ${(p) => p.$orbit}px;
  animation: ${(p) => (p.$reverse ? spinReverse : spin)} ${(p) => p.$dur} linear infinite;
  animation-delay: ${(p) => p.$delay || '0s'};

  &::after {
    content: '';
    position: absolute;
    top: -4px;
    left: 50%;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: linear-gradient(135deg, #8B7BFF 0%, #6C5CE7 100%);
    box-shadow: 0 0 10px rgba(108, 92, 231, 0.8), 0 0 2px #fff inset;
  }
`;

const PulseHalo = styled.div`
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(108,92,231,0.35) 0%, rgba(108,92,231,0) 70%);
  animation: ${haloPulse} 2.4s ease-out infinite;
`;

const CoreOrb = styled.div`
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, #B6ADFF 0%, #8B7BFF 35%, #6C5CE7 70%, #5948C9 100%);
  animation: ${coreBreath} 2.4s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    top: 18%;
    left: 22%;
    width: 30%;
    height: 22%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    filter: blur(1px);
  }
`;

const Spark = styled.div`
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #8B7BFF;
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.9);
  animation: ${sparkBlink} 2.4s ease-in-out infinite;
  animation-delay: ${(p) => p.$d || '0s'};
`;

/* KPI tiles */

const KPI_TONE = {
  brand: { fg: BRAND_700, bg: BRAND_50, bd: '#D7CFF5' },
  blue:  { fg: '#1D4ED8', bg: '#EFF4FF', bd: '#C7D7F7' },
  warn:  { fg: '#8A3F00', bg: '#FFF0E0', bd: '#F4D9A1' },
  muted: { fg: INK_SOFT,  bg: '#FFFFFF', bd: LINE },
};

const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;

  @media (max-width: 720px) { grid-template-columns: repeat(2, 1fr); }
`;

const KpiTile = styled.div`
  background: ${(p) => KPI_TONE[p.$tone]?.bg || '#FFFFFF'};
  border: 1px solid ${(p) => KPI_TONE[p.$tone]?.bd || LINE};
  border-radius: 14px;
  padding: 14px 16px;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
`;

const KpiIcon = styled.div`
  font-size: 18px;
  line-height: 1;
  margin-bottom: 6px;
`;

const KpiValue = styled.div`
  font-size: 26px;
  font-weight: 800;
  color: ${(p) => KPI_TONE[p.$tone]?.fg || INK};
  letter-spacing: -0.02em;
  line-height: 1.1;
`;

const KpiLabel = styled.div`
  font-size: 12.5px;
  color: ${MUTED};
  font-weight: 600;
`;

/* Agent summary card */

const AgentCard = styled.section`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 16px;
  padding: 20px 22px;
  margin-bottom: 28px;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
`;

const AgentHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  @media (max-width: 540px) { flex-direction: column; align-items: stretch; gap: 10px; }
`;

const AgentHeadLeft = styled.div`
  min-width: 0;
`;

const AgentTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const AgentTitle = styled.h3`
  margin: 0;
  font-size: 15.5px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
`;

const AgentStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${(p) => (p.$running ? '#E8FAF0' : '#FFF4E0')};
  color: ${(p) => (p.$running ? '#147A41' : '#8A5A00')};
  border: 1px solid ${(p) => (p.$running ? '#BBEBD0' : '#F4D9A1')};
`;

const StatusDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${(p) => (p.$running ? '#22C55E' : '#D99717')};
  ${(p) => p.$running && css`animation: ${runningPulse} 1.6s infinite ease-in-out;`}
`;

const AgentSub = styled.div`
  font-size: 13px;
  color: ${MUTED};
  margin-top: 6px;
  line-height: 1.5;
`;

const EditBtn = styled.button`
  background: ${BRAND_50};
  color: ${BRAND_700};
  border: 1px solid #D7CFF5;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover { background: #E7E1F9; }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 11px 16px;
    font-size: 14px;
  }
`;

const CritGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 20px;

  @media (max-width: 720px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 460px) { grid-template-columns: 1fr; }
`;

const CritCell = styled.div`
  min-width: 0;
  border-left: 2px solid ${LINE};
  padding: 2px 0 2px 12px;
`;

const CritK = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${MUTED};
  margin-bottom: 6px;
`;

const CritV = styled.div`
  font-size: 13.5px;
  color: ${INK};
  line-height: 1.4;
  min-height: 22px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const CritStrong = styled.span`
  font-weight: 800;
  color: ${INK};
`;

const CritMuted = styled.span`
  color: ${MUTED};
  font-size: 12.5px;
`;

const CritEmpty = styled.span`
  color: ${MUTED};
  font-style: italic;
  font-size: 12.5px;
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const MiniChip = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: ${(p) => (p.$muted ? '#F4F2FB' : BRAND_50)};
  color: ${(p) => (p.$muted ? MUTED : BRAND_700)};
  border: 1px solid ${(p) => (p.$muted ? LINE : '#D7CFF5')};
`;

/* Empty queue state */

const EmptyQueue = styled.div`
  background: ${CARD_BG};
  border: 1px dashed ${LINE};
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  margin-bottom: 28px;
`;

const EmptyEmoji = styled.div`
  font-size: 40px;
  margin-bottom: 10px;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
  margin-bottom: 6px;
`;

const EmptySub = styled.div`
  font-size: 13.5px;
  color: ${MUTED};
  max-width: 52ch;
  margin: 0 auto;
  line-height: 1.5;
`;

const EmptyHint = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
  opacity: 0.7;
  margin-top: 10px;
  font-variant-numeric: tabular-nums;
`;

const EmptyCta = styled.button`
  margin-top: 16px;
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid ${LINE};
  background: ${INK};
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
  &:hover { opacity: 0.85; }
`;

/* Section head */

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: ${INK};
    letter-spacing: -0.015em;
  }
`;

const Count = styled.span`
  background: ${BRAND_50};
  color: ${BRAND_700};
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 800;
`;

/* Review cards */

const ReviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  margin-bottom: 28px;
`;

const ReviewCard = styled.div`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
  &:hover {
    border-color: #C9BFEF;
    box-shadow: 0 10px 24px rgba(23, 21, 42, 0.08);
    transform: translateY(-1px);
  }
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
`;

const Logo = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${(p) => logoColor(p.$key)};
  color: #FFFFFF;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
  letter-spacing: -0.01em;
`;

const MATCH_TIER = {
  good:    { bg: '#E8FAF0', fg: '#147A41', bd: '#BBEBD0' },
  ok:      { bg: '#EFECFB', fg: '#5948C9', bd: '#D7CFF5' },
  fair:    { bg: '#FFF4E0', fg: '#8A5A00', bd: '#F4D9A1' },
  neutral: { bg: '#F4F2FB', fg: '#6B6787', bd: '#E4DFF5' },
};

const MatchPill = styled.span`
  font-size: 12px;
  font-weight: 800;
  padding: 4px 9px;
  border-radius: 999px;
  background: ${(p) => MATCH_TIER[p.$tier].bg};
  color: ${(p) => MATCH_TIER[p.$tier].fg};
  border: 1px solid ${(p) => MATCH_TIER[p.$tier].bd};
`;

const CardRole = styled.div`
  font-size: 15.5px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardCo = styled.div`
  font-size: 13px;
  color: ${MUTED};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardSalary = styled.div`
  font-size: 12.5px;
  color: ${INK_SOFT};
  font-weight: 600;
`;

const CardBottom = styled.div`
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
`;

const CardTime = styled.span`
  font-size: 12px;
  color: ${MUTED};
`;

const ReviewBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: ${BRAND_700}; }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 10px 18px;
    font-size: 14px;
  }
`;

/* Blockers */

const BlockersWrap = styled.div`
  margin-top: 8px;
`;

const BlockersToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #FFF7F2;
  border: 1px solid #F4D9C4;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 700;
  color: #6B3B1A;
  text-align: left;
  &:hover { background: #FFF0E5; }
  .caret { font-size: 14px; width: 12px; }
  .muted { color: #8B5A3C; font-weight: 500; font-size: 12.5px; }
  .chev { margin-left: auto; color: #8B5A3C; font-weight: 600; font-size: 12.5px; }
`;

const CountWarn = styled.span`
  background: #FFE4CC;
  color: #8A3F00;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11.5px;
  font-weight: 800;
`;

const BlockersList = styled.div`
  margin-top: 10px;
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const BlockerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  &:hover { background: #FAF9FD; }
`;

const ErrChip = styled.span`
  color: #C42B35;
`;

const BlockerActions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const MiniBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; }
  &:hover { background: ${BRAND_700}; }
`;

const MiniBtnGhost = styled.button`
  background: #FFFFFF;
  color: ${INK_SOFT};
  border: 1px solid ${LINE};
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: 0.6; }
  &:hover { background: #F4F2FB; }
`;

const DeadWeightFoot = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-top: 2px;
  border-top: 1px solid ${LINE};
  font-size: 12.5px;
  color: ${MUTED};
  span { flex: 1; }
`;
