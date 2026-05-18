import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Button,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Chip,
  Paper,
} from '@mui/material';
import {
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  ArrowBack as BackIcon,
  Language as WebsiteIcon,
  LinkedIn as LinkedInIcon,
  Phone as PhoneIcon,
  People as PeopleIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import api, { followAPI, messageAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import FollowButton from '../../components/FollowButton';
import { ROUTES, TEXT, LOADING_SPINNER_SIZE } from './constants';
import { getFullName, getProfileImages } from './utils';
import {
  loadingContainerSx,
  loadingSpinnerSx,
  loadingTextSx,
  errorContainerSx,
  errorCardSx,
  errorMessageSx,
  errorButtonSx,
  pageWrapperSx,
  heroSectionSx,
  backButtonSx,
  profileCardOffsetSx,
  profileCardSx,
  profileCardContentSx,
  profileImageColumnSx,
  profileAvatarSx,
  companyLogoSx,
  nameRowSx,
  companyNameClickableSx,
  infoRowSx,
  infoItemSx,
  followCountsRowSx,
  followCountItemSx,
  actionButtonsRowSx,
  actionButtonSx,
  linkedinIconButtonSx,
  sectionsGridSx,
  sectionPaperSx,
  sectionTitleSx,
  sectionTextSx,
  contactPaperSx,
  contactItemSx,
  contactLinkSx,
} from './styled';

const RecruiterPublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followCounts, setFollowCounts] = useState({ followersCount: 0, followingCount: 0 });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/recruiter-profiles/${id}`);
        setProfile(response.data);
        
        // Fetch follow counts
        try {
          const countsResponse = await followAPI.getCounts(id);
          setFollowCounts(countsResponse.data);
        } catch (e) {
          console.log('Could not fetch follow counts:', e);
        }
      } catch (err) {
        console.error('Error fetching recruiter profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id]);

  const handleFollowChange = (isFollowing, counts) => {
    if (counts) {
      setFollowCounts(counts);
    }
  };

  const handleStartConversation = async () => {
    try {
      const response = await messageAPI.startConversation(id);
      navigate(ROUTES.MESSAGES_CONVERSATION(response.data.conversationId));
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={loadingContainerSx}>
        <CircularProgress sx={loadingSpinnerSx} size={LOADING_SPINNER_SIZE} />
        <Typography variant="h6" sx={loadingTextSx}>
          {TEXT.LOADING}
        </Typography>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box sx={errorContainerSx}>
        <Card sx={errorCardSx}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || TEXT.NOT_FOUND}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={errorMessageSx}>
            {TEXT.NOT_FOUND_MESSAGE}
          </Typography>
          <Button 
            variant="contained"
            component={Link}
            to={ROUTES.JOBS}
            startIcon={<BackIcon />}
            sx={errorButtonSx}
          >
            {TEXT.BACK_TO_JOBS}
          </Button>
        </Card>
      </Box>
    );
  }

  const user = profile.user || {};
  const fullName = getFullName(user);
  const { profileImage, companyLogo } = getProfileImages(profile);

  return (
    <Box sx={pageWrapperSx}>
      {/* Hero Section */}
      <Box sx={heroSectionSx}>
        <Container maxWidth="lg">
          <Button
            component={Link}
            to={ROUTES.JOBS}
            startIcon={<BackIcon />}
            sx={backButtonSx}
          >
            {TEXT.BACK_TO_JOBS}
          </Button>
        </Container>
      </Box>

      {/* Profile Card */}
      <Container maxWidth="lg" sx={profileCardOffsetSx}>
        <Card sx={profileCardSx}>
          <CardContent sx={profileCardContentSx}>
            <Grid container spacing={4}>
              {/* Profile Picture & Company Logo */}
              <Grid item xs={12} md={3}>
                <Box sx={profileImageColumnSx}>
                  <Avatar
                    src={profileImage}
                    sx={profileAvatarSx}
                  >
                    {fullName.charAt(0)}
                  </Avatar>
                  
                  {companyLogo && (
                    <Box
                      component="img"
                      src={companyLogo}
                      alt={profile.companyName}
                      sx={companyLogoSx}
                    />
                  )}
                </Box>
              </Grid>

              {/* Profile Info */}
              <Grid item xs={12} md={9}>
                <Box>
                  <Box sx={nameRowSx}>
                    <Typography variant="h4" fontWeight={700}>
                      {fullName}
                    </Typography>
                    <Chip label={TEXT.ROLE_CHIP} color="primary" />
                  </Box>

                  <Typography variant="h6" color="primary" fontWeight={500} mb={1}>
                    {profile.jobTitle}
                  </Typography>

                  <Typography 
                    variant="h5" 
                    color="text.secondary" 
                    mb={2}
                    sx={profile.companySlug ? companyNameClickableSx : undefined}
                    onClick={() => profile.companySlug && navigate(ROUTES.COMPANY(profile.companySlug))}
                  >
                    {profile.companyName}
                  </Typography>

                  {/* Info Row */}
                  <Box sx={infoRowSx}>
                    {profile.location && (
                      <Box sx={infoItemSx}>
                        <LocationIcon color="action" fontSize="small" />
                        <Typography color="text.secondary">{profile.location}</Typography>
                      </Box>
                    )}
                    {profile.industry && (
                      <Box sx={infoItemSx}>
                        <BusinessIcon color="action" fontSize="small" />
                        <Typography color="text.secondary">{profile.industry}</Typography>
                      </Box>
                    )}
                    {profile.companySize && (
                      <Box sx={infoItemSx}>
                        <PeopleIcon color="action" fontSize="small" />
                        <Typography color="text.secondary">{profile.companySize} {TEXT.EMPLOYEES_SUFFIX}</Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Follower/Following Counts */}
                  <Box sx={followCountsRowSx}>
                    <Box 
                      sx={followCountItemSx}
                      onClick={() => navigate(ROUTES.NETWORK(id))}
                    >
                      <Typography fontWeight={600} component="span">{followCounts.followersCount}</Typography>
                      <Typography color="text.secondary" component="span" ml={0.5}>{TEXT.FOLLOWERS}</Typography>
                    </Box>
                    <Box 
                      sx={followCountItemSx}
                      onClick={() => navigate(ROUTES.NETWORK(id))}
                    >
                      <Typography fontWeight={600} component="span">{followCounts.followingCount}</Typography>
                      <Typography color="text.secondary" component="span" ml={0.5}>{TEXT.FOLLOWING}</Typography>
                    </Box>
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={actionButtonsRowSx}>
                    {currentUser && currentUser.id !== id && (
                      <>
                        <FollowButton
                          userId={id}
                          size="large"
                          onFollowChange={handleFollowChange}
                          sx={actionButtonSx}
                        />
                        <Button
                          variant="outlined"
                          size="large"
                          startIcon={<ChatIcon />}
                          onClick={handleStartConversation}
                          sx={actionButtonSx}
                        >
                          {TEXT.MESSAGE}
                        </Button>
                      </>
                    )}
                    {profile.companyWebsite && (
                      <Button
                        variant="outlined"
                        size="large"
                        startIcon={<WebsiteIcon />}
                        href={profile.companyWebsite}
                        target="_blank"
                        sx={actionButtonSx}
                      >
                        {TEXT.WEBSITE}
                      </Button>
                    )}
                    {profile.companySlug && (
                      <Button
                        variant="outlined"
                        size="large"
                        startIcon={<BusinessIcon />}
                        onClick={() => navigate(ROUTES.COMPANY(profile.companySlug))}
                        sx={actionButtonSx}
                      >
                        {TEXT.COMPANY_PAGE}
                      </Button>
                    )}
                    {profile.linkedinUrl && (
                      <IconButton
                        href={profile.linkedinUrl}
                        target="_blank"
                        sx={linkedinIconButtonSx}
                      >
                        <LinkedInIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Bio & Company Description */}
        <Grid container spacing={3} sx={sectionsGridSx}>
          {profile.bio && (
            <Grid item xs={12} md={6}>
              <Paper sx={sectionPaperSx}>
                <Typography variant="h6" sx={sectionTitleSx}>
                  {TEXT.ABOUT_PREFIX} {user.firstName || 'Me'}
                </Typography>
                <Typography color="text.secondary" sx={sectionTextSx}>
                  {profile.bio}
                </Typography>
              </Paper>
            </Grid>
          )}
          
          {profile.companyDescription && (
            <Grid item xs={12} md={profile.bio ? 6 : 12}>
              <Paper sx={sectionPaperSx}>
                <Typography variant="h6" sx={sectionTitleSx}>
                  {TEXT.ABOUT_COMPANY(profile.companyName)}
                </Typography>
                <Typography color="text.secondary" sx={sectionTextSx}>
                  {profile.companyDescription}
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Contact Card */}
        <Paper sx={contactPaperSx}>
          <Typography variant="h6" sx={sectionTitleSx}>
            {TEXT.CONTACT_INFO}
          </Typography>
          <Grid container spacing={2}>
            {profile.phone && (
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={contactItemSx}>
                  <PhoneIcon color="action" />
                  <Typography>{profile.phone}</Typography>
                </Box>
              </Grid>
            )}
            {profile.companyWebsite && (
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={contactItemSx}>
                  <WebsiteIcon color="action" />
                  <Typography 
                    component="a" 
                    href={profile.companyWebsite} 
                    target="_blank"
                    sx={contactLinkSx}
                  >
                    {profile.companyWebsite}
                  </Typography>
                </Box>
              </Grid>
            )}
            {profile.linkedinUrl && (
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={contactItemSx}>
                  <LinkedInIcon color="action" />
                  <Typography 
                    component="a" 
                    href={profile.linkedinUrl} 
                    target="_blank"
                    sx={contactLinkSx}
                  >
                    {TEXT.LINKEDIN}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default RecruiterPublicProfile;
