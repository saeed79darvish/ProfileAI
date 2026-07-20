import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Grid, Typography, Button, Card, Chip,
} from '@mui/material';
import {
  Extension as ExtensionIcon,
  Download as DownloadIcon,
  AutoAwesome as SparkleIcon,
  Bolt as BoltIcon,
  EditNote as EditNoteIcon,
  Insights as InsightsIcon,
  Public as PublicIcon,
  CheckCircle as CheckCircleIcon,
  Login as LoginIcon,
  TouchApp as TouchAppIcon,
  RocketLaunch as RocketIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import SEO from '../../components/SEO';
import { extensionConfig } from '../../config/extension';
import useIsMobileDevice from '../../hooks/useIsMobileDevice';

const ACCENT = '#7c3aed';

const HOW_IT_WORKS = [
  {
    icon: DownloadIcon,
    title: 'Add it to Chrome',
    desc: 'Install the ProfileAI extension from the Chrome Web Store in one click — no setup required.',
  },
  {
    icon: LoginIcon,
    title: 'Sign in once',
    desc: 'Open ProfileAI in your browser and sign in. The extension securely picks up your profile automatically.',
  },
  {
    icon: TouchAppIcon,
    title: 'Open any job posting',
    desc: 'On LinkedIn, Greenhouse, Workday, or any company career page, the side panel detects the role instantly.',
  },
  {
    icon: RocketIcon,
    title: 'Tailor, fill & apply',
    desc: 'Quick-fill the basics, draft AI answers to screening questions, and tailor your resume — then submit.',
  },
];

const FEATURES = [
  {
    icon: BoltIcon,
    title: 'Quick Fill Basics',
    desc: 'Auto-populate name, contact, links, and standard fields on any application form so you never retype them.',
  },
  {
    icon: EditNoteIcon,
    title: 'AI answers to screening questions',
    desc: 'Stuck on "Why do you want this role?" Generate a tailored, human-sounding draft you can insert, copy, or edit.',
  },
  {
    icon: SparkleIcon,
    title: 'Resume tailored to each job',
    desc: 'Pull the job description and rewrite your resume to match — highlighting the skills the role actually asks for.',
  },
  {
    icon: InsightsIcon,
    title: 'Instant match analysis',
    desc: 'See a match score, aligned strengths, skill gaps, and talking points before you spend time on an application.',
  },
  {
    icon: PublicIcon,
    title: 'Works anywhere you apply',
    desc: 'Not just job boards — it runs on company career sites and any application form across the web.',
  },
  {
    icon: ExtensionIcon,
    title: 'Right beside your work',
    desc: 'Everything lives in a clean side panel next to the page, so your profile travels with you across every tab.',
  },
];

export default function ExtensionPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { storeUrl, isPublished, supportedSites } = extensionConfig;
  const isMobile = useIsMobileDevice();

  const handleAddToChrome = () => {
    if (isPublished && storeUrl) {
      window.open(storeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Chrome extensions can't be installed from a phone browser (Android Chrome
  // can browse the Web Store but can't add extensions; iOS Safari/Chrome can't
  // at all), so on mobile we swap the install CTA for "email me the link"
  // instead of pointing at a button that can't do anything.
  const installEmailHref = `mailto:?subject=${encodeURIComponent('Install the ProfileAI Chrome extension')}&body=${encodeURIComponent(`Open this on your computer to install the ProfileAI Chrome extension:\n\n${typeof window !== 'undefined' ? window.location.href : ''}`)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ProfileAI — Job Application Assistant',
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description:
      'AI-powered Chrome extension that autofills job applications, drafts answers to screening questions, and tailors your resume on any job site.',
  };

  return (
    <Box sx={{ background: '#0f0f14', color: '#fff', minHeight: '100vh' }}>
      <SEO
        title="ProfileAI Chrome Extension — Apply to Any Job, Anywhere"
        description="The ProfileAI Chrome extension autofills applications, drafts AI answers to screening questions, and tailors your resume on LinkedIn, Greenhouse, Workday, and any career page."
        path="/extension"
        keywords="ProfileAI chrome extension, job application autofill, AI resume tailoring extension, auto apply jobs"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 8 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Chip
              icon={<ExtensionIcon sx={{ color: '#fff !important', fontSize: 18 }} />}
              label="ProfileAI for Chrome"
              sx={{
                background: 'rgba(124,58,237,0.15)',
                color: '#c4b5fd',
                border: '1px solid rgba(124,58,237,0.4)',
                fontWeight: 600,
                mb: 3,
              }}
            />
            <Typography
              variant="h2"
              sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: 36, md: 54 }, mb: 2 }}
            >
              Apply to any job,{' '}
              <Box component="span" sx={{
                background: 'linear-gradient(90deg,#a78bfa,#7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                anywhere on the web
              </Box>
            </Typography>
            <Typography sx={{ fontSize: { xs: 16, md: 20 }, color: 'rgba(255,255,255,0.7)', mb: 4, maxWidth: 560 }}>
              Your ProfileAI profile travels with you. The Chrome extension autofills
              applications, drafts answers to screening questions, and tailors your resume —
              right on the job page, in seconds.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {isMobile ? (
                <Button
                  variant="contained"
                  size="large"
                  component="a"
                  href={installEmailHref}
                  startIcon={<EmailIcon />}
                  sx={{
                    background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                    fontWeight: 700, px: 4, py: 1.5, textTransform: 'none', fontSize: 16,
                  }}
                >
                  Email me the install link
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<DownloadIcon />}
                  onClick={handleAddToChrome}
                  disabled={!isPublished}
                  sx={{
                    background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    fontSize: 16,
                    '&.Mui-disabled': { background: 'rgba(124,58,237,0.35)', color: 'rgba(255,255,255,0.6)' },
                  }}
                >
                  {isPublished ? 'Add to Chrome — Free' : 'Coming soon to the Chrome Web Store'}
                </Button>
              )}
              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.3)',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    fontSize: 16,
                  }}
                >
                  Create your free profile
                </Button>
              )}
            </Box>
            {isMobile ? (
              <Typography sx={{ mt: 2, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                The extension needs a desktop browser. We'll email you the link so it's one tap away
                when you're back at your computer.
              </Typography>
            ) : !isPublished && (
              <Typography sx={{ mt: 2, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                We're finalizing our Chrome Web Store listing. Create your profile now so you're
                ready the moment it goes live.
              </Typography>
            )}
          </Grid>

          {/* Side panel mock */}
          <Grid item xs={12} md={5}>
            <Card sx={{
              background: '#16161f',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 4,
              p: 3,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: 2,
                  background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ExtensionIcon sx={{ color: '#fff', fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: '#fff' }}>ProfileAI</Typography>
                <Chip label="Job detected" size="small" sx={{
                  ml: 'auto', background: 'rgba(34,197,94,0.15)', color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.3)', fontSize: 11, fontWeight: 600,
                }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Detected role</Typography>
              <Typography sx={{ fontWeight: 700, color: '#fff', mb: 2 }}>Senior Product Designer</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Profile match</Typography>
                <Typography sx={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>92%</Typography>
              </Box>
              <Box sx={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', mb: 2.5, overflow: 'hidden' }}>
                <Box sx={{ width: '92%', height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
              </Box>
              {['Quick Fill Basics', 'Answer Questions', 'Tailor Resume'].map((label) => (
                <Box key={label} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  background: 'rgba(124,58,237,0.12)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  borderRadius: 2, px: 2, py: 1.25, mb: 1.25,
                }}>
                  <SparkleIcon sx={{ color: '#a78bfa', fontSize: 16 }} />
                  <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{label}</Typography>
                </Box>
              ))}
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* How it works */}
      <Box sx={{ background: '#13131c', py: { xs: 7, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 800, textAlign: 'center', fontSize: { xs: 28, md: 40 }, mb: 1.5 }}>
            How it works
          </Typography>
          <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', mb: 6, fontSize: { xs: 15, md: 18 } }}>
            From install to submitted application in under a minute.
          </Typography>
          <Grid container spacing={3}>
            {HOW_IT_WORKS.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={step.title}>
                <Box sx={{ height: '100%', position: 'relative', p: 3, borderRadius: 3, background: '#1a1a26', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Box sx={{
                    width: 44, height: 44, borderRadius: 2, mb: 2,
                    background: 'rgba(124,58,237,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <step.icon sx={{ color: '#a78bfa', fontSize: 24 }} />
                  </Box>
                  <Typography sx={{ position: 'absolute', top: 16, right: 20, fontWeight: 900, fontSize: 28, color: 'rgba(124,58,237,0.25)' }}>
                    {i + 1}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, mb: 1 }}>{step.title}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>{step.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
        <Typography variant="h3" sx={{ fontWeight: 800, textAlign: 'center', fontSize: { xs: 28, md: 40 }, mb: 1.5 }}>
          What it does on every job
        </Typography>
        <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', mb: 6, fontSize: { xs: 15, md: 18 } }}>
          One profile, automated across the entire application.
        </Typography>
        <Grid container spacing={3}>
          {FEATURES.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <Box sx={{ height: '100%', p: 3.5, borderRadius: 3, background: '#16161f', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color .2s', '&:hover': { borderColor: 'rgba(124,58,237,0.4)' } }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 2.5, mb: 2.5,
                  background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(167,139,250,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <f.icon sx={{ color: '#a78bfa', fontSize: 26 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>{f.title}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 14.5, lineHeight: 1.6 }}>{f.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Supported sites */}
      <Box sx={{ background: '#13131c', py: { xs: 7, md: 9 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 32 }, mb: 2 }}>
            Works where you already apply
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, fontSize: { xs: 15, md: 17 } }}>
            Built for the platforms and applicant tracking systems you use every day.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
            {supportedSites.map((site) => (
              <Chip
                key={site}
                icon={<CheckCircleIcon sx={{ color: '#4ade80 !important', fontSize: 16 }} />}
                label={site}
                sx={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontWeight: 500,
                  px: 1,
                  py: 2.25,
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* Final CTA */}
      <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: 30, md: 44 }, mb: 2 }}>
          Stop retyping. Start applying.
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: { xs: 16, md: 19 }, maxWidth: 560, mx: 'auto' }}>
          Add ProfileAI to Chrome and let your profile do the heavy lifting on every application.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isMobile ? (
            <Button
              variant="contained"
              size="large"
              component="a"
              href={installEmailHref}
              startIcon={<EmailIcon />}
              sx={{
                background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                fontWeight: 700, px: 5, py: 1.75, textTransform: 'none', fontSize: 17,
              }}
            >
              Email me the install link
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              onClick={handleAddToChrome}
              disabled={!isPublished}
              sx={{
                background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                fontWeight: 700, px: 5, py: 1.75, textTransform: 'none', fontSize: 17,
                '&.Mui-disabled': { background: 'rgba(124,58,237,0.35)', color: 'rgba(255,255,255,0.6)' },
              }}
            >
              {isPublished ? 'Add to Chrome — Free' : 'Coming soon'}
            </Button>
          )}
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/applypilot')}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontWeight: 600, px: 5, py: 1.75, textTransform: 'none', fontSize: 17 }}
          >
            Explore ApplyPilot
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
