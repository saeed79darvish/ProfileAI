import React, { useState, useEffect } from 'react';
import {
  PageContainer,
  Container,
  HeroSection,
  HeroContent,
  CalendarNav,
  TodayButton,
  CalendarGrid,
  WeekDays,
  WeekDay,
  DaysGrid,
  DayCell,
  DayNumber,
  InterviewChip,
  Sidebar,
  SidebarOverlay,
  SidebarHeader,
  SidebarContent,
  InterviewDetail,
  DetailRow,
  CandidateCard,
  StatusBadge,
  AIScreeningBadge,
  MeetingLink,
  UpcomingSection,
  UpcomingCard,
  DateBlock,
  UpcomingInfo,
  EmptyState
} from './styled';
import { WEEK_DAYS, TEXT, UPCOMING_INTERVIEWS_LIMIT, DEFAULT_PHONE_SCREENING_DURATION } from './constants';
import { useNavigate } from 'react-router-dom';

const RecruiterCalendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [interviews, setInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchInterviews();
  }, [currentDate]);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/interviews/calendar', {
        params: {
          month: currentDate.getMonth(),
          year: currentDate.getFullYear()
        }
      });
      setInterviews(response.data);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add days from previous month
    const startPadding = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isOtherMonth: true
      });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isOtherMonth: false
      });
    }

    // Add days from next month
    const endPadding = 7 - (days.length % 7);
    if (endPadding < 7) {
      for (let i = 1; i <= endPadding; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isOtherMonth: true
        });
      }
    }

    return days;
  };

  const getInterviewsForDay = (date) => {
    return interviews.filter(interview => {
      if (!interview.scheduledAt) return false;
      const interviewDate = new Date(interview.scheduledAt);
      return (
        interviewDate.getDate() === date.getDate() &&
        interviewDate.getMonth() === date.getMonth() &&
        interviewDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const openInterviewDetail = (interview) => {
    setSelectedInterview(interview);
    setSidebarOpen(true);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getUpcomingInterviews = () => {
    const now = new Date();
    return interviews
      .filter(i => new Date(i.scheduledAt) >= now && i.status === 'confirmed')
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, UPCOMING_INTERVIEWS_LIMIT);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <CheckCircle />;
      case 'pending': return <Schedule />;
      case 'cancelled': return <Cancel />;
      default: return null;
    }
  };

  return (
    <PageContainer>
      <HeroSection>
        <HeroContent>
          <h1>{TEXT.PAGE_TITLE}</h1>
          <CalendarNav>
            <TodayButton onClick={goToToday}>{TEXT.TODAY}</TodayButton>
            <button type="button" onClick={prevMonth}><ChevronLeft /></button>
            <span className="month-year">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={nextMonth}><ChevronRight /></button>
          </CalendarNav>
        </HeroContent>
      </HeroSection>
      <Container>

        <CalendarGrid>
          <WeekDays>
            {WEEK_DAYS.map(day => (
              <WeekDay key={day}>{day}</WeekDay>
            ))}
          </WeekDays>
          <DaysGrid>
            {getDaysInMonth().map((day, index) => {
              const dayInterviews = getInterviewsForDay(day.date);
              return (
                <DayCell 
                  key={index}
                  $isToday={isToday(day.date)}
                  $isOtherMonth={day.isOtherMonth}
                >
                  <DayNumber 
                    $isToday={isToday(day.date)}
                    $isOtherMonth={day.isOtherMonth}
                  >
                    {day.date.getDate()}
                  </DayNumber>
                  {dayInterviews.map(interview => (
                    <InterviewChip
                      key={interview.id}
                      $status={interview.status}
                      onClick={() => openInterviewDetail(interview)}
                    >
                      <span className="time">{formatTime(interview.scheduledAt)}</span>
                      <span className="name">{interview.candidate?.firstName} {interview.candidate?.lastName}</span>
                    </InterviewChip>
                  ))}
                </DayCell>
              );
            })}
          </DaysGrid>
        </CalendarGrid>

        <UpcomingSection>
          <h2 style={{ color: '#1e293b', marginBottom: 16 }}>{TEXT.UPCOMING_TITLE}</h2>
          {getUpcomingInterviews().length > 0 ? (
            getUpcomingInterviews().map(interview => (
              <UpcomingCard 
                key={interview.id}
                onClick={() => openInterviewDetail(interview)}
              >
                <DateBlock>
                  <div className="month">
                    {new Date(interview.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                  <div className="day">
                    {new Date(interview.scheduledAt).getDate()}
                  </div>
                  <div className="weekday">
                    {new Date(interview.scheduledAt).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </DateBlock>
                <UpcomingInfo>
                  <div className="time">
                    {formatTime(interview.scheduledAt)} ({interview.duration} min)
                  </div>
                  <div className="candidate">{interview.candidate?.firstName} {interview.candidate?.lastName}</div>
                  <div className="job">{interview.job?.title} at {interview.job?.company}</div>
                </UpcomingInfo>
                <StatusBadge $status={interview.status}>
                  {getStatusIcon(interview.status)}
                  {interview.status}
                </StatusBadge>
              </UpcomingCard>
            ))
          ) : (
            <EmptyState>
              <Schedule />
              <h3>{TEXT.EMPTY_TITLE}</h3>
              <p>{TEXT.EMPTY_SUBTITLE}</p>
            </EmptyState>
          )}
        </UpcomingSection>
      </Container>

      <SidebarOverlay $open={sidebarOpen} onClick={() => setSidebarOpen(false)} />
      <Sidebar $open={sidebarOpen}>
        {selectedInterview && (
          <>
            <SidebarHeader>
              <h2>{TEXT.SIDEBAR_TITLE}</h2>
              <button type="button" onClick={() => setSidebarOpen(false)}>×</button>
            </SidebarHeader>
            <SidebarContent>
              <CandidateCard>
                {selectedInterview.candidate?.profile?.profilePicture ? (
                  <img 
                    src={resolveImageUrl(selectedInterview.candidate.profile.profilePicture)} 
                    alt={`${selectedInterview.candidate.firstName} ${selectedInterview.candidate.lastName}`}
                  />
                ) : (
                  <div className="placeholder"><Person /></div>
                )}
                <div className="info">
                  <div className="name">{selectedInterview.candidate?.firstName} {selectedInterview.candidate?.lastName}</div>
                  <div className="headline">
                    {selectedInterview.candidate?.profile?.headline || selectedInterview.candidate?.email}
                  </div>
                </div>
              </CandidateCard>

              <StatusBadge $status={selectedInterview.status} style={{ marginBottom: 20 }}>
                {getStatusIcon(selectedInterview.status)}
                {selectedInterview.status.charAt(0).toUpperCase() + selectedInterview.status.slice(1)}
              </StatusBadge>
              
              {selectedInterview.phoneScreeningEnabled && (
                <AIScreeningBadge style={{ marginBottom: 20, marginLeft: 8 }}>
                  <SmartToy />
                  AI Phone Screening ({selectedInterview.phoneScreeningDuration || DEFAULT_PHONE_SCREENING_DURATION} min)
                </AIScreeningBadge>
              )}

              <InterviewDetail>
                <DetailRow>
                  <Work />
                  <div>
                    <div className="label">{TEXT.POSITION_LABEL}</div>
                    <div className="value">{selectedInterview.job?.title}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>{selectedInterview.job?.company}</div>
                  </div>
                </DetailRow>

                <DetailRow>
                  <AccessTime />
                  <div>
                    <div className="label">{TEXT.DATE_TIME_LABEL}</div>
                    <div className="value">{formatDate(selectedInterview.scheduledAt)}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {formatTime(selectedInterview.scheduledAt)} ({selectedInterview.duration} minutes)
                    </div>
                  </div>
                </DetailRow>

                <DetailRow>
                  {selectedInterview.format === 'video' && <VideoCall />}
                  {selectedInterview.format === 'phone' && <Phone />}
                  {selectedInterview.format === 'in_person' && <LocationOn />}
                  <div>
                    <div className="label">{TEXT.FORMAT_LABEL}</div>
                    <div className="value" style={{ textTransform: 'capitalize' }}>
                      {selectedInterview.format?.replace('_', ' ') || TEXT.DEFAULT_FORMAT}
                    </div>
                  </div>
                </DetailRow>

                {selectedInterview.type && (
                  <DetailRow>
                    <Schedule />
                    <div>
                      <div className="label">{TEXT.TYPE_LABEL}</div>
                      <div className="value" style={{ textTransform: 'capitalize' }}>
                        {selectedInterview.type} Interview
                      </div>
                    </div>
                  </DetailRow>
                )}
              </InterviewDetail>

              {selectedInterview.meetingLink && selectedInterview.status === 'confirmed' && (
                <MeetingLink 
                  href={selectedInterview.meetingLink} 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <VideoCall />
                  {TEXT.JOIN_MEETING}
                </MeetingLink>
              )}

              {selectedInterview.recruiterNotes && (
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ color: '#1e293b', marginBottom: 8 }}>{TEXT.NOTES_TITLE}</h4>
                  <p style={{ color: '#64748b', fontSize: 14 }}>{selectedInterview.recruiterNotes}</p>
                </div>
              )}
              
              {selectedInterview.phoneScreeningEnabled && selectedInterview.phoneScreeningCallId && (
                <div style={{ marginTop: 20 }}>
                  <PhoneScreeningResults 
                    interviewId={selectedInterview.id}
                    phoneScreeningId={selectedInterview.phoneScreeningCallId}
                  />
                </div>
              )}
            </SidebarContent>
          </>
        )}
      </Sidebar>
    </PageContainer>
  );
};

export default RecruiterCalendar;
