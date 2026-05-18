import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert
} from '@mui/material';
import {
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { authAPI } from '../../services/api';
import { ROUTES, TEXT } from './constants';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      // Don't reveal if email exists or not for security
      // Backend already handles this, so just show generic success
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon 
              sx={{ fontSize: 64, color: '#22c55e', mb: 2 }} 
            />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {TEXT.SUCCESS_TITLE}
            </Typography>
            <Typography color="text.secondary" paragraph>
              If an account exists for <strong>{email}</strong>, we've sent 
              instructions to reset your password. The link will expire in 1 hour.
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {TEXT.SUCCESS_FOOTER}
            </Typography>
            <Button
              component={RouterLink}
              to={ROUTES.LOGIN}
              variant="contained"
              sx={{ mt: 2 }}
            >
              {TEXT.BACK_TO_LOGIN}
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <EmailIcon sx={{ fontSize: 48, color: '#667eea', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {TEXT.PAGE_TITLE}
            </Typography>
            <Typography color="text.secondary">
              {TEXT.PAGE_SUBTITLE}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={TEXT.EMAIL_LABEL}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !email}
              sx={{ mb: 2 }}
            >
              {loading ? TEXT.SEND_LOADING : TEXT.SEND_DEFAULT}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link 
                component={RouterLink} 
                to={ROUTES.LOGIN}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                <ArrowBackIcon fontSize="small" />
                {TEXT.BACK_TO_LOGIN}
              </Link>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
