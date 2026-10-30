import React from 'react';
import {
  Box, Paper, Typography, Button, Stack, Collapse, TextField, Divider, Alert, CircularProgress,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import * as Sentry from '@sentry/react';
import { diag } from '../utils/diagLogger';
import { supportAPI } from '../services/api';

// eslint-disable-next-line no-undef
const BUILD = typeof __BUILD_TIME__ !== 'undefined' ? String(__BUILD_TIME__) : null;

/**
 * Top-level error boundary for catching render-time errors in lazy-loaded
 * routes. Without this, a thrown error inside a Suspense boundary unmounts
 * the entire tree to a blank #root, which is indistinguishable from a
 * routing or network failure to the user.
 *
 * Pass `resetKey` (App passes the pathname) so navigating away from a broken
 * route clears the error instead of leaving the fallback pinned over every
 * subsequent page — the Navbar renders outside this boundary, so its links
 * still work while the fallback is up.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      // Stack traces are for us, not for the person using the app. Open by
      // default in dev; one click away in prod.
      showDetails: !!import.meta.env.DEV,
      copied: false,
      note: '',
      email: '',
      // idle | sending | sent | failed
      report: 'idle',
      reportRef: null,
    };
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
    // This boundary sits inside the root Sentry boundary, so catching here
    // would otherwise swallow the report.
    try {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo?.componentStack } },
      });
    } catch { /* Sentry not initialised (local dev) */ }
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
          build: BUILD,
        })
      );
    } catch { /* ignore quota / storage errors */ }
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false, error: null, errorInfo: null, copied: false,
      note: '', email: '', report: 'idle', reportRef: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  errorText = () => (
    String(this.state.error?.message || this.state.error) + '\n\n' +
    (this.state.error?.stack || '') +
    (this.state.errorInfo?.componentStack
      ? '\n\nComponent stack:' + this.state.errorInfo.componentStack
      : '')
  );

  handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.errorText());
      this.setState({ copied: true });
    } catch { /* clipboard blocked — the text is on screen anyway */ }
  };

  // One click files a bug ticket with the error attached, so nobody has to
  // copy a stack trace into an email. Guests can send it too; most crashes
  // happen before anyone registers.
  handleSendReport = async () => {
    this.setState({ report: 'sending' });
    try {
      const { data } = await supportAPI.crashReport({
        error: this.errorText().slice(0, 8000),
        note: this.state.note.trim() || undefined,
        email: this.state.email.trim() || undefined,
        url: window.location.href,
        build: BUILD || undefined,
      });
      this.setState({ report: 'sent', reportRef: data?.ticket?.reference || null });
    } catch {
      this.setState({ report: 'failed' });
    }
  };

  renderReport() {
    const { report, reportRef, note, email } = this.state;
    if (report === 'sent') {
      return (
        <Alert severity="success" sx={{ textAlign: 'left' }}>
          Thanks, we got it{reportRef ? ` (reference ${reportRef})` : ''}.
          {email.trim() ? ' We\u2019ll email you when it\u2019s fixed.' : ' We\u2019ll get on it.'}
        </Alert>
      );
    }
    let signedIn = false;
    try { signedIn = !!localStorage.getItem('token'); } catch { /* storage blocked */ }
    const sending = report === 'sending';
    return (
      <Stack spacing={1.5} sx={{ textAlign: 'left' }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Help us fix this
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send us a report and the technical details come along automatically.
            A line about what you were doing helps a lot.
          </Typography>
        </Box>
        <TextField
          size="small"
          multiline
          minRows={2}
          placeholder="What were you doing when this happened? (optional)"
          value={note}
          onChange={(e) => this.setState({ note: e.target.value.slice(0, 2000) })}
          disabled={sending}
        />
        {!signedIn && (
          <TextField
            size="small"
            type="email"
            placeholder="Your email, if you'd like to hear back (optional)"
            value={email}
            onChange={(e) => this.setState({ email: e.target.value })}
            disabled={sending}
          />
        )}
        {report === 'failed' && (
          <Alert severity="warning">
            We couldn't send that. Try again, or copy the details below and email
            them to support@profilleai.com.
          </Alert>
        )}
        <Box>
          <Button
            variant="contained"
            color="secondary"
            startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={this.handleSendReport}
            disabled={sending}
          >
            {sending ? 'Sending' : 'Send report'}
          </Button>
        </Box>
      </Stack>
    );
  }

  render() {
    if (this.state.hasError) {
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
              We hit an unexpected error rendering this page. Try again, or head
              back to the home page if it keeps happening.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<ReplayIcon />}
                onClick={this.handleReset}
              >
                Try again
              </Button>
              <Button
                variant="outlined"
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
            {this.state.error && (
              <>
                <Divider sx={{ my: 3 }} />
                {this.renderReport()}
              </>
            )}
            {this.state.error && (
              <Box sx={{ mt: 3 }}>
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  >
                    {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                  </Button>
                  <Button size="small" color="inherit" onClick={this.handleCopy}>
                    {this.state.copied ? 'Copied' : 'Copy details'}
                  </Button>
                </Stack>
                <Collapse in={this.state.showDetails}>
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
                      mt: 1,
                      maxHeight: 320,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.errorText()}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
