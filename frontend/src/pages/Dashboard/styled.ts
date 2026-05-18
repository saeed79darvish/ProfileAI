import styled from 'styled-components';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, TRANSITIONS } from '../../designTokens';
import {
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Collapse
} from '@mui/material';

// Greeting & Onboarding Section
export const GreetingSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  width: 100%;
  box-sizing: border-box;

  &:empty {
    display: none;
    margin: 0;
  }

  .desktop-only-extension {
    display: contents;
    @media (max-width: 768px) {
      display: none;
    }
  }

  /* The only contents are the extension onboarding (compact CTA was removed,
     full + installed are conditional). When nothing renders inside, the
     inner div still exists so :empty doesn't match, collapse this section
     to display: contents so it takes no space when its children are absent. */
  display: contents;
`;

export const GreetingCard = styled.div`
  background: ${GRADIENTS.PRIMARY};
  border-radius: ${RADIUS.ROUND};
  padding: 32px 36px;
  color: white;
  flex: ${props => props.$fullWidth ? '1' : '0 0 340px'};
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 8px 32px ${COLORS.PRIMARY}40;
  position: relative;
  overflow: hidden;
  min-height: 180px;
  
  &::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 160px;
    height: 160px;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 50%;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -30px;
    left: -30px;
    width: 100px;
    height: 100px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 50%;
  }
  
  .greeting-emoji {
    font-size: 36px;
    margin-bottom: 8px;
    position: relative;
    z-index: 1;
  }
  
  .greeting-text {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 4px;
    position: relative;
    z-index: 1;
    opacity: 0.9;
  }
  
  .greeting-name {
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 10px;
    position: relative;
    z-index: 1;
    letter-spacing: -0.3px;
  }
  
  .greeting-subtitle {
    font-size: 13.5px;
    opacity: 0.8;
    line-height: 1.6;
    position: relative;
    z-index: 1;
    max-width: 280px;
  }
  
  .greeting-stats {
    display: flex;
    gap: 20px;
    margin-top: 16px;
    position: relative;
    z-index: 1;
    
    .stat {
      .stat-value {
        font-size: 20px;
        font-weight: 800;
      }
      .stat-label {
        font-size: 11px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }
  }
  
  @media (max-width: 960px) {
    flex: 1;
    padding: 28px;
  }
  
  @media (max-width: 480px) {
    padding: 24px;
    min-height: 160px;
    
    .greeting-emoji { font-size: 30px; }
    .greeting-text { font-size: 14px; }
    .greeting-name { font-size: 22px; }
    .greeting-subtitle { font-size: 12.5px; }
  }
`;

export const OnboardingCard = styled.div`
  flex: 1;
  background: #fff;
  border-radius: 20px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${COLORS.PRIMARY}14;
  
  .onboarding-top {
    background: linear-gradient(135deg, #1e2235 0%, #2d1b69 100%);
    padding: 20px 24px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .chrome-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .header-text {
        h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
        }
        
        .sub {
          font-size: 11.5px;
          color: rgba(255,255,255,0.55);
          margin-top: 2px;
        }
      }
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .badge {
        background: linear-gradient(135deg, ${COLORS.WARNING}, #d97706);
        color: white;
        font-size: 9px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
    }
  }
  
  .onboarding-close {
    color: rgba(255,255,255,0.5);
    &:hover { color: rgba(255,255,255,0.85); }
  }
  
  .onboarding-body {
    padding: 20px 24px 18px;
  }
  
  @media (max-width: 480px) {
    .onboarding-top { padding: 16px 18px 14px; }
    .onboarding-body { padding: 16px 18px 14px; }
  }
`;

export const OnboardingStepContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  
  .step-visual {
    display: flex;
    gap: 18px;
    padding: 18px;
    background: ${props => props.$bgColor || COLORS.BG_LIGHT};
    border-radius: 16px;
    border: 1px solid ${props => props.$borderColor || `${COLORS.PRIMARY}1a`};
    align-items: flex-start;
    
    .step-illustration {
      width: 80px;
      height: 80px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      
      svg {
        width: 80px;
        height: 80px;
      }
      
      @media (max-width: 480px) {
        width: 60px;
        height: 60px;
        svg { width: 60px; height: 60px; }
      }
    }
    
    .step-info {
      flex: 1;
      min-width: 0;
      
      .step-number {
        display: inline-block;
        font-size: 10px;
        font-weight: 800;
        color: ${props => props.$accentColor || COLORS.PRIMARY};
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      
      h4 {
        margin: 0 0 6px 0;
        font-size: 15px;
        font-weight: 700;
        color: #13152a;
      }
      
      p {
        margin: 0;
        font-size: 12.5px;
        color: ${COLORS.TEXT_SECONDARY};
        line-height: 1.55;
      }
    }
    
    @media (max-width: 480px) {
      padding: 14px;
      gap: 12px;
    }
  }
  
  .step-progress {
    display: flex;
    gap: 4px;
    
    .progress-segment {
      flex: 1;
      height: 3px;
      border-radius: 2px;
      background: ${COLORS.BORDER_LIGHT};
      transition: ${TRANSITIONS.DEFAULT};
      
      &.active {
        background: ${GRADIENTS.PRIMARY};
      }
      
      &.completed {
        background: ${COLORS.SUCCESS};
      }
    }
  }
  
  .step-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .nav-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
`;

// Compact install suggestion when onboarding is dismissed
export const ExtensionCTA = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #1e2235 0%, #2d1b69 100%);
  border-radius: 20px;
  padding: 24px 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: -30px;
    right: 60px;
    width: 100px;
    height: 100px;
    background: ${COLORS.PRIMARY}26;
    border-radius: 50%;
  }
  
  .cta-icon {
    width: 52px;
    height: 52px;
    background: rgba(255,255,255,0.12);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.08);
  }
  
  .cta-content {
    flex: 1;
    min-width: 0;
    position: relative;
    z-index: 1;
    
    h4 {
      margin: 0 0 4px 0;
      font-size: 15px;
      font-weight: 700;
    }
    
    p {
      margin: 0;
      font-size: 12.5px;
      opacity: 0.7;
      line-height: 1.4;
    }
  }
  
  .cta-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  
  @media (max-width: 480px) {
    padding: 18px;
    gap: 14px;
    flex-wrap: wrap;
    
    .cta-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #eef1f8;
  /* overflow-x: clip lets us prevent horizontal page scroll without
     creating a sticky scope that breaks position: sticky on descendants. */
  overflow-x: clip;
  width: 100%;
  position: relative;
`;

// AI Tools Card
export const AIToolsCard = styled.div`
  background: linear-gradient(135deg, #1e2235 0%, #252a40 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 16px;
  }

  @media (max-width: 600px) {
    /* Sticky directly under ProfileHero, no gap.
       Top offset = navbar(56) + ProfileHero stuck height(~144) = 200px. */
    position: sticky;
    top: 200px;
    z-index: 9;
    padding: 12px;
    margin-top: 0;
    margin-bottom: 16px;
    border-radius: 0 0 14px 14px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
  }
`;

export const AIToolsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  
  .icon {
    background: ${GRADIENTS.PRIMARY};
    border-radius: 12px;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px ${COLORS.PRIMARY}40;
    
    svg {
      font-size: 20px;
      color: white;
    }
  }
  
  .text {
    flex: 1;
    
    .title {
      font-weight: 700;
      font-size: 17px;
      color: #fff;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.45);
    }
  }
  
  @media (max-width: 768px) {
    gap: 12px;
    margin-bottom: 16px;

    .icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;

      svg { font-size: 18px; }
    }

    .text {
      .title { font-size: 15px; }
      .subtitle { font-size: 12px; }
    }
  }

  /* Phone: subtitle is redundant when each tool has its own icon+label below. */
  @media (max-width: 600px) {
    gap: 10px;
    margin-bottom: 12px;

    .icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;

      svg { font-size: 16px; }
    }

    .text {
      .title { font-size: 14px; }
      .subtitle { display: none; }
    }
  }
`;

export const AIToolsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  /* Phone widths: all 4 tools fit in one tight row.
     Total AI Tools section drops from ~520px to ~140px tall. */
  @media (max-width: 600px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
`;

export const AIToolButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 20px;
  background: ${props => props.$primary 
    ? `linear-gradient(135deg, ${COLORS.PRIMARY}2e 0%, ${COLORS.PRIMARY_DARK}1f 100%)`
    : 'rgba(255, 255, 255, 0.05)'};
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid ${props => props.$primary 
    ? `${COLORS.PRIMARY}40` 
    : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  min-height: 140px;
  position: relative;
  overflow: hidden;
  text-align: left;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    background: ${props => props.$primary 
      ? `linear-gradient(135deg, ${COLORS.PRIMARY}40 0%, ${COLORS.PRIMARY_DARK}2e 100%)`
      : 'rgba(255, 255, 255, 0.1)'};
  }
  
  .icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.25s ease;
    
    svg {
      font-size: 20px;
      color: white;
    }
  }
  
  &:hover .icon-wrap {
    transform: scale(1.08);
  }
  
  .label {
    font-weight: 600;
    font-size: 14px;
    line-height: 1.2;
    color: #fff;
  }
  
  .description {
    font-size: 12px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.4;
    margin-top: -4px;
  }
  
  .usage-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    
    .usage-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${COLORS.SUCCESS};
      
      &.warning { background: ${COLORS.WARNING}; }
      &.danger {
        background: ${COLORS.ERROR};
        animation: pulse-dot 1.5s ease infinite;
      }
    }
    
    .usage-count {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      
      &.warning { color: #FCD34D; }
      &.danger { color: #FCA5A5; }
    }
  }
  
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  
  @media (max-width: 1024px) {
    padding: 16px;
    min-height: 120px;
    gap: 10px;
    
    .icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      svg { font-size: 18px; }
    }
    
    .label { font-size: 13px; }
  }
  
  /* Phone widths: tiny icon-tile button. All four sit in one row.
     Description + UNLIMITED text are hidden, only icon + label show. */
  @media (max-width: 600px) {
    width: auto;
    min-height: 0;
    padding: 10px 4px;
    gap: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    position: relative;

    .icon-wrap {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      svg { font-size: 16px; }
    }

    &:hover .icon-wrap {
      transform: none;
    }

    .label {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.01em;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Description and "UNLIMITED" text don't fit at this width. */
    .description {
      display: none;
    }

    .usage-info {
      /* Show usage as a tiny dot in the top-right corner, keeps the
         "available / limited" signal without needing the text. */
      position: absolute;
      top: 6px;
      right: 6px;
      margin-top: 0;

      .usage-count {
        display: none;
      }

      .usage-dot {
        width: 5px;
        height: 5px;
      }
    }
  }
`;

// Public Link Section
export const PublicLinkSection = styled.div`
  background: #fff;
  border: 1px solid #dfe2ec;
  border-radius: 14px;
  padding: 14px 20px;
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  @media (max-width: 1024px) {
    padding: 14px 16px;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    padding: 14px 16px;
    margin-bottom: 16px;
    overflow: hidden;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
  }
`;

export const LinkIcon = styled.div`
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, ${COLORS.PRIMARY}1a 0%, ${COLORS.PRIMARY_DARK}0f 100%);
  border: 1px solid ${COLORS.PRIMARY}1f;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5b6abf;
`;

export const LinkText = styled.div`
  flex: 1;
  min-width: 200px;
  
  @media (max-width: 768px) {
    min-width: auto;
    width: 100%;
  }
  
  .label {
    font-size: 13px;
    font-weight: 600;
    color: #13152a;
    margin-bottom: 2px;
    
    @media (max-width: 768px) {
      font-size: 14px;
    }
  }
  .sublabel {
    font-size: 11px;
    color: #7b7f9e;
    
    @media (max-width: 768px) {
      font-size: 12px;
    }
  }
`;

export const LinkInput = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  @media (max-width: 768px) {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }
  
  input {
    width: 300px;
    max-width: 100%;
    padding: 8px 12px;
    border: 1px solid #d0d3de;
    border-radius: 8px;
    font-size: 13px;
    color: #3d3f56;
    background: #f5f7fc;
    box-sizing: border-box;
    
    @media (max-width: 768px) {
      width: 100%;
      min-width: 0;
    }
    
    &:focus {
      outline: none;
      border-color: ${COLORS.PRIMARY}66;
    }
  }
  
  button {
    color: #4a4d63;
    
    &:hover {
      color: #13152a;
      background: #eef0f7;
    }
  }
  
  .button-group {
    display: flex;
    gap: 8px;
    
    @media (max-width: 768px) {
      width: 100%;
      
      button {
        flex: 1;
      }
    }
  }
  
  .MuiButton-outlined {
    border-color: #c5c9d8;
    color: #3d3f56;
    font-size: 12px;
    
    &:hover {
      border-color: #5b6abf;
      background: rgba(91, 106, 191, 0.05);
    }
  }
`;

// Main Content Layout
export const MainContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  
  @media (min-width: 1600px) {
    max-width: 1600px;
    padding: 24px 32px;
  }
  
  @media (max-width: 1024px) {
    padding: 20px;
  }
  
  @media (max-width: 768px) {
    padding: 8px 16px 16px;
    overflow-x: clip;
  }

  @media (max-width: 480px) {
    padding: 6px 12px 12px;
  }
`;

export const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  width: 100%;
  box-sizing: border-box;
  
  @media (max-width: 1200px) {
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 16px;
  }
  
  @media (max-width: 1024px) {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 16px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

export const MobileProfileSection = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

export const DesktopSidebar = styled.div`
  display: block;
  
  @media (min-width: 769px) {
    position: sticky;
    top: 80px;
    align-self: start;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

// Left Sidebar
export const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  @media (max-width: 768px) {
    gap: 12px;
  }
`;

export const ProfileCard = styled.div`
  background: #fff;
  border: 1px solid #dfe2ec;
  border-radius: 18px;
  padding: 28px;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  @media (max-width: 1024px) {
    padding: 20px;
    border-radius: 14px;
  }
  
  @media (max-width: 768px) {
    padding: 20px 16px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  @media (max-width: 480px) {
    padding: 16px 12px;
    border-radius: 10px;
  }
`;

export const ProfilePictureWrapper = styled.div`
  position: relative;
  width: 100px;
  height: 100px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    width: 120px;
    height: 120px;
    margin-bottom: 12px;
  }
`;

export const ProfilePicture = styled(Avatar)`
  && {
    width: 100px;
    height: 100px;
    border: 3px solid #c7cbe8;
    box-shadow: 0 4px 16px ${COLORS.PRIMARY}2e;
    
    @media (max-width: 768px) {
      width: 120px;
      height: 120px;
    }
  }
`;

export const EditProfileBtn = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: #eef0f7;
  border: 1px solid #d0d5e8;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #5b6abf;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(91, 106, 191, 0.1);
    border-color: #5b6abf;
  }
  
  svg {
    font-size: 14px;
  }
  
  @media (max-width: 768px) {
    position: static;
    align-self: flex-end;
    margin-bottom: 16px;
  }
`;

export const ProfileName = styled.h2`
  font-size: 22px;
  font-weight: 700;
  color: #13152a;
  margin: 0 0 4px 0;
  
  @media (max-width: 1024px) {
    font-size: 20px;
  }
  
  @media (max-width: 480px) {
    font-size: 18px;
  }
`;

export const ProfileTitle = styled.p`
  font-size: 14px;
  color: #5b6abf;
  margin: 0 0 16px 0;
  font-weight: 600;
  
  @media (max-width: 1024px) {
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    font-size: 12px;
    margin: 0 0 12px 0;
  }
`;

export const ContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  
  @media (max-width: 768px) {
    align-items: center;
  }
`;

export const ContactItem = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #4a4d63;
  text-decoration: none;
  transition: color 0.2s;
  
  &:hover {
    color: #5b6abf;
  }
  
  svg {
    font-size: 16px;
    color: #7b7f9e;
  }
`;

export const AvailabilitySection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #dfe2ec;
`;

export const AvailabilityLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: #7b7f9e;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
`;

export const AvailabilityBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: ${COLORS.SUCCESS}14;
  color: ${COLORS.SUCCESS_DARK};
  border: 1px solid ${COLORS.SUCCESS}26;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: ${COLORS.SUCCESS};
    border-radius: 50%;
  }
`;

// Skills Card
export const SkillsCard = styled.div`
  background: #fff;
  border: 1px solid #dfe2ec;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  @media (max-width: 1024px) {
    padding: 18px;
    border-radius: 14px;
  }
  
  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 12px;
  }
  
  @media (max-width: 480px) {
    padding: 14px 12px;
    border-radius: 10px;
  }
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

export const CardTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: #13152a;
  margin: 0;
  
  @media (max-width: 1024px) {
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    font-size: 13px;
  }
`;

export const SkillCategory = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const CategoryLabel = styled.div`
  font-size: 12px;
  color: #7b7f9e;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
`;

export const SkillTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const SkillTag = styled.span`
  padding: 5px 12px;
  background: ${props => props.$highlighted ? 'rgba(91, 106, 191, 0.1)' : '#eef0f7'};
  color: ${props => props.$highlighted ? '#5b6abf' : '#4a4d63'};
  border: 1px solid ${props => props.$highlighted ? 'rgba(91, 106, 191, 0.2)' : '#dfe2ec'};
  border-radius: 6px;
  font-size: 12px;
  font-weight: ${props => props.$highlighted ? 600 : 400};
  transition: all 0.2s;
`;

// Right Content
export const RightContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  overflow: hidden;
`;

// Tabs Container
export const TabsContainer = styled.div`
  background: #fff;
  border: 1px solid #dfe2ec;
  border-radius: 16px;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  
  @media (max-width: 1024px) {
    border-radius: 16px;
  }
  
  @media (max-width: 768px) {
    border-radius: 16px;
  }
  
  @media (max-width: 480px) {
    border-radius: 16px;
  }
`;

export const TabsHeader = styled.div`
  border-bottom: 1px solid #dfe2ec;
  background: #f5f7fc;
  
  @media (max-width: 768px) {
    position: relative;
    overflow-x: auto;

    /* Edge fade mask hints scrollability */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 16px,
      #000 calc(100% - 16px),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 16px,
      #000 calc(100% - 16px),
      transparent 100%
    );

    /* Scroll-snap for cleaner tab paging */
    scroll-snap-type: x proximity;

    .MuiTab-root {
      scroll-snap-align: start;
    }

    &::-webkit-scrollbar {
      height: 2px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 2px;
    }
  }
`;

export const TabContent = styled.div`
  padding: 24px;
  min-width: 0;
  overflow-x: hidden;
  
  @media (max-width: 1024px) {
    padding: 18px;
  }
  
  @media (max-width: 768px) {
    padding: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 14px 12px;
  }
`;

// Section
export const Section = styled.div`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

export const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #13152a;
  margin: 0;
  
  @media (max-width: 1024px) {
    font-size: 17px;
  }
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
  
  @media (max-width: 480px) {
    font-size: 15px;
  }
`;

export const SectionAction = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  color: #5b6abf;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    text-decoration: underline;
  }
`;

export const SummaryText = styled.p`
  font-size: 14px;
  line-height: 1.7;
  color: #3d3f56;
  margin: 0;
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

export const ExperienceItem = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  background: #f5f7fc;
  border: 1px solid #e4e7f2;
  transition: all 0.2s;
  
  &:hover {
    background: #eef1fa;
    border-color: #d0d5e8;
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const CompanyLogo = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    font-size: 22px;
    color: white;
  }
`;

export const ExperienceContent = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

export const ExperienceTitle = styled.h4`
  font-size: 15px;
  font-weight: 600;
  color: #13152a;
  margin: 0 0 4px 0;
`;

export const ExperienceCompany = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #5b6abf;
  margin: 0 0 4px 0;
  flex-wrap: wrap;
  
  .company-name {
    color: #5b6abf;
    font-weight: 500;
  }
  
  .separator {
    color: #7b7f9e;
    font-size: 13px;
  }
  
  .employment-type {
    color: #4a4d63;
    font-size: 13px;
    font-weight: 400;
  }
`;

export const ExperienceMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #7b7f9e;
  margin: 0 0 8px 0;
  flex-wrap: wrap;
  
  .meta-date {
    display: flex;
    align-items: center;
    gap: 4px;
    
    svg {
      font-size: 15px;
    }
  }
  
  .current-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    background: ${COLORS.SUCCESS}1a;
    color: ${COLORS.SUCCESS_DARK};
    border: 1px solid ${COLORS.SUCCESS}33;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .meta-location {
    display: flex;
    align-items: center;
    gap: 3px;
    
    svg {
      font-size: 15px;
      color: #9ca3af;
    }
  }
`;

export const ExperienceSkills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  
  .skill-tag {
    padding: 3px 10px;
    background: #f0f1f7;
    color: #4a4d63;
    border: 1px solid #e4e7f2;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 400;
  }
`;

export const ExperienceDescription = styled.p`
  font-size: 14px;
  color: #4a4d63;
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

// Loading State
export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
`;

// ═══ Extracted SX objects for inline styles ═══

export const stepDetailStyle = {
  marginTop: 4,
  fontSize: 11.5,
  color: COLORS.TEXT_MUTED,
  fontStyle: 'italic' as const,
};

export const onboardingRemindBtnSx = {
  textTransform: 'none',
  color: COLORS.TEXT_MUTED,
  fontSize: 12,
} as const;

export const onboardingBackBtnSx = {
  textTransform: 'none',
  color: COLORS.TEXT_SECONDARY,
  fontSize: 13,
} as const;

export const onboardingInstallBtnSx = {
  textTransform: 'none',
  bgcolor: COLORS.PRIMARY,
  borderRadius: 2,
  fontSize: 13,
  px: 2.5,
  '&:hover': { bgcolor: '#5b6abf' },
} as const;

export const compactLearnMoreBtnSx = {
  textTransform: 'none',
  bgcolor: 'rgba(255,255,255,0.15)',
  color: 'white',
  borderRadius: 2,
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid rgba(255,255,255,0.2)',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
} as const;

export const aiSummaryBoxSx = {
  p: 2,
  bgcolor: `${COLORS.PRIMARY}14`,
  borderRadius: 2,
  border: `1px solid ${COLORS.PRIMARY}26`,
} as const;

export const tabsSx = {
  '& .MuiTabs-indicator': {
    backgroundColor: '#5b6abf',
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '14px',
    color: '#7b7f9e',
    minWidth: { xs: 'auto', sm: 90 },
    px: { xs: 1.5, sm: 3 },
    '&.Mui-selected': {
      color: '#5b6abf',
      fontWeight: 600,
    },
  },
} as const;

export const extensionInstalledCardSx = {
  flex: 1,
  background: `linear-gradient(135deg, #065f46 0%, #047857 50%, ${COLORS.SUCCESS_DARK} 100%)`,
  borderRadius: RADIUS.ROUND,
  padding: '24px 28px',
  display: { xs: 'none', md: 'flex' },
  alignItems: 'center',
  gap: '18px',
  color: 'white',
  boxShadow: `0 4px 20px ${COLORS.SUCCESS_DARK}33`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-20px',
    right: '40px',
    width: '80px',
    height: '80px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '50%',
  },
} as const;

export const extensionInstalledIconSx = {
  width: 48,
  height: 48,
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: '1px solid rgba(255,255,255,0.1)',
} as const;

export const postCardSx = {
  cursor: 'pointer',
  transition: TRANSITIONS.DEFAULT,
  borderRadius: 3,
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  background: COLORS.BG_WHITE,
  border: '1px solid #dfe2ec',
  boxShadow: SHADOWS.SMALL,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 24px rgba(91,106,191,0.15)',
    borderColor: 'rgba(91, 106, 191, 0.3)',
  },
} as const;

export const tailoredCardSx = {
  cursor: 'pointer',
  transition: TRANSITIONS.FAST,
  background: COLORS.BG_WHITE,
  border: '1px solid #dfe2ec',
  borderRadius: 3,
  color: '#13152a',
  boxShadow: SHADOWS.SMALL,
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(91,106,191,0.15)',
    borderColor: 'rgba(91, 106, 191, 0.3)',
  },
} as const;

export const ExtensionInstalledCard = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #065f46 0%, #047857 50%, ${COLORS.SUCCESS_DARK} 100%);
  border-radius: ${RADIUS.ROUND};
  padding: 24px 28px;
  display: flex;
  align-items: center;
  gap: 18px;
  color: white;
  box-shadow: 0 4px 20px ${COLORS.SUCCESS_DARK}33;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -20px;
    right: 40px;
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 50%;
  }

  @media (max-width: 900px) {
    display: none;
  }

  .installed-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .installed-content {
    flex: 1;
    position: relative;
    z-index: 1;

    .installed-title {
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 3px;
    }

    .installed-desc {
      font-size: 12.5px;
      opacity: 0.8;
      line-height: 1.5;
    }
  }

  .installed-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
`;

// ── Profile Hero (Identity-first header) ──

export const ProfileHero = styled.section`
  background: #fff;
  border: 1px solid #dfe2ec;
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24px;
  max-height: 720px;

  @media (max-width: 960px) {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    padding: 20px;
    gap: 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 600px) {
    /* Stuck to the top, flush against AIToolsCard below (no margin gap).
       The 56px top offset matches the global Navbar's mobile height so this
       card sticks just below the navbar instead of underneath it. */
    position: sticky;
    top: 56px;
    z-index: 10;
    margin-bottom: 0;
    padding: 12px;
    gap: 10px;
    border-radius: 14px 14px 0 0;
    border-bottom: none;
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
  }

  @media (max-width: 480px) {
    padding: 12px;
    gap: 10px;
  }
`;

export const HeroAvatar = styled(Avatar)`
  && {
    width: 96px;
    height: 96px;
    border: 3px solid #c7cbe8;
    box-shadow: 0 4px 16px ${COLORS.PRIMARY}2e;
    font-size: 36px;
    font-weight: 700;

    @media (max-width: 600px) {
      width: 64px;
      height: 64px;
      font-size: 22px;
      border-width: 2px;
    }
  }
`;

export const HeroIdentity = styled.div`
  min-width: 0;

  h1 {
    font-size: 28px;
    font-weight: 800;
    color: #13152a;
    margin: 0 0 6px 0;
    line-height: 1.2;

    @media (max-width: 600px) {
      font-size: 18px;
      margin: 0 0 2px 0;
    }
  }
`;

export const HeroTitle = styled.div`
  font-size: 15px;
  color: #5b6abf;
  font-weight: 500;
  margin-bottom: 8px;
  line-height: 1.35;
  /* Allow up to 2 lines on desktop; clamp with ellipsis after that. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;

  @media (max-width: 600px) {
    font-size: 12.5px;
    margin-bottom: 4px;
    -webkit-line-clamp: 1;
  }
`;

export const HeroMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
  font-size: 13px;
  color: #5a5e7a;

  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    svg { font-size: 16px; color: #7b7f9e; }
  }

  .availability {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    background: ${COLORS.SUCCESS}1a;
    color: ${COLORS.SUCCESS_DARK};
    border: 1px solid ${COLORS.SUCCESS}33;
    border-radius: 999px;
    font-weight: 600;
    font-size: 12px;

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${COLORS.SUCCESS};
    }
  }

  @media (max-width: 600px) {
    gap: 6px 10px;
    font-size: 11.5px;

    .meta-item svg { font-size: 13px; }

    .availability {
      padding: 1px 8px;
      font-size: 10.5px;

      .dot { width: 5px; height: 5px; }
    }
  }
`;

export const HeroActions = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  @media (max-width: 960px) {
    grid-column: 1 / -1;
    flex-wrap: wrap;
    min-width: 0;
  }

  @media (max-width: 600px) {
    gap: 6px;
    flex-wrap: nowrap;
  }
`;

export const HeroEditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  /* Sized to match the .ghost-btn copy/view buttons (height 40px, 0 14px
   padding) so the three actions form one consistent action group. The
   primary gradient + subtle shadow keep Edit Profile visually identifiable
   as the primary action without dominating the row. */
  height: 40px;
  padding: 0 14px;
  background: ${GRADIENTS.PRIMARY};
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, filter 0.2s;
  box-shadow: 0 2px 8px ${COLORS.PRIMARY}33, inset 0 1px 0 rgba(255,255,255,0.18);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${COLORS.PRIMARY}4d, inset 0 1px 0 rgba(255,255,255,0.18);
    filter: brightness(1.02);
  }

  svg { font-size: 16px; }

  @media (max-width: 600px) {
    height: 36px;
    padding: 0 11px;
    font-size: 12px;
    border-radius: 9px;

    svg { font-size: 14px; }

    /* On narrow screens the row already has Copy link + the eye icon, so
       drop " Profile" from the label to keep all three actions on one line. */
    .edit-profile-suffix { display: none; }
  }
`;

/* Modern action group that replaces the URL-display + icon-buttons strip.
   Single rounded outlined button for "Copy link" and a square outlined
   icon-button for "View public profile". Cleaner than truncated UUIDs. */
export const HeroShareStrip = styled.div`
  display: inline-flex;
  align-items: stretch;
  gap: 6px;

  /* Outlined ghost button for the copy + open actions. */
  .ghost-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 14px;
    height: 40px;
    background: #fff;
    color: #4b5563;
    border: 1px solid #dfe2ec;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
    cursor: pointer;
    transition: all 0.15s;

    svg { font-size: 16px; color: #6b7280; }

    &:hover {
      border-color: ${COLORS.PRIMARY};
      color: ${COLORS.PRIMARY};
      background: ${COLORS.PRIMARY}08;

      svg { color: ${COLORS.PRIMARY}; }
    }

    &.copied {
      border-color: ${COLORS.SUCCESS};
      color: ${COLORS.SUCCESS_DARK};
      background: ${COLORS.SUCCESS}1a;
      svg { color: ${COLORS.SUCCESS}; }
    }
  }

  .ghost-btn.icon-only {
    padding: 0;
    width: 40px;
  }

  @media (max-width: 600px) {
    gap: 4px;

    .ghost-btn {
      height: 36px;
      padding: 0 11px;
      font-size: 12px;
      border-radius: 9px;

      svg { font-size: 14px; }
    }

    .ghost-btn.icon-only {
      width: 36px;
    }
  }
`;

// ── Color data (kept out of constants.ts) ──

export const COMPANY_LOGO_COLORS = [
  'linear-gradient(135deg, #6366f1, #4f46e5)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #3b82f6, #2563eb)',
  'linear-gradient(135deg, #ec4899, #db2777)',
];

export const EXTENSION_STEP_COLORS = [
  { bgColor: COLORS.BG_LIGHT, borderColor: `${COLORS.PRIMARY}26`, accentColor: COLORS.PRIMARY },
  { bgColor: '#f0fdf4', borderColor: `${COLORS.SUCCESS}26`, accentColor: COLORS.SUCCESS },
  { bgColor: '#fffbeb', borderColor: `${COLORS.WARNING}26`, accentColor: '#d97706' },
  { bgColor: '#fdf2f8', borderColor: `${COLORS.ACCENT_PINK}26`, accentColor: COLORS.ACCENT_PINK },
];
