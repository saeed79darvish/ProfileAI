import { useParams, useNavigate, Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Dialog, DialogContent, IconButton, Tooltip, Breadcrumbs, Typography } from '@mui/material';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT, TRANSITIONS } from '@/designTokens';

export const ErrorFallback = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${COLORS.BG_LIGHT};
  padding: 24px;
  text-align: center;
  
  h2 {
    color: ${COLORS.TEXT_PRIMARY};
    margin-bottom: 8px;
  }
  
  p {
    color: ${COLORS.TEXT_SECONDARY};
    margin-bottom: 24px;
  }
  
  button {
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    border: none;
    padding: 12px 24px;
    border-radius: ${RADIUS.SMALL};
    font-size: ${FONT_SIZE.LG};
    cursor: pointer;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
    }
  }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: ${COLORS.BG_LIGHT};
`;

export const Header = styled.header`
  background: ${GRADIENTS.PRIMARY};
  padding: 24px 24px 100px;
  color: ${COLORS.TEXT_WHITE};
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
    pointer-events: none;
  }
`;

export const HeaderContent = styled.div`
  max-width: 900px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

export const BreadcrumbsWrapper = styled.div`
  margin-bottom: 24px;
  
  .MuiBreadcrumbs-root {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .MuiBreadcrumbs-separator {
    color: rgba(255, 255, 255, 0.5);
  }
`;

export const BreadcrumbLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }
  
  svg {
    font-size: 18px;
  }
`;

export const BreadcrumbCurrent = styled(Typography)`
  && {
    color: white;
    font-size: 14px;
    font-weight: 500;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const CompanyInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
`;

export const CompanyLogo = styled(Link)`
  width: 64px;
  height: 64px;
  background: ${COLORS.BG_WHITE};
  border-radius: ${RADIUS.LARGE};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  svg {
    font-size: 32px;
    color: ${COLORS.PRIMARY};
  }
`;

export const CompanyName = styled(Link)`
  font-size: 16px;
  opacity: 0.9;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
    opacity: 1;
  }
`;

export const JobTitle = styled.h1`
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 16px;
  
  @media (max-width: 600px) {
    font-size: 28px;
  }
`;

export const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 15px;
  opacity: 0.9;
  
  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  svg {
    font-size: 18px;
  }
`;

export const Content = styled.main`
  max-width: 900px;
  margin: -60px auto 40px;
  padding: 0 24px;
  position: relative;
  z-index: 2;
`;

export const MainCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: ${RADIUS.XXL};
  box-shadow: ${SHADOWS.ELEVATED};
  overflow: hidden;
`;

export const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
`;

export const Stats = styled.div`
  display: flex;
  gap: 24px;
`;

export const Stat = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${FONT_SIZE.BASE};
  color: ${COLORS.TEXT_SECONDARY};
  
  svg {
    font-size: 20px;
  }
  
  strong {
    color: ${COLORS.TEXT_PRIMARY};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    border: none;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
    }
  ` : `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_SECONDARY};
    border: 1px solid ${COLORS.BORDER_LIGHT};
    
    &:hover {
      border-color: ${COLORS.PRIMARY};
      color: ${COLORS.PRIMARY};
    }
  `}
`;

export const CardBody = styled.div`
  padding: 32px 24px;
`;

export const Section = styled.section`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const SectionTitle = styled.h2`
  font-size: ${FONT_SIZE.XL};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    font-size: 20px;
    color: ${COLORS.PRIMARY};
  }
`;

export const SectionContent = styled.div`
  font-size: 15px;
  line-height: 1.8;
  color: #475569;
  white-space: pre-wrap;
  
  /* Clean formatting styles */
  .section-header {
    font-size: ${FONT_SIZE.LG};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_PRIMARY};
    margin: 20px 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  .bullet-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  
  .bullet-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
    
    &::before {
      content: '•';
      color: ${COLORS.PRIMARY};
      font-weight: bold;
      font-size: 18px;
      line-height: 1.4;
    }
  }
  
  .paragraph {
    margin: 12px 0;
  }
`;

export const SkillTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

export const SkillTag = styled.span`
  padding: 8px 16px;
  background: #f1f5f9;
  color: #475569;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
`;

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
`;

export const InfoItem = styled.div`
  padding: 16px;
  background: ${COLORS.BG_LIGHT};
  border-radius: ${RADIUS.MEDIUM};
  
  .label {
    font-size: ${FONT_SIZE.SM};
    color: ${COLORS.TEXT_SECONDARY};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  
  .value {
    font-size: 15px;
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_PRIMARY};
  }
`;

export const CompanyCard = styled.div`
  margin-top: 24px;
  padding: 24px;
  background: ${COLORS.BG_LIGHT};
  border-radius: ${RADIUS.LARGE};
`;

export const CompanyCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
`;

export const CompanyDetails = styled.div`
  h3 {
    font-size: ${FONT_SIZE.XL};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 4px;
  }
  
  p {
    font-size: ${FONT_SIZE.BASE};
    color: ${COLORS.TEXT_SECONDARY};
    margin: 0;
  }
`;

export const CompanyLinks = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 12px;
`;

export const CompanyLink = styled.a`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.PRIMARY};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
  
  svg {
    font-size: 16px;
  }
`;

// Start AI Automation Button
export const StartAIButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: ${GRADIENTS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: ${RADIUS.MEDIUM};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
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
  padding: 10px 20px;
  background: ${GRADIENTS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: ${RADIUS.MEDIUM};
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
    color: ${COLORS.TEXT_WHITE};
    border-radius: 4px;
    margin-left: 4px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
  }
`;

// AI Screening Panel Styles
export const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const ScreeningPanel = styled.div`
  background: ${GRADIENTS.PRIMARY};
  border-radius: ${RADIUS.XXL};
  padding: 24px;
  margin-bottom: 24px;
  color: ${COLORS.TEXT_WHITE};
`;

export const ScreeningHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

export const ScreeningTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  
  svg {
    font-size: 24px;
  }
`;

export const ScreeningStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  
  svg {
    font-size: 18px;
  }
  
  ${props => props.$status === 'screening' && `
    animation: ${pulse} 2s ease-in-out infinite;
  `}
`;

export const ScreeningProgress = styled.div`
  margin-bottom: 16px;
`;

export const ProgressBar = styled.div`
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
`;

export const ProgressFill = styled.div`
  height: 100%;
  background: white;
  border-radius: 4px;
  transition: width 0.5s ease;
  width: ${props => props.$percent}%;
`;

export const ScreeningStep = styled.div`
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 4px;
`;

export const ScreeningStats = styled.div`
  display: flex;
  gap: 20px;
  font-size: 14px;
  
  span {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.9;
    
    strong {
      opacity: 1;
    }
  }
`;

export const ShortlistedSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
`;

export const ShortlistedTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CandidateCards = styled.div`
  display: grid;
  gap: 12px;
`;

export const CandidateCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: ${RADIUS.LARGE};
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: ${COLORS.TEXT_PRIMARY};
`;

export const CandidateAvatar = styled.div`
  width: 50px;
  height: 50px;
  border-radius: ${RADIUS.CIRCLE};
  background: ${GRADIENTS.PRIMARY};
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
    font-size: 24px;
    color: ${COLORS.TEXT_WHITE};
  }
`;

export const CandidateInfo = styled.div`
  flex: 1;
  min-width: 0;
  
  .name {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .headline {
    font-size: ${FONT_SIZE.MD};
    color: ${COLORS.TEXT_SECONDARY};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const CandidateScores = styled.div`
  display: flex;
  gap: 12px;
  margin-right: 8px;
`;

export const ScoreBadge = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: ${props => props.$type === 'fit' ? '#dcfce7' : '#dbeafe'};
  border-radius: 8px;
  
  .value {
    font-size: 18px;
    font-weight: 700;
    color: ${props => props.$type === 'fit' ? '#16a34a' : '#2563eb'};
  }
  
  .label {
    font-size: 10px;
    color: ${props => props.$type === 'fit' ? '#166534' : '#1e40af'};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

export const CandidateActions = styled.div`
  display: flex;
  gap: 8px;
`;

export const CandidateActionBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  background: ${COLORS.BG_WHITE};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: ${TRANSITIONS.FAST};
  
  svg {
    font-size: 18px;
    color: ${COLORS.TEXT_SECONDARY};
  }
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    background: rgba(102, 126, 234, 0.05);
    
    svg {
      color: ${COLORS.PRIMARY};
    }
  }
`;

export const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 16px;
    ${props => props.$loading && `animation: ${spin} 1s linear infinite;`}
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ScreeningError = styled.div`
  background: rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 12px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const EmptyShortlist = styled.div`
  text-align: center;
  padding: 20px;
  opacity: 0.8;
  font-size: 14px;
`;

export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  font-size: ${FONT_SIZE.LG};
  color: ${COLORS.TEXT_SECONDARY};
`;

export const ErrorContainer = styled.div`
  text-align: center;
  padding: 60px 20px;
  
  h2 {
    font-size: ${FONT_SIZE.XXL};
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 12px;
  }
  
  p {
    font-size: 15px;
    color: ${COLORS.TEXT_SECONDARY};
    margin: 0 0 24px;
  }
`;

export const PostedDate = styled.div`
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_SECONDARY};
  margin-top: 12px;
`;

// Application Modal Styles
export const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  h2 {
    font-size: 24px;
    font-weight: 600;
    color: #1F2937;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    color: #6B7280;
    margin: 0;
  }
`;

export const ApplicationOptions = styled.div`
  display: grid;
  gap: 16px;
`;

export const ApplicationOption = styled.button`
  background: ${COLORS.BG_WHITE};
  border: 2px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.XXL};
  padding: 24px;
  text-align: left;
  cursor: pointer;
  transition: ${TRANSITIONS.DEFAULT};
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
  }
  
  .option-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .icon {
    width: 48px;
    height: 48px;
    background: ${GRADIENTS.PRIMARY};
    border-radius: ${RADIUS.LARGE};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${COLORS.TEXT_WHITE};
    
    svg {
      font-size: 24px;
    }
  }
  
  .option-content {
    flex: 1;
  }
  
  .title {
    font-size: 18px;
    font-weight: 600;
    color: #1F2937;
    margin: 0 0 4px;
  }
  
  .badge {
    display: inline-block;
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .description {
    font-size: 14px;
    color: #6B7280;
    line-height: 1.6;
    margin: 12px 0 0;
  }
  
  .features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #4B5563;
    
    svg {
      font-size: 16px;
      color: #10B981;
    }
  }
`;

export const CloseButton = styled(IconButton)`
  position: absolute !important;
  top: 16px;
  right: 16px;
  color: ${COLORS.TEXT_SECONDARY} !important;
`;
