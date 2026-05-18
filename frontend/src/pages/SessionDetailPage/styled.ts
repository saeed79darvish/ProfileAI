import styled from 'styled-components';
import {
  Avatar,
  AvatarGroup,
  Chip,
  Button,
  CircularProgress,
  Box,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';

export const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: #f8f9fa;
`;

// Header section
export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
`;

export const BackButton = styled(IconButton)`
  background: white !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;

// Main card
export const SessionCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
`;

// Host banner
export const HostBanner = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .host-text {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .icon {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .label {
      font-size: 14px;
      font-weight: 500;
      opacity: 0.9;
    }
    
    .title {
      font-size: 18px;
      font-weight: 700;
    }
  }
  
  .host-stats {
    display: flex;
    gap: 24px;
    
    .stat {
      text-align: center;
      
      .value {
        font-size: 20px;
        font-weight: 700;
      }
      
      .label {
        font-size: 12px;
        opacity: 0.8;
      }
    }
  }
`;

// Participant banner
export const ParticipantBanner = styled.div`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  
  .icon {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .text {
    font-weight: 600;
  }
`;

// Type badges
export const TypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => props.$type === 'teaching' && `
    background: #EDE9FE;
    color: #7C3AED;
  `}
  
  ${props => props.$type === 'showcase' && `
    background: #D1FAE5;
    color: #059669;
  `}
  
  ${props => props.$type === 'mentorship' && `
    background: #DBEAFE;
    color: #2563EB;
  `}
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  
  ${props => props.$status === 'scheduled' && `
    background: #FEF3C7;
    color: #D97706;
  `}
  
  ${props => props.$status === 'live' && `
    background: #FEE2E2;
    color: #DC2626;
  `}
  
  ${props => props.$status === 'completed' && `
    background: #D1FAE5;
    color: #059669;
  `}
  
  ${props => props.$status === 'cancelled' && `
    background: #F3F4F6;
    color: #6B7280;
  `}
`;

export const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1F2937;
  margin: 16px 0;
  line-height: 1.3;
`;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
`;

// Host section
export const HostSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #F9FAFB;
  border-radius: 12px;
  margin: 24px 0;
`;

export const HostInfo = styled.div`
  flex: 1;
`;

export const HostName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: #1F2937;
  display: block;
`;

export const HostTitle = styled.span`
  font-size: 14px;
  color: #6B7280;
`;

// Meta section
export const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin: 24px 0;
  padding: 20px;
  background: #F9FAFB;
  border-radius: 12px;
`;

export const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: #6B7280;
    font-size: 20px;
  }
`;

export const MetaLabel = styled.span`
  font-size: 12px;
  color: #9CA3AF;
  display: block;
`;

export const MetaValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
`;

// Description section
export const DescriptionSection = styled.div`
  margin: 24px 0;
`;

export const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1F2937;
  margin: 0 0 12px 0;
`;

export const Description = styled.p`
  font-size: 15px;
  line-height: 1.7;
  color: #4B5563;
  white-space: pre-wrap;
`;

// Tags section
export const TagsSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
`;

// Participants section
export const ParticipantsSection = styled.div`
  margin: 24px 0;
  padding: 20px;
  background: #F9FAFB;
  border-radius: 12px;
`;

export const ParticipantList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
`;

export const ParticipantCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
`;

export const ParticipantName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: #374151;
`;

export const ParticipantRole = styled.span`
  font-size: 11px;
  color: #9CA3AF;
  text-transform: uppercase;
`;

// Action buttons
export const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #E5E7EB;
`;

// Loading state
export const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
`;
