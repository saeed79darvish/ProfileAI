import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import AuthLayout from './AuthLayout';
import { GradientButton } from '@/pages/Login/styled';
import { useAuth } from '@/contexts/AuthContext';
import { hasReturningUser, clearReturningUser } from '@/utils/returningUser';
import { trackEvent } from '@/utils/analytics';

/**
 * Stands in front of the coach for a signed-out visitor on a browser that
 * has had an account on it. Their profile already exists, and a guest
 * conversation could never land on it, so it would be AI spend for nothing.
 * "Not me" is for a shared computer: it clears the mark and opens the coach.
 */
const ReturningUserGate = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [gated, setGated] = useState(() => !isAuthenticated && hasReturningUser());

  if (isAuthenticated || !gated) return children;

  const signIn = () => {
    trackEvent('coach_returning_user_gate', { choice: 'signin' });
    navigate('/login');
  };
  const startFresh = () => {
    trackEvent('coach_returning_user_gate', { choice: 'not_me' });
    clearReturningUser();
    setGated(false);
  };

  return (
    <AuthLayout>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, letterSpacing: '-0.3px' }}>
        Welcome back
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Looks like you already have an account on this device. Sign in to pick up
        your profile where you left it.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <GradientButton fullWidth size="large" onClick={signIn}>
          Sign in
        </GradientButton>
        <Button
          fullWidth
          onClick={startFresh}
          sx={{ textTransform: 'none', color: '#64748b', fontWeight: 500 }}
        >
          Not me, start a new profile
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default ReturningUserGate;
