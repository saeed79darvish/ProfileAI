import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Stack,
  Paper
} from '@mui/material';
import {
  Lock as LockIcon,
  Stars as StarsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

/**
 * SubscriptionGate component - Displays upgrade prompts for premium features
 * 
 * @param {Object} props
 * @param {boolean} props.open - Controls dialog visibility
 * @param {function} props.onClose - Callback when dialog is closed
 * @param {string} props.featureName - Name of the premium feature
 * @param {string} props.requiredPlan - Minimum plan required (pro, enterprise)
 * @param {string} props.description - Description of the feature
 * @param {Array} props.benefits - List of benefits for this feature
 */
const SubscriptionGate = ({ 
  open, 
  onClose, 
  featureName = 'Premium Feature',
  requiredPlan = 'pro',
  description = 'This is a premium feature available with paid subscriptions.',
  benefits = []
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  const getPlanLabel = () => {
    if (requiredPlan === 'enterprise') return 'Enterprise';
    return 'Pro';
  };

  const defaultBenefits = user?.role === 'recruiter' ? [
    'Smart candidate matching',
    'Unlimited job postings',
    'Detailed analytics reports',
    'Automated screening tools',
    'Priority support'
  ] : [
    'AI profile optimization',
    'Career path recommendations',
    'Skill gap analysis',
    'Interview preparation',
    'Priority visibility to recruiters'
  ];

  const displayBenefits = benefits.length > 0 ? benefits : defaultBenefits;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)'
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 4, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <LockIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
        </Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Unlock {featureName}
        </Typography>
        <Chip 
          label={`${getPlanLabel()} Plan Required`}
          sx={{ 
            bgcolor: '#667eea',
            color: 'white',
            fontWeight: 600
          }}
        />
      </DialogTitle>

      <DialogContent sx={{ px: 4, pb: 2 }}>
        <Typography variant="body1" color="text.secondary" textAlign="center" paragraph>
          {description}
        </Typography>

        <Paper sx={{ p: 3, mt: 3, bgcolor: 'white', border: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StarsIcon sx={{ color: '#667eea' }} />
            <Typography variant="h6" fontWeight="600">
              What you'll get:
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            {displayBenefits.map((benefit, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#667eea'
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {benefit}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {user?.subscriptionTier === 'free' && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary">
                Join <strong>1,000+</strong> professionals already using premium features
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 4, pb: 4, pt: 2, flexDirection: 'column', gap: 1 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleUpgrade}
          sx={{
            py: 1.5,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontWeight: 600,
            fontSize: '1rem',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #654a8f 100%)',
            }
          }}
        >
          View Pricing Plans
        </Button>
        <Button
          fullWidth
          variant="text"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          Maybe Later
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubscriptionGate;
