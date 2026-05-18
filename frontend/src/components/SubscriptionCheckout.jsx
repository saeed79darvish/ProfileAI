import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  TextField,
  Grid,
  Alert
} from '@mui/material';
import {
  CreditCard as CardIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { subscriptionAPI, authAPI } from '../services/api';

/**
 * SubscriptionCheckout - Simplified checkout dialog
 * In production, this would integrate with Stripe Elements
 */
const SubscriptionCheckout = ({ open, onClose, plan, billingCycle, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');

    try {
      // Basic validation
      if (!cardNumber || !expiry || !cvc || !name) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }

      // Create subscription via configured API client (handles auth + base URL)
      await subscriptionAPI.create(
        plan.name.toLowerCase(),
        billingCycle
      );

      // Refresh user info and update localStorage
      try {
        const userResponse = await authAPI.getMe();
        const userData = userResponse.data;
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (refreshErr) {
        console.warn('Failed to refresh user after subscribe:', refreshErr);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const getTotal = () => {
    if (!plan?.price) return '0.00';
    return billingCycle === 'monthly' 
      ? plan.price.monthly.toFixed(2)
      : plan.price.yearly.toFixed(2);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon sx={{ color: '#4caf50' }} />
          <Typography variant="h6" fontWeight="600">
            Secure Checkout
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Subscribing to
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {plan?.name} Plan
          </Typography>
          <Typography variant="h4" fontWeight="bold" color="primary" sx={{ mt: 1 }}>
            ${getTotal()}
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}/ {billingCycle === 'monthly' ? 'month' : 'year'}
            </Typography>
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Payment Information
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Cardholder Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Card Number"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim())}
              disabled={loading}
              InputProps={{
                startAdornment: <CardIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Expiry (MM/YY)"
              placeholder="12/25"
              value={expiry}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length >= 2) {
                  val = val.slice(0, 2) + '/' + val.slice(2, 4);
                }
                setExpiry(val);
              }}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="CVC"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              disabled={loading}
            />
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="caption">
            🔒 Demo Mode: Use card 4242 4242 4242 4242 with any future expiry and CVC.
            In production, this would integrate with Stripe for secure payments.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubscribe}
          disabled={loading}
          sx={{
            minWidth: 150,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #654a8f 100%)',
            }
          }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ color: 'white' }} />
          ) : (
            `Subscribe Now`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubscriptionCheckout;
