import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  Divider,
  IconButton,
  InputAdornment
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/services/api';
import AuthLayout, { MobileStickyFooter } from '@/components/AuthLayout';
import { isFromExtension, handleExtensionAuthSuccess } from '@/utils/extensionBridge';
import {
  GradientButton,
  inputSx,
  titleSx,
  subtitleSx,
  alertSx,
  socialButtonsContainerSx,
  googleLoginWrapperSx,
  dividerSx,
  dividerTextSx,
  emailGroupSx,
  passwordGroupSx,
  fieldLabelSx,
  forgotPasswordWrapperSx,
  forgotPasswordLinkSx,
  submitButtonSx,
  footerTextSx,
  signUpLinkSx,
} from './styled';
import { ROUTES, TEXT, ROLES, LINKEDIN_OAUTH_STATE, STORAGE_KEY_TOKEN } from './constants';
import { getRecruiterDest } from './utils';

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';

// --- Component ---
const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, setUser, setToken, user } = useAuth();
  // Destination after login: prefer state.from (PrivateRoute), then ?redirect= (api.js 401), then role default
  const redirectTarget = location.state?.from || searchParams.get('redirect') || null;
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fromExtension] = useState(isFromExtension());
  const existingToken = localStorage.getItem(STORAGE_KEY_TOKEN);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && existingToken && fromExtension) {
      handleExtensionAuthSuccess(
        existingToken, user, navigate,
        user.role === ROLES.RECRUITER ? getRecruiterDest(user) : user.role === ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.PROFILE,
        false
      );
      return;
    }
    if (user && !fromExtension) {
      navigate(user.role === ROLES.RECRUITER ? getRecruiterDest(user) : user.role === ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.PROFILE, { replace: true });
    }
  }, [user, existingToken, navigate, fromExtension]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- OAuth ---
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.googleLogin(credentialResponse.credential);
      const { token, user } = response.data;
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      setToken(token);
      setUser(user);
      const dest = redirectTarget || (user?.role === ROLES.RECRUITER ? getRecruiterDest(user) : user?.role === ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.PROFILE);
      fromExtension
        ? await handleExtensionAuthSuccess(token, user, navigate, dest)
        : navigate(dest, { replace: true });
    } catch (err) {
      if (err.response?.status === 404) {
        setError(TEXT.ERROR_GOOGLE_NO_ACCOUNT);
      } else {
        setError(err.response?.data?.error || TEXT.ERROR_GOOGLE_LOGIN);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    // No-op: Google's library fires onError for cosmetic reasons (COOP popup
    // postMessage races) even when the credential is delivered successfully
    // and handleGoogleSuccess runs. Real failures surface from the API call
    // inside handleGoogleSuccess.
  };

  // --- Form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(formData);
      const { user, token } = result;
      const dest = redirectTarget || (user?.role === ROLES.RECRUITER ? getRecruiterDest(user) : user?.role === ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.PROFILE);
      fromExtension
        ? await handleExtensionAuthSuccess(token, user, navigate, dest)
        : navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_LOGIN);
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  return (
    <AuthLayout>
      <Typography variant="h4" sx={titleSx}>
        {TEXT.WELCOME_TITLE}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={subtitleSx}>
        {TEXT.SUBTITLE}
      </Typography>

      {error && (
        <Alert severity="error" sx={alertSx}>
          {error}
        </Alert>
      )}

      {/* Social buttons */}
      <Box sx={socialButtonsContainerSx}>
        <Box sx={googleLoginWrapperSx}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
            width="400"
          />
        </Box>
      </Box>

      {/* Divider */}
      <Divider sx={dividerSx}>
        <Typography variant="body2" color="text.secondary" sx={dividerTextSx}>
          {TEXT.DIVIDER_TEXT}
        </Typography>
      </Divider>

      <form onSubmit={handleSubmit} id="login-form">
        {/* Email */}
        <Box sx={emailGroupSx}>
          <Typography variant="body2" sx={fieldLabelSx}>
            {TEXT.EMAIL_LABEL}
          </Typography>
          <TextField
            fullWidth placeholder={TEXT.EMAIL_LABEL} name="email" type="email"
            value={formData.email} onChange={handleChange}
            required size="small" autoFocus sx={inputSx}
          />
        </Box>

        {/* Password */}
        <Box sx={passwordGroupSx}>
          <Typography variant="body2" sx={fieldLabelSx}>
            {TEXT.PASSWORD_LABEL}
          </Typography>
          <TextField
            fullWidth placeholder={TEXT.PASSWORD_LABEL} name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password} onChange={handleChange}
            required size="small" sx={inputSx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" tabIndex={-1} size="small">
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Forgot password */}
        <Box sx={forgotPasswordWrapperSx}>
          <Link
            component={RouterLink}
            to={ROUTES.FORGOT_PASSWORD}
            variant="body2"
            sx={forgotPasswordLinkSx}
          >
            {TEXT.FORGOT_PASSWORD_LINK}
          </Link>
        </Box>
      </form>

      <MobileStickyFooter>
        <GradientButton type="submit" form="login-form" fullWidth size="large" sx={submitButtonSx} disabled={loading}>
          {loading ? TEXT.BUTTON_LOADING : TEXT.BUTTON_SUBMIT}
        </GradientButton>

        <Typography variant="body2" color="text.secondary" sx={footerTextSx}>
          {TEXT.NO_ACCOUNT}{' '}
          <Link component={RouterLink} to={ROUTES.REGISTER} sx={signUpLinkSx}>
            {TEXT.SIGN_UP}
          </Link>
        </Typography>
      </MobileStickyFooter>
    </AuthLayout>
  );
};

export default Login;
