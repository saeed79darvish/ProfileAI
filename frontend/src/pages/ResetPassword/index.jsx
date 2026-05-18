import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { authAPI } from '../../services/api';
import {
  PasswordRequirement
} from './styled';
import { ROUTES, TEXT } from './constants';

// Password strength calculation
const getPasswordStrength = (password) => {
  const checks = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password)
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;

  let strength = 'weak';
  let color = '#ef4444';
  let progress = 20;

  if (passedChecks >= 5) {
    strength = 'strong';
    color = '#22c55e';
    progress = 100;
  } else if (passedChecks >= 4) {
    strength = 'good';
    color = '#84cc16';
    progress = 80;
  } else if (passedChecks >= 3) {
    strength = 'fair';
    color = '#eab308';
    progress = 60;
  } else if (passedChecks >= 2) {
    strength = 'weak';
    color = '#f97316';
    progress = 40;
  }

  return { checks, strength, color, progress };
};

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(() => 
    getPasswordStrength(password), 
    [password]
  );

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        await authAPI.validateResetToken(token);
        setTokenValid(true);
      } catch (err) {
        setTokenValid(false);
        setError(err.response?.data?.error || TEXT.ERROR_INVALID_TOKEN);
      } finally {
        setValidating(false);
      }
    };

    if (token) {
      validateToken();
    } else {
      setValidating(false);
      setError(TEXT.ERROR_NO_TOKEN);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(TEXT.ERROR_MISMATCH);
      return;
    }

    const { checks } = passwordStrength;
    if (!checks.minLength || !checks.hasLowercase || !checks.hasUppercase || 
        !checks.hasNumber || !checks.hasSpecial) {
      setError(TEXT.ERROR_REQUIREMENTS);
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_RESET);
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4, textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography color="text.secondary">
            {TEXT.VALIDATING}
          </Typography>
        </Box>
      </Container>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {TEXT.INVALID_TITLE}
            </Typography>
            <Typography color="text.secondary" paragraph>
              {error || TEXT.INVALID_MESSAGE}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {TEXT.INVALID_HELP}
            </Typography>
            <Button
              component={RouterLink}
              to={ROUTES.FORGOT_PASSWORD}
              variant="contained"
              sx={{ mt: 2 }}
            >
              {TEXT.REQUEST_NEW_LINK}
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Success state
  if (success) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {TEXT.SUCCESS_TITLE}
            </Typography>
            <Typography color="text.secondary" paragraph>
              {TEXT.SUCCESS_MESSAGE}
            </Typography>
            <Button
              component={RouterLink}
              to={ROUTES.LOGIN}
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
            >
              {TEXT.GO_TO_LOGIN}
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Reset password form
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <LockIcon sx={{ fontSize: 48, color: '#667eea', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {TEXT.FORM_TITLE}
            </Typography>
            <Typography color="text.secondary">
              {TEXT.FORM_SUBTITLE}
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
              label={TEXT.NEW_PASSWORD}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              sx={{ mb: 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            {password && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={passwordStrength.progress} 
                    sx={{ 
                      flexGrow: 1, 
                      height: 6, 
                      borderRadius: 3,
                      backgroundColor: '#e5e7eb',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: passwordStrength.color,
                        borderRadius: 3
                      }
                    }} 
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: passwordStrength.color, 
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      minWidth: 50
                    }}
                  >
                    {passwordStrength.strength}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                  <PasswordRequirement met={passwordStrength.checks.minLength}>
                    {passwordStrength.checks.minLength ? <CheckIcon /> : <CloseIcon />}
                    {TEXT.REQ_MIN_LENGTH}
                  </PasswordRequirement>
                  <PasswordRequirement met={passwordStrength.checks.hasLowercase}>
                    {passwordStrength.checks.hasLowercase ? <CheckIcon /> : <CloseIcon />}
                    {TEXT.REQ_LOWERCASE}
                  </PasswordRequirement>
                  <PasswordRequirement met={passwordStrength.checks.hasUppercase}>
                    {passwordStrength.checks.hasUppercase ? <CheckIcon /> : <CloseIcon />}
                    {TEXT.REQ_UPPERCASE}
                  </PasswordRequirement>
                  <PasswordRequirement met={passwordStrength.checks.hasNumber}>
                    {passwordStrength.checks.hasNumber ? <CheckIcon /> : <CloseIcon />}
                    {TEXT.REQ_NUMBER}
                  </PasswordRequirement>
                  <PasswordRequirement met={passwordStrength.checks.hasSpecial}>
                    {passwordStrength.checks.hasSpecial ? <CheckIcon /> : <CloseIcon />}
                    {TEXT.REQ_SPECIAL}
                  </PasswordRequirement>
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label={TEXT.CONFIRM_PASSWORD}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              error={confirmPassword && password !== confirmPassword}
              helperText={confirmPassword && password !== confirmPassword ? TEXT.MISMATCH_HELPER : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? TEXT.BUTTON_LOADING : TEXT.BUTTON_SUBMIT}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
