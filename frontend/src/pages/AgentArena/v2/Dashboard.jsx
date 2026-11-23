/* ApplyPilot v2 · Dashboard. Answers one question: what should I do now?
   Order: status + main action, then everything that needs the user,
   then the next applications to review. Counts appear once each. */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { applyPilotAPI } from '../../../services/api';
import { useApplyPilotConfig, useReviewQueue, startPilot, pausePilot } from '../../../hooks/useApplyPilot';
import { useToast } from '../../../contexts/ToastContext';
import { T, Page, Wrap, Row, Col, Card, H1, H2, Muted, Btn, Chip, CompanyMark, ListBox, Empty, Loading, fitOf, ago } from './ui';
import { splitQueue, groupSameRole, needsText, scoutedTime } from './model';
import { isSetUp } from './Home';

const Hero = styled.section`
  display: flex; flex-direction: column; gap: 20px; padding: 26px 30px;
  border-radius: 20px; background: ${T.night}; color: #fff;
  @media (max-width: 720px) { padding: 22px 18px; }
`;
const StatusLine = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  padding-bottom: 16px; border-bottom: 1px solid #36335a; font-size: 14px; color: ${T.nightInk};
  strong { color: #fff; }
`;
const Dot = styled.span`
  width: 12px; height: 12px; border-radius: 50%;
  background: ${(p) => (p.$on ? '#16a34a' : '#9a98ad')};
  box-shadow: ${(p) => (p.$on ? '0 0 0 5px rgba(22,163,74,0.25)' : 'none')};
`;
const JobRow = styled(Link)`
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 16px 20px;
  background: #fff; color: ${T.ink}; text-decoration: none;
  &:hover { background: ${T.tint}; }
`;
const NeedRow = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 16px 20px; background: ${T.warnSoft};
`;
const Dl = styled.dl`
  margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 16px; font-size: 14px;
  dt { color: ${T.ink3}; } dd { margin: 0; font-weight: 600; }
`;

const EMPTY_WHY = {
  no_profile: ['We can’t match jobs without your profile', 'Add your experience and skills to your profile, then ApplyPilot can start.', '/profile', 'Complete your profile'],
  daily_limit_hit: ['You’ve reached today’s limit', 'New applications start again tomorrow. You can raise the daily number in Settings.', '/applypilot/settings', 'Change the limit'],
  no_eligible_jobs: ['No new jobs match your choices yet', 'Adding more job titles, places, or lowering the salary usually helps.', '/applypilot/settings', 'Widen your search'],
  all_below_threshold: ['Jobs were found, but none fit well enough', 'You asked for strong matches. Allowing good matches brings in more.', '/applypilot/settings', 'Change which matches'],
  no_apply_url: ['Jobs were found, but none could be applied to online', 'These postings had no application form. We’ll keep looking.', null, null],
};

export default function Dashboard() {
  const { data: cfg, loading: cfgLoading, refetch: refetchCfg } = useApplyPilotConfig();
  const { queue, loading: qLoading, refetch: refetchQueue } = useReviewQueue();
  const toast = useToast();
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    applyPilotAPI.getActivity({ limit: 6 }).then((r) => { if (!off) setActivity(Array.isArray(r?.data) ? r.data : []); }).catch(() => {});
    return () => { off = true; };
  }, [queue]);

  const by = useMemo(() => splitQueue(queue), [queue]);
  if (cfgLoading || (qLoading && !queue?.length)) return <Page><Loading /></Page>;
  if (!isSetUp(cfg)) return <Navigate to="/applypilot/welcome" replace />;

  const running = cfg?.status === 'running';
  const criteria = cfg?.config?.criteria || {};
  const blocked = cfg?.config?.rails?.blockedCompanies || [];
  const last = cfg?.lastScoutRun || null;
  const ready = groupSameRole([...by.ready].sort((a, b) => (b.match || 0) - (a.match || 0)));
  const readyN = by.ready.length;
  const needs = [...by.unknown, ...by.code, ...by.question, ...by.blocked];
  const weekAgo = Date.now() - 7 * 864e5;
  const sentWeek = by.sent.filter((r) => new Date(r.submittedAt || r.updatedAt).getTime() > weekAgo).length;
  const nothingYet = !queue?.length;

  let title = `${readyN} application${readyN === 1 ? ' is' : 's are'} ready for you`;
  let sub = 'Each has a tailored resume, cover letter and answers. Check it, press Approve and send, and we submit it on the company’s site.';
  if (!readyN && nothingYet) { title = 'Finding your first matches'; sub = 'ApplyPilot is checking new job posts. Your first applications are usually ready within a day.'; }
  else if (!readyN && by.preparing.length) { title = 'Getting applications ready'; sub = `${by.preparing.length} application${by.preparing.length === 1 ? ' is' : 's are'} being tailored now. They’ll show up here in a few minutes.`; }
  else if (!readyN) { title = 'You’re all caught up'; sub = sentWeek ? `Nothing is waiting for you. ${sentWeek} sent this week.` : 'Nothing is waiting for you right now.'; }
  if (!running) sub = `ApplyPilot is paused, so no new jobs are coming in. ${readyN ? 'You can still review and send these.' : ''}`;

  const togglePause = async () => {
    setBusy(true);
    try {
      if (running) await pausePilot(); else await startPilot();
      await refetchCfg();
      refetchQueue();
    } catch {
      toast.error('That didn’t work. Try again in a moment.');
    } finally { setBusy(false); }
  };

  const why = !readyN && !by.preparing.length && last?.reason && EMPTY_WHY[last.reason];

  return (
    <Page>
      <Wrap>
        <Hero>
          <StatusLine>
            <Row $gap={10}>
              <Dot $on={running} aria-hidden="true" />
              <span><strong>{running ? 'Looking for jobs' : 'Paused'}</strong>{last?.ranAt ? ` · last checked ${ago(last.ranAt, '').trim()}` : ''}</span>
            </Row>
            <Btn $kind="onDark" $size="sm" onClick={togglePause} disabled={busy}>{running ? 'Pause' : 'Resume'}</Btn>
          </StatusLine>
          <Row $justify="space-between" $gap={20}>
            <Col $gap={8} $flex="1 1 420px">
              <H1 $size={32} style={{ color: '#fff' }}>{title}</H1>
              <Muted $size={16} style={{ color: T.nightInk }}>{sub}</Muted>
            </Col>
            {readyN > 0 && <Btn as={Link} to="/applypilot/review" $kind="light" $size="lg">Start reviewing</Btn>}
          </Row>
        </Hero>

        <Row $align="flex-start" $gap={24}>
          <Col $gap={24} $flex="999 1 560px">
            {needs.length > 0 && (
              <Col $gap={12}>
                <H2>Needs you <Chip $tone="warn" style={{ marginLeft: 6 }}>{needs.length}</Chip></H2>
                <ListBox $line={T.warnLine}>
                  {needs.map((r) => {
                    const n = needsText(r);
                    return (
                      <NeedRow key={r.id}>
                        <CompanyMark name={r.company} size={40} />
                        <Col $gap={3} $flex="1 1 280px">
                          <strong style={{ fontSize: 15 }}>{n.title}</strong>
                          <Muted $size={14} style={{ color: '#78350f' }}>{n.why}</Muted>
                        </Col>
                        <Btn as={Link} to={n.to} $kind="warn">{n.cta}</Btn>
                      </NeedRow>
                    );
                  })}
                </ListBox>
              </Col>
            )}

            <Col $gap={12}>
              <Row $justify="space-between" $align="baseline">
                <H2>Next up to review</H2>
                {readyN > 0 && <Link to="/applypilot/review" style={{ fontWeight: 700 }}>Open Review</Link>}
              </Row>
              {ready.length > 0 ? (
                <ListBox>
                  {ready.slice(0, 6).map((r) => {
                    const f = fitOf(r.match);
                    const when = ago(scoutedTime(r), 'Found');
                    return (
                      <JobRow key={r.id} to={`/applypilot/review/${r.id}`}>
                        <CompanyMark name={r.company} size={42} />
                        <Col $gap={3} $flex="1 1 300px">
                          <strong style={{ fontSize: 16, lineHeight: 1.35 }}>{r.role}</strong>
                          <Muted $size={14}>
                            {[r.company, r.others.length ? `${r.others.length + 1} locations` : r.location, when].filter(Boolean).join(' · ')}
                          </Muted>
                        </Col>
                        {f.n != null && <Chip $tone={f.tone}>{f.n}% · {f.word}</Chip>}
                      </JobRow>
                    );
                  })}
                </ListBox>
              ) : (
                <Empty>
                  <strong style={{ fontSize: 17 }}>{why ? why[0] : (nothingYet ? 'Nothing here yet' : 'Nothing to review')}</strong>
                  <Muted style={{ maxWidth: 480 }}>{why ? why[1] : (nothingYet ? 'Jobs that fit you will show up here as soon as their applications are ready.' : 'We’ll put new applications here as they’re ready.')}</Muted>
                  {why && why[2] && <Btn as={Link} to={why[2]} style={{ marginTop: 6 }}>{why[3]}</Btn>}
                </Empty>
              )}
            </Col>
          </Col>

          <Col $gap={16} $flex="1 1 320px">
            <Card>
              <Row $justify="space-between"><H2 $size={17}>This week</H2><Link to="/applypilot/sent" style={{ fontWeight: 700, fontSize: 14 }}>Open Sent</Link></Row>
              <Row $gap={10} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div style={{ padding: 14, borderRadius: 12, background: '#f0fdf4' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.good }}>{sentWeek}</div>
                  <div style={{ fontSize: 13 }}>Sent and confirmed</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: '#f0f9ff' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.info }}>{by.applying.length}</div>
                  <div style={{ fontSize: 13 }}>Applying right now</div>
                </div>
              </Row>
            </Card>

            <Card>
              <Row $justify="space-between"><H2 $size={17}>What you're looking for</H2><Link to="/applypilot/settings" style={{ fontWeight: 700, fontSize: 14 }}>Edit</Link></Row>
              <Dl>
                <dt>Jobs</dt><dd>{(criteria.roleTitles || []).join(', ') || 'Not set'}</dd>
                <dt>Where</dt><dd>{[(criteria.locations || []).join(', '), (criteria.workstyle || []).join(', ').toLowerCase()].filter(Boolean).join(' · ') || 'Anywhere'}</dd>
                <dt>Pay</dt><dd>{criteria.salaryFloorK ? `$${criteria.salaryFloorK}k a year or more` : 'Any'}</dd>
                <dt>Each day</dt><dd>Up to {criteria.dailyLimit || 15} applications</dd>
                <dt>Skipping</dt><dd>{blocked.length ? blocked.join(', ') : 'No companies'}</dd>
              </Dl>
            </Card>

            {activity.length > 0 && (
              <Card>
                <H2 $size={17}>Recent activity</H2>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activity.slice(0, 5).map((a) => (
                    <li key={a.id} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, marginTop: 6, flex: 'none', borderRadius: '50%', background: T.brand }} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{a.title}{a.sub ? ` · ${a.sub}` : ''}</span>
                        <span style={{ fontSize: 13, color: T.ink3 }}>{a.time}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </Col>
        </Row>
      </Wrap>
    </Page>
  );
}
