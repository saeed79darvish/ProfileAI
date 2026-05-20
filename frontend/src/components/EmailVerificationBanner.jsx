import { useState } from 'react';
import { Alert, Button, Box } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/services/api';

/**
 * Persistent banner shown to logged-in users whose email is not yet verified.
 * Lets them resend the verification link. Hidden once verified.
 */
const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState(null); // null | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      await authAPI.resendVerification();
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Could not resend verification email.');
      setStatus('error');
    }
  };

  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 1100 }}>
      <Alert
        severity={status === 'sent' ? 'success' : 'warning'}
        action={
          status === 'sent' ? null : (
            <Button
              color="inherit"
              size="small"
              onClick={handleResend}
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Resend email'}
            </Button>
          )
        }
        sx={{ borderRadius: 0 }}
      >
        {status === 'sent'
          ? `Verification email sent to ${user.email}. Check your inbox.`
          : status === 'error'
          ? errorMsg
          : `Please verify your email (${user.email}) to unlock all features.`}
      </Alert>
    </Box>
  );
};

export default EmailVerificationBanner;
