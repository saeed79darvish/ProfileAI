import React, { Component, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, IconButton, Tooltip, Breadcrumbs, Typography, Skeleton, Box } from '@mui/material';
import SEO from '../../components/SEO';
import MobileApplyRecommendation from '../../components/MobileApplyRecommendation';
import useIsMobileDevice from '../../hooks/useIsMobileDevice';
import {
  ErrorFallback,
  PageContainer,
  Header,
  HeaderContent,
  BreadcrumbsWrapper,
  BreadcrumbLink,
  BreadcrumbCurrent,
  CompanyInfo,
  CompanyLogo,
  CompanyName,
  JobTitle,
  JobMeta,
  Content,
  MainCard,
  CardHeader,
  Stats,
  Stat,
  Actions,
  ActionButton,
  CardBody,
  Section,
  SectionTitle,
  SectionContent,
  SkillTags,
  SkillTag,
  InfoGrid,
  InfoItem,
  CompanyCard,
  CompanyCardHeader,
  CompanyDetails,
  CompanyLinks,
  CompanyLink,
  StartAIButton,
  FormConfigButton,
  pulse,
  spin,
  ScreeningPanel,
  ScreeningHeader,
  ScreeningTitle,
  ScreeningStatus,
  ScreeningProgress,
  ProgressBar,
  ProgressFill,
  ScreeningStep,
  ScreeningStats,
  ShortlistedSection,
  ShortlistedTitle,
  CandidateCards,
  CandidateCard,
  CandidateAvatar,
  CandidateInfo,
  CandidateScores,
  ScoreBadge,
  CandidateActions,
  CandidateActionBtn,
  RefreshButton,
  ScreeningError,
  EmptyShortlist,
  LoadingContainer,
  ErrorContainer,
  PostedDate,
  ModalHeader,
  ApplicationOptions,
  ApplicationOption,
  CloseButton
} from './styled';
import { ROUTES, WORK_TYPES, EMPLOYMENT_TYPES, LEVELS, TIMINGS, TEXT as CONST_TEXT } from './constants';
import { renderFormattedContent } from './utils';
import JobAIToolsPanel from '../../components/JobAIToolsPanel';
import { useAuth } from '@/contexts/AuthContext';

const JobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  
  // AI Screening state
  const [screeningStatus, setScreeningStatus] = useState(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [showScreeningConfig, setShowScreeningConfig] = useState(false);
  const [startingScreening, setStartingScreening] = useState(false);

  // Memoize fetchJob to prevent recreation on every render
  const fetchJob = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await jobAPI.getById(id);
      setJob(response.data);
    } catch (err) {
      console.error('Error fetching job:', err);
      if (err.response?.status === 404) {
        setError('This job listing does not exist or has been removed.');
      } else {
        setError('Unable to load job details. Please try again later.');
      }
      setJob(null); // Ensure job is null on error
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);
  
  // Fetch screening status when job is loaded and user is owner
  const fetchScreeningStatus = useCallback(async () => {
    // Early return if prerequisites aren't met
    if (!user) return;
    
    try {
      setScreeningLoading(true);
      const response = await jobAPI.getScreeningStatus(id);
      setScreeningStatus(response.data);
    } catch (err) {
      // Silently handle errors for screening status (it's optional)
      if (err.response?.status !== 404) {
        console.error('Error fetching screening status:', err);
      }
      // Set to not_started instead of null to prevent blank page
      setScreeningStatus({ status: 'not_started' });
    } finally {
      setScreeningLoading(false);
    }
  }, [id, user]);
  
  // Fetch screening status when job loads and user is owner
  useEffect(() => {
    if (job && user && job.userId === user.id) {
      fetchScreeningStatus();
    }
  }, [job?.userId, user?.id, fetchScreeningStatus]);
  
  // Auto-poll while screening is in progress
  useEffect(() => {
    if (!screeningStatus) return;
    
    // Only poll for active screening statuses
    const isInProgress = 
      screeningStatus.status === 'pending' || 
      screeningStatus.status === 'searching' ||
      screeningStatus.status === 'screening';
    
    if (isInProgress) {
      const pollInterval = setInterval(() => {
        fetchScreeningStatus();
      }, 5000); // Poll every 5 seconds - balanced for better UX
      
      return () => clearInterval(pollInterval);
    }
  }, [screeningStatus?.status, fetchScreeningStatus]);

  const formatSalary = () => {
    if (!job || !job.salaryMin && !job.salaryMax) return null;
    const currency = job.salaryCurrency || 'USD';
    const period = job.salaryPeriod === 'yearly' ? '/year' : job.salaryPeriod === 'monthly' ? '/month' : '/hour';
    
    if (job.salaryMin && job.salaryMax) {
      return `${currency} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}${period}`;
    }
    if (job.salaryMin) {
      return `${currency} ${job.salaryMin.toLocaleString()}+${period}`;
    }
    return `Up to ${currency} ${job.salaryMax.toLocaleString()}${period}`;
  };

  const formatLocationType = (type) => {
    return WORK_TYPES[type] || type;
  };

  const formatEmploymentType = (type) => {
    return EMPLOYMENT_TYPES[type] || type;
  };

  const formatExperienceLevel = (level) => {
    return LEVELS[level] || level;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: `Check out this job: ${job.title} at ${job.company}`,
          url: window.location.href
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  // Tier gate for the AI-agent apply feature (not a rate-limit 429).
  const [limitInfo, setLimitInfo] = useState(null);
  const [applicationMethod, setApplicationMethod] = useState(null); // 'manual' or 'agent'
  
  // Check for return from subscription page with state to open agent modal
  useEffect(() => {
    const returnState = sessionStorage.getItem('upgradeReturnState');
    if (returnState) {
      try {
        const state = JSON.parse(returnState);
        if (state.openAgentModal && user?.subscriptionTier !== 'free') {
          setShowAgentModal(true);
        }
      } catch (e) {
        console.error('Error parsing return state:', e);
      }
      sessionStorage.removeItem('upgradeReturnState');
      sessionStorage.removeItem('upgradeReturnPath');
    }
  }, [user?.subscriptionTier]);
  
  const handleApply = () => {
    setShowApplicationModal(true);
  };
  
  const handleManualApply = () => {
    // Navigate to traditional application form
    navigate(`/jobs/${id}/apply`);
  };
  
  const handleAgentApply = () => {
    setShowApplicationModal(false);
    
    // Check if user has a paid subscription
    if (!user?.subscriptionTier || user.subscriptionTier === 'free') {
      setLimitInfo({ featureType: 'agent_apply', upgradeRequired: true, usage: {}, buyMoreUrl: '/pricing' });
      return;
    }
    
    setShowAgentModal(true);
  };
  
  const handleAgentSuccess = (negotiation) => {
    // Navigate to the negotiation in Agent Arena
    navigate(`/agent-arena/${negotiation.id}`);
  };

  // AI Screening handlers
  const handleStartScreening = async (config) => {
    setStartingScreening(true);
    try {
      await jobAPI.startScreeningWithConfig(id, config);
      setShowScreeningConfig(false);
      // Refresh screening status
      fetchScreeningStatus();
    } catch (err) {
      console.error('Error starting screening:', err);
      alert(err.response?.data?.message || 'Failed to start AI screening');
    } finally {
      setStartingScreening(false);
    }
  };

  const isOwner = user && job && user.id === job.userId;
  const isMobile = useIsMobileDevice();

  if (loading) {
    return (
      <PageContainer aria-busy="true" aria-label="Loading job details">
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' }}>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Skeleton variant="text" width={40} height={20} animation="pulse" />
            <Skeleton variant="text" width={8} height={20} animation="pulse" />
            <Skeleton variant="text" width={160} height={20} animation="pulse" />
          </div>

          {/* Logo + title block */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
            <Skeleton variant="rounded" width={72} height={72} sx={{ borderRadius: '12px', flexShrink: 0 }} animation="pulse" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="70%" height={36} animation="pulse" />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                <Skeleton variant="text" width={180} height={20} animation="pulse" />
                <Skeleton variant="text" width={80} height={20} animation="pulse" />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                <Skeleton variant="text" width={120} height={16} animation="pulse" />
                <Skeleton variant="rounded" width={90} height={20} sx={{ borderRadius: '6px' }} animation="pulse" />
              </div>
            </div>
          </div>

          {/* Meta chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            <Skeleton variant="rounded" width={96} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
            <Skeleton variant="rounded" width={88} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
            <Skeleton variant="rounded" width={100} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
            <Skeleton variant="rounded" width={96} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
            <Skeleton variant="rounded" width={148} height={44} sx={{ borderRadius: '10px' }} animation="pulse" />
            <Skeleton variant="rounded" width={110} height={44} sx={{ borderRadius: '10px' }} animation="pulse" />
          </div>

          {/* AI Job Tools card */}
          <div style={{ background: '#F9F5FF', border: '1px solid #E9D7FE', borderRadius: 12, padding: 16, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
              <div>
                <Skeleton variant="text" width={120} height={22} animation="pulse" />
                <Skeleton variant="text" width={140} height={16} animation="pulse" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
              <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
              <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
            </div>
          </div>

          {/* About section */}
          <div style={{ background: 'white', border: '1px solid #EEF0F3', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: '8px' }} animation="pulse" />
              <Skeleton variant="text" width={240} height={26} animation="pulse" />
            </div>
            <Skeleton variant="text" width="30%" height={18} animation="pulse" />
            <Skeleton variant="text" width="50%" height={22} animation="pulse" sx={{ marginBottom: '12px' }} />
            <Skeleton variant="text" width="35%" height={18} animation="pulse" />
            <Skeleton variant="text" width="25%" height={18} animation="pulse" sx={{ marginBottom: '12px' }} />
            <Skeleton variant="text" width="20%" height={22} animation="pulse" sx={{ marginTop: '12px' }} />
            <Skeleton variant="text" width="100%" height={18} animation="pulse" />
            <Skeleton variant="text" width="98%" height={18} animation="pulse" />
            <Skeleton variant="text" width="95%" height={18} animation="pulse" />
            <Skeleton variant="text" width="60%" height={18} animation="pulse" sx={{ marginBottom: '12px' }} />
            <Skeleton variant="text" width="30%" height={22} animation="pulse" sx={{ marginTop: '12px' }} />
            <Skeleton variant="text" width="100%" height={18} animation="pulse" />
            <Skeleton variant="text" width="92%" height={18} animation="pulse" />
            <Skeleton variant="text" width="88%" height={18} animation="pulse" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !job) {
    return (
      <PageContainer>
        <Header>
          <HeaderContent>
            <BreadcrumbsWrapper>
              <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                <BreadcrumbLink to="/jobs">
                  <HomeIcon /> Jobs
                </BreadcrumbLink>
                <BreadcrumbCurrent>Not Found</BreadcrumbCurrent>
              </Breadcrumbs>
            </BreadcrumbsWrapper>
          </HeaderContent>
        </Header>
        <Content>
          <MainCard>
            <ErrorContainer>
              <h2>Job Not Found</h2>
              <p>{error || 'This job posting may have been removed or is no longer available.'}</p>
              <ActionButton $primary onClick={() => navigate('/browse')}>
                Browse Other Jobs
              </ActionButton>
            </ErrorContainer>
          </MainCard>
        </Content>
      </PageContainer>
    );
  }

  const recruiterProfile = job.recruiter?.recruiterProfile;

  return (
    <PageContainer>
      <SEO
        title={`${job.title} at ${job.company}`}
        description={`${job.title} — ${job.company}${job.location ? ` (${job.location})` : ''}. ${(job.description || '').replace(/<[^>]+>/g, '').slice(0, 160)}`}
        path={`/jobs/${job.id || job._id || ''}`}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: job.title,
          description: (job.description || '').slice(0, 5000),
          datePosted: job.createdAt || job.postedAt,
          validThrough: job.expiresAt || job.validThrough,
          employmentType: (job.employmentType || 'FULL_TIME').toUpperCase(),
          hiringOrganization: {
            '@type': 'Organization',
            name: job.company,
            sameAs: recruiterProfile?.companyWebsite,
            logo: recruiterProfile?.companyLogo,
          },
          jobLocation: job.location
            ? {
                '@type': 'Place',
                address: { '@type': 'PostalAddress', addressLocality: job.location },
              }
            : undefined,
          jobLocationType: job.locationType === 'remote' ? 'TELECOMMUTE' : undefined,
          applicantLocationRequirements:
            job.locationType === 'remote'
              ? { '@type': 'Country', name: 'Anywhere' }
              : undefined,
          baseSalary:
            job.salaryMin || job.salaryMax
              ? {
                  '@type': 'MonetaryAmount',
                  currency: job.salaryCurrency || 'USD',
                  value: {
                    '@type': 'QuantitativeValue',
                    minValue: job.salaryMin,
                    maxValue: job.salaryMax,
                    unitText:
                      job.salaryPeriod === 'yearly'
                        ? 'YEAR'
                        : job.salaryPeriod === 'monthly'
                          ? 'MONTH'
                          : 'HOUR',
                  },
                }
              : undefined,
          skills: Array.isArray(job.skills) ? job.skills.join(', ') : undefined,
          directApply: true,
        }}
      />
      <Header>
        <HeaderContent>
          <BreadcrumbsWrapper>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
              <BreadcrumbLink to="/jobs">
                <HomeIcon /> Jobs
              </BreadcrumbLink>
              <BreadcrumbCurrent>{job.title}</BreadcrumbCurrent>
            </Breadcrumbs>
          </BreadcrumbsWrapper>
          
          <CompanyInfo>
            <CompanyLogo to={recruiterProfile?.companySlug ? `/company/${recruiterProfile.companySlug}` : '#'}>
              {recruiterProfile?.companyLogo ? (
                <img src={recruiterProfile.companyLogo} alt={job.company} />
              ) : (
                <BusinessIcon />
              )}
            </CompanyLogo>
            <CompanyName to={recruiterProfile?.companySlug ? `/company/${recruiterProfile.companySlug}` : '#'}>{job.company}</CompanyName>
          </CompanyInfo>
          
          <JobTitle>{job.title}</JobTitle>
          
          <JobMeta>
            <span><LocationIcon /> {job.location}</span>
            <span><WorkIcon /> {formatLocationType(job.locationType)}</span>
            <span><ScheduleIcon /> {formatEmploymentType(job.employmentType)}</span>
            {formatSalary() && <span><SalaryIcon /> {formatSalary()}</span>}
          </JobMeta>
        </HeaderContent>
      </Header>
      
      <Content>
        <MainCard>
          <CardHeader>
            <Stats>
              <Stat>
                <ViewsIcon />
                <strong>{job.views || 0}</strong> views
              </Stat>
              <Stat>
                <ApplicantsIcon />
                <strong>{job.applications || 0}</strong> applicants
              </Stat>
            </Stats>
            
            <Actions>
              <ActionButton onClick={handleShare}>
                <ShareIcon /> Share
              </ActionButton>
              <ActionButton onClick={() => setSaved(!saved)}>
                {saved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                {saved ? 'Saved' : 'Save'}
              </ActionButton>
              {isOwner ? (
                <>
                  {/* Start AI Automation Button - Only when screening not started */}
                  {(!screeningStatus || screeningStatus.status === 'not_started') && (
                    <Tooltip 
                      title="Launch AI-powered candidate search and screening. Our AI will automatically find, evaluate, and shortlist the best candidates for this position."
                      arrow
                      placement="bottom"
                    >
                      <StartAIButton 
                        onClick={() => setShowScreeningConfig(true)}
                        disabled={startingScreening}
                      >
                        <AIIcon /> Start AI Automation
                      </StartAIButton>
                    </Tooltip>
                  )}
                  
                  {/* Application Form Config Button */}
                  <Tooltip 
                    title={job.applicationQuestions?.length > 0 
                      ? `${job.applicationQuestions.length} custom questions configured. Click to re-configure the application form.`
                      : "Configure a custom application form to collect specific information from candidates."
                    }
                    arrow
                    placement="bottom"
                  >
                    <FormConfigButton 
                      onClick={() => navigate(`/recruiter/jobs/${id}/application-form`)}
                    >
                      <FormIcon />
                      Application Form
                    </FormConfigButton>
                  </Tooltip>
                  
                  <ActionButton $primary onClick={() => navigate('/recruiter/jobs')}>
                    <EditIcon /> Edit Job
                  </ActionButton>
                </>
              ) : (
                <ActionButton $primary onClick={handleApply}>
                  Apply Now
                </ActionButton>
              )}
            </Actions>
          </CardHeader>

          {!isOwner && isMobile && (
            <Box sx={{ px: 3, pt: 2.5 }}>
              <MobileApplyRecommendation variant="banner" jobUrl={window.location.href} jobTitle={job.title} />
            </Box>
          )}

          {/* AI Screening Panel - Only visible to job owner (recruiter) */}
          {isOwner && screeningStatus && screeningStatus.status !== 'not_started' && (
            <ScreeningPanel>
              <ScreeningHeader>
                <ScreeningTitle>
                  <AIIcon /> AI Candidate Screening
                </ScreeningTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ScreeningStatus $status={screeningStatus.status}>
                    {screeningStatus.status === 'pending' && <><PendingIcon /> Pending</>}
                    {screeningStatus.status === 'searching' && <><AIIcon /> Searching...</>}
                    {screeningStatus.status === 'screening' && <><AIIcon /> Screening...</>}
                    {screeningStatus.status === 'completed' && <><CheckIcon /> Completed</>}
                    {screeningStatus.status === 'failed' && <><ErrorIcon /> Failed</>}
                  </ScreeningStatus>
                  <RefreshButton 
                    onClick={fetchScreeningStatus} 
                    disabled={screeningLoading}
                    $loading={screeningLoading}
                  >
                    <RefreshIcon /> Refresh
                  </RefreshButton>
                </div>
              </ScreeningHeader>
              
              {(screeningStatus.status === 'pending' || screeningStatus.status === 'searching' || screeningStatus.status === 'screening') && (
                <ScreeningProgress>
                  <ScreeningStep>
                    {screeningStatus.currentStep || 'Initializing AI screening...'}
                  </ScreeningStep>
                  <ProgressBar>
                    <ProgressFill 
                      $percent={
                        screeningStatus.candidatesFound > 0 
                          ? (screeningStatus.candidatesScreened / screeningStatus.candidatesFound) * 100 
                          : 0
                      } 
                    />
                  </ProgressBar>
                </ScreeningProgress>
              )}
              
              <ScreeningStats>
                <span><PersonIcon /> <strong>{screeningStatus.candidatesFound || 0}</strong> candidates found</span>
                <span><ScoreIcon /> <strong>{screeningStatus.candidatesScreened || 0}</strong> screened</span>
                <span><CheckIcon /> <strong>{screeningStatus.shortlisted?.length || 0}</strong> shortlisted</span>
              </ScreeningStats>
              
              {screeningStatus.status === 'failed' && screeningStatus.errorMessage && (
                <ScreeningError>
                  <ErrorIcon /> {screeningStatus.errorMessage}
                </ScreeningError>
              )}
              
              {screeningStatus.status === 'completed' && (
                <ShortlistedSection>
                  <ShortlistedTitle>
                    <CheckIcon /> Shortlisted Candidates
                  </ShortlistedTitle>
                  
                  {screeningStatus.shortlisted && screeningStatus.shortlisted.length > 0 ? (
                    <CandidateCards>
                      {screeningStatus.shortlisted.map((candidate, idx) => (
                        <CandidateCard key={candidate.candidateId || idx}>
                          <CandidateAvatar>
                            {candidate.profilePicture ? (
                              <img 
                                src={resolveImageUrl(candidate.profilePicture)} 
                                alt={candidate.name} 
                              />
                            ) : (
                              <PersonIcon />
                            )}
                          </CandidateAvatar>
                          <CandidateInfo>
                            <div className="name">{candidate.name}</div>
                            <div className="headline">{candidate.headline || 'Candidate'}</div>
                          </CandidateInfo>
                          <CandidateScores>
                            <ScoreBadge $type="fit">
                              <div className="value">{candidate.fitScore || 0}</div>
                              <div className="label">Fit Score</div>
                            </ScoreBadge>
                            <ScoreBadge $type="interest">
                              <div className="value">{candidate.interestScore || 0}</div>
                              <div className="label">Interest</div>
                            </ScoreBadge>
                          </CandidateScores>
                          <CandidateActions>
                            <CandidateActionBtn 
                              title="View Profile"
                              onClick={() => navigate(`/profile/${candidate.candidateId}`)}
                            >
                              <ExternalIcon />
                            </CandidateActionBtn>
                            <CandidateActionBtn 
                              title="Send Message"
                              onClick={() => navigate(`/messages?userId=${candidate.candidateId}`)}
                            >
                              <MessageIcon />
                            </CandidateActionBtn>
                            <CandidateActionBtn 
                              title="Schedule Interview"
                              onClick={() => navigate(`/recruiter/schedule-interview?candidateId=${candidate.candidateId}&jobId=${id}`)}
                            >
                              <CalendarIcon />
                            </CandidateActionBtn>
                          </CandidateActions>
                        </CandidateCard>
                      ))}
                    </CandidateCards>
                  ) : (
                    <EmptyShortlist>
                      No candidates were shortlisted. Try adjusting job requirements or skills.
                    </EmptyShortlist>
                  )}
                </ShortlistedSection>
              )}
            </ScreeningPanel>
          )}
          
          <CardBody>
            <InfoGrid>
              <InfoItem>
                <div className="label">Experience Level</div>
                <div className="value">{formatExperienceLevel(job.experienceLevel)}</div>
              </InfoItem>
              {job.department && (
                <InfoItem>
                  <div className="label">Department</div>
                  <div className="value">{job.department}</div>
                </InfoItem>
              )}
              <InfoItem>
                <div className="label">Work Type</div>
                <div className="value">{formatEmploymentType(job.employmentType)}</div>
              </InfoItem>
              <InfoItem>
                <div className="label">Location Type</div>
                <div className="value">{formatLocationType(job.locationType)}</div>
              </InfoItem>
            </InfoGrid>
            
            {job.skills && job.skills.length > 0 && (
              <Section style={{ marginTop: 24 }}>
                <SectionTitle>Required Skills</SectionTitle>
                <SkillTags>
                  {job.skills.map((skill, idx) => (
                    <SkillTag key={idx}>{skill}</SkillTag>
                  ))}
                </SkillTags>
              </Section>
            )}
            
            <Section>
              <SectionTitle>About This Role</SectionTitle>
              <SectionContent>{renderFormattedContent(job.description)}</SectionContent>
            </Section>
            
            {job.requirements && (
              <Section>
                <SectionTitle>Requirements</SectionTitle>
                <SectionContent>{renderFormattedContent(job.requirements)}</SectionContent>
              </Section>
            )}
            
            {job.benefits && (
              <Section>
                <SectionTitle>Benefits & Perks</SectionTitle>
                <SectionContent>{renderFormattedContent(job.benefits)}</SectionContent>
              </Section>
            )}
            
            <PostedDate>
              Posted on {new Date(job.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </PostedDate>
            
            {recruiterProfile && (
              <CompanyCard>
                <CompanyCardHeader>
                  <CompanyLogo to={recruiterProfile.companySlug ? `/company/${recruiterProfile.companySlug}` : '#'}>
                    {recruiterProfile.companyLogo ? (
                      <img src={recruiterProfile.companyLogo} alt={job.company} />
                    ) : (
                      <BusinessIcon />
                    )}
                  </CompanyLogo>
                  <CompanyDetails>
                    <h3>
                      <Link 
                        to={recruiterProfile.companySlug ? `/company/${recruiterProfile.companySlug}` : '#'}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                        onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {recruiterProfile.companyName || job.company}
                      </Link>
                    </h3>
                    {recruiterProfile.industry && (
                      <p>{recruiterProfile.industry} • {recruiterProfile.companySize || 'Company'}</p>
                    )}
                  </CompanyDetails>
                </CompanyCardHeader>
                
                {recruiterProfile.companyDescription && (
                  <SectionContent style={{ fontSize: 14 }}>
                    {recruiterProfile.companyDescription}
                  </SectionContent>
                )}
                
                <CompanyLinks>
                  {recruiterProfile.companyWebsite && (
                    <CompanyLink href={recruiterProfile.companyWebsite} target="_blank" rel="noopener noreferrer">
                      <WebsiteIcon /> Website
                    </CompanyLink>
                  )}
                  {job.recruiter && (
                    <CompanyLink href={`/recruiter/${job.recruiter.id}`}>
                      <ExternalIcon /> View Recruiter
                    </CompanyLink>
                  )}
                </CompanyLinks>
              </CompanyCard>
            )}
          </CardBody>
        </MainCard>
        
        {/* AI Profile Tools - Only for candidates (non-owners) */}
        {!isOwner && job && (
          <JobAIToolsPanel job={job} />
        )}
      </Content>
      
      {/* Application Method Modal */}
      <Dialog 
        open={showApplicationModal} 
        onClose={() => setShowApplicationModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            borderRadius: 20,
            padding: '8px'
          }
        }}
      >
        <CloseButton onClick={() => setShowApplicationModal(false)}>
          <CloseIcon />
        </CloseButton>
        
        <DialogContent style={{ padding: '32px' }}>
          <ModalHeader>
            <h2>Choose Application Method</h2>
            <p>Select how you'd like to apply for {job.title}</p>
          </ModalHeader>
          
          <ApplicationOptions>
            {/* Traditional Manual Application */}
            <ApplicationOption onClick={handleManualApply}>
              <div className="option-header">
                <div className="icon">
                  <SendIcon />
                </div>
                <div className="option-content">
                  <div className="title">Traditional Application</div>
                </div>
              </div>
              <div className="description">
                Submit your application directly through our platform. Fill out the form, attach your resume, and send it to the recruiter.
              </div>
              <div className="features">
                <div className="feature">
                  <CheckIcon /> Quick submission
                </div>
                <div className="feature">
                  <CheckIcon /> Full control
                </div>
                <div className="feature">
                  <CheckIcon /> Direct contact
                </div>
              </div>
            </ApplicationOption>
            
            {/* AI Agent Negotiation */}
            <ApplicationOption onClick={handleAgentApply}>
              <div className="option-header">
                <div className="icon">
                  <BrainIcon />
                </div>
                <div className="option-content">
                  <div className="title">AI Agent Application</div>
                  <span className="badge">🚀 Powered by AI</span>
                </div>
              </div>
              <div className="description">
                Let your AI agent negotiate with the company's AI agent. Discuss salary, benefits, work arrangement, and more - all automatically while you focus on what matters.
              </div>
              <div className="features">
                <div className="feature">
                  <CheckIcon /> Automated negotiation
                </div>
                <div className="feature">
                  <CheckIcon /> 24/7 availability
                </div>
                <div className="feature">
                  <CheckIcon /> Best terms
                </div>
                <div className="feature">
                  <CheckIcon /> Real-time updates
                </div>
              </div>
            </ApplicationOption>
          </ApplicationOptions>
        </DialogContent>
      </Dialog>
      
      {/* Agent Configuration Modal */}
      <AgentNegotiationModal
        open={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        initiatorType="candidate"
        jobData={job}
        onSuccess={handleAgentSuccess}
      />
      
      {/* AI Screening Configuration Modal - For recruiters */}
      {isOwner && (
        <AIScreeningConfigModal
          open={showScreeningConfig}
          onClose={() => setShowScreeningConfig(false)}
          jobData={job}
          onStartScreening={handleStartScreening}
          loading={startingScreening}
        />
      )}
      
      {/* Upgrade Modal - For free users trying to use Agent */}
      <LimitReachedModal
        limit={limitInfo}
        onClose={() => setLimitInfo(null)}
      />
    </PageContainer>
  );
};

// Wrap with error boundary for resilience
const JobDetailWithErrorBoundary = () => (
  <JobDetailErrorBoundary>
    <JobDetail />
  </JobDetailErrorBoundary>
);

export default JobDetailWithErrorBoundary;

// Error Boundary for catching render errors
class JobDetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('JobDetail render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback>
          <h2>Something went wrong</h2>
          <p>There was an error loading this job. Please try refreshing the page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </ErrorFallback>
      );
    }
    return this.props.children;
  }
}
