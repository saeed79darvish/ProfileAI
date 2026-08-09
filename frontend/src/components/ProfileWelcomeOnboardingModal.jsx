import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  UploadFile as UploadFileIcon,
  Edit as EditIcon,
  AutoAwesome as AIIcon,
  ArrowForward as ArrowIcon,
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Tune as TailorIcon,
  Lightbulb as TipIcon,
  Bolt as BoltIcon,
  RocketLaunch as RocketIcon,
} from '@mui/icons-material';
import { profileAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * First-time candidate welcome on /profile/edit.
 * Three steps:
 *   1. "Welcome" — what ProfileAI does for candidates
 *   2. "Tour" — visual showcase of the four AI tools (Enhance / Tailor / Tips / Per-section)
 *   3. "Choose a path" — Upload resume, build manually, or start with the AI preferences wizard
 *
 * Reused as a manual tour via the "Show me how" button in the AI toolbar.
 * Persists "seen" state in localStorage so it doesn't nag returning users.
 */

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Path card (final step) ─────────────────────────────────────────────
const PathCard = ({ icon, title, description, badge, onClick, disabled, recommended, loading }) => (
  <Box
    role="button"
    tabIndex={0}
    onClick={disabled ? undefined : onClick}
    onKeyDown={(e) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    }}
    sx={{
      position: 'relative',
      p: 2.25,
      borderRadius: 2.5,
      border: '1.5px solid',
      borderColor: recommended ? '#6366f1' : '#e5e7eb',
      backgroundColor: recommended ? alpha('#6366f1', 0.04) : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      transition: 'all 0.15s ease',
      display: 'flex',
      gap: 2,
      alignItems: 'flex-start',
      '&:hover': disabled
        ? {}
        : {
            borderColor: '#6366f1',
            boxShadow: '0 6px 18px -8px rgba(99,102,241,0.35)',
            transform: 'translateY(-1px)',
          },
      '&:focus-visible': { outline: '2px solid #6366f1', outlineOffset: 2 },
    }}
  >
    {recommended && (
      <Chip
        label="Recommended"
        size="small"
        sx={{
          position: 'absolute',
          top: -10,
          right: 14,
          height: 20,
          fontSize: 10.5,
          fontWeight: 700,
          backgroundColor: '#6366f1',
          color: '#fff',
        }}
      />
    )}
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        background: recommended
          ? 'linear-gradient(135deg, #6366f1, #4338ca)'
          : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
        color: recommended ? '#fff' : '#475569',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {loading ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14.5 }}>
          {title}
        </Typography>
        {badge && (
          <Chip
            label={badge}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: '#ecfeff',
              color: '#0e7490',
              border: '1px solid #a5f3fc',
            }}
          />
        )}
      </Box>
      <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.45 }}>
        {description}
      </Typography>
    </Box>
    <ArrowIcon sx={{ color: '#94a3b8', flexShrink: 0, mt: 0.5 }} />
  </Box>
);

// ─── Feature card (step 2) ──────────────────────────────────────────────
const FeatureCard = ({ icon, title, blurb, accent }) => (
  <Box
    sx={{
      p: 1.75,
      borderRadius: 2,
      border: `1.5px solid ${alpha(accent, 0.25)}`,
      backgroundColor: alpha(accent, 0.04),
      display: 'flex',
      gap: 1.25,
      alignItems: 'flex-start',
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: '10px',
        background: accent,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: '#475569', fontSize: 12, lineHeight: 1.45, display: 'block' }}>
        {blurb}
      </Typography>
    </Box>
  </Box>
);

// ─── Step indicator dots ────────────────────────────────────────────────
const StepDots = ({ count, active }) => (
  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
    {Array.from({ length: count }).map((_, i) => (
      <Box
        key={i}
        sx={{
          width: i === active ? 22 : 7,
          height: 7,
          borderRadius: 5,
          backgroundColor: i === active ? '#6366f1' : i < active ? '#a5b4fc' : '#e2e8f0',
          transition: 'all 0.25s ease',
        }}
      />
    ))}
  </Box>
);

// ─── Main modal ─────────────────────────────────────────────────────────
const ProfileWelcomeOnboardingModal = ({ open, onClose, onResumeParsed, userName, manualTrigger = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  const totalSteps = 3;
  const greeting = useMemo(
    () => (userName ? `Hi ${userName} 👋` : 'Welcome to ProfileAI 👋'),
    [userName]
  );

  const handleClose = () => {
    setStep(0);
    onClose?.();
  };

  const handleUploadClick = () => {
    if (uploading) return;
    setError('');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a PDF or Word document.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is too large. Max size is 10MB.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      // Pattern-matching parse only — no AI — so it's safe to let a
      // pre-registration guest use it via the unauthenticated endpoint.
      const res = isAuthenticated
        ? await profileAPI.uploadResume(form)
        : await profileAPI.guestUploadResume(form);
      if (res.data?.success && res.data?.data) {
        onResumeParsed?.(res.data.data);
        handleClose();
      } else {
        setError(res.data?.error || 'Could not parse this resume. Try another file or fill in manually.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '92vh' } }}
    >
      {/* Header banner (shared across steps) */}
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
          color: '#fff',
        }}
      >
        <IconButton
          onClick={handleClose}
          disabled={uploading}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, color: alpha('#fff', 0.85) }}
          aria-label="Close welcome"
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: alpha('#fff', 0.18),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255,255,255,0.18)',
            }}
          >
            {step === 0 ? <AIIcon sx={{ fontSize: 22 }} /> : step === 1 ? <BoltIcon sx={{ fontSize: 22 }} /> : <RocketIcon sx={{ fontSize: 22 }} />}
          </Box>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, opacity: 0.9 }}>
            {step === 0 ? greeting : step === 1 ? 'AI features tour' : "Let's get started"}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.5 }}>
          {step === 0 && "Build a profile that gets you interviews"}
          {step === 1 && "AI helpers in every section"}
          {step === 2 && "Pick how you want to start"}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, fontSize: 13.5 }}>
          {step === 0 && 'ProfileAI helps candidates write stronger profiles, tailor for each job, and apply faster.'}
          {step === 1 && "Look for the purple Enhance buttons next to each section. AI rewrites your own words — it doesn't invent facts."}
          {step === 2 && 'Three ways to go. You can switch any time.'}
        </Typography>
      </Box>

      {/* Step body */}
      <Box sx={{ p: 3, backgroundColor: '#fafafa', overflowY: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* ─── Step 0: Welcome ─── */}
        {step === 0 && (
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 2 }}>
              {[
                'A complete profile gets 3× more recruiter views.',
                'AI rewrites your bullets — sharper verbs, real metrics, no fluff.',
                'Tailor to any job description in one click.',
              ].map((line) => (
                <Box key={line} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                  <CheckIcon sx={{ fontSize: 18, color: '#16a34a', mt: 0.25 }} />
                  <Typography variant="body2" sx={{ color: '#334155', fontSize: 13.5, lineHeight: 1.5 }}>
                    {line}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                border: '1px solid #ddd6fe',
                display: 'flex',
                gap: 1.25,
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AIIcon sx={{ fontSize: 16 }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#4338ca', fontSize: 12.5, fontWeight: 500, lineHeight: 1.45 }}>
                Heads up: every AI feature needs at least one work experience to
                give you great results — we'll get you there in two minutes.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ─── Step 1: AI Tour ─── */}
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <FeatureCard
              icon={<AIIcon fontSize="small" />}
              accent="#6366f1"
              title="Enhance — polish your whole profile"
              blurb="One click rewrites your summary and experience with stronger verbs, metrics and tone."
            />
            <FeatureCard
              icon={<TailorIcon fontSize="small" />}
              accent="#0ea5e9"
              title="Tailor — match any job description"
              blurb="Paste a JD and AI re-shapes your bullets to mirror what the hiring manager is asking for."
            />
            <FeatureCard
              icon={<TipIcon fontSize="small" />}
              accent="#f59e0b"
              title="Tips — what's missing in your profile"
              blurb="AI scans your profile and surfaces the top 3-5 improvements ranked by impact."
            />
            <FeatureCard
              icon={<BoltIcon fontSize="small" />}
              accent="#16a34a"
              title="Per-section Enhance — fix one bullet at a time"
              blurb="Each Summary, Experience and Project field has its own Enhance button for granular rewrites."
            />
          </Box>
        )}

        {/* ─── Step 2: Choose Path ─── */}
        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <PathCard
              recommended
              loading={uploading}
              disabled={uploading}
              icon={<UploadFileIcon />}
              title="Upload my resume"
              badge="Fastest"
              description="Drop in a PDF or Word file. AI extracts your experience, skills and education in seconds."
              onClick={handleUploadClick}
            />
            <PathCard
              disabled={uploading}
              icon={<EditIcon />}
              title="Build it section by section"
              description="Fill in your details step by step. Use the Enhance buttons to polish each section."
              onClick={handleClose}
            />
            <PathCard
              disabled={uploading}
              icon={<AIIcon />}
              title="Start with AI preferences"
              badge="Guided"
              description="Answer a few questions about the role you want. AI drafts a starter profile you can refine."
              onClick={() => {
                handleClose();
                // The AI preferences wizard needs an account (it calls
                // AI endpoints along the way) — a guest goes to registration
                // instead of hitting an auth wall on the next page.
                navigate(isAuthenticated ? '/profile/preferences' : '/register?role=candidate');
              }}
            />
          </Box>
        )}
      </Box>

      {/* Footer with step dots + nav */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.75,
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fff',
        }}
      >
        {step > 0 ? (
          <Button
            onClick={goBack}
            disabled={uploading}
            startIcon={<BackIcon />}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 500 }}
          >
            Back
          </Button>
        ) : (
          <Button
            onClick={handleClose}
            disabled={uploading}
            sx={{ textTransform: 'none', color: '#94a3b8', fontWeight: 500 }}
          >
            {manualTrigger ? 'Close' : 'Skip'}
          </Button>
        )}

        <StepDots count={totalSteps} active={step} />

        {step < totalSteps - 1 ? (
          <Button
            onClick={goNext}
            endIcon={<ArrowIcon />}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              backgroundColor: '#0f172a',
              '&:hover': { backgroundColor: '#1e293b' },
            }}
          >
            {step === 0 ? "Show me how" : "Choose a path"}
          </Button>
        ) : (
          <Button
            onClick={handleClose}
            sx={{ textTransform: 'none', color: '#94a3b8', fontWeight: 500 }}
          >
            Close
          </Button>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </Dialog>
  );
};

export default ProfileWelcomeOnboardingModal;
