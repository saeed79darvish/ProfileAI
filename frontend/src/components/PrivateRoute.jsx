import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, Paper, Typography, Button } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

const PrivateRoute = ({ children, allowedRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();
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
