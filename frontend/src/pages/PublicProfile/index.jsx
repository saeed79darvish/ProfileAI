import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, Button, CircularProgress, Alert, Snackbar, useMediaQuery } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { profileAPI, resolveImageUrl } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import SEO from '@/components/SEO';
import PublicProfileMobile from './PublicProfileMobile';
import PublicProfileDesktop from './PublicProfileDesktop';

const PublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  // Phones and desktops get the same page in two layouts.
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);

  // Get the shareable profile URL
  const profileUrl = `${window.location.origin}/profile/${id}`;
  
  // Copy profile URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setShowCopiedSnackbar(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  // Share profile
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.user?.firstName || 'Profile'}'s Portfolio`,
          text: `Check out this amazing profile on ProfilleAI!`,
          url: profileUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await profileAPI.getPublicProfile(id);
        setProfile(response.data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CircularProgress sx={{ color: 'white', mb: 2 }} size={60} />
        <Typography variant="h6" sx={{ color: 'white', opacity: 0.9 }}>
          Loading Portfolio...
        </Typography>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 4, maxWidth: 400 }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || 'Profile not found'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            The profile you're looking for doesn't exist or has been removed.
          </Typography>
          <Button 
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/browse')}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 2,
            }}
          >
            Back to Browse
          </Button>
        </Card>
      </Box>
    );
  }


  // Map backend profile data
  const user = profile.user || {};
  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : profile.title || 'User';
  const email = user.email || '';
  const phone = profile.phone || profile.phoneNumber || '';
  const location = profile.location || '';
  const bio = profile.summary || profile.aiSummary || '';
  // profile.title is the user's explicitly-entered job title (canonical).
  // profile.headline is an optional AI-generated tagline that can differ.
  // Always prefer the explicit title so the public profile matches the editor.
  const headline = profile.title || profile.headline || '';
  
  // Skills can be stored either as a flat array or as a categorized object
  // ({ core: [], technical: [], software: [], tools: [], soft: [] }). Flatten
  // for counts/top-skill and preserve the grouped form for the Skills section.
  const SKILL_CATEGORY_LABELS = {
    core: 'Core',
    technical: 'Technical',
    software: 'Software & Tools',
    tools: 'Tools',
    soft: 'Soft Skills',
  };
  const skillsByCategory = (() => {
    const raw = profile.skills;
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.length ? { technical: raw.filter(Boolean) } : {};
    if (typeof raw === 'object') {
      const out = {};
      for (const [key, list] of Object.entries(raw)) {
        if (Array.isArray(list) && list.length) out[key] = list.filter(Boolean);
      }
      return out;
    }
    return {};
  })();
  const skills = Object.values(skillsByCategory).flat();
  
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  // Fall back to the OAuth photo (User.profilePictureUrl) when the candidate
  // hasn't uploaded a separate Profile.profilePicture. The authenticated
  // navbar already self-heals via the GET /profiles/me backfill, but the
  // public endpoint is read-only and would otherwise show an initial
  // avatar to recruiters even though the candidate has an OAuth photo.
  const profileImage = resolveImageUrl(profile.profilePicture || profile.user?.profilePictureUrl) || '';
  
  // Helper to ensure URLs have proper protocol
  const ensureHttps = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };
  
  const certifications = Array.isArray(profile.certifications) ? profile.certifications : [];
  const rawAvailability = profile.availabilityStatus || 'Open to Work';
  const availability = rawAvailability.toLowerCase() === 'open' ? 'Open to Work' : rawAvailability;
  const portfolioUrl = ensureHttps(profile.portfolioUrl);
  const socialLinks = {
    linkedin: ensureHttps(profile.linkedinUrl),
    github: ensureHttps(profile.githubUrl),
    twitter: ensureHttps(profile.twitterUrl),
    website: ensureHttps(profile.websiteUrl),
  };

  // Sum (endDate − startDate) per role; treat "Present"/missing endDate as today.
  // Output: integer years and a flag for any currently-active role (renders "+").
  const { yearsOfExperience, hasOngoingRole } = (() => {
    const parseDate = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      if (!s) return null;
      if (/^(present|current)$/i.test(s)) return new Date();
      // Year-only like "2018"
      if (/^\d{4}$/.test(s)) return new Date(parseInt(s, 10), 0, 1);
      // YYYY-MM, YYYY/MM, YYYY-MM-DD, etc.
      const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(parseInt(y, 10), parseInt(m, 10) - 1, d ? parseInt(d, 10) : 1);
      }
      const parsed = new Date(s);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const today = new Date();
    let totalMs = 0;
    let ongoing = false;
    for (const exp of experience) {
      const start = parseDate(exp.startDate);
      const isPresent = !exp.endDate || /^(present|current)$/i.test(String(exp.endDate).trim()) || exp.current === true;
      const end = isPresent ? today : parseDate(exp.endDate);
      if (isPresent) ongoing = true;
      if (start && end && end >= start) {
        totalMs += end.getTime() - start.getTime();
      }
    }
    const years = totalMs > 0 ? Math.floor(totalMs / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    return { yearsOfExperience: years, hasOngoingRole: ongoing };
  })();
  const yearsLabel = `${yearsOfExperience}${hasOngoingRole ? '+' : ''}`;

  const seo = (
      <SEO
        title={`${fullName}${headline ? `: ${headline}` : ''}`}
        description={(bio || `${fullName}'s professional profile on ProfilleAI.`).replace(/<[^>]+>/g, '').slice(0, 200)}
        path={`/profile/${id}`}
        type="profile"
        image={profileImage}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: fullName,
          jobTitle: headline || undefined,
          description: (bio || '').replace(/<[^>]+>/g, '').slice(0, 500) || undefined,
          image: profileImage || undefined,
          address: location
            ? { '@type': 'PostalAddress', addressLocality: location }
            : undefined,
          url: `https://www.profilleai.com/profile/${id}`,
        }}
      />
  );
  const copiedSnackbar = (
    <>
      {/* Copy Link Success Snackbar */}
      <Snackbar
        open={showCopiedSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowCopiedSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: { xs: 8, md: 0 } }}
      >
        <Alert 
          onClose={() => setShowCopiedSnackbar(false)} 
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          Profile link copied to clipboard!
        </Alert>
      </Snackbar>
    </>
  );


  const ownerId = profile.userId || profile.user?.id;
  // Grouped skills keep the editor's categories; one category reads as a flat list.
  const skillGroups = Object.keys(skillsByCategory).length > 1
    ? Object.entries(skillsByCategory).map(([key, list]) => ({ label: SKILL_CATEGORY_LABELS[key] || key, skills: list }))
    : [];
  const Layout = isMobile ? PublicProfileMobile : PublicProfileDesktop;

  return (
    <>
      {seo}
      <Layout
        profileId={id}
        fullName={fullName}
        headline={headline}
        location={location}
        availability={availability}
        profileImage={profileImage}
        bio={bio}
        experience={experience}
        education={education}
        projects={projects}
        certifications={certifications}
        skills={skills}
        skillGroups={skillGroups}
        yearsOfExperience={yearsOfExperience}
        yearsLabel={yearsLabel}
        email={email}
        phone={phone}
        socialLinks={socialLinks}
        portfolioUrl={portfolioUrl}
        profileUrl={profileUrl}
        isOwner={!!currentUser?.id && !!ownerId && String(currentUser.id) === String(ownerId)}
        isSignedIn={!!currentUser}
        isRecruiter={currentUser?.role === 'recruiter'}
        onCopyLink={handleCopyLink}
        onShare={handleShare}
        navigate={navigate}
      />
      {copiedSnackbar}
    </>
  );
};

export default PublicProfile;
