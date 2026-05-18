import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Close as CloseIcon,
  SmartToy as AgentIcon,
  Psychology as ThinkingIcon,
  Send as SendIcon,
  Work as JobIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { agentArenaAPI, jobAPI } from '../services/api';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: #fff;
    max-width: 600px;
    width: 100%;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  svg {
    font-size: 28px;
    color: #667eea;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
  }
`;

const CloseButton = styled(IconButton)`
  color: #a0aec0 !important;

  &:hover {
    background: rgba(255, 255, 255, 0.1) !important;
  }
`;

const Content = styled.div`
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #a0aec0;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TargetCard = styled.div`
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
`;

const TargetIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);

  svg {
    font-size: 24px;
    color: white;
  }
`;

const TargetInfo = styled.div`
  flex: 1;

  h4 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  p {
    font-size: 13px;
    color: #a0aec0;
  }
`;

const SliderContainer = styled.div`
  padding: 0 8px;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;

  span {
    font-size: 14px;
    color: #e2e8f0;
  }

  strong {
    color: #667eea;
  }
`;

const StyledSlider = styled(Slider)`
  color: #667eea !important;

  .MuiSlider-thumb {
    background: #667eea;
  }

  .MuiSlider-track {
    background: linear-gradient(90deg, #667eea, #764ba2);
  }

  .MuiSlider-rail {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }
`;

const ToggleLabel = styled.div`
  span {
    display: block;
    font-size: 14px;
    color: #e2e8f0;
  }

  small {
    font-size: 12px;
    color: #718096;
  }
`;

const StyledSwitch = styled(Switch)`
  .MuiSwitch-switchBase.Mui-checked {
    color: #667eea;
  }

  .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track {
    background: rgba(102, 126, 234, 0.5);
  }
`;

const ChipContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const StyleChip = styled(Chip)`
  background: ${props => props.$selected 
    ? 'linear-gradient(135deg, #667eea, #764ba2) !important' 
    : 'rgba(255, 255, 255, 0.05) !important'};
  color: ${props => props.$selected ? '#fff' : '#a0aec0'} !important;
  border: 1px solid ${props => props.$selected 
    ? 'transparent' 
    : 'rgba(255, 255, 255, 0.1)'} !important;

  &:hover {
    background: ${props => props.$selected 
      ? 'linear-gradient(135deg, #667eea, #764ba2) !important' 
      : 'rgba(255, 255, 255, 0.1) !important'};
  }
`;

const StyledTextField = styled(TextField)`
  .MuiOutlinedInput-root {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.02);

    fieldset {
      border-color: rgba(255, 255, 255, 0.1);
    }

    &:hover fieldset {
      border-color: rgba(102, 126, 234, 0.5);
    }

    &.Mui-focused fieldset {
      border-color: #667eea;
    }
  }

  .MuiInputLabel-root {
    color: #718096;

    &.Mui-focused {
      color: #667eea;
    }
  }
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const FooterInfo = styled.div`
  font-size: 13px;
  color: #718096;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    font-size: 18px;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const AgentNegotiationModal = ({ 
  open, 
  onClose, 
  initiatorType, // 'candidate' or 'recruiter'
  jobData,       // The job being discussed
  candidateData, // The candidate (for recruiter scouting)
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // For recruiter scouting: load and select from their jobs
  const [recruiterJobs, setRecruiterJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Fetch recruiter's jobs when modal opens for scouting without a pre-selected job
  useEffect(() => {
    if (open && initiatorType === 'recruiter' && !jobData) {
      fetchRecruiterJobs();
    }
  }, [open, initiatorType, jobData]);
  
  const fetchRecruiterJobs = async () => {
    try {
      setLoadingJobs(true);
      const response = await jobAPI.getMyJobs({ status: 'active' });
      setRecruiterJobs(response.data.jobs || response.data || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load your jobs. Please try again.');
    } finally {
      setLoadingJobs(false);
    }
  };
  
  // Agent context configuration
  const [context, setContext] = useState({
    // Candidate preferences
    minSalary: 80000,
    preferredLocation: '',
    mustBeRemote: false,
    dealBreakers: [],
    priorities: ['growth'],
    // Recruiter preferences
    maxBudget: 150000,
    urgency: 'medium',
    mustHaveSkills: [],
    flexibleOnRemote: true,
    // Shared
    negotiationStyle: 'balanced',
    additionalContext: ''
  });

  const handleSliderChange = (field) => (event, value) => {
    setContext(prev => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => (event) => {
    setContext(prev => ({ ...prev, [field]: event.target.checked }));
  };

  const handleStyleSelect = (style) => {
    setContext(prev => ({ ...prev, negotiationStyle: style }));
  };

  const handlePriorityToggle = (priority) => {
    setContext(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority]
    }));
  };

  const handleSubmit = async () => {
    // Determine the job ID to use
    const effectiveJobId = jobData?.id || selectedJobId;
    
    if (!effectiveJobId) {
      setError('Please select a job to scout for');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      const response = await agentArenaAPI.initiate(
        initiatorType,
        effectiveJobId,
        initiatorType === 'recruiter' ? candidateData?.userId : null,
        context
      );

      onSuccess?.(response.data.negotiation);
      onClose();
    } catch (err) {
      console.error('Error initiating negotiation:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to start negotiation');
    } finally {
      setLoading(false);
    }
  };

  const isCandidate = initiatorType === 'candidate';

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Header>
        <HeaderTitle>
          <AgentIcon />
          <h2>{isCandidate ? 'Send Your Agent' : 'Scout with Agent'}</h2>
        </HeaderTitle>
        <CloseButton onClick={onClose}>
          <CloseIcon />
        </CloseButton>
      </Header>

      <Content>
        {error && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239, 68, 68, 0.1)' }}>
            {error}
          </Alert>
        )}

        {/* Candidate Info (for recruiter scouting) */}
        {!isCandidate && candidateData && (
          <Section>
            <SectionTitle>Scouting Candidate</SectionTitle>
            <TargetCard>
              <TargetIcon>
                <PersonIcon />
              </TargetIcon>
              <TargetInfo>
                <h4>{`${candidateData?.firstName} ${candidateData?.lastName}`}</h4>
                <p>{candidateData?.title}</p>
              </TargetInfo>
            </TargetCard>
          </Section>
        )}

        {/* Job Selection - show when recruiter scouting without pre-selected job */}
        {!isCandidate && !jobData && (
          <Section>
            <SectionTitle>Select Job to Scout For</SectionTitle>
            {loadingJobs ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CircularProgress size={24} sx={{ color: '#667eea' }} />
                <p style={{ color: '#a0aec0', marginTop: '8px' }}>Loading your jobs...</p>
              </div>
            ) : recruiterJobs.length === 0 ? (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)' }}>
                You have no active job postings. Please create a job first before scouting candidates.
              </Alert>
            ) : (
              <FormControl fullWidth sx={{ 
                '& .MuiOutlinedInput-root': {
                  color: '#e2e8f0',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&:hover fieldset': { borderColor: '#667eea' },
                  '&.Mui-focused fieldset': { borderColor: '#667eea' }
                },
                '& .MuiInputLabel-root': { color: '#a0aec0' },
                '& .MuiSelect-icon': { color: '#a0aec0' }
              }}>
                <InputLabel>Choose a Job</InputLabel>
                <Select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  label="Choose a Job"
                >
                  {recruiterJobs.map((job) => (
                    <MenuItem key={job.id} value={job.id}>
                      {job.title} - {job.company}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Section>
        )}

        {/* Pre-selected job info (for candidate applying or recruiter with pre-selected job) */}
        {(isCandidate || jobData) && (
          <Section>
            <SectionTitle>{isCandidate ? 'Applying To' : 'Scouting For Job'}</SectionTitle>
            <TargetCard>
              <TargetIcon>
                <JobIcon />
              </TargetIcon>
              <TargetInfo>
                <h4>{jobData?.title}</h4>
                <p>{`${jobData?.company} • ${jobData?.location}`}</p>
              </TargetInfo>
            </TargetCard>
          </Section>
        )}

        <Section>
          <SectionTitle>{isCandidate ? 'Salary Expectation' : 'Budget Range'}</SectionTitle>
          <SliderContainer>
            <SliderLabel>
              <span>{isCandidate ? 'Minimum acceptable' : 'Maximum budget'}</span>
              <strong>${(isCandidate ? context.minSalary : context.maxBudget).toLocaleString()}</strong>
            </SliderLabel>
            <StyledSlider
              value={isCandidate ? context.minSalary : context.maxBudget}
              onChange={handleSliderChange(isCandidate ? 'minSalary' : 'maxBudget')}
              min={30000}
              max={300000}
              step={5000}
            />
          </SliderContainer>
        </Section>

        <Section>
          <SectionTitle>Negotiation Style</SectionTitle>
          <ChipContainer>
            <StyleChip
              label="Aggressive"
              $selected={context.negotiationStyle === 'aggressive'}
              onClick={() => handleStyleSelect('aggressive')}
            />
            <StyleChip
              label="Balanced"
              $selected={context.negotiationStyle === 'balanced'}
              onClick={() => handleStyleSelect('balanced')}
            />
            <StyleChip
              label="Collaborative"
              $selected={context.negotiationStyle === 'collaborative'}
              onClick={() => handleStyleSelect('collaborative')}
            />
          </ChipContainer>
        </Section>

        {isCandidate && (
          <Section>
            <SectionTitle>Your Priorities</SectionTitle>
            <ChipContainer>
              {['growth', 'compensation', 'work-life-balance', 'remote', 'impact', 'learning'].map(priority => (
                <StyleChip
                  key={priority}
                  label={priority.charAt(0).toUpperCase() + priority.slice(1).replace('-', ' ')}
                  $selected={context.priorities.includes(priority)}
                  onClick={() => handlePriorityToggle(priority)}
                />
              ))}
            </ChipContainer>
          </Section>
        )}

        <Section>
          <SectionTitle>Preferences</SectionTitle>
          <ToggleRow>
            <ToggleLabel>
              <span>{isCandidate ? 'Remote work required' : 'Flexible on remote work'}</span>
              <small>{isCandidate 
                ? 'Agent will decline non-remote opportunities' 
                : 'Agent can negotiate on location requirements'}</small>
            </ToggleLabel>
            <StyledSwitch
              checked={isCandidate ? context.mustBeRemote : context.flexibleOnRemote}
              onChange={handleToggle(isCandidate ? 'mustBeRemote' : 'flexibleOnRemote')}
            />
          </ToggleRow>
        </Section>

        <Section>
          <SectionTitle>Additional Context (Optional)</SectionTitle>
          <StyledTextField
            fullWidth
            multiline
            rows={3}
            placeholder={isCandidate 
              ? "Any specific things you want your agent to highlight or watch out for..."
              : "Any specific requirements or points you want your agent to emphasize..."}
            value={context.additionalContext}
            onChange={(e) => setContext(prev => ({ ...prev, additionalContext: e.target.value }))}
          />
        </Section>
      </Content>

      <Footer>
        <FooterInfo>
          <ThinkingIcon />
          Your agent will negotiate autonomously based on these preferences
        </FooterInfo>
        <ActionButton 
          onClick={handleSubmit} 
          disabled={loading || (!isCandidate && !jobData && !selectedJobId) || (!isCandidate && !jobData && recruiterJobs.length === 0)}
        >
          {loading ? (
            <>
              <CircularProgress size={18} color="inherit" />
              Starting...
            </>
          ) : (
            <>
              <SendIcon />
              {isCandidate ? 'Send Agent' : 'Start Scouting'}
            </>
          )}
        </ActionButton>
      </Footer>
    </StyledDialog>
  );
};

export default AgentNegotiationModal;
