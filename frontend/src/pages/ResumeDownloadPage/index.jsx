import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { profileAPI } from '@/services/api';
import ResumePreviewModal from '@/components/ResumePreviewModal';

/**
 * Full-page wrapper around <ResumePreviewModal />.
 *
 * This route (`/resume/download`) is reached from:
 *   - The Chrome extension after tailoring a resume
 *   - Direct navigation
 *
 * To keep the download UI 100% identical across the app, we render the same
 * <ResumePreviewModal/> used by the Jobs page. This page only handles auth and
 * loading the (optional) tailored profile payload from the extension.
 */
const ResumeDownloadPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();

  const fromExtension = searchParams.get('ext') === '1';
  const overlayMode = searchParams.get('overlay') === '1';

  // In overlay mode the page is loaded inside an iframe rendered on top of the
  // user's job application page. Make body/html transparent so the modal
  // appears to float on top of the underlying page.
  useEffect(() => {
    if (!overlayMode) return;
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, [overlayMode]);

  const [loading, setLoading] = useState(true);
  const [waitingForAuth, setWaitingForAuth] = useState(fromExtension && !user);
  const [profileData, setProfileData] = useState(null);
  const [tailoredProfile, setTailoredProfile] = useState(null);

  // For extension flow: wait briefly for content script to inject auth
  useEffect(() => {
    if (!fromExtension) return;
    if (user) {
      setWaitingForAuth(false);
      return;
    }
    const handleMessage = (event) => {
      if (event.data?.type === 'PROFILEAI_AUTH_SUCCESS') setWaitingForAuth(false);
    };
    window.addEventListener('message', handleMessage);
    const timer = setTimeout(() => setWaitingForAuth(false), 3000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, [fromExtension, user]);

  useEffect(() => {
    if (waitingForAuth) return;

    if (!user || !token) {
      if (!fromExtension) {
        navigate('/login?from=extension&returnUrl=' + encodeURIComponent(window.location.href));
      }
      return;
    }

    const finish = (tailored) => {
      if (tailored) setTailoredProfile(tailored);
      setLoading(false);
    };

    const fetchMyProfile = async () => {
      try {
        const { data } = await profileAPI.getMyProfile();
        const skills = data?.skills && !Array.isArray(data.skills) && typeof data.skills === 'object'
          ? Object.values(data.skills).flat()
          : (data?.skills || []);
        setProfileData({
          title: data?.title || '',
          summary: data?.summary || '',
          skills,
          experience: data?.experience || [],
          education: data?.education || [],
          projects: data?.projects || [],
          phone: data?.phone || '',
          location: data?.location || '',
          linkedinUrl: data?.linkedinUrl || '',
          githubUrl: data?.githubUrl || '',
          portfolioUrl: data?.portfolioUrl || '',
        });
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    };

    const load = async () => {
      // 1) Try localStorage handoff (used by AchieveShare / web flows)
      try {
        const storedData = localStorage.getItem('profileai_tailored_profile');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          localStorage.removeItem('profileai_tailored_profile');
          await fetchMyProfile();
          finish(parsed);
          return;
        }
      } catch (e) {
        console.error('Error reading from localStorage:', e);
      }

      // 2) Try Chrome extension postMessage handoff
      if (fromExtension && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          let received = false;
          const handleMessage = (event) => {
            if (event.data?.type === 'PROFILEAI_TAILORED_PROFILE') {
              received = true;
              window.removeEventListener('message', handleMessage);
              fetchMyProfile().then(() => finish(event.data.profile));
            }
          };
          window.addEventListener('message', handleMessage);
          window.postMessage({ type: 'PROFILEAI_REQUEST_TAILORED_DATA' }, window.location.origin);
          setTimeout(() => {
            if (!received) {
              window.removeEventListener('message', handleMessage);
              fetchMyProfile().then(() => finish(null));
            }
          }, 3000);
          return;
        } catch (e) {
          console.error('Error communicating with extension:', e);
        }
      }

      // 3) No tailored data, load main profile
      await fetchMyProfile();
      finish(null);
    };

    load();
  }, [user, token, navigate, fromExtension, waitingForAuth]);

  const handleClose = () => {
    // Notify the content script. In overlay mode the content script removes the
    // iframe overlay; in standalone tab mode it closes the tab.
    window.postMessage({ type: 'PROFILEAI_CLOSE_TAB' }, window.location.origin);
    if (!overlayMode) {
      window.close();
      setTimeout(() => navigate('/dashboard'), 300);
    }
  };

  if (loading || waitingForAuth) {
    // In overlay mode the iframe sits on top of the user's job page with a
    // dark blurred backdrop. Showing a white "Loading..." card on top of it
    // looks broken — render only a subtle centered spinner instead so the
    // unified ResumePreviewModal can appear cleanly once data is ready.
    if (overlayMode) {
      return (
        <Box sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}>
          <CircularProgress size={48} sx={{ color: '#fff' }} />
        </Box>
      );
    }
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4 }}>
          <CircularProgress size={60} sx={{ color: '#667eea', mb: 3 }} />
          <Typography variant="h6">Loading...</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      background: overlayMode ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <ResumePreviewModal
        open
        onClose={handleClose}
        profileData={profileData}
        tailoredProfileData={tailoredProfile}
        jobTitle={tailoredProfile?.jobTitle}
        user={user}
      />
    </Box>
  );
};

export default ResumeDownloadPage;
