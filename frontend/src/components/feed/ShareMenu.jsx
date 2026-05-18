import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Menu, MenuItem, ListItemIcon, ListItemText, Snackbar, Alert, Divider
} from '@mui/material';
import {
  Link as LinkIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

const StyledMenu = styled(Menu)`
  .MuiPaper-root {
    border-radius: 12px;
    min-width: 200px;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    color: rgba(0,0,0,0.7);
  }
  .MuiMenuItem-root {
    color: rgba(0,0,0,0.7);
    &:hover {
      background: rgba(124,94,207,0.08);
    }
  }
  .MuiDivider-root {
    border-color: rgba(0,0,0,0.08);
  }
`;

const MenuTitle = styled.div`
  padding: 12px 16px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ShareMenu = ({ anchorEl, open, onClose, postId, postContent, authorName }) => {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  const postUrl = `${window.location.origin}/posts/${postId}`;
  const shareText = postContent 
    ? `Check out this post by ${authorName}: "${postContent.substring(0, 100)}${postContent.length > 100 ? '...' : ''}"`
    : `Check out this post by ${authorName} on ProfileAI`;
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setSnackbar({ open: true, message: 'Link copied to clipboard!', severity: 'success' });
      onClose();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
    }
  };
  
  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
    onClose();
  };
  
  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    onClose();
  };
  
  const handleShareEmail = () => {
    const subject = `Check out this post on ProfileAI`;
    const body = `${shareText}\n\n${postUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onClose();
  };
  
  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${postUrl}`)}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };
  
  return (
    <>
      <StyledMenu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuTitle>Share Post</MenuTitle>
        
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy link" />
        </MenuItem>
        
        <Divider sx={{ my: 0.5 }} />
        
        <MenuItem onClick={handleShareTwitter}>
          <ListItemIcon>
            <TwitterIcon fontSize="small" sx={{ color: '#1DA1F2' }} />
          </ListItemIcon>
          <ListItemText primary="Share on X (Twitter)" />
        </MenuItem>
        
        <MenuItem onClick={handleShareLinkedIn}>
          <ListItemIcon>
            <LinkedInIcon fontSize="small" sx={{ color: '#0A66C2' }} />
          </ListItemIcon>
          <ListItemText primary="Share on LinkedIn" />
        </MenuItem>
        
        <MenuItem onClick={handleShareWhatsApp}>
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
          </ListItemIcon>
          <ListItemText primary="Share on WhatsApp" />
        </MenuItem>
        
        <MenuItem onClick={handleShareEmail}>
          <ListItemIcon>
            <EmailIcon fontSize="small" sx={{ color: '#555' }} />
          </ListItemIcon>
          <ListItemText primary="Share via Email" />
        </MenuItem>
      </StyledMenu>
      
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
    </>
  );
};

export default ShareMenu;
