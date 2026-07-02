import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Avatar,
  IconButton,
  InputAdornment,
  Paper,
  Tooltip,
  Link
} from '@mui/material';
import {
  PageHeader,
  FormSection,
  SectionTitle,
  CompanyLogoContainer,
  LogoPreview,
  ProfilePicPreview,
  ViewModeCard,
  ProfileHeader,
  InfoItem,
  ChipInput
} from './styled';
import { ROUTES, COMPANY_SIZES, INDUSTRIES, TIMINGS, VALIDATION, AVATAR_SIZE } from './constants';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

const RecruiterProfileForm = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [enhancingDescription, setEnhancingDescription] = useState(false);
  const [enhancingBio, setEnhancingBio] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  
  const [formData, setFormData] = useState({
    // Company Info
    companyName: '',
    companyWebsite: '',
    companySize: '',
    industry: '',
    companyDescription: '',
    companyLogo: '',
    location: '',
    
    // Recruiter Info
    jobTitle: '',
    phone: '',
    linkedinUrl: '',
    bio: '',
    profilePicture: '',
    
    // Preferences
    preferences: {
      industries: [],
      skills: [],
      locations: []
    }
  });
  
  const [newSkill, setNewSkill] = useState('');
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await recruiterProfileAPI.getMyProfile();
      if (response.data && response.data.id) {
        setFormData({
          companyName: response.data.companyName || '',
          companyWebsite: response.data.companyWebsite || '',
          companySize: response.data.companySize || '',
          industry: response.data.industry || '',
          companyDescription: response.data.companyDescription || '',
          companyLogo: response.data.companyLogo || '',
          location: response.data.location || '',
          jobTitle: response.data.jobTitle || '',
          phone: response.data.phone || '',
          linkedinUrl: response.data.linkedinUrl || '',
          bio: response.data.bio || '',
          profilePicture: response.data.profilePicture || '',
          preferences: response.data.preferences || { industries: [], skills: [], locations: [] }
        });
        setHasExistingProfile(true);
        setIsEditMode(false);
      } else {
        setIsEditMode(true);
      }
    } catch (err) {
      console.log('No existing profile, starting fresh');
      setIsEditMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !formData.preferences.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          skills: [...prev.preferences.skills, newSkill.trim()]
        }
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        skills: prev.preferences.skills.filter(s => s !== skill)
      }
    }));
  };

  const handleAddLocation = () => {
    if (newLocation.trim() && !formData.preferences.locations.includes(newLocation.trim())) {
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          locations: [...prev.preferences.locations, newLocation.trim()]
        }
      }));
      setNewLocation('');
    }
  };

  const handleRemoveLocation = (location) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        locations: prev.preferences.locations.filter(l => l !== location)
      }
    }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        setError('');
        console.log('Uploading company logo...', file.name);
        const response = await recruiterProfileAPI.uploadImage(file);
        console.log('Upload response:', response.data);
        const imageUrl = response.data.imageUrl;
        console.log('Setting companyLogo to:', imageUrl);
        setFormData(prev => ({
          ...prev,
          companyLogo: imageUrl
        }));
        setSuccess('Company logo uploaded successfully! Click "Save Profile" to apply changes.');
      } catch (err) {
        console.error('Logo upload error:', err);
        setError('Failed to upload company logo: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        setError('');
        console.log('Uploading profile picture...', file.name);
        const response = await recruiterProfileAPI.uploadImage(file);
        console.log('Upload response:', response.data);
        const imageUrl = response.data.imageUrl;
        console.log('Setting profilePicture to:', imageUrl);
        setFormData(prev => ({
          ...prev,
          profilePicture: imageUrl
        }));
        setSuccess('Profile picture uploaded successfully! Click "Save Profile" to apply changes.');
      } catch (err) {
        console.error('Profile picture upload error:', err);
        setError('Failed to upload profile picture: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    }
  };

  // AI Enhancement for Company Description
  const handleEnhanceCompanyDescription = async () => {
    if (!formData.companyDescription || formData.companyDescription.trim().length < 10) {
      setError('Please add a company description first (at least 10 characters)');
      return;
    }

    setEnhancingDescription(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/profiles/enhance-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          text: formData.companyDescription,
          type: 'company_description',
          context: {
            companyName: formData.companyName,
            industry: formData.industry,
            companySize: formData.companySize
          }
        })
      });

      const data = await response.json();
      
      if (data.success && data.enhancedText) {
        setFormData(prev => ({ ...prev, companyDescription: data.enhancedText }));
        setSuccess('Company description enhanced!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to enhance description');
      }
    } catch (err) {
      setError('Failed to enhance description. Please try again.');
    } finally {
      setEnhancingDescription(false);
    }
  };

  // AI Enhancement for Recruiter Bio
  const handleEnhanceBio = async () => {
    if (!formData.bio || formData.bio.trim().length < 10) {
      setError('Please add your bio first (at least 10 characters)');
      return;
    }

    setEnhancingBio(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/profiles/enhance-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          text: formData.bio,
          type: 'recruiter_bio',
          context: {
            jobTitle: formData.jobTitle,
            companyName: formData.companyName
          }
        })
      });

      const data = await response.json();
      
      if (data.success && data.enhancedText) {
        setFormData(prev => ({ ...prev, bio: data.enhancedText }));
        setSuccess('Bio enhanced!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to enhance bio');
      }
    } catch (err) {
      setError('Failed to enhance bio. Please try again.');
    } finally {
      setEnhancingBio(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await recruiterProfileAPI.createOrUpdate(formData);
      // Refresh user data to update profile picture in auth context
      await refreshUser();
      setSuccess('Profile saved successfully!');
      setHasExistingProfile(true);
      setIsEditMode(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // VIEW MODE - Show profile after saving
  if (!isEditMode && hasExistingProfile) {
    return (
      <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', pb: 6 }}>
        {/* Profile Header */}
        <ProfileHeader>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setIsEditMode(true)}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                }}
              >
                Edit Profile
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 4 }}>
              {/* Profile Picture */}
              <Avatar
                src={resolveImageUrl(formData.profilePicture)}
                sx={{ 
                  width: 150, 
                  height: 150, 
                  border: '4px solid white',
                  fontSize: '3rem',
                  bgcolor: 'rgba(255,255,255,0.2)'
                }}
              >
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </Avatar>
              
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                <Typography variant="h4" fontWeight="700" gutterBottom>
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  {formData.jobTitle || 'Recruiter'}
                </Typography>
                {formData.companyName && (
                  <Typography variant="body1" sx={{ opacity: 0.8, mt: 1, display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                    <CompanyIcon fontSize="small" /> {formData.companyName}
                  </Typography>
                )}
                {formData.location && (
                  <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}>
                    <LocationIcon fontSize="small" /> {formData.location}
                  </Typography>
                )}
              </Box>
            </Box>
          </Container>
        </ProfileHeader>

        <Container maxWidth="lg" sx={{ mt: -4 }}>
          {success && (
            <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircleIcon />}>
              {success}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={8}>
              {/* About Me */}
              {formData.bio && (
                <ViewModeCard>
                  <CardContent>
                    <SectionTitle variant="h6" fontWeight="600">
                      <PersonIcon /> About Me
                    </SectionTitle>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
                      {formData.bio}
                    </Typography>
                  </CardContent>
                </ViewModeCard>
              )}

              {/* Company Information */}
              <ViewModeCard>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {formData.companyLogo ? (
                      <Avatar src={resolveImageUrl(formData.companyLogo)} sx={{ width: 60, height: 60 }} />
                    ) : (
                      <Avatar sx={{ width: 60, height: 60, bgcolor: '#7c3aed' }}>
                        <CompanyIcon />
                      </Avatar>
                    )}
                    <Box>
                      <Typography variant="h6" fontWeight="600">
                        {formData.companyName || 'Company Name'}
                      </Typography>
                      {formData.industry && (
                        <Chip label={formData.industry} size="small" color="primary" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  {formData.companyDescription && (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8, mb: 2 }}>
                      {formData.companyDescription}
                    </Typography>
                  )}

                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {formData.companySize && (
                      <Grid item xs={12} sm={6}>
                        <InfoItem>
                          <GroupsIcon />
                          <Typography variant="body2">{formData.companySize} employees</Typography>
                        </InfoItem>
                      </Grid>
                    )}
                    {formData.companyWebsite && (
                      <Grid item xs={12} sm={6}>
                        <InfoItem>
                          <WebsiteIcon />
                          <Link href={formData.companyWebsite.startsWith('http') ? formData.companyWebsite : `https://${formData.companyWebsite}`} target="_blank" rel="noopener">
                            {formData.companyWebsite}
                          </Link>
                        </InfoItem>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </ViewModeCard>

              {/* Hiring Preferences */}
              {(formData.preferences.skills.length > 0 || formData.preferences.locations.length > 0) && (
                <ViewModeCard>
                  <CardContent>
                    <SectionTitle variant="h6" fontWeight="600">
                      <WorkIcon /> Hiring Preferences
                    </SectionTitle>
                    <Divider sx={{ mb: 2 }} />
                    
                    {formData.preferences.skills.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                          Skills I'm Looking For
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formData.preferences.skills.map((skill, index) => (
                            <Chip key={index} label={skill} color="primary" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    {formData.preferences.locations.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                          Hiring Locations
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formData.preferences.locations.map((location, index) => (
                            <Chip key={index} label={location} color="secondary" variant="outlined" icon={<LocationIcon />} />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </ViewModeCard>
              )}
            </Grid>

            {/* Right Column - Contact Info */}
            <Grid item xs={12} md={4}>
              <ViewModeCard>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    Contact Information
                  </SectionTitle>
                  <Divider sx={{ mb: 2 }} />
                  
                  {user?.email && (
                    <InfoItem>
                      <EmailIcon />
                      <Typography variant="body2">{user.email}</Typography>
                    </InfoItem>
                  )}
                  
                  {formData.phone && (
                    <InfoItem>
                      <PhoneIcon />
                      <Typography variant="body2">{formData.phone}</Typography>
                    </InfoItem>
                  )}
                  
                  {formData.linkedinUrl && (
                    <InfoItem>
                      <LinkedInIcon />
                      <Link href={formData.linkedinUrl.startsWith('http') ? formData.linkedinUrl : `https://${formData.linkedinUrl}`} target="_blank" rel="noopener">
                        LinkedIn Profile
                      </Link>
                    </InfoItem>
                  )}
                  
                  {formData.location && (
                    <InfoItem>
                      <LocationIcon />
                      <Typography variant="body2">{formData.location}</Typography>
                    </InfoItem>
                  )}
                </CardContent>
              </ViewModeCard>

              <Paper sx={{ p: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    py: 1.5,
                    mb: 2
                  }}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/recruiter/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  }

  // EDIT MODE
  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh', pb: 6 }}>
      <PageHeader>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight="700" gutterBottom>
            Recruiting Company Profile
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Set up your recruiting company profile to connect with top candidates
          </Typography>
        </Container>
      </PageHeader>

      <Container maxWidth="lg">
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Left Column - Company Info */}
            <Grid item xs={12} md={8}>
              {/* Company Information */}
              <FormSection>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    <CompanyIcon /> Recruiting Company Information
                  </SectionTitle>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Company Name"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Company Website"
                        name="companyWebsite"
                        value={formData.companyWebsite}
                        onChange={handleChange}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WebsiteIcon />
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        label="Company Size"
                        name="companySize"
                        value={formData.companySize}
                        onChange={handleChange}
                      >
                        {COMPANY_SIZES.map(size => (
                          <MenuItem key={size.value} value={size.value}>
                            {size.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        select
                        label="Industry"
                        name="industry"
                        value={formData.industry}
                        onChange={handleChange}
                      >
                        {INDUSTRIES.map(ind => (
                          <MenuItem key={ind} value={ind}>
                            {ind}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Headquarters Location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LocationIcon />
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label="Company Description"
                          name="companyDescription"
                          value={formData.companyDescription}
                          onChange={handleChange}
                          placeholder="Tell candidates about your company, culture, and what makes you unique..."
                        />
                        <Tooltip title="Enhance with AI">
                          <span>
                            <Button
                              variant="outlined"
                              onClick={handleEnhanceCompanyDescription}
                              disabled={enhancingDescription || !formData.companyDescription || formData.companyDescription.length < 10}
                              sx={{ 
                                minWidth: 'auto', 
                                p: 1,
                                mt: 1,
                                borderColor: '#7c3aed',
                                color: '#7c3aed',
                                '&:hover': {
                                  borderColor: '#6d28d9',
                                  backgroundColor: 'rgba(124, 58, 237, 0.04)'
                                }
                              }}
                            >
                              {enhancingDescription ? <CircularProgress size={20} /> : <AIIcon />}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </FormSection>

              {/* Recruiter Information */}
              <FormSection>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    <PersonIcon /> Your Information
                  </SectionTitle>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Your Job Title"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleChange}
                        placeholder="e.g., Senior Technical Recruiter"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Phone Number"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon />
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="LinkedIn Profile"
                        name="linkedinUrl"
                        value={formData.linkedinUrl}
                        onChange={handleChange}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LinkedInIcon />
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="About You"
                          name="bio"
                          value={formData.bio}
                          onChange={handleChange}
                          placeholder="Tell candidates a bit about yourself and your recruiting experience..."
                        />
                        <Tooltip title="Enhance with AI">
                          <span>
                            <Button
                              variant="outlined"
                              onClick={handleEnhanceBio}
                              disabled={enhancingBio || !formData.bio || formData.bio.length < 10}
                              sx={{ 
                                minWidth: 'auto', 
                                p: 1,
                                mt: 1,
                                borderColor: '#7c3aed',
                                color: '#7c3aed',
                                '&:hover': {
                                  borderColor: '#6d28d9',
                                  backgroundColor: 'rgba(124, 58, 237, 0.04)'
                                }
                              }}
                            >
                              {enhancingBio ? <CircularProgress size={20} /> : <AIIcon />}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </FormSection>

              {/* Hiring Preferences */}
              <FormSection>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    <WorkIcon /> Hiring Preferences
                  </SectionTitle>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Skills You're Looking For
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Add a skill..."
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                        />
                        <Button variant="outlined" onClick={handleAddSkill}>
                          <AddIcon />
                        </Button>
                      </Box>
                      <ChipInput>
                        {formData.preferences.skills.map((skill, index) => (
                          <Chip
                            key={index}
                            label={skill}
                            onDelete={() => handleRemoveSkill(skill)}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </ChipInput>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Hiring Locations
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                          size="small"
                          placeholder="Add a location..."
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLocation())}
                        />
                        <Button variant="outlined" onClick={handleAddLocation}>
                          <AddIcon />
                        </Button>
                      </Box>
                      <ChipInput>
                        {formData.preferences.locations.map((location, index) => (
                          <Chip
                            key={index}
                            label={location}
                            onDelete={() => handleRemoveLocation(location)}
                            color="secondary"
                            variant="outlined"
                          />
                        ))}
                      </ChipInput>
                    </Grid>
                  </Grid>
                </CardContent>
              </FormSection>
            </Grid>

            {/* Right Column - Logo & Actions */}
            <Grid item xs={12} md={4}>
              {/* Profile Picture */}
              <FormSection>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    <PersonIcon /> Your Profile Picture
                  </SectionTitle>
                  <Divider sx={{ mb: 3 }} />
                  
                  <CompanyLogoContainer>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="profile-pic-upload"
                      type="file"
                      onChange={handleProfilePicUpload}
                    />
                    <label htmlFor="profile-pic-upload">
                      <ProfilePicPreview
                        src={resolveImageUrl(formData.profilePicture)}
                        alt="Profile Picture"
                      >
                        {!formData.profilePicture && (user?.firstName?.charAt(0) || 'R')}
                      </ProfilePicPreview>
                    </label>
                    <label htmlFor="profile-pic-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<PhotoIcon />}
                        size="small"
                      >
                        Upload Photo
                      </Button>
                    </label>
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                      This will be shown on your recruiter profile
                    </Typography>
                  </CompanyLogoContainer>
                </CardContent>
              </FormSection>

              {/* Company Logo */}
              <FormSection>
                <CardContent>
                  <SectionTitle variant="h6" fontWeight="600">
                    <CompanyIcon /> Company Logo
                  </SectionTitle>
                  <Divider sx={{ mb: 3 }} />
                  
                  <CompanyLogoContainer>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="logo-upload"
                      type="file"
                      onChange={handleLogoUpload}
                    />
                    <label htmlFor="logo-upload">
                      <LogoPreview
                        src={resolveImageUrl(formData.companyLogo)}
                        alt="Company Logo"
                      >
                        {!formData.companyLogo && <CompanyIcon sx={{ fontSize: 48 }} />}
                      </LogoPreview>
                    </label>
                    <label htmlFor="logo-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<PhotoIcon />}
                        size="small"
                      >
                        Upload Logo
                      </Button>
                    </label>
                  </CompanyLogoContainer>
                </CardContent>
              </FormSection>

              <Paper sx={{ p: 3, position: 'sticky', top: 100 }}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={saving || !formData.companyName}
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  sx={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    py: 1.5,
                    mb: 2
                  }}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
                {hasExistingProfile && (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setIsEditMode(false)}
                    sx={{ mb: 2 }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant="text"
                  fullWidth
                  onClick={() => navigate('/recruiter/dashboard')}
                  sx={{ color: 'text.secondary' }}
                >
                  Back to Dashboard
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </form>
      </Container>
      
      {/* AI Processing Modals */}
      <AIProcessingModal 
        open={enhancingDescription}
        title="AI Enhancing Company Description"
        subtitle="AI is crafting a compelling company description..."
        phase="Analyzing Company Profile"
        type="enhancement"
      />
      
      <AIProcessingModal 
        open={enhancingBio}
        title="AI Enhancing Bio"
        subtitle="AI is creating a professional bio that stands out..."
        phase="Crafting Professional Bio"
        type="enhancement"
      />
    </Box>
  );
};

export default RecruiterProfileForm;
