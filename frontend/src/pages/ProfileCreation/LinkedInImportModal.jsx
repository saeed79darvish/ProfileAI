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
  Close as CloseIcon,
  Description as PdfIcon,
  LinkedIn as LinkedInIcon,
  OpenInNew as OpenIcon,
  UploadFile as UploadIcon,
} from '@mui/icons-material';
import { profileAPI, authAPI } from '../../services/api';
import { ROUTES, TEXT, ALLOWED_FILE_TYPES, VALIDATION } from './constants';
import LinkedInPdfHint from './LinkedInPdfHint';

// Same relaxed pattern the backend uses in linkedinEnrichmentService.
const LINKEDIN_URL_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|profile)\/[a-zA-Z0-9_-]+\/?/i;

// sessionStorage key used to guard against CSRF on the OAuth popup roundtrip.
const OAUTH_STATE_KEY = 'profileai_linkedin_oauth_state';

/**
 * "Import from LinkedIn" modal shown from /profile/create.
 *
 * Primary flow: user pastes a LinkedIn profile URL → we POST it to
 * /api/profiles/import-linkedin and hand the parsed resume-shaped data
 * back to the parent via `onImported(data)`. The parent reuses the same
 * ResumeMagicOverlay + /profile/create-form handoff as the resume upload
 * flow, so LinkedIn imports look identical to the user.
 *
 * Secondary flow: "Sign in with LinkedIn instead" opens the LinkedIn
 * OAuth popup, exchanges the code via /api/profiles/linkedin-oauth-prefill
 * and prefills only the OIDC basics (name/email/photo). This is what the
 * user gets when a full-profile enrichment API (Proxycurl / PDL) isn't
 * configured yet — good enough to jumpstart the profile without typing.
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
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Hidden file input for the LinkedIn "Save to PDF" upload path.
  const pdfInputRef = useRef(null);

  // Track any open OAuth popup so we can close/reject it on modal close.
  const popupRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const popupPollRef = useRef(null);

  // Reset state each time the modal opens.
  useEffect(() => {
    if (open) {
      setUrl('');
      setUrlError('');
      setApiError('');
      setSubmitting(false);
      setOauthLoading(false);
      setPdfUploading(false);
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
    if (submitting || oauthLoading || pdfUploading) return;
    cleanupOAuth();
    onClose?.();
  };

  // LinkedIn's official "Save to PDF" export, run through the exact same
  // /profiles/upload-resume AI parser as the resume-upload card. Always
  // available — no third-party enrichment API required.
  const handlePdfSelected = async (event) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file next time.
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setApiError(TEXT.ERROR_FILE_TYPE);
      return;
    }
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      setApiError(TEXT.ERROR_FILE_SIZE);
      return;
    }

    setApiError('');
    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const response = await profileAPI.uploadResume(formData);
      if (response.data?.success && response.data?.data) {
        onImported?.(response.data.data);
      } else {
        setApiError(response.data?.error || TEXT.ERROR_PARSE);
        setPdfUploading(false);
      }
    } catch (error) {
      setApiError(error?.message || TEXT.ERROR_UPLOAD);
      setPdfUploading(false);
    }
  };

  const validateUrl = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return 'Please paste your LinkedIn profile URL.';
    if (!LINKEDIN_URL_REGEX.test(trimmed)) return TEXT.LINKEDIN_ERROR_INVALID_URL;
    return '';
  };

  const handleUrlSubmit = async () => {
    if (submitting || oauthLoading) return;
    setApiError('');
    const err = validateUrl(url);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError('');

    if (!urlImportAvailable) {
      setApiError(TEXT.LINKEDIN_MODAL_UNAVAILABLE);
      return;
    }

    setSubmitting(true);
    try {
      const { data: response } = await profileAPI.importLinkedInUrl(url.trim());
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
      } else if (status === 400) {
        setApiError(serverMessage || TEXT.LINKEDIN_ERROR_INVALID_URL);
      } else {
        setApiError(serverMessage || TEXT.LINKEDIN_ERROR_GENERIC);
      }
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
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
          <LinkedInIcon sx={{ fontSize: 22 }} />
        </Box>
        {TEXT.LINKEDIN_MODAL_TITLE}
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          disabled={submitting || oauthLoading || pdfUploading}
          sx={{ position: 'absolute', top: 12, right: 12, color: '#999' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 14, color: '#555', mb: 2.5 }}>
          {urlImportAvailable ? TEXT.LINKEDIN_MODAL_SUBTITLE : TEXT.LINKEDIN_MODAL_SUBTITLE_PDF}
        </Typography>

        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
            {apiError}
          </Alert>
        )}

        {/* Instant URL import — only rendered when the server has an
            enrichment key. When it doesn't, the PDF flow below is the
            primary (and only) content, with no dead inputs or banners. */}
        {urlImportAvailable && (
          <>
            <TextField
              fullWidth
              label={TEXT.LINKEDIN_MODAL_LABEL}
              placeholder={TEXT.LINKEDIN_MODAL_PLACEHOLDER}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={handleKeyDown}
              error={!!urlError}
              helperText={urlError || TEXT.LINKEDIN_MODAL_HINT}
              disabled={submitting || oauthLoading || pdfUploading}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkedInIcon sx={{ color: '#0a66c2' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px',
                },
              }}
            />

            <Divider sx={{ my: 2.5, color: '#999', fontSize: 13 }}>
              {TEXT.LINKEDIN_PDF_DIVIDER}
            </Divider>
          </>
        )}

        {/* LinkedIn official "Save to PDF" path — always available */}
        <Box
          sx={{
            background: 'rgba(10,102,194,0.04)',
            border: '1px solid rgba(10,102,194,0.15)',
            borderRadius: '12px',
            p: 2.5,
          }}
        >
          {/* Numbered steps with the action inline on each row so users
              read top-to-bottom and never hunt for the next click. */}
          {[
            { n: 1, text: TEXT.LINKEDIN_PDF_STEP_1, action: (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenIcon />}
                component="a"
                href="https://www.linkedin.com/in/me/"
                target="_blank"
                rel="noopener noreferrer"
                disabled={submitting || oauthLoading || pdfUploading}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#0a66c2',
                  color: '#0a66c2',
                  flexShrink: 0,
                }}
              >
                {TEXT.LINKEDIN_PDF_OPEN_PROFILE}
              </Button>
            ) },
            { n: 2, text: TEXT.LINKEDIN_PDF_STEP_2, action: null },
            { n: 3, text: TEXT.LINKEDIN_PDF_STEP_3, action: (
              <Button
                size="small"
                variant="contained"
                startIcon={pdfUploading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <UploadIcon />}
                onClick={() => pdfInputRef.current?.click()}
                disabled={submitting || oauthLoading || pdfUploading}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #0a66c2, #004182)',
                  flexShrink: 0,
                }}
              >
                {pdfUploading ? TEXT.LINKEDIN_PDF_UPLOADING : TEXT.LINKEDIN_PDF_BUTTON}
              </Button>
            ) },
          ].map(({ n, text, action }) => (
            <React.Fragment key={n}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: n < 3 ? 1.75 : 0,
                }}
              >
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0a66c2, #004182)',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {n}
                </Box>
                <Typography sx={{ fontSize: 14, color: '#333', flexGrow: 1 }}>
                  {text}
                </Typography>
                {action}
              </Box>
              {/* Visual guide for step 2: shows where the ••• button is
                  and what "Save to PDF" looks like in the dropdown. */}
              {n === 2 && (
                <Box
                  sx={{
                    mb: 1.75,
                    p: 1,
                    background: '#fff',
                    borderRadius: '10px',
                    border: '1px solid rgba(10,102,194,0.12)',
                  }}
                >
                  <LinkedInPdfHint />
                </Box>
              )}
            </React.Fragment>
          ))}
          <input
            ref={pdfInputRef}
            type="file"
            hidden
            accept=".pdf,.doc,.docx"
            onChange={handlePdfSelected}
          />
        </Box>

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
              disabled={submitting || oauthLoading || pdfUploading}
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
          disabled={submitting || oauthLoading || pdfUploading}
          sx={{ color: '#666', textTransform: 'none', fontWeight: 600 }}
        >
          {TEXT.LINKEDIN_MODAL_CANCEL}
        </Button>
        {urlImportAvailable && (
          <Button
            onClick={handleUrlSubmit}
            disabled={submitting || oauthLoading || pdfUploading}
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
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LinkedInImportModal;
