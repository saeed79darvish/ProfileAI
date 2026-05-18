import React, { useState, useEffect } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { PersonAdd, PersonRemove, Check } from '@mui/icons-material';
import { followAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * FollowButton Component
 * 
 * A reusable button to follow/unfollow users
 * 
 * @param {Object} props
 * @param {number} props.userId - The ID of the user to follow/unfollow
 * @param {string} props.size - Button size: 'small', 'medium', 'large'
 * @param {string} props.variant - Button variant: 'contained', 'outlined', 'text'
 * @param {function} props.onFollowChange - Callback when follow status changes (isFollowing, counts)
 * @param {boolean} props.initialIsFollowing - Initial follow state (optional, will fetch if not provided)
 * @param {boolean} props.showIcon - Whether to show icon in button
 * @param {string} props.followText - Custom text for follow button
 * @param {string} props.followingText - Custom text when following
 * @param {string} props.unfollowText - Custom text on hover when following
 */
const FollowButton = ({
  userId,
  size = 'medium',
  variant = 'contained',
  onFollowChange,
  initialIsFollowing = null,
  showIcon = true,
  followText = 'Follow',
  followingText = 'Following',
  unfollowText = 'Unfollow',
  sx = {}
}) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(initialIsFollowing === null);
  const [isHovering, setIsHovering] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Don't render if viewing own profile
  const isOwnProfile = user?.id === userId;

  // Fetch initial follow status if not provided
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (initialIsFollowing !== null || isOwnProfile || !userId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await followAPI.checkFollowStatus(userId);
        setIsFollowing(response.data.isFollowing);
      } catch (error) {
        console.error('Error checking follow status:', error);
        setIsFollowing(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowStatus();
  }, [userId, initialIsFollowing, isOwnProfile]);

  // Handle follow/unfollow action
  const handleFollowAction = async () => {
    if (actionLoading || !userId) return;

    setActionLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await followAPI.unfollow(userId);
        setIsFollowing(false);
        
        // Get updated counts
        const countsResponse = await followAPI.getCounts(userId);
        onFollowChange?.(false, countsResponse.data);
      } else {
        // Follow
        await followAPI.follow(userId);
        setIsFollowing(true);
        
        // Get updated counts
        const countsResponse = await followAPI.getCounts(userId);
        onFollowChange?.(true, countsResponse.data);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert on error
      if (error.response?.status === 400) {
        // Already following/not following - sync state
        const response = await followAPI.checkFollowStatus(userId);
        setIsFollowing(response.data.isFollowing);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Don't render button for own profile
  if (isOwnProfile) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        sx={{ minWidth: 100, ...sx }}
      >
        <CircularProgress size={20} />
      </Button>
    );
  }

  // Determine button appearance based on state
  const getButtonProps = () => {
    if (isFollowing) {
      // Currently following - show "Following" or "Unfollow" on hover
      return {
        color: isHovering ? 'error' : 'primary',
        variant: isHovering ? 'outlined' : 'outlined',
        text: isHovering ? unfollowText : followingText,
        icon: isHovering ? <PersonRemove /> : <Check />
      };
    } else {
      // Not following - show "Follow"
      return {
        color: 'primary',
        variant: 'contained',
        text: followText,
        icon: <PersonAdd />
      };
    }
  };

  const buttonProps = getButtonProps();

  return (
    <Button
      variant={buttonProps.variant}
      color={buttonProps.color}
      size={size}
      onClick={handleFollowAction}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      disabled={actionLoading}
      startIcon={showIcon && !actionLoading ? buttonProps.icon : null}
      sx={{
        minWidth: 120,
        transition: 'all 0.2s ease-in-out',
        ...sx
      }}
    >
      {actionLoading ? (
        <CircularProgress size={20} color="inherit" />
      ) : (
        buttonProps.text
      )}
    </Button>
  );
};

export default FollowButton;
