import {
  Container, Box, Paper, Typography, Button, IconButton,
  TextField, Chip, Stepper, Step, StepLabel, StepContent,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Avatar, useTheme, useMediaQuery, alpha, Alert, CircularProgress,
  Slider, Radio, RadioGroup, Divider
} from '@mui/material';
import {
  PageContainer,
  WizardCard,
  WizardHeader,
  TypeCard
} from './styled';
import { ROUTES, STEPS, CHALLENGE_TYPES, TEXT, LIMITS } from './constants';

export default function ChallengeCreationWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    duration: 7,
    visibility: 'public',
    maxParticipants: 50,
    allowSkipDays: 2,
    requireDailyCheckIn: true,
    stakes: '',
    milestones: [],
    tags: []
  });
  
  const [newTag, setNewTag] = useState('');
  const [newMilestone, setNewMilestone] = useState({ day: 1, title: '', description: '' });

  const handleTypeSelect = (type) => {
    const config = CHALLENGE_TYPES.find(t => t.id === type);
    setFormData(prev => ({
      ...prev,
      type,
      duration: config?.duration || prev.duration,
      milestones: getDefaultMilestones(type)
    }));
  };

  const getDefaultMilestones = (type) => {
    switch (type) {
      case 'sprint':
        return [
          { day: 1, title: 'Day 1: Idea & Setup', description: 'Define your project and set up the foundation' },
          { day: 3, title: 'Day 3: MVP', description: 'Build the minimum viable product' },
          { day: 5, title: 'Day 5: Polish', description: 'Refine and add finishing touches' },
          { day: 7, title: 'Day 7: Launch', description: 'Ship it!' }
        ];
      case 'deep_dive':
        return [
          { day: 1, title: 'Day 1: Foundations', description: 'Start with the basics' },
          { day: 7, title: 'Day 7: Halfway Check', description: 'Review progress and adjust' },
          { day: 10, title: 'Day 10: Project Start', description: 'Begin applying your knowledge' },
          { day: 14, title: 'Day 14: Showcase', description: 'Share what you learned' }
        ];
      case 'transformation':
        return [
          { day: 1, title: 'Day 1: Audit', description: 'Assess your current situation' },
          { day: 7, title: 'Week 1: Plan', description: 'Create your action plan' },
          { day: 14, title: 'Week 2: Build', description: 'Start building momentum' },
          { day: 21, title: 'Week 3: Network', description: 'Expand your connections' },
          { day: 30, title: 'Day 30: Launch', description: 'Take the leap!' }
        ];
      default:
        return [];
    }
  };

  const handleAddMilestone = () => {
    if (newMilestone.title && newMilestone.day) {
      setFormData(prev => ({
        ...prev,
        milestones: [...prev.milestones, { ...newMilestone }].sort((a, b) => a.day - b.day)
      }));
      setNewMilestone({ day: 1, title: '', description: '' });
    }
  };

  const handleRemoveMilestone = (index) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }));
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await challengesAPI.create(formData);
      navigate(ROUTES.CHALLENGE_DETAIL(response.data.id));
    } catch (err) {
      console.error('Error creating challenge:', err);
      setError(err.response?.data?.message || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return !!formData.type;
      case 1: return !!formData.title && formData.duration > 0;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 2 }}>
            {CHALLENGE_TYPES.map(type => (
              <TypeCard 
                key={type.id} 
                $selected={formData.type === type.id}
                onClick={() => handleTypeSelect(type.id)}
              >
                <Typography variant="h2" sx={{ mb: 1 }}>{type.emoji}</Typography>
                <Typography variant="h6" fontWeight={700}>{type.label}</Typography>
                <Typography variant="body2" color="text.secondary">{type.description}</Typography>
                {type.duration && (
                  <Chip label={`${type.duration} days`} size="small" sx={{ mt: 1 }} />
                )}
              </TypeCard>
            ))}
          </Box>
        );
        
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Challenge Title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Ship My Side Project in 7 Days"
              required
            />
            
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What will participants accomplish?"
              multiline
              rows={3}
            />
            
            {formData.type === 'custom' && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Duration: {formData.duration} days</Typography>
                <Slider
                  value={formData.duration}
                  onChange={(e, v) => setFormData(prev => ({ ...prev, duration: v }))}
                  min={3}
                  max={90}
                  valueLabelDisplay="auto"
                  sx={{ color: '#F97316' }}
                />
              </Box>
            )}
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>Tags</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {formData.tags.map(tag => (
                  <Chip key={tag} label={tag} onDelete={() => handleRemoveTag(tag)} size="small" />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Add tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button variant="outlined" onClick={handleAddTag} sx={{ minWidth: 'auto' }}>
                  <AddIcon />
                </Button>
              </Box>
            </Box>
          </Box>
        );
        
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Milestones help participants track their progress throughout the challenge.
            </Typography>
            
            {formData.milestones.map((milestone, index) => (
              <Paper key={index} elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Chip label={`Day ${milestone.day}`} size="small" color="primary" sx={{ mb: 1 }} />
                    <Typography variant="subtitle2" fontWeight={600}>{milestone.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{milestone.description}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => handleRemoveMilestone(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2">Add New Milestone</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                type="number"
                label="Day"
                value={newMilestone.day}
                onChange={(e) => setNewMilestone(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                sx={{ width: 80 }}
                InputProps={{ inputProps: { min: 1, max: formData.duration } }}
              />
              <TextField
                size="small"
                label="Title"
                value={newMilestone.title}
                onChange={(e) => setNewMilestone(prev => ({ ...prev, title: e.target.value }))}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                size="small"
                label="Description"
                value={newMilestone.description}
                onChange={(e) => setNewMilestone(prev => ({ ...prev, description: e.target.value }))}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <Button variant="contained" onClick={handleAddMilestone} sx={{ bgcolor: '#F97316' }}>
                <AddIcon />
              </Button>
            </Box>
          </Box>
        );
        
      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={formData.visibility}
                label="Visibility"
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
              >
                <MenuItem value="public">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PublicIcon /> Public - Anyone can join
                  </Box>
                </MenuItem>
                <MenuItem value="friends">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon /> Friends Only
                  </Box>
                </MenuItem>
                <MenuItem value="private">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockIcon /> Private - Invite only
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              type="number"
              label="Max Participants"
              value={formData.maxParticipants}
              onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 50 }))}
              InputProps={{ inputProps: { min: 2, max: 100 } }}
            />
            
            <TextField
              fullWidth
              type="number"
              label="Allow Skip Days"
              value={formData.allowSkipDays}
              onChange={(e) => setFormData(prev => ({ ...prev, allowSkipDays: parseInt(e.target.value) || 0 }))}
              helperText="Number of days participants can skip without breaking their streak"
              InputProps={{ inputProps: { min: 0, max: 7 } }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.requireDailyCheckIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, requireDailyCheckIn: e.target.checked }))}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#F97316' } }}
                />
              }
              label="Require daily check-ins"
            />
            
            <TextField
              fullWidth
              label="Stakes (Optional)"
              value={formData.stakes}
              onChange={(e) => setFormData(prev => ({ ...prev, stakes: e.target.value }))}
              placeholder="e.g., Loser buys coffee, donate to charity"
              helperText="What's at stake? Add some friendly accountability!"
            />
          </Box>
        );
        
      case 4:
        const config = CHALLENGE_TYPES.find(t => t.id === formData.type);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: alpha('#F97316', 0.05), border: '1px solid', borderColor: alpha('#F97316', 0.2) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h2">{config?.emoji || '🎯'}</Typography>
                <Box>
                  <Typography variant="h5" fontWeight={700}>{formData.title || 'Untitled Challenge'}</Typography>
                  <Chip label={config?.label || 'Custom'} size="small" sx={{ mt: 0.5 }} />
                </Box>
              </Box>
              
              {formData.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {formData.description}
                </Typography>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Duration</Typography>
                  <Typography variant="body1" fontWeight={600}>{formData.duration} days</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Visibility</Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{formData.visibility}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Max Participants</Typography>
                  <Typography variant="body1" fontWeight={600}>{formData.maxParticipants}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Milestones</Typography>
                  <Typography variant="body1" fontWeight={600}>{formData.milestones.length}</Typography>
                </Box>
              </Box>
              
              {formData.stakes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Stakes</Typography>
                    <Typography variant="body1">{formData.stakes}</Typography>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        );
        
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      <Container maxWidth="md">
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate(ROUTES.CHALLENGES)}
          sx={{ mb: 3, color: '#EA580C' }}
        >
          Back to Challenges
        </Button>
        
        <WizardCard elevation={0}>
          <WizardHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TrophyIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>Create a Challenge</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Set up a new challenge for you and your friends
                </Typography>
              </Box>
            </Box>
          </WizardHeader>
          
          <Box sx={{ p: 4 }}>
            <Stepper activeStep={activeStep} orientation={isMobile ? 'vertical' : 'horizontal'} sx={{ mb: 4 }}>
              {STEPS.map((label, index) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            {renderStepContent()}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                startIcon={<BackIcon />}
              >
                Back
              </Button>
              
              {activeStep === STEPS.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
                  sx={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
                >
                  {loading ? 'Creating...' : 'Create Challenge'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  endIcon={<NextIcon />}
                  sx={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </WizardCard>
      </Container>
    </PageContainer>
  );
}
