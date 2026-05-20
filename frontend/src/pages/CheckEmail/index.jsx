import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, CircularProgress, TextField } from '@mui/material';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import AuthLayout from '@/components/AuthLayout';
import { authAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

const CheckEmail = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [resendStatus, setResendStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [resendError, setResendError] = useState('');
  const [checking, setChecking] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('idle'); // 'idle' | 'verifying' | 'error'
  const [verifyError, setVerifyError] = useState('');

  // If already verified, redirect immediately
  useEffect(() => {
    if (user?.emailVerified) {
      const dest = user.role === 'recruiter' ? '/recruiter/onboarding' : '/onboarding';
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  const handleResend = async () => {
    setResendStatus('sending');
    setResendError('');
    try {
      const { data } = await authAPI.resendVerification();
      if (data?.verifyUrl) {
        setVerifyInput(data.verifyUrl);
      }
      setResendStatus('sent');
    } catch (err) {
      setResendError(err?.response?.data?.error || 'Failed to resend. Please try again.');
      setResendStatus('error');
    }
  };

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    try {
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }
    } catch (_) { /* non-blocking */ }
    setChecking(false);
  }, [refreshUser]);

  const extractToken = (value) => {
    const raw = (value || '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      const verifyIdx = parts.indexOf('verify-email');
      if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
        return decodeURIComponent(parts[verifyIdx + 1]);
      }
    } catch (_) {
      // Not a URL, treat as token/code.
    }

    return raw;
  };

  const handleVerifyWithCode = async () => {
    const token = extractToken(verifyInput);
    if (!token) {
      setVerifyError('Paste the verification link or code first.');
      setVerifyStatus('error');
      return;
    }

    setVerifyStatus('verifying');
    setVerifyError('');
    try {
      await authAPI.verifyEmail(token);
      if (typeof refreshUser === 'function') {
        await refreshUser();
      }
    } catch (err) {
      setVerifyError(err?.response?.data?.error || 'Invalid or expired verification code.');
      setVerifyStatus('error');
      return;
    }
    setVerifyStatus('idle');
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <MarkEmailReadOutlinedIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />

        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          Check your inbox
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We sent a verification link to{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {user?.email || 'your email'}
          </Box>
          . Click the link to verify your account and continue.
        </Typography>

        {resendStatus === 'sent' && (
          <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
            Verification email resent. Check inbox/spam. In development, the verification link is auto-filled below.
          </Alert>
        )}
        {resendStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {resendError}
          </Alert>
        )}

        {verifyStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {verifyError}
          </Alert>
        )}

        <TextField
          fullWidth
          size="small"
          placeholder="Paste verification link or code"
          value={verifyInput}
          onChange={(e) => setVerifyInput(e.target.value)}
          sx={{ mb: 1.5 }}
        />

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleVerifyWithCode}
          disabled={verifyStatus === 'verifying'}
          sx={{ mb: 1.5, textTransform: 'none', fontWeight: 600 }}
        >
          {verifyStatus === 'verifying' ? <CircularProgress size={20} color="inherit" /> : 'Verify with code'}
        </Button>

        <Button
          variant="text"
          fullWidth
          size="large"
          onClick={handleCheckNow}
          disabled={checking}
          sx={{ mb: 1.5, textTransform: 'none', fontWeight: 600 }}
        >
          {checking ? <CircularProgress size={20} color="inherit" /> : 'I already clicked the email link (refresh status)'}
        </Button>

        <Button
          variant="outlined"
          fullWidth
          size="large"
          onClick={handleResend}
          disabled={resendStatus === 'sending' || resendStatus === 'sent'}
          sx={{ mb: 3, textTransform: 'none' }}
        >
          {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
        </Button>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}
          onClick={handleSignOut}
        >
          Wrong email address?{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
            Sign out
          </Box>
        </Typography>
      </Box>
    </AuthLayout>
  );
};

export default CheckEmail;
