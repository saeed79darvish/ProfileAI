import React, { useState, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import {
  ArrowBack,
  MoreHoriz,
  Download,
  OpenInFull,
  CheckCircle,
} from '@mui/icons-material';

// === Helpers ===
function getScoreColor(score) {
  if (score >= 70) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

const flattenSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'object') return Object.values(skills).flat();
  return [];
};

// Parse "X of Y" from matchAnalysis.keywordMatch
function parseKeywordMatch(str) {
  if (!str) return null;
  const m = str.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (m) return { matched: parseInt(m[1], 10), total: parseInt(m[2], 10) };
  return null;
}

// === Animations ===
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// === Styled Components ===
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  background: #f9fafb;

  @media (max-width: 768px) {
    max-height: 100vh;
    height: 100vh;
    background: #f9fafb;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 12px 16px;
    padding-top: max(12px, env(safe-area-inset-top));
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BackBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  color: #374151;
  display: flex;
  align-items: center;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
  svg { font-size: 22px; }
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
`;

const MoreBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  transition: background 0.15s;
  &:hover { background: #f3f4f6; }
  svg { font-size: 22px; }
`;

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

/* ── Score Hero ── */
const ScoreHero = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px 20px;
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border-bottom: 1px solid #d1fae5;
  animation: ${fadeIn} 0.4s ease;

  @media (max-width: 768px) {
    padding: 20px 16px;
    gap: 16px;
  }
`;

const RingWrap = styled.div`
  position: relative;
  width: 90px;
  height: 90px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 80px;
    height: 80px;
  }
`;

const RingText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  font-weight: 800;
  color: #1a1a2e;

  @media (max-width: 768px) {
    font-size: 20px;
  }
`;

const ScoreInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ReadyFor = styled.div`
  font-size: 20px;
  font-weight: 800;
  color: #1a1a2e;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const MatchImproved = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const ImproveBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  background: #d1fae5;
  color: #059669;
`;

/* ── Stats Card ── */
const StatsCard = styled.div`
  margin: 16px 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
  animation: ${fadeIn} 0.4s ease 0.1s both;

  @media (max-width: 768px) {
    margin: 12px 16px;
  }
`;

const StatRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #f3f4f6;

  &:last-child { border-bottom: none; }
`;

const StatLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #374151;
  font-weight: 500;
`;

const AIBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  background: #d1fae5;
  color: #059669;
  flex-shrink: 0;
`;

const StatValue = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.$color || '#059669'};
`;

/* ── Resume Preview ── */
const PreviewSection = styled.div`
  margin: 0 20px 16px;
  animation: ${fadeIn} 0.4s ease 0.2s both;

  @media (max-width: 768px) {
    margin: 0 16px 16px;
  }
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const TabGroup = styled.div`
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
`;

const PreviewTab = styled.button`
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.$active ? '#1a1a2e' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#6b7280'};

  &:hover {
    background: ${p => p.$active ? '#1a1a2e' : '#e5e7eb'};
  }
`;

const ExpandBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #d1d5db; background: #f9fafb; }
  svg { font-size: 18px; }
`;

const ResumeCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 24px;
  min-height: 300px;
  max-height: 450px;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 18px;
    min-height: 250px;
    max-height: 380px;
  }
`;

const ResumeName = styled.h2`
  font-size: 20px;
  font-weight: 800;
  color: #1a1a2e;
  margin: 0 0 4px;
`;

const ResumeContact = styled.div`
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 16px;
`;

const ResumeDivider = styled.div`
  height: 3px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 2px;
  margin-bottom: 16px;
`;

const ResumeSectionWrap = styled.div`
  margin-bottom: 16px;
`;

const ResumeSectionTitle = styled.h4`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #1a1a2e;
  margin: 0 0 8px;
`;

const SkillChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const SkillChip = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: ${p => p.$new ? '#ede9fe' : '#f3f4f6'};
  color: ${p => p.$new ? '#5b21b6' : '#374151'};
  border: 1px solid ${p => p.$new ? '#ddd6fe' : '#e5e7eb'};
`;

const ExpEntry = styled.div`
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
`;

const ExpHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const ExpTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
`;

const ExpPeriod = styled.div`
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
`;

const ExpDesc = styled.div`
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  margin-top: 4px;

  .shimmer-bar {
    height: 10px;
    border-radius: 4px;
    background: #f3f4f6;
    margin-bottom: 6px;
  }
`;

const SummaryText = styled.div`
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;

  .shimmer-bar {
    height: 10px;
    border-radius: 4px;
    background: #f3f4f6;
    margin-bottom: 6px;
  }
`;

/* ── Sticky Footer ── */
const Footer = styled.div`
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
`;

const DownloadBtn = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  color: white;
  background: linear-gradient(135deg, #667eea, #764ba2);
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.35);
  }
  &:active { transform: scale(0.98); }
  svg { font-size: 22px; }
`;

const SaveRow = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
`;

const SecondaryBtn = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #667eea; color: #667eea; }
  &:disabled { opacity: 0.5; cursor: default; }

  &.success {
    border-color: #10b981;
    color: #10b981;
    background: #ecfdf5;
  }

  svg { font-size: 18px; }
`;

// === Score Ring SVG ===
function ScoreRing({ score, size = 90 }) {
  const color = getScoreColor(score);
  const strokeWidth = 7;
  const radius = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <RingWrap style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <RingText>{score}%</RingText>
    </RingWrap>
  );
}

// === Compute stats from tailored data ===
function computeStats(tailoredProfile, originalProfile) {
  const changelog = tailoredProfile?.changelog || [];
  const origSkills = flattenSkills(originalProfile?.skills);
  const newSkills = flattenSkills(tailoredProfile?.skills);

  // Summary changes
  const summaryChanges = changelog.filter(c =>
    c.section === 'summary'
  ).length || (tailoredProfile?.summary ? 1 : 0);

  // Skills added
  const skillsAdded = Math.max(0, newSkills.length - origSkills.length);

  // Bullets rewritten (experience entries)
  const expEntries = changelog.filter(c =>
    c.section?.startsWith('experience') || c.section === 'experience'
  );
  const totalBullets = (tailoredProfile?.experience || []).length;
  const rewrittenBullets = expEntries.length || totalBullets;

  // Keywords matching
  const kwMatch = parseKeywordMatch(tailoredProfile?.matchAnalysis?.keywordMatch);

  return { summaryChanges, skillsAdded, rewrittenBullets, totalBullets, kwMatch };
}

// === Mini resume preview ===
function MiniResumePreview({ profile, originalProfile, tab }) {
  const data = tab === 'before' ? originalProfile : profile;
  if (!data) return <ResumeCard><SummaryText style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No data available</SummaryText></ResumeCard>;

  const skills = flattenSkills(data.skills);
  const origSkills = tab === 'after' ? new Set(flattenSkills(originalProfile?.skills).map(s => s.toLowerCase())) : new Set();
  const experience = data.experience || [];
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Your Name';
  const contactParts = [data.email, data.location, data.linkedinUrl].filter(Boolean);

  return (
    <ResumeCard>
      <ResumeName>{name}</ResumeName>
      {contactParts.length > 0 && (
        <ResumeContact>{contactParts.join(' · ')}</ResumeContact>
      )}
      <ResumeDivider />

      {data.summary && (
        <ResumeSectionWrap>
          <ResumeSectionTitle>Summary</ResumeSectionTitle>
          <SummaryText>
            <div className="shimmer-bar" style={{ width: '100%' }} />
            <div className="shimmer-bar" style={{ width: '85%' }} />
            <div className="shimmer-bar" style={{ width: '60%' }} />
          </SummaryText>
        </ResumeSectionWrap>
      )}

      {skills.length > 0 && (
        <ResumeSectionWrap>
          <ResumeSectionTitle>Skills</ResumeSectionTitle>
          <SkillChips>
            {skills.slice(0, 8).map((s, i) => (
              <SkillChip key={i} $new={tab === 'after' && !origSkills.has(s.toLowerCase())}>
                {s}
              </SkillChip>
            ))}
            {skills.length > 8 && <SkillChip>+{skills.length - 8}</SkillChip>}
          </SkillChips>
        </ResumeSectionWrap>
      )}

      {experience.length > 0 && (
        <ResumeSectionWrap>
          <ResumeSectionTitle>Experience</ResumeSectionTitle>
          {experience.slice(0, 3).map((exp, i) => (
            <ExpEntry key={i}>
              <ExpHeader>
                <ExpTitle>{exp.company}{exp.title ? ` · ${exp.title}` : ''}</ExpTitle>
                {exp.period && <ExpPeriod>{exp.period}</ExpPeriod>}
              </ExpHeader>
              <ExpDesc>
                <div className="shimmer-bar" style={{ width: '90%' }} />
                <div className="shimmer-bar" style={{ width: '70%' }} />
              </ExpDesc>
            </ExpEntry>
          ))}
        </ResumeSectionWrap>
      )}
    </ResumeCard>
  );
}

// === Component ===
export default function TailoredResultsModal({
  open,
  onClose,
  tailoredProfile,
  originalProfile,
  jobTitle,
  company,
  onSave,
  onDownload,
  saving,
  saved,
}) {
  const [previewTab, setPreviewTab] = useState('after');
  const isMobile = useMediaQuery('(max-width:768px)');

  const matchScore =
    tailoredProfile?.matchAnalysis?.overallScore ||
    tailoredProfile?.matchScore || 0;

  const origScore = useMemo(() => {
    if (!tailoredProfile) return 0;
    if (tailoredProfile.matchAnalysis?.previousScore) return tailoredProfile.matchAnalysis.previousScore;
    return Math.max(0, Math.round(matchScore * 0.75));
  }, [matchScore, tailoredProfile]);

  const improvement = matchScore - origScore;
  const stats = useMemo(() => computeStats(tailoredProfile, originalProfile), [tailoredProfile, originalProfile]);

  if (!tailoredProfile) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 20, overflow: 'hidden' } }}
    >
      <ModalContainer>
        <Header>
          <HeaderLeft>
            <BackBtn onClick={onClose}><ArrowBack /></BackBtn>
            <HeaderTitle>Tailored resume</HeaderTitle>
          </HeaderLeft>
          <MoreBtn><MoreHoriz /></MoreBtn>
        </Header>

        <ScrollBody>
          {matchScore > 0 && (
            <ScoreHero>
              <ScoreRing score={matchScore} size={isMobile ? 80 : 90} />
              <ScoreInfo>
                <ReadyFor>Ready for {company || jobTitle || 'this role'}</ReadyFor>
                <MatchImproved>
                  Match improved
                  {improvement > 0 && <ImproveBadge>+{improvement}%</ImproveBadge>}
                  {origScore > 0 && <span>from {origScore}%</span>}
                </MatchImproved>
              </ScoreInfo>
            </ScoreHero>
          )}

          <StatsCard>
            {stats.summaryChanges > 0 && (
              <StatRow>
                <StatLeft><AIBadge>AI</AIBadge> Summary rewritten</StatLeft>
                <StatValue $color="#059669">{stats.summaryChanges} change{stats.summaryChanges !== 1 ? 's' : ''}</StatValue>
              </StatRow>
            )}
            {stats.skillsAdded > 0 && (
              <StatRow>
                <StatLeft><AIBadge>AI</AIBadge> Skills added</StatLeft>
                <StatValue $color="#059669">+{stats.skillsAdded}</StatValue>
              </StatRow>
            )}
            {stats.rewrittenBullets > 0 && (
              <StatRow>
                <StatLeft><AIBadge>AI</AIBadge> Bullets rewritten</StatLeft>
                <StatValue $color="#059669">{stats.rewrittenBullets} of {stats.totalBullets || stats.rewrittenBullets}</StatValue>
              </StatRow>
            )}
            {stats.kwMatch && (
              <StatRow>
                <StatLeft style={{ gap: 10 }}>
                  <span style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>🔑</span>
                  Keywords now matching
                </StatLeft>
                <StatValue $color="#059669">{stats.kwMatch.matched} / {stats.kwMatch.total}</StatValue>
              </StatRow>
            )}
          </StatsCard>

          <PreviewSection>
            <PreviewHeader>
              <TabGroup>
                <PreviewTab $active={previewTab === 'after'} onClick={() => setPreviewTab('after')}>After</PreviewTab>
                <PreviewTab $active={previewTab === 'before'} onClick={() => setPreviewTab('before')}>Before</PreviewTab>
              </TabGroup>
              <ExpandBtn onClick={onDownload}>
                <OpenInFull /> Expand
              </ExpandBtn>
            </PreviewHeader>
            <MiniResumePreview
              profile={tailoredProfile}
              originalProfile={originalProfile}
              tab={previewTab}
            />
          </PreviewSection>
        </ScrollBody>

        <Footer>
          {(onSave || saved) && (
            <SaveRow>
              {onSave && !saved && (
                <SecondaryBtn onClick={onSave} disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save to Profile'}
                </SecondaryBtn>
              )}
              {saved && (
                <SecondaryBtn className="success" disabled>
                  <CheckCircle /> Saved!
                </SecondaryBtn>
              )}
            </SaveRow>
          )}
          <DownloadBtn onClick={onDownload}>
            <Download /> Download PDF
          </DownloadBtn>
        </Footer>
      </ModalContainer>
    </Dialog>
  );
}
