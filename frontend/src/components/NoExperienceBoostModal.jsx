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
 * experience yet" situation as an opportunity and gives five concrete
 * categories of work they can do to gain real experience.
 *
 * Important: we deliberately do NOT link out to external sites here.
 * Sending a candidate to Upwork or GitHub mid-onboarding kills the flow
 * and most never come back. Instead each card is pure guidance and the
 * single primary CTA at the bottom keeps them in-app — handing off to
 * the AI project-ideas modal so they can add a starter project right
 * now, then run AI Draft on it.
 */

const PATH_CARDS = [
  {
    id: 'freelance',
    icon: BoltIcon,
    accent: '#6366f1',
    title: 'Freelance / contract gigs',
    blurb: 'One paid project counts as a real role. Even a single small brief in your field gives you a title, a client and a deliverable to talk about.',
  },
  {
    id: 'oss',
    icon: CodeIcon,
    accent: '#0ea5e9',
    title: 'Open-source contributions',
    blurb: 'PRs merged into real codebases prove you can read code, follow conventions and collaborate. Docs and translation PRs count too.',
  },
  {
    id: 'volunteer',
    icon: HeartIcon,
    accent: '#ef4444',
    title: 'Volunteer for a nonprofit',
    blurb: 'A nonprofit project gives you a real client, a reference and metrics to quote. Walk away with proof you can deliver under constraints.',
  },
  {
    id: 'internship',
    icon: SchoolIcon,
    accent: '#f59e0b',
    title: 'Internships & apprenticeships',
    blurb: 'Often the fastest way to convert into a full role — many companies hire 30–60% of their interns full-time. Even a short internship counts.',
  },
  {
    id: 'ship',
    icon: PublicIcon,
    accent: '#16a34a',
    title: 'Ship a side project',
    blurb: 'A side project used by real people beats a perfect résumé. Pick something small, finish it, share it — recruiters always ask about it.',
  },
];

const PathCard = ({ icon: Icon, accent, title, blurb }) => (
  <Box
    sx={{
      display: 'flex',
      gap: 1.75,
      p: 1.75,
      borderRadius: 2,
      border: '1.5px solid #e5e7eb',
      backgroundColor: '#fff',
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
      '&:hover': {
        borderColor: accent,
        backgroundColor: alpha(accent, 0.04),
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
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14, mb: 0.4 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontSize: 12.5, lineHeight: 1.5 }}>
        {blurb}
      </Typography>
    </Box>
  </Box>
);

const STAGE_LABELS = {
  new_grad: 'new grads',
  self_taught: 'self-taught candidates',
  internship: 'recent interns',
  career_change: 'career changers',
};

/**
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   careerStage: string  — used to personalise the headline copy
 *   onOpenProjectIdeas?: () => void  — optional handoff: closes this modal
 *                                       and opens the AI project-ideas modal
 *                                       so the candidate can take action now.
 */
const NoExperienceBoostModal = ({ open, onClose, careerStage, onOpenProjectIdeas }) => {
  const audienceLabel = STAGE_LABELS[careerStage] || 'candidates without much work history yet';

  const handleAddProject = () => {
    onClose?.();
    onOpenProjectIdeas?.();
  };

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
          These are the highest-leverage paths we recommend to {audienceLabel}. Each one gives you a real role you can add to your profile and quote in interviews.
        </Typography>
      </Box>

      <Box sx={{ p: 3, backgroundColor: '#fafafa', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {PATH_CARDS.map((p) => (
            <PathCard key={p.id} {...p} />
          ))}
        </Box>

        {/* In-flow handoff — keeps the candidate inside the wizard. Adding
            a starter project here is the fastest way to turn this advice
            into something concrete on their profile right now. */}
        {onOpenProjectIdeas && (
          <Box
            sx={{
              mt: 2,
              p: 1.75,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
              border: '1px dashed rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Typography sx={{ fontSize: 12.5, color: '#475569', fontWeight: 500, flex: 1, minWidth: 200 }}>
              <strong style={{ color: '#4338ca' }}>Want to start right now?</strong>
              {' '}Add a recruiter-loved starter project to your profile in one click.
            </Typography>
            <Button
              onClick={handleAddProject}
              variant="contained"
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
              }}
            >
              Show me starter projects
            </Button>
          </Box>
        )}
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
          Tip: pick one path and aim to ship something in the next 2 weeks.
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
