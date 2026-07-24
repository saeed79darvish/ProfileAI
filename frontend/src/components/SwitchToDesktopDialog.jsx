import React from 'react';
import { Box, Typography, Button, IconButton, Dialog } from '@mui/material';
import {
  Laptop as LaptopIcon,
  RateReview as ReviewIcon,
  FactCheck as CheckIcon,
  Extension as ExtensionIcon,
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../designTokens';

const NUDGE_DISMISS_KEY = 'profileai_ai_tools_desktop_nudge_dismissed';

const COPY = {
  tailor: {
    headline: 'Tailoring reads better on a bigger screen',
    subcopy: "ProfileAI can tailor your resume for this role right here on your phone — but you'll get a better result reviewing and fine-tuning the AI's draft on desktop. The Chrome extension will be waiting there to autofill the actual application afterward.",
    emailSubject: (jobTitle) => jobTitle ? `Tailor my resume for ${jobTitle} on desktop` : 'Tailor my resume on desktop',
    emailBody: 'Open this on your computer to tailor your resume with ProfileAI:',
  },
  coverLetter: {
    headline: 'Cover letters read better on a bigger screen',
    subcopy: "ProfileAI can write a cover letter for this role right here on your phone — but you'll get a better result reviewing and fine-tuning the AI's draft on desktop. The Chrome extension will be waiting there to autofill the actual application afterward.",
    emailSubject: (jobTitle) => jobTitle ? `Write my cover letter for ${jobTitle} on desktop` : 'Write my cover letter on desktop',
    emailBody: 'Open this on your computer to write a cover letter with ProfileAI:',
  },
};

const BENEFITS = [
  { icon: ReviewIcon, text: 'More room to review and edit before it goes out' },
  { icon: CheckIcon, text: 'Catch anything the AI got wrong at a glance' },
  { icon: ExtensionIcon, text: 'The Chrome extension picks up right where you left off' },
];

function buildDeepLink(jobId, action) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const param = action === 'tailor' ? 'tailor=1' : 'coverletter=1';
  return `${origin}/jobs?externalJobId=${jobId}&${param}`;
}

function buildEmailHref(deepLink, jobTitle, action) {
  const copy = COPY[action] || COPY.tailor;
  const subject = encodeURIComponent(copy.emailSubject(jobTitle));
  const body = encodeURIComponent(`${copy.emailBody}\n\n${deepLink}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

export function isDesktopNudgeDismissed() {
  try {
    return localStorage.getItem(NUDGE_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissDesktopNudgeForever() {
  try {
    localStorage.setItem(NUDGE_DISMISS_KEY, '1');
  } catch {
    // localStorage unavailable — dismissal just won't persist
  }
}

/**
 * One-time interstitial shown to mobile users before Tailor Resume / Cover
 * Letter runs, steering them toward desktop for a better review experience.
 * Every exit path (close icon, backdrop, "continue anyway") dismisses this
 * for good and lets the caller proceed with the original action.
 */
export default function SwitchToDesktopDialog({ open, action, jobId, jobTitle, onContinue }) {
  const toast = useToast();
  const copy = COPY[action] || COPY.tailor;
  const deepLink = buildDeepLink(jobId, action);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      toast.success('Link copied — paste it into a browser on your computer');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <Dialog open={open} onClose={onContinue} maxWidth="sm" fullWidth>
      <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', position: 'relative' }}>
        <IconButton
          onClick={onContinue}
          aria-label="Close"
          sx={{ position: 'absolute', top: 8, right: 8, color: COLORS.TEXT_MUTED }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            width: 56, height: 56, mx: 'auto', mb: 2.5, borderRadius: '16px',
            background: GRADIENTS.PRIMARY, boxShadow: SHADOWS.PRIMARY_GLOW,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LaptopIcon sx={{ color: '#fff', fontSize: 28 }} />
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 22 }, color: COLORS.TEXT_PRIMARY, mb: 1 }}>
          {copy.headline}
        </Typography>
        <Typography sx={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, mb: 3, maxWidth: 440, mx: 'auto' }}>
          {copy.subcopy}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3.5 }}>
          {BENEFITS.map(({ icon: Icon, text }) => (
            <Box
              key={text}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                p: '10px 14px', borderRadius: RADIUS.MEDIUM,
                background: COLORS.BG_LIGHT, textAlign: 'left',
              }}
            >
              <Icon sx={{ fontSize: 18, color: COLORS.PRIMARY, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>
                {text}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<CopyIcon />}
            onClick={handleCopyLink}
            sx={{
              background: GRADIENTS.PRIMARY, textTransform: 'none', fontWeight: 700,
              px: 3, py: 1.1, borderRadius: RADIUS.MEDIUM,
              boxShadow: SHADOWS.PRIMARY_GLOW,
            }}
          >
            Copy link to finish on desktop
          </Button>
          <Button
            variant="outlined"
            component="a"
            href={buildEmailHref(deepLink, jobTitle, action)}
            startIcon={<EmailIcon />}
            sx={{
              textTransform: 'none', fontWeight: 600, px: 3, py: 1.1,
              borderRadius: RADIUS.MEDIUM, borderColor: COLORS.BORDER_DEFAULT, color: COLORS.TEXT_PRIMARY,
            }}
          >
            Email me this link
          </Button>
        </Box>

        <Box sx={{ pt: 2, borderTop: `1px solid ${COLORS.BORDER_LIGHT}` }}>
          <Button
            size="small"
            onClick={onContinue}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12.5, color: COLORS.TEXT_MUTED }}
          >
            Continue on phone anyway
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
