import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';

import { INTRO_TEXT, SLIDES } from './constants';
import {
  IntroCard, DotsWrapper, Dot, TwoColumn, LeftCol, RightCol,
  IntroHeading, IntroAccent, IntroBody,
  FeatureBox, FeatureBoxIcon, FeatureText,
  MockupCard, MockupHeader, MockLine, MockTag, MockBadge,
  IntroActions, ContinueBtn, SkipLink,
  ChoiceWrap, ChoiceCard, ChoiceCardVisual, FloatingCard, AiBadge, Blob,
  ChoiceCardBody, ChoiceTitle, ChoiceBody, ChoiceButton,
  MiniTag, MiniBar,
} from './styled';

/* ═══════════════════════════════════════════════
   MOCKUP VISUALS (one per slide)
   ═══════════════════════════════════════════════ */

const ProfileMockup = () => (
  <MockupCard>
    <MockupHeader>
      <Avatar sx={{ width: 36, height: 36, background: 'linear-gradient(135deg,#667eea,#764ba2)', fontSize: 16 }}>S</Avatar>
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>Your Profile</Typography>
        <Typography sx={{ fontSize: 11, color: '#999' }}>AI-Enhanced</Typography>
      </Box>
      <MockBadge>
        <AIIcon sx={{ fontSize: 12 }} /> AI Ready
      </MockBadge>
    </MockupHeader>
    <MockLine $w="75%" $h="8px" $color="linear-gradient(90deg,#667eea,#764ba2)" $mb="12px" />
    <MockLine $w="100%" $mb="6px" />
    <MockLine $w="90%" $mb="6px" />
    <MockLine $w="60%" $mb="16px" />
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
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

const JOB_ROWS = [
  { company: 'G', color: '#4285f4', title: 'Marketing Manager', match: '95%' },
  { company: 'A', color: '#ff9900', title: 'UX Designer', match: '89%' },
  { company: 'S', color: '#00a67e', title: 'Financial Analyst', match: '84%' },
];

const JobsMockup = () => (
  <MockupCard>
    <MockupHeader>
      <SearchIcon sx={{ fontSize: 20, color: '#667eea' }} />
      <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Personalized Job Matches</Typography>
    </MockupHeader>
    {JOB_ROWS.map((job, i) => (
      <Box key={job.title} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
        borderRadius: '10px', mb: 1,
        background: i === 0 ? 'rgba(102,126,234,0.04)' : 'transparent',
        border: i === 0 ? '1px solid rgba(102,126,234,0.15)' : '1px solid #f0f0f0'
      }}>
        <Avatar sx={{ width: 32, height: 32, background: job.color, fontSize: 14, fontWeight: 700 }}>
          {job.company}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
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
      <Box sx={{ ml: 'auto' }}>
        <MockTag><CheckIcon sx={{ fontSize: 12 }} /> Keyword Match</MockTag>
      </Box>
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
  profile: ProfileMockup,
  jobs: JobsMockup,
  tailor: TailorMockup,
};

/* ═══════════════════════════════════════════════
   PUBLIC COMPONENTS
   ═══════════════════════════════════════════════ */

/**
 * One intro slide, rendered as a card in the coach transcript.
 *
 * `index` drives the progress dots, which count the slides plus the
 * build-profile card at the end — the same run of dots the standalone page
 * showed above its slide stage.
 */
export const IntroSlideCard = ({ index, onContinue, onSkip, spent }) => {
  const slide = SLIDES[index];
  if (!slide) return null;
  const Mockup = MOCKUPS[slide.visual];

  return (
    <IntroCard>
      <DotsWrapper>
        {Array.from({ length: SLIDES.length + 1 }).map((_, i) => (
          <Dot key={i} $active={i === index} />
        ))}
      </DotsWrapper>

      <TwoColumn>
        <LeftCol>
          <IntroHeading>{INTRO_TEXT.HEADING_PREFIX}</IntroHeading>
          <IntroAccent as="h4">{slide.headline}</IntroAccent>
          <IntroBody>{slide.description}</IntroBody>

          <FeatureBox>
            <FeatureBoxIcon>{slide.emoji}</FeatureBoxIcon>
            <FeatureText>{slide.featureText}</FeatureText>
          </FeatureBox>

          {!spent && (
            <IntroActions>
              <ContinueBtn type="button" onClick={onContinue}>
                {INTRO_TEXT.CONTINUE}
              </ContinueBtn>
              <SkipLink type="button" onClick={onSkip}>
                {INTRO_TEXT.SKIP}
              </SkipLink>
            </IntroActions>
          )}
        </LeftCol>

        <RightCol>
          <Mockup />
        </RightCol>
      </TwoColumn>
    </IntroCard>
  );
};

/**
 * The single "Build Your AI Profile" card that closes the intro.
 *
 * The old page offered a second card for browsing jobs; that fork is gone —
 * the chat itself is the profile builder, and jobs stay reachable from the
 * nav. Whole card is clickable, with the button as the visible affordance.
 */
export const BuildProfileCard = ({ onStart, spent }) => (
  <ChoiceWrap>
    <DotsWrapper>
      {Array.from({ length: SLIDES.length + 1 }).map((_, i) => (
        <Dot key={i} $active={i === SLIDES.length} />
      ))}
    </DotsWrapper>

    <ChoiceCard
      onClick={spent ? undefined : onStart}
      role="button"
      tabIndex={spent ? -1 : 0}
      onKeyDown={(e) => {
        if (spent) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStart(); }
      }}
    >
      <ChoiceCardVisual>
        <Blob $size="120px" $top="-30px" $right="-30px" />
        <Blob $size="80px" $bottom="-20px" $left="-20px" $alpha={0.06} />

        <FloatingCard $w="200px">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{ width: 42, height: 42, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 16, fontWeight: 700 }}>
              AI
            </Avatar>
            <Box>
              <Box sx={{ width: 80, height: 9, borderRadius: '4px', background: '#1a1a2e', mb: 0.5 }} />
              <Box sx={{ width: 55, height: 7, borderRadius: '4px', background: '#ccc' }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {['Strategy', 'Analytics', 'AI/ML'].map((s) => <MiniTag key={s}>{s}</MiniTag>)}
          </Box>
          <MiniBar>
            <div><i /></div>
            <span>85%</span>
          </MiniBar>
        </FloatingCard>

        <AiBadge>
          <AIIcon /> AI Enhanced
        </AiBadge>
      </ChoiceCardVisual>

      <ChoiceCardBody>
        <ChoiceTitle>{INTRO_TEXT.BUILD_TITLE}</ChoiceTitle>
        <ChoiceBody>{INTRO_TEXT.BUILD_DESCRIPTION}</ChoiceBody>
        <ChoiceButton type="button" disabled={spent}>
          {INTRO_TEXT.BUILD_BUTTON}
        </ChoiceButton>
      </ChoiceCardBody>
    </ChoiceCard>
  </ChoiceWrap>
);

export { INTRO_TEXT, SLIDES, SEEN_INTRO_KEY } from './constants';
