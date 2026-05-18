import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  SmartToy,
  Phone,
  AccessTime,
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
  Refresh,
  Cancel,
  ExpandMore,
  ExpandLess,
  Person,
  Psychology,
  TrendingUp,
  Warning,
  Lightbulb
} from '@mui/icons-material';
import { CircularProgress, Tooltip, Chip } from '@mui/material';
import { phoneScreeningAPI } from '../services/api';

const Container = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => {
    switch (props.$status) {
      case 'completed': return 'rgba(34, 197, 94, 0.2)';
      case 'in_progress': return 'rgba(251, 191, 36, 0.2)';
      case 'failed': return 'rgba(239, 68, 68, 0.2)';
      case 'scheduled': return 'rgba(255, 255, 255, 0.2)';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  }};
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  
  svg {
    font-size: 16px;
  }
`;

const Content = styled.div`
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  
  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
  
  svg {
    color: #6366f1;
    font-size: 20px;
  }
`;

const CallInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
`;

const InfoItem = styled.div`
  .label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }
  
  .value {
    font-size: 14px;
    font-weight: 500;
    color: #1e293b;
  }
`;

const ScoreCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  background: ${props => {
    const score = props.$score;
    if (score >= 80) return 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)';
    if (score >= 60) return 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)';
    return 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
  }};
  padding: 20px;
  border-radius: 12px;
`;

const ScoreCircle = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  .score {
    font-size: 28px;
    font-weight: 700;
    color: ${props => {
      const score = props.$score;
      if (score >= 80) return '#16a34a';
      if (score >= 60) return '#ca8a04';
      return '#dc2626';
    }};
  }
  
  .label {
    font-size: 11px;
    color: #64748b;
  }
`;

const ScoreDetails = styled.div`
  flex: 1;
  
  h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 8px 0;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
  }
`;

const SkillsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const InsightsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const InsightItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: ${props => {
    switch (props.$type) {
      case 'strength': return '#dcfce7';
      case 'weakness': return '#fee2e2';
      case 'neutral': return '#f1f5f9';
      default: return '#f8fafc';
    }
  }};
  border-radius: 10px;
  
  svg {
    color: ${props => {
      switch (props.$type) {
        case 'strength': return '#16a34a';
        case 'weakness': return '#dc2626';
        default: return '#64748b';
      }
    }};
    margin-top: 2px;
  }
  
  span {
    font-size: 14px;
    color: #1e293b;
    line-height: 1.5;
  }
`;

const TranscriptContainer = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
`;

const TranscriptHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px;
  background: #f8fafc;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: #f1f5f9;
  }
  
  span {
    font-size: 14px;
    font-weight: 500;
    color: #1e293b;
  }
`;

const TranscriptContent = styled.div`
  max-height: ${props => props.$expanded ? '400px' : '0'};
  overflow-y: auto;
  transition: max-height 0.3s ease;
  padding: ${props => props.$expanded ? '16px' : '0 16px'};
`;

const TranscriptLine = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .speaker {
    font-size: 12px;
    font-weight: 600;
    color: ${props => props.$speaker === 'ai' ? '#6366f1' : '#16a34a'};
    min-width: 80px;
    text-transform: uppercase;
  }
  
  .text {
    font-size: 14px;
    color: #374151;
    line-height: 1.5;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: ${props => props.$primary ? '#6366f1' : 'white'};
  color: ${props => props.$primary ? 'white' : '#6366f1'};
  border: 1px solid ${props => props.$primary ? '#6366f1' : '#e2e8f0'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.$primary ? '#4f46e5' : '#f8fafc'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const NoResults = styled.div`
  text-align: center;
  padding: 40px 24px;
  
  svg {
    font-size: 48px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h4 {
    font-size: 16px;
    color: #64748b;
    margin: 0 0 8px 0;
  }
  
  p {
    font-size: 14px;
    color: #94a3b8;
    margin: 0;
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  
  p {
    margin-top: 16px;
    color: #64748b;
  }
`;

const getStatusIcon = (status) => {
  switch (status) {
    case 'completed': return <CheckCircle />;
    case 'in_progress': return <PlayArrow />;
    case 'failed': return <Error />;
    case 'scheduled': return <Schedule />;
    default: return <Schedule />;
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in_progress': return 'In Progress';
    case 'failed': return 'Failed';
    case 'scheduled': return 'Scheduled';
    case 'no_answer': return 'No Answer';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

const PhoneScreeningResults = ({ interviewId, phoneScreeningId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  useEffect(() => {
    fetchResults();
  }, [interviewId, phoneScreeningId]);
  
  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      if (phoneScreeningId) {
        response = await phoneScreeningAPI.getById(phoneScreeningId);
      } else if (interviewId) {
        response = await phoneScreeningAPI.getForInterview(interviewId);
      }
      
      setData(response?.data);
    } catch (err) {
      console.error('Error fetching phone screening results:', err);
      setError(err.response?.data?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartCall = async () => {
    try {
      setActionLoading(true);
      await phoneScreeningAPI.startCall(data.id);
      await fetchResults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start call');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleRetry = async () => {
    try {
      setActionLoading(true);
      await phoneScreeningAPI.startCall(data.id);
      await fetchResults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retry call');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await phoneScreeningAPI.cancel(data.id);
      await fetchResults();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };
  
  if (loading) {
    return (
      <Container>
        <LoadingState>
          <CircularProgress />
          <p>Loading screening results...</p>
        </LoadingState>
      </Container>
    );
  }
  
  if (!data) {
    return (
      <Container>
        <Header>
          <HeaderLeft>
            <SmartToy />
            <h3>AI Phone Screening</h3>
          </HeaderLeft>
        </Header>
        <NoResults>
          <Phone />
          <h4>No Phone Screening Scheduled</h4>
          <p>Phone screening has not been set up for this interview.</p>
        </NoResults>
      </Container>
    );
  }
  
  const analysis = data.analysisResults || {};
  const overallScore = analysis.overallScore || 0;
  
  return (
    <Container>
      <Header>
        <HeaderLeft>
          <SmartToy />
          <h3>AI Phone Screening</h3>
        </HeaderLeft>
        <StatusBadge $status={data.status}>
          {getStatusIcon(data.status)}
          {getStatusText(data.status)}
        </StatusBadge>
      </Header>
      
      <Content>
        {/* Call Info */}
        <Section>
          <SectionHeader>
            <Phone />
            <h4>Call Details</h4>
          </SectionHeader>
          <CallInfo>
            <InfoItem>
              <div className="label">Scheduled Time</div>
              <div className="value">
                {data.scheduledAt 
                  ? new Date(data.scheduledAt).toLocaleString() 
                  : 'Not scheduled'}
              </div>
            </InfoItem>
            <InfoItem>
              <div className="label">Duration</div>
              <div className="value">{data.duration || 15} minutes</div>
            </InfoItem>
            <InfoItem>
              <div className="label">Phone Number</div>
              <div className="value">{data.candidatePhone || 'N/A'}</div>
            </InfoItem>
            <InfoItem>
              <div className="label">Attempts</div>
              <div className="value">{data.retryCount || 0} / {data.maxRetries || 3}</div>
            </InfoItem>
            {data.callStartedAt && (
              <InfoItem>
                <div className="label">Call Started</div>
                <div className="value">{new Date(data.callStartedAt).toLocaleString()}</div>
              </InfoItem>
            )}
            {data.callEndedAt && (
              <InfoItem>
                <div className="label">Call Ended</div>
                <div className="value">{new Date(data.callEndedAt).toLocaleString()}</div>
              </InfoItem>
            )}
          </CallInfo>
        </Section>
        
        {/* Score - Only show if completed */}
        {data.status === 'completed' && analysis.overallScore !== undefined && (
          <Section>
            <SectionHeader>
              <TrendingUp />
              <h4>Overall Assessment</h4>
            </SectionHeader>
            <ScoreCard $score={overallScore}>
              <ScoreCircle $score={overallScore}>
                <span className="score">{overallScore}</span>
                <span className="label">/ 100</span>
              </ScoreCircle>
              <ScoreDetails>
                <h4>
                  {overallScore >= 80 ? 'Strong Candidate' : 
                   overallScore >= 60 ? 'Potential Match' : 
                   'Needs Review'}
                </h4>
                <p>
                  {analysis.summary || 
                   'Based on the phone screening, this candidate shows potential for the role. Review the detailed insights below.'}
                </p>
              </ScoreDetails>
            </ScoreCard>
          </Section>
        )}
        
        {/* Skills Identified */}
        {data.status === 'completed' && analysis.skillsIdentified?.length > 0 && (
          <Section>
            <SectionHeader>
              <Psychology />
              <h4>Skills Identified</h4>
            </SectionHeader>
            <SkillsList>
              {analysis.skillsIdentified.map((skill, index) => (
                <Chip 
                  key={index} 
                  label={skill} 
                  color="primary" 
                  variant="outlined"
                  size="small"
                />
              ))}
            </SkillsList>
          </Section>
        )}
        
        {/* Key Insights */}
        {data.status === 'completed' && (
          <Section>
            <SectionHeader>
              <Lightbulb />
              <h4>Key Insights</h4>
            </SectionHeader>
            <InsightsList>
              {analysis.strengths?.map((strength, index) => (
                <InsightItem key={`strength-${index}`} $type="strength">
                  <CheckCircle fontSize="small" />
                  <span>{strength}</span>
                </InsightItem>
              ))}
              {analysis.areasOfConcern?.map((concern, index) => (
                <InsightItem key={`concern-${index}`} $type="weakness">
                  <Warning fontSize="small" />
                  <span>{concern}</span>
                </InsightItem>
              ))}
              {analysis.recommendations?.map((rec, index) => (
                <InsightItem key={`rec-${index}`} $type="neutral">
                  <Lightbulb fontSize="small" />
                  <span>{rec}</span>
                </InsightItem>
              ))}
            </InsightsList>
          </Section>
        )}
        
        {/* Transcript */}
        {data.status === 'completed' && data.transcript && (
          <Section>
            <TranscriptContainer>
              <TranscriptHeader 
                onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              >
                <span>Call Transcript</span>
                {transcriptExpanded ? <ExpandLess /> : <ExpandMore />}
              </TranscriptHeader>
              <TranscriptContent $expanded={transcriptExpanded}>
                {typeof data.transcript === 'string' ? (
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
                    {data.transcript}
                  </div>
                ) : (
                  data.transcript?.map?.((line, index) => (
                    <TranscriptLine key={index} $speaker={line.speaker}>
                      <span className="speaker">{line.speaker}</span>
                      <span className="text">{line.text}</span>
                    </TranscriptLine>
                  ))
                )}
              </TranscriptContent>
            </TranscriptContainer>
          </Section>
        )}
        
        {/* Error Message */}
        {data.status === 'failed' && data.errorMessage && (
          <Section>
            <InsightItem $type="weakness">
              <Error fontSize="small" />
              <span>{data.errorMessage}</span>
            </InsightItem>
          </Section>
        )}
        
        {/* Action Buttons */}
        <ActionButtons>
          {data.status === 'scheduled' && (
            <>
              <ActionButton 
                $primary 
                onClick={handleStartCall}
                disabled={actionLoading}
              >
                {actionLoading ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                Start Call Now
              </ActionButton>
              <ActionButton onClick={handleCancel} disabled={actionLoading}>
                <Cancel />
                Cancel Screening
              </ActionButton>
            </>
          )}
          
          {data.status === 'failed' && (
            <ActionButton 
              $primary 
              onClick={handleRetry}
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
              Retry Call
            </ActionButton>
          )}
          
          {data.status === 'completed' && (
            <ActionButton onClick={() => window.print()}>
              Export Results
            </ActionButton>
          )}
        </ActionButtons>
      </Content>
    </Container>
  );
};

export default PhoneScreeningResults;
