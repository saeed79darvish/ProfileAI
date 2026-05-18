import { useNavigate, useLocation, Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Chip,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Tooltip,
  Avatar,
  Breadcrumbs,
  LinearProgress,
  InputAdornment,
  FormControlLabel,
  Checkbox
} from '@mui/material';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f5f7fa;
  /* overflow-x: clip prevents horizontal page-scroll without creating a
     sticky scope that would break position: sticky on descendants. */
  overflow-x: clip;
  width: 100%;
  position: relative;
`;

// AI Tools Bar
export const AIToolsBar = styled.div`
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    padding: 10px 14px;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    /* Sticky just below the global Navbar (56px on mobile) so the back/Save
       row stays reachable while the form scrolls. The MobileSectionNav
       section pills sit sticky right below this. */
    position: sticky;
    top: 56px;
    z-index: 10;
  }
`;

export const AIToolsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1a1a2e;
  min-width: 0;

  .MuiBreadcrumbs-root {
    color: #6b7280;
  }

  .MuiBreadcrumbs-separator {
    color: #9ca3af;
  }

  /* On mobile, hide the parent crumb so we just show the current page label. */
  @media (max-width: 768px) {
    flex: 1;
    min-width: 0;
    gap: 6px;
    .MuiBreadcrumbs-li:not(:last-child),
    .MuiBreadcrumbs-separator {
      display: none;
    }
  }
`;

/* Mobile-only back button — the desktop breadcrumb ("Profile › Edit Profile")
   doubles as the way back, but on mobile the parent crumb is hidden to save
   space, leaving Save as the only escape from the form. This icon button
   restores explicit navigation back to /profile. */
export const MobileBackButton = styled(Link)`
  display: none;

  @media (max-width: 768px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid #e5e7eb;
    background: white;
    color: #4b5563;
    flex-shrink: 0;
    text-decoration: none;
    transition: all 0.2s;

    &:hover,
    &:active {
      background: #f3f4f6;
      color: #1a1a2e;
    }

    svg {
      font-size: 20px;
    }
  }
`;

export const BreadcrumbLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4b5563;
  text-decoration: none;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    color: #1a1a2e;
  }

  svg {
    font-size: 18px;
  }
`;

export const BreadcrumbCurrent = styled(Typography)`
  && {
    color: #1a1a2e;
    font-size: 14px;
    font-weight: 500;

    /* On mobile the back arrow is the only affordance we keep — the page
       title is hidden so the four AI tool chips fit on one row without
       wrapping. */
    @media (max-width: 768px) {
      display: none;
    }
  }
`;

export const AIToolsButtons = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;

  @media (max-width: 768px) {
    width: auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 6px;
  }
`;

export const AIButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  color: #4f46e5;
  border: 1px solid #d6dbf5;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  &:hover:not(:disabled) {
    background: #f5f7ff;
    border-color: #b7c0ee;
    color: #4338ca;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  svg {
    font-size: 18px;
  }

  @media (max-width: 768px) {
    /* Default mobile sizing for buttons that keep their label (e.g. Save).
       Conditional blocks below intentionally override these — order matters:
       previously $mobileHide set \`font-size: 0\` to hide labels, but a later
       unconditional \`font-size: 13px\` re-enabled them, causing labels to
       overflow the 36px icon-only circles and overlap each other. */
    padding: 9px 14px;
    font-size: 13px;
    border-radius: 22px;

    svg {
      font-size: 16px;
    }

    /* On mobile, secondary AI buttons are compact icon + short-label
       pills. The page title is hidden (see BreadcrumbCurrent above) so
       all four fit on one row next to the back arrow. The desktop
       \" \u00b7 1 credit\" suffix and \" Resume\" word are wrapped in HideOnMobile
       so they don't bloat the mobile labels. */
    ${(props) =>
      props.$mobileHide &&
      `
      padding: 6px 10px;
      height: 34px;
      border-radius: 17px;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.01em;
      svg {
        font-size: 16px;
      }
    `}

    /* The Save button gets a primary look on mobile so it's unmistakable. */
    ${(props) =>
      props.$mobilePrimary &&
      `
      /* Mobile keeps the Save action sticky at the bottom of the form
         (see the form's <Box> wrapper around Cancel / Save Changes), so
         hide the top-bar Save here to avoid duplicating it. Desktop keeps
         this button visible. */
      display: none;
    `}
  }
`;

/* Mobile-only overflow trigger that opens the AI tools menu.
   Hidden on desktop where the individual buttons are visible.
   Currently unused: AI tool buttons render inline on mobile too. */
export const MobileAIMenuButton = styled.button`
  display: none;
`;

/* Wrapper for portions of an AIButton label that should disappear on
   mobile (e.g. the " · 1 credit" suffix and the "Resume" half of
   "Upload Resume"). Lets us keep one source of truth for the label and
   automatically shrink it for the icon-stacked mobile chips. */
export const HideOnMobile = styled.span`
  @media (max-width: 768px) {
    display: none;
  }
`;

/* Inverse: shown only on mobile. Used for short-form labels that
   replace the desktop label inside compact mobile chips. */
export const MobileOnly = styled.span`
  display: none;
  @media (max-width: 768px) {
    display: inline;
  }
`;

export const FormContainer = styled.div`
  display: flex;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  
  @media (max-width: 960px) {
    flex-direction: column;
    padding: 16px;
    gap: 16px;
  }
`;

export const Sidebar = styled.div`
  width: 240px;
  flex-shrink: 0;
  position: sticky;
  top: 80px;
  align-self: flex-start;

  /* The desktop sidebar is replaced by MobileSectionNav on mobile —
     less visual weight, keeps the form above the fold. */
  @media (max-width: 960px) {
    display: none;
  }
`;

export const SidebarCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  
  @media (max-width: 960px) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }
`;

export const SidebarTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 16px;
  
  @media (max-width: 960px) {
    margin-bottom: 0;
    flex: 1;
    min-width: 140px;
  }
`;

export const ProgressSection = styled.div`
  margin-bottom: 20px;
  
  @media (max-width: 960px) {
    flex: 1;
    min-width: 140px;
    margin-bottom: 0;
  }
`;

export const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
`;

export const NavItems = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  @media (max-width: 960px) {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    gap: 4px;
  }
`;

export const NavItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: ${props => props.$active ? 'rgba(102, 126, 234, 0.1)' : 'transparent'};
  color: ${props => props.$active ? '#667eea' : '#6b7280'};
  font-size: 14px;
  font-weight: ${props => props.$active ? 600 : 400};
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  
  &:hover {
    background: ${props => props.$active ? 'rgba(102, 126, 234, 0.1)' : '#f3f4f6'};
    color: ${props => props.$active ? '#667eea' : '#374151'};
  }
  
  svg {
    font-size: 20px;
  }
  
  @media (max-width: 960px) {
    width: auto;
    flex: 1;
    min-width: fit-content;
    justify-content: center;
    padding: 8px 12px;
    font-size: 13px;
  }
`;

export const MainContent = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ProfilePictureUpload = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 2px dashed #e5e7eb;
  border-radius: 16px;
  background: #f9fafb;
  transition: all 0.2s;
  position: relative;
  width: fit-content;

  &:hover {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.04);
  }

  @media (max-width: 768px) {
    border: none;
    background: transparent;
    padding: 4px 0 0;
    gap: 4px;
  }
`;

export const ProfileAvatar = styled(Avatar)`
  && {
    width: 100px;
    height: 100px;
    font-size: 40px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    border: 3px dashed #d1d5db;
    background: ${props => props.src ? 'transparent' : '#eef2ff'};

    &:hover {
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      width: 88px;
      height: 88px;
      font-size: 36px;
      border-width: 2px;
    }
  }
`;

export const AvatarOverlay = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  background: #667eea;
  border-radius: 50%;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid white;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s;
  
  &:hover {
    background: #5568d3;
    transform: scale(1.05);
  }
  
  svg {
    color: white;
    font-size: 18px;
  }
  
  @media (max-width: 768px) {
    padding: 12px;
    
    svg {
      font-size: 20px;
    }
  }
`;

export const UploadPhotoText = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    color: #667eea;
    font-size: 14px;
    font-weight: 600;
    margin-top: 4px;
  }
`;

export const UploadPhotoHint = styled.div`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;

  /* On mobile the hint is just noise, the file picker will reject bad
     file types anyway. Hide it to save vertical space. */
  @media (max-width: 768px) {
    display: none;
  }
`;

/* Slim banner for the "draft restored" case, much quieter than a full MUI Alert.
   Lives at the top of MainContent and shows when localStorage had unsaved changes. */
export const DraftRestoredBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 16px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  color: #065f46;
  font-size: 13px;
  line-height: 1.4;

  .draft-icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #10a37f;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      font-size: 14px;
    }
  }

  .draft-text {
    flex: 1;
    min-width: 0;
  }

  .draft-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .draft-action {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #047857;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    &:hover {
      background: rgba(4, 120, 87, 0.08);
    }
  }

  .draft-action.dismiss {
    color: #047857;
    width: 26px;
    height: 26px;
    padding: 0;
    justify-content: center;

    svg {
      font-size: 16px;
    }
  }

  @media (max-width: 768px) {
    padding: 6px 10px;
    font-size: 12.5px;
    gap: 8px;

    .draft-icon {
      width: 16px;
      height: 16px;
      svg { font-size: 12px; }
    }
  }
`;

/* ────── Mobile section nav (replaces SidebarCard on small screens) ────── */

export const MobileSectionNav = styled.div`
  display: none;

  @media (max-width: 960px) {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    /* Bleed to the screen edges so it feels integrated, not a card. */
    margin: -16px -16px 16px;
    position: sticky;
    /* Tablet: under navbar (64px). The AIToolsBar above isn't sticky here
       so we only need to clear the navbar. */
    top: 64px;
    z-index: 9;
  }

  @media (max-width: 768px) {
    /* Form padding on the smallest breakpoint shrinks too. */
    margin: -12px -12px 12px;
    padding: 8px 12px;
    gap: 10px;
    /* Mobile: under navbar (56px) + sticky AIToolsBar (~58px) = 114px. */
    top: 114px;
  }
`;

export const MobileSectionPills = styled.div`
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* Right-edge fade to hint at horizontal scroll. */
  -webkit-mask-image: linear-gradient(90deg, black calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, black calc(100% - 24px), transparent);
`;

export const MobileSectionPill = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: white;
  color: #6b7280;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    border-color: #d1d5db;
    color: #374151;
  }

  ${(props) =>
    props.$active &&
    `
    background: #1a1a2e;
    color: white;
    border-color: #1a1a2e;
    &:hover { color: white; border-color: #1a1a2e; }
  `}

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d1d5db;
    flex-shrink: 0;
  }

  .status-dot.complete {
    background: #10a37f;
  }

  ${(props) =>
    props.$active &&
    `
    .status-dot.complete { background: #6ee7b7; }
    .status-dot:not(.complete) { background: rgba(255,255,255,0.4); }
  `}
`;

export const MobileCompletionBadge = styled.div`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-left: 10px;
  border-left: 1px solid #e5e7eb;
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;

  .completion-bar {
    width: 32px;
    height: 5px;
    border-radius: 999px;
    background: #f3f4f6;
    overflow: hidden;
  }

  .completion-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: 999px;
    transition: width 0.3s;
  }

  .completion-pct {
    color: #1a1a2e;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`;
