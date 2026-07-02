import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CircularProgress, Tooltip, Switch, Breadcrumbs, Typography } from '@mui/material';
import {
  PageContainer,
  Container,
  BreadcrumbsWrapper,
  BreadcrumbLink,
  BreadcrumbCurrent,
  HeroSection,
  HeroInner,
  Card,
  CardHeader,
  CandidateInfo,
  JobInfo,
  FormSection,
  Label,
  Select,
  Input,
  TextArea,
  FormatOptions,
  FormatOption,
  TimeSlots,
  TimeSlot,
  AddSlotButton,
  RemoveButton,
  PhoneScreeningSection,
  PhoneScreeningHeader,
  PhoneScreeningTitle,
  PhoneScreeningDescription,
  PhoneScreeningOptions,
  DurationOption,
  PhoneWarning,
  SubmitButton,
  LoadingContainer,
  ErrorMessage
} from './styled';
import { ROUTES, TEXT, INTERVIEW_TYPES, FORMAT_OPTIONS, DURATION_OPTIONS, SCREENING_DURATION_OPTIONS, DEFAULTS } from './constants';
import { useState, useEffect } from 'react';

const ScheduleInterview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const candidateId = searchParams.get('candidateId');
  const jobId = searchParams.get('jobId');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [job, setJob] = useState(null);
  
  // Form state
  const [interviewType, setInterviewType] = useState('screening');
  const [format, setFormat] = useState('video');
  const [duration, setDuration] = useState(30);
  const [timeSlots, setTimeSlots] = useState([
    { date: '', time: '' }
  ]);
  const [notes, setNotes] = useState('');
  
  // Phone screening state - enabled by default for AI screening
  const [phoneScreeningEnabled, setPhoneScreeningEnabled] = useState(true);
  const [phoneScreeningDuration, setPhoneScreeningDuration] = useState(15);
  
  // Handle format change - auto-enable AI screening for ai_agent format
  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (newFormat === 'ai_agent') {
      setPhoneScreeningEnabled(true);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [candidateId, jobId]);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!candidateId || !jobId) {
        setError('Missing candidate or job information');
        setLoading(false);
        return;
      }
      
      // Fetch candidate profile
      const candidateRes = await api.get(`/profiles/${candidateId}`);
      setCandidate(candidateRes.data);
      
      // Fetch job details
      const jobRes = await api.get(`/jobs/${jobId}`);
      setJob(jobRes.data);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load candidate or job information');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddTimeSlot = () => {
    setTimeSlots([...timeSlots, { date: '', time: '' }]);
  };
  
  const handleRemoveTimeSlot = (index) => {
    if (timeSlots.length > 1) {
      setTimeSlots(timeSlots.filter((_, i) => i !== index));
    }
  };
  
  const handleTimeSlotChange = (index, field, value) => {
    const updated = [...timeSlots];
    updated[index][field] = value;
    setTimeSlots(updated);
  };
  
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      
      // Validate time slots
      const validSlots = timeSlots.filter(slot => slot.date && slot.time);
      if (validSlots.length === 0) {
        setError('Please add at least one time slot');
        setSubmitting(false);
        return;
      }
      
      // Format proposed slots
      const proposedSlots = validSlots.map(slot => ({
        datetime: new Date(`${slot.date}T${slot.time}`).toISOString(),
        duration
      }));
      
      // Create interview
      const response = await interviewAPI.createInterview({
        jobId,
        candidateId,
        proposedSlots,
        type: interviewType,
        format,
        duration,
        recruiterNotes: notes,
        phoneScreeningEnabled,
        phoneScreeningDuration: phoneScreeningEnabled ? phoneScreeningDuration : null
      });
      
      // Navigate to calendar or jobs page
      navigate('/recruiter/calendar', { 
        state: { 
          success: true, 
          message: 'Interview scheduled successfully! The candidate will be notified.' 
        } 
      });
      
    } catch (err) {
      console.error('Error scheduling interview:', err);
      setError(err.response?.data?.message || 'Failed to schedule interview');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <PageContainer>
        <Container>
          <LoadingContainer>
            <CircularProgress />
            <p>Loading interview details...</p>
          </LoadingContainer>
        </Container>
      </PageContainer>
    );
  }
  
  const candidateHasPhone = candidate?.phone;
  
  return (
    <PageContainer>
      <HeroSection>
        <HeroInner>
          <BreadcrumbsWrapper>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
              <BreadcrumbLink to="/profile">
                <HomeIcon fontSize="small" />
                Dashboard
              </BreadcrumbLink>
              <BreadcrumbLink to="/recruiter/calendar">
                <EventIcon fontSize="small" />
                Calendar
              </BreadcrumbLink>
              <BreadcrumbCurrent>Schedule Interview</BreadcrumbCurrent>
            </Breadcrumbs>
          </BreadcrumbsWrapper>
          
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>Schedule Interview</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>Propose interview times for the candidate to choose from</p>
        </HeroInner>
      </HeroSection>
      <Container>
        
        {error && (
          <ErrorMessage>
            <Info />
            {error}
          </ErrorMessage>
        )}
        
        {/* Candidate Info */}
        {candidate && (
          <Card>
            <CardHeader>
              <Person />
              <h2>Candidate</h2>
            </CardHeader>
            <CandidateInfo>
              <img 
                src={resolveImageUrl(candidate.profilePicture)} 
                alt={candidate.firstName}
                className="avatar"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              <div className="details">
                <h3>{candidate.firstName} {candidate.lastName}</h3>
                <p>{candidate.headline || 'No headline'}</p>
                {candidate.phone && (
                  <p style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone fontSize="small" />
                    {candidate.phone}
                  </p>
                )}
              </div>
            </CandidateInfo>
          </Card>
        )}
        
        {/* Job Info */}
        {job && (
          <Card>
            <CardHeader>
              <Work />
              <h2>Position</h2>
            </CardHeader>
            <JobInfo>
              <div className="icon">
                <Work />
              </div>
              <div className="details">
                <h3>{job.title}</h3>
                <p>{job.company} • {job.location}</p>
              </div>
            </JobInfo>
          </Card>
        )}
        
        {/* Interview Settings */}
        <Card>
          <CardHeader>
            <Schedule />
            <h2>Interview Settings</h2>
          </CardHeader>
          
          <FormSection>
            <Label>Interview Type</Label>
            <Select 
              value={interviewType} 
              onChange={(e) => setInterviewType(e.target.value)}
            >
              <option value="screening">Initial Screening</option>
              <option value="technical">Technical Interview</option>
              <option value="behavioral">Behavioral Interview</option>
              <option value="final">Final Round</option>
              <option value="other">Other</option>
            </Select>
          </FormSection>
          
          <FormSection>
            <Label>Format</Label>
            <FormatOptions>
              <FormatOption 
                $selected={format === 'video'} 
                onClick={() => handleFormatChange('video')}
              >
                <VideoCall />
                <span>Video Call</span>
              </FormatOption>
              <FormatOption 
                $selected={format === 'phone'} 
                onClick={() => handleFormatChange('phone')}
              >
                <Phone />
                <span>Phone</span>
              </FormatOption>
              <FormatOption 
                $selected={format === 'in_person'} 
                onClick={() => handleFormatChange('in_person')}
              >
                <LocationOn />
                <span>In Person</span>
              </FormatOption>
              <FormatOption 
                $selected={format === 'ai_agent'} 
                onClick={() => handleFormatChange('ai_agent')}
              >
                <SmartToy />
                <span>Agent AI Call</span>
              </FormatOption>
            </FormatOptions>
          </FormSection>
          
          <FormSection>
            <Label>Duration (minutes)</Label>
            <Select 
              value={duration} 
              onChange={(e) => setDuration(parseInt(e.target.value))}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </Select>
          </FormSection>
        </Card>
        
        {/* Time Slots */}
        <Card>
          <CardHeader>
            <AccessTime />
            <h2>Proposed Time Slots</h2>
          </CardHeader>
          
          <TimeSlots>
            {timeSlots.map((slot, index) => (
              <TimeSlot key={index}>
                <div className="slot-inputs">
                  <Input
                    type="date"
                    value={slot.date}
                    onChange={(e) => handleTimeSlotChange(index, 'date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    value={slot.time}
                    onChange={(e) => handleTimeSlotChange(index, 'time', e.target.value)}
                  />
                </div>
                {timeSlots.length > 1 && (
                  <RemoveButton onClick={() => handleRemoveTimeSlot(index)}>
                    <Delete fontSize="small" />
                  </RemoveButton>
                )}
              </TimeSlot>
            ))}
            
            <AddSlotButton onClick={handleAddTimeSlot}>
              <Add />
              Add Another Time Slot
            </AddSlotButton>
          </TimeSlots>
        </Card>
        
        {/* AI Phone Screening */}
        <Card>
          <PhoneScreeningSection>
            <PhoneScreeningHeader>
              <PhoneScreeningTitle>
                <SmartToy />
                <h3>{format === 'ai_agent' ? 'Agent AI Call Settings' : 'AI Phone Screening'}</h3>
                <span className="badge">NEW</span>
              </PhoneScreeningTitle>
              {format !== 'ai_agent' && (
                <Tooltip title={!candidateHasPhone ? "Candidate doesn't have a phone number on their profile" : ""}>
                  <span>
                    <Switch
                      checked={phoneScreeningEnabled}
                      onChange={(e) => setPhoneScreeningEnabled(e.target.checked)}
                      disabled={!candidateHasPhone}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: 'white',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        },
                      }}
                    />
                  </span>
                </Tooltip>
              )}
            </PhoneScreeningHeader>
            
            <PhoneScreeningDescription>
              {format === 'ai_agent' ? (
                <>
                  🤖 <strong>Agent AI will automatically call the candidate</strong> at the confirmed time 
                  to conduct a screening interview. The AI will assess their skills, experience, and 
                  interest level, then provide you with a detailed transcript and recommendation score.
                </>
              ) : (
                <>
                  Let our AI automatically call the candidate at the scheduled time to conduct an 
                  initial phone screening. The AI will ask relevant questions based on the job 
                  requirements and provide you with a detailed transcript and analysis.
                </>
              )}
            </PhoneScreeningDescription>
            
            {(phoneScreeningEnabled || format === 'ai_agent') && (
              <>
                <Label style={{ color: 'white', opacity: 0.9 }}>Screening Duration</Label>
                <PhoneScreeningOptions>
                  <DurationOption
                    $selected={phoneScreeningDuration === 15}
                    onClick={() => setPhoneScreeningDuration(15)}
                  >
                    15 minutes
                  </DurationOption>
                  <DurationOption
                    $selected={phoneScreeningDuration === 30}
                    onClick={() => setPhoneScreeningDuration(30)}
                  >
                    30 minutes
                  </DurationOption>
                </PhoneScreeningOptions>
                
                <PhoneWarning>
                  <Info />
                  <p>
                    {format === 'ai_agent' ? (
                      <>
                        📞 The AI Agent will call <strong>{candidate?.phone || 'N/A'}</strong> once 
                        the candidate confirms a time slot. You'll receive results within minutes.
                      </>
                    ) : (
                      <>
                        The AI will call the candidate's phone ({candidate?.phone || 'N/A'}) at the 
                        confirmed interview time. Results will be available within minutes after the call.
                      </>
                    )}
                  </p>
                </PhoneWarning>
              </>
            )}
            
            {!candidateHasPhone && (
              <PhoneWarning>
                <Info />
                <p>
                  {format === 'ai_agent' ? (
                    <>
                      ⚠️ <strong>Agent AI Call unavailable</strong> - The candidate hasn't added their 
                      phone number to their profile. They won't receive the AI call until they update their profile.
                    </>
                  ) : (
                    <>
                      Phone screening is unavailable because the candidate hasn't added their 
                      phone number to their profile.
                    </>
                  )}
                </p>
              </PhoneWarning>
            )}
          </PhoneScreeningSection>
        </Card>
        
        {/* Notes */}
        <Card>
          <CardHeader>
            <Info />
            <h2>Notes for Candidate</h2>
          </CardHeader>
          
          <FormSection>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any instructions or information for the candidate (optional)"
            />
          </FormSection>
        </Card>
        
        {/* Submit */}
        <SubmitButton 
          onClick={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? (
            <>
              <CircularProgress size={20} color="inherit" />
              Sending...
            </>
          ) : (
            <>
              <CheckCircle />
              Send Interview Request
            </>
          )}
        </SubmitButton>
      </Container>
    </PageContainer>
  );
};

export default ScheduleInterview;
