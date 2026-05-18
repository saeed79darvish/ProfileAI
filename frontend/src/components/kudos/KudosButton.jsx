import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { kudosAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const KUDOS_TYPES = [
  { value: 'great_work', emoji: '🙌', label: 'Great Work', color: '#7c5ecf' },
  { value: 'helpful', emoji: '💡', label: 'Helpful', color: '#818cf8' },
  { value: 'inspiring', emoji: '🔥', label: 'Inspiring', color: '#9333ea' },
  { value: 'expert', emoji: '🎯', label: 'Expert', color: '#c084fc' },
  { value: 'game_changer', emoji: '🚀', label: 'Game Changer', color: '#6d28d9' }
];

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
`;

const Container = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const KudosButtonStyled = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: ${props => props.$hasGiven ? 'linear-gradient(135deg, #7c5ecf 0%, #764ba2 100%)' : 'transparent'};
  color: ${props => props.$hasGiven ? 'white' : '#555'};
  border: 1px solid ${props => props.$hasGiven ? 'transparent' : 'rgba(0,0,0,0.1)'};
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$hasGiven 
      ? 'linear-gradient(135deg, #6d28d9 0%, #7c5ecf 100%)' 
      : 'rgba(124, 94, 207, 0.1)'};
    border-color: ${props => props.$hasGiven ? 'transparent' : '#7c5ecf'};
    color: ${props => props.$hasGiven ? 'white' : '#7c5ecf'};
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .emoji {
    font-size: 1rem;
    animation: ${props => props.$animate ? pulse : 'none'} 0.3s ease;
  }
`;

const PopupOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
`;

const TypeSelector = styled(motion.div)`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 12px;
  z-index: 1000;
  min-width: 200px;
`;

const TypeOption = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${props => props.$color}15;
  }
  
  .emoji {
    font-size: 1.2rem;
  }
  
  .label {
    font-size: 0.9rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.8);
  }
`;

const MessageInput = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  
  input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    font-size: 0.85rem;
    outline: none;
    background: rgba(0, 0, 0, 0.03);
    color: #1a1a2e;
    
    &:focus {
      border-color: #7c5ecf;
    }
    
    &::placeholder {
      color: #888;
    }
  }
`;

const KudosCount = styled.span`
  font-size: 0.85rem;
  color: ${props => props.$hasGiven ? 'white' : '#555'};
`;

const KudosList = styled(motion.div)`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  padding: 12px;
  z-index: 1000;
  min-width: 250px;
  max-height: 300px;
  overflow-y: auto;
`;

const KudosItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  
  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c5ecf 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    
    img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
  }
  
  .info {
    flex: 1;
    
    .name {
      font-size: 0.85rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.8);
    }
    
    .message {
      font-size: 0.75rem;
      color: #555;
      margin-top: 2px;
    }
  }
  
  .type-emoji {
    font-size: 1rem;
  }
`;

const KudosButton = ({ 
  postId, 
  receiverId, 
  initialKudos = [], 
  onKudosChange,
  compact = false,
  refreshIntervalMs = 15000
}) => {
  const { user } = useAuth();
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showKudosList, setShowKudosList] = useState(false);
  const [kudos, setKudos] = useState(initialKudos);
  const [kudosCount, setKudosCount] = useState(initialKudos.length);
  const [userKudos, setUserKudos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [animate, setAnimate] = useState(false);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const justOpenedRef = useRef(false);
  const skipPollingRef = useRef(false);

  // Check if user already gave kudos
  useEffect(() => {
    if (user && postId) {
      kudosAPI.checkPost(postId)
        .then(res => {
          if (res.data.hasGivenKudos) {
            setUserKudos(res.data.kudos);
          }
        })
        .catch(err => console.error('Error checking kudos:', err));
    }
  }, [user, postId]);

  const fetchKudos = useCallback(async () => {
    if (!postId || skipPollingRef.current) return;
    try {
      const res = await kudosAPI.getForPost(postId);
      if (!skipPollingRef.current) {
        setKudos(res.data);
        setKudosCount(res.data.length);
      }
    } catch (err) {
      console.error('Error fetching kudos:', err);
    }
  }, [postId]);

  // Keep local state in sync when initial kudos are provided
  useEffect(() => {
    if (initialKudos && initialKudos.length > 0) {
      setKudos(initialKudos);
      setKudosCount(initialKudos.length);
    }
  }, [initialKudos]);

  // Fetch kudos for the post on mount
  useEffect(() => {
    if (postId) {
      // Always fetch to get latest count
      kudosAPI.getForPost(postId)
        .then(res => {
          setKudos(res.data);
          setKudosCount(res.data.length);
        })
        .catch(err => console.error('Error fetching kudos:', err));
    }
  }, [postId]);

  // Light polling for near real-time count updates
  useEffect(() => {
    if (!postId || !refreshIntervalMs || refreshIntervalMs < 5000) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchKudos();
      }
    };

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchKudos();
      }
    }, refreshIntervalMs);

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [postId, refreshIntervalMs, fetchKudos]);

  const handleButtonClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!user) {
      // Could redirect to login
      return;
    }
    
    // Prevent the overlay from immediately closing the popup
    justOpenedRef.current = true;
    setTimeout(() => { justOpenedRef.current = false; }, 100);
    
    if (userKudos) {
      // Show kudos list instead
      setShowKudosList(!showKudosList);
      setShowTypeSelector(false);
    } else {
      setShowTypeSelector(true);
      setShowKudosList(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleGiveKudos = async (type) => {
    if (loading || !user) return;
    
    const typeInfo = KUDOS_TYPES.find(t => t.value === type);
    
    // Build optimistic kudos object
    const optimisticKudos = {
      id: `temp-${Date.now()}`,
      senderId: user.id,
      receiverId,
      postId,
      type,
      message: message.trim() || null,
      sender: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl
      },
      typeInfo: typeInfo ? { emoji: typeInfo.emoji, label: typeInfo.label, color: typeInfo.color } : null
    };
    
    // Calculate new count BEFORE updating
    const newCount = kudosCount + 1;
    const newKudos = [optimisticKudos, ...kudos];
    
    // Optimistically update everything BEFORE the API call
    setShowTypeSelector(false);
    setUserKudos(optimisticKudos);
    setKudos(newKudos);
    setKudosCount(newCount);
    setMessage('');
    setAnimate(true);
    setTimeout(() => setAnimate(false), 300);
    setLoading(true);
    skipPollingRef.current = true;
    
    try {
      const response = await kudosAPI.give({
        receiverId,
        postId,
        type,
        message: optimisticKudos.message
      });
      
      // Replace optimistic entry with real server data
      setUserKudos(response.data);
      setKudos(prev => prev.map(k => k.id === optimisticKudos.id ? response.data : k));
      
    } catch (error) {
      console.error('Error giving kudos:', error);
      // Revert optimistic update on failure
      setUserKudos(null);
      setKudos(prev => prev.filter(k => k.id !== optimisticKudos.id));
      setKudosCount(prev => Math.max(0, prev - 1));
      
      // If already gave kudos, sync state from server
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
        try {
          const checkRes = await kudosAPI.checkPost(postId);
          if (checkRes.data.hasGivenKudos) {
            setUserKudos(checkRes.data.kudos);
          }
          const listRes = await kudosAPI.getForPost(postId);
          setKudos(listRes.data);
          setKudosCount(listRes.data.length);
        } catch {}
      }
    } finally {
      setLoading(false);
      // Re-enable polling after a delay to allow server to save
      setTimeout(() => { skipPollingRef.current = false; }, 2000);
    }
  };

  const handleRemoveKudos = async () => {
    if (loading || !userKudos) return;
    
    // Optimistically close and update
    const removedKudos = userKudos;
    const newCount = Math.max(0, kudosCount - 1);
    const newKudos = kudos.filter(k => k.id !== removedKudos.id);
    
    setShowKudosList(false);
    setUserKudos(null);
    setKudos(newKudos);
    setKudosCount(newCount);
    setLoading(true);
    skipPollingRef.current = true;
    
    try {
      await kudosAPI.remove(removedKudos.id);
      
    } catch (error) {
      console.error('Error removing kudos:', error);
      // Revert on failure
      setUserKudos(removedKudos);
      setKudos(prev => [removedKudos, ...prev]);
      setKudosCount(prev => prev + 1);
    } finally {
      setLoading(false);
      setTimeout(() => { skipPollingRef.current = false; }, 2000);
    }
  };

  const currentTypeInfo = userKudos 
    ? KUDOS_TYPES.find(t => t.value === userKudos.type) 
    : null;

  return (
    <Container ref={buttonRef}>
      <KudosButtonStyled
        type="button"
        onClick={handleButtonClick}
        $hasGiven={!!userKudos}
        $animate={animate}
        disabled={loading || (user?.id === receiverId)}
        title={user?.id === receiverId ? "You can't give kudos to yourself" : 
               userKudos ? `You gave ${currentTypeInfo?.label}` : 'Give kudos'}
      >
        <span className="emoji">
          {userKudos ? currentTypeInfo?.emoji : '👏'}
        </span>
        {!compact && (
          <span style={{ fontSize: '0.85rem', color: userKudos ? 'white' : '#555' }}>
            {kudosCount > 0 ? kudosCount : 'Kudos'}
          </span>
        )}
      </KudosButtonStyled>

      <AnimatePresence>
        {showTypeSelector && (
          <>
            <PopupOverlay onClick={(e) => { e.stopPropagation(); if (!justOpenedRef.current) setShowTypeSelector(false); }} />
            <TypeSelector
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              {KUDOS_TYPES.map(type => (
                <TypeOption
                  type="button"
                  key={type.value}
                  $color={type.color}
                  onClick={(e) => { e.stopPropagation(); handleGiveKudos(type.value); }}
                  disabled={loading}
                >
                  <span className="emoji">{type.emoji}</span>
                  <span className="label">{type.label}</span>
                </TypeOption>
              ))}
              <MessageInput>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Add a message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Default to great_work if pressing enter
                      handleGiveKudos('great_work');
                    }
                  }}
                  maxLength={200}
                />
              </MessageInput>
            </TypeSelector>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKudosList && kudos.length > 0 && (
          <>
            <PopupOverlay onClick={(e) => { e.stopPropagation(); if (!justOpenedRef.current) setShowKudosList(false); }} />
            <KudosList
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={(e) => e.stopPropagation()}
            >
              {kudos.map(k => (
                <KudosItem key={k.id}>
                  <div className="avatar">
                    {k.sender?.profilePictureUrl ? (
                      <img src={k.sender.profilePictureUrl} alt="" />
                    ) : (
                      `${k.sender?.firstName?.[0] || '?'}${k.sender?.lastName?.[0] || ''}`
                    )}
                  </div>
                  <div className="info">
                    <div className="name">
                      {k.sender?.firstName} {k.sender?.lastName}
                    </div>
                    {k.message && <div className="message">"{k.message}"</div>}
                  </div>
                  <span className="type-emoji">{k.typeInfo?.emoji}</span>
                </KudosItem>
              ))}
              {userKudos && (
                <TypeOption
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveKudos(); }}
                  style={{ marginTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12 }}
                  disabled={loading}
                >
                  <span>🗑️</span>
                  <span className="label" style={{ color: '#ef4444' }}>Remove your kudos</span>
                </TypeOption>
              )}
            </KudosList>
          </>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default KudosButton;
