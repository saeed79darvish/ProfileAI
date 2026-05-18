import React, { useState, useEffect } from 'react';
import {
  slideIn,
  slideOut,
  Toast,
  PageContainer,
  Container,
  Header,
  TabsContainer,
  Tab,
  InterviewCard,
  CardHeader,
  JobTitle,
  CompanyInfo,
  StatusBadge,
  CardBody,
  AICallBanner,
  ScheduledTimeCard,
  InterviewDetails,
  DetailCard,
  RecruiterNotes,
  PhoneInfoBanner,
  ScreeningResultCard,
  CountdownTimer,
  SectionTitle,
  TimeSlots,
  TimeSlot,
  ActionButtons,
  Button,
  RescheduleSection,
  RescheduleSlotRow,
  AddSlotButton,
  EmptyState,
  ModalOverlay,
  Modal,
  ModalHeader,
  ModalBody,
  DateTimePickerContainer,
  DateTimeRow,
  InputGroup,
  QuickTimeSlots,
  QuickTimeSlot,
  CurrentScheduleInfo,
  ModalActions,
  LoadingSpinner
} from './styled';
import { QUICK_TIME_SLOTS, SCORE_THRESHOLDS, TIMINGS, LIMITS } from './constants';
import { formatPhoneNumber, formatDateTime, getEffectiveStatus, isInterviewTimePassed, getTimeUntilInterview, getTimeSinceScheduled } from './utils';

const newCountdowns = {};

const CandidateInterviews = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSlots, setSelectedSlots] = useState({});
  const [responding, setResponding] = useState({});
  const [showReschedule, setShowReschedule] = useState({});
  const [rescheduleSlots, setRescheduleSlots] = useState({});
  const [toast, setToast] = useState({ show: false, type: 'success', title: '', message: '' });
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  
  // User profile state (for phone number display)
  const [userProfile, setUserProfile] = useState(null);
  
  // AI caller phone number (for saving to contacts)
  const [callerInfo, setCallerInfo] = useState(null);
  
  // Cancel/Decline modal state
  const [cancelModal, setCancelModal] = useState({ show: false, interviewId: null, type: 'decline' }); // type: 'decline' or 'cancel'
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Generic confirm modal state
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    confirmText: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: null 
  });

  // Countdown timer state - updates every second for upcoming interviews
  const [countdowns, setCountdowns] = useState({});
  
  // Interview prep state
  const [prepData, setPrepData] = useState({});
  const [loadingPrep, setLoadingPrep] = useState({});

  // Update countdown timers every second
  useEffect(() => {
    const calculateCountdown = (targetDate) => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target - now;
      
      if (diff <= 0) return null;
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      return { days, hours, minutes, seconds };
    };

    const updateCountdowns = () => {
      interviews.forEach(interview => {
        if (interview.status === 'confirmed' && interview.scheduledAt) {
          const countdown = calculateCountdown(interview.scheduledAt);
          if (countdown) {
            newCountdowns[interview.id] = countdown;
          }
        }
      });
      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [interviews]);

  // Get today's date in YYYY-MM-DD format (local time)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  useEffect(() => {
    fetchInterviews();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/profiles/me');
      setUserProfile(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchCallerInfo = async () => {
    try {
      const response = await api.get('/phone-screening/caller-info');
      setCallerInfo(response.data);
    } catch (error) {
      console.error('Error fetching caller info:', error);
    }
  };

  useEffect(() => {
    fetchCallerInfo();
  }, []);

  const fetchInterviews = async () => {
    try {
      const response = await api.get('/interviews', {
        params: { role: 'candidate' }
      });
      // Deduplicate by interview ID (in case of any duplicate records)
      const uniqueInterviews = response.data.filter((interview, index, self) =>
        index === self.findIndex(i => i.id === interview.id)
      );
      setInterviews(uniqueInterviews);
    } catch (error) {
      console.error('Error fetching interviews:', error);
      showToast('error', 'Error', 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  // Fetch interview prep data (skill gaps to study)
  const fetchInterviewPrep = async (interviewId) => {
    if (prepData[interviewId] || loadingPrep[interviewId]) return;
    
    setLoadingPrep(prev => ({ ...prev, [interviewId]: true }));
    try {
      const response = await tailoredProfileAPI.getInterviewPrep(interviewId);
      if (response.data.success) {
        setPrepData(prev => ({ ...prev, [interviewId]: response.data.preparation }));
      }
    } catch (err) {
      console.error('Failed to fetch interview prep:', err);
    } finally {
      setLoadingPrep(prev => ({ ...prev, [interviewId]: false }));
    }
  };

  const handleConfirm = async (interviewId) => {
    const selectedIndex = selectedSlots[interviewId];
    if (selectedIndex === undefined) {
      showToast('error', 'Selection Required', 'Please select a time slot before confirming');
      return;
    }

    setResponding(prev => ({ ...prev, [interviewId]: true }));
    try {
      await api.post(`/interviews/${interviewId}/respond`, {
        action: 'accept',
        selectedSlotIndex: selectedIndex,
        message: 'Looking forward to the interview!'
      });
      
      fetchInterviews();
      showToast('success', 'Interview Confirmed! 🎉', 'Our AI agent will call you at the scheduled time.');
    } catch (error) {
      console.error('Error confirming interview:', error);
      showToast('error', 'Confirmation Failed', 'Unable to confirm interview. Please try again.');
    } finally {
      setResponding(prev => ({ ...prev, [interviewId]: false }));
    }
  };

  const handleDecline = (interviewId) => {
    setCancelModal({ show: true, interviewId, type: 'decline' });
    setCancelReason('');
  };

  const handleCancel = (interviewId) => {
    setCancelModal({ show: true, interviewId, type: 'cancel' });
    setCancelReason('');
  };

  const handleConfirmCancelOrDecline = async () => {
    const { interviewId, type } = cancelModal;
    setCancelling(true);
    
    try {
      if (type === 'decline') {
        await api.post(`/interviews/${interviewId}/respond`, {
          action: 'decline',
          message: cancelReason || 'Unfortunately, I am unable to proceed at this time.'
        });
        showToast('info', 'Interview Declined', 'The recruiter has been notified.');
      } else {
        // Cancel a confirmed interview
        await api.delete(`/interviews/${interviewId}`, {
          data: { reason: cancelReason || 'Candidate cancelled the interview.' }
        });
        showToast('info', 'Interview Cancelled', 'The recruiter has been notified of your cancellation.');
      }
      
      setCancelModal({ show: false, interviewId: null, type: 'decline' });
      setCancelReason('');
      fetchInterviews();
    } catch (error) {
      console.error(`Error ${type}ing interview:`, error);
      showToast('error', 'Action Failed', `Unable to ${type} interview. Please try again.`);
    } finally {
      setCancelling(false);
    }
  };

  const handleDismiss = (interviewId) => {
    setConfirmModal({
      show: true,
      title: 'Remove Interview',
      message: 'Are you sure you want to remove this interview from your list? This action cannot be undone.',
      confirmText: 'Remove',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setResponding(prev => ({ ...prev, [interviewId]: true }));
        try {
          await api.delete(`/interviews/${interviewId}/dismiss`);
          fetchInterviews();
          showToast('success', 'Interview Removed', 'The interview has been removed from your list.');
        } catch (error) {
          console.error('Error dismissing interview:', error);
          showToast('error', 'Action Failed', 'Unable to remove interview. Please try again.');
        } finally {
          setResponding(prev => ({ ...prev, [interviewId]: false }));
        }
      }
    });
  };

  const handleRescheduleRequest = async (interviewId) => {
    const slots = rescheduleSlots[interviewId] || [];
    const validSlots = slots.filter(s => s.date && s.time);
    
    if (validSlots.length === 0) {
      showToast('error', 'Time Slots Required', 'Please add at least one alternative time slot');
      return;
    }
    
    setResponding(prev => ({ ...prev, [interviewId]: true }));
    try {
      const proposedSlots = validSlots.map(s => ({
        datetime: new Date(`${s.date}T${s.time}`).toISOString(),
        duration: 30
      }));
      
      await api.post(`/interviews/${interviewId}/respond`, {
        action: 'reschedule',
        proposedSlots,
        message: "I'd like to reschedule to a different time."
      });
      
      setShowReschedule(prev => ({ ...prev, [interviewId]: false }));
      setRescheduleSlots(prev => ({ ...prev, [interviewId]: [] }));
      fetchInterviews();
      showToast('success', 'Reschedule Request Sent', 'The recruiter will review your proposed times.');
    } catch (error) {
      console.error('Error rescheduling interview:', error);
      showToast('error', 'Request Failed', 'Unable to send reschedule request. Please try again.');
    } finally {
      setResponding(prev => ({ ...prev, [interviewId]: false }));
    }
  };

  const handleQuickReschedule = async () => {
    if (!newDate || !newTime) {
      showToast('error', 'Date & Time Required', 'Please select both a date and time');
      return;
    }
    
    // Combine date and time
    const newDateTime = new Date(`${newDate}T${newTime}`);
    
    // Validate that the selected time is in the future
    if (newDateTime <= new Date()) {
      showToast('error', 'Invalid Time', 'Please select a time in the future');
      return;
    }
    
    setRescheduling(true);
    try {
      const interview = interviews.find(i => i.id === rescheduleModal);
      
      // Use the direct reschedule endpoint - bypasses AI validation
      await api.post(`/interviews/${rescheduleModal}/reschedule`, {
        newDateTime: newDateTime.toISOString(),
        reason: 'Rescheduled by candidate'
      });
      
      setRescheduleModal(null);
      setNewDate('');
      setNewTime('');
      fetchInterviews();
      showToast('success', 'Interview Rescheduled! 🎉', 'Your interview has been moved to the new time.');
    } catch (error) {
      console.error('Error rescheduling:', error);
      showToast('error', 'Reschedule Failed', error.response?.data?.message || 'Unable to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const addRescheduleSlot = (interviewId) => {
    setRescheduleSlots(prev => ({
      ...prev,
      [interviewId]: [...(prev[interviewId] || []), { date: '', time: '' }]
    }));
  };

  const updateRescheduleSlot = (interviewId, index, field, value) => {
    setRescheduleSlots(prev => {
      slots[index] = { ...slots[index], [field]: value };
      return { ...prev, [interviewId]: slots };
    });
  };

  const removeRescheduleSlot = (interviewId, index) => {
    setRescheduleSlots(prev => {
      slots.splice(index, 1);
      return { ...prev, [interviewId]: slots };
    });
  };

  const toggleReschedule = (interviewId) => {
    setShowReschedule(prev => ({ ...prev, [interviewId]: !prev[interviewId] }));
    if (!rescheduleSlots[interviewId]?.length) {
      addRescheduleSlot(interviewId);
    }
  };

  // Helper function to get display text for status
  const getStatusDisplayText = (effectiveStatus, interview) => {
    // Check if it's a confirmed interview that's upcoming
    if (effectiveStatus === 'confirmed' && interview) {
      const timePassed = isInterviewTimePassed(interview);
      if (!timePassed) return 'Upcoming';
      
      // Check how long ago
      const timeSince = getTimeSinceScheduled(interview.scheduledAt);
      if (timeSince.hoursAgo >= 2) return 'Needs Action';
      return 'Awaiting Call';
    }
    
    switch (effectiveStatus) {
      case 'interviewed': return 'Screening Done';
      case 'in_call': return 'In Call';
      case 'call_failed': return 'Call Failed';
      case 'needs_reschedule': return 'Needs Reschedule';
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);
    }
  };

  const filteredInterviews = interviews.filter(interview => {
    const effectiveStatus = getEffectiveStatus(interview);
    const timePassed = interview.scheduledAt ? isInterviewTimePassed(interview) : false;
    const timeSince = interview.scheduledAt ? getTimeSinceScheduled(interview.scheduledAt) : { hoursAgo: 0 };
    const needsAction = interview.status === 'confirmed' && timePassed && timeSince.hoursAgo >= 2;
    
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return interview.status === 'pending' || effectiveStatus === 'needs_reschedule' || effectiveStatus === 'call_failed' || needsAction;
    if (activeTab === 'confirmed') return interview.status === 'confirmed' && effectiveStatus !== 'interviewed' && effectiveStatus !== 'call_failed' && !needsAction;
    if (activeTab === 'completed') return interview.status === 'completed' || interview.status === 'cancelled' || effectiveStatus === 'interviewed';
    return true;
  });

  const pendingCount = interviews.filter(i => {
    const status = getEffectiveStatus(i);
    const timePassed = i.scheduledAt ? isInterviewTimePassed(i) : false;
    const timeSince = i.scheduledAt ? getTimeSinceScheduled(i.scheduledAt) : { hoursAgo: 0 };
    const needsAction = i.status === 'confirmed' && timePassed && timeSince.hoursAgo >= 2;
    return i.status === 'pending' || status === 'needs_reschedule' || status === 'call_failed' || needsAction;
  }).length;
  const confirmedCount = interviews.filter(i => {
    const status = getEffectiveStatus(i);
    const timePassed = i.scheduledAt ? isInterviewTimePassed(i) : false;
    const timeSince = i.scheduledAt ? getTimeSinceScheduled(i.scheduledAt) : { hoursAgo: 0 };
    const needsAction = i.status === 'confirmed' && timePassed && timeSince.hoursAgo >= 2;
    return i.status === 'confirmed' && status !== 'interviewed' && status !== 'call_failed' && !needsAction;
  }).length;
  const interviewedCount = interviews.filter(i => getEffectiveStatus(i) === 'interviewed').length;

  if (loading) {
    return (
      <PageContainer>
        <Container>
          <LoadingSpinner>
            <div className="spinner" />
            <p>Loading your interviews...</p>
          </LoadingSpinner>
        </Container>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Container>
        <Header>
          <h1>My Interviews</h1>
          <p>Manage your interview invitations. Our AI agent will call you automatically at the scheduled time.</p>
        </Header>

        <TabsContainer>
          <Tab $active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
            All
            <span className="count">{interviews.length}</span>
          </Tab>
          <Tab $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
            Action Needed
            {pendingCount > 0 && <span className="count">{pendingCount}</span>}
          </Tab>
          <Tab $active={activeTab === 'confirmed'} onClick={() => setActiveTab('confirmed')}>
            Upcoming
            {confirmedCount > 0 && <span className="count">{confirmedCount}</span>}
          </Tab>
          <Tab $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
            History
          </Tab>
        </TabsContainer>

        {filteredInterviews.length === 0 ? (
          <EmptyState>
            <div className="icon-container">
              <Schedule />
            </div>
            <h3>No Interviews {activeTab !== 'all' ? `(${activeTab})` : ''}</h3>
            <p>
              {activeTab === 'pending' 
                ? "No interviews need your attention right now."
                : activeTab === 'confirmed'
                ? "You don't have any upcoming interviews scheduled."
                : "No interview history to display."}
            </p>
          </EmptyState>
        ) : (
          filteredInterviews.map(interview => {
            const effectiveStatus = getEffectiveStatus(interview);
            const statusText = getStatusDisplayText(effectiveStatus, interview);
            const timePassed = interview.scheduledAt ? isInterviewTimePassed(interview) : false;
            const timeUntil = interview.scheduledAt ? getTimeUntilInterview(interview.scheduledAt) : null;
            const timeSince = interview.scheduledAt ? getTimeSinceScheduled(interview.scheduledAt) : { text: null, hoursAgo: 0 };
            
            return (
            <InterviewCard key={interview.id}>
              <CardHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <JobTitle>{interview.job?.title || 'Job Position'}</JobTitle>
                    <CompanyInfo>
                      <Business />
                      {interview.job?.company || 'Company'}
                    </CompanyInfo>
                  </div>
                  <StatusBadge $status={
                    effectiveStatus === 'confirmed' && timePassed 
                      ? (timeSince.hoursAgo >= 2 ? 'needs_action' : 'awaiting')
                      : effectiveStatus
                  }>
                    {effectiveStatus === 'pending' && <AccessTime style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'confirmed' && !timePassed && <EventAvailable style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'confirmed' && timePassed && timeSince.hoursAgo < 2 && <AccessTime style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'confirmed' && timePassed && timeSince.hoursAgo >= 2 && <Warning style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'interviewed' && <CheckCircle style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'in_call' && <Phone style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'call_failed' && <ErrorIcon style={{ fontSize: 16 }} />}
                    {effectiveStatus === 'needs_reschedule' && <Schedule style={{ fontSize: 16 }} />}
                    {statusText}
                  </StatusBadge>
                </div>
              </CardHeader>

              <CardBody>
                {/* AI Call Completed - Show screening completed and awaiting decision */}
                {effectiveStatus === 'interviewed' && (
                  <>
                    <AICallBanner style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', borderColor: '#86efac' }}>
                      <div className="icon-container" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
                        <CheckCircle />
                      </div>
                      <div className="content">
                        <div className="title" style={{ color: '#166534' }}>Screening Completed Successfully ✓</div>
                        <div className="description" style={{ color: '#15803d' }}>
                          Great job! Your AI phone screening has been successfully completed.
                          {interview.phoneScreening?.durationSeconds && (
                            <> Call duration: {Math.round(interview.phoneScreening.durationSeconds / 60)} minutes.</>
                          )}
                        </div>
                      </div>
                    </AICallBanner>

                    <AICallBanner style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', borderColor: '#a5b4fc' }}>
                      <div className="icon-container" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                        <AccessTime />
                      </div>
                      <div className="content">
                        <div className="title" style={{ color: '#3730a3' }}>Awaiting Hiring Manager Decision</div>
                        <div className="description" style={{ color: '#4338ca' }}>
                          Your screening results have been sent to the hiring team. They will review your interview and get back to you with next steps.
                        </div>
                      </div>
                    </AICallBanner>

                    {/* Screening Score Display */}
                    {interview.phoneScreening?.screeningScore != null && (
                      <ScreeningResultCard $score={interview.phoneScreening.screeningScore}>
                        <div className="header">
                          <div className="icon-container">
                            <CheckCircle />
                          </div>
                          <div className="title">Your Screening Performance</div>
                        </div>
                        <div className="score-section">
                          <div className="score-badge">
                            <span className="value">{Math.round(interview.phoneScreening.screeningScore)}</span>
                            <span className="label">Score</span>
                          </div>
                          <div className="score-description">
                            <div className="score-label">
                              {interview.phoneScreening.screeningScore >= 80 ? 'Excellent Performance!' :
                               interview.phoneScreening.screeningScore >= 60 ? 'Good Performance' :
                               interview.phoneScreening.screeningScore >= 40 ? 'Fair Performance' :
                               'Keep Improving'}
                            </div>
                            <div className="score-text">
                              {interview.phoneScreening.screeningScore >= 80 
                                ? 'You did an outstanding job on the screening. Your responses were clear and relevant.'
                                : interview.phoneScreening.screeningScore >= 60 
                                  ? 'You performed well during the screening. Your answers showed good understanding.'
                                  : interview.phoneScreening.screeningScore >= 40
                                    ? 'Your screening went reasonably well. Consider practicing for future interviews.'
                                    : 'Every interview is a learning experience. Keep practicing and improving!'}
                            </div>
                          </div>
                        </div>
                        {interview.phoneScreening?.summary && (
                          <div className="summary-section">
                            <div className="summary-label">Interview Summary</div>
                            <div className="summary-text">{interview.phoneScreening.summary}</div>
                          </div>
                        )}
                      </ScreeningResultCard>
                    )}
                    
                    <ActionButtons style={{ justifyContent: 'flex-end' }}>
                      <Button 
                        $variant="ghost"
                        onClick={() => handleDismiss(interview.id)}
                        disabled={responding[interview.id]}
                        style={{ color: '#94a3b8' }}
                      >
                        <Delete style={{ fontSize: 18 }} />
                        Remove from List
                      </Button>
                    </ActionButtons>
                  </>
                )}

                {/* AI Call Failed Banner */}
                {effectiveStatus === 'call_failed' && (
                  <>
                    <AICallBanner style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', borderColor: '#fca5a5' }}>
                      <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)' }}>
                        <Warning />
                      </div>
                      <div className="content">
                        <div className="title" style={{ color: '#991b1b' }}>
                          {interview.phoneScreening?.endedReason === 'customer-did-not-answer' || 
                           interview.phoneScreening?.endedReason === 'customer-busy' ||
                           interview.phoneScreening?.endedReason === 'customer-ended-call'
                            ? 'Call Not Completed'
                            : 'Screening Call Missed'}
                        </div>
                        <div className="description" style={{ color: '#b91c1c' }}>
                          {interview.phoneScreening?.endedReason === 'customer-did-not-answer' && 
                            'The call was not answered. Please reschedule for a time when you can take the call.'}
                          {interview.phoneScreening?.endedReason === 'customer-busy' && 
                            'The line was busy. Please reschedule for a time when your phone is available.'}
                          {interview.phoneScreening?.endedReason === 'customer-ended-call' && 
                            'The call was declined. If this was unintentional, please reschedule.'}
                          {interview.phoneScreening?.status === 'voicemail' && 
                            'The call went to voicemail. Please reschedule for a time when you can answer.'}
                          {interview.phoneScreening?.status === 'no_answer' && !interview.phoneScreening?.endedReason && 
                            'The call was not answered.'}
                          {interview.phoneScreening?.status === 'busy' && !interview.phoneScreening?.endedReason && 
                            'The line was busy.'}
                          {interview.phoneScreening?.status === 'failed' && !interview.phoneScreening?.endedReason && 
                            'There was a technical issue with the call.'}
                          {!interview.phoneScreening?.endedReason && !['no_answer', 'busy', 'failed', 'voicemail'].includes(interview.phoneScreening?.status) &&
                            'Unfortunately, the AI agent was unable to complete the screening call.'}
                        </div>
                      </div>
                    </AICallBanner>
                    
                    <ActionButtons>
                      <Button 
                        $variant="primary"
                        onClick={() => setRescheduleModal(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Schedule />
                        Reschedule Call
                      </Button>
                      <Button 
                        $variant="danger"
                        onClick={() => handleDismiss(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Delete />
                        Remove
                      </Button>
                    </ActionButtons>
                  </>
                )}

                {/* Needs Reschedule - Interview was rescheduled, needs new time selection */}
                {effectiveStatus === 'needs_reschedule' && (
                  <>
                    <AICallBanner style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderColor: '#fbbf24' }}>
                      <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                        <Schedule />
                      </div>
                      <div className="content">
                        <div className="title" style={{ color: '#92400e' }}>Interview Needs to be Rescheduled</div>
                        <div className="description" style={{ color: '#a16207' }}>
                          This interview needs to be rescheduled. Please contact the recruiter to arrange a new time, or remove this interview from your list.
                        </div>
                      </div>
                    </AICallBanner>
                    
                    <ActionButtons>
                      <Button 
                        $variant="primary"
                        onClick={() => setRescheduleModal(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Schedule />
                        Request New Time
                      </Button>
                      <Button 
                        $variant="ghost"
                        onClick={() => handleDismiss(interview.id)}
                        disabled={responding[interview.id]}
                        style={{ color: '#94a3b8' }}
                      >
                        <Delete style={{ fontSize: 18 }} />
                        Remove from List
                      </Button>
                    </ActionButtons>
                  </>
                )}

                {/* AI Call Banner - Show for pending interviews */}
                {effectiveStatus === 'pending' && (
                <AICallBanner>
                  <div className="icon-container">
                    <SmartToy />
                  </div>
                  <div className="content">
                    <div className="title">AI-Powered Interview</div>
                    <div className="description">
                      Once confirmed, our AI agent will call you automatically. No need to join any meeting link.
                    </div>
                  </div>
                </AICallBanner>
                )}

                {/* Upcoming Interview - Before scheduled time */}
                {effectiveStatus === 'confirmed' && !timePassed && (
                <AICallBanner style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderColor: '#86efac' }}>
                  <div className="icon-container" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
                    <EventAvailable />
                  </div>
                  <div className="content">
                    <div className="title" style={{ color: '#166534' }}>Upcoming Interview {timeUntil && `• In ${timeUntil}`}</div>
                    <div className="description" style={{ color: '#15803d' }}>
                      Our AI agent will call you at the scheduled time. Make sure your phone is available and you're in a quiet place!
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#166534' }}>
                      <strong>Preparation Tips:</strong>
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Be in a quiet environment</li>
                        <li>Have your phone charged and ready</li>
                        <li>Review the job description beforehand</li>
                      </ul>
                    </div>
                  </div>
                </AICallBanner>
                )}

                {/* Countdown Timer for Upcoming Interviews */}
                {effectiveStatus === 'confirmed' && !timePassed && countdowns[interview.id] && (
                  <CountdownTimer>
                    {countdowns[interview.id].days > 0 && (
                      <>
                        <div className="countdown-item">
                          <span className="value">{String(countdowns[interview.id].days).padStart(2, '0')}</span>
                          <span className="label">Days</span>
                        </div>
                        <span className="separator">:</span>
                      </>
                    )}
                    <div className="countdown-item">
                      <span className="value">{String(countdowns[interview.id].hours).padStart(2, '0')}</span>
                      <span className="label">Hours</span>
                    </div>
                    <span className="separator">:</span>
                    <div className="countdown-item">
                      <span className="value">{String(countdowns[interview.id].minutes).padStart(2, '0')}</span>
                      <span className="label">Min</span>
                    </div>
                    <span className="separator">:</span>
                    <div className="countdown-item">
                      <span className="value">{String(countdowns[interview.id].seconds).padStart(2, '0')}</span>
                      <span className="label">Sec</span>
                    </div>
                  </CountdownTimer>
                )}

                {/* Awaiting Call - After scheduled time but no call yet */}
                {effectiveStatus === 'confirmed' && timePassed && (
                  <>
                    {/* Recently passed (within 2 hours) - May still receive call */}
                    {timeSince.hoursAgo < 2 && (
                      <AICallBanner style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderColor: '#fbbf24' }}>
                        <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                          <AccessTime />
                        </div>
                        <div className="content">
                          <div className="title" style={{ color: '#92400e' }}>Awaiting AI Call</div>
                          <div className="description" style={{ color: '#a16207' }}>
                            Your interview was scheduled for {formatDateTime(interview.scheduledAt).date} at {formatDateTime(interview.scheduledAt).time}. 
                            The AI agent may call you shortly. Keep your phone nearby and available.
                          </div>
                          <div style={{ 
                            marginTop: '12px', 
                            padding: '10px 12px', 
                            background: 'rgba(255,255,255,0.7)', 
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#78350f'
                          }}>
                            {callerInfo?.callerNumber ? (
                              <>
                                <strong>📱 The call will come from:</strong> <strong style={{ fontFamily: 'monospace' }}>{formatPhoneNumber(callerInfo.callerNumber)}</strong>
                                <br />Save it to your contacts as "<strong>{interview.job?.company || 'AI Recruiter'}</strong>".
                              </>
                            ) : (
                              <>
                                <strong>💡 Tip:</strong> When you receive the call, save that number as "<strong>{interview.job?.company || 'AI Recruiter'}</strong>".
                              </>
                            )}
                          </div>
                        </div>
                      </AICallBanner>
                    )}
                    
                    {/* Long time passed (over 2 hours) - Likely missed, offer reschedule */}
                    {timeSince.hoursAgo >= 2 && (
                      <AICallBanner style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', borderColor: '#fca5a5' }}>
                        <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)' }}>
                          <Warning />
                        </div>
                        <div className="content">
                          <div className="title" style={{ color: '#991b1b' }}>Interview May Have Been Missed</div>
                          <div className="description" style={{ color: '#b91c1c' }}>
                            Your interview was scheduled {timeSince.text} ({formatDateTime(interview.scheduledAt).date} at {formatDateTime(interview.scheduledAt).time}). 
                            If you didn't receive a call, you can reschedule for a new time or remove this from your list.
                          </div>
                        </div>
                      </AICallBanner>
                    )}
                    
                    <ActionButtons>
                      <Button 
                        $variant="primary"
                        onClick={() => setRescheduleModal(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Schedule style={{ fontSize: 18 }} />
                        Reschedule Interview
                      </Button>
                      <Button 
                        $variant="ghost"
                        onClick={() => handleDismiss(interview.id)}
                        disabled={responding[interview.id]}
                        style={{ color: '#94a3b8' }}
                      >
                        <Delete style={{ fontSize: 18 }} />
                        Remove from List
                      </Button>
                    </ActionButtons>
                  </>
                )}

                {/* Confirmed Interview - Show scheduled time only for upcoming (not passed, not failed) */}
                {interview.status === 'confirmed' && interview.scheduledAt && effectiveStatus !== 'interviewed' && effectiveStatus !== 'call_failed' && effectiveStatus !== 'needs_reschedule' && !timePassed && (
                  <ScheduledTimeCard>
                    <div className="header">
                      <EventAvailable />
                      <span className="title">Interview Scheduled</span>
                    </div>
                    <div className="datetime">
                      <div className="item">
                        <CalendarToday />
                        <div>
                          <div className="label">Date</div>
                          <div className="value">{formatDateTime(interview.scheduledAt).date}</div>
                        </div>
                      </div>
                      <div className="item">
                        <AccessTime />
                        <div>
                          <div className="label">Time ({formatDateTime(interview.scheduledAt).timezone})</div>
                          <div className="value">{formatDateTime(interview.scheduledAt).time}</div>
                        </div>
                      </div>
                    </div>
                  </ScheduledTimeCard>
                )}

                {/* Phone Number Display - Show for confirmed interviews */}
                {interview.status === 'confirmed' && interview.scheduledAt && effectiveStatus !== 'interviewed' && effectiveStatus !== 'call_failed' && effectiveStatus !== 'needs_reschedule' && !timePassed && userProfile?.phone && (
                  <PhoneInfoBanner>
                    <div className="icon-container">
                      <Phone />
                    </div>
                    <div className="content">
                      <div className="label">AI Call Will Ring On</div>
                      <div className="phone">{userProfile.phone}</div>
                      <div className="note">Keep this phone nearby and available at the scheduled time</div>
                      <div className="caller-tip">
                        <Info className="tip-icon" style={{ fontSize: 18 }} />
                        <div className="tip-text">
                          {callerInfo?.callerNumber ? (
                            <>
                              <strong>📱 Save this number:</strong> <strong style={{ fontFamily: 'monospace', fontSize: '14px' }}>{formatPhoneNumber(callerInfo.callerNumber)}</strong>
                              <br />Save it to your contacts as "<strong>{interview.job?.company || 'AI Recruiter'}</strong>" to avoid missing calls.
                            </>
                          ) : (
                            <>
                              <strong>💡 Important:</strong> When you receive the call, <strong>save that phone number</strong> to your contacts as "<strong>{interview.job?.company || 'AI Recruiter'}</strong>". This prevents future calls from going to spam.
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </PhoneInfoBanner>
                )}

                {/* Interview Details - Hide for completed, failed, rescheduled, or time passed interviews */}
                {effectiveStatus !== 'interviewed' && effectiveStatus !== 'call_failed' && effectiveStatus !== 'needs_reschedule' && !timePassed && (
                <InterviewDetails>
                  <DetailCard>
                    <div className="icon">
                      <Phone />
                    </div>
                    <div className="info">
                      <div className="label">Format</div>
                      <div className="value">AI Phone Call</div>
                    </div>
                  </DetailCard>
                  <DetailCard>
                    <div className="icon">
                      <AccessTime />
                    </div>
                    <div className="info">
                      <div className="label">Duration</div>
                      <div className="value">{interview.duration || 30} minutes</div>
                    </div>
                  </DetailCard>
                  <DetailCard>
                    <div className="icon">
                      <Work />
                    </div>
                    <div className="info">
                      <div className="label">Type</div>
                      <div className="value">{interview.type || 'Screening'}</div>
                    </div>
                  </DetailCard>
                </InterviewDetails>
                )}

                {/* Recruiter Notes - Hide for completed, failed, rescheduled, or time passed interviews */}
                {interview.recruiterNotes && effectiveStatus !== 'interviewed' && effectiveStatus !== 'call_failed' && effectiveStatus !== 'needs_reschedule' && !timePassed && (
                  <RecruiterNotes>
                    <div className="title">
                      <Info style={{ fontSize: 18 }} />
                      Note from Recruiter
                    </div>
                    <div className="content">{interview.recruiterNotes}</div>
                  </RecruiterNotes>
                )}

                {/* Pending: Time Slot Selection */}
                {interview.status === 'pending' && interview.proposedSlots && (
                  <>
                    <SectionTitle>
                      <CalendarToday style={{ fontSize: 18 }} />
                      Select Your Preferred Time
                    </SectionTitle>
                    <TimeSlots>
                      {interview.proposedSlots.map((slot, index) => {
                        const { date, time } = formatDateTime(slot.datetime);
                        return (
                          <TimeSlot
                            key={index}
                            $selected={selectedSlots[interview.id] === index}
                            onClick={() => setSelectedSlots(prev => ({ 
                              ...prev, 
                              [interview.id]: index 
                            }))}
                          >
                            <div className="icon">
                              <CalendarToday />
                            </div>
                            <div className="details">
                              <div className="date">{date}</div>
                              <div className="time">{time}</div>
                            </div>
                            <CheckCircle className="check" />
                          </TimeSlot>
                        );
                      })}
                    </TimeSlots>

                    <ActionButtons>
                      <Button 
                        $variant="danger"
                        onClick={() => handleDecline(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Close />
                        Decline
                      </Button>
                      <Button 
                        $variant="secondary"
                        onClick={() => toggleReschedule(interview.id)}
                        disabled={responding[interview.id]}
                      >
                        <Schedule />
                        {showReschedule[interview.id] ? 'Cancel' : 'Reschedule Interview'}
                      </Button>
                      <Button 
                        $variant="primary"
                        onClick={() => handleConfirm(interview.id)}
                        disabled={responding[interview.id] || selectedSlots[interview.id] === undefined}
                      >
                        <CheckCircle />
                        {responding[interview.id] ? 'Confirming...' : 'Confirm Time'}
                      </Button>
                      <Button 
                        $variant="ghost"
                        onClick={() => handleDismiss(interview.id)}
                        disabled={responding[interview.id]}
                        style={{ color: '#94a3b8' }}
                      >
                        <Delete style={{ fontSize: 18 }} />
                        Remove
                      </Button>
                    </ActionButtons>

                    {showReschedule[interview.id] && (
                      <RescheduleSection>
                        <SectionTitle>Propose Alternative Times</SectionTitle>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
                          Add time slots that work better for you.
                        </p>
                        
                        {(rescheduleSlots[interview.id] || []).map((slot, index) => (
                          <RescheduleSlotRow key={index}>
                            <input 
                              type="date" 
                              value={slot.date}
                              min={getTodayDate()}
                              onChange={(e) => updateRescheduleSlot(interview.id, index, 'date', e.target.value)}
                            />
                            <input 
                              type="time" 
                              value={slot.time}
                              onChange={(e) => updateRescheduleSlot(interview.id, index, 'time', e.target.value)}
                            />
                            {(rescheduleSlots[interview.id] || []).length > 1 && (
                              <button type="button" onClick={() => removeRescheduleSlot(interview.id, index)}>
                                <Close style={{ fontSize: 18 }} />
                              </button>
                            )}
                          </RescheduleSlotRow>
                        ))}
                        
                        <AddSlotButton onClick={() => addRescheduleSlot(interview.id)}>
                          + Add Another Time
                        </AddSlotButton>
                        
                        <Button 
                          $variant="primary"
                          onClick={() => handleRescheduleRequest(interview.id)}
                          disabled={responding[interview.id]}
                          style={{ width: '100%' }}
                        >
                          <Schedule />
                          {responding[interview.id] ? 'Sending...' : 'Send Request'}
                        </Button>
                      </RescheduleSection>
                    )}
                  </>
                )}

                {/* Confirmed: Show reschedule and cancel options only for upcoming interviews (not past) */}
                {interview.status === 'confirmed' && !timePassed && effectiveStatus !== 'interviewed' && (
                  <ActionButtons>
                    <Button 
                      $variant="danger"
                      onClick={() => handleCancel(interview.id)}
                      disabled={responding[interview.id]}
                    >
                      <Close />
                      Cancel Interview
                    </Button>
                    <Button 
                      onClick={() => setRescheduleModal(interview.id)}
                    >
                      <Edit />
                      Reschedule Interview
                    </Button>
                    <Button 
                      $variant="ghost"
                      onClick={() => handleDismiss(interview.id)}
                      disabled={responding[interview.id]}
                      style={{ color: '#94a3b8' }}
                    >
                      <Delete style={{ fontSize: 18 }} />
                      Remove
                    </Button>
                  </ActionButtons>
                )}

                {/* Cancelled: Show remove option */}
                {interview.status === 'cancelled' && (
                  <ActionButtons style={{ justifyContent: 'flex-end' }}>
                    <Button 
                      $variant="ghost"
                      onClick={() => handleDismiss(interview.id)}
                      disabled={responding[interview.id]}
                      style={{ color: '#94a3b8' }}
                    >
                      <Delete style={{ fontSize: 18 }} />
                      Remove from List
                    </Button>
                  </ActionButtons>
                )}

                {/* Interview Prep - Skill Gaps Reminder */}
                {(effectiveStatus === 'confirmed' || effectiveStatus === 'pending') && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px 16px', 
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                    borderRadius: '12px',
                    border: '1px solid #f59e0b40'
                  }}>
                    {!prepData[interview.id] && !loadingPrep[interview.id] ? (
                      <button type="button" 
                        onClick={() => fetchInterviewPrep(interview.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#92400e', fontWeight: 600, fontSize: '14px', padding: 0
                        }}
                      >
                        📚 Prepare for Interview, Review skill gaps
                      </button>
                    ) : loadingPrep[interview.id] ? (
                      <div style={{ color: '#92400e', fontSize: '13px' }}>Loading preparation guide...</div>
                    ) : prepData[interview.id] ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px', fontSize: '14px' }}>
                          📚 Interview Preparation
                        </div>
                        {prepData[interview.id].criticalGaps?.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                              🔴 Critical Skills to Review:
                            </div>
                            {prepData[interview.id].criticalGaps.map((gap, gi) => (
                              <div key={gi} style={{ fontSize: '12px', color: '#7f1d1d', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>• <strong>{gap.skill}</strong></span>
                                {gap.learningResource && (
                                  <span style={{ color: '#6366f1', fontSize: '11px' }}>💡 {gap.learningResource}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {prepData[interview.id].importantGaps?.length > 0 && (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', marginBottom: '4px' }}>
                              🟡 Important Skills:
                            </div>
                            {prepData[interview.id].importantGaps.slice(0, 3).map((gap, gi) => (
                              <div key={gi} style={{ fontSize: '12px', color: '#78350f', padding: '2px 0' }}>
                                • <strong>{gap.skill}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                        {prepData[interview.id].tips?.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#92400e', fontStyle: 'italic' }}>
                            {prepData[interview.id].tips[0]}
                          </div>
                        )}
                        {prepData[interview.id].totalGaps === 0 && (
                          <div style={{ fontSize: '13px', color: '#059669' }}>
                            ✅ Great match! No major skill gaps identified for this role.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardBody>
            </InterviewCard>
          );
          })
        )}

</Container>
      
      {/* Toast Notification */}
      {toast.show && (
        <Toast $show={toast.show} $type={toast.type}>
          <div className="icon">
            {toast.type === 'success' ? <CheckCircle style={{ fontSize: 18 }} /> : 
             toast.type === 'error' ? <ErrorIcon style={{ fontSize: 18 }} /> :
             <Schedule style={{ fontSize: 18 }} />}
          </div>
          <div className="content">
            <div className="title">{toast.title}</div>
            <div className="message">{toast.message}</div>
          </div>
          <button type="button" className="close-btn" onClick={hideToast}>
            <Close style={{ fontSize: 18 }} />
          </button>
        </Toast>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <ModalOverlay onClick={() => setRescheduleModal(null)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <div className="header-content">
                <div className="icon">
                  <Schedule />
                </div>
                <div className="text">
                  <h3>Reschedule Interview</h3>
                  <p>Choose a new date and time</p>
                </div>
              </div>
            </ModalHeader>
            
            <ModalBody>
              {/* Show current scheduled time */}
              {interviews.find(i => i.id === rescheduleModal)?.scheduledAt && (
                <CurrentScheduleInfo>
                  <CalendarToday />
                  <div className="info">
                    <div className="label">Currently scheduled</div>
                    <div className="value">
                      {formatDateTime(interviews.find(i => i.id === rescheduleModal)?.scheduledAt).date} at{' '}
                      {formatDateTime(interviews.find(i => i.id === rescheduleModal)?.scheduledAt).time}
                    </div>
                  </div>
                </CurrentScheduleInfo>
              )}
              
              <DateTimePickerContainer>
                <DateTimeRow>
                  <InputGroup>
                    <label>📅 Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      min={getTodayDate()}
                    />
                  </InputGroup>
                  <InputGroup>
                    <label>🕐 Time</label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                    />
                  </InputGroup>
                </DateTimeRow>
                
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px', display: 'block' }}>
                    Quick select time
                  </label>
                  <QuickTimeSlots>
                    {QUICK_TIME_SLOTS.map((slot) => (
                      <QuickTimeSlot
                        key={slot.value}
                        $selected={newTime === slot.value}
                        onClick={() => setNewTime(slot.value)}
                      >
                        {slot.label}
                      </QuickTimeSlot>
                    ))}
                  </QuickTimeSlots>
                </div>
              </DateTimePickerContainer>
              
              {newDate && newTime && (
                <div style={{ 
                  padding: '14px 16px', 
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', 
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <CheckCircle style={{ color: '#16a34a', fontSize: '20px' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', textTransform: 'uppercase' }}>New Time</div>
                    <div style={{ fontSize: '14px', color: '#166534', fontWeight: '600' }}>
                      {formatDateTime(new Date(`${newDate}T${newTime}`)).date} at {formatDateTime(new Date(`${newDate}T${newTime}`)).time}
                    </div>
                  </div>
                </div>
              )}
              
              <ModalActions>
                <Button
                  $variant="secondary"
                  onClick={() => {
                    setRescheduleModal(null);
                    setNewDate('');
                    setNewTime('');
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  $variant="primary"
                  onClick={handleQuickReschedule}
                  disabled={rescheduling || !newDate || !newTime}
                  style={{ flex: 1 }}
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm New Time'}
                </Button>
              </ModalActions>
            </ModalBody>
          </Modal>
        </ModalOverlay>
      )}
      
      {/* Cancel/Decline Modal */}
      {cancelModal.show && (
        <ModalOverlay onClick={() => setCancelModal({ show: false, interviewId: null, type: 'decline' })}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <div className="header-content">
                <div className="icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                  {cancelModal.type === 'cancel' ? <Close /> : <Warning />}
                </div>
                <div className="text">
                  <h3>{cancelModal.type === 'cancel' ? 'Cancel Interview' : 'Decline Interview'}</h3>
                  <p>{cancelModal.type === 'cancel' ? 'This will cancel your scheduled interview' : 'Let the recruiter know you\'re not interested'}</p>
                </div>
              </div>
            </ModalHeader>
            
            <ModalBody>
              <div style={{ 
                padding: '16px', 
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <Warning style={{ color: '#dc2626', fontSize: '24px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                    {cancelModal.type === 'cancel' ? 'Are you sure you want to cancel?' : 'Are you sure you want to decline?'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#b91c1c' }}>
                    {cancelModal.type === 'cancel' 
                      ? 'The recruiter will be notified that you cancelled this interview. This action cannot be undone.'
                      : 'The recruiter will be notified that you declined this interview invitation.'}
                  </div>
                </div>
              </div>
              
              <InputGroup style={{ marginBottom: '20px' }}>
                <label style={{ marginBottom: '8px', display: 'block' }}>
                  💬 Reason (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={cancelModal.type === 'cancel' 
                    ? "Let the recruiter know why you're cancelling..." 
                    : "Let the recruiter know why you're declining..."}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '15px',
                    resize: 'vertical',
                    minHeight: '100px',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    background: '#f8fafc',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#ef4444';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.background = '#f8fafc';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </InputGroup>
              
              <ModalActions>
                <Button
                  $variant="secondary"
                  onClick={() => {
                    setCancelModal({ show: false, interviewId: null, type: 'decline' });
                    setCancelReason('');
                  }}
                  style={{ flex: 1 }}
                  disabled={cancelling}
                >
                  Go Back
                </Button>
                <Button
                  $variant="danger"
                  onClick={handleConfirmCancelOrDecline}
                  disabled={cancelling}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', border: 'none' }}
                >
                  {cancelling 
                    ? (cancelModal.type === 'cancel' ? 'Cancelling...' : 'Declining...') 
                    : (cancelModal.type === 'cancel' ? 'Yes, Cancel Interview' : 'Yes, Decline Interview')}
                </Button>
              </ModalActions>
            </ModalBody>
          </Modal>
        </ModalOverlay>
      )}

      {/* Generic Confirm Modal */}
      {confirmModal.show && (
        <ModalOverlay onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <Modal onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <ModalHeader style={{ 
              background: confirmModal.confirmVariant === 'danger' 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' 
            }}>
              <div className="header-content">
                <div className="icon" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                  {confirmModal.confirmVariant === 'danger' ? <Warning /> : <Info />}
                </div>
                <div className="text">
                  <h3>{confirmModal.title}</h3>
                </div>
              </div>
            </ModalHeader>
            
            <ModalBody>
              <div style={{ 
                padding: '16px', 
                background: confirmModal.confirmVariant === 'danger'
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                  : 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', 
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <Warning style={{ 
                  color: confirmModal.confirmVariant === 'danger' ? '#dc2626' : '#6366f1', 
                  fontSize: '24px', 
                  flexShrink: 0 
                }} />
                <div style={{ 
                  fontSize: '15px', 
                  color: confirmModal.confirmVariant === 'danger' ? '#991b1b' : '#3730a3',
                  lineHeight: '1.5'
                }}>
                  {confirmModal.message}
                </div>
              </div>
              
              <ModalActions>
                <Button
                  $variant="secondary"
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  $variant={confirmModal.confirmVariant}
                  onClick={confirmModal.onConfirm}
                  style={{ 
                    flex: 1, 
                    background: confirmModal.confirmVariant === 'danger' 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                    color: 'white', 
                    border: 'none' 
                  }}
                >
                  {confirmModal.confirmText}
                </Button>
              </ModalActions>
            </ModalBody>
          </Modal>
        </ModalOverlay>
      )}
    </PageContainer>
  );
};

export default CandidateInterviews;
