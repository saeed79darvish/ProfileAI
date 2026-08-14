import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Typography } from '@mui/material';
import {
  AutoAwesome as AIIcon,
  ArrowForward as ArrowIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
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
  FloatingCard,
  ChoiceCardBody,
  ChoiceCardMockup,
  ChoiceButton,
  ContinueBtn,
  SkipLink,
  MobileActionBar,
  MobilePrimaryBtn,
  MobileSkip,
  LoginLink
} from './styled';
import { ROUTES, SLIDES, TEXT, TIMINGS } from './constants';
import BrandLogo from '../../components/BrandLogo';
import { useAuth } from '../../contexts/AuthContext';

/* ═══════════════════════════════════════════════
   WELCOME BUBBLE (like Simplify's founder bubble)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   FEATURE SLIDE LAYOUT (left text + right visual)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   FEATURE HIGHLIGHT BOX (like Simplify's description cards)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   MOCKUP CARDS (visual illustrations for each slide)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   FINAL STEP – TWO CHOICE CARDS
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

const ProfileMockup = () => (
  <MockupCard>
    <MockupHeader>
      <Avatar sx={{ width: 36, height: 36, background: 'linear-gradient(135deg,#667eea,#764ba2)', fontSize: 16 }}>S</Avatar>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>Your Profile</Typography>
        <Typography sx={{ fontSize: 11, color: '#999' }}>AI-Enhanced</Typography>
      </Box>
      <MockBadge style={{ marginLeft: 'auto' }}>
        <AIIcon sx={{ fontSize: 12 }} /> AI Ready
      </MockBadge>
    </MockupHeader>
    <MockLine $w="75%" $h="8px" $color="linear-gradient(90deg,#667eea,#764ba2)" $mb="12px" />
    <MockLine $w="100%" $mb="6px" />
    <MockLine $w="90%" $mb="6px" />
    <MockLine $w="60%" $mb="16px" />
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
      <MockTag>Marketing</MockTag>
      <MockTag>Design</MockTag>
      <MockTag>Leadership</MockTag>
      <MockTag $bg="rgba(34,197,94,0.08)" $color="#22c55e">+5 more</MockTag>
    </Box>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <MockLine $w="32%" $h="24px" $color="rgba(102,126,234,0.1)" $mb="0" />
      <MockLine $w="32%" $h="24px" $color="rgba(102,126,234,0.1)" $mb="0" />
      <MockLine $w="32%" $h="24px" $color="rgba(118,75,162,0.1)" $mb="0" />
    </Box>
  </MockupCard>
);

const JobsMockup = () => (
  <MockupCard>
    <MockupHeader>
      <SearchIcon sx={{ fontSize: 20, color: '#667eea' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Personalized Job Matches</Typography>
    </MockupHeader>
    {[
      { company: 'G', color: '#4285f4', title: 'Marketing Manager', match: '95%' },
      { company: 'A', color: '#ff9900', title: 'UX Designer', match: '89%' },
      { company: 'S', color: '#00a67e', title: 'Financial Analyst', match: '84%' }
    ].map((job, i) => (
      <Box key={i} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
        borderRadius: '10px', mb: 1,
        background: i === 0 ? 'rgba(102,126,234,0.04)' : 'transparent',
        border: i === 0 ? '1px solid rgba(102,126,234,0.15)' : '1px solid #f0f0f0'
      }}>
        <Avatar sx={{ width: 32, height: 32, background: job.color, fontSize: 14, fontWeight: 700 }}>
          {job.company}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{job.title}</Typography>
          <MockLine $w="60%" $h="6px" $mb="0" />
        </Box>
        <MockTag $bg="rgba(34,197,94,0.08)" $color="#22c55e">{job.match}</MockTag>
      </Box>
    ))}
  </MockupCard>
);

const TailorMockup = () => (
  <MockupCard>
    <MockupHeader>
      <TuneIcon sx={{ fontSize: 20, color: '#667eea' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Resume Tailor</Typography>
      <MockTag style={{ marginLeft: 'auto' }}>
        <CheckIcon sx={{ fontSize: 12 }} /> Keyword Match
      </MockTag>
    </MockupHeader>
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 10, color: '#999', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Original
        </Typography>
        <MockLine $w="100%" $mb="6px" />
        <MockLine $w="85%" $mb="6px" />
        <MockLine $w="95%" $mb="6px" />
        <MockLine $w="70%" $mb="6px" />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 10, color: '#667eea', fontWeight: 600, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Tailored ✨
        </Typography>
        <MockLine $w="100%" $h="10px" $color="rgba(102,126,234,0.15)" $mb="6px" />
        <MockLine $w="90%" $h="10px" $color="rgba(102,126,234,0.12)" $mb="6px" />
        <MockLine $w="95%" $h="10px" $color="rgba(102,126,234,0.15)" $mb="6px" />
        <MockLine $w="80%" $h="10px" $color="rgba(34,197,94,0.12)" $mb="6px" />
      </Box>
    </Box>
    <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', background: 'rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckIcon sx={{ fontSize: 16, color: '#22c55e' }} />
      <Typography sx={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
        +8 keywords matched · ATS score: 92%
      </Typography>
    </Box>
  </MockupCard>
);

const MOCKUPS = {
  profile: <ProfileMockup />,
  jobs: <JobsMockup />,
  tailor: <TailorMockup />
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

const CandidateOnboarding = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0); // 0,1,2 = feature slides, 3 = choice screen
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

  const goToProfileCreate = () => {
    try { localStorage.setItem('profileai_seen_onboarding', '1'); } catch { /* ignore */ }
    navigate('/profile/create');
  };
  const goToLogin = () => navigate(ROUTES.LOGIN);
  const goToJobs = () => {
    try { localStorage.setItem('profileai_seen_onboarding', '1'); } catch { /* ignore */ }
    navigate('/jobs');
  };

  const isChoicePage = step === totalSteps - 1;

  return (
    <PageContainer>
      {/* Top bar */}
      <TopBar>
        <Logo onClick={() => navigate('/')} aria-label={TEXT.LOGO}>
          <BrandLogo iconSize={30} fontSize="1.3rem" accentColor="#6366f1" />
        </Logo>
        {/* Login stays reachable from every step: this page is guest-allowed
            and reached straight from the extension, so someone who already has
            an account must never be forced through the intro to find it. */}
        {!isAuthenticated && (
          <LoginLink onClick={goToLogin}>{TEXT.LOGIN}</LoginLink>
        )}
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
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    fontSize: 16,
                    fontWeight: 700
                  }}
                >
                  P
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: 11.5, color: '#999', lineHeight: 1.2 }}>
                    ProfilleAI
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>
                    Welcome to ProfilleAI!
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
                    ProfilleAI can help you...
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: '1.65rem', md: '2.1rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      letterSpacing: '-0.5px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
                    Continue
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
                <Typography sx={{ fontSize: { xs: 14, md: 15.5 }, color: '#888', maxWidth: 440, mx: 'auto' }}>
                  Don't worry, you can always do the other one later!
                </Typography>
              </Box>

              <ChoiceGrid>
                {/* Choice 1: Build Profile */}
                <ChoiceCard onClick={goToProfileCreate}>
                  <ChoiceCardVisual $bg="linear-gradient(135deg, #667eea 0%, #5a67d8 50%, #764ba2 100%)">
                    {/* Decorative circles */}
                    <Box sx={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

                    {/* Main floating profile card */}
                    <FloatingCard $w="200px" $z={3} style={{ transform: 'rotate(-2deg)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Avatar sx={{ width: 42, height: 42, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 16, fontWeight: 700 }}>
                          AI
                        </Avatar>
                        <Box>
                          <Box sx={{ width: 80, height: 9, borderRadius: 4, background: '#1a1a2e', mb: 0.5 }} />
                          <Box sx={{ width: 55, height: 7, borderRadius: 4, background: '#ccc' }} />
                        </Box>
                      </Box>
                      {/* Skill badges */}
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {['Strategy', 'Analytics', 'AI/ML'].map(s => (
                          <Box key={s} sx={{ px: 1, py: 0.3, borderRadius: '6px', background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12))', fontSize: 10, fontWeight: 600, color: '#667eea' }}>
                            {s}
                          </Box>
                        ))}
                      </Box>
                      {/* Progress bar */}
                      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, height: 5, borderRadius: 4, background: '#eee', overflow: 'hidden' }}>
                          <Box sx={{ width: '85%', height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #667eea, #764ba2)' }} />
                        </Box>
                        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#667eea' }}>85%</Typography>
                      </Box>
                    </FloatingCard>

                    {/* Small floating AI badge */}
                    <Box sx={{
                      position: 'absolute', bottom: 24, right: 28,
                      background: 'white', borderRadius: '10px', px: 1.2, py: 0.6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      zIndex: 4
                    }}>
                      <AIIcon sx={{ fontSize: 14, color: '#667eea' }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#667eea' }}>AI Enhanced</Typography>
                    </Box>
                  </ChoiceCardVisual>

                  <ChoiceCardBody>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, md: 18 }, color: '#1a1a2e', mb: 0.5 }}>
                      Build Your AI Profile
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, color: '#777', lineHeight: 1.6, mb: 2.5 }}>
                      Upload your resume or start from scratch, ProfilleAI helps you create a standout profile to use with the Extension and apply for jobs.
                    </Typography>
                    <ChoiceButton>
                      Build Your Profile
                      <ArrowIcon sx={{ fontSize: 18, ml: 0.5 }} />
                    </ChoiceButton>
                  </ChoiceCardBody>
                </ChoiceCard>

                {/* Choice 2: Browse Jobs */}
                <ChoiceCard onClick={goToJobs}>
                  <ChoiceCardVisual $bg="linear-gradient(135deg, #00b4d8 0%, #0077b6 50%, #023e8a 100%)">
                    {/* Decorative circles */}
                    <Box sx={{ position: 'absolute', top: -25, left: -25, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ position: 'absolute', bottom: -30, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

                    {/* Stacked job listing cards */}
                    <Box sx={{ position: 'relative', width: 210, height: 140 }}>
                      {/* Back card */}
                      <FloatingCard $abs $top="0px" $left="16px" $w="190px" $z={1} style={{ transform: 'rotate(3deg)', opacity: 0.7 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '8px', background: '#ff9900', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'white' }}>A</Typography>
                          </Box>
                          <Box>
                            <Box sx={{ width: 70, height: 7, borderRadius: 4, background: '#ddd', mb: 0.4 }} />
                            <Box sx={{ width: 45, height: 5, borderRadius: 4, background: '#eee' }} />
                          </Box>
                        </Box>
                      </FloatingCard>

                      {/* Front card */}
                      <FloatingCard $abs $top="30px" $left="0px" $w="200px" $z={2} style={{ transform: 'rotate(-1deg)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '8px', background: '#4285f4', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'white' }}>G</Typography>
                          </Box>
                          <Box>
                            <Box sx={{ width: 85, height: 8, borderRadius: 4, background: '#1a1a2e', mb: 0.4 }} />
                            <Box sx={{ width: 55, height: 6, borderRadius: 4, background: '#ccc' }} />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {['Remote', 'Full-time', '$120k+'].map(t => (
                            <Box key={t} sx={{ px: 0.8, py: 0.2, borderRadius: '5px', background: 'rgba(0,180,216,0.1)', fontSize: 9, fontWeight: 600, color: '#0077b6' }}>
                              {t}
                            </Box>
                          ))}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ width: 60, height: 6, borderRadius: 4, background: '#eee' }} />
                          <Box sx={{ px: 1, py: 0.3, borderRadius: '6px', background: '#00b4d8', fontSize: 8.5, fontWeight: 700, color: 'white' }}>
                            Apply
                          </Box>
                        </Box>
                      </FloatingCard>
                    </Box>

                    {/* Match score badge */}
                    <Box sx={{
                      position: 'absolute', top: 20, right: 24,
                      background: 'white', borderRadius: '10px', px: 1.2, py: 0.6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      zIndex: 4
                    }}>
                      <CheckIcon sx={{ fontSize: 14, color: '#00b894' }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#00b894' }}>92% Match</Typography>
                    </Box>
                  </ChoiceCardVisual>

                  <ChoiceCardBody>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, md: 18 }, color: '#1a1a2e' }}>
                        Browse & Apply to Jobs
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13.5, color: '#777', lineHeight: 1.6, mb: 2.5 }}>
                      Explore jobs matched to your skills by ProfilleAI and start applying right away.
                    </Typography>
                    <ChoiceButton>
                      Browse Jobs
                      <ArrowIcon sx={{ fontSize: 18, ml: 0.5 }} />
                    </ChoiceButton>
                  </ChoiceCardBody>
                </ChoiceCard>
              </ChoiceGrid>
            </SlideInner>
          )}
        </SlideContainer>
      </MainContent>

      {/* Sticky mobile CTA — matches the pinned bottom bar in the design */}
      {!isChoicePage && (
        <MobileActionBar>
          <MobilePrimaryBtn onClick={goNext}>
            Continue
            <ArrowIcon />
          </MobilePrimaryBtn>
          <MobileSkip onClick={skipToEnd}>Skip intro</MobileSkip>
        </MobileActionBar>
      )}
    </PageContainer>
  );
};

export default CandidateOnboarding;
