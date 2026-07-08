import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * LinkedIn OAuth popup callback.
 *
 * LinkedIn redirects the popup here with `?code=...&state=...` (or an
 * `?error=...`). We just forward the payload to the opener window via
 * postMessage and close ourselves — the opener runs on /profile/create
 * and finishes the flow by calling /api/profiles/linkedin-oauth-prefill.
 *
 * Kept public and dependency-free (no auth checks, no data fetching) so
 * it's ready for LinkedIn to hit before the parent finishes anything.
 */
const LinkedInOAuthCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: 'profileai:linkedin-oauth',
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };

    const opener = window.opener;
    if (opener && !opener.closed) {
      try {
        opener.postMessage(payload, window.location.origin);
      } catch (_) {
        // Cross-origin write blocked — the opener will still detect the
        // popup closing via its own polling and show a friendly error.
      }
    }
    // Give the opener a tick to receive the message before we close.
    const t = window.setTimeout(() => {
      try { window.close(); } catch (_) { /* ignore */ }
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: '#fafbfc',
        p: 4,
        textAlign: 'center',
      }}
    >
      <CircularProgress sx={{ color: '#0a66c2' }} />
      <Typography sx={{ fontWeight: 600, color: '#1a1a2e' }}>
        Signing you in with LinkedIn…
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#666' }}>
        You can close this window if it doesn't close automatically.
      </Typography>
    </Box>
  );
};

export default LinkedInOAuthCallback;
