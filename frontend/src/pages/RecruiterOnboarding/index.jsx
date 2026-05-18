import React, { useState } from 'react';
import {
  fadeSlideIn,
  fadeSlideOut,
  float,
  pulse,
  PageContainer,
  TopBar,
  Logo,
  MainContent,
  SlideContainer,
  DotsWrapper,
  Dot,
  WelcomeBubble,
  SlideInner,
  TwoColumn,
  LeftCol,
  RightCol,
  FeatureBox,
  FeatureBoxIcon,
  MockupCard,
  MockupHeader,
  MockLine,
  MockTag,
  MockBadge,
  ChoiceGrid,
  ChoiceCard,
  ChoiceCardVisual,
  ChoiceCardBody,
  ChoiceButton,
  ContinueBtn,
  SkipLink
} from './styled';
import { ROUTES, SLIDES, TEXT, TIMINGS } from './constants';

/* ═══════════════════════════════════════════════
   PAGINATION DOTS
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   WELCOME BUBBLE
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   SLIDE LAYOUT
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   FEATURE HIGHLIGHT BOX
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   MOCKUP CARDS
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   FINAL STEP – THREE CHOICE CARDS
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   CONTINUE BUTTON
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   SLIDE DATA
   ═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   MOCKUP VISUAL COMPONENTS
   ═══════════════════════════════════════════════ */

const SmartMatchMockup = () => (
  <MockupCard>
    <MockupHeader>
      <SmartMatchIcon sx={{ fontSize: 20, color: '#7c3aed' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>AI Smart Match</Typography>
      <MockBadge style={{ marginLeft: 'auto' }}>
        <BoltIcon sx={{ fontSize: 12 }} /> Live
      </MockBadge>
    </MockupHeader>
    {[
      { name: 'S', color: '#7c3aed', title: 'Senior React Developer', score: '97%', scoreColor: '#10b981' },
      { name: 'A', color: '#3b82f6', title: 'Full Stack Engineer', score: '92%', scoreColor: '#10b981' },
      { name: 'M', color: '#f59e0b', title: 'Frontend Lead', score: '88%', scoreColor: '#22c55e' }
    ].map((candidate, i) => (
      <Box key={i} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
        borderRadius: '10px', mb: 1,
        background: i === 0 ? 'rgba(167,139,250,0.04)' : 'transparent',
        border: i === 0 ? '1px solid rgba(167,139,250,0.15)' : '1px solid #f0f0f0'
      }}>
        <Avatar sx={{ width: 32, height: 32, background: candidate.color, fontSize: 14, fontWeight: 700 }}>
          {candidate.name}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{candidate.title}</Typography>
          <MockLine $w="60%" $h="6px" $mb="0" />
        </Box>
        <MockTag $bg="rgba(16,185,129,0.08)" $color={candidate.scoreColor}>{candidate.score}</MockTag>
      </Box>
    ))}
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', background: 'rgba(167,139,250,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
      <AIIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
      <Typography sx={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
        23 new matches found today
      </Typography>
    </Box>
  </MockupCard>
);

const JobPostMockup = () => (
  <MockupCard>
    <MockupHeader>
      <WorkIcon sx={{ fontSize: 20, color: '#7c3aed' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>AI Job Builder</Typography>
    </MockupHeader>
    <Box sx={{ mb: 2 }}>
      <MockLine $w="70%" $h="12px" $color="linear-gradient(90deg,#a78bfa,#7c3aed)" $mb="12px" />
      <MockLine $w="100%" $mb="6px" />
      <MockLine $w="95%" $mb="6px" />
      <MockLine $w="80%" $mb="14px" />
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
      <MockTag>React</MockTag>
      <MockTag>TypeScript</MockTag>
      <MockTag>Node.js</MockTag>
      <MockTag $bg="rgba(16,185,129,0.08)" $color="#10b981">+Auto</MockTag>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', background: 'rgba(167,139,250,0.06)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>Remote</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Yes</Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', background: 'rgba(167,139,250,0.06)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>Salary</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>$120k+</Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1.5, borderRadius: '8px', background: 'rgba(16,185,129,0.06)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>AI Score</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>95%</Typography>
      </Box>
    </Box>
  </MockupCard>
);

const PipelineMockup = () => (
  <MockupCard>
    <MockupHeader>
      <CalendarIcon sx={{ fontSize: 20, color: '#7c3aed' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Hiring Pipeline</Typography>
      <MockTag style={{ marginLeft: 'auto' }}>
        <CheckIcon sx={{ fontSize: 12 }} /> On Track
      </MockTag>
    </MockupHeader>
    {/* Pipeline stages */}
    {[
      { stage: 'Applied', count: 48, color: '#94a3b8', width: '100%' },
      { stage: 'Screened', count: 24, color: '#a78bfa', width: '50%' },
      { stage: 'Interviewed', count: 12, color: '#7c3aed', width: '25%' },
      { stage: 'Offer', count: 3, color: '#10b981', width: '8%' }
    ].map((item, i) => (
      <Box key={i} sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{item.stage}</Typography>
          <Typography sx={{ fontSize: 11, color: '#1a1a2e', fontWeight: 700 }}>{item.count}</Typography>
        </Box>
        <Box sx={{ height: 6, borderRadius: 3, background: '#f0f2f5', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: item.width, borderRadius: 3, background: item.color, transition: 'width 0.5s ease' }} />
        </Box>
      </Box>
    ))}
    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
      <Box sx={{ flex: 1, p: 1, borderRadius: '8px', background: 'rgba(167,139,250,0.06)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600 }}>Avg. Time</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>18 days</Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1, borderRadius: '8px', background: 'rgba(16,185,129,0.06)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600 }}>Offer Rate</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>6.3%</Typography>
      </Box>
    </Box>
  </MockupCard>
);

const MOCKUPS = {
  smartMatch: <SmartMatchMockup />,
  jobPost: <JobPostMockup />,
  pipeline: <PipelineMockup />
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

const RecruiterOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const totalSteps = SLIDES.length + 1; // slides + choice page

  const goNext = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => Math.min(s + 1, totalSteps - 1));
      setAnimating(false);
    }, 300);
  };

  const skipToEnd = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStep(totalSteps - 1);
      setAnimating(false);
    }, 300);
  };

  const goToSetupProfile = () => navigate('/recruiter/profile');
  const goToPostJob = () => navigate('/recruiter/jobs');
  const goToBrowse = () => navigate('/browse');

  const isLastActionSlide = step === SLIDES.length - 1;
  const isChoicePage = step === totalSteps - 1;

  const firstName = user?.firstName || 'there';

  return (
    <PageContainer>
      {/* Top bar */}
      <TopBar>
        <Logo onClick={() => navigate('/')}>
          <AIIcon />
          <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.3px', color: '#1a1a2e' }}>
            ProfileAI
          </Typography>
        </Logo>
      </TopBar>

      <MainContent>
        <SlideContainer>
          {/* Dots */}
          <DotsWrapper>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <Dot key={i} $active={i === step} />
            ))}
          </DotsWrapper>

          {/* Feature slides */}
          {!isChoicePage && (
            <SlideInner key={step} $animating={animating}>
              {/* Welcome bubble */}
              <WelcomeBubble>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                    fontSize: 16,
                    fontWeight: 700
                  }}
                >
                  {firstName.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: '#999', lineHeight: 1.2 }}>
                    ProfileAI for Recruiters
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>
                    Welcome, {firstName}!
                  </Typography>
                </Box>
              </WelcomeBubble>

              <TwoColumn>
                <LeftCol>
                  <Typography
                    sx={{
                      fontSize: { xs: '1.65rem', md: '2.1rem' },
                      fontWeight: 700,
                      color: '#1a1a2e',
                      lineHeight: 1.2,
                      letterSpacing: '-0.5px'
                    }}
                  >
                    ProfileAI helps you...
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '1.65rem', md: '2.1rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      letterSpacing: '-0.5px',
                      background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2
                    }}
                  >
                    {SLIDES[step].headline}
                  </Typography>
                  <Typography sx={{ fontSize: 15, color: '#666', lineHeight: 1.6, mb: 1 }}>
                    {SLIDES[step].description}
                  </Typography>

                  <FeatureBox>
                    <FeatureBoxIcon>{SLIDES[step].emoji}</FeatureBoxIcon>
                    <Typography sx={{ fontSize: 13.5, color: '#555', lineHeight: 1.55 }}>
                      {SLIDES[step].featureText}
                    </Typography>
                  </FeatureBox>

                  <ContinueBtn onClick={goNext}>
                    {isLastActionSlide ? 'Get Started' : 'Continue'}
                    <ArrowIcon />
                  </ContinueBtn>
                  <SkipLink onClick={skipToEnd}>
                    Skip intro
                  </SkipLink>
                </LeftCol>

                <RightCol>
                  {MOCKUPS[SLIDES[step].visual]}
                </RightCol>
              </TwoColumn>
            </SlideInner>
          )}

          {/* Final choice page */}
          {isChoicePage && (
            <SlideInner key="choice" $animating={animating}>
              <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 2 } }}>
                <Typography
                  sx={{
                    fontSize: { xs: '1.6rem', md: '2.2rem' },
                    fontWeight: 800,
                    color: '#1a1a2e',
                    letterSpacing: '-0.5px',
                    mb: 1.5
                  }}
                >
                  Where would you like to start?
                </Typography>
                <Typography sx={{ fontSize: { xs: 14, md: 15.5 }, color: '#888', maxWidth: 480, mx: 'auto' }}>
                  Set up your company profile first for the best experience, or jump right into hiring.
                </Typography>
              </Box>

              <ChoiceGrid>
                {/* Choice 1: Set Up Company Profile */}
                <ChoiceCard onClick={goToSetupProfile}>
                  <ChoiceCardVisual $bg="linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)">
                    <Box sx={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ position: 'absolute', bottom: -20, left: -20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <Box sx={{
                      background: 'white', borderRadius: '16px', p: 2.5, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      transform: 'rotate(-2deg)', width: 180, zIndex: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BusinessIcon sx={{ fontSize: 20, color: 'white' }} />
                        </Box>
                        <Box>
                          <Box sx={{ width: 70, height: 8, borderRadius: 4, background: '#1a1a2e', mb: 0.5 }} />
                          <Box sx={{ width: 50, height: 6, borderRadius: 4, background: '#ccc' }} />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {['Tech', 'SaaS', '50-200'].map(t => (
                          <Box key={t} sx={{ px: 0.8, py: 0.3, borderRadius: '6px', background: 'rgba(167,139,250,0.12)', fontSize: 9, fontWeight: 600, color: '#7c3aed' }}>{t}</Box>
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{
                      position: 'absolute', bottom: 16, right: 20,
                      background: 'white', borderRadius: '10px', px: 1.2, py: 0.6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 3
                    }}>
                      <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>Verified</Typography>
                    </Box>
                  </ChoiceCardVisual>
                  <ChoiceCardBody>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, md: 16 }, color: '#1a1a2e', mb: 0.5 }}>
                      Set Up Company Profile
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#777', lineHeight: 1.6, mb: 2 }}>
                      Add your company details, logo, and bio to attract top candidates.
                    </Typography>
                    <ChoiceButton>
                      Set Up Profile <ArrowIcon sx={{ fontSize: 16 }} />
                    </ChoiceButton>
                  </ChoiceCardBody>
                </ChoiceCard>

                {/* Choice 2: Post Your First Job */}
                <ChoiceCard onClick={goToPostJob}>
                  <ChoiceCardVisual $bg="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)">
                    <Box sx={{ position: 'absolute', top: -25, left: -25, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{
                      background: 'white', borderRadius: '14px', p: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      transform: 'rotate(1deg)', width: 180, zIndex: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <WorkIcon sx={{ fontSize: 18, color: '#3b82f6' }} />
                        <Box sx={{ width: 80, height: 8, borderRadius: 4, background: '#1a1a2e' }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                        {['Remote', 'Full-time', '$120k+'].map(t => (
                          <Box key={t} sx={{ px: 0.8, py: 0.3, borderRadius: '5px', background: 'rgba(59,130,246,0.1)', fontSize: 9, fontWeight: 600, color: '#1d4ed8' }}>{t}</Box>
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AIIcon sx={{ fontSize: 12, color: '#3b82f6' }} />
                        <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#3b82f6' }}>AI-Generated Description</Typography>
                      </Box>
                    </Box>
                    <Box sx={{
                      position: 'absolute', top: 16, right: 18,
                      background: 'white', borderRadius: '10px', px: 1.2, py: 0.6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 3
                    }}>
                      <BoltIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>AI Powered</Typography>
                    </Box>
                  </ChoiceCardVisual>
                  <ChoiceCardBody>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, md: 16 }, color: '#1a1a2e', mb: 0.5 }}>
                      Post Your First Job
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#777', lineHeight: 1.6, mb: 2 }}>
                      Let AI help you create an engaging job post in seconds.
                    </Typography>
                    <ChoiceButton style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                      Post a Job <ArrowIcon sx={{ fontSize: 16 }} />
                    </ChoiceButton>
                  </ChoiceCardBody>
                </ChoiceCard>

                {/* Choice 3: Browse Candidates */}
                <ChoiceCard onClick={goToBrowse}>
                  <ChoiceCardVisual $bg="linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)">
                    <Box sx={{ position: 'absolute', bottom: -30, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <Box sx={{ position: 'relative', width: 180 }}>
                      {/* Stacked candidate cards */}
                      <Box sx={{
                        position: 'absolute', top: 0, left: 12,
                        background: 'white', borderRadius: '12px', p: 1.5, width: 165,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)', transform: 'rotate(3deg)', opacity: 0.7, zIndex: 1
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, background: '#f59e0b', fontSize: 11 }}>K</Avatar>
                          <Box sx={{ width: 60, height: 6, borderRadius: 4, background: '#ddd' }} />
                        </Box>
                      </Box>
                      <Box sx={{
                        position: 'relative', top: 24,
                        background: 'white', borderRadius: '12px', p: 1.5, width: 175,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', transform: 'rotate(-1deg)', zIndex: 2
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, background: '#7c3aed', fontSize: 12, fontWeight: 700 }}>S</Avatar>
                          <Box>
                            <Box sx={{ width: 70, height: 7, borderRadius: 4, background: '#1a1a2e', mb: 0.3 }} />
                            <Box sx={{ width: 50, height: 5, borderRadius: 4, background: '#ccc' }} />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {['97%', 'React', 'Sr.'].map(t => (
                            <Box key={t} sx={{ px: 0.6, py: 0.2, borderRadius: '5px', background: t === '97%' ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)', fontSize: 9, fontWeight: 600, color: t === '97%' ? '#059669' : '#7c3aed' }}>{t}</Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{
                      position: 'absolute', bottom: 14, left: 20,
                      background: 'white', borderRadius: '10px', px: 1.2, py: 0.6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 0.5, zIndex: 3
                    }}>
                      <PeopleIcon sx={{ fontSize: 14, color: '#059669' }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>2.8k+ profiles</Typography>
                    </Box>
                  </ChoiceCardVisual>
                  <ChoiceCardBody>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, md: 16 }, color: '#1a1a2e', mb: 0.5 }}>
                      Browse Candidates
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#777', lineHeight: 1.6, mb: 2 }}>
                      Explore AI-matched candidate profiles and start reaching out.
                    </Typography>
                    <ChoiceButton style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      Browse Talent <ArrowIcon sx={{ fontSize: 16 }} />
                    </ChoiceButton>
                  </ChoiceCardBody>
                </ChoiceCard>
              </ChoiceGrid>
            </SlideInner>
          )}
        </SlideContainer>
      </MainContent>
    </PageContainer>
  );
};

export default RecruiterOnboarding;
