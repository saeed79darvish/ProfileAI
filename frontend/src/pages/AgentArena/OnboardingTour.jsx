import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styled from 'styled-components';

const STORAGE_KEY = 'applypilot_tour_seen_v1';

const SLIDES = [
  {
    key: 'scout',
    title: 'We scout jobs for you',
    body: 'ApplyPilot watches job boards 24/7 and scores every new posting against the criteria you set, so you never have to hunt.',
    Visual: ScoutAnim,
    color: '#6C5CE7',
  },
  {
    key: 'tailor',
    title: 'Each application gets tailored',
    body: 'For matches that clear your bar, we rewrite your resume bullets and draft a cover letter in your voice. No templates, no copy-paste.',
    Visual: TailorAnim,
    color: '#00B894',
  },
  {
    key: 'review',
    title: 'You stay in control',
    body: 'Open the Review tab to approve, edit, or skip. Nothing gets sent without your call, unless you tell us otherwise.',
    Visual: ReviewAnim,
    color: '#E17055',
  },
  {
    key: 'send',
    title: 'We submit, you track',
    body: 'Approved applications are submitted through the company\u2019s ATS. Everything lives in your Sent tab with status updates.',
    Visual: SendAnim,
    color: '#0984E3',
  },
];

const OnboardingTour = ({ onComplete }) => {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const close = (finished) => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setOpen(false);
    if (finished) onComplete?.();
  };

  if (!open) return null;

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <Backdrop
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence mode="wait">
        <Card
          key={slide.key}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <Skip onClick={() => close(false)}>Skip tour</Skip>

          <VisualWrap style={{ background: `linear-gradient(135deg, ${slide.color}14 0%, ${slide.color}04 100%)` }}>
            <slide.Visual color={slide.color} />
          </VisualWrap>

          <Body>
            <Step>Step {idx + 1} of {SLIDES.length}</Step>
            <h2>{slide.title}</h2>
            <p>{slide.body}</p>

            <Dots>
              {SLIDES.map((s, i) => (
                <Dot key={s.key} $on={i === idx} $done={i < idx} onClick={() => setIdx(i)} />
              ))}
            </Dots>

            <Actions>
              <Secondary onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
                Back
              </Secondary>
              <Primary
                style={{ background: slide.color }}
                onClick={() => (isLast ? close(true) : setIdx(idx + 1))}
              >
                {isLast ? "Let's set it up" : 'Next'}
              </Primary>
            </Actions>
          </Body>
        </Card>
      </AnimatePresence>
    </Backdrop>
  );
};

export default OnboardingTour;

/* ────────────────────────────────────────── Visuals ───────────────────────────────────────── */

function ScoutAnim({ color }) {
  const jobs = [
    { co: 'Stripe', role: 'Senior PM', match: 94 },
    { co: 'Linear', role: 'Staff Eng', match: 88 },
    { co: 'Figma',  role: 'Design Lead', match: 82 },
  ];
  return (
    <VisualBox>
      <Magnifier
        animate={{ x: [0, 20, -10, 0], y: [0, -10, 10, 0], rotate: [0, 10, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span aria-hidden>🔍</span>
      </Magnifier>
      {jobs.map((j, i) => (
        <JobCard
          key={j.co}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.18, duration: 0.5 }}
          style={{ top: 28 + i * 60 }}
        >
          <div className="logo" style={{ background: color }}>{j.co[0]}</div>
          <div className="txt">
            <strong>{j.role}</strong>
            <span>{j.co}</span>
          </div>
          <motion.div
            className="match"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 + i * 0.18, type: 'spring', stiffness: 200 }}
            style={{ color }}
          >
            {j.match}%
          </motion.div>
        </JobCard>
      ))}
    </VisualBox>
  );
}

function TailorAnim({ color }) {
  return (
    <VisualBox>
      <Paper $side="left">
        <span className="label">Generic</span>
        {[70, 90, 50, 80, 60].map((w, i) => (
          <motion.div
            key={i}
            className="line"
            initial={{ width: 0 }}
            animate={{ width: `${w}%` }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          />
        ))}
      </Paper>
      <Arrow
        animate={{ x: [0, 6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ color }}
      >
        →
      </Arrow>
      <Paper $side="right">
        <span className="label" style={{ color }}>Tailored ✦</span>
        {[70, 90, 50, 80, 60].map((w, i) => (
          <motion.div
            key={i}
            className="line"
            initial={{ width: 0, background: '#E5E0F5' }}
            animate={{
              width: `${w}%`,
              background: i % 2 === 0 ? `${color}55` : '#E5E0F5',
            }}
            transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
          />
        ))}
        <motion.div
          className="badge"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          style={{ background: `${color}22`, color }}
        >
          +8 keywords matched
        </motion.div>
      </Paper>
    </VisualBox>
  );
}

function ReviewAnim({ color }) {
  return (
    <VisualBox>
      <ReviewCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="hdr">
          <div className="logo" style={{ background: color }}>S</div>
          <div>
            <strong>Senior Product Manager</strong>
            <span>Stripe · Remote</span>
          </div>
          <div className="match" style={{ color }}>94%</div>
        </div>
        <div className="preview">
          <div className="l" style={{ width: '90%' }} />
          <div className="l" style={{ width: '75%' }} />
          <div className="l" style={{ width: '85%' }} />
        </div>
        <div className="row">
          <motion.button
            className="skip"
            whileHover={{ scale: 1.05 }}
          >
            Skip
          </motion.button>
          <motion.button
            className="approve"
            style={{ background: color }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            ✓ Approve &amp; send
          </motion.button>
        </div>
      </ReviewCard>
    </VisualBox>
  );
}

function SendAnim({ color }) {
  return (
    <VisualBox>
      <Target>
        <span aria-hidden>🏢</span>
        <small>Company ATS</small>
      </Target>
      <Plane
        animate={{ x: [-120, 110], y: [40, -20], rotate: [0, -15] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ color }}
      >
        ✈
      </Plane>
      <Trail
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
      />
      <Status
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        style={{ borderColor: `${color}55`, color }}
      >
        ✓ Submitted
      </Status>
    </VisualBox>
  );
}

/* ────────────────────────────────────────── Styles ───────────────────────────────────────── */

const Backdrop = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(17, 15, 36, 0.55);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Card = styled(motion.div)`
  position: relative;
  width: min(760px, 100%);
  background: #FFFFFF;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(17, 15, 36, 0.35);
  display: grid;
  grid-template-columns: 1.1fr 1fr;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Skip = styled.button`
  position: absolute;
  top: 14px;
  right: 16px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid #E4DFF5;
  color: #5C5878;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  z-index: 2;
  &:hover { background: #FFFFFF; color: #2D2A3E; }
`;

const VisualWrap = styled.div`
  position: relative;
  min-height: 320px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const VisualBox = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
`;

const Body = styled.div`
  padding: 28px 30px 24px;
  display: flex;
  flex-direction: column;
  h2 {
    margin: 8px 0 10px;
    font-size: 20px;
    font-weight: 800;
    color: #17152A;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }
  p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: #5C5878;
  }
`;

const Step = styled.div`
  font-size: 10.5px;
  font-weight: 700;
  color: #8881A8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
`;

const Dots = styled.div`
  display: flex;
  gap: 6px;
  margin: 18px 0 18px;
`;

const Dot = styled.button`
  width: 22px;
  height: 6px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  background: ${(p) => (p.$on ? '#6C5CE7' : p.$done ? '#BDB3F0' : '#E4DFF5')};
  transition: background 0.2s;
`;

const Actions = styled.div`
  margin-top: auto;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const Secondary = styled.button`
  background: transparent;
  border: 1px solid #E4DFF5;
  color: #5C5878;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.35; cursor: default; }
  &:hover:not(:disabled) { background: #F4F2FB; }
`;

const Primary = styled.button`
  color: #FFFFFF;
  border: 0;
  border-radius: 10px;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(108, 92, 231, 0.22);
  transition: transform 0.15s;
  &:hover { transform: translateY(-1px); }
`;

/* ── Scout ── */
const Magnifier = styled(motion.div)`
  position: absolute;
  top: 20px;
  left: 24px;
  font-size: 30px;
  z-index: 1;
`;

const JobCard = styled(motion.div)`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 78%;
  background: #FFFFFF;
  border: 1px solid #E4DFF5;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 14px rgba(17, 15, 36, 0.08);
  display: flex;
  align-items: center;
  gap: 10px;
  .logo {
    width: 30px; height: 30px; border-radius: 8px;
    display: grid; place-items: center;
    color: #FFF; font-weight: 700; font-size: 13px;
  }
  .txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .txt strong { font-size: 12px; font-weight: 700; color: #2D2A3E; }
  .txt span { font-size: 10.5px; color: #8881A8; }
  .match { font-size: 13px; font-weight: 800; }
`;

/* ── Tailor ── */
const Paper = styled.div`
  position: absolute;
  top: 30px;
  bottom: 30px;
  width: 38%;
  left: ${(p) => (p.$side === 'left' ? '6%' : 'auto')};
  right: ${(p) => (p.$side === 'right' ? '6%' : 'auto')};
  background: #FFFFFF;
  border: 1px solid #E4DFF5;
  border-radius: 10px;
  padding: 14px 12px;
  box-shadow: 0 4px 14px rgba(17, 15, 36, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  .label {
    font-size: 10px;
    font-weight: 700;
    color: #8881A8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 4px;
  }
  .line {
    height: 6px;
    border-radius: 4px;
    background: #E5E0F5;
  }
  .badge {
    margin-top: auto;
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 6px;
    align-self: flex-start;
  }
`;

const Arrow = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 28px;
  font-weight: 800;
`;

/* ── Review ── */
const ReviewCard = styled(motion.div)`
  position: absolute;
  top: 30px;
  left: 8%;
  right: 8%;
  bottom: 30px;
  background: #FFFFFF;
  border: 1px solid #E4DFF5;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 6px 18px rgba(17, 15, 36, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  .hdr {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    width: 34px; height: 34px; border-radius: 9px;
    color: #FFF; font-weight: 700; font-size: 14px;
    display: grid; place-items: center;
  }
  .hdr > div:nth-child(2) { display: flex; flex-direction: column; flex: 1; }
  .hdr strong { font-size: 12.5px; color: #2D2A3E; }
  .hdr span { font-size: 10.5px; color: #8881A8; }
  .match { font-size: 14px; font-weight: 800; }
  .preview { display: flex; flex-direction: column; gap: 6px; }
  .l { height: 7px; background: #EDEBF5; border-radius: 4px; }
  .row {
    margin-top: auto;
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }
  .skip, .approve {
    border: 0;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .skip { background: #F4F2FB; color: #5C5878; }
  .approve { color: #FFFFFF; }
`;

/* ── Send ── */
const Target = styled.div`
  position: absolute;
  right: 12%;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 32px;
  small {
    font-size: 10px;
    font-weight: 700;
    color: #8881A8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
`;

const Plane = styled(motion.div)`
  position: absolute;
  left: 18%;
  top: 50%;
  font-size: 34px;
`;

const Trail = styled(motion.div)`
  position: absolute;
  left: 18%;
  right: 18%;
  top: 50%;
  height: 2px;
  border-radius: 2px;
  transform: translateY(14px);
`;

const Status = styled(motion.div)`
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 999px;
  background: #FFFFFF;
  border: 1px solid;
`;
