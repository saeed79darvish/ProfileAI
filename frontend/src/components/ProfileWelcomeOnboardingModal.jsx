import React, { useRef, useState } from 'react';
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
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { profileAPI } from '@/services/api';

/**
 * First-time welcome shown on /profile/edit when the user has an empty
 * profile and has not seen the intro yet. Offers three clear paths:
 *  1. Upload resume → AI parses & pre-fills the form
 *  2. Build from scratch → close the modal and start filling in
 *  3. Start with AI preferences wizard → guided AI-led setup
 *
 * Persists "seen" state in localStorage so it only appears once per user.
 * Triggered by the parent (ProfileForm) which controls the `open` prop.
 */

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

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
      p: 2.5,
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
      '&:focus-visible': {
        outline: '2px solid #6366f1',
        outlineOffset: 2,
      },
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
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>
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
      <Typography variant="body2" sx={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
        {description}
      </Typography>
    </Box>
    <ArrowIcon sx={{ color: '#94a3b8', flexShrink: 0, mt: 0.5 }} />
  </Box>
);

const ProfileWelcomeOnboardingModal = ({ open, onClose, onResumeParsed, userName }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUploadClick = () => {
    if (uploading) return;
    setError('');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow reselecting the same file
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
      const res = await profileAPI.uploadResume(form);
      if (res.data?.success && res.data?.data) {
        onResumeParsed?.(res.data.data);
        onClose?.();
      } else {
        setError(res.data?.error || 'Could not parse this resume. Try another file or fill in manually.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualStart = () => {
    onClose?.();
    // No navigation — just close so the user lands in the editor with focus.
    // ProfileForm will scroll to the first section.
  };

  const handlePreferencesStart = () => {
    onClose?.();
    navigate('/profile/preferences');
  };

  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Header banner */}
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
          onClick={onClose}
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
            }}
          >
            <AIIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, opacity: 0.9 }}>
            Welcome to ProfileAI
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.5 }}>
          {userName ? `Hi ${userName}, let's build your profile` : "Let's build your profile"}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, fontSize: 13.5 }}>
          Pick the way that works best for you. You can always switch later.
        </Typography>
      </Box>

      <Box sx={{ p: 3, backgroundColor: '#fafafa' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
            description="Fill in your details step by step. Use the AI Enhance button on each section to polish your wording."
            onClick={handleManualStart}
          />
          <PathCard
            disabled={uploading}
            icon={<AIIcon />}
            title="Start with AI preferences"
            badge="Guided"
            description="Answer a few questions about the role you want. AI drafts a starter profile you can refine."
            onClick={handlePreferencesStart}
          />
        </Box>

        <Box sx={{ mt: 2.5, p: 1.75, borderRadius: 2, backgroundColor: '#fff', border: '1px solid #e5e7eb' }}>
          <Typography
            variant="overline"
            sx={{ color: '#64748b', fontWeight: 700, fontSize: 10.5, letterSpacing: 1 }}
          >
            What you'll unlock
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 0.75 }}>
            {[
              'AI rewrites for summary & roles',
              'Tailor to any job description',
              'Personalized improvement tips',
            ].map((t) => (
              <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckIcon sx={{ fontSize: 15, color: '#16a34a' }} />
                <Typography variant="caption" sx={{ color: '#475569', fontSize: 12 }}>
                  {t}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            onClick={onClose}
            disabled={uploading}
            sx={{ textTransform: 'none', color: '#64748b', fontWeight: 500 }}
          >
            Skip for now
          </Button>
        </Box>
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
