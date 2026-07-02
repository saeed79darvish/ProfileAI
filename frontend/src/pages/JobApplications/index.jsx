import React, { useState, useEffect } from 'react';
import {
  PageContainer,
  HeroSection,
  HeroContent,
  Content,
  Header,
  BackButton,
  Title,
  Subtitle,
  FilterBar,
  SearchInput,
  FilterSelect,
  ApplicationsList,
  ApplicationCard,
  CardHeader,
  CandidateInfo,
  Avatar,
  DefaultAvatar,
  CandidateDetails,
  ContactInfo,
  StatusBadge,
  CardBody,
  Section,
  CoverLetter,
  AnswersList,
  AnswerItem,
  ScoreDisplay,
  ScoreBadge,
  CardFooter,
  AppliedDate,
  Actions,
  ActionButton,
  EmptyState,
  LoadingState,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  CloseButton,
  ModalBody
} from './styled';
import { ROUTES, CUSTOM_LABELS, STATUS_OPTIONS, THRESHOLDS, TEXT } from './constants';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams} from 'react-router-dom';

// Flatten the answers - expand nested objects like customAnswers
    const flattened = {};

const JobApplications = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState(null);

  useEffect(() => {
    fetchJobAndApplications();
  }, [jobId]);

  const fetchJobAndApplications = async () => {
    try {
      setLoading(true);
      const [jobRes, appsRes] = await Promise.all([
        jobAPI.getById(jobId),
        jobAPI.getJobApplications(jobId)
      ]);
      setJob(jobRes.data);
      setApplications(appsRes.data.applications || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (applicationId, newStatus) => {
    try {
      // Call the API to persist the status change
      await jobAPI.updateApplicationStatus(applicationId, newStatus);
      
      // Update UI on success
      setApplications(prev => 
        prev.map(app => 
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
      
      // Update selected application if it's open in the modal
      if (selectedApplication?.id === applicationId) {
        setSelectedApplication(prev => ({ ...prev, status: newStatus }));
      }
      
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = !searchQuery || 
      `${app.candidate?.firstName} ${app.candidate?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.candidate?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Helper to safely parse answers which may be a JSON string or already an object
  // Also flattens nested objects like "customAnswers" into the main object
  const parseAnswers = (answers) => {
    if (!answers) return null;
    
    let parsed = answers;
    if (typeof answers === 'string') {
      try {
        parsed = JSON.parse(answers);
      } catch {
        return null;
      }
    }
    
    if (typeof parsed !== 'object' || parsed === null) return null;
    for (const [key, value] of Object.entries(parsed)) {
      // Skip empty values
      if (value === '' || value === null || value === undefined) continue;
      
      // If it's a nested object (like customAnswers), flatten it
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Check if it looks like a nested answers object
        const isNestedAnswers = Object.values(value).some(v => 
          typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number'
        );
        if (isNestedAnswers) {
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (nestedValue !== '' && nestedValue !== null && nestedValue !== undefined) {
              flattened[nestedKey] = nestedValue;
            }
          }
        } else {
          flattened[key] = value;
        }
      } else {
        flattened[key] = value;
      }
    }
    
    return Object.keys(flattened).length > 0 ? flattened : null;
  };

  // Helper to safely parse AI analysis
  const parseAiAnalysis = (analysis) => {
    if (!analysis) return null;
    if (typeof analysis === 'string') {
      try {
        return JSON.parse(analysis);
      } catch {
        return null;
      }
    }
    return analysis;
  };

  // Helper to format question labels (converts camelCase/snake_case to readable text)
  const formatQuestionLabel = (key) => {
    if (!key) return '';
    
    if (CUSTOM_LABELS[key]) return CUSTOM_LABELS[key];
    
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Helper to safely render any answer value (handles objects, arrays, primitives)
  const renderAnswerValue = (answer) => {
    if (answer === null || answer === undefined) return 'Not provided';
    if (answer === true) return 'Yes';
    if (answer === false) return 'No';
    if (Array.isArray(answer)) return answer.join(', ') || 'None';
    if (typeof answer === 'object') {
      // Handle objects with value property
      if (answer.value !== undefined) return String(answer.value);
      // Try to stringify other objects
      try {
        return JSON.stringify(answer);
      } catch {
        return 'Complex value';
      }
    }
    return String(answer);
  };

  if (loading) {
    return (
      <PageContainer>
        <Content>
          <LoadingState>Loading applications...</LoadingState>
        </Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeroSection>
        <HeroContent>
          <BackButton onClick={() => navigate('/recruiter/jobs')}>
            <BackIcon /> Back to Jobs
          </BackButton>
          <Title>Applications for {job?.title}</Title>
          <Subtitle>
            {applications.length} application{applications.length !== 1 ? 's' : ''} received
            {job?.company && ` • ${job.company}`}
          </Subtitle>
        </HeroContent>
      </HeroSection>
      <Content style={{ paddingTop: '24px' }}>

        <FilterBar>
          <SearchInput>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchInput>
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </FilterSelect>
        </FilterBar>

        {filteredApplications.length === 0 ? (
          <EmptyState>
            <PersonIcon />
            <h3>No Applications Yet</h3>
            <p>
              {applications.length === 0 
                ? "No candidates have applied for this position yet. Share your job listing to attract more applicants."
                : "No applications match your current filters."}
            </p>
          </EmptyState>
        ) : (
          <ApplicationsList>
            {filteredApplications.map(app => (
              <ApplicationCard key={app.id}>
                <CardHeader>
                  <CandidateInfo>
                    {app.candidate?.profile?.profilePicture ? (
                      <Avatar src={resolveImageUrl(app.candidate.profile.profilePicture)} alt="" />
                    ) : (
                      <DefaultAvatar>
                        {getInitials(app.candidate?.firstName, app.candidate?.lastName)}
                      </DefaultAvatar>
                    )}
                    <CandidateDetails>
                      <h3>{app.candidate?.firstName} {app.candidate?.lastName}</h3>
                      <p>{app.candidate?.profile?.headline || 'No headline'}</p>
                      <ContactInfo>
                        <span><EmailIcon /> {app.candidate?.email}</span>
                        {app.candidate?.profile?.phone && (
                          <span><PhoneIcon /> {app.candidate.profile.phone}</span>
                        )}
                      </ContactInfo>
                    </CandidateDetails>
                  </CandidateInfo>
                  <StatusBadge $status={app.status}>
                    {app.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </StatusBadge>
                </CardHeader>

                <CardBody>
                  {app.coverLetter && (
                    <Section>
                      <h4>Cover Letter</h4>
                      <CoverLetter>
                        {app.coverLetter.length > 300 
                          ? `${app.coverLetter.substring(0, 300)}...` 
                          : app.coverLetter}
                      </CoverLetter>
                    </Section>
                  )}

                  {(() => {
                    const parsedCardAnswers = parseAnswers(app.answers);
                    return parsedCardAnswers && Object.keys(parsedCardAnswers).length > 0 && (
                      <Section>
                        <h4>Application Answers</h4>
                        <AnswersList>
                          {Object.entries(parsedCardAnswers).slice(0, 3).map(([question, answer], idx) => (
                            <AnswerItem key={idx}>
                              <div className="question">{formatQuestionLabel(question)}</div>
                              <div className="answer">
                                {renderAnswerValue(answer)}
                              </div>
                            </AnswerItem>
                          ))}
                          {Object.keys(parsedCardAnswers).length > 3 && (
                            <button type="button" 
                              onClick={(e) => { e.stopPropagation(); setSelectedApplication(app); }}
                              style={{ 
                                fontSize: '13px', 
                                color: '#7c3aed', 
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px 0 0',
                                fontWeight: '500'
                              }}
                            >
                              View all {Object.keys(parsedCardAnswers).length} answers →
                            </button>
                          )}
                        </AnswersList>
                      </Section>
                    );
                  })()}

                  {app.aiMatchScore && (
                    <Section>
                      <h4>AI Match Score</h4>
                      <ScoreDisplay $score={app.aiMatchScore}>
                        <div className="score-value">{app.aiMatchScore}%</div>
                        <div className="score-label">
                          {app.aiMatchScore >= 80 ? 'Excellent Match' :
                           app.aiMatchScore >= 60 ? 'Good Match' : 'Fair Match'}
                        </div>
                      </ScoreDisplay>
                    </Section>
                  )}
                </CardBody>

                <CardFooter>
                  <AppliedDate>
                    <DateIcon /> Applied {formatDate(app.createdAt)}
                  </AppliedDate>
                  <Actions>
                    {app.resumeUrl && (
                      <ActionButton 
                        as="a" 
                        href={app.resumeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <DownloadIcon /> Resume
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => setSelectedApplication(app)}>
                      <ViewIcon /> View Details
                    </ActionButton>
                    <ActionButton onClick={() => navigate(`/profile/${app.candidateId}`)}>
                      <PersonIcon /> View Profile
                    </ActionButton>
                    {app.status === 'submitted' && (
                      <>
                        <ActionButton $success onClick={() => handleStatusChange(app.id, 'shortlisted')}>
                          <ShortlistIcon /> Shortlist
                        </ActionButton>
                        <ActionButton $danger onClick={() => handleStatusChange(app.id, 'rejected')}>
                          <RejectIcon /> Reject
                        </ActionButton>
                      </>
                    )}
                    {app.status === 'shortlisted' && (
                      <ActionButton 
                        $primary 
                        onClick={() => navigate(`/recruiter/interviews/schedule?candidateId=${app.candidateId}&jobId=${jobId}`)}
                      >
                        <InterviewIcon /> Schedule Interview
                      </ActionButton>
                    )}
                  </Actions>
                </CardFooter>
              </ApplicationCard>
            ))}
          </ApplicationsList>
        )}
      </Content>

        {/* Application Detail Modal */}
        {selectedApplication && (
          <ModalOverlay onClick={() => setSelectedApplication(null)}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
              <ModalHeader>
                <h2>Application Details</h2>
                <CloseButton onClick={() => setSelectedApplication(null)}>
                  <CloseIcon />
                </CloseButton>
              </ModalHeader>
              <ModalBody>
                {/* Application Meta Info */}
                <Section>
                  <h4>Application Info</h4>
                  <AnswersList>
                    <AnswerItem>
                      <div className="question">Status</div>
                      <div className="answer">
                        <StatusBadge $status={selectedApplication.status}>
                          {selectedApplication.status?.replace(/_/g, ' ')}
                        </StatusBadge>
                      </div>
                    </AnswerItem>
                    <AnswerItem>
                      <div className="question">Applied On</div>
                      <div className="answer">{formatDate(selectedApplication.createdAt)}</div>
                    </AnswerItem>
                    {selectedApplication.aiMatchScore !== null && selectedApplication.aiMatchScore !== undefined && (
                      <AnswerItem>
                        <div className="question">AI Match Score</div>
                        <div className="answer">
                          <ScoreBadge $score={selectedApplication.aiMatchScore}>
                            {selectedApplication.aiMatchScore}%
                          </ScoreBadge>
                        </div>
                      </AnswerItem>
                    )}
                    {selectedApplication.source && (
                      <AnswerItem>
                        <div className="question">Source</div>
                        <div className="answer">{selectedApplication.source}</div>
                      </AnswerItem>
                    )}
                  </AnswersList>
                </Section>

                {/* Candidate Info */}
                <Section>
                  <h4>Candidate</h4>
                  <CandidateInfo style={{ marginBottom: '20px' }}>
                    {selectedApplication.candidate?.profile?.profilePicture ? (
                      <Avatar src={resolveImageUrl(selectedApplication.candidate.profile.profilePicture)} alt="" />
                    ) : (
                      <DefaultAvatar>
                        {getInitials(selectedApplication.candidate?.firstName, selectedApplication.candidate?.lastName)}
                      </DefaultAvatar>
                    )}
                    <CandidateDetails>
                      <h3>{selectedApplication.candidate?.firstName} {selectedApplication.candidate?.lastName}</h3>
                      <p>{selectedApplication.candidate?.profile?.headline || 'No headline'}</p>
                      <ContactInfo>
                        <span><EmailIcon /> {selectedApplication.candidate?.email}</span>
                      </ContactInfo>
                    </CandidateDetails>
                  </CandidateInfo>
                  
                  {/* Additional Profile Info */}
                  <AnswersList>
                    {selectedApplication.candidate?.profile?.location && (
                      <AnswerItem>
                        <div className="question">Location</div>
                        <div className="answer">{selectedApplication.candidate.profile.location}</div>
                      </AnswerItem>
                    )}
                    {selectedApplication.candidate?.profile?.skills && (
                      <AnswerItem>
                        <div className="question">Skills</div>
                        <div className="answer">
                          {Array.isArray(selectedApplication.candidate.profile.skills) 
                            ? selectedApplication.candidate.profile.skills.slice(0, 10).join(', ')
                            : typeof selectedApplication.candidate.profile.skills === 'string' 
                              ? selectedApplication.candidate.profile.skills 
                              : 'N/A'}
                        </div>
                      </AnswerItem>
                    )}
                  </AnswersList>
                </Section>

                {/* Resume Section */}
                {selectedApplication.resumeUrl && (
                  <Section>
                    <h4>Resume</h4>
                    <AnswerItem>
                      <ActionButton 
                        as="a" 
                        href={selectedApplication.resumeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ marginTop: '8px' }}
                      >
                        <DownloadIcon /> View/Download Resume
                      </ActionButton>
                    </AnswerItem>
                  </Section>
                )}

                {selectedApplication.coverLetter && (
                  <Section>
                    <h4>Cover Letter</h4>
                    <CoverLetter style={{ maxHeight: 'none' }}>
                      {selectedApplication.coverLetter}
                    </CoverLetter>
                  </Section>
                )}

                {(() => {
                  const parsedAnswers = parseAnswers(selectedApplication.answers);
                  return parsedAnswers && Object.keys(parsedAnswers).length > 0 && (
                    <Section>
                      <h4>Application Answers</h4>
                      <AnswersList>
                        {Object.entries(parsedAnswers).map(([question, answer], idx) => (
                          <AnswerItem key={idx}>
                            <div className="question">{formatQuestionLabel(question)}</div>
                            <div className="answer">
                              {renderAnswerValue(answer)}
                            </div>
                          </AnswerItem>
                        ))}
                      </AnswersList>
                    </Section>
                  );
                })()}

                {(() => {
                  const aiAnalysis = parseAiAnalysis(selectedApplication.aiAnalysis);
                  return aiAnalysis && (
                    <Section>
                      <h4>AI Analysis</h4>
                      <AnswersList>
                        {aiAnalysis.strengths && Array.isArray(aiAnalysis.strengths) && aiAnalysis.strengths.length > 0 && (
                          <AnswerItem>
                            <div className="question">Strengths</div>
                            <div className="answer">
                              {aiAnalysis.strengths.join(', ')}
                            </div>
                          </AnswerItem>
                        )}
                        {aiAnalysis.gaps && Array.isArray(aiAnalysis.gaps) && aiAnalysis.gaps.length > 0 && (
                          <AnswerItem>
                            <div className="question">Areas of Concern</div>
                            <div className="answer">
                              {aiAnalysis.gaps.join(', ')}
                            </div>
                          </AnswerItem>
                        )}
                        {aiAnalysis.recommendation && (
                          <AnswerItem>
                            <div className="question">Recommendation</div>
                            <div className="answer">
                              {aiAnalysis.recommendation}
                            </div>
                          </AnswerItem>
                        )}
                      </AnswersList>
                    </Section>
                  );
                })()}

                {/* Recruiter Notes */}
                {selectedApplication.recruiterNotes && (
                  <Section>
                    <h4>Recruiter Notes</h4>
                    <CoverLetter style={{ maxHeight: 'none' }}>
                      {selectedApplication.recruiterNotes}
                    </CoverLetter>
                  </Section>
                )}

                <Actions style={{ marginTop: '24px', justifyContent: 'flex-end' }}>
                  <ActionButton onClick={() => navigate(`/profile/${selectedApplication.candidateId}`)}>
                    <PersonIcon /> View Full Profile
                  </ActionButton>
                  <ActionButton onClick={() => navigate(`/messages?userId=${selectedApplication.candidateId}`)}>
                    <MessageIcon /> Message Candidate
                  </ActionButton>
                  <ActionButton 
                    $primary 
                    onClick={() => navigate(`/recruiter/interviews/schedule?candidateId=${selectedApplication.candidateId}&jobId=${jobId}`)}
                  >
                    <InterviewIcon /> Schedule Interview
                  </ActionButton>
                </Actions>
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
    </PageContainer>
  );
};

export default JobApplications;
