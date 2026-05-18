import styled from 'styled-components';
import {
  Container, Box, Paper, Typography, Grid, Avatar, Button, IconButton,
  TextField, Chip, Divider, CircularProgress, Alert, Menu, MenuItem,
  Dialog, DialogContent, DialogTitle, Skeleton, Tooltip, Fade, InputAdornment,
  Select, Badge, LinearProgress, ToggleButton, ToggleButtonGroup,
  useTheme, useMediaQuery, alpha, Collapse, Tabs, Tab, Snackbar
} from '@mui/material';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT, SPACING, TRANSITIONS } from '../../designTokens';

export const PageContainer = styled.div`
  height: calc(100vh - 70px);
  background: ${COLORS.BG_GRAY};
  overflow: hidden;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 960px) {
    height: calc(100vh - 64px);
  }
  
  @media (max-width: 600px) {
    height: calc(100vh - 56px);
  }
`;

export const MainGrid = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$isMobile ? '1fr' : props.$isTablet ? '1fr 2fr' : '280px 1fr 320px'};
  gap: 24px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  padding-top: 24px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  
  @media (min-width: 1600px) {
    max-width: 1600px;
  }
  
  @media (max-width: 768px) {
    padding: 0 16px;
    padding-top: 24px;
  }
`;

export const LeftSidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-bottom: 24px;
  
  &::-webkit-scrollbar {
    width: 5px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
`;

export const RightSidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-bottom: 24px;
  
  &::-webkit-scrollbar {
    width: 5px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
`;

export const MainContent = styled.div`
  min-width: 0;
  overflow-y: auto;
  padding-bottom: 64px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }
`;

// User Profile Card for sidebar
export const ProfileCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border: none;
  border-radius: 20px;
  overflow: hidden;
  text-align: center;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
`;

export const ProfileGradientBanner = styled.div`
  background: linear-gradient(135deg, ${COLORS.ACCENT_INDIGO} 0%, ${COLORS.ACCENT_PURPLE} 30%, ${COLORS.ACCENT_PURPLE} 50%, #d946a8 80%, ${COLORS.ACCENT_PINK} 100%);
  height: 100px;
  width: 100%;
`;

export const ProfileContent = styled.div`
  padding: 0 24px 24px;
  margin-top: -55px;
`;

export const ProfileAvatar = styled.div`
  width: 110px;
  height: 110px;
  border-radius: 50%;
  margin: 0 auto 10px;
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid ${COLORS.BG_WHITE};
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

export const ProBadge = styled.span`
  position: absolute;
  bottom: 4px;
  right: -2px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.ACCENT_INDIGO});
  color: ${COLORS.TEXT_WHITE};
  font-size: 11px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 12px;
  letter-spacing: 0.5px;
  border: 2px solid ${COLORS.BG_WHITE};
  box-shadow: 0 2px 6px rgba(124, 94, 207, 0.3);
`;

export const ProfileName = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 12px 0 4px;
`;

export const ProfileTitle = styled.p`
  font-size: 14px;
  color: ${COLORS.TEXT_MUTED};
  margin: 0 0 24px;
`;

export const ProfileStats = styled.div`
  display: flex;
  justify-content: space-around;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 20px;
`;

export const ProfileStat = styled.div`
  text-align: center;
  
  .value {
    font-size: 22px;
    font-weight: 700;
    color: ${COLORS.TEXT_PRIMARY};
    display: block;
    line-height: 1.2;
  }
  
  .label {
    font-size: 11px;
    color: ${COLORS.TEXT_MUTED};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }
`;

// Quick Actions Row - Unified purple theme
export const ActionCardsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const ActionCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px;
  border: none;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.25s;
  text-align: left;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  min-height: 140px;
  overflow: hidden;
  
  &:nth-child(1) {
    background: linear-gradient(150deg, #1c1a30 0%, #232040 60%, #2a2548 100%);
  }
  &:nth-child(2) {
    background: linear-gradient(150deg, #2a1e42 0%, #3d2660 60%, #4a2d72 100%);
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  }
`;

export const ActionCardIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 14px;
  
  svg {
    font-size: 20px;
  }
`;

export const ActionCardDecoIcon = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  opacity: 0.10;
  
  svg {
    font-size: 64px;
  }
`;

export const ActionCardInfo = styled.div`
  flex: 1;
  min-width: 0;
  
  h4 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: ${COLORS.TEXT_WHITE};
    line-height: 1.3;
  }
  
  p {
    margin: 5px 0 0 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.4;
  }
`;

export const TabsContainer = styled.div`
  background: ${COLORS.BG_WHITE};
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
`;

export const StyledTabs = styled(Tabs)`
  .MuiTabs-indicator {
    display: none;
  }
`;

export const StyledTab = styled(Tab)`
  text-transform: none !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  min-height: 44px !important;
  border-radius: 8px !important;
  margin: 0 4px !important;
  color: ${COLORS.TEXT_SECONDARY} !important;
  
  &.Mui-selected {
    background: rgba(124, 94, 207, 0.1) !important;
    color: ${COLORS.SECONDARY} !important;
  }
  
  &:hover:not(.Mui-selected) {
    background: rgba(0, 0, 0, 0.04) !important;
  }
`;

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  background: ${COLORS.BG_WHITE};
  border: none;
  border-radius: 16px;
  padding: 10px 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

export const FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => props.$active ? `
    background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
    color: ${COLORS.TEXT_WHITE};
    box-shadow: 0 2px 8px rgba(124, 94, 207, 0.35);
  ` : `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_DARK};
    border: 1px solid rgba(0, 0, 0, 0.12);
    
    &:hover {
      border-color: rgba(124, 94, 207, 0.3);
      color: ${COLORS.SECONDARY};
      background: #f8f7ff;
    }
  `}
`;

// Changed from grid to flex column for vertical list
export const SessionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: ${COLORS.BG_WHITE};
  border: none;
  border-radius: 18px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
`;

export const EmptyIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  
  svg {
    font-size: 40px;
    color: ${COLORS.TEXT_WHITE};
  }
`;

// Achievement Card Component - unique format, not LinkedIn posts
export const AchievementCard = styled(Paper)`
  padding: 0;
  border-radius: 18px;
  background: ${COLORS.BG_WHITE} !important;
  border: none !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06) !important;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
  }
`;

export const AchievementHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: transparent;
  color: ${COLORS.TEXT_PRIMARY};
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
`;

export const CategoryIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(124, 94, 207, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
`;

export const CategoryLabel = styled.span`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${COLORS.SECONDARY};
`;

export const AchievementBody = styled.div`
  padding: 20px;
  background: transparent;
`;

export const AchievementTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 12px 0;
  line-height: 1.4;
`;

export const AchievementContent = styled.div`
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.7;
  margin: 0 0 16px 0;
  word-wrap: break-word;
  letter-spacing: 0.01em;
  
  pre {
    position: relative;
    background: #f8f7ff;
    color: ${COLORS.SECONDARY};
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid rgba(124, 94, 207, 0.15);
    
    &:hover .copy-button {
      opacity: 1;
    }
  }
  
  code {
    background: rgba(124, 94, 207, 0.1);
    color: ${COLORS.SECONDARY};
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 13px;
  }
  
  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
`;

export const CopyCodeButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: ${COLORS.BG_WHITE};
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: ${COLORS.TEXT_SECONDARY};
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: all 0.2s;
  
  &:hover {
    background: #f8f7ff;
    border-color: rgba(124, 94, 207, 0.3);
    color: ${COLORS.SECONDARY};
  }
  
  &.copied {
    background: rgba(22, 163, 74, 0.1);
    border-color: rgba(22, 163, 74, 0.3);
    color: ${COLORS.SUCCESS_DARK};
  }
  
  svg {
    font-size: 14px;
  }
`;

export const AchievementMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 4px;
  margin-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
`;

export const AuthorInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const AuthorAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(124, 94, 207, 0.15);
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const AuthorName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.3;
  cursor: pointer;
  
  &:hover {
    color: ${COLORS.SECONDARY};
    text-decoration: underline;
  }
`;

export const AchievementActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

export const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? 'rgba(124, 94, 207, 0.1)' : 'transparent'};
  color: ${props => props.$active ? COLORS.SECONDARY : COLORS.TEXT_SECONDARY};
  
  &:hover {
    background: rgba(124, 94, 207, 0.08);
    color: ${COLORS.SECONDARY};
  }
  
  svg {
    font-size: 20px;
  }
`;

export const JoinCTACard = styled.div`
  background: linear-gradient(145deg, ${COLORS.BG_DARK} 0%, #2d1b69 50%, #44337a 100%);
  border-radius: 20px;
  padding: 28px 22px;
  text-align: center;
  color: ${COLORS.TEXT_WHITE};
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -40%;
    right: -30%;
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(124, 94, 207, 0.3) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

export const JoinCTATitle = styled.h3`
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  position: relative;
`;

export const JoinCTASubtitle = styled.p`
  margin: 0 0 20px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
  position: relative;
`;

export const JoinCTAButton = styled.button`
  width: 100%;
  padding: 12px 20px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 94, 207, 0.4);
  }
`;

export const JoinCTASecondary = styled.button`
  width: 100%;
  padding: 10px 20px;
  margin-top: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: ${COLORS.TEXT_WHITE};
  }
`;

export const BenefitsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  position: relative;
`;

export const BenefitItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  
  svg {
    font-size: 18px;
    color: ${COLORS.ACCENT_PURPLE};
    flex-shrink: 0;
  }
`;

export const UnauthHeroBanner = styled.div`
  background: linear-gradient(145deg, ${COLORS.BG_DARK} 0%, #2d1b69 60%, #44337a 100%);
  border-radius: 20px;
  padding: 32px 28px;
  margin-bottom: 20px;
  color: ${COLORS.TEXT_WHITE};
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -60%;
    right: -20%;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(147, 51, 234, 0.25) 0%, transparent 70%);
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -40%;
    left: -10%;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(124, 94, 207, 0.2) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

export const HeroBannerContent = styled.div`
  position: relative;
  z-index: 1;
`;

export const HeroBannerTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  
  span {
    background: linear-gradient(135deg, ${COLORS.ACCENT_PURPLE}, ${COLORS.ACCENT_PURPLE});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`;

export const HeroBannerSubtitle = styled.p`
  margin: 0 0 20px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
`;

export const HeroBannerButtons = styled.div`
  display: flex;
  gap: 12px;
  
  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

export const HeroPrimaryBtn = styled.button`
  padding: 12px 28px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 94, 207, 0.4);
  }
  
  svg { font-size: 18px; }
`;

export const HeroSecondaryBtn = styled.button`
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: ${COLORS.TEXT_WHITE};
  }
`;

export const InlineSignupCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 16px;
  padding: 28px 24px;
  margin-bottom: 16px;
  border: 2px dashed rgba(124, 94, 207, 0.25);
  text-align: center;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY}, ${COLORS.ACCENT_PURPLE});
  }
`;

export const InlineSignupIcon = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  background: linear-gradient(135deg, rgba(124, 94, 207, 0.12), rgba(147, 51, 234, 0.12));
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    font-size: 24px;
    color: ${COLORS.SECONDARY};
  }
`;

export const InlineSignupTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
`;

export const InlineSignupText = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  line-height: 1.5;
`;

export const InlineSignupBtn = styled.button`
  padding: 10px 28px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 94, 207, 0.35);
  }
`;

export const WhyJoinCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
`;

export const WhyJoinTitle = styled.h3`
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    font-size: 20px;
    color: ${COLORS.SECONDARY};
  }
`;

export const WhyJoinItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 10px 0;
  
  &:not(:last-child) {
    border-bottom: 1px solid ${COLORS.BORDER_LIGHT};
  }
`;

export const WhyJoinItemIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${props => props.$bg || 'rgba(124, 94, 207, 0.1)'};
  
  svg {
    font-size: 18px;
    color: ${props => props.$color || COLORS.SECONDARY};
  }
`;

export const WhyJoinItemText = styled.div`
  h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${COLORS.TEXT_PRIMARY};
  }
  p {
    margin: 3px 0 0;
    font-size: 12px;
    color: ${COLORS.TEXT_MUTED};
    line-height: 1.4;
  }
`;

export const WhyJoinCTA = styled.button`
  width: 100%;
  padding: 11px 20px;
  margin-top: 16px;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  color: ${COLORS.TEXT_WHITE};
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 94, 207, 0.35);
  }
`;

export const glassStyle = {
  background: COLORS.BG_WHITE,
  border: 'none',
  boxShadow: SHADOWS.MEDIUM,
} as const;

// ── Extracted inline style components ──

export const PostImageContainer = styled.div`
  margin-top: 16px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;

  img {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    border-radius: 8px;
  }
`;

export const ImageOverlayBadge = styled.div`
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 6px;
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 4px;

  svg {
    font-size: 14px;
    color: ${COLORS.TEXT_WHITE};
  }

  span {
    color: ${COLORS.TEXT_WHITE};
    font-size: 11px;
    font-weight: 500;
  }
`;

export const PostMenuIconButton = styled(IconButton)`
  color: ${COLORS.TEXT_MUTED};
  margin-left: auto;

  &:hover {
    color: ${COLORS.SECONDARY};
  }
`;

export const ShareKnowledgeSection = styled.div`
  text-align: center;
  padding: 40px 24px;
  margin-top: 24px;
  background: ${COLORS.BG_WHITE};
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
`;

export const ShareKnowledgeIconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(124, 94, 207, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;

  svg {
    color: ${COLORS.SECONDARY};
    font-size: 24px;
  }
`;

export const GradientDialogTitle = styled(DialogTitle)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
  color: ${COLORS.TEXT_WHITE};
  border-radius: 12px 12px 0 0;
  padding-top: 12px;
  padding-bottom: 12px;
`;

export const GradientButton = styled(Button)`
  && {
    background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
    color: ${COLORS.TEXT_WHITE};
    border-radius: 8px;
    text-transform: none;
    font-weight: 600;

    &:hover {
      background: linear-gradient(135deg, ${COLORS.SECONDARY}, ${COLORS.SECONDARY});
    }
  }
`;

export const CaptionText = styled(Typography)`
  && {
    color: ${COLORS.TEXT_SECONDARY};
    font-size: 12px;
    display: block;
    line-height: 1.3;
  }
`;

export const DefaultAvatar = styled(Avatar)`
  && {
    font-size: 14px;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #8b5cf6 100%);
    color: ${COLORS.TEXT_WHITE};
    font-weight: 600;
  }
`;
