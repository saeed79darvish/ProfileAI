import { useParams, useNavigate, Link } from 'react-router-dom';
import { Breadcrumbs, Typography, CircularProgress, Snackbar, Alert as MuiAlert } from '@mui/material';
import {
  PageContainer,
  Content,
  Header,
  BreadcrumbsWrapper,
  BreadcrumbLink,
  BreadcrumbCurrent,
  Title,
  Subtitle,
  Card,
  JobInfo,
  FormSection,
  Label,
  Input,
  Textarea,
  FileUploadArea,
  FileInfo,
  ButtonGroup,
  Button,
  Select,
  RadioGroup,
  RadioLabel,
  CheckboxGroup,
  CheckboxLabel,
  SectionDivider,
  QuestionDescription,
  SuccessMessage,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalActions,
  ParseButton,
  ParsingIndicator,
  ListSection,
  ListItem,
  ListItemHeader,
  RemoveButton,
  ListItemFields,
  SmallInput,
  SmallLabel,
  FieldGroup,
  AddItemButton,
  SmallTextarea,
  CheckboxWrapper
} from './styled';
import { ROUTES, MONTH_MAP, VALID_FILE_TYPES, LIMITS, TEXT as CONST_TEXT } from './constants';
import { parseDateFromPeriod, parsePeriodDates } from './utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import MobileApplyRecommendation from '@/components/MobileApplyRecommendation';
import useIsMobileDevice from '@/hooks/useIsMobileDevice';

let startDate = '';

let endDate = '';

const initialAnswers = {};

const JobApplication = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const isMobile = useIsMobileDevice();
  const [continueOnMobile, setContinueOnMobile] = useState(false);
  
  // Helper function to show snackbar
  const showMessage = (message, severity = 'error') => {
    setSnackbar({ open: true, message, severity });
  };
  
  // Dynamic answers for custom questions
  const [answers, setAnswers] = useState({});
  // Standard fields
  const [coverLetter, setCoverLetter] = useState('');
  const [resume, setResume] = useState(null);
  
  // Resume parsing state
  const [showParseModal, setShowParseModal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  
  // Experience and Education lists
  const [experienceList, setExperienceList] = useState([]);
  const [educationList, setEducationList] = useState([]);

  useEffect(() => {
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await jobAPI.getById(id);
      setJob(response.data);
      
      // Initialize answers object with empty values for each question
      if (response.data.applicationQuestions && response.data.applicationQuestions.length > 0) {
        response.data.applicationQuestions.forEach((q, index) => {
          initialAnswers[`question_${index}`] = q.type === 'checkbox' ? [] : '';
        });
        setAnswers(initialAnswers);
      }
    } catch (err) {
      console.error('Error fetching job:', err);
      showMessage('Job not found');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prev => ({
      ...prev,
      [`question_${questionIndex}`]: value
    }));
  };

  const handleCheckboxChange = (questionIndex, option, checked) => {
    setAnswers(prev => {
      const currentValues = prev[`question_${questionIndex}`] || [];
      if (checked) {
        return { ...prev, [`question_${questionIndex}`]: [...currentValues, option] };
      } else {
        return { ...prev, [`question_${questionIndex}`]: currentValues.filter(v => v !== option) };
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!VALID_FILE_TYPES.includes(file.type)) {
        showMessage('Please upload a PDF or Word document');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showMessage('File size must be less than 5MB');
        return;
      }
      
      setResume(file);
      // Show the parse modal to ask if user wants to auto-fill
      setShowParseModal(true);
    }
  };

  const handleParseResume = async () => {
    if (!resume) return;
    
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append('resume', resume);
      
      const response = await profileAPI.uploadResume(formData);
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setParsedData(data);
        
        // Helper to format date string to YYYY-MM-DD if needed
        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          // If already in YYYY-MM-DD format
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
          }
          // Try parsing with parsePeriodDates as fallback
          const parsed = parsePeriodDates(dateStr);
          return parsed.startDate || '';
        };
        
        // Auto-fill experience list
        if (data.experience && data.experience.length > 0) {
          setExperienceList(data.experience.map((exp, idx) => {
            // Use direct date fields if available, fallback to period parsing
            let startDate = exp.startDate ? formatDate(exp.startDate) : '';
            let endDate = exp.endDate ? formatDate(exp.endDate) : '';
            let current = exp.current || false;
            
            // Fallback to period parsing if no direct dates
            if (!startDate && exp.period) {
              const dates = parsePeriodDates(exp.period);
              startDate = dates.startDate;
              endDate = dates.endDate;
              current = dates.current;
            }
            
            return {
              id: Date.now() + idx,
              company: exp.company || '',
              title: exp.title || '',
              startDate,
              endDate,
              current,
              description: exp.description || ''
            };
          }));
        }
        
        // Auto-fill education list
        if (data.education && data.education.length > 0) {
          setEducationList(data.education.map((edu, idx) => {
            // Use direct date fields if available, fallback to period parsing
            let startDate = edu.startDate ? formatDate(edu.startDate) : '';
            let endDate = edu.endDate ? formatDate(edu.endDate) : '';
            
            // Fallback to period parsing if no direct dates
            if (!startDate && edu.period) {
              const dates = parsePeriodDates(edu.period);
              startDate = dates.startDate;
              endDate = dates.endDate;
            }
            
            return {
              id: Date.now() + idx + 100,
              institution: edu.institution || '',
              degree: edu.degree || '',
              field: edu.field || '',
              startDate,
              endDate,
              gpa: edu.gpa || ''
            };
          }));
        }
        job.applicationQuestions?.forEach((q, index) => {
          const qId = (q.id || '').toLowerCase();
          const qText = (q.question || '').toLowerCase();
          const qLabel = (q.label || '').toLowerCase();
          const searchText = `${qId} ${qText} ${qLabel}`;
          
          // Full Name
          if ((searchText.includes('full name') || searchText.includes('your name') || 
               (searchText.includes('name') && !searchText.includes('company'))) && fullName) {
            newAnswers[`question_${index}`] = fullName;
          }
          // First Name
          if ((searchText.includes('first name') || qId === 'first_name') && data.firstName) {
            newAnswers[`question_${index}`] = data.firstName;
          }
          // Last Name
          if ((searchText.includes('last name') || qId === 'last_name') && data.lastName) {
            newAnswers[`question_${index}`] = data.lastName;
          }
          // Email
          if ((searchText.includes('email') || qId === 'email') && data.email) {
            newAnswers[`question_${index}`] = data.email;
          }
          // Phone
          if ((searchText.includes('phone') || searchText.includes('mobile') || searchText.includes('contact number') || qId === 'phone') && data.phone) {
            newAnswers[`question_${index}`] = data.phone;
          }
          // LinkedIn
          if ((searchText.includes('linkedin') || qId === 'linkedin') && data.linkedinUrl) {
            newAnswers[`question_${index}`] = data.linkedinUrl;
          }
          // GitHub
          if ((searchText.includes('github') || qId === 'github') && data.githubUrl) {
            newAnswers[`question_${index}`] = data.githubUrl;
          }
          // Website/Portfolio
          if ((searchText.includes('website') || searchText.includes('portfolio') || qId === 'website') && data.website) {
            newAnswers[`question_${index}`] = data.website;
          }
          // Location/City
          if ((searchText.includes('location') || searchText.includes('city') || searchText.includes('address') || qId === 'location') && data.location) {
            newAnswers[`question_${index}`] = data.location;
          }
          // Current/Desired Title
          if ((searchText.includes('current title') || searchText.includes('job title') || searchText.includes('position') || qId === 'title') && data.title) {
            newAnswers[`question_${index}`] = data.title;
          }
          // Summary/About
          if ((searchText.includes('summary') || searchText.includes('about yourself') || searchText.includes('tell us about') || searchText.includes('introduction')) && data.summary) {
            newAnswers[`question_${index}`] = data.summary;
          }
          // Skills
          if ((searchText.includes('skill') || qId === 'skills') && data.skills && data.skills.length > 0) {
            newAnswers[`question_${index}`] = data.skills.join(', ');
          }
        });
        setAnswers(newAnswers);
        
        setShowParseModal(false);
        
        // Show success message with summary
        const expCount = data.experience?.length || 0;
        const eduCount = data.education?.length || 0;
        const filledCount = Object.values(newAnswers).filter(v => v && v.length > 0).length;
        showMessage(`Resume parsed! Found ${expCount} experience(s), ${eduCount} education record(s), and filled ${filledCount} field(s).`, 'success');
      } else {
        showMessage('Could not extract information from resume. Please fill the form manually.');
        setShowParseModal(false);
      }
    } catch (err) {
      console.error('Error parsing resume:', err);
      showMessage('Failed to parse resume. You can still fill the form manually.');
      setShowParseModal(false);
    } finally {
      setParsing(false);
    }
  };

  const handleSkipParse = () => {
    setShowParseModal(false);
  };

  // Experience list handlers
  const addExperience = () => {
    setExperienceList([...experienceList, {
      id: Date.now(),
      company: '',
      title: '',
      startDate: '',
      endDate: '',
      current: false,
      description: ''
    }]);
  };

  const removeExperience = (id) => {
    setExperienceList(experienceList.filter(exp => exp.id !== id));
  };

  const updateExperience = (id, field, value) => {
    setExperienceList(experienceList.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  // Education list handlers
  const addEducation = () => {
    setEducationList([...educationList, {
      id: Date.now(),
      institution: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
      gpa: ''
    }]);
  };

  const removeEducation = (id) => {
    setEducationList(educationList.filter(edu => edu.id !== id));
  };

  const updateEducation = (id, field, value) => {
    setEducationList(educationList.map(edu => 
      edu.id === id ? { ...edu, [field]: value } : edu
    ));
  };

  // Validate required questions
  const validateForm = () => {
    if (!job.applicationQuestions || job.applicationQuestions.length === 0) {
      // If no custom questions, just require cover letter
      if (!coverLetter.trim()) {
        showMessage('Please write a cover letter');
        return false;
      }
      return true;
    }

    // Check required custom questions
    for (let i = 0; i < job.applicationQuestions.length; i++) {
      const q = job.applicationQuestions[i];
      const answer = answers[`question_${i}`];
      
      if (q.required) {
        if (q.type === 'checkbox') {
          if (!answer || answer.length === 0) {
            showMessage(`Please answer: ${q.question}`);
            return false;
          }
        } else {
          if (!answer || !answer.toString().trim()) {
            showMessage(`Please answer: ${q.question}`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      const applicationData = new FormData();
      applicationData.append('coverLetter', coverLetter);
      
      // Include custom question answers
      if (job.applicationQuestions && job.applicationQuestions.length > 0) {
        job.applicationQuestions.forEach((q, index) => {
          formattedAnswers[q.question] = answers[`question_${index}`];
        });
        applicationData.append('answers', JSON.stringify(formattedAnswers));
      }
      
      // Include experience and education lists
      if (experienceList.length > 0) {
        applicationData.append('experience', JSON.stringify(experienceList));
      }
      if (educationList.length > 0) {
        applicationData.append('education', JSON.stringify(educationList));
      }
      
      if (resume) {
        applicationData.append('resume', resume);
      }
      
      // Submit application to the backend
      await jobAPI.submitApplication(id, applicationData);
      
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting application:', err);
      const errorMessage = err.response?.data?.message || 'Failed to submit application. Please try again.';
      showMessage(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Render experience list section
  const renderExperienceList = () => (
    <ListSection>
      {experienceList.map((exp, idx) => (
        <ListItem key={exp.id}>
          <ListItemHeader>
            <h4><BusinessIcon /> Experience #{idx + 1}</h4>
            <RemoveButton onClick={() => removeExperience(exp.id)} title="Remove">
              <DeleteIcon fontSize="small" />
            </RemoveButton>
          </ListItemHeader>
          <ListItemFields>
            <FieldGroup>
              <SmallLabel>Company *</SmallLabel>
              <SmallInput
                type="text"
                value={exp.company}
                onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                placeholder="Company name"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>Job Title *</SmallLabel>
              <SmallInput
                type="text"
                value={exp.title}
                onChange={(e) => updateExperience(exp.id, 'title', e.target.value)}
                placeholder="Your role"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>Start Date</SmallLabel>
              <SmallInput
                type="date"
                value={exp.startDate}
                onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>End Date</SmallLabel>
              <SmallInput
                type="date"
                value={exp.endDate}
                onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                disabled={exp.current}
              />
            </FieldGroup>
            <FieldGroup>
              <CheckboxWrapper>
                <input
                  type="checkbox"
                  checked={exp.current}
                  onChange={(e) => updateExperience(exp.id, 'current', e.target.checked)}
                />
                Currently working here
              </CheckboxWrapper>
            </FieldGroup>
            <FieldGroup $fullWidth>
              <SmallLabel>Description</SmallLabel>
              <SmallTextarea
                value={exp.description}
                onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                placeholder="Describe your responsibilities and achievements..."
              />
            </FieldGroup>
          </ListItemFields>
        </ListItem>
      ))}
      <AddItemButton type="button" onClick={addExperience}>
        <AddIcon fontSize="small" />
        Add Work Experience
      </AddItemButton>
    </ListSection>
  );

  // Render education list section
  const renderEducationList = () => (
    <ListSection>
      {educationList.map((edu, idx) => (
        <ListItem key={edu.id}>
          <ListItemHeader>
            <h4><SchoolIcon /> Education #{idx + 1}</h4>
            <RemoveButton onClick={() => removeEducation(edu.id)} title="Remove">
              <DeleteIcon fontSize="small" />
            </RemoveButton>
          </ListItemHeader>
          <ListItemFields>
            <FieldGroup>
              <SmallLabel>Institution *</SmallLabel>
              <SmallInput
                type="text"
                value={edu.institution}
                onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                placeholder="University/School name"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>Degree *</SmallLabel>
              <SmallInput
                type="text"
                value={edu.degree}
                onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                placeholder="e.g., Bachelor's, Master's"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>Field of Study</SmallLabel>
              <SmallInput
                type="text"
                value={edu.field}
                onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                placeholder="e.g., Computer Science"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>GPA (optional)</SmallLabel>
              <SmallInput
                type="text"
                value={edu.gpa}
                onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                placeholder="e.g., 3.8"
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>Start Date</SmallLabel>
              <SmallInput
                type="date"
                value={edu.startDate}
                onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
              />
            </FieldGroup>
            <FieldGroup>
              <SmallLabel>End Date / Expected</SmallLabel>
              <SmallInput
                type="date"
                value={edu.endDate}
                onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
              />
            </FieldGroup>
          </ListItemFields>
        </ListItem>
      ))}
      <AddItemButton type="button" onClick={addEducation}>
        <AddIcon fontSize="small" />
        Add Education
      </AddItemButton>
    </ListSection>
  );

  // Render a single question based on its type
  const renderQuestion = (question, index) => {
    const value = answers[`question_${index}`];
    
    // Handle special list types
    if (question.type === 'experience_list') {
      return renderExperienceList();
    }
    
    if (question.type === 'education_list') {
      return renderEducationList();
    }
    
    switch (question.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            placeholder={question.placeholder || 'Enter your answer...'}
            required={question.required}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            placeholder={question.placeholder || 'Enter your answer...'}
            required={question.required}
            style={{ minHeight: '100px' }}
          />
        );
      
      case 'select':
        return (
          <Select
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            required={question.required}
          >
            <option value="">Select an option...</option>
            {(question.options || []).map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </Select>
        );
      
      case 'radio':
        return (
          <RadioGroup>
            {(question.options || []).map((opt, i) => (
              <RadioLabel key={i}>
                <input
                  type="radio"
                  name={`question_${index}`}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  required={question.required}
                />
                {opt}
              </RadioLabel>
            ))}
          </RadioGroup>
        );
      
      case 'checkbox':
        return (
          <CheckboxGroup>
            {(question.options || []).map((opt, i) => (
              <CheckboxLabel key={i}>
                <input
                  type="checkbox"
                  checked={(value || []).includes(opt)}
                  onChange={(e) => handleCheckboxChange(index, opt, e.target.checked)}
                />
                {opt}
              </CheckboxLabel>
            ))}
          </CheckboxGroup>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            placeholder={question.placeholder || 'Enter a number...'}
            required={question.required}
          />
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            required={question.required}
          />
        );
      
      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            placeholder={question.placeholder || 'https://...'}
            required={question.required}
          />
        );
      
      case 'file':
        return (
          <Input
            type="file"
            onChange={(e) => handleAnswerChange(index, e.target.files[0]?.name || '')}
            required={question.required}
          />
        );
      
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            placeholder="Enter your answer..."
            required={question.required}
          />
        );
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Content>
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            Loading job details...
          </div>
        </Content>
      </PageContainer>
    );
  }

  if (!job) {
    return null;
  }

  if (submitted) {
    return (
      <PageContainer>
        <Content>
          <Card>
            <SuccessMessage>
              <CheckIcon />
              <h2>Application Submitted!</h2>
              <p>Your application for {job.title} at {job.company} has been submitted successfully.</p>
              <p>The recruiter will review your application and get back to you soon.</p>
              <ButtonGroup>
                <Button onClick={() => navigate('/jobs')}>
                  Browse More Jobs
                </Button>
                <Button $primary onClick={() => navigate('/profile')}>
                  Go to Profile
                </Button>
              </ButtonGroup>
            </SuccessMessage>
          </Card>
        </Content>
      </PageContainer>
    );
  }

  if (isMobile && !continueOnMobile) {
    return (
      <PageContainer>
        <Content>
          <div style={{ padding: '48px 0' }}>
            <MobileApplyRecommendation
              variant="interstitial"
              jobUrl={window.location.href}
              jobTitle={job.title}
              onContinueAnyway={() => setContinueOnMobile(true)}
            />
          </div>
        </Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Content>
        <Header>
          <BreadcrumbsWrapper>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
              <BreadcrumbLink to="/jobs">
                <HomeIcon /> Jobs
              </BreadcrumbLink>
              <BreadcrumbLink to={`/jobs/${id}`}>
                <WorkIcon /> {job.title}
              </BreadcrumbLink>
              <BreadcrumbCurrent>Apply</BreadcrumbCurrent>
            </Breadcrumbs>
          </BreadcrumbsWrapper>
          <Title>Apply for Position</Title>
          <Subtitle>Submit your application and stand out from the crowd</Subtitle>
        </Header>
        
        <Card>
          <JobInfo>
            <h3>{job.title}</h3>
            <p>{job.company} • {job.location}</p>
            <p>{job.employmentType} • {job.locationType}</p>
          </JobInfo>
          
          <form onSubmit={handleSubmit}>
            {/* Resume Upload - Always shown */}
            <FormSection>
              <Label>Resume / CV</Label>
              <FileUploadArea onClick={() => document.getElementById('resume-upload').click()}>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                />
                <AttachIcon style={{ fontSize: 40, color: '#cbd5e1', marginBottom: 8 }} />
                <div style={{ fontSize: 14, color: '#64748b' }}>
                  Click to upload your resume (PDF or Word, max 5MB)
                </div>
              </FileUploadArea>
              
              {resume && (
                <FileInfo>
                  <ResumeIcon />
                  <div className="file-details">
                    <div className="file-name">{resume.name}</div>
                    <div className="file-size">{(resume.size / 1024).toFixed(1)} KB</div>
                  </div>
                </FileInfo>
              )}
            </FormSection>

            {/* Cover Letter - Always shown */}
            <FormSection>
              <Label>Cover Letter *</Label>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell us why you're a great fit for this role..."
                required
              />
            </FormSection>
            
            {/* Dynamic Custom Questions from Recruiter */}
            {job.applicationQuestions && job.applicationQuestions.length > 0 && (
              <>
                <SectionDivider>
                  <span>Additional Questions</span>
                </SectionDivider>
                
                {job.applicationQuestions.map((question, index) => (
                  <FormSection key={index}>
                    <Label>
                      {question.question || question.label}
                      {question.required && ' *'}
                    </Label>
                    {question.description && (
                      <QuestionDescription>{question.description}</QuestionDescription>
                    )}
                    {renderQuestion(question, index)}
                  </FormSection>
                ))}
              </>
            )}
            
            <ButtonGroup>
              <Button type="button" onClick={() => navigate(`/jobs/${id}`)}>
                Cancel
              </Button>
              <Button type="submit" $primary disabled={submitting}>
                <SendIcon />
                {submitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </ButtonGroup>
          </form>
        </Card>
      </Content>
      
      {/* Resume Parse Modal */}
      {showParseModal && (
        <ModalOverlay onClick={handleSkipParse}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h3><AutoAwesomeIcon /> Smart Resume Parser</h3>
              <ModalCloseButton onClick={handleSkipParse}>
                <CloseIcon fontSize="small" />
              </ModalCloseButton>
            </ModalHeader>
            
            {parsing ? (
              <ParsingIndicator>
                <CircularProgress size={48} sx={{ color: '#667eea' }} />
                <p>Analyzing your resume with AI...</p>
              </ParsingIndicator>
            ) : (
              <>
                <ModalBody>
                  <p>
                    Would you like us to automatically extract your <strong>work experience</strong> and 
                    <strong> education</strong> from your resume to fill out the application form?
                  </p>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Our AI will parse your resume and pre-fill relevant fields. You can review and edit the information before submitting.
                  </p>
                </ModalBody>
                <ModalActions>
                  <ParseButton onClick={handleSkipParse}>
                    No, I'll fill it manually
                  </ParseButton>
                  <ParseButton $primary onClick={handleParseResume}>
                    <AutoAwesomeIcon fontSize="small" />
                    Yes, auto-fill form
                  </ParseButton>
                </ModalActions>
              </>
            )}
          </ModalContent>
        </ModalOverlay>
      )}
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert 
          elevation={6} 
          variant="filled" 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
      
      {/* Resume Parsing Modal */}
      <ProcessingModal
        open={parsing}
        type="resume"
        title="Parsing Resume"
        subtitle="AI is extracting information from your resume to auto-fill the application..."
        phase="Analyzing document..."
      />
      
      {/* Submitting Application Modal */}
      <ProcessingModal
        open={submitting}
        type="submit"
        title="Submitting Application"
        subtitle="Please wait while we submit your application to the employer..."
        phase="Sending application..."
      />
    </PageContainer>
  );
};

export default JobApplication;
