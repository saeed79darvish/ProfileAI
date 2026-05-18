import React, { useState } from 'react';
import styled from 'styled-components';
import { featureFlags } from '../config/featureFlags';
import {
  Dialog,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  SmartToy as AgentIcon,
  Search as SearchIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
  FilterList as FilterIcon,
  Group as GroupIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  RocketLaunch as LaunchIcon
} from '@mui/icons-material';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    color: #1f2937;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafbfc;
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;

  svg {
    font-size: 36px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: #1f2937;
  }
  
  p {
    font-size: 14px;
    color: #6b7280;
    margin: 4px 0 0 0;
  }
`;

const CloseButton = styled(IconButton)`
  color: #9ca3af !important;
  transition: all 0.2s !important;

  &:hover {
    background: #f3f4f6 !important;
    color: #4b5563 !important;
  }
`;

const Content = styled.div`
  padding: 28px;
  overflow-y: auto;
  max-height: calc(90vh - 200px);
  background: #ffffff;
`;

const Section = styled.div`
  margin-bottom: 28px;
  padding: 20px;
  background: #fafbfc;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  
  svg {
    color: #667eea;
    font-size: 22px;
  }
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }
`;

const SectionDescription = styled.p`
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const SliderContainer = styled.div`
  padding: 0 8px;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  span {
    font-size: 14px;
    color: #374151;
    font-weight: 500;
  }

  strong {
    color: #667eea;
    font-weight: 600;
  }
`;

const StyledSlider = styled(Slider)`
  color: #667eea !important;

  .MuiSlider-thumb {
    background: #667eea;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    
    &:hover {
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }
  }

  .MuiSlider-track {
    background: linear-gradient(90deg, #667eea, #764ba2);
    border: none;
  }

  .MuiSlider-rail {
    background: #e5e7eb;
    opacity: 1;
  }
  
  .MuiSlider-mark {
    background: #d1d5db;
  }
  
  .MuiSlider-markLabel {
    color: #6b7280;
  }
`;

const ToggleGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const ToggleCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: ${props => props.$active ? 'rgba(102, 126, 234, 0.08)' : '#ffffff'};
  border: 1px solid ${props => props.$active ? 'rgba(102, 126, 234, 0.4)' : '#e5e7eb'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.$active ? 'rgba(102, 126, 234, 0.12)' : '#f9fafb'};
    border-color: ${props => props.$active ? 'rgba(102, 126, 234, 0.5)' : '#d1d5db'};
  }
`;

const ToggleInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: ${props => props.$active ? '#667eea' : '#9ca3af'};
    font-size: 24px;
  }
  
  .text {
    span {
      display: block;
      font-size: 14px;
      color: #1f2937;
      font-weight: 500;
    }
    
    small {
      font-size: 12px;
      color: #6b7280;
    }
  }
`;

const StyledSwitch = styled(Switch)`
  .MuiSwitch-switchBase.Mui-checked {
    color: #667eea;
  }

  .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track {
    background: #667eea;
    opacity: 0.7;
  }
  
  .MuiSwitch-track {
    background: #d1d5db;
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
    : '#ffffff !important'};
  color: ${props => props.$selected ? '#fff' : '#4b5563'} !important;
  border: 1px solid ${props => props.$selected 
    ? 'transparent' 
    : '#e5e7eb'} !important;
  font-weight: 500 !important;
  transition: all 0.2s !important;

  &:hover {
    background: ${props => props.$selected 
      ? 'linear-gradient(135deg, #667eea, #764ba2) !important' 
      : '#f3f4f6 !important'};
    border-color: ${props => props.$selected 
      ? 'transparent' 
      : '#d1d5db'} !important;
  }
`;

const StyledTextField = styled(TextField)`
  .MuiOutlinedInput-root {
    color: #1f2937;
    background: #ffffff;

    fieldset {
      border-color: #e5e7eb;
    }

    &:hover fieldset {
      border-color: #d1d5db;
    }

    &.Mui-focused fieldset {
      border-color: #667eea;
    }
  }

  .MuiInputLabel-root {
    color: #6b7280;

    &.Mui-focused {
      color: #667eea;
    }
  }
  
  .MuiOutlinedInput-input::placeholder {
    color: #9ca3af;
    opacity: 1;
  }
`;

const Footer = styled.div`
  padding: 20px 28px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafbfc;
`;

const FooterInfo = styled.div`
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    font-size: 18px;
    color: #667eea;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
  ` : `
    background: #ffffff;
    color: #4b5563;
    border: 1px solid #e5e7eb;
    
    &:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const PreviewCard = styled.div`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
`;

const PreviewTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviewStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const PreviewStat = styled.div`
  text-align: center;
  padding: 12px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  .value {
    font-size: 26px;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
    margin-top: 4px;
  }
`;

const AIScreeningConfigModal = ({ 
  open, 
  onClose, 
  jobData,
  onStartScreening,
  loading = false 
}) => {
  const [config, setConfig] = useState({
    // Search Configuration
    minMatchScore: 60,
    candidatesToScreen: 5, // Top X% of candidates to screen (percentage-based)
    includePassiveCandidates: true,
    
    // Screening Options
    enablePhoneScreening: true,
    phoneScreeningDuration: 15, // 15 or 30 minutes
    enableEmailOutreach: true,
    useAgentArena: featureFlags.recruiterAgentArena, // Gated by VITE_ENABLE_RECRUITER_AGENT_ARENA
    
    // AI Behavior
    screeningStyle: 'balanced', // thorough, balanced, fast
    priorityFactors: ['skills', 'experience'], // skills, experience, location, salary
    
    // Advanced
    autoScheduleInterviews: true,
    sendRejectionEmails: false,
    customInstructions: ''
  });

  const handleSliderChange = (field) => (event, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleStyleChange = (style) => {
    setConfig(prev => ({ ...prev, screeningStyle: style }));
  };

  const handlePriorityToggle = (factor) => {
    setConfig(prev => {
      const current = prev.priorityFactors;
      if (current.includes(factor)) {
        return { ...prev, priorityFactors: current.filter(f => f !== factor) };
      } else {
        return { ...prev, priorityFactors: [...current, factor] };
      }
    });
  };

  const handleStart = () => {
    onStartScreening(config);
  };

  const getEstimatedTime = () => {
    const base = 5; // 5 minutes for smart search
    const screening = config.enablePhoneScreening ? config.candidatesToScreen * 2 : config.candidatesToScreen * 0.2;
    const total = base + screening;
    
    if (total < 60) return `~${Math.round(total)} min`;
    return `~${(total / 60).toFixed(1)} hrs`;
  };

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Header>
        <HeaderTitle>
          <AgentIcon />
          <div>
            <h2>Configure AI Screening</h2>
            <p>Customize how AI finds and screens candidates for this position</p>
          </div>
        </HeaderTitle>
        <CloseButton onClick={onClose}>
          <CloseIcon />
        </CloseButton>
      </Header>

      <Content>
        {/* Job Summary */}
        {jobData && (
          <Section>
            <PreviewCard style={{ marginTop: 0 }}>
              <PreviewTitle>
                <CheckIcon /> Job Ready for AI Screening
              </PreviewTitle>
              <div style={{ color: '#1f2937', fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                {jobData.title}
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>
                {jobData.company} • {jobData.location}
              </div>
              {jobData.skills && jobData.skills.length > 0 && (
                <ChipContainer style={{ marginTop: '12px' }}>
                  {jobData.skills.slice(0, 5).map((skill, idx) => (
                    <Chip 
                      key={idx} 
                      label={skill} 
                      size="small" 
                      sx={{ 
                        background: 'rgba(102, 126, 234, 0.12)', 
                        color: '#667eea',
                        fontSize: '12px',
                        fontWeight: 500
                      }} 
                    />
                  ))}
                  {jobData.skills.length > 5 && (
                    <Chip 
                      label={`+${jobData.skills.length - 5} more`} 
                      size="small" 
                      sx={{ 
                        background: '#f3f4f6', 
                        color: '#6b7280',
                        fontSize: '12px'
                      }} 
                    />
                  )}
                </ChipContainer>
              )}
            </PreviewCard>
          </Section>
        )}

        {/* Search Configuration */}
        <Section>
          <SectionHeader>
            <SearchIcon />
            <h3>Smart Search Settings</h3>
          </SectionHeader>
          <SectionDescription>
            Configure how AI searches and filters candidates from the talent pool
          </SectionDescription>
          
          <SliderContainer>
            <SliderLabel>
              <span>Minimum Match Score</span>
              <strong>{config.minMatchScore}%</strong>
            </SliderLabel>
            <StyledSlider
              value={config.minMatchScore}
              onChange={handleSliderChange('minMatchScore')}
              min={40}
              max={90}
              step={5}
              marks={[
                { value: 40, label: '40%' },
                { value: 60, label: '60%' },
                { value: 90, label: '90%' }
              ]}
            />
          </SliderContainer>

          <SliderContainer style={{ marginTop: '24px' }}>
            <SliderLabel>
              <span>Top Candidates Percentage</span>
              <Tooltip title="Select the top X% of all candidates to proceed to AI phone screening. E.g., 2% returns only the top 2% highest-ranked candidates." arrow>
                <InfoIcon style={{ fontSize: '16px', color: '#667eea', cursor: 'help' }} />
              </Tooltip>
              <strong style={{ marginLeft: 'auto' }}>{config.candidatesToScreen}%</strong>
            </SliderLabel>
            <StyledSlider
              value={config.candidatesToScreen}
              onChange={handleSliderChange('candidatesToScreen')}
              min={1}
              max={100}
              step={1}
              marks={[
                { value: 1, label: '1%' },
                { value: 25, label: '25%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' }
              ]}
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              Smart Search will rank all candidates → Top {config.candidatesToScreen}% highest-scored will get AI Phone Screening
            </div>
          </SliderContainer>
        </Section>

        {/* Screening Options */}
        <Section>
          <SectionHeader>
            <PhoneIcon />
            <h3>Screening Options</h3>
          </SectionHeader>
          <SectionDescription>
            Choose how AI interacts with potential candidates
          </SectionDescription>

          <ToggleGrid>
            <ToggleCard 
              $active={config.enablePhoneScreening}
              onClick={() => handleToggle('enablePhoneScreening')}
            >
              <ToggleInfo $active={config.enablePhoneScreening}>
                <PhoneIcon />
                <div className="text">
                  <span>AI Phone Screening</span>
                  <small>Automated calls to candidates</small>
                </div>
              </ToggleInfo>
              <StyledSwitch 
                checked={config.enablePhoneScreening} 
                onChange={() => handleToggle('enablePhoneScreening')}
              />
            </ToggleCard>

            <ToggleCard 
              $active={config.enableEmailOutreach}
              onClick={() => handleToggle('enableEmailOutreach')}
            >
              <ToggleInfo $active={config.enableEmailOutreach}>
                <EmailIcon />
                <div className="text">
                  <span>Email Outreach</span>
                  <small>Send interview invites</small>
                </div>
              </ToggleInfo>
              <StyledSwitch 
                checked={config.enableEmailOutreach} 
                onChange={() => handleToggle('enableEmailOutreach')}
              />
            </ToggleCard>

            <ToggleCard 
              $active={config.autoScheduleInterviews}
              onClick={() => handleToggle('autoScheduleInterviews')}
            >
              <ToggleInfo $active={config.autoScheduleInterviews}>
                <CheckIcon />
                <div className="text">
                  <span>Auto-Schedule</span>
                  <small>Book interviews automatically</small>
                </div>
              </ToggleInfo>
              <StyledSwitch 
                checked={config.autoScheduleInterviews} 
                onChange={() => handleToggle('autoScheduleInterviews')}
              />
            </ToggleCard>

            <ToggleCard 
              $active={config.includePassiveCandidates}
              onClick={() => handleToggle('includePassiveCandidates')}
            >
              <ToggleInfo $active={config.includePassiveCandidates}>
                <GroupIcon />
                <div className="text">
                  <span>Passive Candidates</span>
                  <small>Include not actively looking</small>
                </div>
              </ToggleInfo>
              <StyledSwitch 
                checked={config.includePassiveCandidates} 
                onChange={() => handleToggle('includePassiveCandidates')}
              />
            </ToggleCard>

            {featureFlags.recruiterAgentArena && (
              <ToggleCard
                $active={config.useAgentArena}
                onClick={() => handleToggle('useAgentArena')}
              >
                <ToggleInfo $active={config.useAgentArena}>
                  <AgentIcon />
                  <div className="text">
                    <span>Agent Arena</span>
                    <small>Watch AI negotiate in real-time</small>
                  </div>
                </ToggleInfo>
                <StyledSwitch
                  checked={config.useAgentArena}
                  onChange={() => handleToggle('useAgentArena')}
                />
              </ToggleCard>
            )}
          </ToggleGrid>

          {config.enablePhoneScreening && (
            <div style={{ marginTop: '20px' }}>
              <SliderLabel>
                <span>Phone Screening Duration</span>
                <strong>{config.phoneScreeningDuration} minutes</strong>
              </SliderLabel>
              <ChipContainer>
                <StyleChip 
                  label="15 min (Quick)" 
                  $selected={config.phoneScreeningDuration === 15}
                  onClick={() => setConfig(prev => ({ ...prev, phoneScreeningDuration: 15 }))}
                />
                <StyleChip 
                  label="30 min (Thorough)" 
                  $selected={config.phoneScreeningDuration === 30}
                  onClick={() => setConfig(prev => ({ ...prev, phoneScreeningDuration: 30 }))}
                />
              </ChipContainer>
            </div>
          )}
        </Section>

        {/* AI Behavior */}
        <Section>
          <SectionHeader>
            <PsychologyIcon />
            <h3>AI Behavior</h3>
          </SectionHeader>
          <SectionDescription>
            Customize how the AI evaluates and prioritizes candidates
          </SectionDescription>

          <div style={{ marginBottom: '20px' }}>
            <SliderLabel>
              <span>Screening Style</span>
            </SliderLabel>
            <ChipContainer>
              <StyleChip 
                icon={<SpeedIcon />}
                label="Fast" 
                $selected={config.screeningStyle === 'fast'}
                onClick={() => handleStyleChange('fast')}
              />
              <StyleChip 
                label="Balanced" 
                $selected={config.screeningStyle === 'balanced'}
                onClick={() => handleStyleChange('balanced')}
              />
              <StyleChip 
                icon={<FilterIcon />}
                label="Thorough" 
                $selected={config.screeningStyle === 'thorough'}
                onClick={() => handleStyleChange('thorough')}
              />
            </ChipContainer>
          </div>

          <div>
            <SliderLabel>
              <span>Priority Factors</span>
              <Tooltip title="Select what matters most when ranking candidates">
                <InfoIcon style={{ fontSize: 18, color: '#9ca3af', cursor: 'help' }} />
              </Tooltip>
            </SliderLabel>
            <ChipContainer>
              {['skills', 'experience', 'location', 'salary', 'availability'].map(factor => (
                <StyleChip 
                  key={factor}
                  label={factor.charAt(0).toUpperCase() + factor.slice(1)} 
                  $selected={config.priorityFactors.includes(factor)}
                  onClick={() => handlePriorityToggle(factor)}
                />
              ))}
            </ChipContainer>
          </div>
        </Section>

        {/* Custom Instructions */}
        <Section>
          <SectionHeader>
            <PsychologyIcon />
            <h3>Custom Instructions (Optional)</h3>
          </SectionHeader>
          <StyledTextField
            multiline
            rows={3}
            fullWidth
            placeholder="Add any specific requirements or instructions for the AI screening agent..."
            value={config.customInstructions}
            onChange={(e) => setConfig(prev => ({ ...prev, customInstructions: e.target.value }))}
          />
        </Section>

        {/* Preview */}
        <PreviewCard>
          <PreviewTitle>
            <AgentIcon /> Screening Preview
          </PreviewTitle>
          <PreviewStats>
            <PreviewStat>
              <div className="value">{config.candidatesToScreen}</div>
              <div className="label">To Screen</div>
            </PreviewStat>
            <PreviewStat>
              <div className="value">{config.minMatchScore}%</div>
              <div className="label">Min Match</div>
            </PreviewStat>
            <PreviewStat>
              <div className="value">{getEstimatedTime()}</div>
              <div className="label">Est. Time</div>
            </PreviewStat>
          </PreviewStats>
        </PreviewCard>
      </Content>

      <Footer>
        <FooterInfo>
          <AgentIcon />
          AI will start screening automatically after configuration
        </FooterInfo>
        <ButtonGroup>
          <Button onClick={onClose}>
            Skip for Now
          </Button>
          <Button $primary onClick={handleStart} disabled={loading}>
            {loading ? (
              <>
                <CircularProgress size={18} color="inherit" />
                Starting...
              </>
            ) : (
              <>
                <LaunchIcon />
                Start AI Screening
              </>
            )}
          </Button>
        </ButtonGroup>
      </Footer>
    </StyledDialog>
  );
};

export default AIScreeningConfigModal;
