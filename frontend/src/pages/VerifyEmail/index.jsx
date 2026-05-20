import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button, Alert, CircularProgress, Link } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AuthLayout from '@/components/AuthLayout';
import { authAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }
      try {
        const { data } = await authAPI.verifyEmail(token);
        if (cancelled) return;
        setStatus('success');
        setMessage(data?.message || 'Your email has been verified.');
        if (typeof refreshUser === 'function') {
          try { await refreshUser(); } catch (_) { /* non-blocking */ }
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Verification failed. The link may be invalid or expired.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, refreshUser]);

  const goHome = () => {
    if (user?.role === 'recruiter') navigate('/recruiter/onboarding');
    else if (user?.role === 'admin') navigate('/admin');
    else if (user) navigate('/onboarding');
    else navigate('/login');
  };

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
            <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>
            <Button variant="contained" fullWidth onClick={goHome}>
              {user ? 'Continue' : 'Go to login'}
            </Button>
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
