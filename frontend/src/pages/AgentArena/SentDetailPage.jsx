import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArenaSimplePage,
  ArenaPageHeader,
  ArenaPageHeaderActions,
  Btn,
  StatusChip,
  EmptyState,
  TimelineCard,
  TimelineList,
  TimelineItem,
} from './styled';
import { useApplicationDetail } from '../../hooks/useApplyPilot';

/**
 * SentDetailPage · receipt + timeline for one application that has
 * left the Review queue. Surfaces everything we know about the
 * submission run regardless of whether the ATS confirmed the submit:
 *   - status (queued / submitting / submitted / failed)
 *   - provider, attempts, last attempt, submitted-at timestamps
 *   - tailored resume PDF link
 *   - any submission error
 *   - any screenshots captured by the puppeteer adapter
 *   - the raw receipt object (resolutions, blockers, etc.)
 *
 * Previously this page rendered an empty status pill (StatusChip was
 * called with `status=` instead of `$tone=` / children) and hid the
 * timeline whenever no screenshots existed, leaving the screen
 * essentially blank for everything submitted via the API path.
 */

const STATUS_PRESENTATION = {
  approved:         { label: 'Queued for submit', tone: 'brand' },
  submitting:       { label: 'Submitting…',       tone: 'brand' },
  submitted:        { label: 'Submitted',         tone: 'good'  },
  failed:           { label: 'Submit failed',     tone: 'bad'   },
  needs_attention:  { label: 'Needs attention',   tone: 'warn'  },
  rejected:         { label: 'Rejected',          tone: 'neutral' },
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString() : '');

const SentDetailPage = () => {
  const navigate = useNavigate();
  const { appId } = useParams();
  const { data: app, loading } = useApplicationDetail(appId);

  const submission = app?.submission || null;
  const presentation = useMemo(() => {
    const key = submission?.status || app?.dbStatus || app?.status;
    return STATUS_PRESENTATION[key] || { label: key || 'Unknown', tone: 'neutral' };
  }, [submission, app]);

  // Build a derived timeline from the data we have. Entries are added
  // only when their backing timestamp / fact exists so we never invent
  // events. Order is chronological intent (top → bottom).
  const timeline = useMemo(() => {
    if (!app) return [];
    const items = [];
    if (app.caughtAt) {
      items.push({ label: 'Scouted by pilot', when: app.caughtAt });
    }
    items.push({ label: 'Approved for submit', when: 'after review', tone: 'brand' });
    if (submission?.attempts > 0 || submission?.lastAttemptAt) {
      items.push({
        label: `Submission attempt${submission.attempts > 1 ? `s · ${submission.attempts}` : ''}`,
        when: submission.lastAttemptAt ? fmt(submission.lastAttemptAt) : '—',
        tone: 'brand',
      });
    }
    if (submission?.submittedAt) {
      items.push({
        label: 'ATS confirmed submitted',
        when: fmt(submission.submittedAt),
        tone: 'good',
      });
    } else if (submission?.error) {
      items.push({
        label: 'Submission failed',
        when: submission.lastAttemptAt ? fmt(submission.lastAttemptAt) : '—',
        tone: 'bad',
      });
    } else {
      items.push({
        label: 'Awaiting ATS confirmation',
        when: 'in flight',
        tone: 'warn',
      });
    }
    return items;
  }, [app, submission]);

  const screenshots = Array.isArray(submission?.screenshots) ? submission.screenshots : [];
  const resolutions = Array.isArray(submission?.resolutions) ? submission.resolutions : [];
  const receipt = submission?.receipt || null;

  return (
    <ArenaSimplePage>
      <ArenaPageHeader>
        <div>
          <h1>Submission detail</h1>
          <p>Receipt and timeline for this submitted application.</p>
        </div>
        <ArenaPageHeaderActions>
          <Btn $size="sm" onClick={() => navigate('/applypilot/sent')}>Back to sent</Btn>
          <Btn $size="sm" $variant="primary" onClick={() => navigate(`/applypilot/inbox/${appId}`)}>
            Open in review
          </Btn>
        </ArenaPageHeaderActions>
      </ArenaPageHeader>

      {loading ? (
        <EmptyState>
          <h3>Loading submission details…</h3>
          <p>Fetching receipt and timeline.</p>
        </EmptyState>
      ) : !app ? (
        <EmptyState>
          <h3>Application not found</h3>
          <p>This application may have been removed or is no longer accessible.</p>
        </EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Header card · role + status + key facts */}
          <div style={{ background: '#fff', border: '1px solid #E9E7EF', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{app.role || 'Untitled role'}</div>
            <div style={{ fontSize: 13, color: '#6B6787', marginBottom: 12 }}>
              {app.company || 'Unknown company'}
              {app.location ? ` · ${app.location}` : ''}
              {app.salary ? ` · ${app.salary}` : ''}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <StatusChip $tone={presentation.tone}>{presentation.label}</StatusChip>
              {submission?.provider ? (
                <span style={{ fontSize: 12, color: '#6B6787', padding: '4px 8px', background: '#F0EFF5', borderRadius: 6 }}>
                  via {submission.provider}
                </span>
              ) : null}
              {typeof submission?.attempts === 'number' && submission.attempts > 0 ? (
                <span style={{ fontSize: 12, color: '#6B6787', padding: '4px 8px', background: '#F0EFF5', borderRadius: 6 }}>
                  {submission.attempts} attempt{submission.attempts === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            <FactGrid>
              <Fact label="Submitted" value={submission?.submittedAt ? fmt(submission.submittedAt) : 'Not yet submitted'} />
              <Fact label="Last attempt" value={submission?.lastAttemptAt ? fmt(submission.lastAttemptAt) : '—'} />
              <Fact label="Caught by scout" value={app.caughtAt || '—'} />
              <Fact label="Last update" value={fmt(app.updatedAt)} />
            </FactGrid>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              {submission?.resumePdfUrl ? (
                <a href={submission.resumePdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6C5CE7', fontSize: 13, fontWeight: 600 }}>
                  View tailored resume PDF →
                </a>
              ) : null}
              {app.jobUrl ? (
                <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6C5CE7', fontSize: 13, fontWeight: 600 }}>
                  Original posting →
                </a>
              ) : null}
              {app.applicationUrl && app.applicationUrl !== app.jobUrl ? (
                <a href={app.applicationUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6C5CE7', fontSize: 13, fontWeight: 600 }}>
                  Application page →
                </a>
              ) : null}
            </div>

            {submission?.error ? (
              <div style={{ marginTop: 12, background: '#FFF0F0', border: '1px solid #FFD4D4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#8B2020' }}>
                <b>Submission error:</b> {submission.error}
              </div>
            ) : null}
          </div>

          {/* Derived timeline · always renders something useful */}
          <TimelineCard>
            <h4>Submission timeline</h4>
            <TimelineList>
              {timeline.map((t, i) => (
                <TimelineItem key={`tl-${i}`}>
                  <div className="step">{i + 1}</div>
                  <div className="body">
                    <div className="label">{t.label}</div>
                    <div className="when">{t.when}</div>
                  </div>
                </TimelineItem>
              ))}
            </TimelineList>
          </TimelineCard>

          {/* Screenshots · only when the puppeteer adapter captured any */}
          {screenshots.length > 0 ? (
            <TimelineCard>
              <h4>Submission screenshots</h4>
              <TimelineList>
                {screenshots.map((s, i) => (
                  <TimelineItem key={`shot-${s.url || 'step'}-${i}`}>
                    <div className="step">{i + 1}</div>
                    <div className="body">
                      <div className="label">{s.label || `Step ${i + 1}`}</div>
                      <div className="when">{fmtTime(s.capturedAt)}</div>
                    </div>
                    {s.url ? (
                      <a
                        className="thumb"
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ backgroundImage: `url(${s.url})` }}
                        title={s.label || 'screenshot'}
                      />
                    ) : (
                      <div className="thumb-missing">No screenshot</div>
                    )}
                  </TimelineItem>
                ))}
              </TimelineList>
            </TimelineCard>
          ) : null}

          {/* Auto-resolved consent / attestation checkboxes from the
              mapper. Surfaces what the agent ticked on the user's
              behalf so the receipt is auditable. */}
          {resolutions.length > 0 ? (
            <TimelineCard>
              <h4>Auto-resolved fields ({resolutions.length})</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#2D2A3E', lineHeight: 1.7 }}>
                {resolutions.map((r, i) => (
                  <li key={`res-${i}`}>
                    <b>{r.fieldId || r.field || 'field'}</b>
                    {r.value !== undefined ? <> · <code>{String(r.value)}</code></> : null}
                    {r.source ? <span style={{ color: '#6B6787' }}>, {r.source}</span> : null}
                  </li>
                ))}
              </ul>
            </TimelineCard>
          ) : null}

          {/* Raw receipt, collapsed by default so the page isn't
              dominated by JSON, but available for debugging. */}
          {receipt ? (
            <TimelineCard>
              <h4>Raw receipt</h4>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6B6787' }}>
                  Show JSON
                </summary>
                <pre style={{
                  marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: '#2D2A3E',
                  background: '#F7F6FB', border: '1px solid #E9E7EF', borderRadius: 8,
                  padding: 12, overflow: 'auto', maxHeight: 320,
                }}>
                  {JSON.stringify(receipt, null, 2)}
                </pre>
              </details>
            </TimelineCard>
          ) : null}
        </div>
      )}
    </ArenaSimplePage>
  );
};

const FactGrid = ({ children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginTop: 4,
  }}>
    {children}
  </div>
);

const Fact = ({ label, value }) => (
  <div style={{ background: '#F7F6FB', border: '1px solid #E9E7EF', borderRadius: 8, padding: '8px 10px' }}>
    <div style={{ fontSize: 11, color: '#6B6787', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, color: '#2D2A3E', fontWeight: 600 }}>{value}</div>
  </div>
);

export default SentDetailPage;
