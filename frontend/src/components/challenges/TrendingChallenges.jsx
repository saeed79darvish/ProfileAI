import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Skeleton, Chip, Avatar, AvatarGroup, alpha
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  ArrowForward as ArrowIcon,
  LocalFireDepartment as FireIcon,
  FormatListBulleted as ListIcon
} from '@mui/icons-material';
import { challengesAPI, resolveImageUrl } from '../../services/api';

const GRADIENTS = {
  sprint: 'linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%)',
  deep_dive: 'linear-gradient(135deg, #8B5CF6 0%, #7c5ecf 100%)',
  transformation: 'linear-gradient(135deg, #818cf8 0%, #7c5ecf 100%)',
  custom: 'linear-gradient(135deg, #9333ea 0%, #7c5ecf 100%)'
};

export default function TrendingChallenges({ limit = 3 }) {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const response = await challengesAPI.getAll({ 
        status: 'active', 
        limit,
        sort: 'popular' 
      });
      setChallenges(response.data.challenges || []);
    } catch (error) {
      console.error('Error loading trending challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Skeleton variant="text" width="60%" height={28} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
        <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.06)' }} />
        <Skeleton variant="rectangular" height={80} sx={{ mt: 1, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.06)' }} />
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: '20px', background: '#ffffff', border: 'none', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FireIcon sx={{ color: '#f97316' }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#1a1a2e' }}>
            Active Challenges
          </Typography>
        </Box>
        <Button 
          size="small" 
          onClick={() => navigate('/challenges')}
          endIcon={<ArrowIcon fontSize="small" />}
          sx={{ color: '#7c5ecf', textTransform: 'uppercase', fontSize: '12px', fontWeight: 700 }}
        >
          See all
        </Button>
      </Box>
      
      {challenges.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {challenges.map(challenge => {
            const gradient = GRADIENTS[challenge.type] || GRADIENTS.custom;
            const daysRemaining = Math.max(0, Math.ceil((new Date(challenge.endDate) - new Date()) / (1000 * 60 * 60 * 24)));
            
            return (
              <Box
                key={challenge.id}
                onClick={() => navigate(`/challenges/${challenge.id}`)}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.03)',
                    transform: 'translateX(4px)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Typography variant="h6">{challenge.emoji || '🎯'}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="subtitle2" 
                      fontWeight={600}
                      sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        color: '#1a1a2e'
                      }}
                    >
                      {challenge.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 10 } }}>
                        {challenge.participants?.slice(0, 3).map(p => (
                          <Avatar 
                            key={p.id} 
                            src={p.user?.Profile?.profilePicture ? resolveImageUrl(p.user.Profile.profilePicture) : undefined}
                          >
                            {p.user?.firstName?.[0]}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      <Typography variant="caption" color="text.secondary" sx={{ color: '#555' }}>
                        {challenge.participantCount || challenge.participants?.length || 0} joined
                      </Typography>
                    </Box>
                  </Box>
                  <Chip 
                    label={`${daysRemaining}d`} 
                    size="small"
                    icon={<FireIcon sx={{ fontSize: 14 }} />}
                    sx={{ 
                      bgcolor: alpha('#7c5ecf', 0.1),
                      color: '#9333ea',
                      fontSize: '0.7rem',
                      height: 24
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ 
          textAlign: 'center', 
          py: 3,
          border: '2px dashed rgba(0,0,0,0.10)',
          borderRadius: 3,
        }}>
          <Box sx={{ 
            width: 48, height: 48, borderRadius: '12px', 
            background: 'rgba(0,0,0,0.04)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <ListIcon sx={{ color: '#aaa', fontSize: 24 }} />
          </Box>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ color: '#888' }}>
            No active challenges
          </Typography>
          <Button 
            variant="contained" 
            size="small"
            onClick={() => navigate('/challenges/create')}
            sx={{ 
              mt: 1,
              background: 'linear-gradient(135deg, #7c5ecf, #6d28d9)',
              borderRadius: '20px',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '12px',
              px: 3,
              '&:hover': {
                background: 'linear-gradient(135deg, #6d28d9, #5b21b6)'
              }
            }}
          >
            Start One
          </Button>
        </Box>
      )}
      
    </Paper>
  );
}
