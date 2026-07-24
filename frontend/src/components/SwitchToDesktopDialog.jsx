import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Drawer } from '@mui/material';
import {
  Smartphone as PhoneIcon,
  Laptop as LaptopIcon,
  ArrowForward as ArrowIcon,
  EditNote as EditIcon,
  Bolt as BoltIcon,
  FactCheck as CheckIcon,
  Extension as ExtensionIcon,
  Email as EmailIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../designTokens';

const NUDGE_DISMISS_KEY = 'profileai_ai_tools_desktop_nudge_dismissed';

const COPY = {
  tailor: {
    subcopy: "Every AI action here (tailoring, cover letters, rewrites) uses a credit from your plan — so it's worth getting the best result. On desktop you get a bigger screen to review and edit before you commit, and our Chrome extension can autofill the actual application once you're ready to apply.",
  },
  coverLetter: {
    subcopy: "Every AI action here (tailoring, cover letters, rewrites) uses a credit from your plan — so it's worth getting the best result. On desktop you get a bigger screen to review and edit before you commit, and our Chrome extension can autofill the actual application once you're ready to apply.",
  },
};

const BENEFITS = [
  { icon: EditIcon, lead: 'More control.', rest: 'Review, edit, and fine-tune every AI draft comfortably before you submit it.' },
  { icon: BoltIcon, lead: 'One click apply.', rest: 'Autofills your résumé, cover letter, and every screening field on any job posting.' },
  { icon: CheckIcon, lead: 'Bigger canvas.', rest: 'Review every AI draft with your match score and keyword coverage side by side.' },
];

function buildInstallEmailHref() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const subject = encodeURIComponent('Install the ProfileAI Chrome extension');
  const body = encodeURIComponent(`Open this on your computer to install the ProfileAI Chrome extension:\n\n${origin}/extension`);
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
 * One-time bottom-sheet nudge shown to mobile users before Tailor Resume /
 * Cover Letter runs, steering them toward desktop + the Chrome extension.
 * Every exit path (close icon, backdrop, "use a credit and continue here")
 * dismisses this for good and lets the caller proceed with the original action.
 */
export default function SwitchToDesktopDialog({ open, action, onContinue }) {
  const navigate = useNavigate();
  const copy = COPY[action] || COPY.tailor;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onContinue}
      PaperProps={{
        sx: {
          borderTopLeftRadius: RADIUS.XXL,
          borderTopRightRadius: RADIUS.XXL,
          maxHeight: '92vh',
          overflowY: 'auto',
        },
      }}
    >
      <Box sx={{ px: 3, pt: 1.5, pb: 4, textAlign: 'center', position: 'relative' }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, background: COLORS.BORDER_DEFAULT, mx: 'auto', mb: 2.5 }} />

        <IconButton
          onClick={onContinue}
          aria-label="Close"
          sx={{ position: 'absolute', top: 8, right: 8, color: COLORS.TEXT_MUTED }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, mb: 3 }}>
          <Box
            sx={{
              width: 60, height: 60, borderRadius: '16px',
              background: COLORS.BG_GRAY, border: `1px solid ${COLORS.BORDER_LIGHT}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <PhoneIcon sx={{ fontSize: 26, color: COLORS.TEXT_MUTED }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', background: COLORS.BORDER_DEFAULT }} />
            ))}
          </Box>
          <ArrowIcon sx={{ color: COLORS.PRIMARY, fontSize: 20, flexShrink: 0 }} />
          <Box
            sx={{
              width: 68, height: 68, borderRadius: '18px',
              background: GRADIENTS.PRIMARY, boxShadow: SHADOWS.PRIMARY_GLOW,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <LaptopIcon sx={{ fontSize: 30, color: '#fff' }} />
          </Box>
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: 24, color: COLORS.TEXT_PRIMARY, mb: 1.5, lineHeight: 1.25 }}>
          We recommend finishing on desktop
        </Typography>
        <Typography sx={{ fontSize: 14.5, color: COLORS.TEXT_SECONDARY, mb: 3, lineHeight: 1.55 }}>
          {copy.subcopy}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
          {BENEFITS.map(({ icon: Icon, lead, rest }) => (
            <Box
              key={lead}
              sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.5,
                p: '14px 16px', borderRadius: RADIUS.LARGE,
                background: COLORS.BG_LIGHT, textAlign: 'left',
              }}
            >
              <Box
                sx={{
                  width: 32, height: 32, borderRadius: RADIUS.MEDIUM, flexShrink: 0,
                  background: 'rgba(102,126,234,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon sx={{ fontSize: 17, color: COLORS.PRIMARY }} />
              </Box>
              <Typography sx={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 1.4 }}>
                <Box component="span" sx={{ fontWeight: 700, color: COLORS.TEXT_PRIMARY }}>{lead}</Box> {rest}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2.5 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<ExtensionIcon />}
            onClick={() => navigate('/extension')}
            sx={{
              background: GRADIENTS.PRIMARY, textTransform: 'none', fontWeight: 700,
              py: 1.3, borderRadius: RADIUS.MEDIUM, fontSize: 15.5,
              boxShadow: SHADOWS.PRIMARY_GLOW,
            }}
          >
            Get the free Chrome extension
          </Button>
          <Button
            fullWidth
            variant="outlined"
            component="a"
            href={buildInstallEmailHref()}
            startIcon={<EmailIcon />}
            sx={{
              textTransform: 'none', fontWeight: 600, py: 1.3, fontSize: 15,
              borderRadius: RADIUS.MEDIUM, borderColor: COLORS.BORDER_DEFAULT, color: COLORS.TEXT_PRIMARY,
            }}
          >
            Email me the desktop link
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mb: 1.5 }}>
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: COLORS.TEXT_MUTED, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED }}>
            Your progress saves automatically to your ProfileAI account
          </Typography>
        </Box>

        <Button
          size="small"
          onClick={onContinue}
          sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12.5, color: COLORS.TEXT_MUTED }}
        >
          Use a credit and continue here
        </Button>
      </Box>
    </Drawer>
  );
}
