/* ApplyPilot v2 · Sent. Everything the user approved: what needs them
   (an email code, a blocked send), what's in progress, and proof of
   what went through. */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { applyPilotAPI } from '../../../services/api';
import { useReviewQueue, useApplicationDetail, approveApplication, rejectApplication, markApplied, patchTracking } from '../../../hooks/useApplyPilot';
import { useToast } from '../../../contexts/ToastContext';
import { T, Page, Wrap, Row, Col, Card, H1, H2, Muted, Btn, Chip, CompanyMark, Banner, Empty, Loading, Input, Select, ago, clockTime } from './ui';
import { bucketOf, SENT_BUCKETS } from './model';

const GROUPS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'needs', label: 'Needs you', test: (b) => b === 'code' || b === 'blocked' || b === 'unknown' },
  { key: 'progress', label: 'In progress', test: (b) => b === 'applying' },
  { key: 'sent', label: 'Sent', test: (b) => b === 'sent' },
];
const CHIP = {
  sent: ['good', 'Sent'], applying: ['info', 'Applying'], code: ['warn', 'Needs a code'], blocked: ['bad', 'Blocked'], unknown: ['warn', 'Check your email'],
};
const TRACK = [
  ['applied', 'Applied'], ['interviewing', 'Interviewing'], ['offer', 'Offer'], ['hired', 'Hired'],
  ['rejected_by_company', 'Turned down by company'], ['withdrawn', 'I withdrew'],
];

const Filter = styled.button.attrs({ type: 'button' })`
  min-height: 38px; padding: 0 14px; border-radius: 50px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700;
  ${(p) => (p.$on ? `border: 0; background: ${T.night}; color: #fff;` : `border: 1px solid ${T.lineStrong}; background: #fff; color: ${T.ink};`)}
`;
const Item = styled.button.attrs({ type: 'button' })`
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px; border-radius: 14px; cursor: pointer;
  font: inherit; color: ${T.ink}; text-align: left;
  ${(p) => (p.$cur ? `border: 2px solid ${T.brand}; background: ${T.tint};` : `border: 1px solid ${T.line}; background: #fff;`)}
`;
const Dot = styled.span`
  flex: none; width: 14px; height: 14px; margin-top: 4px; border-radius: 50%; box-sizing: border-box;
  ${(p) => ({
    done: 'background: #16a34a;', now: `background: ${T.brand}; box-shadow: 0 0 0 4px #e3dffc;`,
    todo: 'border: 2px solid #c9c6db;', warn: 'background: #d97706;', bad: 'background: #dc2626;',
  }[p.$s])}
`;

export default function Sent() {
  const { appId } = useParams();
  const nav = useNavigate();
  const { queue, loading, refetch } = useReviewQueue();
  const [group, setGroup] = useState('all');

  const rows = useMemo(() => (Array.isArray(queue) ? queue : [])
    .filter((r) => SENT_BUCKETS.has(bucketOf(r)))
    .sort((a, b) => new Date(b.submittedAt || b.lastSubmitAttemptAt || b.updatedAt) - new Date(a.submittedAt || a.lastSubmitAttemptAt || a.updatedAt)), [queue]);
  const g = GROUPS.find((x) => x.key === group);
  const shown = rows.filter((r) => g.test(bucketOf(r)));
  const selectedId = appId || shown[0]?.id;

  if (loading && !queue?.length) return <Page><Loading /></Page>;

  return (
    <Page>
      <Wrap>
        <Row $justify="space-between" $align="flex-end">
          <Col $gap={6}>
            <H1>Sent applications</H1>
            <Muted>Everything you approved: what's in progress, what needs you, and proof of what went through.</Muted>
          </Col>
          <Row $gap={6}>
            {GROUPS.map((x) => (
              <Filter key={x.key} $on={group === x.key} aria-pressed={group === x.key} onClick={() => setGroup(x.key)}>
                {x.label} <span style={{ opacity: 0.8, fontSize: 12 }}>{rows.filter((r) => x.test(bucketOf(r))).length}</span>
              </Filter>
            ))}
          </Row>
        </Row>

        {!rows.length ? (
          <Empty>
            <strong style={{ fontSize: 17 }}>Nothing sent yet</strong>
            <Muted>Applications you approve in Review show up here, with proof from the company's site.</Muted>
            <Btn as={Link} to="/applypilot/review" style={{ marginTop: 6 }}>Go to Review</Btn>
          </Empty>
        ) : (
          <Row $align="flex-start" $gap={24}>
            <ul style={{ flex: '1 1 340px', minWidth: 0, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((r) => {
                const [tone, word] = CHIP[bucketOf(r)];
                return (
                  <li key={r.id}>
                    <Item $cur={r.id === selectedId} aria-current={r.id === selectedId ? 'true' : undefined} onClick={() => nav(`/applypilot/sent/${r.id}`)}>
                      <CompanyMark name={r.company} size={38} />
                      <Col $gap={3} $flex="1 1 auto">
                        <strong style={{ fontSize: 15, lineHeight: 1.35 }}>{r.role}</strong>
                        <Muted $size={13}>{[r.company, ago(r.submittedAt || r.lastSubmitAttemptAt || r.updatedAt)].filter(Boolean).join(' · ')}</Muted>
                      </Col>
                      <Chip $tone={tone}>{word}</Chip>
                    </Item>
                  </li>
                );
              })}
              {!shown.length && <Muted>Nothing in this group.</Muted>}
            </ul>
            {selectedId && <Receipt key={selectedId} id={selectedId} onChanged={refetch} />}
          </Row>
        )}
      </Wrap>
    </Page>
  );
}

function Receipt({ id, onChanged }) {
  const { data: d, loading, refetch } = useApplicationDetail(id);
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');

  if (loading && !d) return <Card $pad={0} style={{ flex: '999 1 520px' }}><Loading variant="detail" /></Card>;
  if (!d) return null;
  const b = bucketOf(d);
  const sub = d.submission || {};
  const shots = (sub.screenshots || []).filter((x) => x?.url);
  const siteUrl = d.applicationUrl || d.job?.jobUrl || d.jobUrl;
  const manual = sub.receipt?.manuallySubmitted || sub.provider === 'manual';

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); onChanged(); refetch(); }
    catch (e) { toast.error(e?.response?.data?.message || e?.response?.data?.error || 'That didn’t work. Try again in a moment.'); }
    finally { setBusy(''); }
  };

  // Approved but never picked up by the sender (automatic sending off,
  // or the queue is down): say so instead of claiming it's in progress.
  const waiting = b === 'applying' && d.dbStatus === 'approved' && !d.lastSubmitAttemptAt;
  const steps = [
    d.scoutedAt && { s: 'done', label: 'Found a match', time: clockTime(d.scoutedAt) },
    { s: 'done', label: 'You approved it', time: clockTime(d.lastSubmitAttemptAt || d.submittedAt || d.updatedAt) },
    waiting && { s: 'warn', label: 'Waiting to send', time: 'Not started yet' },
    b === 'applying' && !waiting && { s: 'now', label: `Filling in the form on ${d.company}’s site`, time: 'In progress' },
    b === 'applying' && !waiting && { s: 'todo', label: `Waiting for ${d.company} to confirm`, time: '' },
    b === 'code' && { s: 'warn', label: 'The site asked for the code it emailed you', time: clockTime(d.lastSubmitAttemptAt) },
    b === 'blocked' && { s: 'bad', label: 'Stopped before submitting', time: clockTime(d.lastSubmitAttemptAt) },
    b === 'unknown' && { s: 'warn', label: 'We couldn\u2019t confirm the result', time: clockTime(d.lastSubmitAttemptAt) },
    b === 'sent' && { s: 'done', label: manual ? 'You finished it on their site' : `We submitted the form on ${d.company}’s site`, time: clockTime(d.submittedAt) },
    b === 'sent' && !manual && { s: 'done', label: `${d.company} confirmed they got it`, time: clockTime(d.submittedAt) },
  ].filter(Boolean);

  return (
    <Card $pad={26} $gap={20} style={{ flex: '999 1 520px' }}>
      <Row $justify="space-between" $align="flex-start">
        <Col $gap={6} $flex="1 1 300px">
          <H2 $size={22}>{d.role}</H2>
          <Muted>{[d.company, d.location].filter(Boolean).join(' · ')}</Muted>
        </Col>
        {b === 'sent' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: T.ink2 }}>
            Where it stands
            <Select value={d.tracking?.status && d.tracking.status !== 'not_applied' ? d.tracking.status : 'applied'}
              onChange={(e) => run('track', () => patchTracking(id, { status: e.target.value }), 'Updated')}>
              {TRACK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </label>
        )}
      </Row>

      {b === 'code' && (
        <Banner $tone="warn" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span><strong>The job site emailed you a code</strong> to confirm it's really you. Find it in your inbox and enter it here to finish sending.</span>
          <Row $gap={8}>
            <label htmlFor="ap-code" style={{ fontWeight: 600 }}>Code</label>
            <Input id="ap-code" value={code} maxLength={16} onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, ''))} placeholder="From the email" style={{ width: 180, letterSpacing: '0.1em' }} />
            <Btn $kind="primary" disabled={code.length < 4 || !!busy}
              onClick={() => run('code', () => applyPilotAPI.resolveApplication(id, { action: 'retry', verificationCode: code }), 'Finishing the application')}>
              {busy === 'code' ? 'Sending…' : 'Finish sending'}
            </Btn>
          </Row>
        </Banner>
      )}

      {b === 'unknown' && (
        <Banner $tone="warn" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span><strong>Did this reach {d.company}?</strong> Sending stopped before we could see their confirmation. Check your email ({d.company} or Greenhouse, Lever, Ashby usually send a \u201cthanks for applying\u201d within minutes). Sending again when it already went through would apply twice.</span>
          <Row $gap={8}>
            <Btn $kind="primary" disabled={!!busy} onClick={() => run('done', () => markApplied(id, { note: 'Confirmed by the candidate after an unconfirmed send' }), 'Marked as sent')}>Yes, it was sent</Btn>
            <Btn disabled={!!busy} onClick={() => run('retry', () => approveApplication(id), 'Sending again')}>No, send it again</Btn>
          </Row>
        </Banner>
      )}

      {b === 'blocked' && (
        <Banner $tone="bad" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span>{d.submissionError ? `${d.company}'s site stopped the application: ${d.submissionError}` : `${d.company}'s site stopped the application before it was submitted.`} Your resume and answers are saved.</span>
          <Row $gap={8}>
            <Btn $kind="primary" disabled={!!busy} onClick={() => run('retry', () => approveApplication(id), 'Trying again')}>Try again</Btn>
            {siteUrl && <Btn as="a" href={siteUrl} target="_blank" rel="noopener noreferrer">Finish it on their site</Btn>}
            <Btn $kind="ghost" disabled={!!busy} onClick={() => run('done', () => markApplied(id, { note: 'Finished on company site' }), 'Marked as sent')}>I finished it myself</Btn>
          </Row>
        </Banner>
      )}

      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
        {steps.map((st) => (
          <li key={st.label} style={{ display: 'flex', gap: 14, paddingBottom: 16 }}>
            <Dot $s={st.s} aria-hidden="true" />
            <Col $gap={2}><strong style={{ fontSize: 15 }}>{st.label}</strong>{st.time && <Muted $size={13}>{st.time}</Muted>}</Col>
          </li>
        ))}
      </ol>

      {shots.length > 0 && (
        <Col $gap={12}>
          <H2 $size={16}>Proof from {d.company}'s site</H2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {shots.map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: T.ink }}>
                <img src={x.url} alt={x.label || 'Screenshot'} style={{ width: '100%', height: 170, objectFit: 'cover', objectPosition: 'top', borderRadius: 12, border: `1px solid ${T.line}` }} />
                <span style={{ fontSize: 13, color: T.ink3 }}>{x.label}</span>
              </a>
            ))}
          </div>
        </Col>
      )}

      <Row $gap={16} style={{ fontSize: 14 }}>
        {sub.resumePdfUrl && <a href={sub.resumePdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Resume you sent</a>}
        {siteUrl && <a href={d.job?.jobUrl || siteUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Original job post</a>}
      </Row>

      {waiting && (
        <Banner $tone="warn" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <span>Automatic sending hasn't picked this up. You can finish it on {d.company}'s site now; your resume and answers are ready.</span>
          <Row $gap={8}>
            {siteUrl && <Btn as="a" href={siteUrl} target="_blank" rel="noopener noreferrer" $kind="primary">Open their site</Btn>}
            <Btn disabled={!!busy} onClick={() => run('done', () => markApplied(id, { note: 'Finished on company site' }), 'Marked as sent')}>I finished applying</Btn>
          </Row>
        </Banner>
      )}

      {b === 'applying' && d.dbStatus === 'approved' && (
        <Banner>
          <span style={{ flex: '1 1 300px' }}>Changed your mind? You can stop it until the form is submitted.</span>
          <Btn disabled={!!busy} onClick={() => run('stop', () => rejectApplication(id, 'stopped_before_submit'), 'Stopped. It’s in Review under Skipped.')}>Stop sending</Btn>
        </Banner>
      )}
    </Card>
  );
}
