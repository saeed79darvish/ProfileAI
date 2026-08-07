import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';

/**
 * LinkedIn OAuth popup callback.
 *
 * LinkedIn redirects the popup here with `?code=...&state=...` (or an
 * `?error=...`). We just forward the payload to the opener window via
 * postMessage and close ourselves — the opener runs on /profile/create
 * or an auth page and finishes the flow from there.
 *
 * Kept public and dependency-free (no auth checks, no data fetching) so
 * it's ready for LinkedIn to hit before the parent finishes anything.
 */
const LinkedInOAuthCallback = () => {
  const [stalled, setStalled] = useState(false);

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
    //
    // Deliberately NOT cleared on unmount: this window exists only to relay
    // the payload, so it should close even if something else in the app
    // navigates it first. Cancelling the timer on unmount is what used to
    // strand the popup open on another page with the opener still waiting.
    window.setTimeout(() => {
      try { window.close(); } catch (_) { /* ignore */ }
    }, 300);

    // window.close() is a no-op for a window the browser doesn't consider
    // script-closable (someone opening this URL directly, or a provider that
    // navigated the top-level tab). Offer a manual way out rather than
    // leaving a spinner up forever.
    const stallTimer = window.setTimeout(() => setStalled(true), 2000);
    return () => window.clearTimeout(stallTimer);
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
      {!stalled && <CircularProgress sx={{ color: '#0a66c2' }} />}
      <Typography sx={{ fontWeight: 600, color: '#1a1a2e' }}>
        {stalled ? 'All done with LinkedIn' : 'Signing you in with LinkedIn…'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#666' }}>
        {stalled
          ? 'Head back to the ProfilleAI tab to carry on.'
          : "You can close this window if it doesn't close automatically."}
      </Typography>
      {stalled && (
        <Button
          variant="contained"
          onClick={() => { try { window.close(); } catch (_) { /* ignore */ } }}
          sx={{
            mt: 1,
            textTransform: 'none',
            fontWeight: 600,
            backgroundColor: '#0a66c2',
            '&:hover': { backgroundColor: '#004182' },
          }}
        >
          Close this window
        </Button>
      )}
    </Box>
  );
};

export default LinkedInOAuthCallback;
