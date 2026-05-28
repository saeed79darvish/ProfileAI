// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes, css } from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Header = styled.header`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #4c1d95 100%);
  padding: 40px 0 36px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgba(167, 139, 250, 0.12);
  }
`;

export const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
`;

export const HeaderLeft = styled.div`
  h1 {
    font-size: 28px;
    font-weight: 700;
    color: white;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
    margin: 0;
  }
`;

export const PostJobButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: white;
  color: #7c3aed;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(124, 58, 237, 0.2);
  }
`;

export const Content = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
  
  @media (max-width: 968px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 568px) {
    grid-template-columns: 1fr;
  }
`;

export const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  
  .stat-label {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 8px;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
  }
  
  .stat-change {
    font-size: 12px;
    color: #10b981;
    margin-top: 4px;
  }
`;

export const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0;
`;

export const Tab = styled.button`
  padding: 12px 20px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$active ? '#7c3aed' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  font-family: inherit;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.$active ? '#7c3aed' : 'transparent'};
    border-radius: 2px 2px 0 0;
  }
  
  &:hover {
    color: #7c3aed;
  }
`;

export const TabCount = styled.span`
  background: ${props => props.$active ? '#7c3aed' : '#e2e8f0'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  margin-left: 8px;
`;

export const JobsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const JobCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
`;

export const JobHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

export const JobInfo = styled.div`
  flex: 1;
`;

export const JobTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px;
  cursor: pointer;
  
  &:hover {
    color: #7c3aed;
  }
`;

export const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
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

export const JobActions = styled.div`
  display: flex;
  gap: 8px;
`;

export const ActionButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    border-color: #7c3aed;
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.05);
  }
  
  &.delete:hover {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
  }
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 50px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch(props.$status) {
      case 'active':
        return `background: #dcfce7; color: #16a34a;`;
      case 'paused':
        return `background: #fef3c7; color: #d97706;`;
      case 'closed':
        return `background: #f1f5f9; color: #64748b;`;
      case 'draft':
        return `background: #e0e7ff; color: #4f46e5;`;
      default:
        return `background: #f1f5f9; color: #64748b;`;
    }
  }}
`;

export const JobStats = styled.div`
  display: flex;
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
  margin-top: 16px;
`;

export const JobStat = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
  
  svg {
    font-size: 18px;
  }
  
  strong {
    color: #1a1a2e;
    font-weight: 600;
  }
`;

// AI Screening Styles
export const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const ScreeningSection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
`;

export const ScreeningHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

export const ScreeningTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #7c3aed;
  
  svg {
    font-size: 18px;
  }
`;

export const ScreeningStatusBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch(props.$status) {
      case 'pending':
        return css`background: #fef3c7; color: #d97706;`;
      case 'searching':
        return css`background: #e0e7ff; color: #4f46e5; animation: ${pulse} 2s ease-in-out infinite;`;
      case 'search_complete':
        return css`background: #fef3c7; color: #d97706;`;
      case 'screening':
        return css`background: #dbeafe; color: #2563eb; animation: ${pulse} 2s ease-in-out infinite;`;
      case 'completed':
        return css`background: #dcfce7; color: #16a34a;`;
      case 'failed':
        return css`background: #fee2e2; color: #dc2626;`;
      default:
        return css`background: #f1f5f9; color: #64748b;`;
    }
  }}
  
  svg {
    font-size: 14px;
  }
`;

export const ProgressContainer = styled.div`
  margin-bottom: 12px;
`;

export const ProgressText = styled.div`
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
`;

export const ProgressBar = styled.div`
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
`;

export const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  border-radius: 3px;
  transition: width 0.5s ease;
  width: ${props => props.$percent}%;
`;

export const ShortlistedCandidates = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const ShortlistedLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
`;

export const CandidateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 10px;
  transition: all 0.2s;
  
  &:hover {
    background: #f1f5f9;
  }
`;

export const CandidateAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  svg {
    font-size: 18px;
    color: white;
  }
`;

export const CandidateInfo = styled.div`
  flex: 1;
  min-width: 0;
  
  .name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .headline {
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const CandidateScores = styled.div`
  display: flex;
  gap: 8px;
`;

export const ScorePill = styled.div`
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => props.$type === 'fit' ? '#dcfce7' : '#dbeafe'};
  color: ${props => props.$type === 'fit' ? '#16a34a' : '#2563eb'};
`;

export const CandidateActions = styled.div`
  display: flex;
  gap: 4px;
`;

export const CandidateActionBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 14px;
    color: #64748b;
  }
  
  &:hover {
    border-color: #7c3aed;
    background: #f0f4ff;
    
    svg {
      color: #7c3aed;
    }
  }
`;

export const ScreeningError = styled.div`
  font-size: 12px;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 6px;
  
  svg {
    font-size: 14px;
  }
`;

export const NoShortlist = styled.div`
  font-size: 13px;
  color: #64748b;
  text-align: center;
  padding: 12px;
`;

export const StartScreeningButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 16px;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }
`;

// Application Form Config Button
export const FormConfigButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  .badge {
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.25);
    color: white;
    border-radius: 4px;
    margin-left: 4px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;

// Import Candidates Button
export const ImportCandidatesButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }
`;

// View Applications Button
export const ViewApplicationsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: ${props => props.$hasApplications 
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
    : '#f1f5f9'};
  color: ${props => props.$hasApplications ? 'white' : '#64748b'};
  border: ${props => props.$hasApplications ? 'none' : '1px solid #e2e8f0'};
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    transform: translateY(-1px);
    ${props => props.$hasApplications 
      ? 'box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);' 
      : 'border-color: #7c3aed; color: #7c3aed;'}
  }
`;

export const SkillTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

export const SkillTag = styled.span`
  padding: 4px 10px;
  background: #f1f5f9;
  color: #475569;
  border-radius: 6px;
  font-size: 12px;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  
  svg {
    font-size: 64px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 18px;
    color: #1a1a2e;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
    margin: 0 0 24px;
  }
`;

// Modal Styles
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

export const Modal = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
`;

export const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
  
  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }
`;

export const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: #e2e8f0;
    color: #1a1a2e;
  }
`;

export const ModalBody = styled.div`
  padding: 24px;
`;

export const ConfirmModal = styled.div`
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: modalSlideIn 0.25s ease-out;
  
  @keyframes modalSlideIn {
    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

export const ConfirmHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  
  .icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d97706;
    flex-shrink: 0;
  }
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }
`;

export const ConfirmBody = styled.div`
  padding: 0 24px 20px;
  
  p {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    margin: 0 0 12px;
  }
  
  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: #eff6ff;
    border-radius: 10px;
    border: 1px solid #bfdbfe;
    margin-top: 4px;
    
    svg {
      color: #3b82f6;
      font-size: 18px;
      margin-top: 1px;
      flex-shrink: 0;
    }
    
    span {
      font-size: 13px;
      color: #1e40af;
      line-height: 1.5;
    }
  }
`;

export const ConfirmFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  
  button {
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .cancel-btn {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover {
      background: #f1f5f9;
      color: #374151;
    }
  }
  
  .confirm-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
    
    &:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
    }
  }
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

export const FormGroup = styled.div`
  ${props => props.$fullWidth && `grid-column: 1 / -1;`}
  
  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }
  
  .required {
    color: #ef4444;
  }
`;

export const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  &::placeholder {
    color: #94a3b8;
  }
`;

export const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const Textarea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  &::placeholder {
    color: #94a3b8;
  }
`;

export const SalaryGroup = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

export const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  position: sticky;
  bottom: 0;
`;

export const InfoBox = styled.div`
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 16px;
  color: #1e40af;
`;

export const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const FeatureItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  strong {
    display: block;
    color: #1a1a2e;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
  }
`;

export const CheckIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: bold;
  
  &::after {
    content: '✓';
  }
`;

export const Button = styled.button`
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border: none;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover {
      border-color: #cbd5e1;
      color: #374151;
    }
  `}
`;

export const SkillsInput = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  min-height: 48px;
  cursor: text;
  
  &:focus-within {
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const SkillChip = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #7c3aed;
  color: white;
  border-radius: 6px;
  font-size: 13px;
  
  button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    font-size: 14px;
  }
`;

export const SkillInputField = styled.input`
  flex: 1;
  min-width: 100px;
  border: none;
  outline: none;
  font-size: 14px;
  padding: 4px;
  
  &::placeholder {
    color: #94a3b8;
  }
`;

// Rich Text Preview Component
export const RichTextContainer = styled.div`
  position: relative;
`;

export const RichTextToggle = styled.div`
  display: flex;
  gap: 4px;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
`;

export const ToggleButton = styled.button`
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  background: ${props => props.$active ? '#7c3aed' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:first-child {
    border-radius: 6px 0 0 6px;
  }
  
  &:last-child {
    border-radius: 0 6px 6px 0;
  }
  
  &:hover {
    border-color: #7c3aed;
  }
`;

export const RichTextPreview = styled.div`
  width: 100%;
  padding: 12px 16px;
  padding-top: 40px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
  background: #fafbfc;
  line-height: 1.7;
  
  .section-header {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 16px 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  .bullet-list {
    margin: 0;
    padding: 0 0 0 8px;
    list-style: none;
  }
  
  .bullet-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 4px 0;
    color: #475569;
    
    &::before {
      content: '•';
      color: #7c3aed;
      font-weight: bold;
      font-size: 16px;
      line-height: 1.5;
    }
  }
  
  .paragraph {
    margin: 10px 0;
    color: #475569;
  }
  
  .empty-state {
    color: #94a3b8;
    font-style: italic;
  }
`;

export const Toast = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 16px 24px;
  background: ${props => props.$type === 'success' ? '#10b981' : '#ef4444'};
  color: white;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  animation: slideIn 0.3s ease;
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

// AI Feature Styles
export const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export const AIButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

export const AIButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: ${props => props.$loading ? 
    'linear-gradient(90deg, #7c3aed 0%, #6d28d9 50%, #7c3aed 100%)' : 
    'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'};
  background-size: ${props => props.$loading ? '200% 100%' : '100% 100%'};
  animation: ${props => props.$loading ? shimmer : 'none'} 1.5s infinite linear;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: ${props => props.$loading || props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  opacity: ${props => props.disabled ? 0.6 : 1};
  
  &:hover:not(:disabled) {
    transform: ${props => props.$loading ? 'none' : 'translateY(-1px)'};
    box-shadow: ${props => props.$loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)'};
  }
  
  svg {
    font-size: 16px;
  }
`;

export const AILabel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #7c3aed;
  margin-top: 4px;
  
  svg {
    font-size: 14px;
  }
`;

export const SuggestionChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #e2e8f0;
`;

export const SuggestionChip = styled.button`
  padding: 6px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #7c3aed;
    color: #7c3aed;
    background: rgba(102, 126, 234, 0.05);
  }
`;

export const TitleSuggestionDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 250px;
  overflow-y: auto;
  margin-top: 4px;
`;

export const TitleSuggestionItem = styled.button`
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.2s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #f8fafc;
  }
  
  .title {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a2e;
  }
  
  .reason {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }
`;

export const FormGroupRelative = styled(FormGroup)`
  position: relative;
`;