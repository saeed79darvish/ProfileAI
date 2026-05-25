import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, Paper, Typography, Button } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { notifyOnboardingBlocked } from '../utils/onboardingGate';

const PrivateRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, isValidating, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  // Redirect unverified email users to /check-email (skip for check-email and verify-email routes)
  if (isAuthenticated && user?.emailVerified === false &&
    !location.pathname.startsWith('/check-email') &&
    !location.pathname.startsWith('/verify-email')) {
    return <Navigate to="/check-email" replace />;
  }

  // Candidates who haven't built a profile yet must finish onboarding first.
  // No matter which protected route they refresh on (/profile, /jobs, /feed,
  // etc.) we route them back to the profile-creation flow so they can't get
  // stuck on a screen that depends on an existing profile.
  // NOTE: keep in sync with utils/onboardingGate.js ALLOWED_PREFIXES.
  const ONBOARDING_ALLOWED_PREFIXES = [
    '/profile/create',
    '/profile/create-form',
    '/profile/preferences',
    '/onboarding',
    '/check-email',
    '/verify-email',
    '/terms',
    '/privacy',
    '/logout',
  ];
  const isOnboardingAllowedPath = ONBOARDING_ALLOWED_PREFIXES.some((p) =>
    location.pathname === p || location.pathname.startsWith(p)
  );
  if (
    isAuthenticated &&
    user?.role === 'candidate' &&
    user?.hasProfile !== true &&
    !isOnboardingAllowedPath &&
    // Defer the onboarding redirect while we're still revalidating the
    // cached user via /auth/me. The localStorage snapshot may be missing
    // `hasProfile` (older sessions, partial OAuth payload) and we don't
    // want to bounce candidates off /profile during the validation window.
    !isValidating
  ) {
    // Surface a toast so the user understands why they're being bounced
    // back, instead of silently redirecting them. Fired as a side-effect
    // (not during render) to satisfy React's rules.
    notifyOnboardingBlocked(location.pathname);
    return <Navigate to="/profile/create" replace />;
  }

  // Check if user has required role (admin only bypasses if 'admin' is explicitly allowed or no roles specified)
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // User is authenticated but doesn't have permission
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh',
        bgcolor: 'grey.50',
        p: 3
      }}>
        <Paper sx={{ p: 5, maxWidth: 500, textAlign: 'center' }}>
          <LockIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            This area is for {allowedRoles.join(' and ')}s only. 
            {user.role === 'candidate' && ' As a candidate, you can browse jobs and manage your profile.'}
            {user.role === 'recruiter' && ' As a recruiter, you can post jobs and find candidates.'}
            {user.role === 'admin' && ' As an admin, you can manage the platform from the admin panel.'}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.href = user.role === 'admin' ? '/admin' : user.role === 'recruiter' ? '/recruiter/dashboard' : '/profile'}
            sx={{ mt: 2 }}
          >
            Go to My Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return children;
};

export default PrivateRoute;
