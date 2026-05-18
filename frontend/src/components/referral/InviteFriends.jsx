import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Box, Typography, Button, IconButton, Tooltip, Paper, LinearProgress,
  Snackbar, Alert, Skeleton
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  PersonAdd as InviteIcon,
  EmojiEvents as TrophyIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { referralAPI } from '../../services/api';

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const Container = styled(Paper)`
  border-radius: 20px;
  overflow: hidden;
  background: #ffffff !important;
  border: none;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06) !important;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #a855f7 70%, #c084fc 100%);
  padding: 28px 20px 20px;
  color: white;
  position: relative;
  text-align: center;
`;

const HeaderIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  
  svg {
    font-size: 28px;
  }
`;

const HeaderTitle = styled.div`
  font-size: 20px;
  font-weight: 700;
  margin-top: 0;
`;

const HeaderSubtitle = styled.p`
  font-size: 13px;
  opacity: 0.9;
  margin: 4px 0 0 0;
`;

const Content = styled.div`
  padding: 20px;
`;

const ReferralCodeBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0,0,0,0.01);
  border: 2px dashed rgba(0,0,0,0.12);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
  text-align: center;
`;

const CodeDisplay = styled.div`
  .label {
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  
  .code-row {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }
  
  .code {
    font-size: 24px;
    font-weight: 700;
    font-family: 'SF Mono', Monaco, monospace;
    color: #1a1a2e;
    letter-spacing: 3px;
  }
`;

const ShareButtons = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 20px;
`;

const ShareButton = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  .icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.04);
    transition: all 0.2s;
  }
  
  &:hover .icon-circle {
    background: rgba(0,0,0,0.08);
  }
  
  .label {
    font-size: 11px;
    color: #666;
    font-weight: 500;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
`;

const StatBox = styled.div`
  text-align: center;
  padding: 12px;
  background: rgba(0,0,0,0.03);
  border-radius: 10px;
  
  .value {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
  }
  
  .label {
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
`;

const RewardProgress = styled.div`
  background: rgba(124,94,207,0.06);
  border-radius: 14px;
  padding: 18px;
`;

const RewardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 12px;
  
  svg {
    color: #7c5ecf;
  }
`;

const MilestoneTrack = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  
  .milestone {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${props => props.$reached ? '#7c5ecf' : 'rgba(0,0,0,0.08)'};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .label {
      font-size: 10px;
      color: #666;
    }
  }
`;

const Milestone = ({ count, reached, reward }) => (
  <div className="milestone">
    <div className="dot" style={{ background: reached ? '#7c5ecf' : 'rgba(0,0,0,0.08)' }}>
      {reached ? <CheckIcon sx={{ fontSize: 14 }} /> : count}
    </div>
    <span className="label" style={{ color: '#666' }}>{reward}</span>
  </div>
);

const InviteFriends = ({ compact = false }) => {
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  useEffect(() => {
    loadReferralData();
  }, []);
  
  const loadReferralData = async () => {
    try {
      setLoading(true);
      const response = await referralAPI.getMyCode();
      setReferralData(response.data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = async () => {
    if (!referralData?.code) {
      setSnackbar({ open: true, message: 'Loading your invite link...', severity: 'info' });
      return;
    }
    try {
      // Copy a compelling message with the link
      const link = referralData?.referralLink || `${window.location.origin}/register?ref=${referralData?.code}`;
      const copyText = `🚀 Join me on ProfileAI!\n\nAI-powered career growth:\n✨ Profile enhancement\n🎯 Smart job matching\n💼 Interview prep\n\nSign up free: ${link}`;
      await navigator.clipboard.writeText(copyText);
      setSnackbar({ open: true, message: 'Invite message copied!', severity: 'success' });
      
      // Track share
      referralAPI.share('direct').catch(() => {});
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
    }
  };
  
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralData?.code || '');
      setSnackbar({ open: true, message: 'Code copied!', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to copy', severity: 'error' });
    }
  };
  
  // Build referral link with fallback
  const referralLink = referralData?.referralLink || `${window.location.origin}/register?ref=${referralData?.code || ''}`;
  const referralCode = referralData?.code || '';
  
  // Compelling share messages for each platform
  const getShareContent = (platform) => {
    const baseMessages = {
      twitter: `🚀 I'm using ProfileAI to supercharge my career with AI-powered profile enhancement, smart job matching, and interview prep.\n\nJoin free with my link 👇`,
      
      linkedin: `I've been using ProfileAI to optimize my professional presence and it's been a game-changer.\n\n✨ AI-enhanced profiles that get noticed\n🎯 Smart job matching\n💼 Interview preparation tools\n\nJoin the community:`,
      
      whatsapp: `Hey! 👋\n\nCheck out ProfileAI - it's like having a career coach powered by AI.\n\n🔥 AI rewrites your profile to stand out\n🎯 Matches you with perfect job opportunities\n📈 Helps you grow your professional network\n\nSign up free with my invite:`,
      
      email: `Hey!\n\nI wanted to share something that's been really helpful for my career - ProfileAI.\n\nIt uses AI to:\n• Enhance your professional profile\n• Match you with relevant job opportunities\n• Prepare you for interviews\n• Connect you with the right people\n\nI think you'd find it valuable. You can sign up for free using my invite link:\n\n${referralLink}\n\nLet me know what you think!`,
      
      copy: `🚀 Join me on ProfileAI!\n\nAI-powered career growth:\n✨ Profile enhancement\n🎯 Smart job matching\n💼 Interview prep\n\nSign up free: ${referralLink}`
    };
    
    return baseMessages[platform] || baseMessages.copy;
  };
  
  const handleShareTwitter = () => {
    if (!referralCode) {
      setSnackbar({ open: true, message: 'Loading your invite link...', severity: 'info' });
      return;
    }
    const message = getShareContent('twitter');
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(referralLink)}`;
    window.open(url, '_blank', 'width=600,height=400');
    referralAPI.share('twitter').catch(() => {});
  };
  
  const handleShareLinkedIn = () => {
    if (!referralCode) {
      setSnackbar({ open: true, message: 'Loading your invite link...', severity: 'info' });
      return;
    }
    // LinkedIn only allows URL sharing, the preview will show the page content
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;
    window.open(url, '_blank', 'width=600,height=600');
    referralAPI.share('linkedin').catch(() => {});
  };
  
  const handleShareWhatsApp = () => {
    if (!referralCode) {
      setSnackbar({ open: true, message: 'Loading your invite link...', severity: 'info' });
      return;
    }
    const message = getShareContent('whatsapp');
    const url = `https://wa.me/?text=${encodeURIComponent(`${message}\n\n${referralLink}`)}`;
    window.open(url, '_blank');
    referralAPI.share('whatsapp').catch(() => {});
  };
  
  const handleShareEmail = () => {
    if (!referralCode) {
      setSnackbar({ open: true, message: 'Loading your invite link...', severity: 'info' });
      return;
    }
    const subject = '🚀 Check out ProfileAI - AI-powered career growth';
    const body = getShareContent('email');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    referralAPI.share('email').catch(() => {});
  };
  
  const milestones = [
    { count: 3, reward: '1 mo Pro' },
    { count: 5, reward: '2 mo Pro' },
    { count: 10, reward: '6 mo Pro' }
  ];
  
  const totalReferred = referralData?.stats?.totalReferred || 0;
  const nextMilestone = milestones.find(m => m.count > totalReferred) || milestones[milestones.length - 1];
  const progress = Math.min((totalReferred / nextMilestone.count) * 100, 100);
  
  if (loading) {
    return (
      <Container elevation={0}>
        <Header>
          <Skeleton variant="text" width={150} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
          <Skeleton variant="text" width={200} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
        </Header>
        <Content>
          <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={80} />
        </Content>
      </Container>
    );
  }
  
  return (
    <Container elevation={0}>
      <Header>
        <HeaderIcon>
          <InviteIcon />
        </HeaderIcon>
        <HeaderTitle>
          Invite Friends
        </HeaderTitle>
        <HeaderSubtitle>
          Get 1 month of Pro free!
        </HeaderSubtitle>
      </Header>
      
      <Content>
        {/* Referral Code */}
        <ReferralCodeBox>
          <CodeDisplay>
            <div className="label">Your Invite Code</div>
            <div className="code-row">
              <span className="code">{referralData?.code || 'LOADING'}</span>
              <Tooltip title="Copy code">
                <IconButton onClick={handleCopyCode} size="small" sx={{ color: '#7c5ecf' }}>
                  <CopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </div>
          </CodeDisplay>
        </ReferralCodeBox>
        
        {/* Share Buttons */}
        <ShareButtons>
          <ShareButton onClick={handleCopyLink}>
            <div className="icon-circle"><CopyIcon sx={{ fontSize: 20, color: '#666' }} /></div>
            <span className="label">Copy</span>
          </ShareButton>
          <ShareButton onClick={handleShareTwitter}>
            <div className="icon-circle"><TwitterIcon sx={{ fontSize: 20, color: '#1DA1F2' }} /></div>
            <span className="label">Twitter</span>
          </ShareButton>
          <ShareButton onClick={handleShareLinkedIn}>
            <div className="icon-circle"><LinkedInIcon sx={{ fontSize: 20, color: '#0A66C2' }} /></div>
            <span className="label">LinkedIn</span>
          </ShareButton>
          <ShareButton onClick={handleShareWhatsApp}>
            <div className="icon-circle"><WhatsAppIcon sx={{ fontSize: 20, color: '#25D366' }} /></div>
            <span className="label">Whats...</span>
          </ShareButton>
        </ShareButtons>
        
        {/* Reward Progress */}
        <RewardProgress>
          <RewardTitle>
            <TrophyIcon />
            Progress to Reward
          </RewardTitle>
          <Box sx={{ mb: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(124, 94, 207, 0.15)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #7c5ecf, #9333ea)'
                }
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#888' }}>{totalReferred} Friends</Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>{nextMilestone.count} Friends</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#555' }}>
            Invite {Math.max(0, nextMilestone.count - totalReferred)} more friends to unlock Pro!
          </Typography>
        </RewardProgress>
      </Content>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default InviteFriends;
