import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  LinearProgress,
  Grid,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  HelpOutline as QuestionIcon,
  AttachMoney as SalaryIcon,
  Mail as EmailIcon,
  Assessment as AnalyticsIcon,
  Groups as CultureIcon,
  CompareArrows as CompareIcon,
  AutoAwesome as AIIcon,
  ArrowBack as BackIcon,
  AutoAwesome as SparkleIcon,
  Work as WorkIcon,
  LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { profileAPI, smartMatchAPI, resolveImageUrl } from '../../services/api';
import {
  fadeIn,
  PageWrap,
  HeroSection,
  HeroInner,
  HeroRow,
  HeroLeft,
  HeroBackBtn,
  HeroTitle,
  HeroSub,
  ViewProfileBtn,
  ProfileCard,
  ProfileInner,
  ProfileMain,
  ProfileInfo,
  ProfileName,
  ProfileRole,
  ProfileMeta,
  MetaBlock,
  TabBar,
  TabStrip,
  TabItem,
  ContentArea,
  Panel,
  PanelHeader,
  AutoPopBanner,
  GenerateBtn,
  ReadyBadge,
  ResultCard,
  ScoreBadge
} from './styled';
import { ROUTES, THRESHOLDS, DEFAULTS, TEXT as CONST_TEXT } from './constants';

/* ───── profile card (pulled up into hero) ───── */

/* ───── tabs ───── */

/* ───── content panels ───── */

/* ───── result cards ───── */

export /* ───── animations ───── */
/* ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { icon: <QuestionIcon />, label: 'Interview Questions' },
  { icon: <SalaryIcon />, label: 'Salary Prediction' },
  { icon: <EmailIcon />, label: 'Outreach Message' },
  { icon: <AnalyticsIcon />, label: 'Skill Gap Analysis' },
  { icon: <CultureIcon />, label: 'Culture Fit' },
  { icon: <CompareIcon />, label: 'Compare Candidates' },
];

const RecruiterTools = () => {
  const { profileId } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  
  // Feature states
  const [interviewQuestions, setInterviewQuestions] = useState(null);
  const [roleContext, setRoleContext] = useState('');
  const [salaryPrediction, setSalaryPrediction] = useState(null);
  const [outreachMessage, setOutreachMessage] = useState(null);
  const [jobDetails, setJobDetails] = useState('');
  const [outreachTone, setOutreachTone] = useState('professional');
  const [skillGapAnalysis, setSkillGapAnalysis] = useState(null);
  const [jobRequirements, setJobRequirements] = useState('');
  const [cultureFit, setCultureFit] = useState(null);
  const [companyValues, setCompanyValues] = useState('');
  const [compareDialog, setCompareDialog] = useState(false);
  const [compareProfileIds, setCompareProfileIds] = useState('');
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    if (profileId) loadProfile();
  }, [profileId]);

  useEffect(() => {
    if (profile) {
      const skills = profile.skills ? Object.values(profile.skills).flat().slice(0, 5).join(', ') : '';
      setRoleContext(`${profile.title}${skills ? ` with skills in ${skills}` : ''}`);
      setJobRequirements(`Looking for ${profile.title} with expertise in: ${skills || 'relevant technologies'}`);
      setCompanyValues('Innovation, collaboration, continuous learning, work-life balance, diversity and inclusion');
    }
  }, [profile]);

  const loadProfile = async () => {
    try {
      const response = await profileAPI.getPublicProfile(profileId);
      setProfile(response.data);
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  /* ── API handlers ── */
  const handleGenerateInterviewQuestions = async () => {
    setLoading(true); setError('');
    try {
      const r = await smartMatchAPI.generateInterviewQuestions(profileId, roleContext);
      setInterviewQuestions(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to generate interview questions'); }
    finally { setLoading(false); }
  };

  const handlePredictSalary = async () => {
    setLoading(true); setError('');
    try {
      const r = await smartMatchAPI.predictSalary(profileId, profile?.location, 'USD');
      setSalaryPrediction(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to predict salary'); }
    finally { setLoading(false); }
  };

  const handleGenerateOutreach = async () => {
    setLoading(true); setError('');
    try {
      const r = await smartMatchAPI.generateOutreach(profileId, jobDetails, outreachTone);
      setOutreachMessage(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to generate outreach message'); }
    finally { setLoading(false); }
  };

  const handleAnalyzeSkillGaps = async () => {
    setLoading(true); setError('');
    try {
      const r = await smartMatchAPI.analyzeSkillGaps(profileId, jobRequirements);
      setSkillGapAnalysis(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to analyze skill gaps'); }
    finally { setLoading(false); }
  };

  const handlePredictCultureFit = async () => {
    setLoading(true); setError('');
    try {
      const r = await smartMatchAPI.predictCultureFit(profileId, companyValues);
      setCultureFit(r.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to predict culture fit'); }
    finally { setLoading(false); }
  };

  const handleCompareCandidates = async () => {
    setLoading(true); setError('');
    try {
      const ids = compareProfileIds.split(',').map(id => id.trim());
      const r = await smartMatchAPI.compareCandidates(ids, jobRequirements);
      setComparison(r.data);
      setCompareDialog(false);
    } catch (err) { setError(err.response?.data?.error || 'Failed to compare candidates'); }
    finally { setLoading(false); }
  };

  /* ── helpers ── */
  const topSkills = profile?.skills ? Object.values(profile.skills).flat().slice(0, 10) : [];

  /* ── empty state ── */
  if (!profileId) {
    return (
      <PageWrap>
        <HeroSection style={{ paddingBottom: '3rem' }}>
          <HeroInner style={{ textAlign: 'center' }}>
            <AIIcon style={{ fontSize: 56, marginBottom: 12, opacity: 0.8 }} />
            <HeroTitle style={{ justifyContent: 'center' }}>Recruiter AI Tools</HeroTitle>
            <HeroSub>Select a candidate profile from Browse Profiles to get started.</HeroSub>
            <ViewProfileBtn style={{ marginTop: 20 }} onClick={() => navigate('/browse')}>
              Browse Profiles
            </ViewProfileBtn>
          </HeroInner>
        </HeroSection>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      {/* ─── Hero ─── */}
      <HeroSection>
        <HeroInner>
          <HeroBackBtn onClick={() => navigate('/browse')}>
            <BackIcon style={{ fontSize: 18 }} /> Back to Profiles
          </HeroBackBtn>
          <HeroRow>
            <div>
              <HeroTitle>
                <SparkleIcon style={{ fontSize: 30 }} />
                Recruiter AI Tools
              </HeroTitle>
              <HeroSub>
                {profile
                  ? `Analyzing: ${profile.user?.firstName || ''} ${profile.user?.lastName || ''}, ${profile.title || ''}`
                  : 'Loading candidate…'}
              </HeroSub>
            </div>
            <ViewProfileBtn onClick={() => navigate(`/profile/${profileId}`)}>
              View Full Profile
            </ViewProfileBtn>
          </HeroRow>
        </HeroInner>
      </HeroSection>

      {/* ─── Profile Summary Card ─── */}
      {profile && (
        <ProfileCard>
          <ProfileInner>
            <ProfileMain>
              <Avatar
                src={resolveImageUrl(profile.profilePicture)}
                sx={{
                  width: 56, height: 56,
                  bgcolor: '#7c3aed',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                }}
              >
                {!profile.profilePicture && `${(profile.user?.firstName || '?')[0]}${(profile.user?.lastName || '?')[0]}`}
              </Avatar>
              <ProfileInfo>
                <ProfileName>{profile.user?.firstName} {profile.user?.lastName}</ProfileName>
                <ProfileRole>
                  <WorkIcon style={{ fontSize: 15 }} /> {profile.title || 'Untitled'}
                </ProfileRole>
                {profile.location && (
                  <ProfileRole style={{ marginBottom: 0 }}>
                    <LocationIcon style={{ fontSize: 15 }} /> {profile.location}
                  </ProfileRole>
                )}
              </ProfileInfo>
            </ProfileMain>

            <ProfileMeta>
              <MetaBlock>
                <div className="label">Key Skills</div>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {topSkills.length > 0
                    ? topSkills.map((s, i) => (
                        <Chip key={i} label={s} size="small" sx={{
                          bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 600, fontSize: 12,
                          border: '1px solid #ede9fe',
                        }} />
                      ))
                    : <Typography variant="body2" color="text.secondary">No skills listed</Typography>
                  }
                </Box>
              </MetaBlock>

              <MetaBlock>
                <div className="label">Experience</div>
                <Typography variant="body2" fontWeight={600}>
                  {profile.experience?.length || 0} positions listed
                </Typography>
              </MetaBlock>

              {(profile.summary || profile.aiSummary) && (
                <MetaBlock style={{ flex: 1, minWidth: 200 }}>
                  <div className="label">Summary</div>
                  <Typography variant="body2" color="text.secondary" sx={{
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {profile.summary || profile.aiSummary}
                  </Typography>
                </MetaBlock>
              )}
            </ProfileMeta>
          </ProfileInner>
        </ProfileCard>
      )}

      {/* ─── Tab Bar ─── */}
      <TabBar>
        <TabStrip>
          {TABS.map((t, i) => (
            <TabItem key={i} $active={activeTab === i} onClick={() => setActiveTab(i)}>
              {t.icon}
              {t.label}
            </TabItem>
          ))}
        </TabStrip>
      </TabBar>

      {/* ─── Error ─── */}
      {error && (
        <ContentArea style={{ marginBottom: 0 }}>
          <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: 3 }}>
            {error}
          </Alert>
        </ContentArea>
      )}

      {/* ─── Tab Panels ─── */}
      <ContentArea>
        {/* 0, Interview Questions */}
        {activeTab === 0 && (
          <Panel>
            <PanelHeader>
              <h2><QuestionIcon /> AI-Generated Interview Questions</h2>
              <p>Get tailored interview questions based on the candidate's profile and role requirements.</p>
            </PanelHeader>

            <AutoPopBanner>
              <SparkleIcon /> <span><strong>Auto-populated based on profile:</strong> {profile?.title}</span>
            </AutoPopBanner>

            <TextField
              fullWidth label="Role Context"
              placeholder="e.g., Senior Manager, Team Lead, Project Coordinator"
              value={roleContext} onChange={(e) => setRoleContext(e.target.value)}
              sx={{ mb: 2.5 }}
              helperText="Customize the role context or use the auto-generated one"
            />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <GenerateBtn onClick={handleGenerateInterviewQuestions} disabled={loading || !roleContext}>
                {loading && activeTab === 0 ? <CircularProgress size={18} color="inherit" /> : <SparkleIcon style={{ fontSize: 18 }} />}
                Generate Interview Questions
              </GenerateBtn>
              {!interviewQuestions && roleContext && (
                <ReadyBadge>✓ Ready to generate! Click the button above</ReadyBadge>
              )}
            </Box>

            {interviewQuestions && (
              <ResultCard>
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  Generated {interviewQuestions.questions?.length || 0} questions for {interviewQuestions.candidateName}
                </Alert>
                {interviewQuestions.questions?.map((q, idx) => (
                  <Accordion key={idx} sx={{ borderRadius: '10px !important', mb: 1, '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography><strong>Q{idx + 1}:</strong> {q.question}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Chip label={q.category} size="small" sx={{ mb: 1, bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 600 }} />
                      <Typography variant="body2" color="text.secondary">
                        <strong>Rationale:</strong> {q.rationale}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </ResultCard>
            )}
          </Panel>
        )}

        {/* 1, Salary Prediction */}
        {activeTab === 1 && (
          <Panel>
            <PanelHeader>
              <h2><SalaryIcon /> AI Salary Range Prediction</h2>
              <p>Get data-driven salary predictions based on skills, experience, and market trends.</p>
            </PanelHeader>

            <GenerateBtn onClick={handlePredictSalary} disabled={loading}>
              {loading && activeTab === 1 ? <CircularProgress size={18} color="inherit" /> : <TrendingIcon style={{ fontSize: 18 }} />}
              Predict Salary Range
            </GenerateBtn>

            {salaryPrediction?.salaryPrediction && (
              <ResultCard>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                  <Typography variant="h5" fontWeight={700} color="#7c3aed">
                    ${salaryPrediction.salaryPrediction.minSalary?.toLocaleString()} – ${salaryPrediction.salaryPrediction.maxSalary?.toLocaleString()} {salaryPrediction.salaryPrediction.currency}
                  </Typography>
                  <Chip
                    label={`Confidence: ${salaryPrediction.salaryPrediction.confidence}`}
                    size="small"
                    color={salaryPrediction.salaryPrediction.confidence === 'high' ? 'success' : 'warning'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Median: ${salaryPrediction.salaryPrediction.medianSalary?.toLocaleString()}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Key Factors:</Typography>
                <List dense>
                  {salaryPrediction.salaryPrediction.factors?.map((factor, idx) => (
                    <ListItem key={idx}><ListItemText primary={`• ${factor}`} /></ListItem>
                  ))}
                </List>
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  {salaryPrediction.salaryPrediction.marketInsight}
                </Alert>
              </ResultCard>
            )}
          </Panel>
        )}

        {/* 2, Outreach Message */}
        {activeTab === 2 && (
          <Panel>
            <PanelHeader>
              <h2><EmailIcon /> Personalized Outreach Generator</h2>
              <p>Create compelling, personalized recruiting messages that resonate with candidates.</p>
            </PanelHeader>

            <AutoPopBanner>
              <SparkleIcon /> <span><strong>AI has analyzed:</strong> {profile?.user?.firstName}'s profile, skills, and experience</span>
            </AutoPopBanner>

            <TextField fullWidth multiline rows={3} label="Job Details"
              placeholder="Describe the role, company, and key selling points..."
              value={jobDetails} onChange={(e) => setJobDetails(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Provide job details to generate a personalized outreach message"
            />
            <FormControl fullWidth sx={{ mb: 2.5 }}>
              <InputLabel>Message Tone</InputLabel>
              <Select value={outreachTone} label="Message Tone" onChange={(e) => setOutreachTone(e.target.value)}>
                <MenuItem value="professional">Professional</MenuItem>
                <MenuItem value="friendly">Friendly</MenuItem>
                <MenuItem value="enthusiastic">Enthusiastic</MenuItem>
              </Select>
            </FormControl>

            <GenerateBtn onClick={handleGenerateOutreach} disabled={loading || !jobDetails}>
              {loading && activeTab === 2 ? <CircularProgress size={18} color="inherit" /> : <SparkleIcon style={{ fontSize: 18 }} />}
              Generate Outreach Messages
            </GenerateBtn>

            {outreachMessage?.outreachMessage && (
              <ResultCard>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: '#f5f3ff', borderRadius: 2, border: '1px solid #ede9fe' }}>
                      <Typography variant="subtitle2" color="#7c3aed" gutterBottom>Email Subject Line</Typography>
                      <Typography variant="body1">{outreachMessage.outreachMessage.emailSubject}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Typography variant="subtitle2" color="#7c3aed" gutterBottom>LinkedIn Message</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{outreachMessage.outreachMessage.linkedInMessage}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Typography variant="subtitle2" color="#7c3aed" gutterBottom>Email Body</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{outreachMessage.outreachMessage.emailBody}</Typography>
                    </Box>
                  </Grid>
                  {outreachMessage.outreachMessage.personalizedHighlights?.length > 0 && (
                    <Grid item xs={12}>
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Personalized Highlights:</Typography>
                        {outreachMessage.outreachMessage.personalizedHighlights.map((h, i) => (
                          <Typography key={i} variant="body2">• {h}</Typography>
                        ))}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </ResultCard>
            )}
          </Panel>
        )}

        {/* 3, Skill Gap Analysis */}
        {activeTab === 3 && (
          <Panel>
            <PanelHeader>
              <h2><AnalyticsIcon /> Skill Gap Analysis</h2>
              <p>Identify skill matches, gaps, and readiness level for specific roles.</p>
            </PanelHeader>

            <AutoPopBanner>
              <SparkleIcon /> <span><strong>Auto-populated suggestion:</strong> Customize or use the pre-filled requirements</span>
            </AutoPopBanner>

            <TextField fullWidth multiline rows={4} label="Job Requirements"
              placeholder="List required skills and qualifications..."
              value={jobRequirements} onChange={(e) => setJobRequirements(e.target.value)}
              sx={{ mb: 2.5 }}
              helperText="Pre-filled based on candidate's title and skills, customize as needed"
            />

            <GenerateBtn onClick={handleAnalyzeSkillGaps} disabled={loading || !jobRequirements}>
              {loading && activeTab === 3 ? <CircularProgress size={18} color="inherit" /> : <SparkleIcon style={{ fontSize: 18 }} />}
              Analyze Skill Gaps
            </GenerateBtn>

            {skillGapAnalysis?.analysis && (
              <ResultCard>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    Match Score: {skillGapAnalysis.analysis.matchScore}%
                  </Typography>
                  <ScoreBadge $score={skillGapAnalysis.analysis.matchScore}>
                    {skillGapAnalysis.analysis.readinessLevel}
                  </ScoreBadge>
                </Box>
                <LinearProgress variant="determinate" value={skillGapAnalysis.analysis.matchScore}
                  sx={{ mb: 3, height: 8, borderRadius: 4, bgcolor: '#ede9fe',
                    '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed', borderRadius: 4 } }} />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="success.main" gutterBottom>✓ Strong Matches</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {skillGapAnalysis.analysis.strongMatches?.map((s, i) => <Chip key={i} label={s} size="small" color="success" />)}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom>⚠ Skill Gaps</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {skillGapAnalysis.analysis.gaps?.map((s, i) => <Chip key={i} label={s} size="small" color="warning" />)}
                    </Stack>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2">Development Plan:</Typography>
                  <Typography variant="body2">{skillGapAnalysis.analysis.developmentPlan}</Typography>
                </Alert>
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  <Typography variant="subtitle2">Hiring Recommendation:</Typography>
                  <Typography variant="body2">{skillGapAnalysis.analysis.hiringRecommendation}</Typography>
                </Alert>
              </ResultCard>
            )}
          </Panel>
        )}

        {/* 4, Culture Fit */}
        {activeTab === 4 && (
          <Panel>
            <PanelHeader>
              <h2><CultureIcon /> Culture Fit Prediction</h2>
              <p>Assess candidate alignment with company values and culture.</p>
            </PanelHeader>

            <AutoPopBanner>
              <SparkleIcon /> <span><strong>Pre-filled with common values:</strong> Customize to match your company culture</span>
            </AutoPopBanner>

            <TextField fullWidth multiline rows={4} label="Company Values & Culture"
              placeholder="Describe your company's values, work style, and culture..."
              value={companyValues} onChange={(e) => setCompanyValues(e.target.value)}
              sx={{ mb: 2.5 }}
              helperText="Edit the values to match your specific company culture"
            />

            <GenerateBtn onClick={handlePredictCultureFit} disabled={loading || !companyValues}>
              {loading && activeTab === 4 ? <CircularProgress size={18} color="inherit" /> : <SparkleIcon style={{ fontSize: 18 }} />}
              Predict Culture Fit
            </GenerateBtn>

            {cultureFit?.cultureFit && (
              <ResultCard>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Overall Fit Score: {cultureFit.cultureFit.overallFitScore}%
                </Typography>
                <LinearProgress variant="determinate" value={cultureFit.cultureFit.overallFitScore}
                  sx={{ mb: 3, height: 8, borderRadius: 4, bgcolor: '#ede9fe',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: cultureFit.cultureFit.overallFitScore >= 80 ? '#059669' : '#d97706',
                      borderRadius: 4,
                    }
                  }} />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {Object.entries(cultureFit.cultureFit.fitDimensions || {}).map(([key, value]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Typography variant="subtitle2" gutterBottom textTransform="capitalize">
                          {key}: {value.score}%
                        </Typography>
                        <LinearProgress variant="determinate" value={value.score}
                          sx={{ mb: 1, height: 6, borderRadius: 3, bgcolor: '#ede9fe',
                            '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed', borderRadius: 3 } }} />
                        <Typography variant="body2" color="text.secondary">{value.insight}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2">Green Flags:</Typography>
                  {cultureFit.cultureFit.greenFlags?.map((f, i) => (
                    <Typography key={i} variant="body2">✓ {f}</Typography>
                  ))}
                </Alert>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <Typography variant="subtitle2">Recommendation:</Typography>
                  <Typography variant="body2">{cultureFit.cultureFit.recommendation}</Typography>
                </Alert>
              </ResultCard>
            )}
          </Panel>
        )}

        {/* 5, Compare Candidates */}
        {activeTab === 5 && (
          <Panel>
            <PanelHeader>
              <h2><CompareIcon /> AI Candidate Comparison</h2>
              <p>Compare multiple candidates side-by-side with AI-powered analysis.</p>
            </PanelHeader>

            <GenerateBtn onClick={() => setCompareDialog(true)}>
              <CompareIcon style={{ fontSize: 18 }} /> Start Comparison
            </GenerateBtn>

            {comparison && (
              <ResultCard>
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                  {comparison.comparison?.summary}
                </Alert>
                <Grid container spacing={2}>
                  {comparison.comparison?.rankings?.map((ranking, idx) => (
                    <Grid item xs={12} md={6} key={idx}>
                      <Box sx={{
                        border: '1px solid #e2e8f0', borderRadius: 3, p: 2.5,
                        ...(idx === 0 && { borderColor: '#7c3aed', boxShadow: '0 0 0 1px #7c3aed' }),
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6">
                            #{idx + 1}, {comparison.candidates[ranking.candidateIndex]?.name}
                          </Typography>
                          <ScoreBadge $score={ranking.score}>{ranking.score}%</ScoreBadge>
                        </Box>
                        <Typography variant="subtitle2" color="success.main">Strengths:</Typography>
                        {ranking.strengths?.map((s, i) => (
                          <Typography key={i} variant="body2">• {s}</Typography>
                        ))}
                        {ranking.concerns?.length > 0 && (
                          <>
                            <Typography variant="subtitle2" color="warning.main" sx={{ mt: 2 }}>Concerns:</Typography>
                            {ranking.concerns.map((c, i) => (
                              <Typography key={i} variant="body2">• {c}</Typography>
                            ))}
                          </>
                        )}
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="body2" color="text.secondary">{ranking.recommendation}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </ResultCard>
            )}
          </Panel>
        )}
      </ContentArea>

      {/* ─── Compare Dialog ─── */}
      <Dialog open={compareDialog} onClose={() => setCompareDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Compare Candidates</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Profile IDs (comma-separated)"
            placeholder="e.g., 1, 2, 3"
            value={compareProfileIds} onChange={(e) => setCompareProfileIds(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField fullWidth multiline rows={3} label="Job Requirements"
            value={jobRequirements} onChange={(e) => setJobRequirements(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setCompareDialog(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <GenerateBtn onClick={handleCompareCandidates} disabled={loading || !compareProfileIds}>
            Compare
          </GenerateBtn>
        </DialogActions>
      </Dialog>
    </PageWrap>
  );
};

export default RecruiterTools;
