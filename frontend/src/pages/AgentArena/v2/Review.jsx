/* ApplyPilot v2 · Review. One list ("To review", questions pinned on
   top) and one application at a time with four parts: Resume, Cover
   letter, Answers, Job post. One decision bar: Skip / See the filled
   form / Approve and send. */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  useReviewQueue, useApplicationDetail, approveApplication, rejectApplication, reopenApplication,
  previewApplication, regenerateResume, regenerateCoverLetter, regenerateAnswer, patchAnswers,
  markApplied, downloadResumePdf,
} from '../../../hooks/useApplyPilot';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import ResumePreviewModal from '../../../components/ResumePreviewModal';
import { TailoredResumeRender } from '../ReviewPage';
import { T, Page, Row, Col, Card, H1, H2, Muted, Btn, Chip, CompanyMark, Banner, Empty, Loading, SkeletonRows, Input, Textarea, fitOf, ago } from './ui';
import { bucketOf, scoutedTime } from './model';

const Layout = styled.div`
  display: flex; flex-wrap: wrap; align-items: stretch; min-height: calc(100vh - 140px);
`;
const Side = styled.aside`
  flex: 1 1 320px; max-width: 400px; min-width: 0; background: #fff; border-right: 1px solid ${T.line};
  display: flex; flex-direction: column;
  @media (max-width: 900px) { max-width: none; border-right: 0; border-bottom: 1px solid ${T.line}; max-height: 320px; overflow: auto; }
`;
const Item = styled.button.attrs({ type: 'button' })`
  display: flex; gap: 12px; align-items: flex-start; width: 100%; padding: 12px; border-radius: 12px; cursor: pointer;
  font: inherit; color: ${T.ink}; text-align: left;
  border: 2px solid ${(p) => (p.$cur ? T.brand : 'transparent')}; background: ${(p) => (p.$cur ? T.tint : 'transparent')};
  &:hover { background: ${T.tint}; }
`;
const Filter = styled.button.attrs({ type: 'button' })`
  min-height: 38px; padding: 0 14px; border-radius: 50px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700;
  ${(p) => (p.$on ? `border: 0; background: ${T.night}; color: #fff;` : `border: 1px solid ${T.lineStrong}; background: #fff; color: ${T.ink};`)}
`;
const Main = styled.main`
  flex: 999 1 620px; min-width: 0; display: flex; flex-direction: column;
`;
const Tabs = styled.nav`
  display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid ${T.line};
`;
const Tab = styled.button.attrs({ type: 'button' })`
  min-height: 46px; padding: 0 16px; border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 15px;
  ${(p) => (p.$on ? `font-weight: 800; color: ${T.brandInk}; box-shadow: inset 0 -3px 0 ${T.brand};` : `font-weight: 600; color: ${T.ink2};`)}
`;
const Decide = styled.div`
  position: sticky; bottom: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 32px; background: #fff; border-top: 1px solid ${T.line}; box-shadow: 0 -8px 24px rgba(30, 20, 90, 0.06);
  @media (max-width: 720px) { padding: 12px 16px; }
`;
const Bar = styled.span`
  display: block; height: 8px; border-radius: 8px; background: #ecebf3; overflow: hidden;
  span { display: block; height: 8px; background: ${T.brand}; }
`;
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1000; background: rgba(22, 21, 43, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 16px;
`;
const Modal = styled.div`
  background: #fff; border-radius: 18px; padding: 24px; width: min(880px, 100%); max-height: 90vh; overflow: auto;
  display: flex; flex-direction: column; gap: 16px;
`;

const TAB_KEYS = ['Resume', 'Cover letter', 'Answers', 'Job post'];
// Each part is scored in points against its own cap
// (backend/services/jobRelevanceService.js scoreJob), not as a percentage.
const BREAKDOWN = [
  ['titleMatch', 'Job title', 45], ['skillsMatch', 'Skills', 30], ['experienceMatch', 'Level', 15], ['locationMatch', 'Location', 15], ['recencyBonus', 'How new', 5],
];
const partWord = (p) => (p >= 80 ? 'Strong' : p >= 45 ? 'Partial' : 'Weak');

// Prep sometimes drafts "[email not provided in profile]"-style stubs.
const isPlaceholder = (v) => !String(v || '').trim() || /^\s*\[[^\]]*\]\s*$/.test(String(v)) || /not provided in (your )?profile/i.test(String(v));
const stripHtml = (s) => String(s || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
const pct = (v) => { const n = Number(v); if (!Number.isFinite(n)) return null; return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n))); };

export default function Review() {
  const { appId } = useParams();
  const nav = useNavigate();
  const { queue, loading, refetch } = useReviewQueue();
  const [filter, setFilter] = useState('review');

  const lists = useMemo(() => {
    const rows = Array.isArray(queue) ? queue : [];
    const q = rows.filter((r) => bucketOf(r) === 'question');
    const ready = rows.filter((r) => bucketOf(r) === 'ready').sort((a, b) => (b.match || 0) - (a.match || 0));
    const prep = rows.filter((r) => bucketOf(r) === 'preparing');
    return { review: [...q, ...ready, ...prep], skipped: rows.filter((r) => bucketOf(r) === 'skipped'), actionable: q.length + ready.length };
  }, [queue]);

  const shown = filter === 'skipped' ? lists.skipped : lists.review;
  const selectedId = appId || shown[0]?.id;
  useEffect(() => {
    if (!appId && shown[0]?.id) nav(`/applypilot/review/${shown[0].id}`, { replace: true });
  }, [appId, shown, nav]);

  const goNext = (fromId) => {
    const rest = lists.review.filter((r) => r.id !== fromId && bucketOf(r) !== 'preparing');
    refetch();
    nav(rest[0] ? `/applypilot/review/${rest[0].id}` : '/applypilot/dashboard');
  };

  if (loading && !queue?.length) {
    return (
      <Page><Layout><Side><div style={{ padding: 16 }}><SkeletonRows n={6} /></div></Side><Main><Loading variant="detail" /></Main></Layout></Page>
    );
  }

  return (
    <Page>
      <Layout>
        <Side aria-label="Applications">
          <Row $gap={6} style={{ padding: '16px 16px 10px' }}>
            <Filter $on={filter === 'review'} aria-pressed={filter === 'review'} onClick={() => setFilter('review')}>To review {lists.actionable}</Filter>
            <Filter $on={filter === 'skipped'} aria-pressed={filter === 'skipped'} onClick={() => setFilter('skipped')}>Skipped {lists.skipped.length}</Filter>
          </Row>
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {shown.map((r) => {
              const b = bucketOf(r);
              const f = fitOf(r.match);
              return (
                <li key={r.id}>
                  <Item $cur={r.id === selectedId} aria-current={r.id === selectedId ? 'true' : undefined} onClick={() => nav(`/applypilot/review/${r.id}`)}>
                    <CompanyMark name={r.company} size={38} />
                    <Col $gap={3} $flex="1 1 auto">
                      <strong style={{ fontSize: 14, lineHeight: 1.35 }}>{r.role}</strong>
                      <Muted $size={13}>{[r.company, ago(scoutedTime(r), 'Found')].filter(Boolean).join(' · ')}</Muted>
                      <span>
                        {b === 'question' && <Chip $tone="warn">Needs your answer</Chip>}
                        {b === 'preparing' && <Chip>Getting ready</Chip>}
                        {b === 'ready' && f.n != null && <Chip $tone={f.tone}>{f.n}% · {f.word}</Chip>}
                        {b === 'skipped' && <Chip>Skipped</Chip>}
                      </span>
                    </Col>
                  </Item>
                </li>
              );
            })}
          </ul>
          {!shown.length && (
            <Muted style={{ padding: 20 }}>{filter === 'skipped' ? 'Nothing skipped.' : 'Nothing to review right now.'}</Muted>
          )}
        </Side>
        <Main>
          {selectedId
            ? <Detail key={selectedId} id={selectedId} position={lists.review.findIndex((r) => r.id === selectedId) + 1} total={lists.actionable} onDone={goNext} onChanged={refetch} />
            : (
              <div style={{ padding: 32 }}>
                <Empty>
                  <strong style={{ fontSize: 17 }}>You're all caught up</strong>
                  <Muted>New applications show up here as soon as they're ready.</Muted>
                  <Btn as={Link} to="/applypilot/dashboard" style={{ marginTop: 6 }}>Back to Dashboard</Btn>
                </Empty>
              </div>
            )}
        </Main>
      </Layout>
    </Page>
  );
}

function Detail({ id, position, total, onDone, onChanged }) {
  const { data: d, loading, refetch, setData } = useApplicationDetail(id);
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('Resume');
  const [why, setWhy] = useState(false);
  const [letter, setLetter] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [fix, setFix] = useState({});
  const [busy, setBusy] = useState('');
  const [manual, setManual] = useState(false);
  const [preview, setPreview] = useState(null);
  const [resumeOpen, setResumeOpen] = useState(false);

  useEffect(() => {
    if (!d) return;
    setLetter((v) => (v == null ? d.coverLetter || '' : v));
    setAnswers((v) => (v == null ? (Array.isArray(d.formAnswers) ? d.formAnswers : []) : v));
  }, [d]);

  if (loading && !d) return <Loading variant="detail" />;
  if (!d) return <div style={{ padding: 32 }}><Empty><strong>This application couldn't be loaded.</strong></Empty></div>;

  const b = bucketOf(d);
  const f = fitOf(d.match);
  const mb = d.matchBreakdown || {};
  const blockers = Array.isArray(d.submission?.receipt?.blockers) ? d.submission.receipt.blockers : [];
  const siteUrl = d.applicationUrl || d.job?.jobUrl || d.jobUrl;
  const diff = d.diff || {};
  const changes = [
    diff.summary?.new && 'Summary rewritten for this job',
    Array.isArray(diff.experience) && diff.experience.length ? `${diff.experience.length} experience bullet${diff.experience.length === 1 ? '' : 's'} reworded` : null,
    Array.isArray(diff.newSkills) && diff.newSkills.length ? `Skills now lead with ${diff.newSkills.slice(0, 3).map((x) => String(x?.name || x).replace(/^[+\s]+/, '')).join(', ')}` : null,
  ].filter(Boolean);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); if (okMsg) toast.success(okMsg); return r; }
    catch (e) { toast.error(e?.response?.data?.message || 'That didn’t work. Try again in a moment.'); return null; }
    finally { setBusy(''); }
  };

  const approve = async () => {
    const res = await run('send', () => approveApplication(id, { coverLetter: letter, formAnswers: answers }));
    if (!res) return;
    const body = res.data || res;
    onChanged();
    if (body.autoSubmit === false) { setManual(true); return; }
    toast.success(`Applying to ${d.company} for you. Follow it in Sent.`);
    onDone(id);
  };
  const skip = async () => { if (await run('skip', () => rejectApplication(id, 'skipped_in_review'))) { onChanged(); onDone(id); } };
  const bringBack = async () => { if (await run('reopen', () => reopenApplication(id), 'Moved back to Review')) { onChanged(); refetch(); } };
  const iApplied = async () => { if (await run('applied', () => markApplied(id, { note: 'Finished on company site' }), 'Marked as sent')) { onChanged(); onDone(id); } };
  const saveFixes = async () => {
    const extra = blockers.map((bk) => ({ fieldId: bk.field?.name || bk.field?.label, question: bk.field?.label || bk.field?.name, answer: fix[bk.field?.name || bk.field?.label] }))
      .filter((a) => String(a.answer || '').trim());
    if (!extra.length) { toast.error('Answer the question first.'); return; }
    const merged = [...(answers || []).filter((a) => !extra.some((e) => e.question === a.question)), ...extra];
    const ok = await run('fix', () => patchAnswers(id, merged));
    if (!ok) return;
    setAnswers(merged);
    await approve();
  };
  const saveAnswers = async (next) => { setAnswers(next); await run('answers', () => patchAnswers(id, next), 'Answers saved'); };
  const rewriteResume = async () => { const r = await run('resume', () => regenerateResume(id, {}), 'Resume rewritten'); if (r?.data) setData((prev) => ({ ...prev, ...r.data })); };
  const rewriteLetter = async () => { const r = await run('letter', () => regenerateCoverLetter(id, {})); if (r?.data?.coverLetter != null) { setLetter(r.data.coverLetter); toast.success('Cover letter rewritten'); } };
  const download = async () => {
    const r = await run('pdf', () => downloadResumePdf(id));
    if (r?.data) { const url = URL.createObjectURL(r.data); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  };
  const seeForm = async () => {
    const r = await run('preview', () => previewApplication(id));
    if (r) setPreview(r.data?.preview || r.data || {});
  };

  return (
    <>
      <div style={{ padding: '28px 32px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Row $align="flex-start" $gap={16}>
          <CompanyMark name={d.company} size={56} />
          <Col $gap={6} $flex="1 1 360px">
            <H1 $size={26} style={{ lineHeight: 1.25 }}>{d.role}</H1>
            <Muted>{[d.company, d.location, d.salary, ago(scoutedTime(d), 'Found')].filter(Boolean).join(' · ')}</Muted>
          </Col>
          {f.n != null && (
            <button type="button" onClick={() => setWhy(!why)} aria-expanded={why}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', padding: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: f.tone === 'good' ? T.good : f.tone === 'warn' ? T.warn : T.brandInk }}>{f.n}%</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4b3fc4' }}>{f.word} match, {why ? 'hide' : 'see why'}</span>
            </button>
          )}
        </Row>

        {why && (
          <Card>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {BREAKDOWN.map(([k, label, max]) => {
                const raw = Number(mb.breakdown?.[k]);
                if (!Number.isFinite(raw)) return null;
                const v = pct((Math.min(raw, max) / max) * 100);
                return (
                  <Col key={k} $gap={6}>
                    <Row $justify="space-between" style={{ fontSize: 14 }}><strong>{label}</strong><span style={{ color: T.ink2 }}>{partWord(v)}</span></Row>
                    <Bar><span style={{ width: `${v}%` }} /></Bar>
                  </Col>
                );
              })}
            </div>
            {[d.whyPicked, mb.rationale].find((t) => t && !/^\s*relevance\s+\d+/i.test(t)) && (
              <Muted $size={14}>{[d.whyPicked, mb.rationale].find((t) => t && !/^\s*relevance\s+\d+/i.test(t))}</Muted>
            )}
            {Array.isArray(mb.missingSkills) && mb.missingSkills.length > 0 && (
              <Muted $size={14}>Not on your profile: {mb.missingSkills.slice(0, 6).join(', ')}</Muted>
            )}
          </Card>
        )}

        {b === 'preparing' && <Banner>This application is still being prepared. It usually takes a minute or two.</Banner>}
        {b === 'skipped' && (
          <Banner>
            <span style={{ flex: '1 1 300px' }}>You skipped this job.</span>
            <Btn onClick={bringBack} disabled={busy === 'reopen'}>Bring it back</Btn>
          </Banner>
        )}
        {b === 'question' && (
          <Card style={{ background: T.warnSoft, borderColor: T.warnLine }}>
            <strong style={{ fontSize: 16 }}>{blockers.length > 1 ? `${blockers.length} questions` : 'One question'} before this can be sent</strong>
            <Muted $size={14} style={{ color: '#78350f' }}>Your profile doesn't say, and we never guess. Your answer is added to this application.</Muted>
            {(blockers.length ? blockers : [{ field: { label: d.submissionError || 'Answer needed', name: 'note' } }]).map((bk) => {
              const key = bk.field?.name || bk.field?.label;
              return (
                <Col key={key} $gap={6}>
                  <label htmlFor={`fix-${key}`} style={{ fontWeight: 600 }}>{bk.field?.label || key}</label>
                  <Input id={`fix-${key}`} value={fix[key] || ''} onChange={(e) => setFix({ ...fix, [key]: e.target.value })} placeholder="Your answer" />
                </Col>
              );
            })}
            <Row><Btn $kind="primary" onClick={saveFixes} disabled={!!busy}>{busy === 'fix' || busy === 'send' ? 'Sending…' : 'Save and send'}</Btn></Row>
          </Card>
        )}

        <Tabs aria-label="Application parts">
          {TAB_KEYS.map((k) => (
            <Tab key={k} $on={tab === k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              {k === 'Answers' ? `Answers (${(answers || []).length})` : k}
            </Tab>
          ))}
        </Tabs>
      </div>

      <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {tab === 'Resume' && (
          <>
            {changes.length > 0 && (
              <Card style={{ background: T.tint, border: 0 }}>
                <strong>What we changed for {d.company}</strong>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, lineHeight: 1.55 }}>
                  {changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
                <Muted $size={13}>Open the full resume to see every change.</Muted>
              </Card>
            )}
            <Card $pad={0} $gap={0}>
              <Row $justify="space-between" style={{ padding: '12px 18px', borderBottom: `1px solid ${T.line}` }}>
                <strong>Resume for this job</strong>
                <Row $gap={8}>
                  <Btn $size="sm" onClick={() => setResumeOpen(true)}>Open full resume</Btn>
                  <Btn $size="sm" onClick={rewriteResume} disabled={!!busy}>{busy === 'resume' ? 'Rewriting…' : 'Rewrite with AI'}</Btn>
                  <Btn $size="sm" onClick={download} disabled={!!busy}>Download</Btn>
                </Row>
              </Row>
              <div style={{ padding: '8px 12px' }}>
                <TailoredResumeRender rendered={d.renderedResume} rich={diff.rich} diff={diff} company={d.company} />
              </div>
            </Card>
          </>
        )}

        {tab === 'Cover letter' && (
          <Card>
            <Row $justify="space-between">
              <Muted $size={14}>Edit it here. Your changes are sent with the application.</Muted>
              <Row $gap={8}>
                <Btn $size="sm" onClick={rewriteLetter} disabled={!!busy}>{busy === 'letter' ? 'Rewriting…' : 'Rewrite with AI'}</Btn>
                <Btn $size="sm" onClick={() => { navigator.clipboard?.writeText(letter || ''); toast.success('Copied'); }}>Copy</Btn>
              </Row>
            </Row>
            <Textarea aria-label="Cover letter" value={letter || ''} onChange={(e) => setLetter(e.target.value)} style={{ minHeight: 340 }} />
          </Card>
        )}

        {tab === 'Answers' && (
          <AnswersEditor answers={answers || []} onSave={saveAnswers} busy={busy}
            onRewrite={async (a, guidance) => {
              const r = await run('answer', () => regenerateAnswer(id, { question: a.question, fieldId: a.fieldId, guidance }));
              if (r?.data?.formAnswers) setAnswers(r.data.formAnswers);
            }} />
        )}

        {tab === 'Job post' && (
          <Card>
            <Row $justify="space-between">
              <H2 $size={17}>What {d.company} is looking for</H2>
              {siteUrl && <a href={d.job?.jobUrl || siteUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Open the original post</a>}
            </Row>
            {Array.isArray(mb.haveSkills) && mb.haveSkills.length > 0 && <Muted $size={14}>You have: {mb.haveSkills.slice(0, 10).join(', ')}</Muted>}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65 }}>
              {stripHtml(d.job?.requirements || '') || stripHtml(d.job?.description || '') || 'The job description wasn’t captured. Open the original post to read it.'}
            </div>
          </Card>
        )}
      </div>

      {b !== 'skipped' && (
        <Decide>
          <Row $gap={8}>
            <Btn onClick={skip} disabled={!!busy}>Skip this job</Btn>
            <Btn $kind="ghost" onClick={seeForm} disabled={!!busy || b === 'preparing'}>{busy === 'preview' ? 'Filling in the form… (about a minute)' : 'See the filled form'}</Btn>
          </Row>
          <Row $gap={14}>
            {total > 0 && position > 0 && <Muted $size={14}>{position} of {total}</Muted>}
            {manual && (
              <>
                <span style={{ fontWeight: 600, color: T.warn, maxWidth: 360 }}>Automatic sending is off, so finish this one on {d.company}'s site.</span>
                {siteUrl && <Btn as="a" href={siteUrl} target="_blank" rel="noopener noreferrer">Open their site</Btn>}
                <Btn $kind="primary" onClick={iApplied} disabled={busy === 'applied'}>I finished applying</Btn>
              </>
            )}
            {!manual && (b === 'question'
              ? <span style={{ fontWeight: 600, color: T.warn }}>Answer the question above to send</span>
              : <Btn $kind="primary" $size="lg" onClick={approve} disabled={!!busy || b === 'preparing'}>{busy === 'send' ? 'Sending…' : 'Approve and send'}</Btn>)}
          </Row>
        </Decide>
      )}

      {preview && (
        <Overlay role="dialog" aria-modal="true" aria-label="The filled form" onClick={() => setPreview(null)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <Row $justify="space-between"><H2>What {d.company} will see</H2><Btn $size="sm" onClick={() => setPreview(null)}>Close</Btn></Row>
            {preview.unsupported || preview.errorCode === 'unsupported_ats'
              ? <Muted>We can't show a preview for this company's job site yet. You can still approve and send.</Muted>
              : null}
            {Array.isArray(preview.blockers) && preview.blockers.length > 0 && (
              <Banner $tone="warn">
                <span>Questions we'd need you to answer: {preview.blockers.map((x) => x.field?.label || x.label || x.name).filter(Boolean).join('; ')}</span>
              </Banner>
            )}
            {(preview.screenshots || []).filter((x) => x?.url).map((x) => (
              <figure key={x.url} style={{ margin: 0 }}>
                <img src={x.url} alt={x.label || 'Screenshot of the form'} style={{ width: '100%', borderRadius: 12, border: `1px solid ${T.line}` }} />
                <figcaption style={{ fontSize: 13, color: T.ink3, marginTop: 6 }}>{x.label}</figcaption>
              </figure>
            ))}
            {!(preview.screenshots || []).some((x) => x?.url) && !preview.unsupported && <Muted>{preview.error || 'No screenshots came back. Try again in a moment.'}</Muted>}
          </Modal>
        </Overlay>
      )}

      <ResumePreviewModal open={resumeOpen} onClose={() => setResumeOpen(false)} profileData={null}
        tailoredProfileData={diff.rich || d.renderedResume || null} jobTitle={d.role} company={d.company} user={user} initialTab="preview" />
    </>
  );
}

function AnswersEditor({ answers, onSave, onRewrite, busy }) {
  const [edit, setEdit] = useState(null);
  const [text, setText] = useState('');
  if (!answers.length) return <Empty><Muted>No form questions were found for this application yet.</Muted></Empty>;
  return (
    <Card $pad={8} $gap={0}>
      {answers.map((a, i) => (
        <div key={`${a.fieldId || a.question}-${i}`} style={{ padding: '14px 14px', borderBottom: i < answers.length - 1 ? `1px solid #f0eefb` : 0 }}>
          <Col $gap={6}>
            <Muted $size={14}>{a.question}</Muted>
            {edit === i ? (
              <Col $gap={8}>
                <Textarea aria-label={`Answer to ${a.question}`} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 90 }} />
                <Row $gap={8}>
                  <Btn $kind="primary" $size="sm" onClick={async () => { const next = answers.map((x, j) => (j === i ? { ...x, answer: text } : x)); setEdit(null); await onSave(next); }}>Save</Btn>
                  <Btn $size="sm" onClick={() => onRewrite(a, text)} disabled={!!busy}>Rewrite with AI using this as a hint</Btn>
                  <Btn $size="sm" $kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
                </Row>
              </Col>
            ) : (
              <Row $justify="space-between" $align="flex-start">
                <span style={{ fontSize: 15, fontWeight: 600, flex: '1 1 320px', whiteSpace: 'pre-wrap' }}>
                  {isPlaceholder(a.answer)
                    ? <em style={{ color: T.warn, fontWeight: 600 }}>Not answered. Add it here or on your profile.</em>
                    : a.answer}
                </span>
                <Btn $size="sm" onClick={() => { setEdit(i); setText(a.answer || ''); }}>Edit</Btn>
              </Row>
            )}
          </Col>
        </div>
      ))}
    </Card>
  );
}
