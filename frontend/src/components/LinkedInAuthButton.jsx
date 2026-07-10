import { useEffect, useRef, useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { authAPI } from '@/services/api';

// Callback route that the LinkedIn OAuth popup redirects to. Must match
// exactly one of the "Authorized redirect URLs" registered in the
// LinkedIn Developer app (see ROUTES.LINKEDIN_OAUTH_CALLBACK).
const CALLBACK_PATH = '/auth/linkedin/callback';
const OAUTH_STATE_KEY = 'profileai_linkedin_auth_state';
const POPUP_MESSAGE_TYPE = 'profileai:linkedin-oauth';

// Official LinkedIn "in" glyph on the app's brand blue tile — matches the
// visual treatment used elsewhere (LinkedInImportModal, resume tailoring).
const LinkedInLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="3" fill="#ffffff" />
    <path
      fill="#0a66c2"
      d="M6.94 8.5A2.44 2.44 0 1 1 6.94 3.62a2.44 2.44 0 0 1 0 4.88ZM4.9 20.38V9.75h4.08v10.63H4.9Zm6.13-10.63h3.92v1.46h.06a4.3 4.3 0 0 1 3.87-2.13c4.14 0 4.9 2.73 4.9 6.28v5.02h-4.08v-4.45c0-1.06-.02-2.42-1.47-2.42-1.47 0-1.7 1.15-1.7 2.34v4.53h-4.08V9.75Z"
    />
  </svg>
);

/**
 * "Continue with LinkedIn" OAuth button.
 *
 * Handles the full popup handshake:
 *   1. Ask the backend to build the LinkedIn authorization URL (keeps the
 *      client ID server-side, avoids leaking it into the bundle).
 *   2. Open the LinkedIn consent screen in a centered popup.
 *   3. Wait for /auth/linkedin/callback (the popup page) to `postMessage`
 *      the authorization code back through window.opener.
 *   4. Verify the OAuth state parameter against the value we stashed in
 *      sessionStorage before opening the popup (CSRF protection).
 *   5. Hand `{ code, redirectUri }` up to the parent — the parent is
 *      responsible for POSTing it to /auth/linkedin or
 *      /auth/linkedin/register.
 *
 * The parent controls the loading state so it can also cover the API round
 * trip (linkedinLogin / linkedinRegister) that runs after this button's
 * own popup step finishes.
 */
const LinkedInAuthButton = ({
  onSuccess,
  onError,
  loading = false,
  disabled = false,
  label = 'Continue with LinkedIn',
  fullWidth = true,
}) => {
  const [popupLoading, setPopupLoading] = useState(false);
  const popupRef = useRef(null);
  const popupPollRef = useRef(null);
  const messageHandlerRef = useRef(null);

  // Guarantee we clean up popup polling + window listeners if the button
  // unmounts mid-flight (e.g. user navigates away while consenting).
  useEffect(() => {
    return () => {
      if (popupPollRef.current) {
        clearInterval(popupPollRef.current);
        popupPollRef.current = null;
      }
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
        messageHandlerRef.current = null;
      }
      try { popupRef.current?.close?.(); } catch (_) { /* ignore */ }
      popupRef.current = null;
    };
  }, []);

  const raiseError = (message) => {
    setPopupLoading(false);
    onError?.(message || 'LinkedIn sign-in failed. Please try again.');
  };

  const teardown = () => {
    if (popupPollRef.current) {
      clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    try { popupRef.current?.close?.(); } catch (_) { /* ignore */ }
    popupRef.current = null;
  };

  const handleClick = async () => {
    if (popupLoading || loading || disabled) return;

    setPopupLoading(true);
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;

    // Cryptographically-random state guards against CSRF on the popup
    // roundtrip. Stashed in sessionStorage so this same tab can read it
    // back after LinkedIn redirects the popup to /auth/linkedin/callback.
    const stateToken = (() => {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    })();
    sessionStorage.setItem(OAUTH_STATE_KEY, stateToken);

    let authorizeUrl;
    try {
      const { data } = await authAPI.linkedinAuthorizeUrl(redirectUri, stateToken);
      authorizeUrl = data?.url;
    } catch (err) {
      const status = err?.response?.status;
      // 503 from the endpoint means LINKEDIN_CLIENT_ID isn't set on the
      // server — surface a clearer message than a generic failure.
      const message = status === 503
        ? 'LinkedIn sign-in is not configured on the server.'
        : err?.response?.data?.error;
      return raiseError(message);
    }

    if (!authorizeUrl) return raiseError('LinkedIn sign-in is not available right now.');

    // Center the popup on the current window.
    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      authorizeUrl,
      'profileai_linkedin_auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) {
      sessionStorage.removeItem(OAUTH_STATE_KEY);
      return raiseError('Popup blocked. Please allow popups and try again.');
    }
    popupRef.current = popup;

    // Detect the user closing the popup manually so we don't spin forever.
    // The message handler clears this interval when it fires first.
    popupPollRef.current = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        clearInterval(popupPollRef.current);
        popupPollRef.current = null;
        if (messageHandlerRef.current) {
          window.removeEventListener('message', messageHandlerRef.current);
          messageHandlerRef.current = null;
        }
        popupRef.current = null;
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        // Only bubble a cancel error if the parent is still waiting.
        setPopupLoading((wasLoading) => {
          if (wasLoading) onError?.('LinkedIn sign-in was cancelled.');
          return false;
        });
      }
    }, 500);

    const handler = (event) => {
      // Reject cross-origin messages outright. The callback page runs on
      // the same origin as the opener so this is a strict equality check.
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== POPUP_MESSAGE_TYPE) return;

      teardown();

      const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);

      if (!expectedState || payload.state !== expectedState) {
        return raiseError('LinkedIn sign-in failed a security check. Please try again.');
      }
      if (payload.error || !payload.code) {
        return raiseError(payload.errorDescription || payload.error || 'LinkedIn sign-in was denied.');
      }

      // Hand the code up to the parent — the parent decides whether to
      // POST /auth/linkedin (login) or /auth/linkedin/register (signup).
      setPopupLoading(false);
      onSuccess?.({ code: payload.code, redirectUri });
    };

    messageHandlerRef.current = handler;
    window.addEventListener('message', handler);
  };

  const isBusy = loading || popupLoading;

  return (
    <Button
      type="button"
      variant="contained"
      fullWidth={fullWidth}
      onClick={handleClick}
      disabled={disabled || isBusy}
      startIcon={isBusy
        ? <CircularProgress size={18} thickness={5} sx={{ color: '#ffffff' }} />
        : <LinkedInLogo />
      }
      sx={{
        height: 44,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        letterSpacing: 0.1,
        color: '#ffffff',
        backgroundColor: '#0a66c2',
        borderRadius: '8px',
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: '#004182',
          boxShadow: '0 1px 2px 0 rgba(10,102,194,0.30), 0 1px 3px 1px rgba(10,102,194,0.10)',
        },
        '&:active': {
          backgroundColor: '#003368',
        },
        '&.Mui-disabled': {
          backgroundColor: '#0a66c2',
          opacity: 0.6,
          color: '#ffffff',
        },
        '& .MuiButton-startIcon': {
          marginRight: 1.5,
        },
      }}
    >
      {label}
    </Button>
  );
};

export default LinkedInAuthButton;
