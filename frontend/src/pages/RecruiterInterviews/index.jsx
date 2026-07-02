import React, { useState, useEffect } from 'react';
import {
  PageContainer,
  Container,
  HeroSection,
  HeroContent,
  StatsRow,
  StatCard,
  FiltersRow,
  FilterSelect,
  SearchInput,
  InterviewsList,
  InterviewCard,
  CardHeader,
  CandidateInfo,
  Avatar,
  AvatarPlaceholder,
  CandidateDetails,
  ScoreSection,
  ScoreCircle,
  RecommendationBadge,
  StatusBadge,
  CardBody,
  InsightsGrid,
  InsightSection,
  InsightList,
  TranscriptSection,
  TranscriptHeader,
  TranscriptContent,
  TranscriptLine,
  SummaryBox,
  ActionButtons,
  ActionButton,
  ExpandButton,
  NoInterviews,
  LoadingContainer,
  TabsContainer,
  Tab
} from './styled';
import { ROUTES, TEXT, RECOMMENDATION_MAP, STATUS_MAP, THRESHOLDS } from './constants';
import { useNavigate } from 'react-router-dom';

const RecruiterInterviews = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('completed');
  const [expandedCards, setExpandedCards] = useState({});
  const [transcriptExpanded, setTranscriptExpanded] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/interviews');
      
      // Fetch phone screening data for each interview
      const interviewsWithScreening = await Promise.all(
        response.data.map(async (interview) => {
          if (interview.phoneScreeningEnabled && interview.phoneScreeningCallId) {
            try {
              const screeningResponse = await phoneScreeningAPI.getForInterview(interview.id);
              return { ...interview, phoneScreening: screeningResponse.data };
            } catch (err) {
              console.error(`Error fetching screening for interview ${interview.id}:`, err);
              return interview;
            }
          }
          return interview;
        })
      );
      
      setInterviews(interviewsWithScreening);
    } catch (err) {
      console.error('Error fetching interviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationText = (recommendation) => {
    switch (recommendation) {
      case 'strongly_recommend': return 'Strongly Recommend';
      case 'recommend': return 'Recommend';
      case 'consider': return 'Consider';
      case 'not_recommend': return 'Not Recommended';
      default: return 'Pending';
    }
  };

  const getRecommendationIcon = (recommendation) => {
    switch (recommendation) {
      case 'strongly_recommend':
      case 'recommend':
        return <ThumbUp style={{ fontSize: 16 }} />;
      case 'consider':
        return <HelpOutline style={{ fontSize: 16 }} />;
      case 'not_recommend':
        return <ThumbDown style={{ fontSize: 16 }} />;
      default:
        return <Schedule style={{ fontSize: 16 }} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'scheduled': return 'Scheduled';
      case 'failed': return 'Failed';
      case 'no_answer': return 'No Answer';
      default: return status;
    }
  };

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTranscript = (id) => {
    setTranscriptExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredInterviews = interviews.filter(interview => {
    const screening = interview.phoneScreening;
    const screeningStatus = screening?.status;
    
    // Tab filter
    if (activeTab === 'completed' && screeningStatus !== 'completed') return false;
    if (activeTab === 'pending' && screeningStatus === 'completed') return false;
    if (activeTab === 'all') { /* show all */ }
    
    // Status filter
    if (statusFilter !== 'all' && screeningStatus !== statusFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const candidateName = `${interview.candidate?.firstName || ''} ${interview.candidate?.lastName || ''}`.toLowerCase();
      const jobTitle = interview.job?.title?.toLowerCase() || '';
      if (!candidateName.includes(query) && !jobTitle.includes(query)) return false;
    }
    
    return true;
  });

  // Stats
  const completedCount = interviews.filter(i => i.phoneScreening?.status === 'completed').length;
  const pendingCount = interviews.filter(i => i.phoneScreening && i.phoneScreening.status !== 'completed').length;
  const avgScore = interviews
    .filter(i => i.phoneScreening?.screeningScore)
    .reduce((sum, i, _, arr) => sum + (i.phoneScreening.screeningScore / arr.length), 0);
  const recommendedCount = interviews.filter(i => 
    ['strongly_recommend', 'recommend'].includes(i.phoneScreening?.recommendation)
  ).length;

  if (loading) {
    return (
      <PageContainer>
        <Container>
          <LoadingContainer>
            <CircularProgress />
            <p>Loading interview results...</p>
          </LoadingContainer>
        </Container>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeroSection>
        <HeroContent>
          <h1>
            <Assessment />
            AI Interview Results
          </h1>
        </HeroContent>
      </HeroSection>
      <Container>

        <StatsRow>
          <StatCard $color="#22c55e">
            <div className="label">Completed Screenings</div>
            <div className="value">{completedCount}</div>
          </StatCard>
          <StatCard $color="#7c3aed">
            <div className="label">Pending</div>
            <div className="value">{pendingCount}</div>
          </StatCard>
          <StatCard $color="#6d28d9">
            <div className="label">Avg. Score</div>
            <div className="value">{avgScore ? avgScore.toFixed(0) : '-'}</div>
          </StatCard>
          <StatCard $color="#22c55e">
            <div className="label">Recommended</div>
            <div className="value">{recommendedCount}</div>
          </StatCard>
        </StatsRow>

        <TabsContainer>
          <Tab $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
            Completed ({completedCount})
          </Tab>
          <Tab $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
            Pending ({pendingCount})
          </Tab>
          <Tab $active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
            All ({interviews.length})
          </Tab>
        </TabsContainer>

        <FiltersRow>
          <SearchInput>
            <Search />
            <input
              type="text"
              placeholder="Search by candidate or job..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchInput>
          <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="failed">Failed</option>
            <option value="no_answer">No Answer</option>
          </FilterSelect>
        </FiltersRow>

        {filteredInterviews.length === 0 ? (
          <NoInterviews>
            <Assessment />
            <h3>No Interview Results</h3>
            <p>
              {activeTab === 'completed' 
                ? "No completed AI screenings yet. Results will appear here once candidates complete their phone screenings."
                : activeTab === 'pending'
                ? "No pending screenings at the moment."
                : "No interviews found matching your criteria."}
            </p>
          </NoInterviews>
        ) : (
          <InterviewsList>
            {filteredInterviews.map(interview => {
              const screening = interview.phoneScreening;
              const score = screening?.screeningScore || 0;
              const isExpanded = expandedCards[interview.id];
              const candidate = interview.candidate;
              const profile = candidate?.profile;
              
              return (
                <InterviewCard key={interview.id}>
                  <CardHeader $hasResults={screening?.status === 'completed'} $score={score}>
                    <CandidateInfo>
                      {profile?.profilePicture ? (
                        <Avatar 
                          src={resolveImageUrl(profile.profilePicture)} 
                          alt={`${candidate?.firstName} ${candidate?.lastName}`}
                          $score={score}
                        />
                      ) : (
                        <AvatarPlaceholder>
                          {candidate?.firstName?.[0]}{candidate?.lastName?.[0]}
                        </AvatarPlaceholder>
                      )}
                      <CandidateDetails>
                        <div className="name">
                          {candidate?.firstName} {candidate?.lastName}
                        </div>
                        <div className="headline">
                          {profile?.headline || candidate?.email}
                        </div>
                        <div className="job">
                          <Work style={{ fontSize: 14 }} />
                          {interview.job?.title} at {interview.job?.company}
                        </div>
                      </CandidateDetails>
                    </CandidateInfo>
                    
                    <ScoreSection>
                      {screening?.status === 'completed' ? (
                        <>
                          <ScoreCircle $score={score}>
                            <div className="score">{score}</div>
                            <div className="label">Score</div>
                          </ScoreCircle>
                          <RecommendationBadge $recommendation={screening?.recommendation}>
                            {getRecommendationIcon(screening?.recommendation)}
                            {getRecommendationText(screening?.recommendation)}
                          </RecommendationBadge>
                        </>
                      ) : (
                        <StatusBadge $status={screening?.status}>
                          {screening?.status === 'scheduled' && <Schedule style={{ fontSize: 14 }} />}
                          {screening?.status === 'in_progress' && <Phone style={{ fontSize: 14 }} />}
                          {getStatusText(screening?.status)}
                        </StatusBadge>
                      )}
                    </ScoreSection>
                  </CardHeader>

                  {screening?.status === 'completed' && (
                    <CardBody>
                      {screening?.summary && (
                        <SummaryBox>
                          <div className="label">AI Summary</div>
                          <div className="text">{screening.summary}</div>
                        </SummaryBox>
                      )}

                      <InsightsGrid>
                        {screening?.strengths && screening.strengths.length > 0 && (
                          <InsightSection $color="#22c55e">
                            <h4>
                              <TrendingUp />
                              Strengths
                            </h4>
                            <InsightList $color="#22c55e">
                              {screening.strengths.slice(0, isExpanded ? undefined : 3).map((strength, idx) => (
                                <li key={idx}>
                                  <CheckCircle />
                                  {strength}
                                </li>
                              ))}
                            </InsightList>
                          </InsightSection>
                        )}

                        {screening?.concerns && screening.concerns.length > 0 && (
                          <InsightSection $color="#ef4444">
                            <h4>
                              <TrendingDown />
                              Areas of Concern
                            </h4>
                            <InsightList $color="#ef4444">
                              {screening.concerns.slice(0, isExpanded ? undefined : 3).map((concern, idx) => (
                                <li key={idx}>
                                  <Cancel />
                                  {concern}
                                </li>
                              ))}
                            </InsightList>
                          </InsightSection>
                        )}
                      </InsightsGrid>

                      {screening?.transcript && (
                        <TranscriptSection>
                          <TranscriptHeader onClick={() => toggleTranscript(interview.id)}>
                            <h4>
                              <Phone />
                              Full Conversation Transcript
                            </h4>
                            {transcriptExpanded[interview.id] ? <ExpandLess /> : <ExpandMore />}
                          </TranscriptHeader>
                          <TranscriptContent $expanded={transcriptExpanded[interview.id]}>
                            {typeof screening.transcript === 'string' ? (
                              // Display string transcript with AI:/User: format
                              screening.transcript.split('\n').filter(line => line.trim()).map((line, idx) => {
                                const isBot = line.startsWith('AI:');
                                const isUser = line.startsWith('User:');
                                if (!isBot && !isUser) return null;
                                
                                const speaker = isBot ? 'AI Recruiter' : 'Candidate';
                                const message = line.replace(/^(AI:|User:)\s*/, '');
                                
                                return (
                                  <TranscriptLine key={idx} $isBot={isBot}>
                                    <div className="speaker">{speaker}</div>
                                    <div className="message">{message}</div>
                                  </TranscriptLine>
                                );
                              })
                            ) : Array.isArray(screening.transcriptMessages) ? (
                              // Display structured transcript messages
                              screening.transcriptMessages
                                .filter(msg => msg.role !== 'system')
                                .map((msg, idx) => {
                                  const isBot = msg.role === 'bot' || msg.role === 'assistant';
                                  return (
                                    <TranscriptLine key={idx} $isBot={isBot}>
                                      <div className="speaker">
                                        {isBot ? 'AI Recruiter' : 'Candidate'}
                                      </div>
                                      <div className="message">{msg.message || msg.content}</div>
                                    </TranscriptLine>
                                  );
                                })
                            ) : (
                              <div style={{ padding: '16px', color: '#64748b' }}>
                                No transcript available
                              </div>
                            )}
                          </TranscriptContent>
                        </TranscriptSection>
                      )}

                      {((screening?.strengths?.length > 3) || (screening?.concerns?.length > 3)) && (
                        <ExpandButton onClick={() => toggleExpand(interview.id)}>
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                          {isExpanded ? 'Show Less' : 'Show More Details'}
                        </ExpandButton>
                      )}

                      <ActionButtons>
                        <ActionButton 
                          $primary 
                          onClick={() => navigate(`/profile/${candidate?.id}`)}
                        >
                          <Person style={{ fontSize: 18 }} />
                          View Full Profile
                        </ActionButton>
                        <ActionButton onClick={() => navigate(`/messages?userId=${candidate?.id}`)}>
                          <Message style={{ fontSize: 18 }} />
                          Send Message
                        </ActionButton>
                        <ActionButton onClick={() => navigate(`/recruiter/calendar`)}>
                          <CalendarToday style={{ fontSize: 18 }} />
                          Schedule Follow-up
                        </ActionButton>
                        {score >= 70 && (
                          <ActionButton $success>
                            <ThumbUp style={{ fontSize: 18 }} />
                            Move to Next Round
                          </ActionButton>
                        )}
                        {score < 50 && (
                          <ActionButton $danger>
                            <ThumbDown style={{ fontSize: 18 }} />
                            Reject
                          </ActionButton>
                        )}
                      </ActionButtons>
                    </CardBody>
                  )}

                  {screening?.status !== 'completed' && (
                    <CardBody>
                      <SummaryBox>
                        <div className="label">Interview Status</div>
                        <div className="text">
                          {screening?.status === 'scheduled' && `AI phone screening scheduled for ${new Date(screening.scheduledAt).toLocaleString()}`}
                          {screening?.status === 'in_progress' && 'AI is currently conducting the phone screening...'}
                          {screening?.status === 'failed' && 'The call could not be completed. Consider rescheduling.'}
                          {screening?.status === 'no_answer' && 'Candidate did not answer. You may want to reschedule.'}
                          {!screening && 'No AI phone screening has been scheduled for this interview.'}
                        </div>
                      </SummaryBox>
                      <ActionButtons>
                        <ActionButton onClick={() => navigate(`/profile/${candidate?.id}`)}>
                          <Person style={{ fontSize: 18 }} />
                          View Profile
                        </ActionButton>
                        <ActionButton onClick={() => navigate(`/messages?userId=${candidate?.id}`)}>
                          <Message style={{ fontSize: 18 }} />
                          Contact Candidate
                        </ActionButton>
                      </ActionButtons>
                    </CardBody>
                  )}
                </InterviewCard>
              );
            })}
          </InterviewsList>
        )}
      </Container>
    </PageContainer>
  );
};

export default RecruiterInterviews;
