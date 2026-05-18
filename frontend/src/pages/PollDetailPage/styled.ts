import {
  Container, Box, Typography, Paper, CircularProgress, Alert, Button,
  Avatar, Chip, IconButton, Skeleton
} from '@mui/material';
import styled from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #F8FAFC;
  padding: 24px 16px 64px;
`;

export const ContentWrapper = styled.div`
  max-width: 680px;
  margin: 0 auto;
`;

export const BackButton = styled(Button)`
  && {
    margin-bottom: 16px;
    color: #6b7280;
    text-transform: none;
    font-weight: 500;
    
    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }
`;

export const HeaderCard = styled(Paper)`
  padding: 24px;
  border-radius: 16px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

export const AuthorSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

export const AuthorInfo = styled.div`
  flex: 1;
  
  .name {
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  .meta {
    font-size: 0.85rem;
    opacity: 0.9;
  }
`;

export const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
  }
`;
