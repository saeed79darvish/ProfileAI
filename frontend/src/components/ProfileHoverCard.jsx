import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Avatar, Box, Typography } from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import { resolveImageUrl } from '../services/api';

const HoverCardWrapper = styled.div`
  position: relative;
  display: inline-flex;
  cursor: pointer;
`;

const CardPopover = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1300;
  opacity: ${props => props.$visible ? 1 : 0};
  visibility: ${props => props.$visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};

  /* If there's not enough room above, show below */
  &.show-below {
    bottom: auto;
    top: calc(100% + 8px);
  }
`;

const CardContent = styled.div`
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
  padding: 16px;
  width: 260px;
  border: 1px solid rgba(0,0,0,0.06);

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: #fff;
    border-right: 1px solid rgba(0,0,0,0.06);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }

  .show-below &::after {
    bottom: auto;
    top: -6px;
    border-right: none;
    border-bottom: none;
    border-left: 1px solid rgba(0,0,0,0.06);
    border-top: 1px solid rgba(0,0,0,0.06);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
`;

const CardAvatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(124, 94, 207, 0.12);
  border: 2px solid rgba(124, 94, 207, 0.2);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const CardName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.3;
`;

const CardRole = styled.div`
  font-size: 11px;
  font-weight: 500;
  color: #7c5ecf;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
`;

const CardInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-top: 4px;

  svg {
    font-size: 14px;
    color: #999;
  }
`;

const ViewProfileBtn = styled.button`
  width: 100%;
  margin-top: 12px;
  padding: 8px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }
`;

/**
 * ProfileHoverCard - Wraps children with a hover tooltip showing user profile info
 * and makes the entire area clickable to navigate to the user's profile.
 *
 * Props:
 *  - userId: string (required)
 *  - userName: string
 *  - userAvatar: string (URL or path)
 *  - userRole: 'candidate' | 'recruiter'
 *  - headline: string (job title / headline)
 *  - location: string
 *  - companyName: string (for recruiters)
 *  - children: React.ReactNode (the wrapped element)
 *  - disabled: boolean (disable hover card, e.g. for own profile)
 */
const ProfileHoverCard = ({
  userId,
  userName = 'User',
  userAvatar,
  userRole = 'candidate',
  headline,
  location,
  companyName,
  children,
  disabled = false
}) => {
  const navigate = useNavigate();
  const [showCard, setShowCard] = useState(false);
  const cardRef = useRef(null);
  const popoverRef = useRef(null);
  const timerRef = useRef(null);

  const profileUrl = userRole === 'recruiter' ? `/recruiter/${userId}` : `/profile/${userId}`;

  const handleMouseEnter = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      setShowCard(true);
    }, 400); // delay to avoid flickering
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowCard(false);
    }, 200);
  };

  const handleClick = (e) => {
    if (disabled || !userId) return;
    e.stopPropagation();
    navigate(profileUrl);
  };

  const handleViewProfile = (e) => {
    e.stopPropagation();
    if (!userId) return;
    navigate(profileUrl);
  };

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Check if popover should show below (not enough room above)
  useEffect(() => {
    if (showCard && popoverRef.current && cardRef.current) {
      const wrapperRect = cardRef.current.getBoundingClientRect();
      if (wrapperRect.top < 300) {
        popoverRef.current.classList.add('show-below');
      } else {
        popoverRef.current.classList.remove('show-below');
      }
    }
  }, [showCard]);

  if (disabled || !userId) {
    return <>{children}</>;
  }

  const initials = userName
    .split(' ')
    .map(n => n?.[0] || '')
    .join('')
    .toUpperCase();

  const resolvedAvatar = userAvatar ? resolveImageUrl(userAvatar) : null;

  return (
    <HoverCardWrapper
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      <CardPopover ref={popoverRef} $visible={showCard}>
        <CardContent>
          <CardHeader>
            <CardAvatar>
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt={userName} />
              ) : (
                <Avatar sx={{ width: 44, height: 44, fontSize: 16, background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #8b5cf6 100%)', color: '#fff', fontWeight: 600 }}>
                  {initials}
                </Avatar>
              )}
            </CardAvatar>
            <Box>
              <CardName>{userName}</CardName>
              <CardRole>{userRole === 'recruiter' ? 'Recruiter' : 'Candidate'}</CardRole>
            </Box>
          </CardHeader>

          {headline && (
            <CardInfoRow>
              <WorkIcon />
              <span>{headline}</span>
            </CardInfoRow>
          )}

          {location && (
            <CardInfoRow>
              <LocationIcon />
              <span>{location}</span>
            </CardInfoRow>
          )}

          {companyName && userRole === 'recruiter' && (
            <CardInfoRow>
              <BusinessIcon />
              <span>{companyName}</span>
            </CardInfoRow>
          )}

          <ViewProfileBtn onClick={handleViewProfile}>
            View Profile
          </ViewProfileBtn>
        </CardContent>
      </CardPopover>
    </HoverCardWrapper>
  );
};

export default ProfileHoverCard;
