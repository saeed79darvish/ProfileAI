import React, { useState, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';

// === Animations ===
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

// === Severity / category config ===
const severityConfig = {
  critical: { dot: '#ef4444', label: 'CRITICAL', bg: '#fef2f2', color: '#dc2626' },
  important: { dot: '#f59e0b', label: 'IMPORTANT', bg: '#fffbeb', color: '#d97706' },
  nice_to_have: { dot: '#3b82f6', label: 'NICE TO HAVE', bg: '#eff6ff', color: '#2563eb' }
};

const typeConfig = {
  required: { label: 'Required', bg: '#fef2f2', color: '#ef4444' },
  nice_to_have: { label: 'Nice to Have', bg: '#eff6ff', color: '#3b82f6' }
};

const categoryLabels = {
  technical: { icon: '💻', label: 'TECHNICAL SKILLS' },
  experience: { icon: '📋', label: 'EXPERIENCE' },
  certification: { icon: '📜', label: 'CERTIFICATIONS' },
  soft_skill: { icon: '🤝', label: 'SOFT SKILLS' },
  domain_knowledge: { icon: '🧠', label: 'DOMAIN KNOWLEDGE' }
};

// === Styled Components ===
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;

  @media (max-width: 768px) {
    max-height: 100vh;
    height: 100vh;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 28px 28px 20px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 20px 16px 16px;
    gap: 12px;
  }
`;

const HeaderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
`;

const HeaderText = styled.div`
  flex: 1;

  h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #1a1a2e;
  }

  p {
    margin: 4px 0 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.4;
  }
`;

const ProgressSection = styled.div`
  margin: 0 28px 16px;
  padding: 14px 18px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    margin: 0 16px 12px;
  }
`;

const ProgressRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const ProgressLabel = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.$done ? '#10b981' : '#1a1a2e'};
`;

const ProgressStats = styled.div`
  display: flex;
  gap: 14px;
  font-size: 13px;

  .accepted { color: #3b82f6; font-weight: 600; }
  .skipped { color: #6b7280; font-weight: 600; }
  .left { color: #9ca3af; }
`;

const ProgressBar = styled.div`
  height: 6px;
  border-radius: 4px;
  background: #e5e7eb;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 4px;
  background: #3b82f6;
  transition: width 0.4s ease;
`;

const QuickActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 28px 12px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    margin: 0 16px 12px;
    flex-wrap: wrap;
  }
`;

const QuickBtn = styled.button`
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid ${p => p.$primary ? '#3b82f6' : '#d1d5db'};
  background: white;
  color: ${p => p.$primary ? '#3b82f6' : '#374151'};

  &:hover {
    background: ${p => p.$primary ? '#eff6ff' : '#f9fafb'};
  }
`;

const ResetBtn = styled.button`
  padding: 7px 12px;
  border: none;
  background: none;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover { color: #374151; text-decoration: underline; }
`;

const InfoAlert = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 28px 16px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
  flex-shrink: 0;

  @media (max-width: 768px) {
    margin: 0 16px 12px;
    font-size: 12px;
  }

  .icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  strong { font-weight: 700; }
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 28px 16px;
  min-height: 0;

  @media (max-width: 768px) {
    padding: 0 16px 16px;
  }
`;

const CategorySection = styled.div`
  margin-bottom: 16px;
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  cursor: pointer;

  .icon { font-size: 16px; }

  .label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #374151;
  }

  .count {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    background: #f3f4f6;
    padding: 1px 8px;
    border-radius: 10px;
  }

  .toggle {
    margin-left: auto;
    font-size: 18px;
    color: #9ca3af;
    transition: transform 0.2s;
  }
`;

const GapCard = styled.div`
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 12px;
  background: white;
  animation: ${fadeIn} 0.2s ease;
  transition: border-color 0.2s;

  @media (max-width: 768px) {
    padding: 14px 16px;
    border-radius: 12px;
    margin-bottom: 10px;
  }

  ${p => p.$accepted && css`
    border-color: #bfdbfe;
    background: #f8faff;
  `}

  ${p => p.$skipped && css`
    border-color: #d1d5db;
    background: #fafafa;
  `}
`;

const GapTop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 8px;
  }
`;

const SeverityDot = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${p => p.$color};
  flex-shrink: 0;
`;

const GapSkillName = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
`;

const Badge = styled.span`
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: ${p => p.$bg};
  color: ${p => p.$color};
`;

const GapActions = styled.div`
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;

  @media (max-width: 768px) {
    margin-left: 0;
    width: 100%;
    margin-top: 6px;
  }
`;

const GapBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  @media (max-width: 768px) {
    flex: 1;
    justify-content: center;
    padding: 10px 12px;
  }

  ${p => p.$accepted && css`
    border: 1.5px solid #3b82f6;
    background: #eff6ff;
    color: #3b82f6;
  `}

  ${p => p.$skipped && css`
    border: 1.5px solid #9ca3af;
    background: #f3f4f6;
    color: #6b7280;
  `}

  ${p => !p.$accepted && !p.$skipped && p.$primary && css`
    border: 1.5px solid #3b82f6;
    background: white;
    color: #3b82f6;
    &:hover { background: #eff6ff; }
  `}

  ${p => !p.$accepted && !p.$skipped && !p.$primary && css`
    border: 1.5px solid #d1d5db;
    background: white;
    color: #374151;
    &:hover { background: #f9fafb; }
  `}
`;

const UndoBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  font-size: 14px;
  padding: 2px;
  margin-left: 2px;

  &:hover { color: #374151; }
`;

const ExpandBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  font-size: 16px;
  padding: 2px 4px;
  transition: transform 0.2s;
  transform: ${p => p.$expanded ? 'rotate(180deg)' : 'rotate(0)'};

  &:hover { color: #374151; }
`;

const GapDescription = styled.p`
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
  margin: 0 0 10px;
`;

const ReasonBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 13px;
  font-style: italic;
  line-height: 1.5;
  background: ${p => p.$type === 'reason' ? '#fffbeb' : '#fef3e0'};
  color: ${p => p.$type === 'reason' ? '#92400e' : '#9a3412'};
  border: 1px solid ${p => p.$type === 'reason' ? '#fde68a' : '#fed7aa'};

  .icon { flex-shrink: 0; font-size: 16px; }
`;

const CoveredSection = styled.div`
  margin-top: 8px;
  padding: 14px 18px;
  border-radius: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
`;

const CoveredTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #15803d;
  margin-bottom: 10px;
`;

const CoveredItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #dcfce7;

  &:last-child { border-bottom: none; }

  .icon { color: #22c55e; font-size: 16px; flex-shrink: 0; margin-top: 2px; }
  .name { font-weight: 600; color: #1a1a2e; min-width: 100px; flex-shrink: 0; }
  .reason { color: #6b7280; line-height: 1.4; }

  @media (max-width: 768px) {
    flex-wrap: wrap;
    .name { min-width: unset; }
    .reason { flex-basis: 100%; padding-left: 24px; margin-top: 2px; }
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px 24px;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;

  @media (max-width: 768px) {
    padding: 12px 16px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
    background: white;
    z-index: 10;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
  }
`;

const CancelBtn = styled.button`
  padding: 10px 24px;
  border-radius: 10px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  @media (max-width: 768px) {
    flex: 1;
  }

  &:hover { background: #f9fafb; }
`;

const ContinueBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  border: none;
  background: ${p => p.disabled ? '#9ca3af' : '#3b82f6'};
  color: white;
  font-size: 14px;
  font-weight: 600;
  font-style: italic;
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;

  @media (max-width: 768px) {
    flex: 2;
  }

  &:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .badge {
    padding: 2px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.25);
    font-size: 12px;
    font-weight: 700;
    font-style: normal;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;

  .icon { font-size: 48px; margin-bottom: 10px; }
  h4 { font-size: 18px; font-weight: 700; color: #10b981; margin: 0 0 6px; }
  p { font-size: 14px; color: #6b7280; margin: 0; }
`;

// === Component ===
export default function GapReviewDialog({ open, onClose, gaps, satisfiedAlternatives = [], onContinue, loading }) {
  const [selections, setSelections] = useState({});
  const [expandedGaps, setExpandedGaps] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

  // Group gaps by category
  const groupedGaps = useMemo(() => {
    const groups = {};
    (gaps || []).forEach((gap, index) => {
      const cat = gap.category || 'technical';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...gap, originalIndex: index });
    });
    return groups;
  }, [gaps]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = gaps?.length || 0;
    const accepted = Object.values(selections).filter(v => v === 'accept').length;
    const skipped = Object.values(selections).filter(v => v === 'skip').length;
    const left = total - accepted - skipped;
    const allDone = total > 0 && left === 0;
    return { total, accepted, skipped, left, allDone };
  }, [gaps, selections]);

  const handleToggle = (index, action) => {
    setSelections(prev => {
      if (prev[index] === action) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: action };
    });
  };

  const handleSelectAll = (action) => {
    const newSelections = {};
    (gaps || []).forEach((_, i) => { newSelections[i] = action; });
    setSelections(newSelections);
  };

  const toggleGapExpand = (idx) => {
    setExpandedGaps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: prev[cat] === false }));
  };

  const handleContinue = () => {
    const acceptedGaps = [];
    const skippedGaps = [];
    const acceptedGapObjects = [];

    (gaps || []).forEach((gap, i) => {
      const selection = selections[i];
      if (selection === 'accept') {
        acceptedGaps.push(gap.skill);
        acceptedGapObjects.push({ ...gap, status: 'pending' });
      } else if (selection === 'skip') {
        skippedGaps.push(gap.skill);
      } else {
        acceptedGaps.push(gap.skill);
        acceptedGapObjects.push({ ...gap, status: 'pending' });
      }
    });

    onContinue({ acceptedGaps, skippedGaps, acceptedGapObjects });
  };

  const progressPct = stats.total > 0 ? ((stats.accepted + stats.skipped) / stats.total) * 100 : 0;
  const gapCount = stats.accepted + stats.left; // gaps that will be accepted
  const isMobile = useMediaQuery('(max-width:768px)');

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 20, overflow: 'hidden', maxHeight: isMobile ? '100vh' : '88vh' } }}
    >
      <ModalContainer>
        <Header>
          <HeaderIcon>🔍</HeaderIcon>
          <HeaderText>
            <h3>Skill Gap Review</h3>
            <p>Review the gaps between your profile and this job. Accept gaps to add to your learning plan, or skip ones you already have.</p>
          </HeaderText>
        </Header>

        <ProgressSection>
          <ProgressRow>
            <ProgressLabel $done={stats.allDone}>
              {stats.allDone ? 'All reviewed!' : `${stats.accepted + stats.skipped} of ${stats.total} reviewed`}
            </ProgressLabel>
            <ProgressStats>
              <span className="accepted">{stats.accepted} accepted</span>
              <span className="skipped">{stats.skipped} skipped</span>
              {!stats.allDone && <span className="left">{stats.left} left</span>}
            </ProgressStats>
          </ProgressRow>
          <ProgressBar>
            <ProgressFill style={{ width: `${progressPct}%` }} />
          </ProgressBar>
        </ProgressSection>

        <QuickActions>
          <QuickBtn $primary onClick={() => handleSelectAll('accept')}>Accept All Gaps</QuickBtn>
          <QuickBtn onClick={() => handleSelectAll('skip')}>Skip All (I Have These)</QuickBtn>
          {(stats.accepted > 0 || stats.skipped > 0) && (
            <ResetBtn onClick={() => setSelections({})}>Reset</ResetBtn>
          )}
        </QuickActions>

        <InfoAlert>
          <span className="icon">ℹ️</span>
          <span>
            <strong>Accepted gaps</strong> are saved to your learning plan. <strong>Skipped gaps</strong> signal areas where the AI will look harder for evidence in your experience.
          </span>
        </InfoAlert>

        <ScrollArea>
          {Object.entries(groupedGaps).map(([category, categoryGaps]) => {
            const catConfig = categoryLabels[category] || { icon: '📌', label: category.toUpperCase() };
            const collapsed = expandedCategories[category] === false;

            return (
              <CategorySection key={category}>
                <CategoryHeader onClick={() => toggleCategory(category)}>
                  <span className="icon">{catConfig.icon}</span>
                  <span className="label">{catConfig.label}</span>
                  <span className="count">{categoryGaps.length}</span>
                  <span className="toggle">{collapsed ? '▸' : '▾'}</span>
                </CategoryHeader>

                {!collapsed && categoryGaps.map((gap) => {
                  const idx = gap.originalIndex;
                  const selected = selections[idx];
                  const severity = severityConfig[gap.severity] || severityConfig.nice_to_have;
                  const gapType = typeConfig[gap.type] || typeConfig.required;
                  const isExpanded = expandedGaps[idx] !== false; // default expanded

                  return (
                    <GapCard key={idx} $accepted={selected === 'accept'} $skipped={selected === 'skip'}>
                      <GapTop>
                        <SeverityDot $color={severity.dot} />
                        <GapSkillName>{gap.skill}</GapSkillName>
                        <Badge $bg={severity.bg} $color={severity.color}>{severity.label}</Badge>
                        {gap.type && (
                          <Badge $bg={gapType.bg} $color={gapType.color}>{gapType.label}</Badge>
                        )}
                        <GapActions>
                          {selected === 'accept' ? (
                            <>
                              <GapBtn $accepted>
                                ✓ Gap Accepted
                              </GapBtn>
                              <UndoBtn onClick={() => handleToggle(idx, 'accept')} title="Undo">↺</UndoBtn>
                            </>
                          ) : selected === 'skip' ? (
                            <>
                              <GapBtn $skipped>
                                ↷ I Have This
                              </GapBtn>
                              <UndoBtn onClick={() => handleToggle(idx, 'skip')} title="Undo">↺</UndoBtn>
                            </>
                          ) : (
                            <>
                              <GapBtn $primary onClick={() => handleToggle(idx, 'accept')}>Accept Gap</GapBtn>
                              <GapBtn onClick={() => handleToggle(idx, 'skip')}>I Have This</GapBtn>
                            </>
                          )}
                          <ExpandBtn $expanded={isExpanded} onClick={() => toggleGapExpand(idx)}>▾</ExpandBtn>
                        </GapActions>
                      </GapTop>

                      {isExpanded && (
                        <>
                          <GapDescription>{gap.description}</GapDescription>
                          {gap.reason && (
                            <ReasonBox $type="reason">
                              <span className="icon">💡</span>
                              <span>{gap.reason}</span>
                            </ReasonBox>
                          )}
                          {gap.learningResource && (
                            <ReasonBox $type="resource">
                              <span className="icon">🎓</span>
                              <span>{gap.learningResource}</span>
                            </ReasonBox>
                          )}
                        </>
                      )}
                    </GapCard>
                  );
                })}
              </CategorySection>
            );
          })}

          {(!gaps || gaps.length === 0) && !satisfiedAlternatives?.length && (
            <EmptyState>
              <div className="icon">✅</div>
              <h4>No gaps found!</h4>
              <p>Your profile is a great match for this job.</p>
            </EmptyState>
          )}

          {satisfiedAlternatives && satisfiedAlternatives.length > 0 && (
            <CoveredSection>
              <CoveredTitle>
                <span>✅</span> Already Covered ({satisfiedAlternatives.length})
              </CoveredTitle>
              {satisfiedAlternatives.map((alt, i) => (
                <CoveredItem key={i}>
                  <span className="icon">✓</span>
                  <span className="name">{alt.skill}</span>
                  <span className="reason">{alt.reason || alt.description}</span>
                </CoveredItem>
              ))}
            </CoveredSection>
          )}
        </ScrollArea>

        <Footer>
          <CancelBtn onClick={onClose} disabled={loading}>Cancel</CancelBtn>
          <ContinueBtn onClick={handleContinue} disabled={loading}>
            {loading ? 'Tailoring...' : 'Continue to Tailor'}
            {!loading && gapCount > 0 && <span className="badge">{gapCount} gaps</span>}
          </ContinueBtn>
        </Footer>
      </ModalContainer>
    </Dialog>
  );
}
