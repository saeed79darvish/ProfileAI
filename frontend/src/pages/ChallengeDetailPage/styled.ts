import styled from 'styled-components';
import {
  Container, Box, Paper, Typography, Button, IconButton,
  Tabs, Tab, Avatar, AvatarGroup, Chip, LinearProgress,
  useTheme, useMediaQuery, alpha, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Snackbar,
  List, ListItem, ListItemAvatar, ListItemText, Divider, Tooltip
} from '@mui/material';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%);
  padding-bottom: 64px;
`;

export const HeroSection = styled.div`
  background: ${props => props.$gradient || 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'};
  padding: 32px 0 120px;
  position: relative;
`;

export const ContentSection = styled.div`
  margin-top: -80px;
  position: relative;
  z-index: 1;
`;

export const StatCard = styled(Paper)`
  padding: 20px;
  text-align: center;
  border-radius: 16px !important;
`;

export const LeaderboardItem = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
  background: ${props => props.$isMe ? alpha('#F97316', 0.1) : 'transparent'};
  border-radius: 12px;
  margin-bottom: 8px;
`;

export const MilestoneCard = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  background: ${props => props.$completed ? alpha('#22C55E', 0.1) : alpha('#F97316', 0.05)};
  border-radius: 12px;
  border-left: 4px solid ${props => props.$completed ? '#22C55E' : '#F97316'};
`;
