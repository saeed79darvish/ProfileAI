import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Button, Tabs, Tab, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  DeleteOutline as DeleteIcon,
  Bookmark as BookmarkIcon,
  PhoneIphone as PhoneIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { bookmarkletAPI } from '../../services/api';
import { buildBookmarkletUri } from '../../config/bookmarklet';
import { useToast } from '../../contexts/ToastContext';
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../../designTokens';

const IOS_STEPS = [
  'Tap the Share icon in Safari on this page, then "Add Bookmark" and save it.',
  'Open Bookmarks, swipe left on your new bookmark, and tap "Edit".',
  'Change the name to "ProfileAI" and replace the address with the code you copied above.',
  'Tap Done. Open a job application and tap the "ProfileAI" bookmark to run it.',
];

const ANDROID_STEPS = [
  'Tap the ⋮ menu in Chrome and choose "Add to bookmarks" on any page.',
  'Open Bookmarks (⋮ menu → Bookmarks), find it, and tap Edit.',
  'Change the name to "ProfileAI" and replace the URL with the code you copied above.',
  'Tap Save. Open a job application and tap the "ProfileAI" bookmark to run it.',
];

function PhoneMock({ children }) {
  return (
    <Box sx={{
      width: 132, flexShrink: 0, borderRadius: '18px', border: `3px solid ${COLORS.TEXT_PRIMARY}`,
      background: '#fff', p: 1, boxShadow: SHADOWS.CARD,
    }}>
      <Box sx={{ height: 6, width: 32, mx: 'auto', mb: 0.75, borderRadius: 3, background: COLORS.BORDER_DEFAULT }} />
      {children}
    </Box>
  );
}

function StepRow({ index, text, phoneContent }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2.5 }}>
      <PhoneMock>{phoneContent}</PhoneMock>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box sx={{
          width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: GRADIENTS.PRIMARY,
          color: '#fff', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {index}
        </Box>
        <Typography sx={{ fontSize: 13.5, color: COLORS.TEXT_PRIMARY, lineHeight: 1.5 }}>{text}</Typography>
      </Box>
    </Box>
  );
}

const IOS_PHONE_CONTENT = [
  <Box key="1" sx={{ height: 70, borderRadius: '8px', background: COLORS.BG_LIGHT, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
    <Box sx={{ width: '80%', height: 18, borderRadius: '6px', background: '#fff', border: `1px solid ${COLORS.BORDER_LIGHT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: COLORS.TEXT_MUTED }}>
      Add Bookmark ⬆
    </Box>
  </Box>,
  <Box key="2" sx={{ height: 70, borderRadius: '8px', background: COLORS.BG_LIGHT, p: 0.75 }}>
    {['ProfileAI', 'Google', 'LinkedIn'].map((l, i) => (
      <Box key={l} sx={{ fontSize: 8, py: 0.4, color: i === 0 ? COLORS.PRIMARY : COLORS.TEXT_MUTED, fontWeight: i === 0 ? 700 : 400 }}>{l} {i === 0 && '✎'}</Box>
    ))}
  </Box>,
  <Box key="3" sx={{ height: 70, borderRadius: '8px', background: COLORS.BG_LIGHT, p: 0.75, fontSize: 7.5 }}>
    <Box sx={{ color: COLORS.TEXT_MUTED, mb: 0.5 }}>Name</Box>
    <Box sx={{ background: '#fff', borderRadius: '4px', px: 0.5, py: 0.3, mb: 0.75, fontWeight: 700, color: COLORS.PRIMARY }}>ProfileAI</Box>
    <Box sx={{ color: COLORS.TEXT_MUTED, mb: 0.5 }}>Address</Box>
    <Box sx={{ background: '#fff', borderRadius: '4px', px: 0.5, py: 0.3, color: COLORS.TEXT_MUTED }}>javascript:(function(...</Box>
  </Box>,
  <Box key="4" sx={{ height: 70, borderRadius: '8px', background: GRADIENTS.PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <CheckIcon sx={{ color: '#fff', fontSize: 26 }} />
  </Box>,
];

const ANDROID_PHONE_CONTENT = IOS_PHONE_CONTENT;

export default function MobileApply() {
  const toast = useToast();
  const [platform, setPlatform] = useState('ios');
  const [pairing, setPairing] = useState(false);
  const [freshToken, setFreshToken] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);

  const loadTokens = () => {
    setLoadingTokens(true);
    bookmarkletAPI.getTokens()
      .then((res) => setTokens(res.data?.tokens || []))
      .catch(() => toast.error('Could not load your bookmarklets'))
      .finally(() => setLoadingTokens(false));
  };

  useEffect(() => { loadTokens(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = () => {
    setPairing(true);
    bookmarkletAPI.pair('Mobile bookmarklet')
      .then((res) => {
        setFreshToken(res.data.token);
        loadTokens();
      })
      .catch((err) => toast.error(err.response?.data?.error || 'Failed to create bookmarklet'))
      .finally(() => setPairing(false));
  };

  // iOS Safari (and some in-app/webview browsers) can silently reject or
  // simply not implement navigator.clipboard.writeText depending on how the
  // page was opened. Fall back to the legacy execCommand technique, and if
  // even that fails, tell the user to select the code manually instead of
  // just failing silently — the code box below is always fully selectable.
  const handleCopy = async () => {
    if (!freshToken) return;
    const text = buildBookmarkletUri(freshToken);

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Code copied, paste it into your new bookmark’s address field');
        return;
      } catch {
        // fall through to the legacy method below
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copied) {
        toast.success('Code copied — paste it into your new bookmark’s address field');
        return;
      }
    } catch {
      // fall through to manual-copy guidance below
    }

    toast.error('Automatic copy isn’t supported here — press and hold the code below, then choose Copy');
  };

  const handleRevoke = (id) => {
    bookmarkletAPI.revokeToken(id)
      .then(() => { toast.success('Bookmarklet revoked'); loadTokens(); })
      .catch(() => toast.error('Failed to revoke bookmarklet'));
  };

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS;
  const phoneContent = platform === 'ios' ? IOS_PHONE_CONTENT : ANDROID_PHONE_CONTENT;
  const activeTokens = tokens.filter((t) => !t.revokedAt);

  return (
    <Box sx={{ background: COLORS.BG_LIGHT, minHeight: '100vh', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="sm">
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, sm: 28 }, color: COLORS.TEXT_PRIMARY, mb: 1 }}>
          Mobile bookmarklet
        </Typography>
        <Typography sx={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, mb: 4 }}>
          A lighter, mobile-only alternative to the Chrome extension. Save it once, then tap it on
          any job application to detect the questions and fill in AI-generated answers for you to review.
        </Typography>

        {/* Step 1: create */}
        <Box sx={{ borderRadius: RADIUS.XXL, background: COLORS.BG_WHITE, boxShadow: SHADOWS.CARD, p: 3, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1.5 }}>1. Get your bookmarklet</Typography>
          {!freshToken ? (
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={pairing}
              startIcon={pairing ? <CircularProgress size={16} color="inherit" /> : <BookmarkIcon />}
              sx={{ background: GRADIENTS.PRIMARY, textTransform: 'none', fontWeight: 700, borderRadius: RADIUS.MEDIUM, px: 3 }}
            >
              {pairing ? 'Creating…' : 'Create my bookmarklet'}
            </Button>
          ) : (
            <>
              <Box
                component="textarea"
                readOnly
                value={buildBookmarkletUri(freshToken)}
                onFocus={(e) => e.target.select()}
                sx={{
                  width: '100%', minHeight: 72, p: '10px 12px', borderRadius: RADIUS.MEDIUM,
                  background: COLORS.BG_LIGHT, border: `1px solid ${COLORS.BORDER_LIGHT}`, mb: 1,
                  fontFamily: 'monospace', fontSize: 11.5, color: COLORS.TEXT_SECONDARY,
                  resize: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              />
              <Typography sx={{ fontSize: 11.5, color: COLORS.TEXT_MUTED, mb: 1.5 }}>
                If the "Copy code" button below doesn't work, tap the code above, then use your
                keyboard's Select All and Copy.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCopy}
                startIcon={<CopyIcon />}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: RADIUS.MEDIUM }}
              >
                Copy code
              </Button>
              <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED, mt: 1 }}>
                This code is shown once. If you lose it, come back here and create a new one.
              </Typography>
            </>
          )}
        </Box>

        {/* Step 2: install instructions */}
        <Box sx={{ borderRadius: RADIUS.XXL, background: COLORS.BG_WHITE, boxShadow: SHADOWS.CARD, p: 3, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1.5 }}>2. Save it to your phone</Typography>
          <Tabs
            value={platform}
            onChange={(e, v) => setPlatform(v)}
            sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600, fontSize: 13.5 } }}
          >
            <Tab value="ios" label="iOS Safari" icon={<PhoneIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab value="android" label="Android Chrome" icon={<PhoneIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          </Tabs>
          {steps.map((text, i) => (
            <StepRow key={text} index={i + 1} text={text} phoneContent={phoneContent[i]} />
          ))}
        </Box>

        {/* Step 3: your bookmarklets */}
        <Box sx={{ borderRadius: RADIUS.XXL, background: COLORS.BG_WHITE, boxShadow: SHADOWS.CARD, p: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1.5 }}>Your bookmarklets</Typography>
          {loadingTokens ? (
            <CircularProgress size={20} />
          ) : activeTokens.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: COLORS.TEXT_MUTED }}>
              No active bookmarklets yet — create one above.
            </Typography>
          ) : (
            activeTokens.map((t) => (
              <Box key={t.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                borderBottom: `1px solid ${COLORS.BORDER_LIGHT}`,
                '&:last-of-type': { borderBottom: 'none' },
              }}>
                <BookmarkIcon sx={{ fontSize: 18, color: COLORS.PRIMARY, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: COLORS.TEXT_PRIMARY }}>{t.label}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: COLORS.TEXT_MUTED }}>
                    {t.lastUsedAt
                      ? `Last used ${formatDistanceToNow(new Date(t.lastUsedAt), { addSuffix: true })}${t.lastUsedOrigin ? ` on ${new URL(t.lastUsedOrigin).hostname}` : ''}`
                      : `Created ${formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })} — not used yet`}
                  </Typography>
                </Box>
                <Tooltip title="Revoke">
                  <IconButton size="small" onClick={() => handleRevoke(t.id)}>
                    <DeleteIcon sx={{ fontSize: 18, color: COLORS.ERROR }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Box>

        <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED, mt: 3, textAlign: 'center' }}>
          Some sites block the bookmarklet from running — it'll tell you when that happens.
          For the widest site coverage, the Chrome extension on desktop still works best.
        </Typography>
      </Container>
    </Box>
  );
}
