import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Avatar,
  IconButton,
  InputAdornment,
  Paper,
  Tooltip,
  Link
} from '@mui/material';
import styled from 'styled-components';

export const PageHeader = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #4c1d95 100%);
  color: white;
  padding: 3rem 0;
  margin-bottom: 2rem;
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
    background: rgba(167, 139, 250, 0.15);
  }
`;

export const FormSection = styled(Card)`
  margin-bottom: 1.5rem;
`;

export const SectionTitle = styled(Typography)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  
  svg {
    color: #7c3aed;
  }
`;

export const CompanyLogoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

export const LogoPreview = styled(Avatar)`
  width: 120px;
  height: 120px;
  border: 3px solid #e0e0e0;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &:hover {
    border-color: #7c3aed;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.15);
  }
`;

export const ProfilePicPreview = styled(Avatar)`
  width: 150px;
  height: 150px;
  border: 4px solid #7c3aed;
  cursor: pointer;
  font-size: 3rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &:hover {
    border-color: #6d28d9;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
  }
`;

export const ViewModeCard = styled(Card)`
  margin-bottom: 1.5rem;
  overflow: visible;
`;

export const ProfileHeader = styled(Box)`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #4c1d95 100%);
  color: white;
  padding: 3rem;
  text-align: center;
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

export const InfoItem = styled(Box)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  color: #555;
  
  svg {
    color: #7c3aed;
    font-size: 1.2rem;
  }
`;

export const ChipInput = styled(Box)`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;
