
import styled from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
`;

export const HeroSection = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  padding: 2rem 0;
  color: white;
  position: relative;
  overflow: hidden;
  margin-bottom: 24px;

  &::before {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -80px;
    left: -40px;
    width: 250px;
    height: 250px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
`;

export const HeroContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  h1 {
    font-size: 28px;
    color: white;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }
`;

export const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

export const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  .label {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 8px;
  }
  
  .value {
    font-size: 28px;
    font-weight: 700;
    color: ${props => props.$color || '#1e293b'};
  }
  
  .trend {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
  }
`;

export const FiltersRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

export const FilterSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  color: #1e293b;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
  }
`;

export const SearchInput = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  flex: 1;
  max-width: 300px;
  
  input {
    border: none;
    outline: none;
    flex: 1;
    font-size: 14px;
  }
  
  svg {
    color: #64748b;
    font-size: 20px;
  }
`;

export const InterviewsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const InterviewCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: ${props => {
    if (props.$hasResults) {
      const score = props.$score;
      if (score >= 80) return 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)';
      if (score >= 60) return 'linear-gradient(135deg, #fef9c3 0%, #fefce8 100%)';
      if (score > 0) return 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)';
    }
    return 'white';
  }};
`;

export const CandidateInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const Avatar = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid ${props => {
    if (props.$score >= 80) return '#22c55e';
    if (props.$score >= 60) return '#eab308';
    if (props.$score > 0) return '#ef4444';
    return '#e2e8f0';
  }};
`;

export const AvatarPlaceholder = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 20px;
`;

export const CandidateDetails = styled.div`
  .name {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 4px;
  }
  
  .headline {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 4px;
  }
  
  .job {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #7c3aed;
    font-weight: 500;
  }
`;

export const ScoreSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const ScoreCircle = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${props => {
    const score = props.$score;
    if (score >= 80) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
    if (score >= 60) return 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)';
    if (score > 0) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    return 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
  }};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px ${props => {
    const score = props.$score;
    if (score >= 80) return 'rgba(34, 197, 94, 0.3)';
    if (score >= 60) return 'rgba(234, 179, 8, 0.3)';
    if (score > 0) return 'rgba(239, 68, 68, 0.3)';
    return 'rgba(100, 116, 139, 0.3)';
  }};
  
  .score {
    font-size: 24px;
    font-weight: 700;
  }
  
  .label {
    font-size: 10px;
    text-transform: uppercase;
    opacity: 0.9;
  }
`;

export const RecommendationBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  
  ${props => {
    switch (props.$recommendation) {
      case 'strongly_recommend':
        return `
          background: #dcfce7;
          color: #166534;
        `;
      case 'recommend':
        return `
          background: #d1fae5;
          color: #065f46;
        `;
      case 'consider':
        return `
          background: #fef9c3;
          color: #854d0e;
        `;
      case 'not_recommend':
        return `
          background: #fee2e2;
          color: #991b1b;
        `;
      default:
        return `
          background: #f1f5f9;
          color: #64748b;
        `;
    }
  }}
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  
  ${props => {
    switch (props.$status) {
      case 'completed':
        return `
          background: #dcfce7;
          color: #166534;
        `;
      case 'in_progress':
        return `
          background: #fef9c3;
          color: #854d0e;
        `;
      case 'scheduled':
        return `
          background: #e0e7ff;
          color: #3730a3;
        `;
      case 'failed':
      case 'no_answer':
        return `
          background: #fee2e2;
          color: #991b1b;
        `;
      default:
        return `
          background: #f1f5f9;
          color: #64748b;
        `;
    }
  }}
`;

export const CardBody = styled.div`
  padding: 24px;
`;

export const InsightsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
`;

export const InsightSection = styled.div`
  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 12px 0;
    
    svg {
      font-size: 18px;
      color: ${props => props.$color || '#7c3aed'};
    }
  }
`;

export const InsightList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  
  li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    color: #475569;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
    
    &:last-child {
      border-bottom: none;
    }
    
    svg {
      font-size: 16px;
      margin-top: 2px;
      color: ${props => props.$color || '#64748b'};
      flex-shrink: 0;
    }
  }
`;

export const TranscriptSection = styled.div`
  margin-top: 20px;
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
`;

export const TranscriptHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  cursor: pointer;
  user-select: none;
  
  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    
    svg {
      font-size: 18px;
      color: #7c3aed;
    }
  }
  
  &:hover {
    opacity: 0.8;
  }
`;

export const TranscriptContent = styled.div`
  max-height: ${props => props.$expanded ? '600px' : '0'};
  overflow: ${props => props.$expanded ? 'auto' : 'hidden'};
  transition: max-height 0.3s ease;
  background: #f8fafc;
  border-radius: 8px;
  padding: ${props => props.$expanded ? '16px' : '0'};
  margin-top: ${props => props.$expanded ? '12px' : '0'};
`;

export const TranscriptLine = styled.div`
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  
  ${props => props.$isBot ? `
    background: #ede9fe;
    border-left: 3px solid #7c3aed;
  ` : `
    background: white;
    border-left: 3px solid #10b981;
  `}
  
  .speaker {
    font-weight: 600;
    color: ${props => props.$isBot ? '#7c3aed' : '#10b981'};
    margin-bottom: 4px;
  }
  
  .message {
    color: #334155;
    white-space: pre-wrap;
  }
`;

export const SummaryBox = styled.div`
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  
  .label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  
  .text {
    font-size: 14px;
    color: #1e293b;
    line-height: 1.6;
  }
`;

export const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
`;

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border: none;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
  ` : props.$success ? `
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
    
    &:hover {
      background: #bbf7d0;
    }
  ` : props.$danger ? `
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
    
    &:hover {
      background: #fecaca;
    }
  ` : `
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
    
    &:hover {
      background: #f1f5f9;
    }
  `}
`;

export const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  
  &:hover {
    background: #f8fafc;
  }
`;

export const NoInterviews = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  
  svg {
    font-size: 64px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 20px;
    color: #1e293b;
    margin: 0 0 8px 0;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
  }
`;

export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  
  p {
    margin-top: 16px;
    color: #64748b;
  }
`;

export const TabsContainer = styled.div`
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 24px;
`;

export const Tab = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.$active ? `
    background: white;
    color: #7c3aed;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  ` : `
    background: transparent;
    color: #64748b;
    
    &:hover {
      color: #1e293b;
    }
  `}
`;
