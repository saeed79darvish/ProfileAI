import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { CircularProgress } from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Warning
} from '@mui/icons-material';

// === Styled Components ===
const Container = styled.div`
  background: white;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
`;

const IconBox = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg { font-size: 24px; color: #667eea; }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ScoreSection = styled.div`
  display: flex;
  align-items: center;
  gap: 28px;
  margin-bottom: 24px;
  animation: ${fadeIn} 0.4s ease;
`;

const RingContainer = styled.div`
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
`;

const ScoreLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  
  .number {
    font-size: 28px;
    font-weight: 800;
    color: #1a1a2e;
    line-height: 1;
  }
  
  .pct {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }
`;

const ScoreSummary = styled.div`
  flex: 1;
  
  .level {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
    color: ${p => p.$color || '#667eea'};
  }
  
  .desc {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
  }
`;

const KeywordsSection = styled.div`
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

const KeywordGroup = styled.div`
  margin-bottom: 16px;
  
  &:last-child { margin-bottom: 0; }
`;

const GroupLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${p => p.$color || '#374151'};
  margin-bottom: 8px;
  
  svg { font-size: 16px; }
`;

const TagGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Tag = styled.span`
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  background: ${p => p.$variant === 'present' ? '#10b98112' : '#f59e0b12'};
  color: ${p => p.$variant === 'present' ? '#059669' : '#d97706'};
  border: 1px solid ${p => p.$variant === 'present' ? '#10b98130' : '#f59e0b30'};
`;

const AnalyzeBtn = styled.button`
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #1a1a2e, #2d2b55);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(26, 26, 46, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px 0;
  
  p {
    font-size: 14px;
    color: #9ca3af;
    margin: 12px 0 0;
  }
  
  svg {
    font-size: 40px;
    color: #e5e7eb;
  }
`;

// === Helpers ===
function getScoreColor(score) {
  if (score >= 70) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function getScoreLevel(score) {
  if (score >= 80) return { label: 'Excellent Match', desc: 'Your profile aligns very well with this role.' };
  if (score >= 60) return { label: 'Good Match', desc: 'Strong alignment with some gaps to address.' };
  if (score >= 40) return { label: 'Moderate Match', desc: 'Several areas could be improved for this role.' };
  return { label: 'Low Match', desc: 'Consider tailoring your profile significantly.' };
}

function ScoreRing({ score }) {
  const color = getScoreColor(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <RingContainer>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Background ring */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#f3f4f6" strokeWidth="8"
        />
        {/* Progress ring */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <ScoreLabel>
        <div className="number">{score}</div>
        <div className="pct">%</div>
      </ScoreLabel>
    </RingContainer>
  );
}

// === Component ===
export default function JobMatchAnalysis({ onAnalyze, loading: externalLoading }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const isLoading = externalLoading || loading;

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const data = await onAnalyze();
      setResult(data);
      setAnalyzed(true);
    } catch (err) {
      console.error('Match analysis failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const score = result?.matchScore ?? result?.overallKeywordScore ?? result?.score ?? 0;
  const present = result?.matchedKeywords || result?.present || [];
  const missing = result?.missingKeywords || result?.missing || [];
  const level = getScoreLevel(score);
  const color = getScoreColor(score);

  return (
    <Container>
      <Header>
        <IconBox><TrendingUp /></IconBox>
        <Title>Job Match Analysis</Title>
      </Header>

      {!analyzed && !isLoading && (
        <>
          <EmptyState>
            <TrendingUp />
            <p>Analyze this job to see how well your profile matches</p>
          </EmptyState>
          <AnalyzeBtn onClick={handleAnalyze} disabled={isLoading}>
            Analyze This Job
          </AnalyzeBtn>
        </>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 14 }}>
          <CircularProgress size={40} sx={{ color: '#667eea' }} />
          <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>Analyzing match...</span>
        </div>
      )}

      {analyzed && !isLoading && result && (
        <>
          <ScoreSection>
            <ScoreRing score={score} />
            <ScoreSummary $color={color}>
              <div className="level">{level.label}</div>
              <div className="desc">{level.desc}</div>
            </ScoreSummary>
          </ScoreSection>

          <KeywordsSection>
            {present.length > 0 && (
              <KeywordGroup>
                <GroupLabel $color="#10b981">
                  <CheckCircle /> Matched Keywords ({present.length})
                </GroupLabel>
                <TagGrid>
                  {present.map((kw, i) => (
                    <Tag key={i} $variant="present">{kw}</Tag>
                  ))}
                </TagGrid>
              </KeywordGroup>
            )}

            {missing.length > 0 && (
              <KeywordGroup>
                <GroupLabel $color="#f59e0b">
                  <Warning /> Missing Keywords ({missing.length})
                </GroupLabel>
                <TagGrid>
                  {missing.map((kw, i) => (
                    <Tag key={i} $variant="missing">{kw}</Tag>
                  ))}
                </TagGrid>
              </KeywordGroup>
            )}
          </KeywordsSection>

          <div style={{ marginTop: 20 }}>
            <AnalyzeBtn onClick={handleAnalyze} disabled={isLoading}>
              Re-analyze
            </AnalyzeBtn>
          </div>
        </>
      )}
    </Container>
  );
}
