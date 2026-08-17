import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import {
  CloudOff as CloudOffIcon,
  ErrorOutline as ErrorOutlineIcon,
  Refresh as RefreshIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { classifyApiError, describeApiError, API_ERROR_KIND } from '../../utils/apiErrorMessage';

/**
 * Full-page state for "this screen's data failed to load".
 *
 * A bare red string tells the user nothing they can act on: they can't see
 * whether the problem is theirs (offline) or ours (backend down), and their
 * only recourse is a page refresh. This says which it is and offers a retry
 * that re-runs the fetch without reloading the app.
 *
 * The copy comes from the same classifier the global banner uses, so a
 * connection failure reads identically wherever the user meets it.
 */
export default function LoadFailure({
  error,
  title = "We couldn't load this page",
  message,
  onRetry,
  retrying = false,
  children,
}) {
  const kind = error ? classifyApiError(error) : null;
  const isConnection = kind === API_ERROR_KIND.NETWORK
    || kind === API_ERROR_KIND.OFFLINE
    || kind === API_ERROR_KIND.TIMEOUT;

  // Systemic failures get the classifier's copy. For anything else the
  // backend's own message is usually the more specific one, so prefer what
  // the caller passed in.
  const described = error ? describeApiError(error) : null;
  const body = (described?.announce ? described.message : null)
    || message
    || error?.response?.data?.message
    || 'Something went wrong loading this page. Try again in a moment.';

  const Icon = isConnection ? CloudOffIcon : ErrorOutlineIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '50vh',
        px: 3,
        py: 6,
      }}
    >
      <Icon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mb: 3 }}>
        {body}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {onRetry && (
          <Button
            variant="contained"
            startIcon={<ReplayIcon />}
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? 'Retrying' : 'Try again'}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
        {children}
      </Stack>
      {described?.detail && (
        <Typography
          variant="caption"
          sx={{ mt: 2.5, color: 'text.disabled', fontFamily: 'ui-monospace, monospace' }}
        >
          {described.detail}
        </Typography>
      )}
    </Box>
  );
}
