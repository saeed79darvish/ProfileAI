import styled from 'styled-components';
import {
  Container, Box, Paper, Typography, Button, IconButton,
  TextField, Chip, Stepper, Step, StepLabel, StepContent,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Avatar, useTheme, useMediaQuery, alpha, Alert, CircularProgress,
  Slider, Radio, RadioGroup, Divider
} from '@mui/material';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%);
  padding-top: 24px;
  padding-bottom: 64px;
`;

export const WizardCard = styled(Paper)`
  border-radius: 24px !important;
  overflow: hidden;
`;

export const WizardHeader = styled.div`
  background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
  padding: 32px;
  color: white;
`;

export const TypeCard = styled.div`
  padding: 24px;
  border-radius: 16px;
  border: 2px solid ${props => props.$selected ? '#F97316' : '#E5E7EB'};
  background: ${props => props.$selected ? alpha('#F97316', 0.05) : 'white'};
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  
  &:hover {
    border-color: #F97316;
    transform: translateY(-2px);
  }
`;
