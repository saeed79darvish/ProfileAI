import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Psychology as AIIcon,
  AutoAwesome as EnhanceIcon,
  TrendingUp as AnalyzeIcon,
  Tune as TailorIcon,
  Key as KeywordIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  School as SchoolIcon,
  ContentCopy as CopyIcon,
  LightbulbOutlined as TipIcon,
  Description as CoverLetterIcon
} from '@mui/icons-material';
import { CircularProgress, Tooltip, Chip, LinearProgress, Dialog, DialogContent, DialogActions, Button } from '@mui/material';
import { profileAPI, tailoredProfileAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import GapReviewDialog from './GapReviewDialog';
import UpgradeModal from './UpgradeModal';
import TailorSettingsModal from './TailorSettingsModal';
import TailoringProgressModal from './TailoringProgressModal';
import TailoredResultsModal from './TailoredResultsModal';
import ResumePreviewModal from './ResumePreviewModal';
import CoverLetterModal from './CoverLetterModal';
import JobMatchAnalysis from './JobMatchAnalysis';

// === Animations ===
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

// === Styled Components ===
const PanelContainer = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  margin-top: 24px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease;
`;

const PanelHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
`;

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  
  svg { font-size: 24px; }
`;

const PanelSubtitle = styled.div`
  font-size: 13px;
  opacity: 0.85;
  margin-top: 2px;
`;

const ToolsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ToolCard = styled.button`
  background: ${props => props.$active ? 'linear-gradient(135deg, #667eea08 0%, #764ba210 100%)' : '#fafbfc'};
  border: 2px solid ${props => props.$active ? '#667eea' : '#e5e7eb'};
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &:hover:not(:disabled) {
    border-color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.15);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ToolIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  background: ${props => props.$gradient || 'linear-gradient(135deg, #667eea, #764ba2)'};
  color: white;
  
  svg { font-size: 22px; }
`;

const ToolName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 6px;
`;

const ToolDesc = styled.div`
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  z-index: 2;
`;

const LoadingText = styled.div`
  font-size: 12px;
  color: #667eea;
  animation: ${pulse} 1.5s infinite;
`;

const ResultsContainer = styled.div`
  padding: 0 24px 24px;
  animation: ${fadeIn} 0.3s ease;
`;

const ResultCard = styled.div`
  background: #fafbfc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
`;

const ResultHeader = styled.div`
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  background: white;
`;

const ResultTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  
  svg { font-size: 20px; color: #667eea; }
`;

const ResultActions = styled.div`
  display: flex;
  gap: 8px;
`;

const SmallButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid ${props => props.$primary ? 'transparent' : '#d1d5db'};
  background: ${props => props.$primary ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'white'};
  color: ${props => props.$primary ? 'white' : '#374151'};
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => props.$primary ? '0 4px 12px rgba(102,126,234,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'};
  }
  
  svg { font-size: 14px; }
`;

const ResultBody = styled.div`
  padding: 20px;
`;

// === Score Components ===
const ScoreCircle = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  background: ${props => {
    if (props.$score >= 80) return 'linear-gradient(135deg, #10b981, #059669)';
    if (props.$score >= 60) return 'linear-gradient(135deg, #f59e0b, #d97706)';
    return 'linear-gradient(135deg, #ef4444, #dc2626)';
  }};
  color: white;
  margin: 0 auto 12px;
`;

const ScoreLabel = styled.div`
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
`;

const GapList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const GapItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  
  svg {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 18px;
  }
`;

const GapInfo = styled.div`
  flex: 1;
  
  .gap-skill { font-weight: 600; font-size: 14px; color: #1a1a2e; }
  .gap-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }
`;

const SeverityChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    if (props.$severity === 'critical') return '#fee2e2';
    if (props.$severity === 'important') return '#fef3c7';
    return '#dbeafe';
  }};
  color: ${props => {
    if (props.$severity === 'critical') return '#dc2626';
    if (props.$severity === 'important') return '#d97706';
    return '#2563eb';
  }};
`;

// === Keyword Components ===
const KeywordSection = styled.div`
  margin-top: 16px;
  
  &:first-child { margin-top: 0; }
`;

const KeywordSectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const KeywordTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const KeywordTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => props.$matched ? '#d1fae5' : props.$missing ? '#fee2e2' : '#ede9fe'};
  color: ${props => props.$matched ? '#065f46' : props.$missing ? '#991b1b' : '#5b21b6'};
`;

const SuggestionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const SuggestionItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid #e5e7eb;
`;

const SuggestionInfo = styled.div`
  flex: 1;
  
  .keyword { font-weight: 600; font-size: 14px; color: #1a1a2e; }
  .section { font-size: 11px; color: #667eea; font-weight: 500; text-transform: uppercase; }
  .reason { font-size: 12px; color: #6b7280; margin-top: 2px; }
`;

const PriorityBadge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    if (props.$priority === 'high') return '#fee2e2';
    if (props.$priority === 'medium') return '#fef3c7';
    return '#dbeafe';
  }};
  color: ${props => {
    if (props.$priority === 'high') return '#dc2626';
    if (props.$priority === 'medium') return '#d97706';
    return '#2563eb';
  }};
`;

const TipsList = styled.div`
  margin-top: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea08, #764ba208);
  border-radius: 8px;
  border-left: 3px solid #667eea;
`;

const TipItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  
  svg { font-size: 16px; color: #667eea; flex-shrink: 0; margin-top: 2px; }
`;

// === Enhancement Result ===
const EnhancementSection = styled.div`
  margin-top: 16px;
  
  &:first-child { margin-top: 0; }
`;

const EnhancementLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
`;

const EnhancementContent = styled.div`
  padding: 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #1a1a2e;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const DiffHighlight = styled.span`
  background: #d1fae5;
  padding: 0 2px;
  border-radius: 2px;
`;

// === Tailoring Result Styles ===
const TailoredSection = styled.div`
  margin-bottom: 20px;
`;

const TailoredSectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TailoredContent = styled.div`
  padding: 12px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
`;

const SkillChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const MatchBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => {
    if (props.$score >= 80) return 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
    if (props.$score >= 60) return 'linear-gradient(135deg, #fef3c7, #fde68a)';
    return 'linear-gradient(135deg, #fee2e2, #fecaca)';
  }};
  color: ${props => {
    if (props.$score >= 80) return '#065f46';
    if (props.$score >= 60) return '#92400e';
    return '#991b1b';
  }};
  margin-bottom: 16px;
`;

const NoProfileMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: #6b7280;
  
  a {
    color: #667eea;
    font-weight: 500;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
  margin: 16px 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { font-size: 18px; }
`;

// Normalize skills: could be string[], or { category: string[] } object
const flattenSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'object') return Object.values(skills).flat();
  return [];
};

// === Main Component ===
export default function JobAIToolsPanel({ job }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState(null);
  
  // Analysis state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // Tailoring state
  const [tailorLoading, setTailorLoading] = useState(false);
  const [showGapReview, setShowGapReview] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState([]);
  const [satisfiedAlternatives, setSatisfiedAlternatives] = useState([]);
  const [tailoredProfile, setTailoredProfile] = useState(null);
  const [savingTailored, setSavingTailored] = useState(false);
  const [tailorSaved, setTailorSaved] = useState(false);
  
  // Enhancement state
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState(null);
  
  // Keyword state
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [keywordResult, setKeywordResult] = useState(null);
  
  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [rateLimitFeature, setRateLimitFeature] = useState('');

  // New modal states
  const [showTailorSettings, setShowTailorSettings] = useState(false);
  const [showTailoringProgress, setShowTailoringProgress] = useState(false);
  const [showTailoredResults, setShowTailoredResults] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [tailorSettings, setTailorSettings] = useState(null);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await profileAPI.getMyProfile();
        setProfile(response.data);
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Error fetching profile:', err);
        }
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };
    
    if (user && user.role === 'candidate') {
      fetchProfile();
    } else {
      setProfileLoading(false);
    }
  }, [user]);

  // Build job description text from job data
  const getJobDescription = useCallback(() => {
    const parts = [
      `Job Title: ${job.title}`,
      `Company: ${job.company}`,
      job.location ? `Location: ${job.location}` : '',
      job.locationType ? `Work Type: ${job.locationType}` : '',
      job.employmentType ? `Employment: ${job.employmentType}` : '',
      job.experienceLevel ? `Level: ${job.experienceLevel}` : '',
      job.skills?.length ? `Required Skills: ${job.skills.join(', ')}` : '',
      job.description ? `\nDescription:\n${job.description}` : '',
      job.requirements ? `\nRequirements:\n${job.requirements}` : '',
      job.benefits ? `\nBenefits:\n${job.benefits}` : '',
    ];
    return parts.filter(Boolean).join('\n');
  }, [job]);

  // Build profile data structure
  const getProfileData = useCallback(() => {
    if (!profile) return null;
    return {
      title: profile.title || '',
      summary: profile.summary || '',
      skills: profile.skills || [],
      experience: profile.experience || [],
      education: profile.education || [],
      projects: profile.projects || [],
      certifications: profile.certifications || [],
    };
  }, [profile]);

  const handleRateLimit = (err) => {
    if (err.response?.status === 429) {
      setRateLimitFeature(err.response?.data?.feature || 'profile_enhance');
      setShowUpgradeModal(true);
      return true;
    }
    return false;
  };

  // === Tool 1: Match Analysis ===
  const handleAnalyze = async () => {
    setError('');
    setActiveTool('analysis');
    setAnalysisLoading(true);
    
    try {
      const profileData = getProfileData();
      const jobDescription = getJobDescription();
      
      const response = await profileAPI.analyzeGaps({ profileData, jobDescription });
      
      if (response.data.success) {
        setAnalysisResult({
          gaps: response.data.gaps || [],
          satisfiedAlternatives: response.data.satisfiedAlternatives || [],
        });
      } else {
        setError('Failed to analyze profile match');
      }
    } catch (err) {
      if (!handleRateLimit(err)) {
        setError(err.response?.data?.error || 'Error analyzing profile match');
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  // === Tool 2: Profile Tailoring ===
  const handleTailor = async () => {
    setShowTailorSettings(true);
  };

  const handleTailorSettingsContinue = async (settings) => {
    setShowTailorSettings(false);
    setTailorSettings(settings);
    setError('');
    setActiveTool('tailor');
    setTailorLoading(true);
    setTailoredProfile(null);
    setTailorSaved(false);
    setShowTailoringProgress(true);
    
    try {
      const profileData = getProfileData();
      const jobDescription = getJobDescription();
      
      const response = await profileAPI.analyzeGaps({ profileData, jobDescription });
      
      if (response.data.success && response.data.gaps?.length > 0) {
        setShowTailoringProgress(false);
        setDetectedGaps(response.data.gaps);
        setSatisfiedAlternatives(response.data.satisfiedAlternatives || []);
        setShowGapReview(true);
      } else {
        // No gaps, proceed directly
        await doTailoring(profileData, jobDescription, null, settings);
        setShowTailoringProgress(false);
        setShowResumePreview(true);
      }
    } catch (err) {
      if (!handleRateLimit(err)) {
        try {
          await doTailoring(getProfileData(), getJobDescription(), null, settings);
          setShowTailoringProgress(false);
          setShowResumePreview(true);
        } catch (err2) {
          setShowTailoringProgress(false);
          if (!handleRateLimit(err2)) {
            setError(err2.response?.data?.error || 'Error tailoring profile');
          }
        }
      }
    } finally {
      setTailorLoading(false);
    }
  };

  const handleGapReviewContinue = async (selections) => {
    setShowGapReview(false);
    setTailorLoading(true);
    setShowTailoringProgress(true);
    
    const gapSelections = {
      acceptedGaps: selections.acceptedGaps,
      skippedGaps: selections.skippedGaps,
      acceptedGapObjects: selections.acceptedGapObjects
    };
    
    try {
      await doTailoring(getProfileData(), getJobDescription(), gapSelections, tailorSettings);
      setShowTailoringProgress(false);
      setShowResumePreview(true);
    } catch (err) {
      setShowTailoringProgress(false);
      if (!handleRateLimit(err)) {
        setError(err.response?.data?.error || 'Error tailoring profile');
      }
    } finally {
      setTailorLoading(false);
    }
  };

  const doTailoring = async (profileData, jobDescription, gapSelections, settings) => {
    const response = await profileAPI.tailorProfileForJob({
      profileData,
      jobDescription,
      gapSelections,
      tailorSettings: settings
    });
    
    if (response.data.success) {
      const tailored = response.data.data;
      if (gapSelections?.acceptedGapObjects) {
        tailored._skillGaps = gapSelections.acceptedGapObjects;
        tailored._learningPlan = {
          acceptedGaps: gapSelections.acceptedGaps || [],
          skippedGaps: gapSelections.skippedGaps || [],
          createdAt: new Date().toISOString()
        };
      }
      setTailoredProfile(tailored);
    } else {
      setError('Failed to tailor profile');
    }
  };

  const handleSaveTailoredProfile = async () => {
    if (!tailoredProfile) return;
    setSavingTailored(true);
    
    try {
      await tailoredProfileAPI.save({
        jobTitle: job.title,
        companyName: job.company,
        tailoredData: tailoredProfile,
        originalProfileSnapshot: getProfileData(),
        matchScore: tailoredProfile.matchAnalysis?.overallScore || null,
        skillGaps: (tailoredProfile._skillGaps || []).map(g => ({
          ...g,
          status: 'pending'
        })),
        learningPlan: tailoredProfile._learningPlan || null,
      });
      setTailorSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving tailored profile');
    } finally {
      setSavingTailored(false);
    }
  };

  // === Tool 3: AI Enhancement ===
  const handleEnhance = async () => {
    setError('');
    setActiveTool('enhance');
    setEnhanceLoading(true);
    
    try {
      const profileData = getProfileData();
      const jobDescription = getJobDescription();
      const customPrompt = `Enhance this profile to be a strong match for this job:\n${jobDescription.substring(0, 1500)}`;
      
      const response = await profileAPI.enhanceResumeData(profileData, customPrompt);
      
      if (response.data.success) {
        setEnhanceResult(response.data.data);
      } else {
        setError('Failed to enhance profile');
      }
    } catch (err) {
      if (!handleRateLimit(err)) {
        setError(err.response?.data?.error || 'Error enhancing profile');
      }
    } finally {
      setEnhanceLoading(false);
    }
  };

  // === Tool 4: Keyword Optimization ===
  const handleKeywords = async () => {
    setError('');
    setActiveTool('keywords');
    setKeywordLoading(true);
    
    try {
      const profileData = getProfileData();
      const jobDescription = getJobDescription();
      
      const response = await profileAPI.keywordOptimization({ profileData, jobDescription });
      
      if (response.data.success) {
        setKeywordResult(response.data.data);
      } else {
        setError('Failed to analyze keywords');
      }
    } catch (err) {
      if (!handleRateLimit(err)) {
        setError(err.response?.data?.error || 'Error analyzing keywords');
      }
    } finally {
      setKeywordLoading(false);
    }
  };

  // Don't show panel for recruiters or non-logged-in users
  if (!user || user.role !== 'candidate') return null;

  // === Cover Letter (modal) ===
  const handleCoverLetter = () => {
    setShowCoverLetterModal(true);
  };

  const handleGenerateCoverLetter = async ({ tone, lines }) => {
    try {
      const res = await profileAPI.generateCoverLetter({
        jobTitle: job.title,
        company: job.company,
        jobDescription: getJobDescription(),
        profile: getProfileData(),
        tone,
        lines,
      });
      if (res.data.success) return res.data.coverLetter;
      throw new Error('Failed to generate cover letter');
    } catch (err) {
      if (handleRateLimit(err)) return '';
      throw err;
    }
  };

  // === Match Analysis (inline) ===
  const handleMatchAnalyze = async () => {
    const res = await profileAPI.keywordOptimization({ profileData: getProfileData(), jobDescription: getJobDescription() });
    if (res.data.success) return res.data.data;
    throw new Error('Failed to analyze match');
  };
  
  if (profileLoading) {
    return (
      <PanelContainer>
        <PanelHeader>
          <div>
            <PanelTitle><AIIcon /> AI Profile Tools</PanelTitle>
            <PanelSubtitle>Loading your profile...</PanelSubtitle>
          </div>
        </PanelHeader>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <CircularProgress size={32} />
        </div>
      </PanelContainer>
    );
  }

  if (!profile) {
    return (
      <PanelContainer>
        <PanelHeader>
          <div>
            <PanelTitle><AIIcon /> AI Profile Tools</PanelTitle>
            <PanelSubtitle>Optimize your profile for this job</PanelSubtitle>
          </div>
        </PanelHeader>
        <NoProfileMessage>
          <p>Create your profile to unlock AI analytics & Resume Tailoring tools for this job and a personalized experience.</p>
          <p><a href="/profile/create">Create Profile →</a></p>
        </NoProfileMessage>
      </PanelContainer>
    );
  }

  const isAnyLoading = analysisLoading || tailorLoading || enhanceLoading || keywordLoading;

  return (
    <>
      <PanelContainer>
        <PanelHeader>
          <div>
            <PanelTitle><AIIcon /> AI Profile Tools</PanelTitle>
            <PanelSubtitle>Optimize your profile for {job.title} at {job.company}</PanelSubtitle>
          </div>
        </PanelHeader>
        
        <ToolsGrid>
          {/* Match Analysis */}
          <ToolCard 
            $active={activeTool === 'analysis'} 
            onClick={handleAnalyze}
            disabled={isAnyLoading}
          >
            <ToolIcon $gradient="linear-gradient(135deg, #3b82f6, #06b6d4)">
              <AnalyzeIcon />
            </ToolIcon>
            <ToolName>Match Analysis</ToolName>
            <ToolDesc>Analyze how your profile matches this job. Identify gaps and strengths.</ToolDesc>
            {analysisLoading && (
              <LoadingOverlay>
                <CircularProgress size={24} sx={{ color: '#667eea' }} />
                <LoadingText>Analyzing match...</LoadingText>
              </LoadingOverlay>
            )}
          </ToolCard>
          
          {/* Profile Tailoring */}
          <ToolCard 
            $active={activeTool === 'tailor'} 
            onClick={handleTailor}
            disabled={isAnyLoading}
          >
            <ToolIcon $gradient="linear-gradient(135deg, #8b5cf6, #ec4899)">
              <TailorIcon />
            </ToolIcon>
            <ToolName>Tailor Profile</ToolName>
            <ToolDesc>Generate a tailored version of your profile optimized for this role.</ToolDesc>
            {tailorLoading && !showTailoringProgress && (
              <LoadingOverlay>
                <CircularProgress size={24} sx={{ color: '#8b5cf6' }} />
                <LoadingText>Tailoring profile...</LoadingText>
              </LoadingOverlay>
            )}
          </ToolCard>
          
          {/* AI Enhancement */}
          <ToolCard 
            $active={activeTool === 'enhance'} 
            onClick={handleEnhance}
            disabled={isAnyLoading}
          >
            <ToolIcon $gradient="linear-gradient(135deg, #10b981, #059669)">
              <EnhanceIcon />
            </ToolIcon>
            <ToolName>AI Enhancement</ToolName>
            <ToolDesc>Enhance your profile content with AI, contextualized for this job.</ToolDesc>
            {enhanceLoading && (
              <LoadingOverlay>
                <CircularProgress size={24} sx={{ color: '#10b981' }} />
                <LoadingText>Enhancing profile...</LoadingText>
              </LoadingOverlay>
            )}
          </ToolCard>
          
          {/* Cover Letter */}
          <ToolCard onClick={handleCoverLetter} disabled={isAnyLoading}>
            <ToolIcon $gradient="linear-gradient(135deg, #06b6d4, #3b82f6)">
              <CoverLetterIcon />
            </ToolIcon>
            <ToolName>Cover Letter</ToolName>
            <ToolDesc>Generate a tailored cover letter with tone and length options.</ToolDesc>
          </ToolCard>
        </ToolsGrid>
        
        {error && (
          <ErrorMessage>
            <ErrorIcon /> {error}
          </ErrorMessage>
        )}
        
        {/* === Analysis Results === */}
        {activeTool === 'analysis' && analysisResult && !analysisLoading && (
          <ResultsContainer>
            <ResultCard>
              <ResultHeader>
                <ResultTitle><AnalyzeIcon /> Match Analysis Results</ResultTitle>
                <ResultActions>
                  <SmallButton onClick={handleAnalyze}>
                    <RefreshIcon /> Re-analyze
                  </SmallButton>
                </ResultActions>
              </ResultHeader>
              <ResultBody>
                {/* Summary stats */}
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <ScoreCircle $score={100 - (analysisResult.gaps.length * 10)}>
                      {Math.max(0, 100 - (analysisResult.gaps.length * 10))}
                    </ScoreCircle>
                    <ScoreLabel>Match Score</ScoreLabel>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <Chip 
                        size="small" 
                        label={`${analysisResult.gaps.filter(g => g.severity === 'critical').length} Critical Gaps`}
                        sx={{ background: '#fee2e2', color: '#dc2626' }}
                      />
                      <Chip 
                        size="small" 
                        label={`${analysisResult.gaps.filter(g => g.severity === 'important').length} Important`}
                        sx={{ background: '#fef3c7', color: '#d97706' }}
                      />
                      <Chip 
                        size="small" 
                        label={`${analysisResult.gaps.filter(g => g.severity === 'nice_to_have').length} Nice to Have`}
                        sx={{ background: '#dbeafe', color: '#2563eb' }}
                      />
                    </div>
                    {analysisResult.satisfiedAlternatives?.length > 0 && (
                      <div style={{ fontSize: 13, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckIcon sx={{ fontSize: 16 }} />
                        {analysisResult.satisfiedAlternatives.length} requirements met through alternative experience
                      </div>
                    )}
                  </div>
                </div>
                
                {analysisResult.gaps.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Skill Gaps</div>
                    <GapList>
                      {analysisResult.gaps.map((gap, idx) => (
                        <GapItem key={idx}>
                          {gap.severity === 'critical' ? <ErrorIcon sx={{ color: '#dc2626' }} /> :
                           gap.severity === 'important' ? <WarningIcon sx={{ color: '#d97706' }} /> :
                           <InfoIcon sx={{ color: '#2563eb' }} />}
                          <GapInfo>
                            <div className="gap-skill">{gap.skill || gap.name}</div>
                            <div className="gap-desc">{gap.description || gap.reason}</div>
                            {gap.learningResource && (
                              <div style={{ fontSize: 11, color: '#667eea', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <SchoolIcon sx={{ fontSize: 14 }} /> {gap.learningResource}
                              </div>
                            )}
                          </GapInfo>
                          <SeverityChip $severity={gap.severity}>{gap.severity}</SeverityChip>
                        </GapItem>
                      ))}
                    </GapList>
                  </>
                )}
                
                {analysisResult.gaps.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#059669' }}>
                    <CheckIcon sx={{ fontSize: 40 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Great Match!</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>Your profile covers all the key requirements for this role.</div>
                  </div>
                )}
              </ResultBody>
            </ResultCard>
          </ResultsContainer>
        )}
        
        {/* === Enhancement Results === */}
        {activeTool === 'enhance' && enhanceResult && !enhanceLoading && (
          <ResultsContainer>
            <ResultCard>
              <ResultHeader>
                <ResultTitle><EnhanceIcon /> Enhanced Profile</ResultTitle>
                <ResultActions>
                  <SmallButton onClick={handleEnhance}>
                    <RefreshIcon /> Re-enhance
                  </SmallButton>
                </ResultActions>
              </ResultHeader>
              <ResultBody>
                {enhanceResult.title && (
                  <EnhancementSection>
                    <EnhancementLabel>Enhanced Title</EnhancementLabel>
                    <EnhancementContent>{enhanceResult.title}</EnhancementContent>
                  </EnhancementSection>
                )}
                
                {enhanceResult.summary && (
                  <EnhancementSection>
                    <EnhancementLabel>Enhanced Summary</EnhancementLabel>
                    <EnhancementContent>{enhanceResult.summary}</EnhancementContent>
                  </EnhancementSection>
                )}
                
                {enhanceResult.skills?.length > 0 && (
                  <EnhancementSection>
                    <EnhancementLabel>Suggested Skills</EnhancementLabel>
                    <SkillChips>
                      {enhanceResult.skills.map((skill, idx) => (
                        <Chip 
                          key={idx}
                          label={skill}
                          size="small"
                          sx={{
                            background: flattenSkills(profile?.skills).includes(skill) ? '#d1fae5' : '#ede9fe',
                            color: flattenSkills(profile?.skills).includes(skill) ? '#065f46' : '#5b21b6',
                            fontWeight: 500
                          }}
                        />
                      ))}
                    </SkillChips>
                  </EnhancementSection>
                )}
                
                {enhanceResult.experience?.length > 0 && (
                  <EnhancementSection>
                    <EnhancementLabel>Enhanced Experience</EnhancementLabel>
                    {enhanceResult.experience.map((exp, idx) => (
                      <div key={idx} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>
                          {exp.title} {exp.company && `at ${exp.company}`}
                        </div>
                        <EnhancementContent style={{ marginTop: 4 }}>{exp.description}</EnhancementContent>
                      </div>
                    ))}
                  </EnhancementSection>
                )}
                
                <TipsList style={{ marginTop: 20 }}>
                  <TipItem>
                    <TipIcon />
                    <span>These enhancements are contextualized for <strong>{job.title}</strong> at <strong>{job.company}</strong>. Review the changes and apply them to your profile from the <a href="/profile/edit" style={{ color: '#667eea' }}>Profile Editor</a>.</span>
                  </TipItem>
                </TipsList>
              </ResultBody>
            </ResultCard>
          </ResultsContainer>
        )}
      </PanelContainer>
      
      {/* Gap Review Dialog */}
      <GapReviewDialog
        open={showGapReview}
        onClose={() => { setShowGapReview(false); setTailorLoading(false); }}
        gaps={detectedGaps}
        satisfiedAlternatives={satisfiedAlternatives}
        onContinue={handleGapReviewContinue}
        loading={tailorLoading}
      />

      {/* Tailor Settings Modal */}
      <TailorSettingsModal
        open={showTailorSettings}
        onClose={() => setShowTailorSettings(false)}
        jobTitle={job?.title}
        company={job?.company}
        onContinue={handleTailorSettingsContinue}
      />

      {/* Tailoring Progress Modal */}
      <TailoringProgressModal
        open={showTailoringProgress}
        onMinimize={() => setShowTailoringProgress(false)}
        jobTitle={job?.title}
        company={job?.company}
      />

      {/* Resume Preview / Download Modal */}
      <ResumePreviewModal
        open={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        profileData={profile}
        tailoredProfileData={tailoredProfile}
        jobTitle={job?.title}
      />

      {/* Cover Letter Modal */}
      <CoverLetterModal
        open={showCoverLetterModal}
        onClose={() => setShowCoverLetterModal(false)}
        jobTitle={job?.title}
        company={job?.company}
        onGenerate={handleGenerateCoverLetter}
      />
      
      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={rateLimitFeature}
      />
    </>
  );
}
