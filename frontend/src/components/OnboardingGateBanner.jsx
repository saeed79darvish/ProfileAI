import { useEffect, useState } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ONBOARDING_GATE_EVENT } from '../utils/onboardingGate';

// Global banner: shows whenever the onboarding gate blocks a navigation
// attempt by a candidate who hasn't finished their profile yet.
const OnboardingGateBanner = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(
    'Please finish creating your profile before navigating to other pages.'
  );

  useEffect(() => {
    const handler = (event) => {
      const customMessage = event?.detail?.message;
      if (customMessage) setMessage(customMessage);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_GATE_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_GATE_EVENT, handler);
  }, []);

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleContinue = () => {
    setOpen(false);
    navigate('/profile/create');
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 1500, mt: { xs: 1, md: 2 } }}
    >
      <Alert
        onClose={handleClose}
        severity="warning"
        variant="filled"
        sx={{ alignItems: 'center', boxShadow: 3 }}
        action={
          <Button color="inherit" size="small" onClick={handleContinue} sx={{ fontWeight: 700 }}>
            Create Profile
          </Button>
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default OnboardingGateBanner;
