import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
} from '@mui/icons-material';
import { profileAPI, authAPI } from '../../services/api';
import { ROUTES, TEXT } from './constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// sessionStorage key used to guard against CSRF on the OAuth popup roundtrip.
const OAUTH_STATE_KEY = 'profileai_linkedin_oauth_state';

/**
 * "Smart Profile Import" modal shown from /profile/create.
 *
 * Primary flow: user enters a WORK EMAIL or NAME + EMPLOYER WEBSITE →
 * POST /api/profiles/import-linkedin (NinjaPear Person Profile API on the
 * backend) → parent receives resume-shaped data via `onImported(data)` and
 * reuses the ResumeMagicOverlay + /profile/create-form handoff.
 *
 * (Historical note: this used to take a LinkedIn profile URL, but
 * Nubela/Proxycurl deprecated URL-based lookups — HTTP 410 — when they
 * became NinjaPear. Person lookup now works by email or name+employer.)
 *
 * Secondary flow: "Sign in with LinkedIn instead" opens the LinkedIn
 * OAuth popup, exchanges the code via /api/profiles/linkedin-oauth-prefill
 * and prefills only the OIDC basics (name/email/photo).
 *
 * Both `urlImportAvailable` and `oauthAvailable` are driven by the
 * server's /api/profiles/import-linkedin/status response so we don't
 * offer buttons that would immediately 503.
 */
const LinkedInImportModal = ({
  open,
  onClose,
  onImported,
  urlImportAvailable,
  oauthAvailable,
}) => {
  const [workEmail, setWorkEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employerWebsite, setEmployerWebsite] = useState('');
  const [role, setRole] = useState('');
  const [inputError, setInputError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Track any open OAuth popup so we can close/reject it on modal close.
  const popupRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const popupPollRef = useRef(null);

  // Reset state each time the modal opens.
  useEffect(() => {
    if (open) {
      setWorkEmail('');
      setFirstName('');
      setLastName('');
      setEmployerWebsite('');
      setRole('');
      setInputError('');
      setApiError('');
      setSubmitting(false);
      setOauthLoading(false);
    }
  }, [open]);

  // Clean up any lingering popup/listener when the modal unmounts or closes.
  useEffect(() => {
    return () => cleanupOAuth();
  }, []);

  const cleanupOAuth = () => {
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    if (popupPollRef.current) {
      clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      try { popupRef.current.close(); } catch (_) { /* ignore */ }
    }
    popupRef.current = null;
  };

  const handleClose = () => {
    if (submitting || oauthLoading) return;
    cleanupOAuth();
    onClose?.();
  };

  // Either a valid work email OR first name + employer website unlocks submit.
  const hasEmailInput = EMAIL_REGEX.test(workEmail.trim());
  const hasNameInput = firstName.trim().length > 0 && employerWebsite.trim().length > 1;
  const canSubmit = hasEmailInput || hasNameInput;

  const handleSubmit = async () => {
    if (submitting || oauthLoading) return;
    setApiError('');

    if (!canSubmit) {
      setInputError(TEXT.LINKEDIN_ERROR_MISSING_INPUT);
      return;
    }
    setInputError('');

    if (!urlImportAvailable) {
      setApiError(TEXT.LINKEDIN_MODAL_UNAVAILABLE);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {};
      if (hasEmailInput) payload.workEmail = workEmail.trim();
      if (firstName.trim()) payload.firstName = firstName.trim();
      if (lastName.trim()) payload.lastName = lastName.trim();
      if (employerWebsite.trim()) payload.employerWebsite = employerWebsite.trim();
      if (role.trim()) payload.role = role.trim();

      const { data: response } = await profileAPI.importLinkedInUrl(payload);
      if (!response?.success || !response?.data) {
        setApiError(response?.error || TEXT.LINKEDIN_ERROR_GENERIC);
        setSubmitting(false);
        return;
      }
      // Hand the parsed data back to the parent, which handles the magic
      // overlay + navigation.
      onImported?.(response.data);
    } catch (error) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.error;
      if (status === 503) {
        setApiError(serverMessage || TEXT.LINKEDIN_MODAL_UNAVAILABLE);
      } else {
        setApiError(serverMessage || TEXT.LINKEDIN_ERROR_GENERIC);
      }
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleOAuthSignIn = async () => {
    if (submitting || oauthLoading) return;
    setApiError('');

    if (!oauthAvailable) {
      setApiError(TEXT.LINKEDIN_MODAL_OAUTH_UNAVAILABLE);
      return;
    }

    setOauthLoading(true);
    const redirectUri = `${window.location.origin}${ROUTES.LINKEDIN_OAUTH_CALLBACK}`;
    // Cryptographically-random state token guards against CSRF on the
    // popup roundtrip. Stored in sessionStorage so the callback tab can
    // read it back through the same origin.
    const stateToken = (() => {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    })();
    sessionStorage.setItem(OAUTH_STATE_KEY, stateToken);

    try {
      const { data } = await authAPI.linkedinAuthorizeUrl(redirectUri, stateToken);
      const authorizeUrl = data?.url;
      if (!authorizeUrl) {
        setApiError(TEXT.LINKEDIN_MODAL_OAUTH_UNAVAILABLE);
        setOauthLoading(false);
        return;
      }

      // Open the LinkedIn OAuth popup. Approx. size and centered.
      const width = 520;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        authorizeUrl,
        'profileai_linkedin_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      if (!popup) {
        setApiError(TEXT.LINKEDIN_ERROR_POPUP_BLOCKED);
        setOauthLoading(false);
        return;
      }
      popupRef.current = popup;

      // Poll for the user closing the popup manually so we can reset state.
      popupPollRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          clearInterval(popupPollRef.current);
          popupPollRef.current = null;
          // Only surface a "cancelled" message if we haven't already
          // handled the code via postMessage.
          if (oauthLoading) {
            setApiError(TEXT.LINKEDIN_ERROR_POPUP_CLOSED);
            setOauthLoading(false);
          }
        }
      }, 500);

      // Message handler for the callback page's postMessage.
      const handler = async (event) => {
        if (event.origin !== window.location.origin) return;
        const payload = event.data;
        if (!payload || payload.type !== 'profileai:linkedin-oauth') return;
        // De-register immediately so a rogue tab can't fire us twice.
        window.removeEventListener('message', handler);
        messageHandlerRef.current = null;
        if (popupPollRef.current) {
          clearInterval(popupPollRef.current);
          popupPollRef.current = null;
        }
        try { popupRef.current?.close?.(); } catch (_) { /* ignore */ }
        popupRef.current = null;

        // CSRF check against the state we stashed before opening the popup.
        const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        if (!expectedState || payload.state !== expectedState) {
          setApiError(TEXT.LINKEDIN_ERROR_OAUTH);
          setOauthLoading(false);
          return;
        }
        if (payload.error || !payload.code) {
          setApiError(payload.errorDescription || payload.error || TEXT.LINKEDIN_ERROR_OAUTH);
          setOauthLoading(false);
          return;
        }

        try {
          const { data: prefillResponse } = await profileAPI.linkedinOAuthPrefill(
            payload.code,
            redirectUri
          );
          if (!prefillResponse?.success || !prefillResponse?.data) {
            setApiError(prefillResponse?.error || TEXT.LINKEDIN_ERROR_OAUTH);
            setOauthLoading(false);
            return;
          }
          onImported?.(prefillResponse.data);
        } catch (prefillErr) {
          const serverMessage = prefillErr?.response?.data?.error;
          setApiError(serverMessage || TEXT.LINKEDIN_ERROR_OAUTH);
          setOauthLoading(false);
        }
      };
      messageHandlerRef.current = handler;
      window.addEventListener('message', handler);
    } catch (error) {
      const serverMessage = error?.response?.data?.error;
      setApiError(serverMessage || TEXT.LINKEDIN_ERROR_OAUTH);
      setOauthLoading(false);
    }
  };

  const nothingAvailable = !urlImportAvailable && !oauthAvailable;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          fontWeight: 700,
          fontSize: 20,
          color: '#1a1a2e',
          pr: 6,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0a66c2, #004182)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <AIIcon sx={{ fontSize: 22 }} />
        </Box>
        {TEXT.LINKEDIN_MODAL_TITLE}
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          disabled={submitting || oauthLoading}
          sx={{ position: 'absolute', top: 12, right: 12, color: '#999' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 14, color: '#555', mb: 2.5 }}>
          {TEXT.LINKEDIN_MODAL_SUBTITLE}
        </Typography>

        {nothingAvailable && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
            {TEXT.LINKEDIN_MODAL_ALL_UNAVAILABLE}
          </Alert>
        )}

        {!nothingAvailable && !urlImportAvailable && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: '10px' }}>
            {TEXT.LINKEDIN_MODAL_UNAVAILABLE}
          </Alert>
        )}

        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
            {apiError}
          </Alert>
        )}

        {inputError && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
            {inputError}
          </Alert>
        )}

        <TextField
          fullWidth
          type="email"
          label={TEXT.LINKEDIN_MODAL_EMAIL_LABEL}
          placeholder={TEXT.LINKEDIN_MODAL_EMAIL_PLACEHOLDER}
          value={workEmail}
          onChange={(e) => {
            setWorkEmail(e.target.value);
            if (inputError) setInputError('');
          }}
          onKeyDown={handleKeyDown}
          helperText={TEXT.LINKEDIN_MODAL_EMAIL_HINT}
          disabled={submitting || oauthLoading || !urlImportAvailable}
          autoFocus
          // Chrome's saved addresses are typically personal (gmail etc.),
          // which the enrichment API rejects — suppress autofill so users
          // type their corporate address instead. "new-password"-style
          // tricks aren't needed; a non-standard name + off works here.
          name="work-email-lookup"
          inputProps={{ autoComplete: 'off' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon sx={{ color: '#0a66c2' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: '10px' },
          }}
        />

        <Divider sx={{ my: 2.5, color: '#999', fontSize: 13 }}>
          {TEXT.LINKEDIN_MODAL_NAME_DIVIDER}
        </Divider>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <TextField
            fullWidth
            label={TEXT.LINKEDIN_MODAL_FIRSTNAME_LABEL}
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (inputError) setInputError('');
            }}
            onKeyDown={handleKeyDown}
            disabled={submitting || oauthLoading || !urlImportAvailable}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <TextField
            fullWidth
            label={TEXT.LINKEDIN_MODAL_LASTNAME_LABEL}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting || oauthLoading || !urlImportAvailable}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </Box>

        <TextField
          fullWidth
          label={TEXT.LINKEDIN_MODAL_EMPLOYER_LABEL}
          placeholder={TEXT.LINKEDIN_MODAL_EMPLOYER_PLACEHOLDER}
          value={employerWebsite}
          onChange={(e) => {
            setEmployerWebsite(e.target.value);
            if (inputError) setInputError('');
          }}
          onKeyDown={handleKeyDown}
          disabled={submitting || oauthLoading || !urlImportAvailable}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BusinessIcon sx={{ color: '#0a66c2' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': { borderRadius: '10px' },
          }}
        />

        <TextField
          fullWidth
          label={TEXT.LINKEDIN_MODAL_ROLE_LABEL}
          placeholder={TEXT.LINKEDIN_MODAL_ROLE_PLACEHOLDER}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting || oauthLoading || !urlImportAvailable}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />

        {oauthAvailable && (
          <>
            <Divider sx={{ my: 3, color: '#999', fontSize: 13 }}>
              {TEXT.LINKEDIN_MODAL_OAUTH_DIVIDER}
            </Divider>
            <Button
              fullWidth
              variant="outlined"
              startIcon={oauthLoading ? <CircularProgress size={18} /> : <LinkedInIcon />}
              onClick={handleOAuthSignIn}
              disabled={submitting || oauthLoading}
              sx={{
                borderRadius: '10px',
                borderColor: '#0a66c2',
                color: '#0a66c2',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.2,
                '&:hover': {
                  borderColor: '#004182',
                  background: 'rgba(10,102,194,0.04)',
                },
              }}
            >
              {TEXT.LINKEDIN_MODAL_OAUTH_BUTTON}
            </Button>
            <Typography sx={{ fontSize: 12, color: '#999', mt: 1, textAlign: 'center' }}>
              {TEXT.LINKEDIN_MODAL_OAUTH_NOTE}
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, background: '#fafbfc' }}>
        <Button
          onClick={handleClose}
          disabled={submitting || oauthLoading}
          sx={{ color: '#666', textTransform: 'none', fontWeight: 600 }}
        >
          {TEXT.LINKEDIN_MODAL_CANCEL}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || oauthLoading || !urlImportAvailable || !canSubmit}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={18} sx={{ color: 'white' }} /> : null}
          sx={{
            background: 'linear-gradient(135deg, #0a66c2, #004182)',
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '10px',
            px: 3,
            '&:hover': {
              background: 'linear-gradient(135deg, #004182, #002d5e)',
            },
            '&.Mui-disabled': {
              background: '#c0c0c0',
              color: '#fff',
            },
          }}
        >
          {submitting ? 'Importing…' : TEXT.LINKEDIN_MODAL_SUBMIT}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkedInImportModal;
