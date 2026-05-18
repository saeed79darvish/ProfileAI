import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as MailIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  People as UsersIcon,
} from '@mui/icons-material';
import { invitationAPI } from '../../services/api';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 16px;
    max-width: 600px;
    width: 100%;
    overflow: hidden;
  }
`;

const Header = styled(DialogTitle)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

const HeaderContent = styled(Box)`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TitleRow = styled(Box)`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Footer = styled(DialogActions)`
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  justify-content: space-between;
`;

const GradientButton = styled(Button)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-transform: none;
  font-weight: 600;
  padding: 10px 24px;
  border-radius: 8px;
  
  &:hover {
    background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
  }
  
  &:disabled {
    background: #94a3b8;
    color: white;
  }
`;

const EmailListBox = styled(Box)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
`;

const SuccessCard = styled(Box)`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: white;
`;

export default function ImportCandidatesModal({ 
  isOpen, 
  onClose, 
  jobId, 
  jobTitle 
}) {
  const [emails, setEmails] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [invitationsSent, setInvitationsSent] = useState(false);
  const [invitationStats, setInvitationStats] = useState(null);
  const [error, setError] = useState(null);

  const handleSendInvitations = async () => {
    const emailList = emails
      .split(/[\n,;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && email.includes('@'));
    
    if (emailList.length === 0) {
      setError('Please enter at least one valid email address');
      return;
    }
    
    setSendingInvitations(true);
    setError(null);
    
    try {
      const response = await invitationAPI.sendBulkInvitations({
        emails: emailList,
        jobId: jobId || null,
        personalMessage: personalMessage || null,
      });
      
      setInvitationsSent(true);
      setInvitationStats({
        sent: emailList.length,
        skipped: 0
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitations');
    } finally {
      setSendingInvitations(false);
    }
  };

  const handleClose = () => {
    setEmails('');
    setPersonalMessage('');
    setSendingInvitations(false);
    setInvitationsSent(false);
    setInvitationStats(null);
    setError(null);
    onClose();
  };

  const emailCount = emails
    .split(/[\n,;]/)
    .map(email => email.trim())
    .filter(email => email.length > 0 && email.includes('@'))
    .length;

  return (
    <StyledDialog 
      open={isOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      {/* Header */}
      <Header>
        <HeaderContent>
          <TitleRow>
            <UsersIcon />
            <Typography variant="h6" fontWeight={600}>
              Invite Candidates
            </Typography>
          </TitleRow>
          {jobTitle && (
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              For: <strong>{jobTitle}</strong>
            </Typography>
          )}
        </HeaderContent>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Header>
      
      {/* Content */}
      <DialogContent sx={{ p: 3 }}>
        {/* Error message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Success view */}
        {invitationsSent && invitationStats ? (
          <SuccessCard>
            <CheckCircleIcon sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Invitations Sent!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Successfully sent {invitationStats.sent} invitation{invitationStats.sent !== 1 ? 's' : ''} to join ProfileAI
            </Typography>
            <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
              Candidates will receive an email with instructions to create their profile
            </Typography>
          </SuccessCard>
        ) : (
          <>
            {/* Instructions */}
            <Box sx={{ mb: 3, p: 2, background: '#eff6ff', borderRadius: 2 }}>
              <Typography variant="body2" color="text.primary" gutterBottom fontWeight={500}>
                <MailIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} />
                How it works:
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Enter candidate email addresses below</li>
                  <li>We'll send them an invitation to join ProfileAI</li>
                  <li>They create their profile and apply to your job</li>
                  <li>You review their applications</li>
                </ol>
              </Typography>
            </Box>

            {/* Email input */}
            <EmailListBox>
              <Typography variant="body2" fontWeight={600} color="text.primary" gutterBottom>
                Email Addresses {emailCount > 0 && `(${emailCount})`}
              </Typography>
              <TextField
                multiline
                rows={8}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={"john.doe@example.com\njane.smith@company.com\n\nSeparate emails by line breaks, commas, or semicolons"}
                fullWidth
                variant="outlined"
                sx={{ 
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    background: 'white'
                  }
                }}
              />
            </EmailListBox>
            
            {/* Personal message */}
            <Box>
              <Typography variant="body2" fontWeight={600} color="text.primary" gutterBottom>
                Personal Message (Optional)
              </Typography>
              <TextField
                multiline
                rows={3}
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Add a personal note to include with the invitation..."
                fullWidth
                variant="outlined"
                sx={{ 
                  mt: 1,
                  '& .MuiOutlinedInput-root': {
                    background: '#f8fafc'
                  }
                }}
              />
            </Box>
          </>
        )}
      </DialogContent>
      
      {/* Footer */}
      <Footer>
        <Button 
          onClick={handleClose}
          sx={{ textTransform: 'none' }}
        >
          {invitationsSent ? 'Close' : 'Cancel'}
        </Button>
        
        {!invitationsSent && (
          <GradientButton
            startIcon={sendingInvitations ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleSendInvitations}
            disabled={sendingInvitations || emailCount === 0}
          >
            {sendingInvitations ? 'Sending...' : `Send ${emailCount > 0 ? `${emailCount} ` : ''}Invitation${emailCount !== 1 ? 's' : ''}`}
          </GradientButton>
        )}
      </Footer>
    </StyledDialog>
  );
}
