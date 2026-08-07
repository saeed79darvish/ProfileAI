import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  LocationOn as LocationIcon,
  AttachMoney as SalaryIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Send as SendIcon,
  Psychology as BrainIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { Dialog, DialogContent, IconButton } from '@mui/material';
import { resolveImageUrl } from '../services/api';
import AgentNegotiationModal from './AgentNegotiationModal';
import LimitReachedModal from './LimitReachedModal';
import JobAIToolsPanel from './JobAIToolsPanel';
import { useAuth } from '../contexts/AuthContext';

const Container = styled.div`
  padding: 32px;
  
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const CompanyRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
`;

const CompanyLogo = styled(Link)`
  width: 56px;
  height: 56px;
  background: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  svg {
    font-size: 28px;
    color: #667eea;
  }
`;

const CompanyInfo = styled.div`
  flex: 1;
`;

const CompanyName = styled(Link)`
  font-size: 16px;
  font-weight: 600;
  color: #667EEA;
  margin-bottom: 4px;
  text-decoration: none;
  display: block;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
  
  @media (max-width: 768px) {
    font-size: 15px;
  }
`;

const PostedDate = styled.div`
  font-size: 13px;
  color: #6B7280;
`;

const JobTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1F2937;
  margin: 0 0 16px;
  
  @media (max-width: 768px) {
    font-size: 24px;
    margin: 0 0 12px;
  }
`;

const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
  color: #6B7280;
  
  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  svg {
    font-size: 18px;
  }
`;

const SalaryBadge = styled.div`
  background: #ECFDF5;
  padding: 16px 20px;
  border-radius: 12px;
  margin: 16px 0;
  
  .label {
    font-size: 11px;
    font-weight: 600;
    color: #047857;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  
  .amount {
    font-size: 20px;
    font-weight: 700;
    color: #047857;
    display: flex;
    align-items: center;
    gap: 8px;
    
    svg {
      font-size: 22px;
    }
  }
  
  @media (max-width: 768px) {
    padding: 14px 18px;
    
    .label {
      font-size: 10px;
    }
    
    .amount {
      font-size: 18px;
    }
  }
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
  padding: 24px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 32px;
  
  @media (max-width: 768px) {
    padding: 20px 0;
    margin-bottom: 24px;
  }
`;

const ActionButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  ` : `
    background: white;
    color: #6B7280;
    border: 1px solid #e5e7eb;
    
    &:hover {
      border-color: #667eea;
      color: #667eea;
    }
  `}
`;

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
  margin: 0 0 16px;
`;

const SectionContent = styled.div`
  font-size: 15px;
  line-height: 1.7;
  color: #4B5563;
  white-space: pre-wrap;
`;

const JobFooter = styled.div`
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #9CA3AF;
  
  @media (max-width: 768px) {
    margin-top: 24px;
    padding-top: 20px;
    font-size: 12px;
  }
`;

const SkillsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SkillTag = styled.span`
  padding: 6px 14px;
  background: #EEF2FF;
  color: #667eea;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 20px;
  color: #9CA3AF;
  
  svg {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  h3 {
    font-size: 20px;
    color: #6B7280;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
`;

// Application Modal Components
const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  h2 {
    font-size: 24px;
    font-weight: 600;
    color: #1F2937;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    color: #6B7280;
    margin: 0;
  }
`;

const ApplicationOptions = styled.div`
  display: grid;
  gap: 16px;
`;

const ApplicationOption = styled.button`
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 16px;
  padding: 24px;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
  }
  
  .option-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    
    svg {
      font-size: 24px;
    }
  }
  
  .option-content {
    flex: 1;
  }
  
  .title {
    font-size: 18px;
    font-weight: 600;
    color: #1F2937;
    margin: 0 0 4px;
  }
  
  .badge {
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .description {
    font-size: 14px;
    color: #6B7280;
    line-height: 1.6;
    margin: 12px 0 0;
  }
  
  .features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #4B5563;
    
    svg {
      font-size: 16px;
      color: #10B981;
    }
  }
`;

const JobDetailView = ({ job, onApply }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  // Tier gate for the AI-agent apply feature (not a rate-limit 429).
  const [limitInfo, setLimitInfo] = useState(null);
  
  // Check for return from subscription page with state to open agent modal
  useEffect(() => {
    const returnState = sessionStorage.getItem('upgradeReturnState');
    if (returnState && job) {
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
  }, [user?.subscriptionTier, job]);

  if (!job) {
    return (
      <Container>
        <EmptyState>
          <WorkIcon />
          <h3>Select a job to view details</h3>
          <p>Choose from the list to see full job information</p>
        </EmptyState>
      </Container>
    );
  }

  const formatSalary = () => {
    if (!job.salaryMin && !job.salaryMax) return null;
    const currency = job.salaryCurrency || '$';
    
    const formatNumber = (num) => {
      if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
      return num.toLocaleString();
    };
    
    if (job.salaryMin && job.salaryMax) {
      return `${currency}${formatNumber(job.salaryMin)} - ${currency}${formatNumber(job.salaryMax)}`;
    }
    if (job.salaryMin) {
      return `${currency}${formatNumber(job.salaryMin)}+`;
    }
    return `Up to ${currency}${formatNumber(job.salaryMax)}`;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: `Check out this job: ${job.title} at ${job.company}`,
          url: window.location.origin + `/jobs/${job.id}`
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.origin + `/jobs/${job.id}`);
      alert('Link copied to clipboard!');
    }
  };

  const handleManualApply = () => {
    navigate(`/jobs/${job.id}/apply`);
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
    navigate(`/agent-arena/${negotiation.id}`);
  };

  const companySlug = job.recruiter?.recruiterProfile?.companySlug;
  const companyLink = companySlug ? `/company/${companySlug}` : '#';

  return (
    <Container>
      <Header>
        <CompanyRow>
          <CompanyLogo to={companyLink}>
            {job.recruiter?.recruiterProfile?.companyLogo ? (
              <img src={resolveImageUrl(job.recruiter.recruiterProfile.companyLogo)} alt={job.company} />
            ) : (
              <BusinessIcon />
            )}
          </CompanyLogo>
          <CompanyInfo>
            <CompanyName to={companyLink}>{job.company}</CompanyName>
            <PostedDate>Posted {new Date(job.createdAt).toLocaleDateString()}</PostedDate>
          </CompanyInfo>
        </CompanyRow>
        
        <JobTitle>{job.title}</JobTitle>
        
        <JobMeta>
          <span><LocationIcon /> {job.location}</span>
          <span><WorkIcon /> {job.locationType}</span>
          <span><ScheduleIcon /> {job.employmentType}</span>
        </JobMeta>
        
        {formatSalary() && (
          <SalaryBadge>
            <div className="label">Annual Salary</div>
            <div className="amount">
              <SalaryIcon />
              {formatSalary()}
            </div>
          </SalaryBadge>
        )}
      </Header>

      <ActionBar>
        <ActionButton $primary onClick={() => setShowApplicationModal(true)}>
          <SendIcon /> Apply Now
        </ActionButton>
        <ActionButton onClick={handleShare}>
          <ShareIcon /> Share
        </ActionButton>
        <ActionButton onClick={() => setSaved(!saved)}>
          {saved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          {saved ? 'Saved' : 'Save'}
        </ActionButton>
      </ActionBar>

      {job.description && (
        <Section>
          <SectionTitle>About the Role</SectionTitle>
          <SectionContent>{job.description}</SectionContent>
        </Section>
      )}

      {job.requirements && (
        <Section>
          <SectionTitle>Requirements</SectionTitle>
          <SectionContent>{job.requirements}</SectionContent>
        </Section>
      )}

      {job.responsibilities && (
        <Section>
          <SectionTitle>Responsibilities</SectionTitle>
          <SectionContent>{job.responsibilities}</SectionContent>
        </Section>
      )}

      {job.benefits && (
        <Section>
          <SectionTitle>Benefits</SectionTitle>
          <SectionContent>{job.benefits}</SectionContent>
        </Section>
      )}

      {job.skills && job.skills.length > 0 && (
        <Section>
          <SectionTitle>Required Skills</SectionTitle>
          <SkillsGrid>
            {job.skills.map((skill, index) => (
              <SkillTag key={index}>{skill}</SkillTag>
            ))}
          </SkillsGrid>
        </Section>
      )}
      
      <JobFooter>
        <span>Posted {(() => {
          const now = new Date();
          const created = new Date(job.createdAt);
          const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
          if (diffDays === 0) return 'today';
          if (diffDays === 1) return '1 day ago';
          if (diffDays < 7) return `${diffDays} days ago`;
          if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
          return `${Math.floor(diffDays / 30)} months ago`;
        })()}</span>
        <span>•</span>
        <span>{job.applicantCount || 15} applicants</span>
      </JobFooter>

      {/* AI Profile Tools Panel - For candidates */}
      {job && <JobAIToolsPanel job={job} />}

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
                Let your AI agent negotiate with the company's AI agent. Discuss salary, benefits, work arrangement, and more - all automatically.
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
      
      {/* Upgrade Modal - For free users trying to use Agent */}
      <LimitReachedModal
        limit={limitInfo}
        onClose={() => setLimitInfo(null)}
      />
    </Container>
  );
};

export default JobDetailView;
