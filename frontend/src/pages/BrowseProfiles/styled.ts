// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled from 'styled-components';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Paper,
  Avatar,
  Stack,
  IconButton,
  Fade,
  Skeleton,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Tooltip,
  Pagination,
} from '@mui/material';

export const HeroSection = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  padding: ${props => props.theme?.isMobile ? '2rem 0 3rem' : '3rem 0 4rem'};
  position: relative;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 2rem 0 3rem;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    padding: 2.5rem 0 3.5rem;
  }
`;

export const AgentButton = styled(Button)`
  background: linear-gradient(135deg, #00d4aa 0%, #00a080 100%);
  color: white;
  font-weight: 600;
  text-transform: none;
  border-radius: 12px;
  
  &:hover {
    background: linear-gradient(135deg, #00e5bb 0%, #00b090 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 212, 170, 0.4);
  }
`;

export const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
`;

export const HeroHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-direction: ${props => props.theme?.isMobile ? 'column' : 'row'};
  text-align: ${props => props.theme?.isMobile ? 'center' : 'left'};

  @media (max-width: 600px) {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  svg {
    font-size: 3rem;

    @media (max-width: 768px) {
      font-size: 2.5rem;
    }

    @media (min-width: 769px) {
      font-size: 4rem;
    }
  }
`;

export const HeroTitle = styled.h1`
  font-size: 3.5rem;
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  line-height: 1.2;

  @media (max-width: 600px) {
    font-size: 2rem;
  }

  @media (min-width: 601px) and (max-width: 960px) {
    font-size: 2.5rem;
  }
`;

export const HeroSubtitle = styled.p`
  font-size: 1.25rem;
  opacity: 0.95;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 2rem;

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 601px) and (max-width: 960px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
    background: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

export const StatValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

export const StatLabel = styled.div`
  font-size: 0.75rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 0.65rem;
  }
`;

export const DecorativeCircle = styled.div`
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  
  &.circle-1 {
    top: -100px;
    right: -100px;
    width: 300px;
    height: 300px;
  }

  &.circle-2 {
    bottom: -50px;
    left: -50px;
    width: 200px;
    height: 200px;
  }

  @media (max-width: 960px) {
    display: none;
  }
`;