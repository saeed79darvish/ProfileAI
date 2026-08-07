import { forwardRef, useImperativeHandle } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { useGoogleLogin } from '@react-oauth/google';

// Official multi-color "G" logo (Google brand guidelines). Exported so the
// OAuth consent dialog draws the same mark instead of a second copy of the
// brand paths.
export const GoogleLogo = (props) => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" {...props}>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

/**
 * Modern, brand-consistent Google OAuth button.
 * Renders a single white pill button ("Continue with Google" or custom label)
 * with the official "G" logo, regardless of the user's Google session state.
 * Uses the OAuth2 implicit flow and forwards the access token to onSuccess.
 */
const GoogleAuthButton = forwardRef(({
  onSuccess,
  onError,
  loading = false,
  disabled = false,
  label = 'Continue with Google',
  fullWidth = true,
  // Runs synchronously on click. Return false to stop the flow — used to put a
  // terms-consent step in front of Google's popup.
  onGuard,
}, ref) => {
  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: (tokenResponse) => onSuccess?.({ accessToken: tokenResponse.access_token }),
    onError: (err) => onError?.(err),
  });

  // Lets a parent resume the flow from its own click handler (e.g. the consent
  // dialog's Accept button), which keeps the browser's user-gesture context so
  // the popup is not blocked.
  useImperativeHandle(ref, () => ({ start: () => login() }), [login]);

  const handleClick = () => {
    if (onGuard && onGuard() === false) return;
    login();
  };

  return (
    <Button
      type="button"
      variant="outlined"
      fullWidth={fullWidth}
      onClick={handleClick}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={18} thickness={5} /> : <GoogleLogo />}
      sx={{
        height: 44,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        letterSpacing: 0.1,
        color: '#1f1f1f',
        backgroundColor: '#ffffff',
        borderColor: '#dadce0',
        borderRadius: '8px',
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: '#f8f9fa',
          borderColor: '#dadce0',
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.10), 0 1px 3px 1px rgba(60,64,67,0.06)',
        },
        '&:active': {
          backgroundColor: '#f1f3f4',
        },
        '&.Mui-disabled': {
          backgroundColor: '#ffffff',
          borderColor: '#e0e0e0',
          color: '#9aa0a6',
        },
        '& .MuiButton-startIcon': {
          marginRight: 1.5,
        },
      }}
    >
      {label}
    </Button>
  );
});

GoogleAuthButton.displayName = 'GoogleAuthButton';

export default GoogleAuthButton;
