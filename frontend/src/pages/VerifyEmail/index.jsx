import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress, Link } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AuthLayout from '@/components/AuthLayout';
import { authAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const authDebugEnabled =
    window.location.search.includes('authDebug=1') ||
    localStorage.getItem('profileai_auth_debug') === '1';
  const authDebug = (...args) => {
    if (authDebugEnabled) console.log('[AUTH_FLOW][VerifyEmail]', ...args);
  };
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      authDebug('verify page mounted', { hasToken: !!token, tokenLength: token?.length || 0 });
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }
      try {
        const { data } = await authAPI.verifyEmail(token);
        if (cancelled) return;
        authDebug('verifyEmail API success', { responseMessage: data?.message || null });
        setStatus('success');
        setMessage(data?.message || 'Your email has been verified.');
        let refreshed = null;
        if (typeof refreshUser === 'function') {
          try {
            refreshed = await refreshUser();
            authDebug('refreshUser after verify', {
              role: refreshed?.role,
              emailVerified: refreshed?.emailVerified,
              hasProfile: refreshed?.hasProfile
            });
          } catch (_) { /* non-blocking */ }
        }
        if (cancelled) return;
        // Auto-navigate using the freshly refreshed user. This matches the
        // paste-code flow on /check-email and avoids relying on the stale
        // `user` snapshot captured at Continue-click time.
        const effective = refreshed || user;
        const dest = effective?.role === 'recruiter'
          ? '/recruiter/onboarding'
          : effective?.role === 'admin'
            ? '/admin'
            : effective
              ? '/onboarding'
              : '/login?redirect=/onboarding';
        authDebug('auto-redirect after verify', {
          dest,
          role: effective?.role,
          emailVerified: effective?.emailVerified,
          hasProfile: effective?.hasProfile,
          usedRefreshed: !!refreshed
        });
        // Brief delay so the user sees the success state before redirect.
        setTimeout(() => {
          if (!cancelled) navigate(dest, { replace: true });
        }, 900);
      } catch (err) {
        if (cancelled) return;
        authDebug('verifyEmail API error', {
          status: err?.response?.status,
          message: err?.response?.data?.error || err?.message
        });
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Verification failed. The link may be invalid or expired.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, refreshUser]);

  return (
    <AuthLayout>
      <Box sx={{ textAlign: 'center', py: 2 }}>
        {status === 'loading' && (
          <>
            <CircularProgress />
            <Typography variant="h6" sx={{ mt: 2 }}>Verifying your email…</Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />
            <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>Email verified</Typography>
            <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>
            <Typography variant="body2" color="text.secondary">
              Redirecting you now…
            </Typography>
          </>
        )}

        {status === 'error' && (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>Verification failed</Typography>
            <Alert severity="error" sx={{ mb: 3 }}>{message}</Alert>
            {user ? (
              <Typography variant="body2" color="text.secondary">
                You can request a new verification link from your account.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Please <Link component={RouterLink} to="/login">log in</Link> and request a new verification link.
              </Typography>
            )}
          </>
        )}
      </Box>
    </AuthLayout>
  );
};

export default VerifyEmail;
