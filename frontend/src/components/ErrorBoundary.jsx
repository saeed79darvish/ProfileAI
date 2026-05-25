import React from 'react';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { diag } from '../utils/diagLogger';

/**
 * Top-level error boundary for catching render-time errors in lazy-loaded
 * routes. Without this, a thrown error inside a Suspense boundary unmounts
 * the entire tree to a blank #root, which is indistinguishable from a
 * routing or network failure to the user.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    diag('errorBoundary.caught', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
    // Persist to localStorage so prod crashes are diagnosable even when
    // the console gets cleared, filtered, or the user can't paste it back.
    try {
      localStorage.setItem(
        'profileai_last_error',
        JSON.stringify({
          message: error?.message || String(error),
          stack: error?.stack || null,
          componentStack: errorInfo?.componentStack || null,
          url: window.location.href,
          ts: new Date().toISOString(),
        })
      );
    } catch { /* ignore quota / storage errors */ }
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Show the error details inline in ALL environments. Without this,
      // prod crashes (e.g. refresh-on-/profile) are undiagnosable because
      // the console is filtered/cleared by the time we look at it.
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh',
            p: 3,
            bgcolor: 'grey.50',
          }}
        >
          <Paper
            elevation={3}
            sx={{ p: { xs: 3, md: 5 }, maxWidth: 560, textAlign: 'center', borderRadius: 3 }}
          >
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We hit an unexpected error rendering this page. Try refreshing — if
              the problem persists, head back to the home page.
            </Typography>
            {this.state.error && (
              <Box
                component="pre"
                sx={{
                  textAlign: 'left',
                  bgcolor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  fontSize: 11,
                  lineHeight: 1.4,
                  overflowX: 'auto',
                  mb: 3,
                  maxHeight: 320,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {String(this.state.error?.message || this.state.error) + '\n\n' +
                  (this.state.error?.stack || '') +
                  (this.state.errorInfo?.componentStack
                    ? '\n\nComponent stack:' + this.state.errorInfo.componentStack
                    : '')}
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
              >
                Refresh page
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go home
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
