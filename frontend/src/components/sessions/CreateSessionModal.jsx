import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  IconButton,
  Alert
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import { sessionAPI } from '../../services/api';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 16px;
    max-width: 560px;
    width: 100%;
    background: #ffffff;
    border: 1px solid rgba(124, 94, 207, 0.2);
    color: #1a1a2e;
  }

  .MuiTextField-root, .MuiFormControl-root {
    .MuiOutlinedInput-root {
      background: rgba(0, 0, 0, 0.03);
      color: #1a1a2e;
      border-radius: 10px;

      .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.12);
      }
      &:hover .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.2);
      }
      &.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: #7c5ecf;
      }
    }
    .MuiInputLabel-root {
      color: #555;
      &.Mui-focused {
        color: #7c5ecf;
      }
    }
    .MuiFormHelperText-root {
      color: #666;
    }
    .MuiSelect-icon {
      color: #555;
    }
    .MuiInputBase-input {
      color: #1a1a2e;
    }
    input[type='datetime-local']::-webkit-calendar-picker-indicator {
      filter: none;
    }
  }

  .MuiChip-root {
    background: rgba(124, 94, 207, 0.1);
    color: #7c5ecf;
    border: none;
    .MuiChip-deleteIcon {
      color: #666;
      &:hover { color: #ef4444; }
    }
  }
`;

const Header = styled(DialogTitle)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`;

const Title = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
`;

const Content = styled(DialogContent)`
  padding: 24px !important;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 8px;
`;

const TypeSelector = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const TypeButton = styled.button`
  flex: 1;
  padding: 16px;
  background: ${props => props.$active ? 'rgba(124, 94, 207, 0.1)' : 'rgba(0, 0, 0, 0.03)'};
  border: 2px solid ${props => props.$active ? '#7c5ecf' : 'rgba(0, 0, 0, 0.1)'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: ${props => props.$active ? '#7c5ecf' : 'rgba(0, 0, 0, 0.2)'};
  }
`;

const TypeIcon = styled.div`
  font-size: 24px;
  margin-bottom: 8px;
`;

const TypeLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$active ? '#7c5ecf' : 'rgba(0, 0, 0, 0.8)'};
`;

const TypeDesc = styled.div`
  font-size: 12px;
  color: #555;
  margin-top: 4px;
`;

const TagInput = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Actions = styled(DialogActions)`
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
`;

const sessionTypes = [
  { type: 'teaching', icon: '📚', label: 'Teaching', desc: 'Share knowledge' },
  { type: 'showcase', icon: '🎯', label: 'Showcase', desc: 'Show your project' },
  { type: 'mentorship', icon: '🤝', label: 'Mentorship', desc: 'Help others grow' }
];

const CreateSessionModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    sessionType: 'teaching',
    title: '',
    description: '',
    category: '',
    skillLevel: 'beginner',
    maxParticipants: 10,
    scheduledTime: '',
    duration: 60,
    skillsTaught: [],
    resources: [],
    meetingLink: ''
  });
  const [skillInput, setSkillInput] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, sessionType: type }));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skillsTaught.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skillsTaught: [...prev.skillsTaught, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skillsTaught: prev.skillsTaught.filter(s => s !== skill)
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }
      if (!formData.scheduledTime) {
        throw new Error('Scheduled time is required');
      }
      
      const payload = {
        ...formData,
        scheduledTime: new Date(formData.scheduledTime).toISOString(),
        duration: parseInt(formData.duration, 10),
        maxParticipants: parseInt(formData.maxParticipants, 10)
      };
      
      const response = await sessionAPI.create(payload);
      onSuccess?.(response.data.session);
      onClose();
      
      // Reset form
      setFormData({
        sessionType: 'teaching',
        title: '',
        description: '',
        category: '',
        skillLevel: 'beginner',
        maxParticipants: 10,
        scheduledTime: '',
        duration: 60,
        skillsTaught: [],
        resources: [],
        meetingLink: ''
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Header>
        <Title>Create Session</Title>
        <IconButton onClick={onClose} size="small" sx={{ color: '#555' }}>
          <CloseIcon />
        </IconButton>
      </Header>
      
      <Content>
        {error && (
          <Alert severity="error" sx={{ mb: 2, background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)', '& .MuiAlert-icon': { color: '#f87171' } }}>
            {error}
          </Alert>
        )}
        
        <Label>Session Type</Label>
        <TypeSelector>
          {sessionTypes.map(({ type, icon, label, desc }) => (
            <TypeButton
              key={type}
              $active={formData.sessionType === type}
              onClick={() => handleTypeSelect(type)}
              type="button"
            >
              <TypeIcon>{icon}</TypeIcon>
              <TypeLabel $active={formData.sessionType === type}>{label}</TypeLabel>
              <TypeDesc>{desc}</TypeDesc>
            </TypeButton>
          ))}
        </TypeSelector>
        
        <FormGroup>
          <TextField
            fullWidth
            label="Session Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Leadership Best Practices, Industry Trends Discussion"
            required
          />
        </FormGroup>
        
        <FormGroup>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            multiline
            rows={3}
            placeholder="What will participants learn?"
            required
          />
        </FormGroup>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            label="Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="e.g., Marketing, Healthcare, Finance"
          />
          <FormControl fullWidth>
            <InputLabel>Skill Level</InputLabel>
            <Select
              name="skillLevel"
              value={formData.skillLevel}
              onChange={handleChange}
              label="Skill Level"
              MenuProps={{
                PaperProps: {
                  sx: {
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.12)',
                    color: '#1a1a2e',
                    '.MuiMenuItem-root': {
                      color: 'rgba(0,0,0,0.7)',
                      '&:hover': { background: 'rgba(124,94,207,0.1)' },
                      '&.Mui-selected': { background: 'rgba(124,94,207,0.15)', color: '#7c5ecf' }
                    }
                  }
                }
              }}
            >
              <MenuItem value="beginner">Beginner</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="advanced">Advanced</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Scheduled Time"
            name="scheduledTime"
            value={formData.scheduledTime}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            fullWidth
            type="number"
            label="Duration (min)"
            name="duration"
            value={formData.duration}
            onChange={handleChange}
            inputProps={{ min: 15, max: 180 }}
          />
        </Box>
        
        <FormGroup>
          <TextField
            fullWidth
            type="number"
            label="Max Participants"
            name="maxParticipants"
            value={formData.maxParticipants}
            onChange={handleChange}
            inputProps={{ min: 1, max: 100 }}
          />
        </FormGroup>
        
        <FormGroup>
          <TextField
            fullWidth
            label="Meeting Link (optional)"
            name="meetingLink"
            value={formData.meetingLink}
            onChange={handleChange}
            placeholder="e.g., https://zoom.us/j/123456789 or https://meet.google.com/abc-xyz"
            helperText="Add your Zoom, Google Meet, or Teams link. You can also add this when starting the session."
          />
        </FormGroup>
        
        <FormGroup>
          <Label>Skills Covered</Label>
          <TagInput>
            <TextField
              size="small"
              fullWidth
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              placeholder="Add a skill"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
            />
            <Button 
              variant="outlined" 
              onClick={handleAddSkill}
              startIcon={<AddIcon />}
              sx={{ color: '#7c5ecf', borderColor: 'rgba(0,0,0,0.15)', '&:hover': { borderColor: '#7c5ecf', background: 'rgba(124,94,207,0.08)' } }}
            >
              Add
            </Button>
          </TagInput>
          <TagList>
            {formData.skillsTaught.map((skill, idx) => (
              <Chip
                key={idx}
                label={skill}
                onDelete={() => handleRemoveSkill(skill)}
                size="small"
              />
            ))}
          </TagList>
        </FormGroup>
      </Content>
      
      <Actions>
        <Button onClick={onClose} disabled={loading} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading}
          sx={{ 
            background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
            '&:hover': { background: 'linear-gradient(135deg, #6d28d9, #9333ea)' },
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3
          }}
        >
          {loading ? 'Creating...' : 'Create Session'}
        </Button>
      </Actions>
    </StyledDialog>
  );
};

export default CreateSessionModal;
