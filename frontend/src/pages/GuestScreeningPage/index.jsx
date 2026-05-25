import React, { useState, useEffect, useCallback } from 'react';
import {
  fadeIn,
  shimmer,
  pulse,
  PageContainer,
  Card,
  Header,
  Logo,
  Title,
  Subtitle,
  Content,
  JobCard,
  JobTitle,
  JobCompany,
  JobMeta,
  JobMetaItem,
  PersonalMessage,
  ChoiceSection,
  ChoiceCard,
  ChoiceIcon,
  ChoiceContent,
  ChoiceTitle,
  ChoiceDesc,
  ChoiceTime,
  FormSection,
  SectionTitle,
  DropZone,
  DropZoneIcon,
  DropZoneText,
  FileInfo,
  FileName,
  FileSize,
  RemoveButton,
  QuestionGroup,
  QuestionLabel,
  Input,
  TextArea,
  Select,
  RadioGroup,
  RadioOption,
  ConsentSection,
  ConsentLabel,
  SubmitButton,
  BackButton,
  SuccessContainer,
  SuccessIcon,
  TrackingCode,
  TrackingLabel,
  TrackingValue,
  NextSteps,
  StepItem,
  LoadingContainer,
  LoadingBar,
  ErrorContainer,
  ErrorTitle
} from './styled';
import { ROUTES, TEXT, ALLOWED_FILE_TYPES, LIMITS } from './constants';

// ─── Component ──────────────────────────────────
export default function GuestScreeningPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // null = choice, 'quick' = guest form, 'signup' = redirect
  const [resumeFile, setResumeFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [answers, setAnswers] = useState({});
  const [consentScreening, setConsentScreening] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Load invitation data
  useEffect(() => {
    loadScreeningData();
  }, [token]);

  const loadScreeningData = async () => {
    try {
      setLoading(true);
      const response = await guestScreeningAPI.getScreeningData(token);
      setData(response.data.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load screening information';
      const status = err.response?.data?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  // File handling
  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert('Please upload a PDF or DOCX file');
      return;
    }
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      alert('File size must be under 5MB');
      return;
    }
    setResumeFile(file);
  };

  // Answer handling
  const updateAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Submit
  const handleSubmit = async () => {
    // Validate required fields
    const requiredQuestions = data.screeningQuestions.filter(q => q.required);
    const missingRequired = requiredQuestions.filter(q => !answers[q.id]);
    if (missingRequired.length > 0) {
      alert(`Please answer all required questions: ${missingRequired.map(q => q.question).join(', ')}`);
      return;
    }

    if (!consentScreening || !consentTerms) {
      alert('Please accept both consent checkboxes to continue');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }
      formData.append('answers', JSON.stringify(answers));
      formData.append('consentToScreening', 'true');
      formData.append('consentToTerms', 'true');

      const response = await guestScreeningAPI.submitScreening(token, formData);
      setResult(response.data.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── Render: Loading ────────────────────────────
  if (loading) {
    return (
      <PageContainer>
        <Card>
          <Header>
            <Logo>Profile<span>AI</span></Logo>
            <Title>Loading...</Title>
          </Header>
          <LoadingContainer>
            <p>Preparing your screening form...</p>
            <LoadingBar />
          </LoadingContainer>
        </Card>
      </PageContainer>
    );
  }

  // ─── Render: Error ──────────────────────────────
  if (error) {
    return (
      <PageContainer>
        <Card>
          <Header>
            <Logo>Profile<span>AI</span></Logo>
            <Title>Screening Unavailable</Title>
          </Header>
          <ErrorContainer>
            <ErrorTitle>
              {error.status === 'submitted' ? '✅ Already Submitted' :
               error.status === 'accepted' ? '✅ Already Accepted' :
               error.status === 'declined' ? '❌ Declined' : '⚠️ Error'}
            </ErrorTitle>
            <p>{error.message}</p>
            {error.status === 'submitted' && (
              <SubmitButton onClick={() => navigate('/track')} style={{ marginTop: 20, maxWidth: 300, margin: '20px auto 0' }}>
                Track Your Application
              </SubmitButton>
            )}
          </ErrorContainer>
        </Card>
      </PageContainer>
    );
  }

  // ─── Render: Success ────────────────────────────
  if (result) {
    return (
      <PageContainer>
        <Card>
          <Header>
            <Logo>Profile<span>AI</span></Logo>
            <Title>Submission Received!</Title>
          </Header>
          <SuccessContainer>
            <SuccessIcon><CheckIcon /></SuccessIcon>
            <h2 style={{ color: '#1e293b', marginBottom: 8 }}>You're all set!</h2>
            <p style={{ color: '#64748b', marginBottom: 0 }}>
              Your screening submission has been received and will be reviewed shortly.
            </p>
            
            <TrackingCode>
              <TrackingLabel>Your Tracking Code</TrackingLabel>
              <TrackingValue>{result.trackingCode}</TrackingValue>
              <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
                Save this code to track your application status
              </p>
            </TrackingCode>

            <NextSteps>
              <h4 style={{ color: '#1e293b', marginBottom: 12 }}>What happens next?</h4>
              {result.nextSteps?.map((step, i) => (
                <StepItem key={i}>
                  <CheckIcon />
                  <span>{step}</span>
                </StepItem>
              ))}
            </NextSteps>

            <SubmitButton 
              onClick={() => navigate('/track')} 
              style={{ marginTop: 24 }}
            >
              Track Your Application
            </SubmitButton>
          </SuccessContainer>
        </Card>
      </PageContainer>
    );
  }

  const { invitation, job, recruiter, screeningQuestions } = data;

  // ─── Render: Main ───────────────────────────────
  return (
    <PageContainer>
      <Card>
        <Header>
          <Logo>Profile<span>AI</span></Logo>
          <Title>
            {mode === 'quick' ? 'Quick Screening Submission' : 'You\'re Invited!'}
          </Title>
          <Subtitle>
            {recruiter?.name && `${recruiter.name} has invited you to apply`}
          </Subtitle>
        </Header>

        <Content>
          {/* Job Card */}
          {job && (
            <JobCard>
              <JobTitle>{job.title}</JobTitle>
              <JobCompany>{job.company}</JobCompany>
              <JobMeta>
                {job.location && (
                  <JobMetaItem>
                    <LocationIcon /> {job.location}
                  </JobMetaItem>
                )}
                {job.employmentType && (
                  <JobMetaItem>
                    <WorkIcon /> {job.employmentType}
                  </JobMetaItem>
                )}
                {(job.salaryMin || job.salaryMax) && (
                  <JobMetaItem>
                    <SalaryIcon /> 
                    {job.salaryMin && job.salaryMax 
                      ? `$${(job.salaryMin/1000).toFixed(0)}k – $${(job.salaryMax/1000).toFixed(0)}k`
                      : job.salaryMin ? `From $${(job.salaryMin/1000).toFixed(0)}k` : `Up to $${(job.salaryMax/1000).toFixed(0)}k`
                    }
                  </JobMetaItem>
                )}
              </JobMeta>
            </JobCard>
          )}

          {/* Personal message */}
          {invitation.personalMessage && (
            <PersonalMessage>
              "{invitation.personalMessage}"
            </PersonalMessage>
          )}

          {/* ─── Choice Screen ─── */}
          {!mode && (
            <ChoiceSection>
              <p style={{ color: '#475569', fontSize: 14, margin: '0 0 8px' }}>
                Hi {invitation.firstName || 'there'}! Choose how you'd like to proceed:
              </p>

              <ChoiceCard onClick={() => setMode('quick')} $active={false}>
                <ChoiceIcon $color="linear-gradient(135deg, #667eea, #764ba2)">
                  <QuickIcon />
                </ChoiceIcon>
                <ChoiceContent>
                  <ChoiceTitle>Quick Submit</ChoiceTitle>
                  <ChoiceDesc>
                    Upload your resume and answer a few questions. No account needed, 
                    our AI will review your profile.
                  </ChoiceDesc>
                  <ChoiceTime><TimerIcon /> 2–3 minutes</ChoiceTime>
                </ChoiceContent>
              </ChoiceCard>

              <ChoiceCard onClick={() => navigate(`/invite/${token}`)}>
                <ChoiceIcon $color="linear-gradient(135deg, #22c55e, #16a34a)">
                  <SignUpIcon />
                </ChoiceIcon>
                <ChoiceContent>
                  <ChoiceTitle>Join ProfilleAI</ChoiceTitle>
                  <ChoiceDesc>
                    Create a full profile to get matched with more opportunities, 
                    AI-powered coaching, and direct recruiter connections.
                  </ChoiceDesc>
                  <ChoiceTime><TimerIcon /> 5–10 minutes</ChoiceTime>
                </ChoiceContent>
              </ChoiceCard>
            </ChoiceSection>
          )}

          {/* ─── Quick Submit Form ─── */}
          {mode === 'quick' && (
            <FormSection>
              <BackButton onClick={() => setMode(null)}>
                <BackIcon fontSize="small" /> Back to options
              </BackButton>

              {/* Resume Upload */}
              <SectionTitle>
                <ResumeIcon /> Upload Your Resume
              </SectionTitle>

              <DropZone
                $hasFile={!!resumeFile}
                $dragOver={dragOver}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => !resumeFile && document.getElementById('resume-upload').click()}
              >
                {resumeFile ? (
                  <FileInfo>
                    <ResumeIcon style={{ color: '#22c55e', fontSize: 32 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <FileName>{resumeFile.name}</FileName>
                      <FileSize>{formatSize(resumeFile.size)}</FileSize>
                    </div>
                    <RemoveButton onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}>
                      <DeleteIcon fontSize="small" />
                    </RemoveButton>
                  </FileInfo>
                ) : (
                  <>
                    <DropZoneIcon><UploadIcon /></DropZoneIcon>
                    <DropZoneText>
                      Drag & drop your resume here, or <b>click to browse</b>
                    </DropZoneText>
                    <DropZoneText style={{ fontSize: 12, marginTop: 8 }}>
                      PDF or DOCX, max 5MB
                    </DropZoneText>
                  </>
                )}
              </DropZone>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.docx,.doc"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {/* AI note */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, padding: '12px 16px', background: '#f0f0ff', borderRadius: 12 }}>
                <AIIcon style={{ color: '#667eea', fontSize: 18 }} />
                <span style={{ fontSize: 13, color: '#475569' }}>
                  Our AI will parse your resume to extract skills and experience for matching
                </span>
              </div>

              {/* Screening Questions */}
              {screeningQuestions.length > 0 && (
                <>
                  <SectionTitle>
                    <InfoIcon /> Screening Questions
                  </SectionTitle>
                  
                  {screeningQuestions.map(q => (
                    <QuestionGroup key={q.id}>
                      <QuestionLabel>
                        {q.question}
                        {q.required && <span>*</span>}
                      </QuestionLabel>

                      {q.type === 'text' && (
                        <Input
                          placeholder={q.placeholder || ''}
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                        />
                      )}

                      {q.type === 'textarea' && (
                        <TextArea
                          placeholder={q.placeholder || ''}
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                          maxLength={q.maxLength || 2000}
                        />
                      )}

                      {q.type === 'select' && (
                        <Select
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                        >
                          <option value="">Select...</option>
                          {q.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </Select>
                      )}

                      {q.type === 'radio' && (
                        <RadioGroup>
                          {q.options?.map(opt => (
                            <RadioOption key={opt} $selected={answers[q.id] === opt}>
                              <input
                                type="radio"
                                name={q.id}
                                checked={answers[q.id] === opt}
                                onChange={() => updateAnswer(q.id, opt)}
                              />
                              {opt}
                            </RadioOption>
                          ))}
                        </RadioGroup>
                      )}

                      {q.type === 'number' && (
                        <Input
                          type="number"
                          placeholder={q.placeholder || ''}
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                        />
                      )}

                      {q.type === 'email' && (
                        <Input
                          type="email"
                          placeholder={q.placeholder || ''}
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                        />
                      )}

                      {q.type === 'phone' && (
                        <Input
                          type="tel"
                          placeholder={q.placeholder || ''}
                          value={answers[q.id] || ''}
                          onChange={e => updateAnswer(q.id, e.target.value)}
                        />
                      )}
                    </QuestionGroup>
                  ))}
                </>
              )}

              {/* Consent */}
              <ConsentSection>
                <ConsentLabel>
                  <input
                    type="checkbox"
                    checked={consentScreening}
                    onChange={e => setConsentScreening(e.target.checked)}
                  />
                  <span>
                    I consent to AI-powered screening of my resume and responses. My data will 
                    be analyzed to assess fit for this position.
                  </span>
                </ConsentLabel>
                <ConsentLabel>
                  <input
                    type="checkbox"
                    checked={consentTerms}
                    onChange={e => setConsentTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the <a href="/terms" target="_blank">Terms of Service</a> and 
                    <a href="/privacy" target="_blank"> Privacy Policy</a>.
                  </span>
                </ConsentLabel>
              </ConsentSection>

              {/* Submit */}
              <SubmitButton
                onClick={handleSubmit}
                disabled={submitting || (!resumeFile && Object.keys(answers).length === 0)}
              >
                {submitting ? (
                  <>Processing...</>
                ) : (
                  <>
                    <SendIcon /> Submit Screening
                  </>
                )}
              </SubmitButton>
            </FormSection>
          )}
        </Content>
      </Card>
    </PageContainer>
  );
}
