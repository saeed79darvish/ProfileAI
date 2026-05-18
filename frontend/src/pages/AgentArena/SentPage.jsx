import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArenaSimplePage,
  ArenaPageHeader,
  ArenaPageHeaderActions,
  Btn,
  SentListCard,
  SentRow,
  MatchBadge,
  StatusChip,
  EmptyState,
} from './styled';
import { useReviewQueue, rejectApplication } from '../../hooks/useApplyPilot';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';
import CompanyAvatar from './CompanyAvatar';

/**
 * SentPage · tail-end of the pipeline.
 *
 * Lists everything the pilot has actually submitted (or is currently
 * submitting). Powered by the shared /queue endpoint with the
 * `approved` filter, which the backend maps to the three DB statuses
 * {approved, submitting, submitted}.
 *
 * Each row surfaces the submission receipt + a link back into the
 * Review detail page, which is where screenshots/timeline live once
 * Phase B lands. No mock data, when the list is empty we show a
 * proper empty state.
 */
const RELATIVE = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const SUB_STATUS = {
  submitting: { label: 'Submitting…', tone: 'brand' },
  submitted:  { label: 'Submitted',   tone: 'good' },
  approved:   { label: 'Queued',      tone: 'brand' },
};

const SentPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { queue, loading, isOffline, refetch } = useReviewQueue();
  const [busyId, setBusyId] = useState(null);
  // Confirmation dialog state. The actual destructive action runs only
  // after the user confirms via the in-app modal, no native popups.
  const [confirmState, setConfirmState] = useState({ open: false, app: null });

  const askRemove = (a) => setConfirmState({ open: true, app: a });
  const closeConfirm = () => {
    if (busyId) return; // don't dismiss while in flight
    setConfirmState({ open: false, app: null });
  };

  const performRemove = async () => {
    const a = confirmState.app;
    if (!a) return;
    const isInFlight = a.dbStatus === 'approved' || a.dbStatus === 'submitting';
    setBusyId(a.id);
    try {
      await rejectApplication(a.id, isInFlight ? 'Cancelled by user' : 'Removed from sent history');
      await refetch();
      toast?.success?.(isInFlight ? 'Submission cancelled.' : 'Removed from sent.');
      setConfirmState({ open: false, app: null });
    } catch (err) {
      toast?.error?.('Could not remove. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const { inFlight, sent } = useMemo(() => {
    const list = Array.isArray(queue) ? queue : [];
    // UI status `approved` covers {approved, submitting, submitted}. We
    // split here so the page can label each group accurately, the bucket
    // header was lying about everything being "sent" while several were
    // still mid-submit.
    const all = list.filter((a) => a.status === 'approved');
    return {
      inFlight: all.filter((a) => a.dbStatus === 'approved' || a.dbStatus === 'submitting'),
      sent:     all.filter((a) => a.dbStatus === 'submitted'),
    };
  }, [queue]);

  const totalCount = inFlight.length + sent.length;

  return (
    <ArenaSimplePage>
      <ArenaPageHeader>
        <div>
          <h1>Sent applications</h1>
          <p>
            Applications the pilot has submitted, plus anything currently
            mid-submit. Click any row to see the receipt, tailored resume and
           , once available, screenshots from the submission run.
          </p>
        </div>
        <ArenaPageHeaderActions>
          <Btn $size="sm" onClick={() => refetch()}>Refresh</Btn>
          <Btn
            $size="sm"
            $variant="primary"
            onClick={() => navigate('/applypilot/dashboard')}
          >
            Go to dashboard
          </Btn>
        </ArenaPageHeaderActions>
      </ArenaPageHeader>

      {isOffline && (
        <div style={{
          background: '#FFF4CF', border: '1px solid #E7C66A', color: '#5C4300',
          padding: '10px 14px', borderRadius: 10, margin: '0 0 16px',
          fontSize: 13,
        }}>
          ApplyPilot backend is not reachable. Start the backend then refresh.
        </div>
      )}

      {totalCount === 0 ? (
        <EmptyState>
          <h3>{loading ? 'Loading…' : 'Nothing sent yet'}</h3>
          <p>
            Once you approve an application from the Review tab the pilot will
            submit it for you. Everything that makes it out the door lives
            here with a timestamp and receipt.
          </p>
        </EmptyState>
      ) : (
        <>
          {inFlight.length > 0 && (
            <>
              <SectionHeading
                title={`In flight · ${inFlight.length}`}
                hint="Queued or being submitted right now. Will move to “Sent” once the ATS confirms."
              />
              <SentListCard style={{ marginBottom: 24 }}>
                {inFlight.map((a) => renderRow(a, navigate, askRemove, busyId))}
              </SentListCard>
            </>
          )}

          {sent.length > 0 && (
            <>
              <SectionHeading
                title={`Sent · ${sent.length}`}
                hint="Confirmed submitted by the ATS."
              />
              <SentListCard>
                {sent.map((a) => renderRow(a, navigate, askRemove, busyId))}
              </SentListCard>
            </>
          )}
        </>
      )}
      {confirmState.open && confirmState.app && (() => {
        const a = confirmState.app;
        const isInFlight = a.dbStatus === 'approved' || a.dbStatus === 'submitting';
        return (
          <ConfirmModal
            show
            variant={isInFlight ? 'warning' : 'danger'}
            title={isInFlight ? 'Cancel this submission?' : 'Remove from sent?'}
            subtitle={`${a.role} \u00b7 ${a.company}`}
            message={isInFlight
              ? 'The agent is mid-flight. We\u2019ll abort the submission if it hasn\u2019t already POSTed to the ATS \u2014 the row will be removed regardless.'
              : 'This removes the application from your sent history. The actual submission to the employer can\u2019t be recalled.'}
            confirmText={isInFlight ? 'Cancel submission' : 'Remove'}
            cancelText={isInFlight ? 'Keep sending' : 'Keep it'}
            loading={busyId === a.id}
            loadingText={isInFlight ? 'Cancelling\u2026' : 'Removing\u2026'}
            onClose={closeConfirm}
            onConfirm={performRemove}
          />
        );
      })()}
    </ArenaSimplePage>
  );
};

/**
 * Local-only group heading, keeps the visual rhythm consistent without
 * pulling in another styled component for one screen.
 */
const SectionHeading = ({ title, hint }) => (
  <div style={{ margin: '4px 0 10px' }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#2D2A3E', letterSpacing: 0.2 }}>
      {title}
    </div>
    {hint && (
      <div style={{ fontSize: 12, color: '#6B6787', marginTop: 2 }}>{hint}</div>
    )}
  </div>
);

const renderRow = (a, navigate, onRemove, busyId) => {
  const subStatus = SUB_STATUS[a.dbStatus] || SUB_STATUS[a.status] || SUB_STATUS.submitted;
  const isInFlight = a.dbStatus === 'approved' || a.dbStatus === 'submitting';
  const removeLabel = isInFlight ? 'Cancel' : 'Remove';
  const isBusy = busyId === a.id;
  return (
    <SentRow
      key={a.id}
      onClick={() => navigate(`/applypilot/sent/${a.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="company">
        <CompanyAvatar
          company={a.company}
          companyKey={a.companyKey}
          letter={a.logoText}
          size={32}
          radius={10}
        />
        <div style={{ minWidth: 0 }}>
          <div className="role">{a.role}</div>
          <div className="sub">
            {a.company}
            {a.location ? ` · ${a.location}` : ''}
            {a.salary ? ` · ${a.salary}` : ''}
          </div>
        </div>
      </div>
      <div className="match">
        {typeof a.match === 'number' ? (
          <MatchBadge $fair={a.match < 80}>{a.match}%</MatchBadge>
        ) : null}
      </div>
      <div>
        <StatusChip $tone={subStatus.tone}>{subStatus.label}</StatusChip>
      </div>
      <div className="actions">
        <span className="when" style={{ fontSize: 12, color: '#6B6787' }}>
          {RELATIVE(a.submittedAt || a.updatedAt || a.caughtAt)}
        </span>
        <Btn $size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/applypilot/sent/${a.id}`); }}>
          View
        </Btn>
        <Btn
          $size="sm"
          $variant="ghost"
          disabled={isBusy}
          onClick={(e) => { e.stopPropagation(); onRemove(a); }}
          title={isInFlight ? 'Cancel this submission' : 'Remove from sent history'}
        >
          {isBusy ? '…' : removeLabel}
        </Btn>
      </div>
    </SentRow>
  );
};

export default SentPage;
