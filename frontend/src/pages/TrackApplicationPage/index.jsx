import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  Work as WorkIcon,
  LocationOn as LocationIcon,
  ArrowBack as BackIcon,
  HourglassEmpty as PendingIcon,
  RateReview as ReviewIcon,
  Star as ShortlistIcon,
  CalendarMonth as CalendarIcon,
  EmojiEvents as OfferIcon,
  Cancel as RejectIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { guestScreeningAPI } from '../../services/api';
import { ROUTES, TEXT, VALIDATION } from './constants';
import {
  fadeIn,
  PageContainer,
  Card,
  Header,
  Logo,
  Title,
  Subtitle,
  Content,
  SearchForm,
  SearchInput,
  SearchButton,
  ResultCard,
  StatusBadge,
  JobInfo,
  JobTitle,
  JobMeta,
  JobMetaItem,
  AppliedDate,
  MatchScore,
  ErrorMsg,
  HomeLink
} from './styled';

const getStatusIcon = (status) => {
  switch (status) {
    case 'pending_screening':
    case 'submitted': return <PendingIcon fontSize="small" />;
    case 'under_review':
    case 'screening': return <ReviewIcon fontSize="small" />;
    case 'shortlisted': return <ShortlistIcon fontSize="small" />;
    case 'interview_scheduled':
    case 'interview_completed': return <CalendarIcon fontSize="small" />;
    case 'offered':
    case 'accepted': return <OfferIcon fontSize="small" />;
    case 'rejected': return <RejectIcon fontSize="small" />;
    default: return <CheckIcon fontSize="small" />;
  }
};

export default function TrackApplicationPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!code.trim() || code.trim().length < VALIDATION.MIN_TRACKING_CODE_LENGTH) {
      setError(TEXT.ERROR_INVALID_CODE);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const response = await guestScreeningAPI.trackApplication(code.trim());
      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_NOT_FOUND);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Card>
        <Header>
          <Logo>Profile<span>AI</span></Logo>
          <Title>{TEXT.PAGE_TITLE}</Title>
          <Subtitle>{TEXT.PAGE_SUBTITLE}</Subtitle>
        </Header>

        <Content>
          <SearchForm>
            <SearchInput
              placeholder={TEXT.PLACEHOLDER_CODE}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={VALIDATION.MAX_TRACKING_CODE_LENGTH}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <SearchButton onClick={handleSearch} disabled={loading || !code.trim()}>
              <SearchIcon />
            </SearchButton>
          </SearchForm>

          {error && <ErrorMsg>{error}</ErrorMsg>}

          {result && (
            <ResultCard>
              <StatusBadge $status={result.status}>
                {getStatusIcon(result.status)}
                {result.statusLabel}
              </StatusBadge>

              {result.job && (
                <JobInfo>
                  <JobTitle>{result.job.title}</JobTitle>
                  <JobMeta>
                    <JobMetaItem><WorkIcon /> {result.job.company}</JobMetaItem>
                    {result.job.location && (
                      <JobMetaItem><LocationIcon /> {result.job.location}</JobMetaItem>
                    )}
                  </JobMeta>
                </JobInfo>
              )}

              {result.applicantName && (
                <p style={{ fontSize: 14, color: '#475569', margin: '8px 0' }}>
                  Applicant: <strong>{result.applicantName}</strong>
                </p>
              )}

              {result.matchScore && (
                <MatchScore>
                  ⭐ AI Match Score: {result.matchScore}%
                </MatchScore>
              )}

              <AppliedDate>
                Submitted: {new Date(result.appliedAt).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </AppliedDate>
            </ResultCard>
          )}

          <HomeLink onClick={() => navigate(ROUTES.HOME)}>
            <BackIcon fontSize="small" /> {TEXT.BACK_TO_HOME}
          </HomeLink>
        </Content>
      </Card>
    </PageContainer>
  );
}
