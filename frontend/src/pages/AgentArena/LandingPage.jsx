import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useApplyPilotConfig } from '../../hooks/useApplyPilot';
import { useAuth } from '../../contexts/AuthContext';
import SEO from '../../components/SEO';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  // Skip the authenticated config fetch for signed-out / non-candidate
  // visitors so the marketing landing renders without triggering a 401
  // redirect to /login.
  const canFetchConfig = isAuthenticated && user?.role === 'candidate';
  const { data: cfg } = useApplyPilotConfig({ enabled: canFetchConfig });

  // Returning users have at least one saved role title. Send them to
  // their dashboard; fresh users start the wizard. Signed-out visitors
  // are routed to sign up.
  const isSetUp = useMemo(() => {
    if (!canFetchConfig) return false;
    const titles = cfg?.config?.criteria?.roleTitles;
    return Array.isArray(titles) && titles.length > 0;
  }, [cfg, canFetchConfig]);

  const primaryLabel = !isAuthenticated
    ? 'Get started — it\u2019s free'
    : isSetUp
      ? 'Go to Dashboard'
      : 'Set up my pilot';
  const primaryAction = () => {
    if (!isAuthenticated) {
      navigate('/register?role=candidate');
      return;
    }
    navigate(isSetUp ? '/applypilot/dashboard' : '/applypilot/agent?welcome=1');
  };

  const goSetup = primaryAction;
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Compensate for the sticky top nav. Without this, scrollIntoView
    // lands the section's top edge under the nav and reads as "barely
    // moved", exactly what the bug report described.
    const NAV_OFFSET = 80;
    const top = el.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <Page>
      <SEO
        title="ApplyPilot — AI Job Auto-Apply Chrome Extension"
        description="ApplyPilot is the ProfilleAI Chrome extension that auto-applies to 99% of jobs on LinkedIn, Indeed, Greenhouse, Lever and Workday. You just review and approve."
        path="/apply-pilot"
        keywords="job auto apply, ApplyPilot, AI job application bot, auto apply LinkedIn, auto apply Indeed, Greenhouse autofill, Workday autofill, AI cover letter generator"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'ApplyPilot by ProfilleAI',
          applicationCategory: 'BrowserApplication',
          operatingSystem: 'Chrome',
          url: 'https://www.profilleai.com/apply-pilot',
          description:
            'Chrome extension that auto-applies to jobs on your behalf across LinkedIn, Indeed, Greenhouse, Lever, and Workday.',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }}
      />
      {/* ── Hero ────────────────────────────────────────── */}
      <Hero>
        <HeroInner>
          <HeroCopy>
            <Eyebrow>APPLYPILOT · YOUR AGENT</Eyebrow>
            <H1>
              Apply to <em>99%</em> of jobs automatically.
              <br />
              You just review and approve.
            </H1>
            <Lede>
              Tell ApplyPilot what you want. It watches <strong>40+ job boards</strong>,
              tailors your resume and cover letter for each match, and submits the moment
              you approve the preview.
            </Lede>
            <CtaRow>
              <Primary onClick={primaryAction}>
                {primaryLabel}
              </Primary>
              <Ghost onClick={() => scrollTo('how')}>See how it works</Ghost>
              {!isSetUp && (
                <Meta><span aria-hidden>⏱</span> 2 minutes to set up</Meta>
              )}
            </CtaRow>

            <HeroStats>
              <Stat><strong>847</strong><span>apps sent last week</span></Stat>
              <SDiv />
              <Stat><strong>12%</strong><span>avg response rate</span></Stat>
              <SDiv />
              <Stat><strong>6.2 h</strong><span>saved per candidate</span></Stat>
            </HeroStats>
          </HeroCopy>

          <HeroVisual aria-hidden="true">
            <GlowA />
            <GlowB />

            <AppWindow>
              <WinBar>
                <WinDots>
                  <WinDot $c="#FF5F56" />
                  <WinDot $c="#FFBD2E" />
                  <WinDot $c="#27C93F" />
                </WinDots>
                <WinUrl>
                  <WinLock>🔒</WinLock>
                  profileai.app/applypilot
                </WinUrl>
              </WinBar>

              <WinHeader>
                <WinTitle>
                  <LiveDot />
                  ApplyPilot Queue
                </WinTitle>
                <WinCounter><WinCounterNum>847</WinCounterNum> applied this week</WinCounter>
              </WinHeader>

              <RowList>
                <Row>
                  <RowAvatar $g="linear-gradient(135deg, #6C5CE7, #5948C9)">L</RowAvatar>
                  <RowText>
                    <RowTitle>Senior React Engineer</RowTitle>
                    <RowSub>Linear · Remote · $180k–$220k</RowSub>
                  </RowText>
                  <RowMatch>94%</RowMatch>
                  <RowPill $tone="good"><PillDot $tone="good" />Submitted</RowPill>
                </Row>

                <Row>
                  <RowAvatar $g="linear-gradient(135deg, #0EA5E9, #0369A1)">V</RowAvatar>
                  <RowText>
                    <RowTitle>Staff Frontend Engineer</RowTitle>
                    <RowSub>Vercel · Remote · $200k–$260k</RowSub>
                  </RowText>
                  <RowMatch>91%</RowMatch>
                  <RowPill $tone="good"><PillDot $tone="good" />Submitted</RowPill>
                </Row>

                <Row $highlight>
                  <RowAvatar $g="linear-gradient(135deg, #22C55E, #15803D)">S</RowAvatar>
                  <RowText>
                    <RowTitle>Full-Stack TS Engineer</RowTitle>
                    <RowSub>Stripe · Remote · $190k–$240k</RowSub>
                    <RowProgress><RowProgressFill /></RowProgress>
                  </RowText>
                  <RowMatch>96%</RowMatch>
                  <RowPill $tone="cycle">
                    <CyclePillBg />
                    <CyclePillContent>
                      <PillDot $tone="cycle" />
                      <CycleLabel>
                        <CyclePhase $p={1}>Matching</CyclePhase>
                        <CyclePhase $p={2}>Tailoring</CyclePhase>
                        <CyclePhase $p={3}>Submitting</CyclePhase>
                      </CycleLabel>
                    </CyclePillContent>
                  </RowPill>
                </Row>

                <Row>
                  <RowAvatar $g="linear-gradient(135deg, #F59E0B, #B45309)">A</RowAvatar>
                  <RowText>
                    <RowTitle>Senior Software Engineer</RowTitle>
                    <RowSub>Airbnb · Hybrid · $170k–$230k</RowSub>
                  </RowText>
                  <RowMatch>88%</RowMatch>
                  <RowPill $tone="brand"><PillDot $tone="brand" />Queued</RowPill>
                </Row>

                <Row>
                  <RowAvatar $g="linear-gradient(135deg, #EC4899, #BE185D)">N</RowAvatar>
                  <RowText>
                    <RowTitle>Frontend Platform Lead</RowTitle>
                    <RowSub>Notion · Remote · $210k–$270k</RowSub>
                  </RowText>
                  <RowMatch>85%</RowMatch>
                  <RowPill $tone="brand"><PillDot $tone="brand" />Queued</RowPill>
                </Row>
              </RowList>

              <WinFooter>
                <FooterStat><FooterNum>40+</FooterNum>boards scanned</FooterStat>
                <FooterDiv />
                <FooterStat><FooterNum>12%</FooterNum>response rate</FooterStat>
                <FooterDiv />
                <FooterStat><FooterNum>6.2h</FooterNum>saved</FooterStat>
              </WinFooter>
            </AppWindow>

            <FloatBadge>
              <FloatBadgeIcon>✨</FloatBadgeIcon>
              <FloatBadgeText>
                <FloatBadgeTitle>+1 application</FloatBadgeTitle>
                <FloatBadgeSub>tailored & submitted</FloatBadgeSub>
              </FloatBadgeText>
            </FloatBadge>
          </HeroVisual>
        </HeroInner>
      </Hero>

      {/* ── How it works ────────────────────────────────── */}
      <Section id="how">
        <SecEyebrow>HOW IT WORKS</SecEyebrow>
        <SecTitle>Three steps. That&apos;s the whole thing.</SecTitle>
        <SecLede>
          From a blank profile to approved applications in the same afternoon, without
          opening a single job board.
        </SecLede>

        <Steps>
          {/* Step 1, Set it up */}
          <Step>
            <StepHead>
              <Num>1</Num>
              <div>
                <StepTitle>Set it up</StepTitle>
                <StepSub>Tell the pilot what you want. Takes 2 minutes.</StepSub>
              </div>
            </StepHead>
            <Mock>
              <MockLabel>TARGET ROLES</MockLabel>
              <MockChips>
                <MChip $on>✓ Senior SRE</MChip>
                <MChip $on>✓ Staff SRE</MChip>
                <MChip $on>✓ Platform Engineer</MChip>
                <MChip>+ add</MChip>
              </MockChips>
              <MockLabel style={{ marginTop: 14 }}>LOCATION · SALARY FLOOR</MockLabel>
              <MockRow>
                <MChip $on>Remote · NA</MChip>
                <MChip $on>Toronto, CA</MChip>
                <MoneyPill>$180k+</MoneyPill>
              </MockRow>
            </Mock>
          </Step>

          {/* Step 2, Agent scouts */}
          <Step>
            <StepHead>
              <Num>2</Num>
              <div>
                <StepTitle>The agent scouts</StepTitle>
                <StepSub>40+ boards, 24/7, matched to your criteria.</StepSub>
              </div>
            </StepHead>
            <Mock>
              <ScoutHead>
                <ScoutDot />
                <span>LIVE · scanning Greenhouse, Lever, Ashby…</span>
              </ScoutHead>
              <JobCard>
                <JobLogo $c="#5B8DEF">St</JobLogo>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <JobRole>Staff SRE</JobRole>
                  <JobCo>Stripe · Remote</JobCo>
                </div>
                <Match $good>94%</Match>
              </JobCard>
              <JobCard>
                <JobLogo $c="#22C55E">Vr</JobLogo>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <JobRole>Senior Platform Engineer</JobRole>
                  <JobCo>Vercel · Remote</JobCo>
                </div>
                <Match $good>91%</Match>
              </JobCard>
              <JobCard>
                <JobLogo $c="#F59E0B">Li</JobLogo>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <JobRole>Infrastructure Engineer</JobRole>
                  <JobCo>Linear · Toronto</JobCo>
                </div>
                <Match>87%</Match>
              </JobCard>
            </Mock>
          </Step>

          {/* Step 3, Review & approve */}
          <Step>
            <StepHead>
              <Num>3</Num>
              <div>
                <StepTitle>Review &amp; approve</StepTitle>
                <StepSub>Glance at the preview. One click sends it.</StepSub>
              </div>
            </StepHead>
            <Mock>
              <ReviewHead>
                <MChip $on>Tailored resume</MChip>
                <MChip $on>Cover letter</MChip>
              </ReviewHead>
              <ReviewBody>
                Hi Stripe team, I&apos;m reaching out about the Staff SRE role.
                Over the past 5 years I&apos;ve led reliability for
                payments infrastructure at…
              </ReviewBody>
              <ReviewActions>
                <ApproveBtn>Approve &amp; send</ApproveBtn>
                <TweakBtn>Tweak</TweakBtn>
              </ReviewActions>
            </Mock>
          </Step>
        </Steps>
      </Section>

      {/* ── Dashboard preview ───────────────────────────── */}
      <PreviewBand>
        <PreviewInner>
          <div>
            <SecEyebrow style={{ color: '#C7BEF5' }}>YOUR DASHBOARD</SecEyebrow>
            <PreviewTitle>
              Everything in one calm place.
            </PreviewTitle>
            <PreviewLede>
              Pilot status, anything ready for your review, and blockers the agent needs
              help with. No inbox clutter, just what to approve, next.
            </PreviewLede>
            <PrimaryDark onClick={primaryAction}>{primaryLabel}</PrimaryDark>
          </div>

          <DashMock>
            <DashStrip>
              <GreenDot /> <strong>Pilot is running</strong>
              <DashMeta>· 3 ready · 4 submitting · 1 needs input</DashMeta>
            </DashStrip>
            <DashSectionTitle>Ready to review <Badge>3</Badge></DashSectionTitle>
            <DashRow>
              <JobLogo $c="#5B8DEF">St</JobLogo>
              <div style={{ flex: 1, minWidth: 0 }}>
                <JobRole>Staff SRE</JobRole>
                <JobCo>Stripe · Remote</JobCo>
              </div>
              <Match $good>94%</Match>
              <MiniBtn>Review</MiniBtn>
            </DashRow>
            <DashRow>
              <JobLogo $c="#22C55E">Vr</JobLogo>
              <div style={{ flex: 1, minWidth: 0 }}>
                <JobRole>Senior Platform Engineer</JobRole>
                <JobCo>Vercel · Remote</JobCo>
              </div>
              <Match $good>91%</Match>
              <MiniBtn>Review</MiniBtn>
            </DashRow>
            <DashRow>
              <JobLogo $c="#F59E0B">Li</JobLogo>
              <div style={{ flex: 1, minWidth: 0 }}>
                <JobRole>Infra Engineer</JobRole>
                <JobCo>Linear · Toronto</JobCo>
              </div>
              <Match>87%</Match>
              <MiniBtn>Review</MiniBtn>
            </DashRow>
          </DashMock>
        </PreviewInner>
      </PreviewBand>

      {/* ── Trust strip + final CTA ─────────────────────── */}
      <Section>
        <TrustRow>
          <Trust>
            <strong>40+</strong>
            <span>job boards scanned</span>
          </Trust>
          <Trust>
            <strong>12%</strong>
            <span>avg response rate</span>
          </Trust>
          <Trust>
            <strong>6.2h</strong>
            <span>saved per candidate</span>
          </Trust>
          <Trust>
            <strong>99%</strong>
            <span>applied automatically</span>
          </Trust>
        </TrustRow>

        <FinalCta>
          <h3>
            {isSetUp
              ? 'Your pilot is waiting.'
              : 'Ready to stop writing cover letters?'}
          </h3>
          <p>
            {isSetUp
              ? 'Jump back into the Dashboard to review what\'s ready.'
              : 'Set up your pilot in about 2 minutes. Cancel anytime.'}
          </p>
          <Primary onClick={primaryAction}>
            {primaryLabel}
          </Primary>
        </FinalCta>
      </Section>
    </Page>
  );
};

export default LandingPage;

/* ────────────────────────────── styles ────────────────────────────── */

const BRAND = '#6C5CE7';
const BRAND_700 = '#5948C9';
const BRAND_50 = '#EFECFB';
const INK = '#17152A';
const INK_SOFT = '#2D2A3E';
const MUTED = '#6B6787';
const LINE = '#E4DFF5';
const BG = '#F7F6FB';
const GOOD = '#22C55E';

const Page = styled.div`
  background: ${BG};
`;

const Hero = styled.section`
  background:
    radial-gradient(1200px 420px at 80% -120px, ${BRAND_50}, transparent 60%),
    linear-gradient(180deg, #FBFAFF 0%, ${BG} 100%);
  border-bottom: 1px solid ${LINE};
`;

const HeroInner = styled.div`
  max-width: 1320px;
  margin: 0 auto;
  padding: 72px 32px 64px;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr);
  gap: 24px;
  align-items: center;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  @media (max-width: 768px) {
    padding: 44px 18px 48px;
  }
`;

const HeroCopy = styled.div`
  min-width: 0;
`;

const HeroVisual = styled.div`
  position: relative;
  width: 100%;
  min-height: 540px;
  justify-self: end;
  margin-right: -80px;
  pointer-events: none;

  @media (max-width: 1180px) {
    margin-right: -20px;
  }

  @media (max-width: 960px) {
    display: none;
  }
`;

const glowDriftA = `
  @keyframes glowDriftA {
    0%, 100% { transform: translate(-30%, -10%) scale(1); }
    50%      { transform: translate(-25%, -15%) scale(1.1); }
  }
`;

const GlowA = styled.div`
  ${glowDriftA}
  position: absolute;
  top: -80px;
  right: -60px;
  width: 480px;
  height: 480px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(108,92,231,0.42) 0%, rgba(108,92,231,0.0) 65%);
  filter: blur(30px);
  animation: glowDriftA 11s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const glowDriftB = `
  @keyframes glowDriftB {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-12px, 18px) scale(1.05); }
  }
`;

const GlowB = styled.div`
  ${glowDriftB}
  position: absolute;
  bottom: -60px;
  left: -40px;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34,197,94,0.32) 0%, rgba(34,197,94,0.0) 65%);
  filter: blur(36px);
  animation: glowDriftB 13s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const windowFloat = `
  @keyframes windowFloat {
    0%, 100% { transform: translateY(0) rotate(-1.2deg); }
    50%      { transform: translateY(-8px) rotate(-0.8deg); }
  }
`;

const AppWindow = styled.div`
  ${windowFloat}
  position: relative;
  width: 560px;
  max-width: 100%;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 18px;
  box-shadow:
    0 50px 120px -40px rgba(23,21,42,0.45),
    0 12px 30px -10px rgba(108,92,231,0.18),
    0 1px 0 rgba(255,255,255,0.8) inset;
  overflow: hidden;
  animation: windowFloat 8s ease-in-out infinite;
  transform: rotate(-1.2deg);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const WinBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #FBFAFE 0%, #F4F2FB 100%);
  border-bottom: 1px solid ${LINE};
`;

const WinDots = styled.div`
  display: flex;
  gap: 6px;
`;

const WinDot = styled.span`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: ${(p) => p.$c};
`;

const WinUrl = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11.5px;
  color: ${MUTED};
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 8px;
  padding: 4px 10px;
  margin-right: 56px;
`;

const WinLock = styled.span`
  font-size: 9px;
  opacity: 0.7;
`;

const WinHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
`;

const liveDotPulse = `
  @keyframes liveDotPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
    50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
  }
`;

const LiveDot = styled.span`
  ${liveDotPulse}
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22C55E;
  margin-right: 8px;
  animation: liveDotPulse 1.8s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const WinTitle = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
`;

const WinCounter = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
`;

const WinCounterNum = styled.span`
  font-weight: 800;
  color: ${INK};
  margin-right: 4px;
`;

const RowList = styled.div`
  padding: 0 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const rowSlideIn = `
  @keyframes rowSlideIn {
    from { opacity: 0; transform: translateX(8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`;

const Row = styled.div`
  ${rowSlideIn}
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px;
  border-radius: 10px;
  background: ${(p) => (p.$highlight ? BRAND_50 : 'transparent')};
  border: 1px solid ${(p) => (p.$highlight ? '#DAD0FA' : 'transparent')};
  animation: rowSlideIn 0.6s ease-out both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const RowAvatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 800;
  color: #FFFFFF;
  flex-shrink: 0;
  background: ${(p) => p.$g};
`;

const RowText = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${INK};
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RowSub = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
  margin-top: 2px;
`;

const rowProgress = `
  @keyframes rowProgress {
    0%   { width: 4%; }
    65%  { width: 95%; }
    100% { width: 100%; }
  }
`;

const RowProgress = styled.div`
  margin-top: 6px;
  height: 3px;
  background: rgba(108,92,231,0.18);
  border-radius: 999px;
  overflow: hidden;
`;

const RowProgressFill = styled.div`
  ${rowProgress}
  height: 100%;
  background: linear-gradient(90deg, ${BRAND} 0%, #22C55E 100%);
  animation: rowProgress 5.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    width: 100%;
  }
`;

const RowMatch = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: ${BRAND_700};
  background: ${BRAND_50};
  padding: 4px 8px;
  border-radius: 7px;
  flex-shrink: 0;
`;

const RowPill = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
  background: ${(p) =>
    p.$tone === 'good' ? '#E6F6EC' :
    p.$tone === 'brand' ? BRAND_50 :
    'transparent'};
  color: ${(p) =>
    p.$tone === 'good' ? '#147A41' :
    p.$tone === 'brand' ? BRAND_700 :
    INK};
  overflow: hidden;
`;

const cyclePillBg = `
  @keyframes cyclePillBg {
    0%, 30%   { background: ${BRAND_50}; }
    33%, 63%  { background: #FFF4DB; }
    66%, 100% { background: #E6F6EC; }
  }
`;

const CyclePillBg = styled.div`
  ${cyclePillBg}
  position: absolute;
  inset: 0;
  border-radius: 999px;
  animation: cyclePillBg 5.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: #E6F6EC;
  }
`;

const CyclePillContent = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const pillDotCycle = `
  @keyframes pillDotCycle {
    0%, 30%   { background: ${BRAND}; }
    33%, 63%  { background: #F59E0B; }
    66%, 100% { background: #22C55E; }
  }
`;

const PillDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) =>
    p.$tone === 'good' ? '#22C55E' :
    p.$tone === 'brand' ? BRAND :
    BRAND};
  ${(p) =>
    p.$tone === 'cycle' &&
    `animation: pillDotCycle 5.4s ease-in-out infinite;
     ${pillDotCycle}
     @media (prefers-reduced-motion: reduce) { animation: none; background: #22C55E; }`}
`;

const cycleColor = `
  @keyframes cycleColor1 { 0%, 28% { opacity: 1; } 33%, 100% { opacity: 0; } }
  @keyframes cycleColor2 { 0%, 28% { opacity: 0; } 33%, 61% { opacity: 1; } 66%, 100% { opacity: 0; } }
  @keyframes cycleColor3 { 0%, 61% { opacity: 0; } 66%, 100% { opacity: 1; } }
`;

const CycleLabel = styled.span`
  position: relative;
  display: inline-block;
  min-width: 76px;
  height: 14px;
  text-align: left;
`;

const CyclePhase = styled.span`
  ${cycleColor}
  position: absolute;
  top: 0;
  left: 0;
  white-space: nowrap;
  opacity: 0;
  color: ${(p) =>
    p.$p === 1 ? BRAND_700 :
    p.$p === 2 ? '#8A3F00' :
    '#147A41'};
  animation: ${(p) => `cycleColor${p.$p}`} 5.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${(p) => (p.$p === 3 ? 1 : 0)};
  }
`;

const WinFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px 20px 16px;
  border-top: 1px solid ${LINE};
  background: linear-gradient(180deg, #FFFFFF 0%, #FBFAFE 100%);
`;

const FooterStat = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const FooterNum = styled.span`
  font-size: 16px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
`;

const FooterDiv = styled.span`
  width: 1px;
  height: 20px;
  background: ${LINE};
`;

const badgePop = `
  @keyframes badgePop {
    0%       { opacity: 0; transform: translateY(8px) scale(0.85); }
    8%, 80%  { opacity: 1; transform: translateY(0) scale(1); }
    100%     { opacity: 0; transform: translateY(-8px) scale(0.95); }
  }
`;

const FloatBadge = styled.div`
  ${badgePop}
  position: absolute;
  top: 32px;
  left: -26px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 22px 40px -18px rgba(23,21,42,0.35);
  animation: badgePop 5.4s ease-in-out infinite;
  animation-delay: -0.6s;
  z-index: 5;

  @media (max-width: 1180px) {
    left: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
    transform: none;
  }
`;

const FloatBadgeIcon = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 14px;
  background: linear-gradient(135deg, ${BRAND}, ${BRAND_700});
`;

const FloatBadgeText = styled.div`
  display: flex;
  flex-direction: column;
`;

const FloatBadgeTitle = styled.div`
  font-size: 12.5px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
`;

const FloatBadgeSub = styled.div`
  font-size: 10.5px;
  color: ${MUTED};
  margin-top: 1px;
`;

const Eyebrow = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${BRAND};
  text-transform: uppercase;
  letter-spacing: 1.4px;
  margin-bottom: 18px;
`;

const H1 = styled.h1`
  margin: 0 0 22px;
  font-size: clamp(36px, 5.4vw, 60px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: ${INK};
  max-width: 18ch;
  em {
    color: ${BRAND};
    font-style: normal;
  }
`;

const Lede = styled.p`
  margin: 0 0 36px;
  font-size: 17px;
  line-height: 1.55;
  color: ${MUTED};
  max-width: 60ch;
  strong { color: ${INK}; font-weight: 700; }
`;

const CtaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 44px;
`;

const Primary = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 12px;
  padding: 14px 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(108, 92, 231, 0.28);
  transition: background 0.15s, transform 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  &:hover { background: ${BRAND_700}; transform: translateY(-1px); }
`;

const Ghost = styled.button`
  background: #FFFFFF;
  color: ${INK};
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 14px 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #F4F2FB; }
`;

const Meta = styled.span`
  color: ${MUTED};
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const HeroStats = styled.div`
  display: flex;
  align-items: center;
  gap: 28px;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 18px 26px;
  flex-wrap: wrap;
  max-width: 720px;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  strong {
    font-size: 24px;
    font-weight: 800;
    color: ${BRAND};
    letter-spacing: -0.015em;
  }
  span {
    font-size: 12.5px;
    color: ${MUTED};
  }
`;

const SDiv = styled.span`
  width: 1px;
  height: 30px;
  background: ${LINE};
  @media (max-width: 720px) { display: none; }
`;

/* ── Sections ── */

const Section = styled.section`
  max-width: 1180px;
  margin: 0 auto;
  padding: 80px 32px;
  @media (max-width: 768px) { padding: 56px 18px; }
`;

const SecEyebrow = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${BRAND};
  text-transform: uppercase;
  letter-spacing: 1.4px;
  margin-bottom: 12px;
`;

const SecTitle = styled.h2`
  margin: 0 0 14px;
  font-size: clamp(28px, 3.6vw, 40px);
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.02em;
  line-height: 1.15;
  max-width: 22ch;
`;

const SecLede = styled.p`
  margin: 0 0 44px;
  font-size: 16px;
  line-height: 1.6;
  color: ${MUTED};
  max-width: 60ch;
`;

/* ── Steps ── */

const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Step = styled.div`
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 18px;
  padding: 22px 22px 20px;
  box-shadow: 0 1px 2px rgba(23, 21, 42, 0.04);
`;

const StepHead = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
`;

const Num = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${BRAND_50};
  color: ${BRAND};
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 800;
  flex-shrink: 0;
`;

const StepTitle = styled.div`
  font-size: 18px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.015em;
  line-height: 1.2;
`;

const StepSub = styled.div`
  font-size: 13px;
  color: ${MUTED};
  margin-top: 2px;
`;

/* ── Mock cards ── */

const Mock = styled.div`
  background: ${BG};
  border: 1px solid ${LINE};
  border-radius: 12px;
  padding: 16px;
  min-height: 230px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MockLabel = styled.div`
  font-size: 10.5px;
  font-weight: 700;
  color: ${MUTED};
  letter-spacing: 0.8px;
  text-transform: uppercase;
`;

const MockChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const MockRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

const MChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${(p) => (p.$on ? BRAND_50 : '#FFFFFF')};
  color: ${(p) => (p.$on ? BRAND_700 : MUTED)};
  border: 1px solid ${(p) => (p.$on ? '#D7CFF5' : LINE)};
`;

const MoneyPill = styled.span`
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: #E8FAF0;
  color: #147A41;
  border: 1px solid #BBEBD0;
`;

/* Step 2, scout */

const ScoutHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: ${GOOD};
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

const ScoutDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${GOOD};
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
`;

const JobCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 10px;
  padding: 10px 12px;
`;

const JobLogo = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: ${(p) => p.$c || BRAND};
  color: #FFFFFF;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
`;

const JobRole = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${INK};
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const JobCo = styled.div`
  font-size: 11.5px;
  color: ${MUTED};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Match = styled.span`
  font-size: 12px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${(p) => (p.$good ? '#E8FAF0' : '#FFF4E0')};
  color: ${(p) => (p.$good ? '#147A41' : '#8A5A00')};
  flex-shrink: 0;
`;

/* Step 3, review */

const ReviewHead = styled.div`
  display: flex;
  gap: 6px;
`;

const ReviewBody = styled.div`
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.55;
  color: ${INK_SOFT};
  flex: 1;
`;

const ReviewActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ApproveBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  flex: 1;
  &:hover { background: ${BRAND_700}; }
`;

const TweakBtn = styled.button`
  background: #FFFFFF;
  color: ${INK};
  border: 1px solid ${LINE};
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
`;

/* ── Dashboard preview band ── */

const PreviewBand = styled.section`
  background: linear-gradient(180deg, #17152A 0%, #221D44 100%);
  color: #FFFFFF;
`;

const PreviewInner = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  padding: 80px 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    padding: 56px 18px;
    gap: 32px;
  }
`;

const PreviewTitle = styled.h2`
  margin: 0 0 14px;
  font-size: clamp(28px, 3.6vw, 40px);
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.02em;
  line-height: 1.15;
`;

const PreviewLede = styled.p`
  margin: 0 0 28px;
  font-size: 16px;
  line-height: 1.6;
  color: #BEB8D8;
  max-width: 48ch;
`;

const PrimaryDark = styled(Primary)`
  background: #FFFFFF;
  color: ${INK};
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  &:hover { background: #F4F2FB; }
`;

const DashMock = styled.div`
  background: #FFFFFF;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  color: ${INK};
`;

const DashStrip = styled.div`
  background: #F1FAF4;
  border: 1px solid #C7ECD3;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #0F5D2E;
  margin-bottom: 14px;
  strong { font-weight: 700; }
`;

const GreenDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${GOOD};
`;

const DashMeta = styled.span`
  color: #3F7F5B;
  font-size: 12.5px;
`;

const DashSectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: ${INK};
  margin-bottom: 10px;
`;

const Badge = styled.span`
  background: ${BRAND_50};
  color: ${BRAND_700};
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
`;

const DashRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid ${LINE};
  border-radius: 10px;
  margin-bottom: 8px;
  &:last-child { margin-bottom: 0; }
`;

const MiniBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 8px;
  padding: 0 14px;
  min-height: 36px;
  min-width: 64px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover { background: ${BRAND_700}; }
`;

/* ── Trust + final CTA ── */

const TrustRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  background: #FFFFFF;
  border: 1px solid ${LINE};
  border-radius: 16px;
  padding: 26px 28px;
  margin-bottom: 48px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Trust = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  strong {
    font-size: 28px;
    font-weight: 800;
    color: ${BRAND};
    letter-spacing: -0.015em;
  }
  span {
    font-size: 13px;
    color: ${MUTED};
  }
`;

const FinalCta = styled.div`
  background: ${BRAND_50};
  border: 1px solid #D7CFF5;
  border-radius: 18px;
  padding: 40px 32px;
  text-align: center;

  h3 {
    margin: 0 0 8px;
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: 800;
    color: ${INK};
    letter-spacing: -0.015em;
  }
  p {
    margin: 0 0 22px;
    font-size: 15px;
    color: ${MUTED};
  }
`;
