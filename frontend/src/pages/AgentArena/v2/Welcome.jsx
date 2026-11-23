/* ApplyPilot v2 · Welcome. Shown only to signed-in users who haven't
   finished setup (Home decides). No invented stats: the preview on the
   right is labelled as an example. */
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { T, Page, Wrap, Row, Col, Card, H1, H2, Muted, Eyebrow, Btn, Chip, Avatar } from './ui';

const EXAMPLE = [
  { i: 'S', role: 'Senior Frontend Engineer', meta: 'Remote, US · $190k to $230k', state: 'Ready', tone: 'brand' },
  { i: 'D', role: 'Staff Software Engineer, Web', meta: 'San Francisco · $210k to $250k', state: 'Ready', tone: 'brand' },
  { i: 'N', role: 'Frontend Platform Engineer', meta: 'Remote, US · Pay not listed', state: 'Applying', tone: 'info' },
  { i: 'L', role: 'Senior React Engineer', meta: 'Hybrid, New York', state: 'Sent', tone: 'good' },
];

const STEPS = [
  { t: 'Tell it what you want', d: 'Job titles, where you want to work, your lowest salary, and the questions every application asks. Most of it comes from your profile.' },
  { t: 'It finds jobs and gets them ready', d: 'Every day it checks new job posts, picks the ones that fit, and prepares a tailored resume, cover letter and answers for each.' },
  { t: 'You approve, it applies', d: 'Look over each application and press Approve and send. ApplyPilot fills in the employer’s form, submits it, and keeps a screenshot as proof.' },
];

const FAQ = [
  { q: 'Does it send anything without asking me?', a: 'No. Every application waits for you to press Approve and send. You can pause ApplyPilot any time.' },
  { q: 'Will it make up experience I don’t have?', a: 'Never. If a form asks something your profile doesn’t answer, it stops and asks you, then remembers your answer for next time.' },
  { q: 'What if a job site asks for a code or a security check?', a: 'If the site emails you a code, we show it in Needs you so you can enter it. If it asks for a check only a person can do, we tell you and you finish that one on their site.' },
  { q: 'Do I need to give it my job-site passwords?', a: 'No. ApplyPilot applies through each company’s public application form.' },
];

const Hero = styled.section`
  display: flex; flex-wrap: wrap; gap: 48px; align-items: center;
`;
const Preview = styled(Card)`
  flex: 1 1 440px;
  box-shadow: 0 24px 60px rgba(40, 30, 120, 0.1);
  border-radius: 20px;
`;
const Grid = styled.div`
  display: grid; gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
`;
const Num = styled.span`
  width: 40px; height: 40px; border-radius: 12px; background: ${T.tint2}; color: #3a30a0;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 800;
`;
const Faq = styled.details`
  background: #fff; border: 1px solid ${T.line}; border-radius: 14px; padding: 16px 20px;
  summary { font-size: 16px; font-weight: 600; cursor: pointer; }
  p { margin: 10px 0 0; font-size: 15px; line-height: 1.65; color: ${T.ink2}; }
`;
const Closer = styled.section`
  display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between;
  padding: 32px 36px; border-radius: 20px; background: ${T.night}; color: #fff;
`;

export default function Welcome() {
  return (
    <Page>
      <Wrap $max={1200} $gap={72} style={{ paddingTop: 56 }}>
        <Hero>
          <Col $gap={20} $flex="1 1 440px">
            <Eyebrow>ApplyPilot</Eyebrow>
            <H1 $size={48} style={{ lineHeight: 1.06 }}>Apply to more jobs without filling in a single form.</H1>
            <Muted $size={18}>
              ApplyPilot finds jobs that fit you, tailors your resume, cover letter and answers for each one,
              and submits the application after you approve it.
            </Muted>
            <Row $gap={12}>
              <Btn as={Link} to="/applypilot/setup" $kind="primary" $size="lg">Set up ApplyPilot</Btn>
              <Btn as="a" href="#how" $size="lg">How it works</Btn>
            </Row>
            <Muted $size={14}>About 3 minutes. We fill in most of it from your profile.</Muted>
          </Col>
          <Preview aria-label="Example of what ApplyPilot gets ready for you">
            <Row $justify="space-between">
              <strong>Ready for you to review</strong>
              <Muted $size={13}>Example</Muted>
            </Row>
            {EXAMPLE.map((r) => (
              <Row key={r.role} $gap={14} style={{ padding: 14, borderRadius: 14, border: `1px solid ${T.line}` }}>
                <Avatar $size={40} aria-hidden="true">{r.i}</Avatar>
                <Col $gap={2} $flex="1 1 auto">
                  <strong style={{ fontSize: 15 }}>{r.role}</strong>
                  <Muted $size={13}>{r.meta}</Muted>
                </Col>
                <Chip $tone={r.tone}>{r.state}</Chip>
              </Row>
            ))}
          </Preview>
        </Hero>

        <Col $gap={24} id="how">
          <H2 $size={30}>How it works</H2>
          <Grid>
            {STEPS.map((s, i) => (
              <Card key={s.t} $pad={26}>
                <Num>{i + 1}</Num>
                <H2 $size={18}>{s.t}</H2>
                <Muted>{s.d}</Muted>
              </Card>
            ))}
          </Grid>
        </Col>

        <Col $gap={16}>
          <H2 $size={30}>Questions people ask</H2>
          {FAQ.map((f) => (
            <Faq key={f.q}><summary>{f.q}</summary><p>{f.a}</p></Faq>
          ))}
        </Col>

        <Closer>
          <Col $gap={6}>
            <H2 $size={24} style={{ color: '#fff' }}>Ready when you are</H2>
            <Muted style={{ color: T.nightInk }}>Your first matches usually arrive by the next morning.</Muted>
          </Col>
          <Btn as={Link} to="/applypilot/setup" $kind="light" $size="lg">Set up ApplyPilot</Btn>
        </Closer>
      </Wrap>
    </Page>
  );
}
