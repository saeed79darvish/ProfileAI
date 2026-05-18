import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Button, Paper, Container } from '@mui/material';
import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { syncAuthToExtension, getReturnUrl } from '../../utils/extensionBridge';
import { ROUTES, TEXT, TIMINGS } from './constants';

const ExtensionAuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const [synced, setSynced] = useState(false);
  const [countdown, setCountdown] = useState(TIMINGS.COUNTDOWN_INITIAL);
  
  // Get return URL from query params or from extensionBridge
  const returnUrl = searchParams.get('returnUrl') || getReturnUrl();

  useEffect(() => {
    // Sync auth to extension
    if (token && user) {
      syncAuthToExtension(token, user).then(() => {
        setSynced(true);
      });
    }
  }, [token, user]);

  useEffect(() => {
    // Countdown timer
    if (synced && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), TIMINGS.COUNTDOWN_INTERVAL_MS);
      return () => clearTimeout(timer);
    } else if (synced && countdown === 0) {
      // Try to close the tab, or redirect to profile
      try {
        window.close();
      } catch (e) {
        // Can't close programmatically, redirect instead
        navigate(ROUTES.PROFILE);
      }
    }
  }, [synced, countdown, navigate]);

  const handleGoBack = () => {
    // Use return URL if available
    if (returnUrl) {
      window.location.href = returnUrl;
      return;
    }
    
    // Try to go back to the previous page (job application)
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleGoToProfile = () => {
    navigate(ROUTES.PROFILE);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={8}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 4,
            background: 'white'
          }}
        >
          {!synced ? (
            <>
              <CircularProgress size={60} sx={{ color: '#667eea', mb: 3 }} />
              <Typography variant="h5" gutterBottom fontWeight={600}>
                {TEXT.CONNECTING_TITLE}
              </Typography>
              <Typography color="text.secondary">
                {TEXT.CONNECTING_SUBTITLE}
              </Typography>
            </>
          ) : (
            <>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}
              >
                <CheckIcon sx={{ fontSize: 48, color: 'white' }} />
              </Box>
              
              <Typography variant="h4" gutterBottom fontWeight={700}>
                {TEXT.CONNECTED_TITLE}
              </Typography>
              
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Welcome, {user?.firstName || 'there'}! 🎉
              </Typography>
              
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                {TEXT.EXTENSION_READY}
                <br />
                Return to your job application and click <strong>"Autofill"</strong> to get started!
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleGoBack}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                    }
                  }}
                >
                  {TEXT.BACK_TO_APPLICATION}
                </Button>
                
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleGoToProfile}
                  sx={{
                    borderColor: '#667eea',
                    color: '#667eea',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    '&:hover': {
                      borderColor: '#5a6fd6',
                      background: 'rgba(102, 126, 234, 0.05)'
                    }
                  }}
                >
                  {TEXT.SETUP_PROFILE}
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                This window will close automatically in {countdown} seconds...
              </Typography>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default ExtensionAuthSuccess;
