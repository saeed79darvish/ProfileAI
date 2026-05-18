import React, { useState, useEffect } from 'react';
import {
  fadeIn,
  PageContainer,
  Card,
  Header,
  Logo,
  Title,
  Subtitle,
  Content,
  JobCard,
  JobTitle,
  CompanyName,
  JobMeta,
  MetaItem,
  PersonalMessage,
  Form,
  InputGroup,
  Label,
  Input,
  PasswordWrapper,
  Row,
  ConsentSection,
  ConsentTitle,
  ConsentItem,
  Features,
  Feature,
  ButtonGroup,
  Button,
  ErrorMessage,
  ExpiredMessage,
  SuccessMessage,
  LoadingSpinner
} from './styled';
import { ROUTES, TEXT, REDIRECT_DELAY_MS, PASSWORD_MIN_LENGTH } from './constants';

const InvitationAcceptPage = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    phone: '',
    consentToTerms: false,
    consentToScreening: false
  });
  
  // Check if action=decline in URL
  const isDeclineAction = searchParams.get('action') === 'decline';
  
  useEffect(() => {
    fetchInvitation();
  }, [token]);
  
  const fetchInvitation = async () => {
    try {
      setLoading(true);
      const response = await invitationAPI.getInvitation(token);
      setInvitation(response.data.data);
      
      // Pre-fill name if available
      if (response.data.data.firstName) {
        setFormData(prev => ({
          ...prev,
          firstName: response.data.data.firstName || '',
          lastName: response.data.data.lastName || ''
        }));
      }
      
      // Track click event
      invitationAPI.trackEvent(token, 'clicked').catch(() => {});
      
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_NOT_FOUND);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleAccept = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError(TEXT.ERROR_MISMATCH);
      return;
    }
    
    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      setError(TEXT.ERROR_PASSWORD_LENGTH);
      return;
    }
    
    if (!formData.consentToTerms || !formData.consentToScreening) {
      setError(TEXT.ERROR_CONSENT);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await invitationAPI.acceptInvitation(token, {
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        consentToTerms: true,
        consentToScreening: true
      });
      
      setSuccess(true);
      
      // Auto-login with returned token
      if (response.data.data.token) {
        localStorage.setItem('token', response.data.data.token);
        // Redirect to dashboard after a moment
        setTimeout(() => {
          navigate(ROUTES.PROFILE);
        }, REDIRECT_DELAY_MS);
      }
      
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_ACCEPT);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDecline = async () => {
    if (!window.confirm(TEXT.CONFIRM_DECLINE)) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      await invitationAPI.declineInvitation(token);
      setInvitation(prev => ({ ...prev, status: 'declined' }));
    } catch (err) {
      setError(err.response?.data?.error || TEXT.ERROR_DECLINE);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <PageContainer>
        <Card>
          <LoadingSpinner>
            <div className="spinner" />
            <p>{TEXT.LOADING}</p>
          </LoadingSpinner>
        </Card>
      </PageContainer>
    );
  }
  
  if (!invitation || error === TEXT.ERROR_NOT_FOUND) {
    return (
      <PageContainer>
        <Card>
          <Content>
            <ExpiredMessage>
              <WarningIcon />
              <h2>{TEXT.NOT_FOUND_TITLE}</h2>
              <p>{TEXT.NOT_FOUND_MESSAGE}</p>
            </ExpiredMessage>
          </Content>
        </Card>
      </PageContainer>
    );
  }
  
  if (invitation.isExpired) {
    return (
      <PageContainer>
        <Card>
          <Content>
            <ExpiredMessage>
              <TimeIcon />
              <h2>{TEXT.EXPIRED_TITLE}</h2>
              <p>{TEXT.EXPIRED_MESSAGE}</p>
            </ExpiredMessage>
          </Content>
        </Card>
      </PageContainer>
    );
  }
  
  if (invitation.status === 'accepted' || success) {
    return (
      <PageContainer>
        <Card>
          <Content>
            <SuccessMessage>
              <AcceptIcon />
              <h2>{TEXT.WELCOME_TITLE}</h2>
              <p>{TEXT.WELCOME_MESSAGE}</p>
              <Button $primary onClick={() => navigate(ROUTES.PROFILE)}>
                {TEXT.GO_TO_DASHBOARD}
              </Button>
            </SuccessMessage>
          </Content>
        </Card>
      </PageContainer>
    );
  }
  
  if (invitation.status === 'declined') {
    return (
      <PageContainer>
        <Card>
          <Content>
            <ExpiredMessage>
              <DeclineIcon />
              <h2>{TEXT.DECLINED_TITLE}</h2>
              <p>{TEXT.DECLINED_MESSAGE}</p>
            </ExpiredMessage>
          </Content>
        </Card>
      </PageContainer>
    );
  }
  
  const job = invitation.job;
  const recruiter = invitation.recruiter;
  
  return (
    <PageContainer>
      <Card>
        <Header>
          <Logo>
            <VerifiedIcon /> ProfileAI
          </Logo>
          <Title>{TEXT.INVITED_TITLE}</Title>
          <Subtitle>
            {recruiter?.company || TEXT.INVITED_SUBTITLE_DEFAULT} {TEXT.INVITED_SUBTITLE_SUFFIX}
          </Subtitle>
        </Header>
        
        <Content>
          {/* Job Details */}
          {job && (
            <JobCard>
              <JobTitle>{job.title}</JobTitle>
              <CompanyName>
                <CompanyIcon />
                {recruiter?.company || job.company}
              </CompanyName>
              <JobMeta>
                {job.location && (
                  <MetaItem>
                    <LocationIcon /> {job.location}
                  </MetaItem>
                )}
                {job.employmentType && (
                  <MetaItem>
                    <TimeIcon /> {job.employmentType.replace('-', ' ')}
                  </MetaItem>
                )}
                {job.salaryMin && job.salaryMax && (
                  <MetaItem>
                    <SalaryIcon /> ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}
                  </MetaItem>
                )}
              </JobMeta>
            </JobCard>
          )}
          
          {/* Personal Message */}
          {invitation.personalMessage && (
            <PersonalMessage>
              <p>"{invitation.personalMessage}"</p>
              <span className="author">— {recruiter?.name}</span>
            </PersonalMessage>
          )}
          
          {/* Features */}
          <Features>
            <Feature>
              <AIIcon />
              <h4>{TEXT.FEATURE_AI}</h4>
              <p>{TEXT.FEATURE_AI_DESC}</p>
            </Feature>
            <Feature>
              <AcceptIcon />
              <h4>{TEXT.FEATURE_FAST}</h4>
              <p>{TEXT.FEATURE_FAST_DESC}</p>
            </Feature>
            <Feature>
              <PersonIcon />
              <h4>{TEXT.FEATURE_DIRECT}</h4>
              <p>{TEXT.FEATURE_DIRECT_DESC}</p>
            </Feature>
          </Features>
          
          {error && (
            <ErrorMessage>
              <WarningIcon fontSize="small" />
              {error}
            </ErrorMessage>
          )}
          
          {/* Accept Form */}
          <Form onSubmit={handleAccept}>
            <Row>
              <InputGroup>
                <Label>{TEXT.LABEL_FIRST_NAME}</Label>
                <Input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </InputGroup>
              <InputGroup>
                <Label>{TEXT.LABEL_LAST_NAME}</Label>
                <Input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </InputGroup>
            </Row>
            
            <InputGroup>
              <Label>Email</Label>
              <Input
                type="email"
                value={invitation.email}
                disabled
                style={{ background: '#f1f5f9' }}
              />
            </InputGroup>
            
            <InputGroup>
              <Label>{TEXT.LABEL_PHONE}</Label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={TEXT.PHONE_PLACEHOLDER}
              />
            </InputGroup>
            
            <Row>
              <InputGroup>
                <Label>{TEXT.LABEL_PASSWORD}</Label>
                <PasswordWrapper>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </button>
                </PasswordWrapper>
              </InputGroup>
              <InputGroup>
                <Label>{TEXT.LABEL_CONFIRM_PASSWORD}</Label>
                <PasswordWrapper>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </button>
                </PasswordWrapper>
              </InputGroup>
            </Row>
            
            {/* Consent Section */}
            <ConsentSection>
              <ConsentTitle>
                <LockIcon /> {TEXT.CONSENT_TITLE}
              </ConsentTitle>
              
              <ConsentItem>
                <input
                  type="checkbox"
                  name="consentToTerms"
                  checked={formData.consentToTerms}
                  onChange={handleChange}
                  required
                />
                <div className="text">
                  <div className="title">{TEXT.CONSENT_TERMS_TITLE}</div>
                  <div className="description">
                    {TEXT.CONSENT_TERMS_PREFIX} <a href={ROUTES.TERMS} target="_blank">Terms of Service</a> and <a href={ROUTES.PRIVACY} target="_blank">Privacy Policy</a>
                  </div>
                </div>
              </ConsentItem>
              
              <ConsentItem>
                <input
                  type="checkbox"
                  name="consentToScreening"
                  checked={formData.consentToScreening}
                  onChange={handleChange}
                  required
                />
                <div className="text">
                  <div className="title">{TEXT.CONSENT_SCREENING_TITLE}</div>
                  <div className="description">
                    {TEXT.CONSENT_SCREENING_PREFIX} The AI will ask questions about my experience and qualifications. My responses will be shared with {recruiter?.company || 'the recruiter'}.
                  </div>
                </div>
              </ConsentItem>
            </ConsentSection>
            
            <ButtonGroup>
              <Button type="button" onClick={handleDecline} disabled={submitting}>
                <DeclineIcon />
                {TEXT.DECLINE_BUTTON}
              </Button>
              <Button 
                type="submit" 
                $primary 
                disabled={submitting || !formData.consentToTerms || !formData.consentToScreening}
              >
                {submitting ? TEXT.PROCESSING : TEXT.ACCEPT_BUTTON}
                <AcceptIcon />
              </Button>
            </ButtonGroup>
          </Form>
        </Content>
      </Card>
    </PageContainer>
  );
};

export default InvitationAcceptPage;
