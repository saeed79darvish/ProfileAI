import React, { useEffect, useMemo, useState } from 'react';
import {
  AutoAwesome as AIIcon,
  Description as ReadIcon,
  Psychology as UnderstandIcon,
  Bolt as SkillsIcon,
  WorkOutline as ExperienceIcon,
  FolderSpecial as ProjectsIcon,
  CheckCircle as DoneIcon,
  School as EducationIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { MAGIC_STEPS, MAGIC_TIMING, MAGIC_TEXT } from './constants';
import {
  MagicScreen,
  MagicGrid,
  MagicLeft,
  MagicOrb,
  OrbRing,
  Sparkle,
  MagicTitle,
  MagicStepText,
  MagicProgressTrack,
  MagicProgressBar,
  MagicProgressLabel,
  MagicCard,
  MagicCardHeader,
  MagicAvatar,
  SkeletonLine,
  MagicSectionLabel,
  MagicTagRow,
  MagicTag,
  ResultStats,
  ResultStat,
  ResultNumber,
  ResultLabel,
} from './styled';

const STEP_ICONS = {
  read: ReadIcon,
  understand: UnderstandIcon,
  skills: SkillsIcon,
  experience: ExperienceIcon,
  story: ProjectsIcon,
  polish: DoneIcon,
};

const PLACEHOLDER_TAGS = ['Skill', 'Skill', 'Skill', 'Skill'];

/**
 * Full-screen "AI is building your profile" experience that plays while the
 * resume is parsed. It narrates each step, fills in a live profile card, and
 * ends on a celebratory summary of what was extracted before navigating on.
 *
 * Props:
 *  - ready: boolean   -> true once the parse API has resolved
 *  - data: object     -> parsed resume data ({ skills, experience, education, projects })
 *  - onFinish: fn     -> called after the celebration to continue the flow
 */
const ResumeMagicOverlay = ({ ready, data, onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [pct, setPct] = useState(8);
  const [phase, setPhase] = useState('parsing'); // 'parsing' | 'done'

  // Advance narration steps + progress while we wait for the parse.
  useEffect(() => {
    if (phase !== 'parsing') return undefined;
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, MAGIC_STEPS.length - 1));
      setPct((p) => Math.min(p + 14, MAGIC_TIMING.HOLD_PCT));
    }, MAGIC_TIMING.STEP_MS);
    return () => clearInterval(id);
  }, [phase]);

  // When the API resolves, snap to 100% then reveal the results.
  useEffect(() => {
    if (!ready) return undefined;
    setStepIndex(MAGIC_STEPS.length - 1);
    setPct(100);
    const t = setTimeout(() => setPhase('done'), 450);
    return () => clearTimeout(t);
  }, [ready]);

  // Celebrate, then continue the flow.
  useEffect(() => {
    if (phase !== 'done') return undefined;
    const t = setTimeout(() => onFinish(), MAGIC_TIMING.FINISH_MS);
    return () => clearTimeout(t);
  }, [phase, onFinish]);

  const counts = useMemo(() => ({
    skills: Array.isArray(data?.skills) ? data.skills.length : 0,
    experience: Array.isArray(data?.experience) ? data.experience.length : 0,
    education: Array.isArray(data?.education) ? data.education.length : 0,
    projects: Array.isArray(data?.projects) ? data.projects.length : 0,
  }), [data]);

  const isDone = phase === 'done';
  const currentStep = MAGIC_STEPS[stepIndex];
  const StepIcon = STEP_ICONS[currentStep?.id] || AIIcon;

  // Which skeleton rows have "filled in" so far.
  const filled = {
    header: stepIndex >= 0 || isDone,
    summary: stepIndex >= 1 || isDone,
    skills: stepIndex >= 2 || isDone,
    experience: stepIndex >= 3 || isDone,
    projects: stepIndex >= 4 || isDone,
  };

  const skillTags = (Array.isArray(data?.skills) && data.skills.length > 0 && (filled.skills))
    ? data.skills.slice(0, 5)
    : PLACEHOLDER_TAGS;

  return (
    <MagicScreen role="status" aria-live="polite" aria-label={MAGIC_TEXT.TITLE_PARSING}>
      <MagicGrid>
        {/* Narration / progress / results */}
        <MagicLeft>
          <MagicOrb>
            <OrbRing />
            <AIIcon />
            <Sparkle $left="-6px" $top="6px" $delay="0s">✦</Sparkle>
            <Sparkle $left="84px" $top="14px" $delay="0.6s">✧</Sparkle>
            <Sparkle $left="60px" $top="-8px" $delay="1.1s">✦</Sparkle>
          </MagicOrb>

          <MagicTitle>
            {isDone ? MAGIC_TEXT.TITLE_DONE : MAGIC_TEXT.TITLE_PARSING}
          </MagicTitle>

          {isDone ? (
            <>
              <MagicStepText>
                <DoneIcon style={{ color: '#34d399' }} />
                {MAGIC_TEXT.STEP_DONE}
              </MagicStepText>

              <ResultStats>
                <ResultStat $delay="0s">
                  <ResultNumber>{counts.skills}</ResultNumber>
                  <ResultLabel>{MAGIC_TEXT.STAT_SKILLS}</ResultLabel>
                </ResultStat>
                <ResultStat $delay="0.08s">
                  <ResultNumber>{counts.experience}</ResultNumber>
                  <ResultLabel>{MAGIC_TEXT.STAT_EXPERIENCE}</ResultLabel>
                </ResultStat>
                <ResultStat $delay="0.16s">
                  <ResultNumber>{counts.education}</ResultNumber>
                  <ResultLabel>{MAGIC_TEXT.STAT_EDUCATION}</ResultLabel>
                </ResultStat>
                <ResultStat $delay="0.24s">
                  <ResultNumber>{counts.projects}</ResultNumber>
                  <ResultLabel>{MAGIC_TEXT.STAT_PROJECTS}</ResultLabel>
                </ResultStat>
              </ResultStats>

              <MagicProgressLabel>{MAGIC_TEXT.CONTINUE}</MagicProgressLabel>
            </>
          ) : (
            <>
              <MagicStepText>
                <StepIcon />
                {currentStep?.label}
              </MagicStepText>

              <MagicProgressTrack>
                <MagicProgressBar $pct={pct} />
              </MagicProgressTrack>
              <MagicProgressLabel>{Math.round(pct)}%</MagicProgressLabel>
            </>
          )}
        </MagicLeft>

        {/* Live profile card that assembles itself */}
        <MagicCard>
          <MagicCardHeader>
            <MagicAvatar />
            <div style={{ flex: 1 }}>
              <SkeletonLine
                $w="55%"
                $h="11px"
                $mb="6px"
                $filled={filled.header}
                $accent="linear-gradient(90deg,#667eea,#764ba2)"
              />
              <SkeletonLine $w="38%" $h="8px" $mb="0" $filled={filled.header} $accent="#e3e6ee" />
            </div>
          </MagicCardHeader>

          <MagicSectionLabel><UnderstandIcon /> Summary</MagicSectionLabel>
          <SkeletonLine $w="100%" $filled={filled.summary} $accent="#eef0f4" />
          <SkeletonLine $w="92%" $filled={filled.summary} $accent="#eef0f4" />
          <SkeletonLine $w="70%" $mb="4px" $filled={filled.summary} $accent="#eef0f4" />

          <MagicSectionLabel><SkillsIcon /> Skills</MagicSectionLabel>
          <MagicTagRow>
            {skillTags.map((tag, i) => (
              filled.skills ? (
                <MagicTag key={`${tag}-${i}`} $delay={`${i * 0.06}s`}>{tag}</MagicTag>
              ) : (
                <SkeletonLine
                  key={`sk-${i}`}
                  $w="62px"
                  $h="24px"
                  $mb="0"
                  style={{ borderRadius: 8 }}
                />
              )
            ))}
          </MagicTagRow>

          <MagicSectionLabel><ExperienceIcon /> Experience</MagicSectionLabel>
          <SkeletonLine $w="48%" $h="9px" $filled={filled.experience} $accent="linear-gradient(90deg,#667eea,#764ba2)" />
          <SkeletonLine $w="100%" $filled={filled.experience} $accent="#eef0f4" />
          <SkeletonLine $w="84%" $mb="4px" $filled={filled.experience} $accent="#eef0f4" />

          <MagicSectionLabel><ProjectsIcon /> Projects</MagicSectionLabel>
          <SkeletonLine $w="44%" $h="9px" $filled={filled.projects} $accent="linear-gradient(90deg,#f093fb,#f5576c)" />
          <SkeletonLine $w="96%" $mb="0" $filled={filled.projects} $accent="#eef0f4" />
        </MagicCard>
      </MagicGrid>
    </MagicScreen>
  );
};

export default ResumeMagicOverlay;
