import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, Paper, Typography, Button } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { notifyOnboardingBlocked, isOnboardingAllowedPath } from '../utils/onboardingGate';
import { diag } from '../utils/diagLogger';

const PrivateRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, isValidating, user } = useAuth();
  const location = useLocation();

  diag('privateRoute.eval', {
    path: location.pathname,
    allowedRoles,
    isAuthenticated,
    loading,
    isValidating,
    role: user?.role,
    hasProfile: user?.hasProfile,
    emailVerified: user?.emailVerified,
  });

  if (loading) {
    diag('privateRoute.decision', { branch: 'loading-spinner', path: location.pathname });
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    diag('privateRoute.decision', { branch: 'redirect-login', path: location.pathname });
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  // Redirect unverified email users to /check-email (skip for check-email and verify-email routes)
  if (isAuthenticated && user?.emailVerified === false &&
    !location.pathname.startsWith('/check-email') &&
    !location.pathname.startsWith('/verify-email')) {
    diag('privateRoute.decision', { branch: 'redirect-check-email', path: location.pathname });
    return <Navigate to="/check-email" replace />;
  }

  // Candidates who haven't built a profile yet are nudged to finish
  // onboarding, but they're allowed to browse the jobs list and job detail
  // pages first (see utils/onboardingGate.js). The application flow and
  // other profile-dependent screens still bounce them to profile creation.
  const onboardingAllowed = isOnboardingAllowedPath(location.pathname);
  if (
    isAuthenticated &&
    user?.role === 'candidate' &&
    user?.hasProfile !== true &&
    !onboardingAllowed &&
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
    diag('privateRoute.decision', { branch: 'redirect-profile-create', path: location.pathname });
    return <Navigate to="/profile/create" replace />;
  }

  // Check if user has required role (admin only bypasses if 'admin' is explicitly allowed or no roles specified)
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    diag('privateRoute.decision', {
      branch: 'role-mismatch',
      path: location.pathname,
      userRole: user?.role,
      allowedRoles,
    });
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

  diag('privateRoute.decision', { branch: 'allow', path: location.pathname });
  return children;
};

export default PrivateRoute;
