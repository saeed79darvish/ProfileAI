import {
  Container, Box, Typography, Grid, Skeleton, Alert, Button,
  ToggleButtonGroup, ToggleButton, Chip, Fab
} from '@mui/material';
import styled from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #F8FAFC;
  padding: 24px 16px 80px;
`;

export const HeaderSection = styled.div`
  max-width: 900px;
  margin: 0 auto 32px;
  text-align: center;
`;

export const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
`;

export const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 24px;
`;

export const FiltersRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
`;

export const ContentWrapper = styled.div`
  max-width: 700px;
  margin: 0 auto;
`;

export const PollsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 24px;
  background: white;
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
  
  .icon {
    font-size: 4rem;
    margin-bottom: 16px;
  }
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 8px;
  }
  
  .subtitle {
    color: #64748b;
    margin-bottom: 24px;
  }
`;

export const LoadingGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const CategoryChip = styled(Chip)`
  && {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      transform: translateY(-2px);
    }
  }
`;

export const CreateFab = styled(Fab)`
  && {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    
    &:hover {
      background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    }
  }
`;

export const StatsBar = styled.div`
  display: flex;
  justify-content: center;
  gap: 32px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  
  .stat {
    text-align: center;
    
    .value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
    }
    
    .label {
      font-size: 0.85rem;
      color: #64748b;
    }
  }
`;
