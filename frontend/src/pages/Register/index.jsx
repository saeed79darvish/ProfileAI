import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  Grid,
  LinearProgress,
  Divider,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PersonIcon from '@mui/icons-material/Person';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import LinkedInAuthButton from '@/components/LinkedInAuthButton';
import TermsConsentDialog from '@/components/TermsConsentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI, referralAPI } from '@/services/api';
import AuthLayout, { MobileStickyFooter } from '@/components/AuthLayout';
import { isFromExtension, handleExtensionAuthSuccess } from '@/utils/extensionBridge';
import { trackEvent } from '@/utils/analytics';
import {
  RoleToggleWrapper,
  RoleOption,
  PasswordReq,
  GradientButton,
  inputSx,
  headingSx,
  subtitleSx,
  alertSx,
  socialButtonsWrapperSx,
  dividerSx,
  dividerTextSx,
  fieldLabelSx,
  passwordStrengthWrapperSx,
  progressBarRowSx,
  getProgressBarSx,
  getStrengthLabelSx,
  passwordReqGridSx,
  termsSx,
  termsLinkSx,
  submitButtonSx,
  loginPromptSx,
  loginLinkSx,
  recruiterOptionStyle,
  comingSoonBadgeStyle
} from './styled';
import { ROUTES, TEXT } from './constants';
import { getPasswordStrength } from './utils';

// --- Component ---
const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, setUser, setToken, user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'candidate'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fromExtension] = useState(isFromExtension());

  // Consent for the OAuth paths is captured by TermsConsentDialog. The ref
  // mirrors the state because the provider callbacks fire from closures created
  // before the accept re-render lands — reading state there would still see
  // false and wrongly block a user who just consented.
  const acceptedTermsRef = useRef(false);
  const googleBtnRef = useRef(null);
  const linkedinBtnRef = useRef(null);
  const [consentProvider, setConsentProvider] = useState(null);

  // Called synchronously from a social button's click. Returning false stops
  // the provider handoff and opens the consent dialog instead.
  const guardConsent = (provider) => {
    if (acceptedTermsRef.current) return true;
    setConsentProvider(provider);
    return false;
  };

  // Runs from the dialog's continue click, so the browser still treats this as
  // a user gesture and the provider popup is not blocked. The dialog passes the
  // provider it acted on — its secondary button switches to the other one.
  const acceptConsentAndContinue = (provider = consentProvider) => {
    acceptedTermsRef.current = true;
    setAcceptedTerms(true);
    setConsentProvider(null);
    if (provider === 'google') googleBtnRef.current?.start();
    else if (provider === 'linkedin') linkedinBtnRef.current?.start();
  };
  const referrerId = searchParams.get('ref') || null;
  const token = localStorage.getItem('token');
  const authDebugEnabled =
    window.location.search.includes('authDebug=1') ||
    localStorage.getItem('profileai_auth_debug') === '1';
  const authDebug = (...args) => {
    if (authDebugEnabled) console.log('[AUTH_FLOW][Register]', ...args);
  };

  const getCandidateDest = (authUser, fallback) => (
    authUser?.role === 'candidate' && authUser?.hasProfile !== true
      ? ROUTES.ONBOARDING
      : fallback
  );

  // Redirect if already authenticated
  useEffect(() => {
    authDebug('auto-redirect check', {
      hasUser: !!user,
      hasToken: !!token,
      fromExtension,
      role: user?.role,
      emailVerified: user?.emailVerified,
      hasProfile: user?.hasProfile
    });
    if (user && token && fromExtension) {
      const roleDest = user.role === 'recruiter' ? ROUTES.RECRUITER_DASHBOARD : user.role === 'admin' ? ROUTES.ADMIN : getCandidateDest(user, ROUTES.PROFILE);
      authDebug('extension auto-redirect', { roleDest });
      handleExtensionAuthSuccess(
        token, user, navigate,
        roleDest,
        false
      );
      return;
    }
    if (user && !fromExtension) {
      const roleDest = user.role === 'recruiter' ? ROUTES.RECRUITER_DASHBOARD : user.role === 'admin' ? ROUTES.ADMIN : getCandidateDest(user, ROUTES.PROFILE);
      authDebug('web auto-redirect', { roleDest });
      navigate(roleDest, { replace: true });
    }
  }, [user, token, navigate, fromExtension]);

  // Handle role query parameter (e.g. from public profile CTA)
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'candidate') {
      setFormData((prev) => ({ ...prev, role: roleParam }));
    }
  }, [searchParams]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password]
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- OAuth ---
  const handleGoogleSuccess = async (payload) => {
    setError('');
    if (!acceptedTermsRef.current) {
      setError(TEXT.ERRORS.CONSENT_REQUIRED);
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.googleRegister(
        payload?.credential ? { credential: payload.credential } : payload,
        formData.role,
        true
      );
      const { token, user } = response.data;
      authDebug('google register response', {
        role: user?.role,
        emailVerified: user?.emailVerified,
        hasProfile: user?.hasProfile
      });
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      if (referrerId) {
        try { await referralAPI.completeByReferrer(referrerId); } catch (e) { /* non-blocking */ }
      }
      trackEvent('register_completed', { role: user?.role, method: 'google', emailVerified: !!user?.emailVerified });
      const dest = user?.role === 'recruiter'
        ? (user?.hasRecruiterProfile ? '/recruiter/dashboard' : ROUTES.RECRUITER_ONBOARDING)
        : (user?.hasProfile ? '/profile' : ROUTES.ONBOARDING);
      authDebug('google register navigate', { dest });
      fromExtension
        ? await handleExtensionAuthSuccess(token, user, navigate, dest)
        : navigate(dest);
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERRORS.GOOGLE_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    // No-op: Google's library fires onError for cosmetic reasons (COOP popup
    // postMessage races) even when the credential is delivered successfully.
    // Real failures surface from the API call in handleGoogleSuccess.
  };

  // LinkedIn OAuth signup — mirrors handleGoogleSuccess but hits
  // /api/auth/linkedin/register so the backend can create the User row
  // with the currently selected role (currently only 'candidate' is
  // selectable in the UI, but we pass it explicitly for future-proofing).
  const handleLinkedInSuccess = async ({ code, redirectUri }) => {
    setError('');
    if (!acceptedTermsRef.current) {
      setError(TEXT.ERRORS.CONSENT_REQUIRED);
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.linkedinRegister(code, redirectUri, formData.role, true);
      const { token, user } = response.data;
      authDebug('linkedin register response', {
        role: user?.role,
        emailVerified: user?.emailVerified,
        hasProfile: user?.hasProfile
      });
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      if (referrerId) {
        try { await referralAPI.completeByReferrer(referrerId); } catch (e) { /* non-blocking */ }
      }
      trackEvent('register_completed', { role: user?.role, method: 'linkedin', emailVerified: !!user?.emailVerified });
      const dest = user?.role === 'recruiter'
        ? (user?.hasRecruiterProfile ? '/recruiter/dashboard' : ROUTES.RECRUITER_ONBOARDING)
        : (user?.hasProfile ? '/profile' : ROUTES.ONBOARDING);
      authDebug('linkedin register navigate', { dest });
      fromExtension
        ? await handleExtensionAuthSuccess(token, user, navigate, dest)
        : navigate(dest);
    } catch (err) {
      const status = err.response?.status;
      if (status === 503) {
        setError(TEXT.ERRORS.LINKEDIN_NOT_CONFIGURED);
      } else {
        setError(err.response?.data?.error || TEXT.ERRORS.LINKEDIN_FAILED);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInError = (message) => {
    if (message) setError(message);
  };

  // --- Form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(TEXT.ERRORS.PASSWORDS_MISMATCH);
      return;
    }
    const { checks } = passwordStrength;
    if (!checks.minLength || !checks.hasLowercase || !checks.hasUppercase || !checks.hasNumber || !checks.hasSpecial) {
      setError(TEXT.ERRORS.PASSWORD_REQUIREMENTS);
      return;
    }
    if (!acceptedTerms) {
      setError(TEXT.ERRORS.CONSENT_REQUIRED);
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });
      authDebug('email register response', {
        role: result.user?.role,
        emailVerified: result.user?.emailVerified,
        hasProfile: result.user?.hasProfile
      });
      // Credit referral if user came from a shared profile link
      if (referrerId) {
        try { await referralAPI.completeByReferrer(referrerId); } catch (e) { /* non-blocking */ }
      }
      trackEvent('register_completed', { role: formData.role, method: 'email', emailVerified: !!result.user?.emailVerified });
      const dest = formData.role === 'recruiter' ? ROUTES.RECRUITER_ONBOARDING : ROUTES.ONBOARDING;
      authDebug('email register navigate', { dest });
      fromExtension
        ? await handleExtensionAuthSuccess(result.token, result.user, navigate, dest)
        : navigate(dest);
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERRORS.REGISTRATION_FAILED);
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  return (
    <AuthLayout>
      <Typography variant="h4" sx={headingSx}>
        {TEXT.HEADING}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={subtitleSx}>
        {formData.role === 'recruiter'
          ? TEXT.SUBTITLE_RECRUITER
          : TEXT.SUBTITLE_CANDIDATE}
      </Typography>

      {/* Role toggle */}
      <RoleToggleWrapper>
        <RoleOption
          $active={formData.role === 'candidate'}
          onClick={() => setFormData((p) => ({ ...p, role: 'candidate' }))}
          type="button"
        >
          <PersonIcon /> {TEXT.ROLE_CANDIDATE}
        </RoleOption>
        <RoleOption
          $active={false}
          onClick={() => {}}
          type="button"
          style={recruiterOptionStyle}
        >
          <BusinessCenterIcon /> {TEXT.ROLE_RECRUITER}
          <span style={comingSoonBadgeStyle}>{TEXT.COMING_SOON}</span>
        </RoleOption>
      </RoleToggleWrapper>

      {fromExtension && !error && (
        <Alert severity="info" sx={alertSx}>
          {TEXT.EXTENSION_NOTICE}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={alertSx}>
          {error}
        </Alert>
      )}

      <TermsConsentDialog
        open={Boolean(consentProvider)}
        provider={consentProvider}
        termsPath={ROUTES.TERMS}
        privacyPath={ROUTES.PRIVACY}
        onAccept={acceptConsentAndContinue}
        onCancel={() => setConsentProvider(null)}
      />

      {/* Social buttons. Never disabled — clicking one opens the consent
          dialog, which continues into the provider flow on accept. */}
      <Box sx={socialButtonsWrapperSx}>
        <GoogleAuthButton
          ref={googleBtnRef}
          label={formData.role === 'recruiter' ? 'Sign up with Google' : 'Sign up with Google'}
          loading={loading}
          onGuard={() => guardConsent('google')}
          onSuccess={(payload) => handleGoogleSuccess(payload)}
          onError={handleGoogleError}
        />
        <LinkedInAuthButton
          ref={linkedinBtnRef}
          label={TEXT.LINKEDIN_BUTTON}
          loading={loading}
          onGuard={() => guardConsent('linkedin')}
          onSuccess={handleLinkedInSuccess}
          onError={handleLinkedInError}
        />
      </Box>

      {/* Divider */}
      <Divider sx={dividerSx}>
        <Typography variant="body2" color="text.secondary" sx={dividerTextSx}>
          {TEXT.DIVIDER}
        </Typography>
      </Divider>

      <form onSubmit={handleSubmit} id="register-form">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" sx={fieldLabelSx}>
              First Name
            </Typography>
            <TextField
              fullWidth placeholder="First Name" name="firstName"
              value={formData.firstName} onChange={handleChange}
              required size="small" sx={inputSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" sx={fieldLabelSx}>
              Last Name
            </Typography>
            <TextField
              fullWidth placeholder="Last Name" name="lastName"
              value={formData.lastName} onChange={handleChange}
              required size="small" sx={inputSx}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" sx={fieldLabelSx}>
              Email Address
            </Typography>
            <TextField
              fullWidth placeholder="Email Address" name="email" type="email"
              value={formData.email} onChange={handleChange}
              required size="small" sx={inputSx}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" sx={fieldLabelSx}>
              Password
            </Typography>
            <TextField
              fullWidth placeholder="Password" name="password"
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
            {formData.password && (
              <Box sx={passwordStrengthWrapperSx}>
                <Box sx={progressBarRowSx}>
                  <LinearProgress
                    variant="determinate"
                    value={passwordStrength.progress}
                    sx={getProgressBarSx(passwordStrength.color)}
                  />
                  <Typography
                    variant="caption"
                    sx={getStrengthLabelSx(passwordStrength.color)}
                  >
                    {passwordStrength.strength}
                  </Typography>
                </Box>
                <Box sx={passwordReqGridSx}>
                  <PasswordReq $met={passwordStrength.checks.minLength}>
                    {passwordStrength.checks.minLength ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />} 8+ characters
                  </PasswordReq>
                  <PasswordReq $met={passwordStrength.checks.hasLowercase}>
                    {passwordStrength.checks.hasLowercase ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />} Lowercase
                  </PasswordReq>
                  <PasswordReq $met={passwordStrength.checks.hasUppercase}>
                    {passwordStrength.checks.hasUppercase ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />} Uppercase
                  </PasswordReq>
                  <PasswordReq $met={passwordStrength.checks.hasNumber}>
                    {passwordStrength.checks.hasNumber ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />} Number
                  </PasswordReq>
                  <PasswordReq $met={passwordStrength.checks.hasSpecial}>
                    {passwordStrength.checks.hasSpecial ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />} Special (@$!%*?&)
                  </PasswordReq>
                </Box>
              </Box>
            )}
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" sx={fieldLabelSx}>
              Confirm Password
            </Typography>
            <TextField
              fullWidth placeholder="Confirm Password" name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword} onChange={handleChange}
              required size="small" sx={inputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" tabIndex={-1} size="small">
                      {showConfirmPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        </Grid>

        {/* Terms consent for the email signup path. The OAuth buttons above
            capture the same consent through TermsConsentDialog instead. */}
        <FormControlLabel
          sx={{ alignItems: 'flex-start', mt: 1, mr: 0 }}
          control={
            <Checkbox
              checked={acceptedTerms}
              onChange={(e) => {
                acceptedTermsRef.current = e.target.checked;
                setAcceptedTerms(e.target.checked);
              }}
              size="small"
              required
              inputProps={{ 'aria-label': TEXT.CONSENT_REQUIRED }}
              sx={{ pt: 0.25 }}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary" sx={termsSx}>
              I have read and agree to the{' '}
              <Link component={RouterLink} to={ROUTES.TERMS} target="_blank" rel="noopener" sx={termsLinkSx}>
                {TEXT.TERMS_LINK}
              </Link>{' '}and{' '}
              <Link component={RouterLink} to={ROUTES.PRIVACY} target="_blank" rel="noopener" sx={termsLinkSx}>
                {TEXT.PRIVACY_LINK}
              </Link>.
            </Typography>
          }
        />
      </form>

      <MobileStickyFooter>
        <GradientButton type="submit" form="register-form" fullWidth size="large" sx={submitButtonSx} disabled={loading || !acceptedTerms}>
          {loading ? TEXT.SUBMITTING : TEXT.SUBMIT}
        </GradientButton>

        {/* Already have account */}
        <Typography variant="body2" color="text.secondary" sx={loginPromptSx}>
          {TEXT.LOGIN_PROMPT}{' '}
          <Link component={RouterLink} to={ROUTES.LOGIN} sx={loginLinkSx}>
            {TEXT.LOGIN_LINK}
          </Link>
        </Typography>
      </MobileStickyFooter>
    </AuthLayout>
  );
};

export default Register;
