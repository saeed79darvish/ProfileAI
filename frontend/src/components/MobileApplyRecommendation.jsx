import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton } from '@mui/material';
import {
  Laptop as LaptopIcon,
  Bolt as BoltIcon,
  AutoAwesome as SparkleIcon,
  Public as PublicIcon,
  Speed as SpeedIcon,
  ContentCopy as CopyIcon,
  Email as EmailIcon,
  Close as CloseIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../designTokens';

const BANNER_DISMISS_KEY = 'profileai_mobile_banner_dismissed';

const BENEFITS = [
  { icon: BoltIcon, text: 'One-click autofill for every question' },
  { icon: SparkleIcon, text: 'AI answers personalized from your resume' },
  { icon: PublicIcon, text: 'Works on more job sites, not just this one' },
  { icon: SpeedIcon, text: 'Faster, smoother start-to-submit flow' },
];

function buildEmailHref(jobUrl, jobTitle) {
  const subject = encodeURIComponent(
    jobTitle ? `Finish applying to ${jobTitle} on desktop` : 'Finish this job application on desktop',
  );
  const body = encodeURIComponent(
    `Open this on your computer to apply with the ProfileAI Chrome extension:\n\n${jobUrl}`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export function isMobileBannerDismissed() {
  try {
    return sessionStorage.getItem(BANNER_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Nudges mobile visitors toward the desktop + Chrome extension experience.
 * `variant="banner"` is a compact, dismissible strip for browse-time pages.
 * `variant="interstitial"` is a full takeover for the higher-intent apply moment.
 */
export default function MobileApplyRecommendation({
  variant = 'banner',
  jobUrl = typeof window !== 'undefined' ? window.location.href : '',
  jobTitle,
  onContinueAnyway,
  onDismiss,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(isMobileBannerDismissed);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      toast.success('Link copied — paste it into a browser on your computer');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const handleDismissBanner = () => {
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {
      // sessionStorage unavailable — dismissal just won't persist across reloads
    }
    setDismissed(true);
    onDismiss?.();
  };

  if (variant === 'banner') {
    if (dismissed) return null;
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: '12px 16px',
          mb: 2.5,
          borderRadius: RADIUS.LARGE,
          background: 'linear-gradient(90deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08))',
          border: `1px solid rgba(102,126,234,0.2)`,
        }}
      >
        <Box
          sx={{
            width: 34, height: 34, flexShrink: 0, borderRadius: '10px',
            background: GRADIENTS.PRIMARY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LaptopIcon sx={{ color: '#fff', fontSize: 18 }} />
        </Box>
        <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>
          This application is faster on desktop — ProfileAI's Chrome extension can autofill it for you.
        </Typography>
        <Button
          size="small"
          onClick={() => navigate('/extension')}
          sx={{
            textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap',
            color: COLORS.PRIMARY, flexShrink: 0,
          }}
        >
          Learn more
        </Button>
        <IconButton size="small" onClick={handleDismissBanner} aria-label="Dismiss">
          <CloseIcon sx={{ fontSize: 16, color: COLORS.TEXT_MUTED }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: RADIUS.XXL,
        background: COLORS.BG_WHITE,
        boxShadow: SHADOWS.ELEVATED,
        border: `1px solid ${COLORS.BORDER_LIGHT}`,
        p: { xs: 3, sm: 5 },
        textAlign: 'center',
        maxWidth: 640,
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          width: 56, height: 56, mx: 'auto', mb: 2.5, borderRadius: '16px',
          background: GRADIENTS.PRIMARY, boxShadow: SHADOWS.PRIMARY_GLOW,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ExtensionIcon sx={{ color: '#fff', fontSize: 28 }} />
      </Box>

      <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 26 }, color: COLORS.TEXT_PRIMARY, mb: 1 }}>
        Apply faster with the ProfileAI extension
      </Typography>
      <Typography sx={{ fontSize: 14.5, color: COLORS.TEXT_SECONDARY, mb: 3.5, maxWidth: 460, mx: 'auto' }}>
        This application has questions ProfileAI can answer for you automatically —
        but that only works in a desktop browser with the extension installed.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
          textAlign: 'left',
          mb: 3.5,
        }}
      >
        {BENEFITS.map(({ icon: Icon, text }) => (
          <Box
            key={text}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              p: '10px 14px', borderRadius: RADIUS.MEDIUM,
              background: COLORS.BG_LIGHT,
            }}
          >
            <Icon sx={{ fontSize: 18, color: COLORS.PRIMARY, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: COLORS.TEXT_PRIMARY }}>
              {text}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 1 }}>
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
          Copy application link
        </Button>
        <Button
          variant="outlined"
          component="a"
          href={buildEmailHref(jobUrl, jobTitle)}
          startIcon={<EmailIcon />}
          sx={{
            textTransform: 'none', fontWeight: 600, px: 3, py: 1.1,
            borderRadius: RADIUS.MEDIUM, borderColor: COLORS.BORDER_DEFAULT, color: COLORS.TEXT_PRIMARY,
          }}
        >
          Email this link to myself
        </Button>
      </Box>

      <Button
        size="small"
        onClick={() => navigate('/extension')}
        sx={{ textTransform: 'none', fontWeight: 600, fontSize: 13, color: COLORS.TEXT_SECONDARY, mb: 1 }}
      >
        See how the extension works
      </Button>

      {onContinueAnyway && (
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${COLORS.BORDER_LIGHT}` }}>
          <Button
            size="small"
            onClick={onContinueAnyway}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: 12.5, color: COLORS.TEXT_MUTED }}
          >
            Continue on mobile instead
          </Button>
        </Box>
      )}
    </Box>
  );
}
