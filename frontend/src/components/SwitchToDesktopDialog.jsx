import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Drawer } from '@mui/material';
import {
  Smartphone as PhoneIcon,
  Laptop as LaptopIcon,
  ArrowForward as ArrowIcon,
  HelpOutline as QuestionIcon,
  Edit as EditIcon,
  Bolt as BoltIcon,
  AttachMoney as CreditIcon,
  Extension as ExtensionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../designTokens';

const NUDGE_DISMISS_KEY = 'profileai_ai_tools_desktop_nudge_dismissed';

const SUBCOPY = "You'll get the full ProfileAI experience there. The Chrome extension answers every custom application question with AI, gives you more control over each draft, and keeps your monthly credits for when they really count.";

const BENEFITS = [
  { icon: QuestionIcon, lead: 'AI answers custom questions.', rest: "Every screening question on the form gets a tailored answer from your profile. On mobile you'd type each one by hand." },
  { icon: EditIcon, lead: 'More control over drafts.', rest: "Review, edit, and approve each AI response side by side with the job description before it's submitted." },
  { icon: BoltIcon, lead: 'One tap apply.', rest: 'Autofills your résumé, cover letter, and every field on Greenhouse, Lever, Ashby, Workday and other job sites.' },
  { icon: CreditIcon, lead: 'Same monthly credits.', rest: "Extension actions draw from the same plan as mobile — you're not spending anything extra, just getting a better result." },
];

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
 * Every exit path (close icon, backdrop, "continue on mobile anyway")
 * dismisses this for good and lets the caller proceed with the original action.
 */
export default function SwitchToDesktopDialog({ open, onContinue }) {
  const navigate = useNavigate();

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
          {SUBCOPY}
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

        <Button
          fullWidth
          variant="contained"
          startIcon={<ExtensionIcon />}
          onClick={() => navigate('/extension')}
          sx={{
            background: GRADIENTS.PRIMARY, textTransform: 'none', fontWeight: 700,
            py: 1.3, borderRadius: RADIUS.MEDIUM, fontSize: 15.5,
            boxShadow: SHADOWS.PRIMARY_GLOW, mb: 2.5,
          }}
        >
          Get the free Chrome extension
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, mb: 1.5, pt: 2, borderTop: `1px solid ${COLORS.BORDER_LIGHT}` }}>
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: COLORS.TEXT_MUTED, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED }}>
            Your progress saves automatically. Pick up where you left off on any device.
          </Typography>
        </Box>

        <Button
          size="small"
          onClick={onContinue}
          sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12.5, color: COLORS.TEXT_MUTED }}
        >
          Continue on mobile anyway
        </Button>
      </Box>
    </Drawer>
  );
}
