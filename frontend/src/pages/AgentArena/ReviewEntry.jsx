import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useReviewQueue, rejectApplication, rejectApplicationsBulk } from '../../hooks/useApplyPilot';
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
  if (err.includes('was pulled')) return true;
  if (err.includes('no longer available')) return true;
  if (err.includes('listing has no inline application form')) return true;
  return false;
};

const matchTier = (m) => {
  if (typeof m !== 'number') return 'neutral';
  if (m >= 88) return 'good';
  if (m >= 75) return 'ok';
  return 'fair';
};

const LOGO_PALETTE = ['#5B8DEF', '#22C55E', '#F59E0B', '#E879F9', '#06B6D4', '#F43F5E', '#A78BFA', '#84CC16'];
const logoColor = (key) => {
  if (!key) return BRAND;
  let h = 0;
  for (let i = 0; i < String(key).length; i += 1) h = (h * 31 + String(key).charCodeAt(i)) | 0;
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length];
};

/* ───────────── page ───────────── */

const ReviewEntry = () => {
  const navigate = useNavigate();
  const { queue, loading, refetch } = useReviewQueue();
  // Exclude rejected/removed rows so removed apps disappear from the inbox
  // (the backend /queue still returns them so undo-reject can restore).
  // Bucket by the UI-mapped status (`a.status`), NOT the raw DB status.
  // Backend collapses scouting/pending/preparing/prepared → 'pending',
  // approved/submitting/submitted → 'approved', etc. Using `dbStatus`
  // here meant any row in `prepared` (the normal post-prep state) fell
  // into no bucket and the inbox rendered "No applications yet" while
  // the dashboard counter still showed 5.
  const list = (Array.isArray(queue) ? queue : []).filter((a) => {
    return a?.status !== 'rejected';
  });

  const buckets = useMemo(() => {
    const pending = [];
    const blocked = [];
    const deadWeight = [];
    const inflight = [];
    const sent = [];
    for (const a of list) {
      const ui = a.status;             // UI-mapped: pending|approved|rejected|needs_attention
      const db = a.dbStatus || a.status; // raw DB status, used to split inflight vs sent
      if (ui === 'pending') {
        pending.push(a);
      } else if (ui === 'needs_attention') {
        (isDeadWeight(a) ? deadWeight : blocked).push(a);
      } else if (ui === 'approved') {
        // 'approved' bucket from the API spans approved/submitting/submitted —
        // split it back so the Sent tab only contains rows that actually shipped.
        if (db === 'submitted') sent.push(a);
        else inflight.push(a);
      }
    }
    return { pending, blocked, deadWeight, inflight, sent, all: list };
  }, [list]);

  // Default tab: most urgent non-empty bucket.
  const defaultTab = useMemo(() => {
    if (buckets.pending.length) return 'pending';
    if (buckets.blocked.length) return 'blocked';
    if (buckets.inflight.length) return 'inflight';
    if (buckets.sent.length) return 'sent';
    return 'pending';
  }, [buckets]);

  const [userTab, setUserTab] = useState(null);
  const activeTab = userTab ?? defaultTab;
  const items = buckets[activeTab] || [];

  const tabs = [
    { key: 'pending',  label: 'Pending',   count: buckets.pending.length,  tone: 'brand' },
    { key: 'blocked',  label: 'Blocked',   count: buckets.blocked.length,  tone: 'warn'  },
    { key: 'inflight', label: 'In flight', count: buckets.inflight.length, tone: 'blue'  },
    { key: 'sent',     label: 'Sent',      count: buckets.sent.length,     tone: 'good'  },
    { key: 'all',      label: 'All',       count: list.length,             tone: 'muted' },
  ];

  const openDetail = (appId) => navigate(`/applypilot/inbox/${appId}`);

  // ── Multi-select + bulk remove ('clearAll' = nuke everything in inbox) ──
  const toast = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState('selected'); // 'selected' | 'clearAll'
  const [busy, setBusy] = useState(false);

  const toggleSelect = (e, id) => {
    e?.stopPropagation?.();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const enterSelectMode = () => { setSelectMode(true); setSelected(new Set()); };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const allVisibleIds = items.map((a) => a.id);
  const allSelectedOnTab = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelectedOnTab) {
        const next = new Set(prev);
        for (const id of allVisibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allVisibleIds) next.add(id);
      return next;
    });
  };
  const askBulkRemove = () => { if (selected.size > 0) { setConfirmMode('selected'); setConfirmOpen(true); } };
  const askClearAll = () => { setConfirmMode('clearAll'); setConfirmOpen(true); };
  const closeConfirm = () => { if (!busy) setConfirmOpen(false); };
  const performConfirm = async () => {
    setBusy(true);
    try {
      if (confirmMode === 'clearAll') {
        const { data } = await rejectApplicationsBulk({ all: true, reason: 'Cleared inbox' });
        await refetch();
        toast?.success?.(`Cleared ${data?.count ?? ''} application${(data?.count ?? 0) === 1 ? '' : 's'}.`);
        setConfirmOpen(false);
        exitSelectMode();
      } else {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        const { data } = await rejectApplicationsBulk({ ids, reason: 'Removed from inbox' });
        await refetch();
        const n = data?.count ?? ids.length;
        toast?.success?.(`Removed ${n} application${n === 1 ? '' : 's'}.`);
        setConfirmOpen(false);
        exitSelectMode();
      }
    } catch (err) {
      toast?.error?.('Could not remove. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const totalUseful = buckets.pending.length + buckets.blocked.length + buckets.inflight.length + buckets.sent.length;

  // Only when literally nothing exists AND loading is done.
  if (!loading && totalUseful === 0 && buckets.deadWeight.length === 0) {
    return (
      <Page>
        <EmptyWrap>
          <EmptyEmoji aria-hidden>📭</EmptyEmoji>
          <EmptyTitle>No applications yet</EmptyTitle>
          <EmptySub>
            The pilot hasn&apos;t picked up any matches yet. Start it from the dashboard if you haven&apos;t,
            and we&apos;ll populate this inbox as soon as there&apos;s something to review.
          </EmptySub>
          <EmptyActions>
            <PrimaryBtn onClick={() => navigate('/applypilot/dashboard')}>Back to Dashboard</PrimaryBtn>
            <GhostBtn onClick={refetch}>Refresh</GhostBtn>
          </EmptyActions>
        </EmptyWrap>
      </Page>
    );
  }

  return (
    <Page>
      <Head>
        <Title>Application inbox</Title>
        <Sub>
          Every application the pilot created, pending, blocked, in flight, and sent. Click any card
          to open its detail view.
        </Sub>
      </Head>

      <TabBar role="tablist">
        {tabs.map((t) => (
          <Tab
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            $active={activeTab === t.key}
            $tone={t.tone}
            onClick={() => setUserTab(t.key)}
            type="button"
          >
            <span>{t.label}</span>
            <TabCount $active={activeTab === t.key} $tone={t.tone}>{t.count}</TabCount>
          </Tab>
        ))}
      </TabBar>

      <Toolbar>
        {selectMode ? (
          <>
            <ToolbarBtn type="button" onClick={toggleSelectAll} disabled={items.length === 0}>
              <input type="checkbox" readOnly checked={allSelectedOnTab} aria-label="Select all on this tab" />
              {allSelectedOnTab ? 'Unselect all' : 'Select all'}
            </ToolbarBtn>
            <ToolbarCount>{selected.size} selected</ToolbarCount>
            <ToolbarSpacer />
            <ToolbarBtn type="button" onClick={exitSelectMode} disabled={busy}>Cancel</ToolbarBtn>
            <DangerBtn type="button" onClick={askBulkRemove} disabled={selected.size === 0 || busy}>
              Remove{selected.size > 0 ? ` (${selected.size})` : ''}
            </DangerBtn>
          </>
        ) : (
          <>
            <ToolbarSpacer />
            <ToolbarBtn type="button" onClick={askClearAll} disabled={list.length === 0}>
              Clear all
            </ToolbarBtn>
            <ToolbarBtn type="button" onClick={enterSelectMode} disabled={items.length === 0}>
              Select
            </ToolbarBtn>
          </>
        )}
      </Toolbar>

      {items.length === 0 ? (
        <BucketEmpty>
          <BucketEmptyTitle>{emptyTitle(activeTab)}</BucketEmptyTitle>
          <BucketEmptySub>{emptySub(activeTab)}</BucketEmptySub>
        </BucketEmpty>
      ) : (
        <Grid>
          {items.map((a) => {
            const isSelected = selected.has(a.id);
            const onCardClick = () => {
              if (selectMode) {
                toggleSelect(null, a.id);
              } else {
                openDetail(a.id);
              }
            };
            return (
              <Card key={a.id} onClick={onCardClick} $selected={selectMode && isSelected} $selectMode={selectMode}>
                {selectMode && (
                  <SelectBox
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(e) => toggleSelect(e, a.id)}
                    aria-label={isSelected ? 'Unselect application' : 'Select application'}
                  />
                )}
                <CardTop>
                  <CompanyAvatar
                    company={a.company}
                    companyKey={a.companyKey}
                    letter={a.logoText}
                    size={36}
                    radius={10}
                  />
                  <StatusBadge $bucket={activeTab}>{bucketLabel(a.dbStatus || a.status)}</StatusBadge>
                  {typeof a.match === 'number' && (
                    <MatchPill $tier={matchTier(a.match)}>{a.match}%</MatchPill>
                  )}
                </CardTop>
                <CardRole>{a.role}</CardRole>
                <CardCo>
                  {a.company}
                  {a.location ? ` · ${a.location}` : ''}
                </CardCo>
                {a.salary && <CardSalary>{a.salary}</CardSalary>}
                {a.submissionError && !isDeadWeight(a) && (
                  <CardErr>{String(a.submissionError).slice(0, 100)}</CardErr>
                )}
                <CardBottom>
                  <CardTime>{RELATIVE(a.updatedAt || a.caughtAt)}</CardTime>
                  {!selectMode && <CardCta>Open</CardCta>}
                </CardBottom>
              </Card>
            );
          })}
        </Grid>
      )}

      {activeTab === 'blocked' && buckets.deadWeight.length > 0 && (
        <DeadNote>
          <b>{buckets.deadWeight.length} auto-dismissed</b>, the ATS isn&apos;t supported yet, or the
          posting was pulled. These don&apos;t need your attention.
        </DeadNote>
      )}
      {confirmOpen && (() => {
        if (confirmMode === 'clearAll') {
          const total = list.length;
          return (
            <ConfirmModal
              show
              variant="danger"
              title={`Clear the entire inbox?`}
              subtitle={`${total} application${total === 1 ? '' : 's'} will be removed`}
              message="Every application currently in your inbox, across Pending, Blocked, In flight and Sent, will be removed. In-flight submissions will be cancelled if they haven’t already POSTed. This can’t be undone."
              confirmText={`Clear all${total > 0 ? ` (${total})` : ''}`}
              cancelText="Keep them"
              loading={busy}
              loadingText="Clearing…"
              onClose={closeConfirm}
              onConfirm={performConfirm}
            />
          );
        }
        const n = selected.size;
        const selectedApps = items.filter((a) => selected.has(a.id));
        const hasInFlight = selectedApps.some((a) => {
          const s = a.dbStatus || a.status;
          return s === 'approved' || s === 'submitting';
        });
        return (
          <ConfirmModal
            show
            variant={hasInFlight ? 'warning' : 'danger'}
            title={n === 1 ? 'Remove this application?' : `Remove ${n} applications?`}
            subtitle={n === 1 && selectedApps[0] ? `${selectedApps[0].role} · ${selectedApps[0].company}` : undefined}
            message={hasInFlight
              ? 'Some are mid-flight. We’ll abort what hasn’t POSTed yet, rows will be removed from your inbox regardless.'
              : 'These will be removed from your inbox. This can’t be undone.'}
            confirmText={n === 1 ? 'Remove' : `Remove ${n}`}
            cancelText="Keep them"
            loading={busy}
            loadingText="Removing…"
            onClose={closeConfirm}
            onConfirm={performConfirm}
          />
        );
      })()}
    </Page>
  );
};

export default ReviewEntry;

/* ───────────── bucket copy ───────────── */

function bucketLabel(s) {
  if (s === 'pending') return 'Pending';
  if (s === 'needs_attention') return 'Blocked';
  if (s === 'approved') return 'Approved';
  if (s === 'submitting') return 'Submitting';
  if (s === 'submitted') return 'Sent';
  return s || 'Unknown';
}

function emptyTitle(tab) {
  if (tab === 'pending') return 'Nothing pending right now';
  if (tab === 'blocked') return 'No blockers';
  if (tab === 'inflight') return 'Nothing in flight';
  if (tab === 'sent') return 'No applications sent yet';
  return 'No applications in this view';
}
function emptySub(tab) {
  if (tab === 'pending') return "You're all caught up. Fresh matches will appear here the moment they're ready.";
  if (tab === 'blocked') return "Everything is running smoothly, no applications are waiting on your input.";
  if (tab === 'inflight') return "Nothing is currently being submitted. Approved applications show up here while they're sending.";
  if (tab === 'sent') return "Once you approve an application and it lands, it'll show up here.";
  return '';
}

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

/* ───────────── styles ───────────── */

const Page = styled.div`
  background: ${BG};
  padding: 24px 32px 80px;
  min-height: calc(100vh - 120px);
  max-width: 1240px;
  margin: 0 auto;

  @media (max-width: 768px) { padding: 18px 16px 60px; }
`;

const Head = styled.header`
  margin-bottom: 18px;
`;

const Title = styled.h1`
  margin: 0 0 6px;
  font-size: clamp(22px, 2.4vw, 28px);
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.02em;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${MUTED};
  max-width: 68ch;
  line-height: 1.5;
`;

const TAB_TONE = {
  brand: { fg: BRAND_700, pillBg: BRAND,      pillFg: '#FFFFFF', line: BRAND },
  warn:  { fg: '#8A3F00', pillBg: '#D97706',  pillFg: '#FFFFFF', line: '#D97706' },
  blue:  { fg: '#1D4ED8', pillBg: '#2563EB',  pillFg: '#FFFFFF', line: '#2563EB' },
  good:  { fg: '#147A41', pillBg: '#22C55E',  pillFg: '#FFFFFF', line: '#22C55E' },
  muted: { fg: INK_SOFT,  pillBg: '#E4DFF5',  pillFg: INK_SOFT,  line: MUTED },
};

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  border-bottom: 1px solid ${LINE};
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const Tab = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  padding: 12px 14px;
  min-height: 44px;
  font-size: 13.5px;
  font-weight: 700;
  color: ${(p) => (p.$active ? TAB_TONE[p.$tone].fg : MUTED)};
  cursor: pointer;
  position: relative;
  white-space: nowrap;
  &:hover { color: ${(p) => TAB_TONE[p.$tone].fg}; }

  ${(p) => p.$active && `
    &::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background: ${TAB_TONE[p.$tone].line};
      border-radius: 2px 2px 0 0;
    }
  `}

  @media (max-width: 768px) {
    min-height: 48px;
    padding: 12px 14px;
    font-size: 14px;
  }
`;

const TabCount = styled.span`
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${(p) => (p.$active ? TAB_TONE[p.$tone].pillBg : '#F4F2FB')};
  color: ${(p) => (p.$active ? TAB_TONE[p.$tone].pillFg : MUTED)};
  min-width: 20px;
  text-align: center;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
`;

const Card = styled.div`
  position: relative;
  background: ${CARD_BG};
  border: 1px solid ${(p) => (p.$selected ? BRAND : LINE)};
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s, background 0.15s;
  box-shadow: ${(p) => (p.$selected ? `0 0 0 2px ${BRAND_50} inset, 0 1px 2px rgba(23,21,42,0.04)` : '0 1px 2px rgba(23, 21, 42, 0.04)')};
  ${(p) => p.$selected && `background: ${BRAND_50};`}
  &:hover {
    border-color: ${(p) => (p.$selected ? BRAND : '#C9BFEF')};
    box-shadow: 0 10px 24px rgba(23, 21, 42, 0.08);
    transform: translateY(-1px);
  }
  ${(p) => p.$selectMode && 'padding-left: 44px;'}
`;

const SelectBox = styled.input`
  position: absolute;
  top: 14px;
  left: 14px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: ${BRAND};
  z-index: 1;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  min-height: 36px;
`;

const ToolbarSpacer = styled.div`
  flex: 1;
`;

const ToolbarCount = styled.span`
  font-size: 13px;
  color: ${MUTED};
`;

const ToolbarBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid ${LINE};
  color: ${INK};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
  input[type='checkbox'] { accent-color: ${BRAND}; cursor: pointer; }
  &:hover:not(:disabled) { background: ${BRAND_50}; border-color: #C9BFEF; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DangerBtn = styled.button`
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  background: #DC2626;
  border: 1px solid #DC2626;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
  &:hover:not(:disabled) { background: #B91C1C; border-color: #B91C1C; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 768px) {
    height: auto;
    min-height: 44px;
    padding: 0 18px;
    font-size: 14px;
    border-radius: 10px;
  }
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

const BADGE_TONE = {
  pending:  { bg: BRAND_50,  fg: BRAND_700, bd: '#D7CFF5' },
  blocked:  { bg: '#FFF0E0', fg: '#8A3F00', bd: '#F4D9A1' },
  inflight: { bg: '#EFF4FF', fg: '#1D4ED8', bd: '#C7D7F7' },
  sent:     { bg: '#E8FAF0', fg: '#147A41', bd: '#BBEBD0' },
  all:      { bg: '#F4F2FB', fg: MUTED,     bd: LINE },
};

const StatusBadge = styled.span`
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  background: ${(p) => BADGE_TONE[p.$bucket]?.bg || BADGE_TONE.all.bg};
  color: ${(p) => BADGE_TONE[p.$bucket]?.fg || BADGE_TONE.all.fg};
  border: 1px solid ${(p) => BADGE_TONE[p.$bucket]?.bd || BADGE_TONE.all.bd};
  margin-left: auto;
`;

const MATCH_TIER = {
  good:    { bg: '#E8FAF0', fg: '#147A41', bd: '#BBEBD0' },
  ok:      { bg: '#EFECFB', fg: '#5948C9', bd: '#D7CFF5' },
  fair:    { bg: '#FFF4E0', fg: '#8A5A00', bd: '#F4D9A1' },
  neutral: { bg: '#F4F2FB', fg: '#6B6787', bd: '#E4DFF5' },
};

const MatchPill = styled.span`
  font-size: 11.5px;
  font-weight: 800;
  padding: 3px 8px;
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

const CardErr = styled.div`
  font-size: 11.5px;
  color: #C42B35;
  background: #FFF4F4;
  border: 1px solid #F4B5B5;
  border-radius: 8px;
  padding: 6px 8px;
  line-height: 1.4;
`;

const CardBottom = styled.div`
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CardTime = styled.span`
  font-size: 12px;
  color: ${MUTED};
`;

const CardCta = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: ${BRAND_700};
`;

/* empty-per-bucket */

const BucketEmpty = styled.div`
  background: ${CARD_BG};
  border: 1px dashed ${LINE};
  border-radius: 14px;
  padding: 48px 24px;
  text-align: center;
`;

const BucketEmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
  margin-bottom: 6px;
`;

const BucketEmptySub = styled.div`
  font-size: 13.5px;
  color: ${MUTED};
  max-width: 52ch;
  margin: 0 auto;
  line-height: 1.5;
`;

const DeadNote = styled.div`
  margin-top: 16px;
  background: #FFF7F2;
  border: 1px solid #F4D9C4;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 12.5px;
  color: #6B3B1A;
  line-height: 1.5;
  b { color: #8A3F00; font-weight: 800; }
`;

/* truly-empty state */

const EmptyWrap = styled.div`
  background: ${CARD_BG};
  border: 1px dashed ${LINE};
  border-radius: 16px;
  padding: 60px 30px;
  text-align: center;
`;

const EmptyEmoji = styled.div`
  font-size: 44px;
  margin-bottom: 12px;
`;

const EmptyTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.02em;
`;

const EmptySub = styled.p`
  margin: 0 auto;
  font-size: 14px;
  color: ${MUTED};
  max-width: 54ch;
  line-height: 1.55;
`;

const EmptyActions = styled.div`
  margin-top: 20px;
  display: inline-flex;
  gap: 10px;
`;

const PrimaryBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: ${BRAND_700}; }
`;

const GhostBtn = styled.button`
  background: #FFFFFF;
  color: ${INK_SOFT};
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #F4F2FB; }
`;
