import React, { useState, useEffect, useCallback } from 'react';
import {
  PageContainer,
  Header,
  HeaderContent,
  HeaderLeft,
  PostJobButton,
  Content,
  StatsGrid,
  StatCard,
  TabsContainer,
  Tab,
  TabCount,
  JobsList,
  JobCard,
  JobHeader,
  JobInfo,
  JobTitle,
  JobMeta,
  JobActions,
  ActionButton,
  StatusBadge,
  JobStats,
  JobStat,
  pulse,
  spin,
  ScreeningSection,
  ScreeningHeader,
  ScreeningTitle,
  ScreeningStatusBadge,
  ProgressContainer,
  ProgressText,
  ProgressBar,
  ProgressFill,
  ShortlistedCandidates,
  ShortlistedLabel,
  CandidateRow,
  CandidateAvatar,
  CandidateInfo,
  CandidateScores,
  ScorePill,
  CandidateActions,
  CandidateActionBtn,
  ScreeningError,
  NoShortlist,
  StartScreeningButton,
  FormConfigButton,
  ImportCandidatesButton,
  ViewApplicationsButton,
  SkillTags,
  SkillTag,
  EmptyState,
  ModalOverlay,
  Modal,
  ModalHeader,
  CloseButton,
  ModalBody,
  ConfirmModal,
  ConfirmHeader,
  ConfirmBody,
  ConfirmFooter,
  FormGrid,
  FormGroup,
  Input,
  Select,
  Textarea,
  SalaryGroup,
  ModalFooter,
  InfoBox,
  FeatureList,
  FeatureItem,
  CheckIcon,
  Button,
  SkillsInput,
  SkillChip,
  SkillInputField,
  RichTextContainer,
  RichTextToggle,
  ToggleButton,
  RichTextPreview,
  Toast,
  shimmer,
  AIButtonGroup,
  AIButton,
  AILabel,
  SuggestionChips,
  SuggestionChip,
  TitleSuggestionDropdown,
  TitleSuggestionItem,
  FormGroupRelative
} from './styled';
import { ROUTES, SECTION_PATTERNS, TIMINGS, LIMITS } from './constants';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Helper function to render formatted content - detects clean text structure
const renderFormattedContent = (text, placeholder) => {
  if (!text) return <span className="empty-state">{placeholder}</span>;
  
  const elements = [];
  let currentList = [];
  let key = 0;
  const lines = text.split('\n');
  
  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key++} className="bullet-list">
          {currentList.map((item, idx) => (
            <li key={idx} className="bullet-item">{item}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };
  
  const isSectionHeader = (line) => {
    const cleaned = line.replace(/[*#:]/g, '').trim();
    return SECTION_PATTERNS.some(pattern => pattern.test(cleaned));
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      flushList();
      continue;
    }
    
    // Remove any leftover formatting characters for display
    const cleanLine = trimmed.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');
    
    // Check if it's a section header
    if (isSectionHeader(cleanLine)) {
      flushList();
      elements.push(
        <div key={key++} className="section-header">{cleanLine}</div>
      );
      continue;
    }
    
    // Bullet points (-, *, •)
    if (/^[-\*•]\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^[-\*•]\s*/, ''));
      continue;
    }
    
    // Numbered lists
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+[\.\)]\s*/, ''));
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={key++} className="paragraph">{cleanLine}</p>
    );
  }
  
  flushList();
  
  return elements.length > 0 ? elements : text;
};

const RecruiterJobs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // AI Screening Status for each job
  const [screeningStatuses, setScreeningStatuses] = useState({});
  
  // AI Screening Config Modal
  const [showScreeningConfig, setShowScreeningConfig] = useState(false);
  const [showApplicationFormConfig, setShowApplicationFormConfig] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newlyCreatedJob, setNewlyCreatedJob] = useState(null);
  const [startingScreening, setStartingScreening] = useState(false);
  
  // AI Processing Modal
  const [showAIProcessingModal, setShowAIProcessingModal] = useState(false);
  const [aiProcessingData, setAIProcessingData] = useState({
    title: '',
    subtitle: '',
    phase: '',
    progress: 0,
    stats: null,
    type: 'screening'
  });
  
  // Candidate Selection Modal (between Smart Search and AI Screening)
  const [showCandidateSelection, setShowCandidateSelection] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  
  // Re-run Screening Confirmation Modal
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);
  const [rerunJob, setRerunJob] = useState(null);
  
  // AI Feature States
  const [aiLoading, setAiLoading] = useState({
    description: false,
    skills: false,
    title: false,
    requirements: false,
    benefits: false
  });
  const [suggestedSkills, setSuggestedSkills] = useState(null);
  const [titleSuggestions, setTitleSuggestions] = useState(null);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  
  // Preview mode states for rich text fields
  const [previewMode, setPreviewMode] = useState({
    description: false,
    requirements: false,
    benefits: false
  });
  
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    locationType: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'mid',
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: 'USD',
    salaryPeriod: 'yearly',
    description: '',
    requirements: '',
    benefits: '',
    skills: [],
    department: '',
    status: 'active'
  });
  
  const [skillInput, setSkillInput] = useState('');
  
  // Fetch screening status for a specific job
  const fetchScreeningStatus = useCallback(async (jobId) => {
    try {
      const response = await jobAPI.getScreeningStatus(jobId);
      const status = response.data;
      
      setScreeningStatuses(prev => ({
        ...prev,
        [jobId]: status
      }));
      
      // Update AI Processing Modal if screening is in progress with real data
      // Only show modal if this is the job we're actively screening
      const isActiveScreening = newlyCreatedJob && newlyCreatedJob.id === jobId;
      
      if (status && (status.status === 'searching' || status.status === 'screening') && isActiveScreening) {
        console.log('[Modal] Updating with real screening data:', {
          status: status.status,
          evaluated: status.totalCandidatesEvaluated,
          found: status.candidatesFound,
          shortlisted: status.shortlisted?.length,
          progress: status.progressPercent
        });
        
        setAIProcessingData({
          title: status.status === 'searching' ? 'Smart Search in Progress' : 'AI Screening in Progress',
          subtitle: status.status === 'searching' 
            ? 'AI is analyzing candidate profiles to find the best matches'
            : 'AI agent is conducting detailed screening of shortlisted candidates',
          phase: status.currentStep || (status.status === 'searching' ? 'Phase 1: Smart Search' : 'Phase 2: AI Screening'),
          progress: status.progressPercent || 0,
          stats: {
            evaluated: status.totalCandidatesEvaluated || 0,
            found: status.candidatesFound || 0,
            shortlisted: status.shortlisted?.length || 0
          },
          type: status.status === 'searching' ? 'search' : 'screening'
        });
        setShowAIProcessingModal(true);
      } else if (status && status.status === 'search_complete' && isActiveScreening) {
        // Smart Search completed - show candidate selection modal (only for active job)
        console.log('[Modal] Smart Search complete, showing selection modal with', status.searchResults?.length, 'candidates');
        setShowAIProcessingModal(false);
        setSearchResults(status.searchResults || []);
        setShowCandidateSelection(true);
      } else if (status && status.status === 'completed') {
        // Close modal when completed
        setShowAIProcessingModal(false);
        showToast('AI Screening completed! ' + (status.shortlisted?.length || 0) + ' candidates shortlisted.', 'success');
        
        // Clear newlyCreatedJob to stop tracking this screening session
        setNewlyCreatedJob(null);
      } else if (status && status.status === 'failed') {
        // Close modal and show error
        setShowAIProcessingModal(false);
        showToast('AI Screening failed: ' + (status.errorMessage || 'Unknown error'), 'error');
      }
      
      return status;
    } catch (error) {
      // Only log error if it's not a 404 (job might not have screening yet)
      if (error.response?.status !== 404) {
        console.error(`Error fetching screening status for job ${jobId}:`, error);
      }
      // Set null status to prevent repeated failed requests
      setScreeningStatuses(prev => ({
        ...prev,
        [jobId]: null
      }));
      return null;
    }
  }, [newlyCreatedJob]);
  
  // Fetch screening statuses for all jobs
  const fetchAllScreeningStatuses = useCallback(async (jobsList) => {
    const statusPromises = jobsList.map(job => fetchScreeningStatus(job.id));
    await Promise.all(statusPromises);
  }, [fetchScreeningStatus]);

  const jobCounts = {
    all: jobs.length,
    active: jobs.filter(j => j.status === 'active').length,
    paused: jobs.filter(j => j.status === 'paused').length,
    closed: jobs.filter(j => j.status === 'closed').length,
    draft: jobs.filter(j => j.status === 'draft').length
  };
  
  useEffect(() => {
    fetchJobs();
    fetchCompanyInfo();
  }, []);
  
  // Poll for in-progress screenings
  useEffect(() => {
    const inProgressJobs = Object.entries(screeningStatuses)
      .filter(([_, status]) => 
        status?.status === 'searching' || 
        status?.status === 'screening' ||
        status?.status === 'search_complete'
      )
      .map(([jobId]) => jobId);
    
    if (inProgressJobs.length > 0) {
      const pollInterval = setInterval(() => {
        inProgressJobs.forEach(jobId => fetchScreeningStatus(jobId));
      }, 5000); // Poll every 5 seconds - balanced between freshness and performance
      
      return () => clearInterval(pollInterval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screeningStatuses]);
  
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await jobAPI.getMyJobs();
      const jobsList = response.data.jobs || [];
      setJobs(jobsList);
      // Fetch screening statuses for all jobs so button state persists after refresh
      if (jobsList.length > 0) {
        fetchAllScreeningStatuses(jobsList);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      showToast('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCompanyInfo = async () => {
    try {
      const response = await recruiterProfileAPI.getMyProfile();
      if (response.data) {
        setCompanyInfo(response.data);
        setFormData(prev => ({
          ...prev,
          company: response.data.companyName || ''
        }));
      }
    } catch (error) {
      console.log('Could not fetch company info');
    }
  };
  
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // AI Handler Functions
  const handleAIGenerateDescription = async () => {
    if (!formData.title) {
      showToast('Please enter a job title first', 'error');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, description: true }));
    setShowAIProcessingModal(true);
    setAIProcessingData({
      title: 'AI Generating Description',
      subtitle: 'AI is crafting a compelling job description...',
      phase: 'Writing Job Description',
      progress: 0
    });
    
    try {
      const response = await jobAPI.aiGenerateDescription({
        title: formData.title,
        company: formData.company,
        department: formData.department,
        experienceLevel: formData.experienceLevel,
        locationType: formData.locationType,
        skills: formData.skills,
        notes: formData.requirements // Use requirements as additional context
      });
      
      setFormData(prev => ({ ...prev, description: response.data.description }));
      setPreviewMode(prev => ({ ...prev, description: true })); // Auto-switch to preview
      showToast('AI generated job description!');
    } catch (error) {
      console.error('Error generating description:', error);
      showToast('Failed to generate description', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, description: false }));
      setShowAIProcessingModal(false);
    }
  };
  
  const handleAISuggestSkills = async () => {
    if (!formData.title) {
      showToast('Please enter a job title first', 'error');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, skills: true }));
    try {
      const response = await jobAPI.aiSuggestSkills({
        title: formData.title,
        industry: companyInfo?.industry || 'Technology'
      });
      
      setSuggestedSkills(response.data);
      showToast('AI suggested skills!');
    } catch (error) {
      console.error('Error suggesting skills:', error);
      showToast('Failed to suggest skills', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, skills: false }));
    }
  };
  
  const handleAddSuggestedSkill = (skill) => {
    if (!formData.skills.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    }
  };
  
  const handleAIImproveTitle = async () => {
    if (!formData.title) {
      showToast('Please enter a job title first', 'error');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, title: true }));
    try {
      const response = await jobAPI.aiImproveTitle({
        title: formData.title,
        experienceLevel: formData.experienceLevel,
        department: formData.department
      });
      
      setTitleSuggestions(response.data.suggestions);
      setShowTitleDropdown(true);
    } catch (error) {
      console.error('Error improving title:', error);
      showToast('Failed to get title suggestions', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, title: false }));
    }
  };
  
  const handleSelectTitle = (title) => {
    setFormData(prev => ({ ...prev, title }));
    setShowTitleDropdown(false);
    setTitleSuggestions(null);
  };
  
  const handleAIGenerateRequirements = async () => {
    if (!formData.title) {
      showToast('Please enter a job title first', 'error');
      return;
    }
    
    setAiLoading(prev => ({ ...prev, requirements: true }));
    setShowAIProcessingModal(true);
    setAIProcessingData({
      title: 'AI Generating Requirements',
      subtitle: 'AI is analyzing and creating detailed job requirements...',
      phase: 'Generating Requirements List',
      progress: 0
    });
    
    try {
      const response = await jobAPI.aiGenerateRequirements({
        title: formData.title,
        skills: formData.skills,
        experienceLevel: formData.experienceLevel,
        description: formData.description
      });
      
      setFormData(prev => ({ ...prev, requirements: response.data.requirements }));
      setPreviewMode(prev => ({ ...prev, requirements: true })); // Auto-switch to preview
      showToast('AI generated requirements!');
    } catch (error) {
      console.error('Error generating requirements:', error);
      showToast('Failed to generate requirements', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, requirements: false }));
      setShowAIProcessingModal(false);
    }
  };
  
  const handleAIGenerateBenefits = async () => {
    setAiLoading(prev => ({ ...prev, benefits: true }));
    try {
      const response = await jobAPI.aiGenerateBenefits({
        company: formData.company,
        industry: companyInfo?.industry || 'Technology',
        existingBenefits: formData.benefits
      });
      
      setFormData(prev => ({ ...prev, benefits: response.data.benefits }));
      setPreviewMode(prev => ({ ...prev, benefits: true })); // Auto-switch to preview
      showToast('AI generated benefits!');
    } catch (error) {
      console.error('Error generating benefits:', error);
      showToast('Failed to generate benefits', 'error');
    } finally {
      setAiLoading(prev => ({ ...prev, benefits: false }));
      setShowAIProcessingModal(false);
    }
  };

  // AI Enhance All - Single button to enhance everything
  const handleAIEnhanceAll = async () => {
    if (!formData.title) {
      showToast('Please enter a job title first', 'error');
      return;
    }
    
    setAiLoading({ description: true, requirements: true, benefits: true, skills: true, title: false });
    setShowAIProcessingModal(true);
    setAIProcessingData({
      title: 'AI Enhancing Job Post',
      subtitle: 'AI is enhancing all sections of your job posting...',
      phase: 'Generating Complete Job Description',
      progress: 0
    });
    showToast('AI is enhancing your job posting...', 'success');
    
    try {
      // Run all AI calls in parallel
      const [descResponse, reqResponse, benefitsResponse, skillsResponse] = await Promise.all([
        jobAPI.aiGenerateDescription({
          title: formData.title,
          company: formData.company,
          department: formData.department,
          experienceLevel: formData.experienceLevel,
          locationType: formData.locationType,
          skills: formData.skills,
          notes: formData.requirements
        }),
        jobAPI.aiGenerateRequirements({
          title: formData.title,
          skills: formData.skills,
          experienceLevel: formData.experienceLevel,
          description: formData.description
        }),
        jobAPI.aiGenerateBenefits({
          company: formData.company,
          industry: companyInfo?.industry || 'Technology',
          existingBenefits: formData.benefits
        }),
        jobAPI.aiSuggestSkills({
          title: formData.title,
          industry: companyInfo?.industry || 'Technology'
        })
      ]);
      
      // Update all fields
      setFormData(prev => ({
        ...prev,
        description: descResponse.data.description,
        requirements: reqResponse.data.requirements,
        benefits: benefitsResponse.data.benefits
      }));
      
      // Set suggested skills
      setSuggestedSkills(skillsResponse.data);
      
      // Switch all to preview mode
      setPreviewMode({ description: true, requirements: true, benefits: true });
      
      showToast('AI enhanced all sections!', 'success');
    } catch (error) {
      console.error('Error enhancing job:', error);
      showToast('Failed to enhance some sections', 'error');
    } finally {
      setAiLoading({ description: false, requirements: false, benefits: false, skills: false, title: false });
      setShowAIProcessingModal(false);
    }
  };

  const isEnhancing = aiLoading.description || aiLoading.requirements || aiLoading.benefits || aiLoading.skills;
  
  const handleOpenModal = (job = null) => {
    // Reset AI states when opening modal
    setSuggestedSkills(null);
    setTitleSuggestions(null);
    setShowTitleDropdown(false);
    // Reset preview modes to edit by default
    setPreviewMode({ description: false, requirements: false, benefits: false });
    
    if (job) {
      setEditingJob(job);
      setFormData({
        title: job.title || '',
        company: job.company || '',
        location: job.location || '',
        locationType: job.locationType || 'onsite',
        employmentType: job.employmentType || 'full-time',
        experienceLevel: job.experienceLevel || 'mid',
        salaryMin: job.salaryMin || '',
        salaryMax: job.salaryMax || '',
        salaryCurrency: job.salaryCurrency || 'USD',
        salaryPeriod: job.salaryPeriod || 'yearly',
        description: job.description || '',
        requirements: job.requirements || '',
        benefits: job.benefits || '',
        skills: job.skills || [],
        department: job.department || '',
        status: job.status || 'active'
      });
    } else {
      setEditingJob(null);
      setFormData({
        title: '',
        company: companyInfo?.companyName || '',
        location: '',
        locationType: 'onsite',
        employmentType: 'full-time',
        experienceLevel: 'mid',
        salaryMin: '',
        salaryMax: '',
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
        description: '',
        requirements: '',
        benefits: '',
        skills: [],
        department: '',
        status: 'active'
      });
    }
    setShowModal(true);
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingJob(null);
    setSkillInput('');
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!formData.skills.includes(skillInput.trim())) {
        setFormData(prev => ({
          ...prev,
          skills: [...prev.skills, skillInput.trim()]
        }));
      }
      setSkillInput('');
    }
  };
  
  const handleRemoveSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };
  
  const handleSubmit = async () => {
    if (!formData.title || !formData.company || !formData.location || !formData.description) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const jobData = {
        ...formData,
        salaryMin: formData.salaryMin ? parseInt(formData.salaryMin) : null,
        salaryMax: formData.salaryMax ? parseInt(formData.salaryMax) : null,
        skipAutoScreening: true
      };

      if (editingJob) {
        await jobAPI.update(editingJob.id, jobData);
        showToast('Job updated successfully');
        handleCloseModal();
        fetchJobs();
      } else {
        // Create job without auto-screening
        const response = await jobAPI.create(jobData);
        const createdJob = response.data;
        
        // Store the job and show config modal
        setNewlyCreatedJob({
          id: createdJob.id,
          title: formData.title,
          company: formData.company,
          location: formData.location,
          skills: formData.skills,
          isNewlyCreated: true
        });
        
        handleCloseModal();
        fetchJobs();
        
        // Show the application form config modal first
        setShowApplicationFormConfig(true);
      }
    } catch (error) {
      console.error('Error saving job:', error);
      showToast(error.response?.data?.message || 'Failed to save job', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Open screening config modal for any job (new or existing)
  const handleOpenScreeningConfig = (job) => {
    setNewlyCreatedJob(job);
    setShowScreeningConfig(true);
  };

  // Handle re-running AI screening for a job that already has results
  const handleRerunScreening = (job) => {
    setRerunJob(job);
    setShowRerunConfirm(true);
  };

  const confirmRerunScreening = () => {
    if (rerunJob) {
      setShowRerunConfirm(false);
      handleOpenScreeningConfig(rerunJob);
      setRerunJob(null);
    }
  };

  // Handle opening candidate selection for search_complete jobs (after page refresh)
  const handleResumeSelection = (job) => {
    const status = screeningStatuses[job.id];
    if (status?.searchResults?.length > 0) {
      setNewlyCreatedJob(job);
      setSearchResults(status.searchResults);
      setShowCandidateSelection(true);
    } else {
      showToast('No search results found. Try re-running the screening.', 'error');
    }
  };
  
  // Handle AI screening configuration
  const handleStartScreening = async (config) => {
    if (!newlyCreatedJob) return;
    
    setStartingScreening(true);
    
    try {
      console.log('[Screening] Starting with config:', config);
      
      // Start screening with configuration
      const response = await jobAPI.startScreeningWithConfig(newlyCreatedJob.id, config);
      console.log('[Screening] API Response:', response.data);
      
      // Close the config modal
      setShowScreeningConfig(false);
      
      showToast('AI Screening started! Fetching live progress...', 'success');
      
      // Refresh jobs and immediately fetch screening status to show modal with real data
      await fetchJobs();
      
      // Immediately fetch screening status for this job to show the modal
      // The polling will continue to update it
      await fetchScreeningStatus(newlyCreatedJob.id);
      
    } catch (error) {
      console.error('[Screening] Error starting:', error);
      showToast(error.response?.data?.message || 'Failed to start AI screening', 'error');
      setShowAIProcessingModal(false);
    } finally {
      setStartingScreening(false);
    }
  };
  
  const handleSkipScreening = () => {
    setShowScreeningConfig(false);
    // Show import modal next (keep newlyCreatedJob for import)
    setShowImportModal(true);
  };
  
  // Handle candidate selection and start AI screening for selected
  const handleScreenSelected = async (selectedIds) => {
    if (!newlyCreatedJob || selectedIds.length === 0) return;
    
    console.log('[Screening] Starting AI screening for', selectedIds.length, 'selected candidates');
    
    try {
      // Close selection modal
      setShowCandidateSelection(false);
      
      // Show AI processing modal immediately
      setAIProcessingData({
        title: 'AI Screening Started',
        subtitle: `Screening ${selectedIds.length} selected candidates with AI agents`,
        phase: 'Phase 2: AI Screening',
        progress: 40,
        stats: {
          evaluated: 0,
          found: selectedIds.length,
          shortlisted: 0
        },
        type: 'screening'
      });
      setShowAIProcessingModal(true);
      
      // Start screening for selected candidates
      const response = await jobAPI.screenSelectedCandidates(newlyCreatedJob.id, selectedIds);
      console.log('[Screening] Started for selected:', response.data);
      
      showToast(`AI screening started for ${selectedIds.length} candidates!`, 'success');
      
      // Refresh to start polling
      await fetchJobs();
      await fetchScreeningStatus(newlyCreatedJob.id);
      
    } catch (error) {
      console.error('[Screening] Error starting for selected candidates:', error);
      showToast(error.response?.data?.message || 'Failed to start AI screening', 'error');
      setShowAIProcessingModal(false);
    }
  };
  
  const handleCloseImportModal = (importCompleted = false) => {
    const wasNewlyCreated = newlyCreatedJob?.isNewlyCreated;
    setShowImportModal(false);
    setNewlyCreatedJob(null);
    if (wasNewlyCreated) {
      showToast('Job posted successfully!', 'success');
    } else if (importCompleted) {
      showToast('Candidates imported successfully!', 'success');
      // Refresh jobs to update applicant counts
      fetchJobs();
    }
  };
  
  // Handle opening import modal for existing jobs
  const handleOpenImportModal = (job) => {
    console.log('Opening import modal for job:', job.title, 'showImportModal will be:', true);
    setNewlyCreatedJob({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      skills: job.skills || [],
      isNewlyCreated: false
    });
    setShowImportModal(true);
  };
  
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job posting?')) {
      return;
    }
    
    try {
      await jobAPI.delete(jobId);
      showToast('Job deleted successfully');
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      showToast('Failed to delete job', 'error');
    }
  };
  
  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await jobAPI.updateStatus(jobId, newStatus);
      showToast(`Job ${newStatus === 'active' ? 'activated' : newStatus}`);
      fetchJobs();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };
  
  const filteredJobs = activeTab === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === activeTab);
  
  const totalViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
  const totalApplications = jobs.reduce((sum, job) => sum + (job.applications || 0), 0);
  
  const formatSalary = (job) => {
    if (!job.salaryMin && !job.salaryMax) return null;
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
  
  const getStatusIcon = (status) => {
    switch(status) {
      case 'active': return <ActiveIcon style={{ fontSize: 14 }} />;
      case 'paused': return <PausedIcon style={{ fontSize: 14 }} />;
      case 'closed': return <ClosedIcon style={{ fontSize: 14 }} />;
      default: return null;
    }
  };

  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <HeaderLeft>
            <h1>Job Postings</h1>
            <p>Manage and track your job listings</p>
          </HeaderLeft>
          <PostJobButton onClick={() => handleOpenModal()}>
            <AddIcon />
            Post New Job
          </PostJobButton>
        </HeaderContent>
      </Header>
      
      <Content>
        <StatsGrid>
          <StatCard>
            <div className="stat-label">Active Jobs</div>
            <div className="stat-value">{jobCounts.active}</div>
          </StatCard>
          <StatCard>
            <div className="stat-label">Total Views</div>
            <div className="stat-value">{totalViews.toLocaleString()}</div>
          </StatCard>
          <StatCard>
            <div className="stat-label">Applications</div>
            <div className="stat-value">{totalApplications}</div>
          </StatCard>
          <StatCard>
            <div className="stat-label">Avg. Views/Job</div>
            <div className="stat-value">
              {jobCounts.active > 0 ? Math.round(totalViews / jobCounts.active) : 0}
            </div>
          </StatCard>
        </StatsGrid>
        
        <TabsContainer>
          <Tab $active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
            All Jobs
            <TabCount $active={activeTab === 'all'}>{jobCounts.all}</TabCount>
          </Tab>
          <Tab $active={activeTab === 'active'} onClick={() => setActiveTab('active')}>
            Active
            <TabCount $active={activeTab === 'active'}>{jobCounts.active}</TabCount>
          </Tab>
          <Tab $active={activeTab === 'paused'} onClick={() => setActiveTab('paused')}>
            Paused
            <TabCount $active={activeTab === 'paused'}>{jobCounts.paused}</TabCount>
          </Tab>
          <Tab $active={activeTab === 'closed'} onClick={() => setActiveTab('closed')}>
            Closed
            <TabCount $active={activeTab === 'closed'}>{jobCounts.closed}</TabCount>
          </Tab>
        </TabsContainer>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState>
            <WorkIcon />
            <h3>No jobs found</h3>
            <p>
              {activeTab === 'all' 
                ? "You haven't posted any jobs yet. Click 'Post New Job' to get started."
                : `No ${activeTab} jobs found.`}
            </p>
            {activeTab === 'all' && (
              <PostJobButton onClick={() => handleOpenModal()}>
                <AddIcon />
                Post Your First Job
              </PostJobButton>
            )}
          </EmptyState>
        ) : (
          <JobsList>
            {filteredJobs.map(job => (
              <JobCard key={job.id}>
                <JobHeader>
                  <JobInfo>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <JobTitle onClick={() => navigate(`/jobs/${job.id}`)}>
                        {job.title}
                      </JobTitle>
                      <StatusBadge $status={job.status}>
                        {getStatusIcon(job.status)}
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </StatusBadge>
                    </div>
                    <JobMeta>
                      <span><BusinessIcon /> {job.company}</span>
                      <span><LocationIcon /> {job.location}</span>
                      {formatSalary(job) && <span><SalaryIcon /> {formatSalary(job)}</span>}
                      <span><ScheduleIcon /> {job.employmentType?.replace('-', ' ')}</span>
                    </JobMeta>
                    {job.skills && job.skills.length > 0 && (
                      <SkillTags>
                        {job.skills.slice(0, 5).map((skill, idx) => (
                          <SkillTag key={idx}>{skill}</SkillTag>
                        ))}
                        {job.skills.length > 5 && (
                          <SkillTag>+{job.skills.length - 5} more</SkillTag>
                        )}
                      </SkillTags>
                    )}
                  </JobInfo>
                  <JobActions>
                    <ActionButton onClick={() => handleOpenModal(job)} title="Edit">
                      <EditIcon fontSize="small" />
                    </ActionButton>
                    <ActionButton 
                      className="delete" 
                      onClick={() => handleDeleteJob(job.id)}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </ActionButton>
                  </JobActions>
                </JobHeader>
                <JobStats>
                  <JobStat>
                    <ViewsIcon />
                    <strong>{job.views || 0}</strong> views
                  </JobStat>
                  <JobStat>
                    <ApplicantsIcon />
                    <strong>{job.applications || 0}</strong> applications
                  </JobStat>
                  <JobStat>
                    <ScheduleIcon />
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </JobStat>
                </JobStats>
                
                {/* Action Buttons Row */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {/* View Applications Button */}
                  <Tooltip 
                    title={`View ${job.applications || 0} applications submitted for this job`}
                    arrow
                    placement="top"
                  >
                    <ViewApplicationsButton 
                      onClick={() => navigate(`/recruiter/jobs/${job.id}/applications`)}
                      $hasApplications={(job.applications || 0) > 0}
                    >
                      <ApplicantsIcon />
                      View Applications {(job.applications || 0) > 0 && `(${job.applications})`}
                    </ViewApplicationsButton>
                  </Tooltip>
                  
                  {/* AI Screening - Show Start button when not started */}
                  {(!screeningStatuses[job.id] || screeningStatuses[job.id].status === 'not_started') && (
                    <Tooltip 
                      title="Launch AI-powered candidate search and screening. Our AI will automatically find, evaluate, and shortlist the best candidates for this position."
                      arrow
                      placement="top"
                    >
                      <StartScreeningButton 
                        onClick={() => handleOpenScreeningConfig(job)}
                        disabled={startingScreening}
                        style={{ marginTop: 0 }}
                      >
                        <AgentIcon /> Start AI Automation
                      </StartScreeningButton>
                    </Tooltip>
                  )}
                  
                  {/* Select Candidates button when search completed but screening not started */}
                  {screeningStatuses[job.id]?.status === 'search_complete' && (
                    <Tooltip
                      title={`Smart search found ${screeningStatuses[job.id].searchResults?.length || 0} candidates. Click to select which ones to screen with AI.`}
                      arrow
                      placement="top"
                    >
                      <StartScreeningButton
                        onClick={() => handleResumeSelection(job)}
                        style={{ marginTop: 0, background: '#e67e22' }}
                      >
                        <SearchIcon /> Select Candidates ({screeningStatuses[job.id].searchResults?.length || 0})
                      </StartScreeningButton>
                    </Tooltip>
                  )}
                  
                  {/* Re-run button for completed or failed screenings */}
                  {(screeningStatuses[job.id]?.status === 'completed' || screeningStatuses[job.id]?.status === 'failed') && (
                    <Tooltip
                      title="Re-run AI screening. You can view previous results in Agent Arena."
                      arrow
                      placement="top"
                    >
                      <StartScreeningButton
                        onClick={() => handleRerunScreening(job)}
                        disabled={startingScreening}
                        style={{ marginTop: 0, background: '#7f8c8d' }}
                      >
                        <RefreshIcon style={{ fontSize: 18 }} /> Re-run Screening
                      </StartScreeningButton>
                    </Tooltip>
                  )}
                  
                  {/* Application Form Config Button */}
                  <Tooltip 
                    title={job.applicationQuestions?.length > 0 
                      ? `${job.applicationQuestions.length} custom questions configured. Click to re-configure the application form.`
                      : "Configure a custom application form to collect specific information from candidates."
                    }
                    arrow
                    placement="top"
                  >
                    <FormConfigButton 
                      onClick={() => navigate(`/recruiter/jobs/${job.id}/application-form`)}
                    >
                      <DescriptionIcon />
                      Application Form
                    </FormConfigButton>
                  </Tooltip>
                  
                  {/* Import Candidates Button */}
                  <Tooltip 
                    title="Import candidates from CSV, LinkedIn URLs, or email lists to automatically add them to this job's applicant pool."
                    arrow
                    placement="top"
                  >
                    <span>
                      <ImportCandidatesButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenImportModal(job);
                        }}
                      >
                        <UploadIcon />
                        Import Candidates
                      </ImportCandidatesButton>
                    </span>
                  </Tooltip>
                </div>
                
                {/* AI Screening Status - When screening is active or completed */}
                {screeningStatuses[job.id] && screeningStatuses[job.id].status !== 'not_started' && (
                  <ScreeningSection>
                    <ScreeningHeader>
                      <ScreeningTitle>
                        <AgentIcon /> AI Candidate Screening
                      </ScreeningTitle>
                      <ScreeningStatusBadge $status={screeningStatuses[job.id].status}>
                        {screeningStatuses[job.id].status === 'pending' && <><PendingIcon /> Pending</>}
                        {screeningStatuses[job.id].status === 'searching' && <><SearchIcon /> Searching...</>}
                        {screeningStatuses[job.id].status === 'search_complete' && <><SearchIcon /> Selection Pending</>}
                        {screeningStatuses[job.id].status === 'screening' && <><AgentIcon /> Screening...</>}
                        {screeningStatuses[job.id].status === 'completed' && <><ActiveIcon /> Completed</>}
                        {screeningStatuses[job.id].status === 'failed' && <><ErrorIcon /> Failed</>}
                      </ScreeningStatusBadge>
                    </ScreeningHeader>
                    
                    {/* Phase 1: Smart Search in progress */}
                    {screeningStatuses[job.id].status === 'searching' && (
                      <ProgressContainer>
                        <ProgressText>
                          <strong>Phase 1: Smart Search</strong> - Finding matching candidates...
                        </ProgressText>
                        <ProgressBar>
                          <ProgressFill 
                            $percent={screeningStatuses[job.id].progressPercent || 20} 
                          />
                        </ProgressBar>
                        <ProgressText style={{ marginTop: 6, marginBottom: 0 }}>
                          Evaluated {screeningStatuses[job.id].totalCandidatesEvaluated || 0} candidates | 
                          Found {screeningStatuses[job.id].candidatesFound || 0} potential matches
                        </ProgressText>
                      </ProgressContainer>
                    )}
                    
                    {/* Phase 2: AI Screening in progress */}
                    {screeningStatuses[job.id].status === 'screening' && (
                      <ProgressContainer>
                        <ProgressText>
                          <strong>Phase 2: AI Agent Screening</strong> - {screeningStatuses[job.id].currentStep || 'Analyzing candidates...'}
                        </ProgressText>
                        <ProgressBar>
                          <ProgressFill 
                            $percent={
                              screeningStatuses[job.id].candidatesFound > 0 
                                ? (screeningStatuses[job.id].candidatesScreened / screeningStatuses[job.id].candidatesFound) * 100 
                                : 0
                            } 
                          />
                        </ProgressBar>
                        <ProgressText style={{ marginTop: 6, marginBottom: 0 }}>
                          {screeningStatuses[job.id].candidatesScreened || 0} / {screeningStatuses[job.id].candidatesFound || 0} candidates screened by AI
                        </ProgressText>
                      </ProgressContainer>
                    )}
                    
                    {/* Pending state */}
                    {screeningStatuses[job.id].status === 'pending' && (
                      <ProgressContainer>
                        <ProgressText>
                          Waiting to start recruitment process...
                        </ProgressText>
                        <ProgressBar>
                          <ProgressFill $percent={0} />
                        </ProgressBar>
                      </ProgressContainer>
                    )}
                    
                    {/* Search Complete: waiting for candidate selection */}
                    {screeningStatuses[job.id].status === 'search_complete' && (
                      <ProgressContainer>
                        <ProgressText>
                          <strong>Smart Search Complete</strong>, Found {screeningStatuses[job.id].candidatesFound || screeningStatuses[job.id].searchResults?.length || 0} candidates.
                          Select candidates above to start AI screening.
                        </ProgressText>
                        <ProgressBar>
                          <ProgressFill $percent={30} />
                        </ProgressBar>
                      </ProgressContainer>
                    )}
                    
                    {screeningStatuses[job.id].status === 'failed' && screeningStatuses[job.id].errorMessage && (
                      <ScreeningError>
                        <ErrorIcon /> {screeningStatuses[job.id].errorMessage}
                      </ScreeningError>
                    )}
                    
                    {screeningStatuses[job.id].status === 'completed' && (
                      <ShortlistedCandidates>
                        <ShortlistedLabel>
                          Shortlisted Candidates ({screeningStatuses[job.id].shortlisted?.length || 0})
                        </ShortlistedLabel>
                        {screeningStatuses[job.id].shortlisted && screeningStatuses[job.id].shortlisted.length > 0 ? (
                          screeningStatuses[job.id].shortlisted.map((candidate, idx) => (
                            <CandidateRow key={candidate.candidateId || idx}>
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
                                <ScorePill $type="fit">{candidate.fitScore || 0}% fit</ScorePill>
                                <ScorePill $type="interest">{candidate.interestScore || 0}% interest</ScorePill>
                              </CandidateScores>
                              <CandidateActions>
                                <CandidateActionBtn 
                                  title="View Profile"
                                  onClick={() => navigate(`/profile/${candidate.candidateId}`)}
                                >
                                  <PersonIcon />
                                </CandidateActionBtn>
                                <CandidateActionBtn 
                                  title="Send Message"
                                  onClick={() => navigate(`/messages?userId=${candidate.candidateId}`)}
                                >
                                  <MessageIcon />
                                </CandidateActionBtn>
                                <CandidateActionBtn 
                                  title="Schedule Interview"
                                  onClick={() => navigate(`/recruiter/schedule-interview?candidateId=${candidate.candidateId}&jobId=${job.id}`)}
                                >
                                  <CalendarIcon />
                                </CandidateActionBtn>
                              </CandidateActions>
                            </CandidateRow>
                          ))
                        ) : (
                          <NoShortlist>
                            No candidates were shortlisted for this position.
                          </NoShortlist>
                        )}
                      </ShortlistedCandidates>
                    )}
                  </ScreeningSection>
                )}
              </JobCard>
            ))}
          </JobsList>
        )}
      </Content>
      
      {/* Post/Edit Job Modal */}
      {showModal && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <Modal>
            <ModalHeader>
              <h2>{editingJob ? 'Edit Job' : 'Post New Job'}</h2>
              <CloseButton onClick={handleCloseModal}>
                <CloseIcon />
              </CloseButton>
            </ModalHeader>
            
            <ModalBody>
              <FormGrid>
                <FormGroupRelative $fullWidth>
                  <label>Job Title <span className="required">*</span></label>
                  <Input
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Senior Product Designer"
                    onFocus={() => setShowTitleDropdown(false)}
                  />
                  {showTitleDropdown && titleSuggestions && titleSuggestions.length > 0 && (
                    <TitleSuggestionDropdown>
                      {titleSuggestions.map((suggestion, idx) => (
                        <TitleSuggestionItem 
                          key={idx}
                          onClick={() => handleSelectTitle(suggestion.title)}
                        >
                          <div className="title">{suggestion.title}</div>
                          <div className="reason">{suggestion.reason}</div>
                        </TitleSuggestionItem>
                      ))}
                    </TitleSuggestionDropdown>
                  )}
                </FormGroupRelative>
                
                <FormGroup>
                  <label>Company <span className="required">*</span></label>
                  <Input
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Your company name"
                  />
                </FormGroup>
                
                <FormGroup>
                  <label>Department</label>
                  <Input
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    placeholder="e.g. Sales, Marketing, Operations, HR, Finance"
                  />
                </FormGroup>
                
                <FormGroup>
                  <label>Location <span className="required">*</span></label>
                  <Input
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. San Francisco, CA"
                  />
                </FormGroup>
                
                <FormGroup>
                  <label>Location Type</label>
                  <Select
                    name="locationType"
                    value={formData.locationType}
                    onChange={handleInputChange}
                  >
                    <option value="onsite">On-site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </Select>
                </FormGroup>
                
                <FormGroup>
                  <label>Employment Type</label>
                  <Select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleInputChange}
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="freelance">Freelance</option>
                  </Select>
                </FormGroup>
                
                <FormGroup>
                  <label>Experience Level</label>
                  <Select
                    name="experienceLevel"
                    value={formData.experienceLevel}
                    onChange={handleInputChange}
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="lead">Lead / Manager</option>
                    <option value="executive">Executive</option>
                  </Select>
                </FormGroup>
                
                <FormGroup $fullWidth>
                  <label>Salary Range</label>
                  <SalaryGroup>
                    <Select
                      name="salaryCurrency"
                      value={formData.salaryCurrency}
                      onChange={handleInputChange}
                      style={{ width: '100px' }}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </Select>
                    <Input
                      name="salaryMin"
                      type="number"
                      value={formData.salaryMin}
                      onChange={handleInputChange}
                      placeholder="Min"
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: '#64748b' }}>to</span>
                    <Input
                      name="salaryMax"
                      type="number"
                      value={formData.salaryMax}
                      onChange={handleInputChange}
                      placeholder="Max"
                      style={{ flex: 1 }}
                    />
                    <Select
                      name="salaryPeriod"
                      value={formData.salaryPeriod}
                      onChange={handleInputChange}
                      style={{ width: '120px' }}
                    >
                      <option value="yearly">per year</option>
                      <option value="monthly">per month</option>
                      <option value="hourly">per hour</option>
                    </Select>
                  </SalaryGroup>
                </FormGroup>
                
                <FormGroup $fullWidth>
                  <label>Job Description <span className="required">*</span></label>
                  <RichTextContainer>
                    <RichTextToggle>
                      <ToggleButton 
                        $active={!previewMode.description}
                        onClick={() => setPreviewMode(prev => ({ ...prev, description: false }))}
                      >
                        Edit
                      </ToggleButton>
                      <ToggleButton 
                        $active={previewMode.description}
                        onClick={() => setPreviewMode(prev => ({ ...prev, description: true }))}
                      >
                        Preview
                      </ToggleButton>
                    </RichTextToggle>
                    {previewMode.description ? (
                      <RichTextPreview>
                        {renderFormattedContent(formData.description, 'No description yet...')}
                      </RichTextPreview>
                    ) : (
                      <Textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Describe the role, responsibilities, and what makes this opportunity exciting..."
                        rows={5}
                        style={{ paddingTop: '40px' }}
                      />
                    )}
                  </RichTextContainer>
                </FormGroup>
                
                <FormGroup $fullWidth>
                  <label>Requirements</label>
                  <RichTextContainer>
                    <RichTextToggle>
                      <ToggleButton 
                        $active={!previewMode.requirements}
                        onClick={() => setPreviewMode(prev => ({ ...prev, requirements: false }))}
                      >
                        Edit
                      </ToggleButton>
                      <ToggleButton 
                        $active={previewMode.requirements}
                        onClick={() => setPreviewMode(prev => ({ ...prev, requirements: true }))}
                      >
                        Preview
                      </ToggleButton>
                    </RichTextToggle>
                    {previewMode.requirements ? (
                      <RichTextPreview>
                        {renderFormattedContent(formData.requirements, 'No requirements yet...')}
                      </RichTextPreview>
                    ) : (
                      <Textarea
                        name="requirements"
                        value={formData.requirements}
                        onChange={handleInputChange}
                        placeholder="List the qualifications, skills, and experience required..."
                        rows={4}
                        style={{ paddingTop: '40px' }}
                      />
                    )}
                  </RichTextContainer>
                </FormGroup>
                
                <FormGroup $fullWidth>
                  <label>Benefits</label>
                  <RichTextContainer>
                    <RichTextToggle>
                      <ToggleButton 
                        $active={!previewMode.benefits}
                        onClick={() => setPreviewMode(prev => ({ ...prev, benefits: false }))}
                      >
                        Edit
                      </ToggleButton>
                      <ToggleButton 
                        $active={previewMode.benefits}
                        onClick={() => setPreviewMode(prev => ({ ...prev, benefits: true }))}
                      >
                        Preview
                      </ToggleButton>
                    </RichTextToggle>
                    {previewMode.benefits ? (
                      <RichTextPreview>
                        {renderFormattedContent(formData.benefits, 'No benefits listed yet...')}
                      </RichTextPreview>
                    ) : (
                      <Textarea
                        name="benefits"
                        value={formData.benefits}
                        onChange={handleInputChange}
                        placeholder="List perks and benefits (health insurance, PTO, etc.)..."
                        rows={3}
                        style={{ paddingTop: '40px' }}
                      />
                    )}
                  </RichTextContainer>
                </FormGroup>
                
                <FormGroup $fullWidth>
                  <label>Skills (press Enter to add)</label>
                  <SkillsInput onClick={() => document.getElementById('skill-input').focus()}>
                    {formData.skills.map((skill, idx) => (
                      <SkillChip key={idx}>
                        {skill}
                        <button type="button" onClick={() => handleRemoveSkill(skill)}>×</button>
                      </SkillChip>
                    ))}
                    <SkillInputField
                      id="skill-input"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={handleAddSkill}
                      placeholder={formData.skills.length === 0 ? "Type a skill and press Enter..." : ""}
                    />
                  </SkillsInput>
                  {suggestedSkills && (
                    <SuggestionChips>
                      <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '500', width: '100%', marginBottom: '4px' }}>
                        Click to add suggested skills:
                      </span>
                      {suggestedSkills.required && suggestedSkills.required.map((skill, idx) => (
                        <SuggestionChip 
                          key={`req-${idx}`}
                          onClick={() => handleAddSuggestedSkill(skill)}
                          style={{ borderColor: '#10b981', color: '#10b981' }}
                        >
                          ✓ {skill}
                        </SuggestionChip>
                      ))}
                      {suggestedSkills.preferred && suggestedSkills.preferred.map((skill, idx) => (
                        <SuggestionChip 
                          key={`pref-${idx}`}
                          onClick={() => handleAddSuggestedSkill(skill)}
                        >
                          {skill}
                        </SuggestionChip>
                      ))}
                      {suggestedSkills.soft && suggestedSkills.soft.map((skill, idx) => (
                        <SuggestionChip 
                          key={`soft-${idx}`}
                          onClick={() => handleAddSuggestedSkill(skill)}
                          style={{ borderColor: '#6d28d9', color: '#6d28d9' }}
                        >
                          💡 {skill}
                        </SuggestionChip>
                      ))}
                    </SuggestionChips>
                  )}
                </FormGroup>
                
                <FormGroup>
                  <label>Status</label>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                  </Select>
                </FormGroup>
              </FormGrid>
            </ModalBody>
            
            <ModalFooter>
              <Button onClick={handleCloseModal}>Cancel</Button>
              <AIButton 
                onClick={handleAIEnhanceAll}
                disabled={!formData.title || isEnhancing}
                $loading={isEnhancing}
                style={{ padding: '12px 20px', fontSize: '14px' }}
              >
                <AIIcon /> {isEnhancing ? 'Enhancing...' : 'AI Enhance All'}
              </AIButton>
              <Button $primary onClick={handleSubmit} disabled={submitting || isEnhancing}>
                {submitting ? 'Saving...' : editingJob ? 'Update Job' : 'Post Job'}
              </Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}
      
      {/* Application Form Configuration Modal */}
      {showApplicationFormConfig && newlyCreatedJob && (
        <ModalOverlay onClick={() => setShowApplicationFormConfig(false)}>
          <Modal onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <ModalHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <DescriptionIcon style={{ color: '#7c3aed', fontSize: '28px' }} />
                <div>
                  <h2>Configure Application Form</h2>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' }}>
                    Choose what information to collect from applicants
                  </p>
                </div>
              </div>
              <CloseButton onClick={() => setShowApplicationFormConfig(false)}>
                <CloseIcon />
              </CloseButton>
            </ModalHeader>
            
            <ModalBody>
              <InfoBox style={{ marginBottom: '24px' }}>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                  You can configure a custom application form to collect specific information from candidates. 
                  This step is optional - you can set it up now or configure it later from the job details page.
                </p>
              </InfoBox>

              <FeatureList>
                <FeatureItem>
                  <CheckIcon />
                  <div>
                    <strong>Pre-built Templates</strong>
                    <p>Choose from Basic, Standard, or Tech Role templates</p>
                  </div>
                </FeatureItem>
                <FeatureItem>
                  <CheckIcon />
                  <div>
                    <strong>Custom Questions</strong>
                    <p>Add your own questions and required fields</p>
                  </div>
                </FeatureItem>
                <FeatureItem>
                  <CheckIcon />
                  <div>
                    <strong>File Uploads</strong>
                    <p>Collect resumes, portfolios, and other documents</p>
                  </div>
                </FeatureItem>
              </FeatureList>
            </ModalBody>
            
            <ModalFooter>
              <Button 
                onClick={() => {
                  setShowApplicationFormConfig(false);
                  // Show AI screening config next
                  setShowScreeningConfig(true);
                }}
              >
                Skip for Now
              </Button>
              <Button 
                $primary 
                onClick={() => {
                  setShowApplicationFormConfig(false);
                  // TODO: Navigate to application form builder
                  navigate(`/recruiter/jobs/${newlyCreatedJob.id}/application-form`);
                }}
              >
                Configure Now
              </Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}
      
      {/* AI Screening Configuration Modal */}
      <AIScreeningConfigModal
        open={showScreeningConfig}
        onClose={handleSkipScreening}
        jobData={newlyCreatedJob}
        onStartScreening={handleStartScreening}
        loading={startingScreening}
      />
      
      {/* AI Processing Modal */}
      <AIProcessingModal
        open={showAIProcessingModal}
        onClose={() => setShowAIProcessingModal(false)}
        title={aiProcessingData.title}
        subtitle={aiProcessingData.subtitle}
        progress={aiProcessingData.progress}
        stats={aiProcessingData.stats}
        type={aiProcessingData.type}
      />
      
      {/* Candidate Selection Modal (after Smart Search) */}
      <CandidateSelectionModal
        open={showCandidateSelection}
        onClose={() => setShowCandidateSelection(false)}
        candidates={searchResults}
        onStartScreening={handleScreenSelected}
        jobTitle={newlyCreatedJob?.title || ''}
      />
      
      {/* Import Candidates Modal */}
      {showImportModal && newlyCreatedJob && (
        <ImportCandidatesModal
          isOpen={showImportModal}
          onClose={() => handleCloseImportModal(false)}
          jobId={newlyCreatedJob.id}
          jobTitle={newlyCreatedJob.title}
        />
      )}
      
      {toast && (
        <Toast $type={toast.type}>{toast.message}</Toast>
      )}
      
      {/* Re-run Screening Confirmation Modal */}
      {showRerunConfirm && rerunJob && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowRerunConfirm(false)}>
          <ConfirmModal>
            <ConfirmHeader>
              <div className="icon-wrapper">
                <RefreshIcon />
              </div>
              <h3>Re-run AI Screening</h3>
            </ConfirmHeader>
            <ConfirmBody>
              <p>
                This will start a fresh AI-powered candidate search for <strong>{rerunJob.title}</strong>. 
                The new screening will replace the current results.
              </p>
              {screeningStatuses[rerunJob.id]?.shortlisted?.length > 0 && (
                <div className="info-box">
                  <AgentIcon />
                  <span>
                    You have <strong>{screeningStatuses[rerunJob.id].shortlisted.length} shortlisted candidate(s)</strong> from the previous run. 
                    Previous results are still available in <strong>Agent Arena</strong>.
                  </span>
                </div>
              )}
            </ConfirmBody>
            <ConfirmFooter>
              <button type="button" className="cancel-btn" onClick={() => setShowRerunConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="confirm-btn" onClick={confirmRerunScreening}>
                <RefreshIcon style={{ fontSize: 16 }} /> Re-run Screening
              </button>
            </ConfirmFooter>
          </ConfirmModal>
        </ModalOverlay>
      )}
    </PageContainer>
  );
};

export default RecruiterJobs;
