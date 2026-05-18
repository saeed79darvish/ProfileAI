import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, CircularProgress, Typography } from '@mui/material';
import {
  AutoAwesome as AIIcon,
  ArrowForward as ArrowIcon,
  CloudUpload as CloudUploadIcon,
  Description as DocIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  fadeIn,
  PageContainer,
  TopBar,
  Logo,
  MainContent,
  ContentWrapper,
  WelcomeBubble,
  ChoiceGrid,
  ChoiceCard,
  IconCircle,
  CardButton,
  FeatureTag,
  UploadOverlay
} from './styled';
import { ROUTES, TEXT, ALLOWED_FILE_TYPES, VALIDATION } from './constants';
import { profileAPI } from '../../services/api';

/* ═══════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   WELCOME BUBBLE
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   CHOICE CARDS
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   UPLOAD PROGRESS OVERLAY
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

const ProfileCreation = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const triggerUpload = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleUploadKeyDown = (e) => {
    if (uploading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerUpload();
    }
  };

  const handleManualKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleManualCreate();
    }
  };

  const handleUploadResume = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError(TEXT.ERROR_FILE_TYPE);
      return;
    }
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      setError(TEXT.ERROR_FILE_SIZE);
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await profileAPI.uploadResume(formData);

      if (response.data.success) {
        navigate(ROUTES.CREATE_FORM, {
          state: { resumeData: response.data.data }
        });
      } else {
        setError(TEXT.ERROR_PARSE);
      }
    } catch (err) {
      console.error('Error uploading resume:', err);
      setError(
        err.response?.data?.error ||
          TEXT.ERROR_UPLOAD
      );
    } finally {
      setUploading(false);
    }
  };

  const handleManualCreate = () => {
    navigate(ROUTES.PREFERENCES);
  };

  return (
    <PageContainer>
      <TopBar>
        <Logo onClick={() => navigate(ROUTES.HOME)}>
          <AIIcon />
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1.15rem',
              letterSpacing: '-0.3px',
              color: '#1a1a2e'
            }}
          >
            ProfileAI
          </Typography>
        </Logo>
      </TopBar>

      <MainContent>
        <ContentWrapper>
          {/* Header */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: { xs: '1.5rem', md: '2rem' },
                fontWeight: 700,
                color: '#1a1a2e',
                letterSpacing: '-0.5px',
                mb: 2
              }}
            >
              {TEXT.PAGE_TITLE}
            </Typography>

            <WelcomeBubble>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  fontSize: 16,
                  fontWeight: 700
                }}
              >
                P
              </Avatar>
              <Box sx={{ textAlign: 'left' }}>
                <Typography sx={{ fontSize: 11.5, color: '#999', lineHeight: 1.2 }}>
                  ProfileAI
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                  {TEXT.WELCOME_MESSAGE}
                </Typography>
              </Box>
            </WelcomeBubble>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: '12px', maxWidth: 500, mx: 'auto' }}
            >
              {error}
            </Alert>
          )}

          {/* Two cards */}
          <ChoiceGrid>
            {/* Upload Resume */}
            <ChoiceCard
              $disabled={uploading}
              role="button"
              tabIndex={uploading ? -1 : 0}
              aria-disabled={uploading}
              aria-label={TEXT.UPLOAD_TITLE}
              onClick={triggerUpload}
              onKeyDown={handleUploadKeyDown}
            >
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".pdf,.doc,.docx"
                onChange={handleUploadResume}
                disabled={uploading}
              />

              <IconCircle>
                <CloudUploadIcon />
              </IconCircle>

              {uploading ? (
                <UploadOverlay>
                  <CircularProgress
                    size={32}
                    sx={{ color: '#667eea' }}
                  />
                  <Typography
                    sx={{ fontSize: 14, fontWeight: 600, color: '#667eea' }}
                  >
                    {TEXT.PARSING_TITLE}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#999' }}>
                    {TEXT.PARSING_SUBTITLE}
                  </Typography>
                </UploadOverlay>
              ) : (
                <>
                  <Typography
                    sx={{ fontWeight: 700, fontSize: 17, color: '#1a1a2e', mb: 0.5 }}
                  >
                    {TEXT.UPLOAD_TITLE}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 13.5, color: '#666', lineHeight: 1.5, mb: 2 }}
                  >
                    {TEXT.UPLOAD_DESCRIPTION}
                  </Typography>
                  <FeatureTag>
                    <AIIcon sx={{ fontSize: 14 }} /> {TEXT.UPLOAD_TAG}
                  </FeatureTag>
                </>
              )}

              <Box sx={{ flexGrow: 1 }} />

              <CardButton style={{ marginTop: 20 }}>
                <CloudUploadIcon /> {TEXT.UPLOAD_TITLE}
              </CardButton>
            </ChoiceCard>

            {/* Manual Create */}
            <ChoiceCard
              role="button"
              tabIndex={0}
              aria-label={TEXT.MANUAL_TITLE}
              onClick={handleManualCreate}
              onKeyDown={handleManualKeyDown}
            >
              <IconCircle
                $gradient="linear-gradient(135deg, #f093fb, #f5576c)"
                $shadow="rgba(240,147,251,0.3)"
              >
                <EditIcon />
              </IconCircle>

              <Typography
                sx={{ fontWeight: 700, fontSize: 17, color: '#1a1a2e', mb: 0.5 }}
              >
                {TEXT.MANUAL_TITLE}
              </Typography>
              <Typography
                sx={{ fontSize: 13.5, color: '#666', lineHeight: 1.5, mb: 2 }}
              >
                {TEXT.MANUAL_DESCRIPTION}
              </Typography>
              <FeatureTag $bg="rgba(240,147,251,0.08)" $color="#d946a8">
                <DocIcon sx={{ fontSize: 14 }} /> {TEXT.MANUAL_TAG}
              </FeatureTag>

              <Box sx={{ flexGrow: 1 }} />

              <CardButton
                $bg="linear-gradient(135deg, #f093fb, #f5576c)"
                style={{ marginTop: 20 }}
              >
                {TEXT.MANUAL_BUTTON} <ArrowIcon />
              </CardButton>
            </ChoiceCard>
          </ChoiceGrid>

          {/* Footer note */}
          <Typography
            sx={{
              textAlign: 'center',
              mt: 4,
              color: '#999',
              fontSize: 13
            }}
          >
            {TEXT.FOOTER}
          </Typography>
        </ContentWrapper>
      </MainContent>
    </PageContainer>
  );
};

export default ProfileCreation;
