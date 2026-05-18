import React from 'react';
import styled from 'styled-components';
import { Chip, Tooltip } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';

const BadgeWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const StyledChip = styled(Chip)`
  && {
    background: linear-gradient(135deg, #7c5ecf, #9333ea);
    color: white;
    font-size: 9px;
    font-weight: 600;
    height: 18px;
    border-radius: 4px;
    
    .MuiChip-icon {
      color: white;
      font-size: 11px;
      margin-left: 2px;
    }
    
    .MuiChip-label {
      padding: 0 6px;
      letter-spacing: 0.3px;
    }
  }
`;

const OverlayBadge = styled.div`
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
`;

const FullOverlay = styled.div`
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 14, 26, 0.5);
    border-radius: inherit;
    pointer-events: none;
  }
`;

// Simple inline badge
export const ComingSoonBadge = ({ size = 'small', showIcon = true }) => (
  <Tooltip title="This feature is coming soon!" arrow>
    <StyledChip
      size={size}
      icon={showIcon ? <ScheduleIcon /> : undefined}
      label="Coming Soon"
    />
  </Tooltip>
);

// Badge positioned in corner of a container
export const ComingSoonOverlay = ({ children }) => (
  <BadgeWrapper>
    {children}
    <OverlayBadge>
      <ComingSoonBadge size="small" showIcon={false} />
    </OverlayBadge>
  </BadgeWrapper>
);

// Wrapper that adds a semi-transparent overlay + badge
export const ComingSoonWrapper = ({ children, showOverlay = true }) => (
  <BadgeWrapper>
    {showOverlay ? <FullOverlay>{children}</FullOverlay> : children}
    <OverlayBadge>
      <ComingSoonBadge size="small" showIcon={false} />
    </OverlayBadge>
  </BadgeWrapper>
);

export default ComingSoonBadge;
