import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES, TEXT, STORAGE_KEYS, TIMINGS } from './constants';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, success, error

  useEffect(() => {
    const subscription = searchParams.get('subscription');
    
    if (subscription === 'success') {
      setStatus('success');
      // Check if we should return to a specific page after upgrade
      const returnPath = sessionStorage.getItem(STORAGE_KEYS.UPGRADE_RETURN_PATH);
      
      // Reload user data after 2 seconds, then navigate to return path or profile
      setTimeout(() => {
        if (returnPath) {
          window.location.href = returnPath;
        } else {
          window.location.href = ROUTES.PROFILE;
        }
      }, TIMINGS.REDIRECT_DELAY_MS);
    } else if (subscription === 'cancelled') {
      setStatus('cancelled');
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center', width: '100%' }}>
          {status === 'loading' && (
            <>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                {TEXT.PROCESSING}
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <SuccessIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {TEXT.WELCOME_TITLE}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {TEXT.SUCCESS_MESSAGE}
                {sessionStorage.getItem(STORAGE_KEYS.UPGRADE_RETURN_PATH) 
                  ? TEXT.REDIRECTING_BACK
                  : TEXT.REDIRECTING_DASHBOARD}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => {
                  const returnPath = sessionStorage.getItem(STORAGE_KEYS.UPGRADE_RETURN_PATH);
                  if (returnPath) {
                    window.location.href = returnPath;
                  } else {
                    navigate(ROUTES.PROFILE);
                  }
                }}
              >
                {sessionStorage.getItem(STORAGE_KEYS.UPGRADE_RETURN_PATH) ? TEXT.CONTINUE : TEXT.GO_TO_PROFILE}
              </Button>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <ErrorIcon color="warning" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {TEXT.CANCELLED_TITLE}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {TEXT.CANCELLED_MESSAGE}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(ROUTES.PRICING)}
              >
                {TEXT.BACK_TO_PRICING}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                {TEXT.ERROR_TITLE}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {TEXT.ERROR_MESSAGE}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(ROUTES.PRICING)}
              >
                {TEXT.TRY_AGAIN}
              </Button>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default SubscriptionSuccess;
