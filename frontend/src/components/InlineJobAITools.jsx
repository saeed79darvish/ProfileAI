import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  AutoAwesome as TailorIcon,
  Description as CoverLetterIcon,
  Psychology as SkillGapIcon,
  TrendingUp as MatchIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  ArrowForward as ArrowIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { CircularProgress, Chip, Dialog, DialogContent, IconButton } from '@mui/material';
import { profileAPI, tailoredProfileAPI, resumeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import GapReviewDialog from './GapReviewDialog';
import UpgradeModal from './UpgradeModal';
import TailorSettingsModal from './TailorSettingsModal';
import CoverLetterModal from './CoverLetterModal';
import JobMatchAnalysis from './JobMatchAnalysis';
import TailoringProgressModal from './TailoringProgressModal';
import TailoredResultsModal from './TailoredResultsModal';
import ResumePreviewModal from './ResumePreviewModal';
import AlreadyTailoredModal from './AlreadyTailoredModal';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const ResultPanel = styled.div`
  margin-top: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease;
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  
  .title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    display: flex;
    align-items: center;
    gap: 6px;
    
    svg { font-size: 18px; color: #667eea; }
  }
  
  .actions {
    display: flex;
    gap: 6px;
  }
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${p => p.$primary ? 'transparent' : '#d1d5db'};
  background: ${p => p.$primary ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'white'};
  color: ${p => p.$primary ? 'white' : '#374151'};
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: ${p => p.$primary ? '0 3px 10px rgba(102,126,234,0.3)' : '0 2px 6px rgba(0,0,0,0.08)'};
  }
  
  &:disabled { opacity: 0.6; cursor: not-allowed; }
  svg { font-size: 13px; }
`;

const ResultBody = styled.div`
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 10px;
  color: #667eea;
  font-size: 13px;
  animation: ${pulse} 1.5s infinite;
`;

const ErrorBanner = styled.div`
  padding: 10px 14px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  
  svg { font-size: 16px; }
`;

const GapItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  margin-bottom: 6px;
  
  svg { flex-shrink: 0; margin-top: 2px; font-size: 16px; }
  
  .skill { font-weight: 600; font-size: 13px; color: #1a1a2e; }
  .desc { font-size: 12px; color: #6b7280; margin-top: 1px; }
  .learning { font-size: 11px; color: #667eea; margin-top: 3px; display: flex; align-items: center; gap: 4px; }
`;

const SeverityChip = styled.span`
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  background: ${p => p.$severity === 'critical' ? '#fee2e2' : p.$severity === 'important' ? '#fef3c7' : '#dbeafe'};
  color: ${p => p.$severity === 'critical' ? '#dc2626' : p.$severity === 'important' ? '#d97706' : '#2563eb'};
`;

const TailoredSection = styled.div`
  margin-bottom: 14px;
  
  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .section-content {
    padding: 10px 12px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
  }
`;

const MatchBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  background: ${p => p.$score >= 80 ? '#d1fae5' : p.$score >= 60 ? '#fef3c7' : '#fee2e2'};
  color: ${p => p.$score >= 80 ? '#065f46' : p.$score >= 60 ? '#92400e' : '#991b1b'};
`;

const CoverLetterBox = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  color: #1a1a2e;
  white-space: pre-wrap;
  font-family: Georgia, serif;
`;

const ToneButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const ToneBtn = styled.button`
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1.5px solid ${p => p.$active ? '#667eea' : '#d1d5db'};
  background: ${p => p.$active ? '#667eea10' : 'white'};
  color: ${p => p.$active ? '#667eea' : '#6b7280'};
  transition: all 0.2s;
  
  &:hover { border-color: #667eea; }
`;

const NoProfileCard = styled.div`
  padding: 18px;
  border-radius: 12px;
  background: linear-gradient(180deg, #faf8ff 0%, #f5f3ff 100%);
  border: 1px solid #ece8fd;
`;

const NoProfileTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
`;

const NoProfileSubtitle = styled.div`
  font-size: 12.5px;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 14px;
`;

const NoProfileToolList = styled.ul`
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 9px;
`;

const NoProfileToolItem = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #374151;

  svg { font-size: 18px; color: #7c3aed; flex-shrink: 0; }
  strong { font-weight: 600; color: #1f2937; }
`;

const NoProfileCta = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 11px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);

  &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); }
  svg { font-size: 18px; }
`;

const NoProfileHint = styled.div`
  margin-top: 10px;
  text-align: center;
  font-size: 11.5px;
  color: #9ca3af;
`;

// Normalize skills: could be string[], or { category: string[] } object
const flattenSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'object') return Object.values(skills).flat();
  return [];
};

/**
 * Inline AI Tools that render directly inside the CandidateJobs page
 * replacing the old navigate-to-profile buttons.
 */
export default function InlineJobAITools({ job }) {
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'tailor' | 'coverLetter' | 'skillGap' | 'match'
  
  // Skill Gap / Match Analysis
  const [gapLoading, setGapLoading] = useState(false);
  const [gapResult, setGapResult] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  
  // Tailor
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailoredProfile, setTailoredProfile] = useState(null);
  const [showGapReview, setShowGapReview] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState([]);
  const [satisfiedAlts, setSatisfiedAlts] = useState([]);
  const [savingTailored, setSavingTailored] = useState(false);
  const [tailorSaved, setTailorSaved] = useState(false);
  const [showTailorSettings, setShowTailorSettings] = useState(false);
  
  // Cover Letter
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [coverTone, setCoverTone] = useState('conversational');
  const [coverLength, setCoverLength] = useState('short');
  const [copied, setCopied] = useState(false);
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);

  // New modal states
  const [showTailoringProgress, setShowTailoringProgress] = useState(false);
  const [tailoringStartStep, setTailoringStartStep] = useState(0);
  const [tailoringCompleted, setTailoringCompleted] = useState(false);
  const [showTailoredResults, setShowTailoredResults] = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [currentTailorSettings, setCurrentTailorSettings] = useState(null);
  const [preloadedPreviewUrl, setPreloadedPreviewUrl] = useState('');
  
  // Upgrade
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [rateLimitFeature, setRateLimitFeature] = useState('');

  // Already tailored check
  const [showAlreadyTailored, setShowAlreadyTailored] = useState(false);
  const [existingTailoredId, setExistingTailoredId] = useState(null);

  // Fetch profile once
  useEffect(() => {
    if (!user || (user.role !== 'candidate' && user.role !== 'admin')) { setProfileLoaded(true); return; }
    
    profileAPI.getMyProfile()
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoaded(true));
  }, [user]);

  // Reset results when job changes
  useEffect(() => {
    setActivePanel(null);
    setGapResult(null);
    setTailoredProfile(null);
    setCoverLetter('');
    setTailorSaved(false);
  }, [job?.id]);

  // Listen for external tailor trigger (e.g. from match dialog)
  useEffect(() => {
    const handler = (e) => {
      if (job && e.detail?.jobId === job.id) {
        handleTailorRef.current();
      }
    };
    window.addEventListener('trigger-tailor-resume', handler);
    return () => window.removeEventListener('trigger-tailor-resume', handler);
  }, [job]);

  // Listen for external cover letter trigger
  useEffect(() => {
    const handler = (e) => {
      if (job && e.detail?.jobId === job.id) {
        handleCoverLetter();
      }
    };
    window.addEventListener('trigger-cover-letter', handler);
    return () => window.removeEventListener('trigger-cover-letter', handler);
  }, [job]);

  const getJobDescription = useCallback(() => {
    if (!job) return '';
    const descriptionText = job.description
      || (job.descriptionHtml ? job.descriptionHtml.replace(/<[^>]+>/g, ' ').substring(0, 3000) : '');
    const parts = [
      `Job Title: ${job.title || ''}`,
      `Company: ${job.company || ''}`,
      job.location ? `Location: ${job.location}` : '',
      job.skills?.length ? `Required Skills: ${job.skills.join(', ')}` : '',
      descriptionText ? `\n${descriptionText}` : '',
      job.requirements ? `\nRequirements:\n${job.requirements}` : '',
    ];
    return parts.filter(Boolean).join('\n');
  }, [job]);

  const getProfileData = useCallback(() => {
    if (!profile) return null;
    return {
      title: profile.title || '',
      summary: profile.summary || '',
      skills: flattenSkills(profile.skills),
      experience: profile.experience || [],
      education: profile.education || [],
      projects: profile.projects || [],
    };
  }, [profile]);

  const handleRateLimit = (err) => {
    if (err.response?.status === 429) {
      setRateLimitFeature(err.response?.data?.feature || 'tailor_profile');
      setShowUpgradeModal(true);
      return true;
    }
    if (err.response?.status === 503) {
      toast.error('AI service is temporarily overloaded. Please try again in a moment.');
      return true;
    }
    return false;
  };

  // === Skill Gap Analysis ===
  const handleSkillGap = async () => {
    setShowMatchModal(true);
    setGapLoading(true);
    try {
      const res = await profileAPI.analyzeGaps({ profileData: getProfileData(), jobDescription: getJobDescription() });
      if (res.data.success) {
        setGapResult({ gaps: res.data.gaps || [], satisfiedAlternatives: res.data.satisfiedAlternatives || [] });
      } else {
        toast.error('Failed to analyze skill gaps');
      }
    } catch (err) {
      if (!handleRateLimit(err)) toast.error(err.response?.data?.error || 'Error analyzing skill gaps');
    } finally {
      setGapLoading(false);
    }
  };

  // === Tailor Resume ===
  const handleTailor = async () => {
    try {
      const res = await tailoredProfileAPI.getAll();
      const existing = res.data?.find(tp =>
        tp.jobTitle === job?.title && tp.companyName === job?.company && tp.isActive
      );
      if (existing) {
        setExistingTailoredId(existing.id);
        setShowAlreadyTailored(true);
        return;
      }
    } catch (err) {
      // If fetch fails, proceed normally
    }
    setShowTailorSettings(true);
  };

  // Keep a ref to the latest handleTailor for event listeners
  const handleTailorRef = useRef(handleTailor);
  handleTailorRef.current = handleTailor;

  const handleTailorAgain = () => {
    setShowAlreadyTailored(false);
    setExistingTailoredId(null);
    setShowTailorSettings(true);
  };

  const handleEditExisting = () => {
    setShowAlreadyTailored(false);
    // Load the existing tailored profile and open the resume preview
    tailoredProfileAPI.getById(existingTailoredId).then(res => {
      setTailoredProfile(res.data.tailoredData || res.data);
      setShowResumePreview(true);
    }).catch(() => {
      // Fallback: just open tailor settings
      setShowTailorSettings(true);
    });
  };

  const handleTailorSettingsContinue = async (settings) => {
    setShowTailorSettings(false);
    setCurrentTailorSettings(settings);
    setActivePanel('tailor');
    setTailorLoading(true);
    setTailoredProfile(null);
    setTailorSaved(false);
    setTailoringStartStep(0);
    setTailoringCompleted(false);
    setShowTailoringProgress(true);
    try {
      const res = await profileAPI.analyzeGaps({ profileData: getProfileData(), jobDescription: getJobDescription() });
      if (res.data.success && res.data.gaps?.length > 0) {
        setShowTailoringProgress(false);
        setDetectedGaps(res.data.gaps);
        setSatisfiedAlts(res.data.satisfiedAlternatives || []);
        setShowGapReview(true);
      } else {
        await doTailoring(null, settings);
        setTailoringCompleted(true);
      }
    } catch (err) {
      if (!handleRateLimit(err)) {
        try {
          await doTailoring(null, settings);
          setTailoringCompleted(true);
        } catch (err2) {
          setShowTailoringProgress(false);
          if (!handleRateLimit(err2)) toast.error(err2.response?.data?.error || 'Error tailoring profile');
        }
      }
    } finally {
      setTailorLoading(false);
    }
  };

  const handleGapReviewContinue = async (selections) => {
    setShowGapReview(false);
    setTailorLoading(true);
    setTailoringStartStep(2);
    setTailoringCompleted(false);
    setShowTailoringProgress(true);
    try {
      await doTailoring({ acceptedGaps: selections.acceptedGaps, skippedGaps: selections.skippedGaps, acceptedGapObjects: selections.acceptedGapObjects }, currentTailorSettings);
      setTailoringCompleted(true);
    } catch (err) {
      setShowTailoringProgress(false);
      if (!handleRateLimit(err)) toast.error(err.response?.data?.error || 'Error tailoring profile');
    } finally {
      setTailorLoading(false);
    }
  };

  const doTailoring = async (gapSelections, tailorSettings) => {
    const res = await profileAPI.tailorProfileForJob({ profileData: getProfileData(), jobDescription: getJobDescription(), gapSelections, tailorSettings });
    if (res.data.success) {
      const tailored = res.data.data;
      if (gapSelections?.acceptedGapObjects) {
        tailored._skillGaps = gapSelections.acceptedGapObjects;
        tailored._learningPlan = { acceptedGaps: gapSelections.acceptedGaps || [], skippedGaps: gapSelections.skippedGaps || [], createdAt: new Date().toISOString() };
      }
      setTailoredProfile(tailored);

      // Auto-save tailored profile to DB
      try {
        await tailoredProfileAPI.save({
          jobTitle: job.title,
          companyName: job.company,
          tailoredData: tailored,
          originalProfileSnapshot: getProfileData(),
          matchScore: tailored.matchAnalysis?.overallScore || null,
          skillGaps: (tailored._skillGaps || []).map(g => ({ ...g, status: 'pending' })),
          learningPlan: tailored._learningPlan || null,
        });
      } catch (saveErr) {
        // Non-blocking, continue even if save fails
      }

      // Pre-fetch resume preview in background so the download modal opens instantly
      setPreloadedPreviewUrl('');
      resumeAPI.preview('professional', null, tailored).then(previewRes => {
        if (previewRes.data?.preview) setPreloadedPreviewUrl(previewRes.data.preview);
      }).catch(() => {});
    } else {
      toast.error('Failed to tailor profile');
    }
  };

  const handleSaveTailored = async () => {
    if (!tailoredProfile) return;
    setSavingTailored(true);
    try {
      await tailoredProfileAPI.save({
        jobTitle: job.title,
        companyName: job.company,
        tailoredData: tailoredProfile,
        originalProfileSnapshot: getProfileData(),
        matchScore: tailoredProfile.matchAnalysis?.overallScore || null,
        skillGaps: (tailoredProfile._skillGaps || []).map(g => ({ ...g, status: 'pending' })),
        learningPlan: tailoredProfile._learningPlan || null,
      });
      setTailorSaved(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving tailored profile');
    } finally {
      setSavingTailored(false);
    }
  };

  // === Cover Letter ===
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
      if (res.data.success) {
        return res.data.coverLetter;
      }
      throw new Error('Failed to generate cover letter');
    } catch (err) {
      if (handleRateLimit(err)) return '';
      throw err;
    }
  };

  if (!user || (user.role !== 'candidate' && user.role !== 'admin')) return null;

  if (!profileLoaded) return null;

  if (!profile) {
    return (
      <NoProfileCard>
        <NoProfileTitle>Unlock AI tools for this job</NoProfileTitle>
        <NoProfileSubtitle>
          Add your profile once and ProfilleAI tailors everything to your
          experience — no copy-pasting your resume each time.
        </NoProfileSubtitle>
        <NoProfileToolList>
          <NoProfileToolItem>
            <TailorIcon />
            <span><strong>Tailor your resume</strong> to match this role</span>
          </NoProfileToolItem>
          <NoProfileToolItem>
            <CoverLetterIcon />
            <span><strong>Generate a cover letter</strong> in seconds</span>
          </NoProfileToolItem>
          <NoProfileToolItem>
            <MatchIcon />
            <span><strong>See your match score</strong> against the job</span>
          </NoProfileToolItem>
          <NoProfileToolItem>
            <SkillGapIcon />
            <span><strong>Spot skill gaps</strong> to close before applying</span>
          </NoProfileToolItem>
        </NoProfileToolList>
        <NoProfileCta href="/profile/edit">
          Create your profile <ArrowIcon />
        </NoProfileCta>
        <NoProfileHint>Takes about 2 minutes</NoProfileHint>
      </NoProfileCard>
    );
  }

  // Match analysis handler for JobMatchAnalysis component
  const handleMatchAnalyze = async () => {
    try {
      const res = await profileAPI.keywordOptimization({ profileData: getProfileData(), jobDescription: getJobDescription() });
      if (res.data.success) {
        return res.data.data;
      }
      throw new Error('Failed to analyze match');
    } catch (err) {
      if (!handleRateLimit(err)) {
        toast.error(err.response?.data?.error || err.message || 'Match analysis failed');
      }
      throw err;
    }
  };

  const isLoading = gapLoading || tailorLoading || coverLoading;

  return (
    <>
      {/* AI Tool Buttons, replacing navigate-to-profile redirects */}
      <div className="job-detail-ai-buttons">
        <button type="button"
          className={`job-detail-ai-btn${activePanel === 'skillGap' ? ' active' : ''}`}
          onClick={handleSkillGap}
          disabled={isLoading}
        >
          <MatchIcon /> Analyze Match
        </button>
        <button type="button"
          className={`job-detail-ai-btn${activePanel === 'tailor' ? ' active' : ''}`}
          onClick={handleTailor}
          disabled={isLoading}
        >
          <TailorIcon /> Tailor Resume
        </button>
        <button type="button"
          className="job-detail-ai-btn"
          onClick={handleCoverLetter}
          disabled={isLoading}
        >
          <CoverLetterIcon /> Cover Letter
        </button>
      </div>

      {/* Match Analysis Modal */}
      <Dialog
        open={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ style: { borderRadius: 16, overflow: 'hidden' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, #f0f4ff, #faf5ff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MatchIcon sx={{ color: '#667eea' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>Match Analysis</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {gapResult && (
              <IconButton size="small" onClick={handleSkillGap} title="Re-analyze">
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => setShowMatchModal(false)}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </div>
        </div>
        <DialogContent style={{ padding: '20px' }}>
          {gapLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CircularProgress size={32} sx={{ color: '#667eea' }} />
              <div style={{ marginTop: 12, color: '#6b7280', fontSize: 14 }}>Analyzing your profile against this job...</div>
            </div>
          ) : gapResult ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${gapResult.gaps.filter(g => g.severity === 'critical').length} Critical`} sx={{ background: '#fee2e2', color: '#dc2626', fontWeight: 500 }} />
                <Chip size="small" label={`${gapResult.gaps.filter(g => g.severity === 'important').length} Important`} sx={{ background: '#fef3c7', color: '#d97706', fontWeight: 500 }} />
                <Chip size="small" label={`${gapResult.gaps.filter(g => g.severity === 'nice_to_have').length} Nice to Have`} sx={{ background: '#dbeafe', color: '#2563eb', fontWeight: 500 }} />
              </div>
              {gapResult.satisfiedAlternatives?.length > 0 && (
                <div style={{ fontSize: 13, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                  <CheckIcon sx={{ fontSize: 16 }} /> {gapResult.satisfiedAlternatives.length} requirements met via alternative experience
                </div>
              )}
              {gapResult.gaps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#059669' }}>
                  <CheckIcon sx={{ fontSize: 40 }} />
                  <div style={{ fontWeight: 600, marginTop: 8, fontSize: 15 }}>Great match! No significant gaps.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {gapResult.gaps.map((gap, idx) => (
                    <GapItem key={idx}>
                      {gap.severity === 'critical' ? <ErrorIcon sx={{ color: '#dc2626' }} /> :
                       gap.severity === 'important' ? <WarningIcon sx={{ color: '#d97706' }} /> :
                       <InfoIcon sx={{ color: '#2563eb' }} />}
                      <div style={{ flex: 1 }}>
                        <div className="skill">{gap.skill || gap.name}</div>
                        <div className="desc">{gap.description || gap.reason}</div>
                        {gap.learningResource && (
                          <div className="learning"><SchoolIcon sx={{ fontSize: 12 }} /> {gap.learningResource}</div>
                        )}
                      </div>
                      <SeverityChip $severity={gap.severity}>{gap.severity}</SeverityChip>
                    </GapItem>
                  ))}
                </div>
              )}
              {gapResult.gaps.length > 0 && (
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <button type="button"
                    onClick={() => { setShowMatchModal(false); handleTailor(); }}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <TailorIcon sx={{ fontSize: 16 }} /> Tailor Resume to Fix Gaps
                  </button>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Gap Review Dialog for Tailoring */}
      <GapReviewDialog
        open={showGapReview}
        onClose={() => { setShowGapReview(false); setTailorLoading(false); }}
        gaps={detectedGaps}
        satisfiedAlternatives={satisfiedAlts}
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

      {/* Cover Letter Modal */}
      <CoverLetterModal
        open={showCoverLetterModal}
        onClose={() => setShowCoverLetterModal(false)}
        jobTitle={job?.title}
        company={job?.company}
        onGenerate={handleGenerateCoverLetter}
      />

      {/* Tailoring Progress Modal */}
      <TailoringProgressModal
        open={showTailoringProgress}
        onMinimize={() => setShowTailoringProgress(false)}
        onViewResult={() => { setShowTailoringProgress(false); setShowResumePreview(true); }}
        jobTitle={job?.title}
        company={job?.company}
        startFromStep={tailoringStartStep}
        maxStep={tailoringStartStep === 0 ? 2 : 4}
        completed={tailoringCompleted}
      />

      {/* Resume Preview / Download Modal */}
      <ResumePreviewModal
        open={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        profileData={profile}
        tailoredProfileData={tailoredProfile}
        jobTitle={job?.title}
        user={user}
        preloadedPreviewUrl={preloadedPreviewUrl}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={rateLimitFeature}
      />

      {/* Already Tailored Warning */}
      <AlreadyTailoredModal
        open={showAlreadyTailored}
        onClose={() => setShowAlreadyTailored(false)}
        onTailorAgain={handleTailorAgain}
        onEdit={handleEditExisting}
        jobTitle={job?.title}
        company={job?.company}
      />
    </>
  );
}
