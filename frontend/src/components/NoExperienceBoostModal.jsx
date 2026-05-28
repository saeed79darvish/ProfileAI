import React from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowOutward as ExternalIcon,
  RocketLaunch as RocketIcon,
  Bolt as BoltIcon,
  Code as CodeIcon,
  Favorite as HeartIcon,
  School as SchoolIcon,
  Public as PublicIcon,
} from '@mui/icons-material';

/**
 * Auto-opened the first time a candidate self-identifies as a new grad,
 * career changer, intern-only or self-taught learner. Frames the "no work
 * experience yet" situation as an opportunity and gives five concrete paths
 * to gain real experience now — each with a curated external destination
 * so this feels like coaching, not filler.
 *
 * Kept in its own file so the wizard step body stays scannable and we can
 * re-open it from any "Show growth paths" trigger.
 */

const PATH_CARDS = [
  {
    id: 'freelance',
    icon: BoltIcon,
    accent: '#6366f1',
    title: 'Freelance / contract gigs',
    blurb: 'One paid project counts as a real role. Upwork has thousands of beginner-friendly briefs you can ship in a weekend.',
    cta: 'Browse Upwork beginner jobs',
    href: 'https://www.upwork.com/nx/find-work/',
  },
  {
    id: 'oss',
    icon: CodeIcon,
    accent: '#0ea5e9',
    title: 'Open-source contributions',
    blurb: 'Recruiters love seeing PRs merged into real codebases. Even a docs or translation PR shows you can work in a team.',
    cta: 'Find good-first-issues on GitHub',
    href: 'https://github.com/topics/good-first-issue',
  },
  {
    id: 'volunteer',
    icon: HeartIcon,
    accent: '#ef4444',
    title: 'Volunteer for a nonprofit',
    blurb: 'Catchafire matches your skills with nonprofits that need them. You walk away with a real client, a reference and metrics to quote.',
    cta: 'Find a project on Catchafire',
    href: 'https://www.catchafire.org/volunteer/',
  },
  {
    id: 'internship',
    icon: SchoolIcon,
    accent: '#f59e0b',
    title: 'Internships & apprenticeships',
    blurb: 'Often the fastest way to convert into a full role. Many companies hire 30-60% of their interns full-time.',
    cta: 'Search internships on LinkedIn',
    href: 'https://www.linkedin.com/jobs/internship-jobs/',
  },
  {
    id: 'ship',
    icon: PublicIcon,
    accent: '#16a34a',
    title: 'Ship something public',
    blurb: 'A side project used by real people beats a perfect résumé. Post on Product Hunt or Indie Hackers and gather feedback.',
    cta: 'See what indie makers ship',
    href: 'https://www.indiehackers.com/products',
  },
];

const PathCard = ({ icon: Icon, accent, title, blurb, cta, href }) => (
  <Box
    component="a"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    sx={{
      display: 'flex',
      gap: 1.75,
      p: 1.75,
      borderRadius: 2,
      border: '1.5px solid #e5e7eb',
      backgroundColor: '#fff',
      textDecoration: 'none',
      color: 'inherit',
      transition: 'all 0.15s ease',
      cursor: 'pointer',
      '&:hover': {
        borderColor: accent,
        backgroundColor: alpha(accent, 0.04),
        transform: 'translateY(-1px)',
        boxShadow: `0 6px 16px -8px ${alpha(accent, 0.4)}`,
      },
    }}
  >
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '10px',
        flexShrink: 0,
        background: accent,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontSize: 12.5, lineHeight: 1.5, mb: 0.75 }}>
        {blurb}
      </Typography>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: accent, fontSize: 12, fontWeight: 700 }}>
        {cta}
        <ExternalIcon sx={{ fontSize: 14 }} />
      </Box>
    </Box>
  </Box>
);

const STAGE_LABELS = {
  new_grad: 'new grads',
  self_taught: 'self-taught candidates',
  internship: 'recent interns',
  career_change: 'career changers',
};

const NoExperienceBoostModal = ({ open, onClose, careerStage }) => {
  const audienceLabel = STAGE_LABELS[careerStage] || 'candidates without much work history yet';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '92vh' } }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
          color: '#fff',
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, color: alpha('#fff', 0.85) }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: alpha('#fff', 0.18),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255,255,255,0.18)',
            }}
          >
            <RocketIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, opacity: 0.9 }}>
            Growth playbook
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.5 }}>
          5 ways to gain real experience — fast
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, fontSize: 13.5 }}>
          These are the highest-leverage paths we recommend to {audienceLabel}. Any one of them gives you a real role you can add back to your profile and quote in interviews.
        </Typography>
      </Box>

      <Box sx={{ p: 3, backgroundColor: '#fafafa', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {PATH_CARDS.map((p) => (
            <PathCard key={p.id} {...p} />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.75,
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fff',
          gap: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 12 }}>
          Tip: pick one and aim to ship something in the next 2 weeks.
        </Typography>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            backgroundColor: '#0f172a',
            '&:hover': { backgroundColor: '#1e293b' },
          }}
        >
          Got it, let's continue
        </Button>
      </Box>
    </Dialog>
  );
};

export default NoExperienceBoostModal;
