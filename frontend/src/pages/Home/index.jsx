import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Grid, Typography, Chip, Button, Card, Link, Divider, CircularProgress,
} from '@mui/material';
import {
  AutoAwesome as SparkleIcon, Check as CheckIcon,
  Shield as ShieldIcon, Groups as GroupsIcon, Search as SearchIcon,
  TrendingUp as TrendingIcon, ChevronRight,
  CloudUpload as UploadIcon, SmartToy as AIIcon, Forum as CoachIcon, Public as ProfileIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { featureFlags } from '../../config/featureFlags';
import SEO from '../../components/SEO';
import BrandLogo from '../../components/BrandLogo';
import * as S from './styled';
import {
  HERO_CHIP_LABEL, HERO_TITLE_PARTS, HERO_SUBTITLE, HERO_BUTTONS,
  TRUST_INDICATORS, HERO_EXAMPLE_TAG, HERO_PROFILE_CARD, HERO_AI_INSIGHT, HERO_JOB_CARD,
  FEATURE_SECTION, FEATURE_TABS_DATA, COACH_DEMO, TAILOR_DEMO, MATCHING_DEMO, PROFILE_DEMO,
  HOW_IT_WORKS, HOW_IT_WORKS_STEPS,
  AUDIENCE_SECTION, CANDIDATE, RECRUITER, HERO_MAIN_CARD,
  MORE_FEATURES_SECTION, MORE_FEATURES_DATA,
  FINAL_CTA, FOOTER_DESC, FOOTER_SOCIAL, FOOTER_COLUMNS, FOOTER_BOTTOM_LINKS,
} from './constants';
// ── Section Wrapper with reveal animation ──
function RevealSection({ children, sx, ...props }) {
  const revealRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (revealRef.current) observer.observe(revealRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={revealRef}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

// Icon mapping for feature tabs (JSX cannot live in constants.ts)
const FEATURE_TAB_ICONS = {
  coach: <CoachIcon />,
  tailor: <SparkleIcon />,
  matching: <SearchIcon />,
  profile: <ProfileIcon />,
};

// Icon mapping for "How It Works" steps
const HOW_STEP_ICONS = [
  <UploadIcon sx={{ fontSize: 28 }} />,
  <AIIcon sx={{ fontSize: 28 }} />,
  <SparkleIcon sx={{ fontSize: 28 }} />,
];

// Icon mapping for "More Features"
const MORE_FEATURE_ICONS = [
  <GroupsIcon />, <TrendingIcon />, <ShieldIcon />,
];

// ── Main Component ──

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState('coach');

  const activeFeature = FEATURE_TABS_DATA.find((t) => t.id === activeTab);

  // /jobs is a lazy chunk, and the router keeps this page on screen until it
  // arrives. On a slow connection that read as a dead button: the URL changed
  // and nothing else did. Fetch the chunk while the visitor reads the hero,
  // and show progress on the button if they click before it lands.
  const [openingJobs, setOpeningJobs] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { import('../CandidateJobs').catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, []);
  const browseJobs = () => {
    setOpeningJobs(true);
    navigate('/jobs');
  };

  return (
    <Box sx={S.pageContainerSx}>
      <SEO
        title="ProfilleAI | AI Job Search Copilot: Career Coach, Job Matching & Resume Tailoring"
        description="Talk to Remi, your AI career coach, and ProfilleAI builds your profile, matches you to jobs that fit, and tailors your resume and cover letter to each one in seconds."
        path="/"
        keywords="AI resume builder, resume tailoring, AI job matching, AI cover letter, AI career coach, ghost job detection, ATS resume optimizer, career copilot"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'ProfilleAI, AI Career Copilot',
            url: 'https://www.profilleai.com/',
            description:
              'AI career coach and platform for building your profile, tailoring your resume to each job, and matching you to real openings.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is ProfilleAI?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'ProfilleAI is an AI career coach that builds your profile from a conversation, tailors your resume and cover letter to any job in seconds, and matches you to jobs that fit your profile.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does AI resume tailoring work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'You upload your resume once. ProfilleAI parses it into a single living profile, then uses AI to rewrite the most relevant experience, skills, and summary for each job description you paste, optimized for ATS keyword matching.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is ProfilleAI free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, ProfilleAI offers a free tier with core resume tailoring. Pro and Pro+ plans unlock higher tailoring and cover letter limits, more live voice coach time, and watermark-free exports.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does ProfilleAI match me to jobs?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'ProfilleAI scores every job in its feed against your profile, skills, seniority, and role history, and flags listings that look like ghost jobs, so the roles you see are the ones you actually fit.',
                },
              },
            ],
          },
        ]}
      />
      {/* ══════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════ */}
      <Box sx={S.heroSectionSx}>
        {/* Floating orbs */}
        <Box sx={S.heroOrb1Sx} />
        <Box sx={S.heroOrb2Sx} />
        {/* Grid lines decoration */}
        <Box sx={S.heroGridLinesSx} />

        <Container maxWidth="lg" sx={S.heroContentSx}>
          <Grid container spacing={{ xs: 2, md: 6 }} alignItems="center">
            <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h1" sx={S.heroTitleSx}>
                {HERO_TITLE_PARTS.prefix}
                <Box component="span" sx={S.gradientTextSx}>
                  {HERO_TITLE_PARTS.highlight}
                </Box>
                {HERO_TITLE_PARTS.suffix}
              </Typography>
              <Typography variant="h6" sx={S.heroSubtitleSx}>
                {HERO_SUBTITLE}
              </Typography>

              <Box sx={S.heroButtonWrapperSx}>
                {!isAuthenticated ? (
                  <>
                    <Button variant="contained" size="large"
                      onClick={() => navigate('/onboarding')} sx={S.heroPrimaryBtnSx}>
                      {HERO_BUTTONS.GET_STARTED}
                    </Button>
                    <Button variant="outlined" size="large"
                      onClick={browseJobs} aria-busy={openingJobs} sx={S.heroOutlinedBtnSx}
                      startIcon={openingJobs ? <CircularProgress size={18} color="inherit" /> : null}>
                      {HERO_BUTTONS.BROWSE_JOBS}
                    </Button>
                  </>
                ) : user?.role === 'recruiter' ? (
                  <>
                    <Button variant="contained" size="large"
                      onClick={() => navigate('/recruiter/dashboard')} sx={S.heroPrimaryBtnSx}>
                      {HERO_BUTTONS.MY_DASHBOARD}
                    </Button>
                    <Button variant="outlined" size="large"
                      onClick={() => navigate('/browse')} sx={S.heroOutlinedBtnSx}>
                      {HERO_BUTTONS.FIND_TALENT}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="contained" size="large"
                      onClick={() => navigate('/profile')} sx={S.heroPrimaryBtnSx}>
                      {HERO_BUTTONS.MY_PROFILE}
                    </Button>
                    <Button variant="outlined" size="large"
                      onClick={browseJobs} aria-busy={openingJobs} sx={S.heroOutlinedBtnSx}
                      startIcon={openingJobs ? <CircularProgress size={18} color="inherit" /> : null}>
                      {HERO_BUTTONS.BROWSE_JOBS}
                    </Button>
                  </>
                )}
              </Box>
              {!isAuthenticated && (
                <Box sx={S.heroTrustRowSx}>
                  {TRUST_INDICATORS.map((t) => (
                    <Box key={t.text} sx={S.heroTrustItemSx}>
                      <CheckIcon sx={{ fontSize: 16, color: '#34d399' }} />
                      {t.text}
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>

            {/* Hero visual, floating cards */}
            <Grid item xs={12} md={5} sx={S.heroVisualWrapperSx}>
              <Box sx={S.heroVisualContainerSx}>
                <Box sx={S.heroVisualGridBgSx} />

                {/* Small Sarah Chen card */}
                <Box sx={S.profileCardSx}>
                  <Box sx={S.profileCardHeaderSx}>
                    <Box sx={S.profileAvatarSx}>👤</Box>
                    <Box>
                      <Typography sx={S.profileNameSx}>{HERO_PROFILE_CARD.name}</Typography>
                      <Typography sx={S.profileRoleSx}>{HERO_PROFILE_CARD.role}</Typography>
                    </Box>
                  </Box>
                  <Box sx={S.profileSkillsWrapperSx}>
                    {HERO_PROFILE_CARD.skills.map((s) => (
                      <Chip key={s} label={s} size="small" sx={S.profileSkillChipSx} />
                    ))}
                  </Box>
                </Box>

                {/* Small AI Insight card */}
                <Box sx={S.aiInsightCardSx}>
                  <Box sx={S.aiInsightHeaderSx}>
                    <SparkleIcon sx={S.aiInsightIconSx} />
                    <Typography sx={S.aiInsightLabelSx}>{HERO_AI_INSIGHT.label}</Typography>
                  </Box>
                  <Typography sx={S.aiInsightTextSx}>{HERO_AI_INSIGHT.text}</Typography>
                </Box>

                {/* Main job match card */}
                <Box sx={S.mainCardSx}>
                  <Box sx={S.mainCardHeaderSx}>
                    <Box sx={S.mainCardIconBoxSx}>
                      <AIIcon sx={{ color: '#fff', fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={S.mainCardTitleRowSx}>
                        <Typography sx={S.mainCardTitleSx}>{HERO_MAIN_CARD.title}</Typography>
                        <Box sx={S.mainCardDotSx} />
                      </Box>
                      <Typography sx={S.mainCardSubtitleSx}>{HERO_MAIN_CARD.subtitle}</Typography>
                    </Box>
                    <Chip label={HERO_EXAMPLE_TAG} size="small" sx={S.exampleChipSx} />
                  </Box>

                  <Box sx={S.jobDetectedSx}>
                    <Box sx={S.jobDetectedHeaderSx}>
                      <Typography sx={S.jobDetectedLabelSx}>{HERO_JOB_CARD.label}</Typography>
                      <Typography sx={S.jobDetectedTimeSx}>{HERO_JOB_CARD.time}</Typography>
                    </Box>
                    <Typography sx={S.jobDetectedTitleSx}>{HERO_JOB_CARD.title}</Typography>
                    <Typography sx={S.jobDetectedCompanySx}>{HERO_JOB_CARD.company}</Typography>
                    <Box sx={S.jobSkillsWrapperSx}>
                      {HERO_JOB_CARD.skills.map((s) => (
                        <Chip key={s} label={s} size="small" sx={S.jobSkillChipSx} />
                      ))}
                    </Box>
                    <Box sx={S.matchScoreWrapperSx}>
                      <Box sx={S.matchScoreBgSx}><Box sx={S.matchScoreFillSx} /></Box>
                      <Typography sx={S.matchScoreValueSx}>{HERO_JOB_CARD.matchScore}</Typography>
                    </Box>
                    <Typography sx={S.matchScoreLabelSx}>{HERO_JOB_CARD.matchLabel}</Typography>
                  </Box>

                  <Box sx={S.mainCardActionsSx}>
                    <Box sx={S.autoTailorBtnSx}>
                      <Typography sx={S.autoTailorTextSx}>
                        <SparkleIcon sx={{ fontSize: 16 }} /> Auto-Tailor
                      </Typography>
                    </Box>
                    <Box sx={S.oneClickBtnSx}>
                      <Typography sx={S.oneClickTextSx}>
                        <CheckIcon sx={{ fontSize: 16 }} /> Cover Letter
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════════════════════════════════
          FEATURE SHOWCASE (TABBED)
          ══════════════════════════════════════════ */}
      <RevealSection sx={S.featureSectionSx}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label={FEATURE_SECTION.chip} sx={S.sectionChipSx} />
            <Typography variant="h3" sx={S.sectionTitleSx}>
              {FEATURE_SECTION.titlePrefix}
              <Box component="span" sx={S.staticGradientTextSx}>{FEATURE_SECTION.titleHighlight}</Box>
            </Typography>
            <Typography sx={S.sectionSubtitleSx}>{FEATURE_SECTION.subtitle}</Typography>
          </Box>

          {/* Tab buttons */}
          <Box sx={S.tabButtonWrapperSx}>
            {FEATURE_TABS_DATA.map((tab) => (
              <Button key={tab.id} onClick={() => setActiveTab(tab.id)}
                startIcon={FEATURE_TAB_ICONS[tab.id]}
                sx={S.getTabButtonSx(activeTab === tab.id)}>
                {tab.label}
              </Button>
            ))}
          </Box>

          {/* Tab content */}
          {activeFeature && (
            <Card elevation={0} sx={S.featureCardSx}>
              <Grid container>
                <Grid item xs={12} md={6} sx={S.featureTextPanelSx}>
                  <Typography variant="h4" sx={S.featureHeadlineSx}>{activeFeature.headline}</Typography>
                  <Typography sx={S.featureDescSx}>{activeFeature.description}</Typography>
                  <Box sx={S.featureBulletsWrapperSx}>
                    {activeFeature.bullets.map((b, i) => (
                      <Box key={i} sx={S.featureBulletItemSx}>
                        <CheckIcon sx={{ fontSize: 18, color: activeFeature.color }} />
                        <Typography sx={S.featureBulletTextSx}>{b}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {!isAuthenticated && (
                    <Button endIcon={<ChevronRight />} onClick={() => navigate('/onboarding')}
                      sx={S.getFeatureTryBtnSx(activeFeature.color)}>
                      {FEATURE_SECTION.tryFree}
                    </Button>
                  )}
                </Grid>

                <Grid item xs={12} md={6} sx={S.featureVisualPanelSx}>
                  <Box sx={S.getFeatureOrbSx(activeFeature.color)} />
                  <Box sx={S.featureVisualContentSx}>
                    {activeTab === 'coach' && (
                      <Box sx={S.demoPanelSx}>
                        <Box sx={S.demoHeaderSx}>
                          <CoachIcon sx={S.aiInsightIconSx} />
                          <Typography sx={S.demoTitleSx}>{COACH_DEMO.label}</Typography>
                          <Chip label={COACH_DEMO.sample} size="small" sx={S.exampleChipSx} />
                        </Box>
                        <Box sx={S.chatRemiBubbleSx}>{COACH_DEMO.remi}</Box>
                        <Box sx={S.chatYouBubbleSx}>{COACH_DEMO.you}</Box>
                        <Box sx={S.chatChipRowSx}>
                          {COACH_DEMO.chips.map((c) => (
                            <Box key={c} sx={S.chatChipSx}>{c}</Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    {activeTab === 'tailor' && (
                      <Box sx={S.demoPanelSx}>
                        <Box sx={S.demoHeaderSx}>
                          <SparkleIcon sx={S.aiInsightIconSx} />
                          <Typography sx={S.demoTitleSx}>{TAILOR_DEMO.label}</Typography>
                          <Chip label={TAILOR_DEMO.sample} size="small" sx={S.exampleChipSx} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                          <Box sx={S.tailorScoreBoxSx}>
                            <Typography sx={S.tailorScoreTextSx}>{TAILOR_DEMO.score}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={S.tailorRoleSx}>{TAILOR_DEMO.role}</Typography>
                            <Typography sx={S.tailorCompanySx}>{TAILOR_DEMO.company}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {TAILOR_DEMO.skills.map((s) => (
                            <Chip key={s} label={s} size="small" sx={S.getSkillMatchChipSx(s.startsWith('✅'))} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {activeTab === 'matching' && (
                      <Box sx={S.matchDemoPanelSx}>
                        <Box sx={S.matchScanLineSx} />
                        <Box sx={S.demoHeaderSx}>
                          <Box sx={S.matchIconBoxSx}>
                            <SearchIcon sx={{ color: '#fff', fontSize: 16 }} />
                          </Box>
                          <Typography sx={S.demoTitleSx}>{MATCHING_DEMO.label}</Typography>
                          <Chip label={MATCHING_DEMO.freshLabel} size="small" sx={S.matchFreshChipSx} />
                        </Box>
                        <Box sx={S.matchDetectedBoxSx}>
                          <Typography sx={S.matchDetectedLabelSx}>{MATCHING_DEMO.detected}</Typography>
                          <Typography sx={S.matchJobTitleSx}>{MATCHING_DEMO.jobTitle}</Typography>
                          <Typography sx={S.matchMatchTextSx}>{MATCHING_DEMO.matchLabel}<Box component="span" sx={S.matchMatchScoreSx}>{MATCHING_DEMO.matchScore}</Box></Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Box sx={S.matchTailorBtnSx}>
                            <Typography sx={S.matchTailorTextSx}>{MATCHING_DEMO.tailorBtn}</Typography>
                          </Box>
                          <Box sx={S.matchCoverBtnSx}>
                            <Typography sx={S.matchCoverTextSx}>{MATCHING_DEMO.coverBtn}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    )}
                    {activeTab === 'profile' && (
                      <Box sx={S.demoPanelSx}>
                        <Box sx={S.demoHeaderSx}>
                          <ProfileIcon sx={S.aiInsightIconSx} />
                          <Typography sx={S.demoTitleSx}>{PROFILE_DEMO.label}</Typography>
                          <Chip label={PROFILE_DEMO.sample} size="small" sx={S.exampleChipSx} />
                        </Box>
                        <Box sx={S.profDemoHeadSx}>
                          <Box sx={S.profDemoAvatarSx}>SC</Box>
                          <Box>
                            <Typography sx={S.tailorRoleSx}>{PROFILE_DEMO.name}</Typography>
                            <Typography sx={S.tailorCompanySx}>{PROFILE_DEMO.role}</Typography>
                            <Typography sx={S.profDemoMetaSx}>
                              {PROFILE_DEMO.place} · <Box component="span" sx={S.profDemoOpenSx}>{PROFILE_DEMO.status}</Box>
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {PROFILE_DEMO.chips.map((c) => (
                            <Chip key={c} label={c} size="small" sx={S.profileSkillChipSx} />
                          ))}
                        </Box>
                        <Box sx={S.profDemoBtnRowSx}>
                          <Box sx={S.profDemoGhostBtnSx}>{PROFILE_DEMO.pdfBtn}</Box>
                          <Box sx={S.profDemoPrimaryBtnSx}>{PROFILE_DEMO.contactBtn}</Box>
                        </Box>
                      </Box>
                    )}

                  </Box>
                </Grid>
              </Grid>
            </Card>
          )}
        </Container>
      </RevealSection>

      {/* ══════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════ */}
      {!isAuthenticated && (
        <RevealSection sx={S.ctaSectionSx}>
          <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={S.ctaTitleSx}>
              {FINAL_CTA.titlePrefix}
              <Box component="span" sx={S.staticGradientTextSx}>{FINAL_CTA.titleHighlight}</Box>
              {FINAL_CTA.titleSuffix}
            </Typography>
            <Typography sx={S.ctaSubtitleSx}>{FINAL_CTA.subtitle}</Typography>
            <Box sx={S.ctaBtnWrapperSx}>
              <Button variant="contained" size="large"
                onClick={() => navigate('/onboarding')} sx={S.ctaPrimaryBtnSx}>
                {FINAL_CTA.primaryBtn}
              </Button>
              <Button variant="outlined" size="large" onClick={() => navigate('/pricing')} sx={S.ctaOutlinedBtnSx}>
                {FINAL_CTA.secondaryBtn}
              </Button>
            </Box>
          </Container>
        </RevealSection>
      )}

      {/* ══════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════ */}
      <Box sx={S.footerSectionSx}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 6 }}>
            <Grid item xs={12} md={4}>
              <Box sx={S.footerBrandSx}>
                <BrandLogo iconSize={34} fontSize="1.25rem" onDark />
              </Box>
              <Typography variant="body2" sx={S.footerDescSx}>{FOOTER_DESC}</Typography>
              <Box sx={S.footerSocialWrapperSx}>
                {FOOTER_SOCIAL.map((s) => (
                  <Box key={s.label} component="a" href={s.href} target="_blank" rel="noopener noreferrer"
                    sx={{ ...S.footerSocialBtnSx, textDecoration: 'none' }}>{s.label}</Box>
                ))}
              </Box>
            </Grid>
            {FOOTER_COLUMNS.map((col) => {
              const links = featureFlags.feed
                ? col.links
                : col.links.filter((l) => l.to !== '/feed');
              if (links.length === 0) return null;
              return (
              <Grid item xs={4} sm={4} md={2.66} key={col.title}>
                <Typography sx={S.footerColTitleSx}>{col.title}</Typography>
                <Box sx={S.footerColLinksSx}>
                  {links.map((link) =>
                    link.href ? (
                      <Link key={link.label} href={link.href} sx={S.footerLinkSx}>{link.label}</Link>
                    ) : (
                      <Link key={link.label} component={RouterLink} to={link.to} sx={S.footerLinkSx}>{link.label}</Link>
                    )
                  )}
                </Box>
              </Grid>
              );
            })}
          </Grid>
          <Divider sx={S.footerDividerSx} />
          <Box sx={S.footerBottomSx}>
            <Typography variant="body2" sx={S.footerCopyrightSx}>
              © {new Date().getFullYear()} ProfilleAI. All rights reserved.
            </Typography>
            <Box sx={S.footerBottomLinksSx}>
              {FOOTER_BOTTOM_LINKS.map((l) => (
                <Link key={l.label} component={RouterLink} to={l.to} sx={S.footerBottomLinkSx}>{l.label}</Link>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
