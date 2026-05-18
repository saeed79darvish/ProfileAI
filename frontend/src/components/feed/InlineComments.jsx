import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Box, Avatar, TextField, IconButton, Typography, CircularProgress,
  Collapse, Button, Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  FavoriteBorder as LikeOutlinedIcon,
  Favorite as LikeIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { postAPI, resolveImageUrl } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import ProfileHoverCard from '../ProfileHoverCard';

const CommentsContainer = styled.div`
  padding: 16px 20px;
  background: #ffffff;
  border-top: 1px solid rgba(0,0,0,0.06);
`;

const CommentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(124,94,207,0.3);
    border-radius: 2px;
  }
`;

const CommentItem = styled.div`
  display: flex;
  gap: 10px;
`;

const CommentAvatar = styled.div`
  width: ${props => props.$small ? '26px' : '32px'};
  height: ${props => props.$small ? '26px' : '32px'};
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(102, 126, 234, 0.1);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const CommentContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const CommentBubble = styled.div`
  background: #f4f4f8;
  border-radius: 14px;
  padding: 10px 14px;
  border: none;
  transition: background 0.2s;
  
  &:hover {
    background: #eef0f6;
  }
`;

const CommentAuthor = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  cursor: pointer;
  
  &:hover {
    color: #7c5ecf;
    text-decoration: underline;
  }
`;

const CommentText = styled.p`
  font-size: 14px;
  color: #2d2d2d;
  margin: 4px 0 0 0;
  line-height: 1.55;
  word-break: break-word;
`;

const CommentMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding-left: 4px;
`;

const MetaAction = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 3px 8px;
  font-size: 12px;
  color: ${props => props.$active ? '#7c5ecf' : '#555'};
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s;
  font-weight: 500;
  
  &:hover {
    background: rgba(124,94,207,0.08);
    color: #7c5ecf;
  }
  
  svg {
    font-size: 14px;
  }
`;

const CommentInputWrapper = styled.div`
  display: flex;
  gap: 10px;
  margin-top: ${props => props.$isReply ? '10px' : '14px'};
  padding-top: ${props => props.$isReply ? '0' : '14px'};
  border-top: ${props => props.$isReply ? 'none' : '1px solid rgba(0,0,0,0.08)'};
`;

const InputField = styled.div`
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  background: #f4f4f8;
  border: 1.5px solid transparent;
  border-radius: 24px;
  padding: 8px 8px 8px 16px;
  transition: all 0.2s;
  
  &:focus-within {
    background: #ffffff;
    border-color: #7c5ecf;
    box-shadow: 0 0 0 3px rgba(124, 94, 207, 0.1);
  }
  
  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
    background: transparent;
    color: #1a1a2e;
    
    &::placeholder {
      color: #999;
    }
  }
`;

const ViewMoreButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #7c5ecf;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 0;
  
  &:hover {
    text-decoration: underline;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px 16px;
  color: #999;
  font-size: 13px;
  font-style: italic;
`;

const RepliesContainer = styled.div`
  margin-top: 10px;
  margin-left: 8px;
  padding-left: 14px;
  border-left: 2px solid rgba(124,94,207,0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ReplyingTo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(124,94,207,0.1);
  border-radius: 8px;
  font-size: 12px;
  color: #7c5ecf;
  font-weight: 500;
  margin-bottom: 6px;
  
  button {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    color: #7c5ecf;
    padding: 0;
    margin-left: auto;
    
    &:hover {
      color: #818cf8;
    }
  }
`;

const InlineComments = ({ postId, isExpanded, onToggle, commentCount = 0 }) => {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likedComments, setLikedComments] = useState(new Set());
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null); // { commentId, authorName }
  const [replyContent, setReplyContent] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [repliesData, setRepliesData] = useState({}); // { commentId: [replies] }
  const [loadingReplies, setLoadingReplies] = useState(new Set());
  
  useEffect(() => {
    if (isExpanded && comments.length === 0) {
      loadComments();
    }
  }, [isExpanded]);
  
  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await postAPI.getComments(postId);
      setComments(response.data);
      
      const liked = new Set(
        response.data
          .filter(c => c.isLikedByUser)
          .map(c => c.id)
      );
      setLikedComments(liked);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;
    
    try {
      setSubmitting(true);
      const response = await postAPI.addComment(postId, newComment.trim());
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleLikeComment = async (commentId) => {
    if (!isAuthenticated) return;
    
    try {
      const isLiked = likedComments.has(commentId);
      await postAPI.likeComment(postId, commentId);
      
      if (isLiked) {
        setLikedComments(prev => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, likesCount: Math.max(0, (c.likesCount || 1) - 1) } : c
        ));
      } else {
        setLikedComments(prev => new Set([...prev, commentId]));
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, likesCount: (c.likesCount || 0) + 1 } : c
        ));
      }
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };
  
  const handleStartReply = (comment) => {
    setReplyingTo({ commentId: comment.id, authorName: getAuthorName(comment) });
    setReplyContent('');
    // Auto-expand replies for context
    if (!expandedReplies.has(comment.id) && comment.repliesCount > 0) {
      handleToggleReplies(comment);
    }
  };
  
  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyContent('');
  };
  
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !isAuthenticated || !replyingTo) return;
    
    try {
      setReplySubmitting(true);
      const response = await postAPI.replyToComment(postId, replyingTo.commentId, replyContent.trim());
      
      // Add reply to local state
      setRepliesData(prev => ({
        ...prev,
        [replyingTo.commentId]: [...(prev[replyingTo.commentId] || []), response.data]
      }));
      
      // Update reply count on parent comment
      setComments(prev => prev.map(c => 
        c.id === replyingTo.commentId 
          ? { ...c, repliesCount: (c.repliesCount || 0) + 1 } 
          : c
      ));
      
      // Ensure replies are expanded
      setExpandedReplies(prev => new Set([...prev, replyingTo.commentId]));
      
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setReplySubmitting(false);
    }
  };
  
  const handleToggleReplies = async (comment) => {
    const commentId = comment.id;
    
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      return;
    }
    
    // Load replies if not already loaded
    if (!repliesData[commentId]) {
      setLoadingReplies(prev => new Set([...prev, commentId]));
      try {
        const response = await postAPI.getReplies(postId, commentId);
        setRepliesData(prev => ({ ...prev, [commentId]: response.data }));
      } catch (error) {
        console.error('Failed to load replies:', error);
      } finally {
        setLoadingReplies(prev => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    }
    
    setExpandedReplies(prev => new Set([...prev, commentId]));
  };
  
  const getAuthorName = (comment) => {
    if (comment.user) {
      return `${comment.user.firstName} ${comment.user.lastName}`;
    }
    return 'Anonymous';
  };
  
  const getAuthorAvatar = (comment) => {
    if (comment.user?.profile?.profilePicture) {
      return resolveImageUrl(comment.user.profile.profilePicture);
    }
    if (comment.user?.recruiterProfile?.profilePicture) {
      return resolveImageUrl(comment.user.recruiterProfile.profilePicture);
    }
    return null;
  };

  const getAuthorAvatarRaw = (comment) => {
    return comment.user?.profile?.profilePicture
      || comment.user?.recruiterProfile?.profilePicture
      || null;
  };

  const getAuthorRole = (comment) => {
    return comment.user?.role || (comment.user?.recruiterProfile ? 'recruiter' : 'candidate');
  };
  
  const renderAvatar = (comment, small = false) => {
    const avatar = getAuthorAvatar(comment);
    if (avatar) {
      return <CommentAvatar $small={small}><img src={avatar} alt="" /></CommentAvatar>;
    }
    return (
      <CommentAvatar $small={small}>
        <Avatar sx={{ width: small ? 26 : 32, height: small ? 26 : 32, fontSize: small ? 11 : 12 }}>
          {getAuthorName(comment).charAt(0)}
        </Avatar>
      </CommentAvatar>
    );
  };
  
  if (!isExpanded) {
    return (
      <Box sx={{ 
        px: 2.5, 
        py: 1.5, 
        borderTop: '1px solid rgba(0,0,0,0.06)',
        background: '#ffffff' 
      }}>
        <ViewMoreButton onClick={onToggle}>
          <ExpandIcon fontSize="small" />
          {commentCount > 0 
            ? `View ${commentCount} comment${commentCount !== 1 ? 's' : ''}`
            : 'Add a comment'
          }
        </ViewMoreButton>
      </Box>
    );
  }
  
  return (
    <CommentsContainer>
      {/* Collapse Button */}
      <ViewMoreButton onClick={onToggle} style={{ marginTop: 0, marginBottom: 10 }}>
        <CollapseIcon fontSize="small" />
        Hide comments
      </ViewMoreButton>
      
      {/* Comments List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} sx={{ color: '#7c5ecf' }} />
        </Box>
      ) : comments.length === 0 ? (
        <EmptyState>No comments yet. Be the first to comment!</EmptyState>
      ) : (
        <CommentsList>
          {comments.map(comment => (
            <CommentItem key={comment.id}>
              <ProfileHoverCard
                userId={comment.user?.id}
                userName={getAuthorName(comment)}
                userAvatar={getAuthorAvatarRaw(comment)}
                userRole={getAuthorRole(comment)}
                disabled={!comment.user?.id}
              >
                {renderAvatar(comment)}
              </ProfileHoverCard>
              <CommentContent>
                <CommentBubble>
                  <ProfileHoverCard
                    userId={comment.user?.id}
                    userName={getAuthorName(comment)}
                    userAvatar={getAuthorAvatarRaw(comment)}
                    userRole={getAuthorRole(comment)}
                    disabled={!comment.user?.id}
                  >
                    <CommentAuthor>{getAuthorName(comment)}</CommentAuthor>
                  </ProfileHoverCard>
                  <CommentText>{comment.content}</CommentText>
                </CommentBubble>
                <CommentMeta>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </Typography>
                  <MetaAction 
                    $active={likedComments.has(comment.id)}
                    onClick={() => handleLikeComment(comment.id)}
                  >
                    {likedComments.has(comment.id) ? <LikeIcon /> : <LikeOutlinedIcon />}
                    {comment.likesCount || 0}
                  </MetaAction>
                  {isAuthenticated && (
                    <MetaAction onClick={() => handleStartReply(comment)}>
                      <ReplyIcon />
                      Reply
                    </MetaAction>
                  )}
                  {comment.repliesCount > 0 && (
                    <MetaAction 
                      $active={expandedReplies.has(comment.id)}
                      onClick={() => handleToggleReplies(comment)}
                    >
                      {expandedReplies.has(comment.id) ? <CollapseIcon /> : <ExpandIcon />}
                      {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}
                    </MetaAction>
                  )}
                </CommentMeta>
                
                {/* Replies */}
                {expandedReplies.has(comment.id) && (
                  <RepliesContainer>
                    {loadingReplies.has(comment.id) ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={18} sx={{ color: '#7c5ecf' }} />
                      </Box>
                    ) : (repliesData[comment.id] || []).map(reply => (
                      <CommentItem key={reply.id}>
                        <ProfileHoverCard
                          userId={reply.user?.id}
                          userName={getAuthorName(reply)}
                          userAvatar={getAuthorAvatarRaw(reply)}
                          userRole={getAuthorRole(reply)}
                          disabled={!reply.user?.id}
                        >
                          {renderAvatar(reply, true)}
                        </ProfileHoverCard>
                        <CommentContent>
                          <CommentBubble style={{ padding: '8px 12px' }}>
                            <ProfileHoverCard
                              userId={reply.user?.id}
                              userName={getAuthorName(reply)}
                              userAvatar={getAuthorAvatarRaw(reply)}
                              userRole={getAuthorRole(reply)}
                              disabled={!reply.user?.id}
                            >
                              <CommentAuthor>{getAuthorName(reply)}</CommentAuthor>
                            </ProfileHoverCard>
                            <CommentText style={{ fontSize: 13 }}>{reply.content}</CommentText>
                          </CommentBubble>
                          <CommentMeta>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                              {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                            </Typography>
                          </CommentMeta>
                        </CommentContent>
                      </CommentItem>
                    ))}
                  </RepliesContainer>
                )}
                
                {/* Reply Input (inline under the comment being replied to) */}
                {replyingTo?.commentId === comment.id && (
                  <Box sx={{ mt: 1.5 }}>
                    <ReplyingTo>
                      <ReplyIcon sx={{ fontSize: 14 }} />
                      Replying to {replyingTo.authorName}
                      <button type="button" onClick={handleCancelReply}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </button>
                    </ReplyingTo>
                    <CommentInputWrapper $isReply>
                      <CommentAvatar $small>
                        {user?.profilePicture ? (
                          <img src={resolveImageUrl(user.profilePicture)} alt="" />
                        ) : (
                          <Avatar sx={{ width: 26, height: 26, fontSize: 11 }}>
                            {user?.firstName?.charAt(0) || 'U'}
                          </Avatar>
                        )}
                      </CommentAvatar>
                      <form onSubmit={handleSubmitReply} style={{ flex: 1 }}>
                        <InputField>
                          <input
                            type="text"
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            disabled={replySubmitting}
                            autoFocus
                          />
                          <IconButton 
                            type="submit" 
                            size="small" 
                            disabled={!replyContent.trim() || replySubmitting}
                            sx={{ 
                              color: replyContent.trim() ? '#7c5ecf' : 'rgba(0,0,0,0.2)',
                              p: 0.5
                            }}
                          >
                            {replySubmitting ? <CircularProgress size={16} /> : <SendIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </InputField>
                      </form>
                    </CommentInputWrapper>
                  </Box>
                )}
              </CommentContent>
            </CommentItem>
          ))}
        </CommentsList>
      )}
      
      {/* Main Comment Input */}
      {isAuthenticated ? (
        <CommentInputWrapper>
          <CommentAvatar>
            {user?.profilePicture ? (
              <img src={resolveImageUrl(user.profilePicture)} alt="" />
            ) : (
              <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>
                {user?.firstName?.charAt(0) || 'U'}
              </Avatar>
            )}
          </CommentAvatar>
          <form onSubmit={handleSubmitComment} style={{ flex: 1 }}>
            <InputField>
              <input
                type="text"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submitting}
              />
              <IconButton 
                type="submit" 
                size="small" 
                disabled={!newComment.trim() || submitting}
                sx={{ 
                  color: newComment.trim() ? '#7c5ecf' : 'rgba(0,0,0,0.2)',
                  p: 0.5
                }}
              >
                {submitting ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
              </IconButton>
            </InputField>
          </form>
        </CommentInputWrapper>
      ) : (
        <Box sx={{ textAlign: 'center', py: 1.5, color: '#666', fontSize: 13 }}>
          <a href="/login" style={{ color: '#7c5ecf', textDecoration: 'none' }}>Sign in</a> to comment
        </Box>
      )}
    </CommentsContainer>
  );
};

export default InlineComments;
