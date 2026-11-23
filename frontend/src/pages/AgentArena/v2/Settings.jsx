/* ApplyPilot v2 · Settings. The same choices as Setup on one page,
   saved as you change them, plus the answers ApplyPilot has learned. */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { applyPilotAPI } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { T, Page, Wrap, Row, Col, Card, H1, H2, Muted, Btn, Input, Loading, SkeletonRows } from './ui';
import { useCriteria, SECTIONS, JobsSection, WhereSection, AnswersSection, PaceSection } from './criteria';

const Nav = styled.nav`
  flex: 1 1 220px; max-width: 260px; display: flex; flex-direction: column; gap: 2px; position: sticky; top: 16px;
  a { padding: 10px 14px; border-radius: 10px; color: #2f2d45; text-decoration: none; font-size: 15px; }
  a:hover { background: ${T.tint2}; }
  @media (max-width: 900px) { max-width: none; position: static; flex-direction: row; flex-wrap: wrap; }
`;

export default function Settings() {
  const c = useCriteria({ autosave: true });
  if (!c.ready) return <Page><Loading /></Page>;
  const saved = { idle: 'Changes save on their own.', saving: 'Saving…', saved: 'All changes saved.', error: 'Couldn’t save. Check your connection.' }[c.saveState];

  return (
    <Page>
      <Wrap>
        <Row $justify="space-between" $align="flex-end">
          <Col $gap={6}>
            <H1>Settings</H1>
            <Muted role="status" style={{ color: c.saveState === 'error' ? T.bad : T.ink2 }}>{saved} New choices apply from the next job check.</Muted>
          </Col>
          <Muted $size={14}>To pause, use Pause on the <Link to="/applypilot/dashboard">Dashboard</Link>.</Muted>
        </Row>
        <Row $align="flex-start" $gap={32}>
          <Nav aria-label="Settings sections">
            {SECTIONS.map((s) => <a key={s.key} href={`#set-${s.key}`}>{s.title}</a>)}
            <a href="#set-learned">Answers you taught it</a>
          </Nav>
          <Col $gap={22} $flex="999 1 640px">
            <Section id="jobs" title="Jobs you want"><JobsSection c={c} /></Section>
            <Section id="where" title="Where and pay"><WhereSection c={c} /></Section>
            <Section id="answers" title="Your answers"><AnswersSection c={c} /></Section>
            <Section id="pace" title="How many, how picky"><PaceSection c={c} /></Section>
            <Learned />
          </Col>
        </Row>
      </Wrap>
    </Page>
  );
}

function Section({ id, title, children }) {
  return (
    <Card id={`set-${id}`} $pad={24} $gap={18} style={{ scrollMarginTop: 16 }}>
      <H2>{title}</H2>
      {children}
    </Card>
  );
}

function Learned() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [text, setText] = useState('');
  const load = () => applyPilotAPI.getMemory().then((r) => setRows(Array.isArray(r?.data) ? r.data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const label = (m) => String(m.key || m.topic || 'Answer').replace(/[_-]+/g, ' ').replace(/^\w/, (x) => x.toUpperCase());

  return (
    <Card id="set-learned" $pad={24} $gap={14} style={{ scrollMarginTop: 16 }}>
      <Col $gap={4}>
        <H2>Answers you taught it</H2>
        <Muted $size={14}>When a form asks something new and you answer it, it's saved here and reused on later applications.</Muted>
      </Col>
      {rows == null && <SkeletonRows n={3} avatar={false} />}
      {rows && !rows.length && <Muted>Nothing yet. Answers you give in Review will show up here.</Muted>}
      {rows && rows.map((m) => (
        <Row key={m.id} $justify="space-between" style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.line}` }}>
          <Col $gap={3} $flex="1 1 320px">
            <Muted $size={14}>{label(m)}</Muted>
            {edit === m.id
              ? <Input aria-label={`Answer for ${label(m)}`} value={text} onChange={(e) => setText(e.target.value)} />
              : <strong style={{ fontSize: 15 }}>{m.value}</strong>}
          </Col>
          <Row $gap={6}>
            {edit === m.id ? (
              <>
                <Btn $size="sm" $kind="primary" onClick={async () => {
                  try { await applyPilotAPI.updateMemory(m.id, text); setEdit(null); load(); toast.success('Saved'); } catch { toast.error('Couldn’t save that.'); }
                }}>Save</Btn>
                <Btn $size="sm" $kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
              </>
            ) : (
              <>
                <Btn $size="sm" onClick={() => { setEdit(m.id); setText(m.value || ''); }}>Edit</Btn>
                <Btn $size="sm" onClick={async () => {
                  try { await applyPilotAPI.deleteMemory(m.id); load(); } catch { toast.error('Couldn’t remove that.'); }
                }}>Forget</Btn>
              </>
            )}
          </Row>
        </Row>
      ))}
    </Card>
  );
}
