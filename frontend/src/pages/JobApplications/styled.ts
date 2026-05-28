// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled from 'styled-components';
import { COLORS, GRADIENTS } from '../../designTokens';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: ${COLORS.BG_LIGHT};
`;

export const HeroSection = styled.div`
  background: linear-gradient(135deg, ${COLORS.SECONDARY} 0%, ${COLORS.PRIMARY_DARK} 100%);
  padding: 2rem 0 3rem;
  color: white;
  position: relative;
  overflow: hidden;

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
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
`;

export const Content = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 24px;
`;

export const Header = styled.div`
  margin-bottom: 16px;
`;

export const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 16px;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgba(255,255,255,0.5);
    background: rgba(255,255,255,0.25);
  }
`;

export const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: white;
  margin: 0 0 8px;
`;

export const Subtitle = styled.p`
  font-size: 16px;
  color: rgba(255,255,255,0.7);
  margin: 0;
`;

export const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

export const SearchInput = styled.div`
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: ${COLORS.BG_LIGHT};
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: 8px;
  
  input {
    flex: 1;
    border: none;
    background: none;
    font-size: 14px;
    color: ${COLORS.TEXT_PRIMARY};
    outline: none;
    
    &::placeholder {
      color: #94a3b8;
    }
  }
  
  svg {
    color: #94a3b8;
    font-size: 20px;
  }
`;

export const FilterSelect = styled.select`
  padding: 10px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: 8px;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
  background: white;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: ${COLORS.SECONDARY};
  }
`;

export const ApplicationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const ApplicationCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.2s;
  
  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  }
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid #f1f5f9;
`;

export const CandidateInfo = styled.div`
  display: flex;
  gap: 16px;
`;

export const Avatar = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  background: linear-gradient(135deg, ${COLORS.SECONDARY} 0%, ${COLORS.PRIMARY_DARK} 100%);
`;

export const DefaultAvatar = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY} 0%, ${COLORS.PRIMARY_DARK} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: 600;
`;

export const CandidateDetails = styled.div`
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 4px;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
    margin: 0 0 8px;
  }
`;

export const ContactInfo = styled.div`
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #64748b;
  
  span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  svg {
    font-size: 16px;
  }
`;

export const StatusBadge = styled.span`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  
  ${props => {
    switch (props.$status) {
      case 'submitted':
        return 'background: #e0f2fe; color: #0369a1;';
      case 'under_review':
        return 'background: #fef3c7; color: #b45309;';
      case 'shortlisted':
        return 'background: #d1fae5; color: #047857;';
      case 'interview_scheduled':
        return 'background: #e0e7ff; color: #4338ca;';
      case 'rejected':
        return 'background: #fee2e2; color: #b91c1c;';
      case 'withdrawn':
        return 'background: #f1f5f9; color: #64748b;';
      default:
        return 'background: #f1f5f9; color: #64748b;';
    }
  }}
`;

export const CardBody = styled.div`
  padding: 24px;
`;

export const Section = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

export const CoverLetter = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 20px;
  border-radius: 12px;
  font-size: 14px;
  color: #374151;
  line-height: 1.7;
  white-space: pre-wrap;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  position: relative;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
`;

export const AnswersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const AnswerItem = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 16px 20px;
  border-radius: 10px;
  border-left: 3px solid ${COLORS.SECONDARY};
  transition: all 0.2s ease;
  
  &:hover {
    background: linear-gradient(135deg, #f1f5f9 0%, ${COLORS.BORDER_LIGHT} 100%);
    transform: translateX(2px);
  }
  
  .question {
    font-size: 12px;
    font-weight: 600;
    color: ${COLORS.SECONDARY};
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .answer {
    font-size: 15px;
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: 500;
    line-height: 1.5;
  }
`;

export const ScoreDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: ${props => {
    if (props.$score >= 80) return 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
    if (props.$score >= 60) return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
    return 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
  }};
  border-radius: 12px;
  border: 1px solid ${props => {
    if (props.$score >= 80) return '#10b981';
    if (props.$score >= 60) return '#f59e0b';
    return '#ef4444';
  }};
  
  .score-value {
    font-size: 36px;
    font-weight: 800;
    color: ${props => {
      if (props.$score >= 80) return '#047857';
      if (props.$score >= 60) return '#b45309';
      return '#b91c1c';
    }};
    line-height: 1;
  }
  
  .score-label {
    font-size: 14px;
    font-weight: 600;
    color: ${props => {
      if (props.$score >= 80) return '#047857';
      if (props.$score >= 60) return '#b45309';
      return '#b91c1c';
    }};
  }
`;

export const ScoreBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  background: ${props => {
    if (props.$score >= 80) return 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
    if (props.$score >= 60) return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
    return 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
  }};
  color: ${props => {
    if (props.$score >= 80) return '#047857';
    if (props.$score >= 60) return '#b45309';
    return '#b91c1c';
  }};
  border: 1px solid ${props => {
    if (props.$score >= 80) return '#10b981';
    if (props.$score >= 60) return '#f59e0b';
    return '#ef4444';
  }};
`;

export const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: ${COLORS.BG_LIGHT};
  border-top: 1px solid #f1f5f9;
`;

export const AppliedDate = styled.span`
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  
  svg {
    font-size: 16px;
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, ${COLORS.SECONDARY} 0%, ${COLORS.PRIMARY_DARK} 100%);
    color: white;
    border: none;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  ` : props.$success ? `
    background: #d1fae5;
    color: #047857;
    border: 1px solid #a7f3d0;
    
    &:hover {
      background: #a7f3d0;
    }
  ` : props.$danger ? `
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    
    &:hover {
      background: #fecaca;
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid ${COLORS.BORDER_LIGHT};
    
    &:hover {
      border-color: ${COLORS.SECONDARY};
      color: ${COLORS.SECONDARY};
    }
  `}
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  
  svg {
    font-size: 64px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 20px;
    font-weight: 600;
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 8px;
  }
  
  p {
    font-size: 15px;
    color: #64748b;
    margin: 0;
  }
`;

export const LoadingState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
`;

// Modal for application detail
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
  backdrop-filter: blur(4px);
`;

export const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: modalSlideIn 0.3s ease-out;
  
  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

export const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
  
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0;
  }
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  
  &:hover {
    background: #f1f5f9;
    color: ${COLORS.TEXT_PRIMARY};
  }
`;

export const ModalBody = styled.div`
  padding: 24px;
`;