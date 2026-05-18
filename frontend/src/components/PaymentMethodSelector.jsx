import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CreditCard as CardIcon,
} from '@mui/icons-material';
import api from '../services/api';

/**
 * PaymentMethodSelector
 *
 * Modern "express checkout" pattern: two big branded buttons at the top
 * (Apple Pay, PayPal), then "or pay with card" as a quieter fallback.
 * Matches what users see on Stripe Express, Linear, Vercel, Cursor — the
 * conversion-tested standard for SaaS subscription paywalls.
 *
 * Apple Pay availability is detected client-side; on unsupported devices
 * the button is hidden so we don't promise something we can't deliver.
 * All flows hand off to Stripe Checkout (or PayPal approval) — wallet
 * surface lives on the provider's hosted page, this modal is just the
 * method picker.
 */
const PaymentMethodSelector = ({ open, onClose, plan, billingCycle, onSuccess }) => {
  const [loading, setLoading] = useState(null); // 'apple_pay' | 'paypal' | 'card' while in flight
  const [error, setError] = useState('');
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    let supported = false;
    try {
      if (typeof window !== 'undefined') {
        if (window.ApplePaySession && window.ApplePaySession.canMakePayments?.()) supported = true;
        else if (window.PaymentRequest) supported = true;
      }
    } catch { /* permissive */ }
    setApplePayAvailable(supported);
  }, [open]);

  const handlePay = async (method) => {
    if (!plan?.type) {
      setError('Invalid plan selected. Please try again.');
      return;
    }
    try {
      setLoading(method);
      setError('');
      const backendMethod =
        method === 'paypal' ? 'paypal' :
        method === 'apple_pay' ? 'apple_pay' :
        'stripe';
      const response = await api.post('/subscriptions/create-checkout-session', {
        planType: plan.type,
        billingCycle,
        paymentMethod: backendMethod,
      });
      if (method === 'paypal') {
        window.location.href = response.data.approvalUrl;
      } else {
        window.location.href = response.data.url;
      }
    } catch (err) {
      console.error('Payment error:', err);
      // Friendlier error: known cases get human messages, unknown ones get
      // a short generic and the technical detail is logged to console.
      const raw = err.response?.data?.error || err.message || '';
      let msg = 'We couldn\'t start checkout. Please try again.';
      if (/api key/i.test(raw)) msg = 'Payments aren\'t configured yet. Please contact support.';
      else if (/network|timeout/i.test(raw)) msg = 'Network error. Check your connection and try again.';
      else if (raw && raw.length < 120) msg = raw;
      setError(msg);
      setLoading(null);
    }
  };

  if (!plan) return null;

  const isYearly = billingCycle === 'yearly';
  const monthlyPrice = Number(plan?.price?.monthly || 0);
  const yearlyPrice = Number(plan?.price?.yearly || 0);
  const effectiveMonthly = isYearly
    ? (yearlyPrice / 12).toFixed(2)
    : monthlyPrice.toFixed(2);
  const yearlySavings = isYearly && monthlyPrice > 0
    ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
    : 0;

  const anyLoading = !!loading;

  return (
    <Dialog
      open={open}
      onClose={anyLoading ? undefined : onClose}
      maxWidth={false}
      fullWidth={false}
      PaperProps={{
        sx: {
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.20)',
          background: '#fff',
        },
      }}
    >
      {/* Compact header — small plan tag, big price, no gradient block */}
      <Box sx={{ px: 3.5, pt: 3, pb: 2, position: 'relative' }}>
        <IconButton
          onClick={onClose}
          disabled={anyLoading}
          aria-label="Close"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: '#94a3b8',
            '&:hover': { background: '#f1f5f9', color: '#475569' },
          }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25, py: 0.4,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #f4ebff 0%, #ede9fe 100%)',
          color: '#6941c6',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {plan.name} plan
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 1.25 }}>
          <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: '#0f172a' }}>
            ${effectiveMonthly}
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>/ month</Typography>
        </Box>

        <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.75 }}>
          {isYearly
            ? `Billed $${yearlyPrice.toFixed(2)} annually${yearlySavings > 0 ? ` · save ${yearlySavings}%` : ''}`
            : 'Billed monthly · Cancel anytime'}
        </Typography>
      </Box>

      {/* Body — express buttons + card fallback */}
      <Box sx={{ px: 3.5, pb: 3 }}>
        {error && (
          <Box
            role="alert"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: 1.25,
              borderRadius: 2,
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              fontSize: 12.5,
              mb: 1.5,
            }}
          >
            <Box sx={{ flex: 1, lineHeight: 1.5 }}>{error}</Box>
            <Box
              role="button"
              onClick={() => setError('')}
              sx={{ cursor: 'pointer', color: '#9a3412', opacity: 0.7, '&:hover': { opacity: 1 } }}
              aria-label="Dismiss"
            >
              ✕
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {/* Apple Pay — only on supported devices. Black pill, official-style
              Apple logo + "Pay" wordmark, sized per Apple's button guidelines. */}
          {applePayAvailable && (
            <ExpressButton
              kind="apple"
              loading={loading === 'apple_pay'}
              disabled={anyLoading && loading !== 'apple_pay'}
              onClick={() => handlePay('apple_pay')}
            />
          )}

          {/* PayPal — yellow #ffc439 with the official two-tone wordmark. */}
          <ExpressButton
            kind="paypal"
            loading={loading === 'paypal'}
            disabled={anyLoading && loading !== 'paypal'}
            onClick={() => handlePay('paypal')}
          />
        </Box>

        {/* "or pay with card" divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2 }}>
          <Box sx={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            or pay with card
          </Typography>
          <Box sx={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </Box>

        {/* Card row — quieter than the express buttons but still tappable */}
        <Box
          role="button"
          tabIndex={0}
          onClick={() => !anyLoading && handlePay('card')}
          onKeyDown={(e) => { if (!anyLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handlePay('card'); } }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2.5,
            cursor: anyLoading ? 'not-allowed' : 'pointer',
            border: '1.5px solid #e2e8f0',
            background: '#fff',
            transition: 'all 0.15s ease',
            outline: 'none',
            opacity: anyLoading && loading !== 'card' ? 0.5 : 1,
            '&:hover': anyLoading ? {} : { borderColor: '#7c3aed', background: 'rgba(124, 58, 237, 0.03)' },
            '&:focus-visible': { boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.20)' },
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f1f5f9',
              color: '#475569',
              flexShrink: 0,
            }}
          >
            <CardIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>Credit or debit card</Typography>
            <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>Visa, Mastercard, Amex — secured by Stripe</Typography>
          </Box>
          {loading === 'card'
            ? <CircularProgress size={16} sx={{ color: '#7c3aed' }} />
            : <Box sx={{ color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>›</Box>
          }
        </Box>

        {/* Trust micro-row */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.25,
            color: '#94a3b8',
            fontSize: 11,
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>🔒 Secure</Box>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
          <Box>Cancel anytime</Box>
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
          <Box>No hidden fees</Box>
        </Box>
      </Box>
    </Dialog>
  );
};

// ─── Branded express buttons ──────────────────────────────────────────────

/**
 * One full-width branded payment button. Renders Apple Pay (black, white
 * logo + "Pay") or PayPal (yellow, two-tone wordmark). Loading state
 * replaces the wordmark with a spinner; disabled state dims it.
 */
const ExpressButton = ({ kind, loading, disabled, onClick }) => {
  const isApple = kind === 'apple';
  const bg = isApple ? '#000' : '#ffc439';
  const hoverBg = isApple ? '#1a1a1a' : '#f5b820';
  const fg = isApple ? '#fff' : '#003087';

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      fullWidth
      disableRipple
      sx={{
        height: 50,
        borderRadius: 2.5,
        background: bg,
        color: fg,
        textTransform: 'none',
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: '-0.01em',
        boxShadow: 'none',
        transition: 'background 0.12s ease, transform 0.08s ease',
        '&:hover': { background: hoverBg, boxShadow: 'none' },
        '&:active': { transform: 'translateY(1px)' },
        '&.Mui-disabled': { background: bg, color: fg, opacity: disabled && !loading ? 0.4 : 1 },
      }}
    >
      {loading ? (
        <CircularProgress size={20} sx={{ color: fg }} />
      ) : isApple ? (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
          <AppleLogo />
          <Box component="span" sx={{ fontWeight: 600, fontSize: 17, fontFamily: '-apple-system, system-ui, sans-serif' }}>
            Pay
          </Box>
        </Box>
      ) : (
        <PayPalWordmark />
      )}
    </Button>
  );
};

/** Apple logo — used inline in the Apple Pay button. */
const AppleLogo = () => (
  <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginTop: -2 }}>
    <path d="M17.05 12.04c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.64 0-1.61-.71-2.65-.69-1.36.02-2.62.79-3.32 2-1.42 2.46-.36 6.1 1.02 8.1.68.97 1.49 2.06 2.55 2.02 1.03-.04 1.42-.66 2.66-.66 1.24 0 1.59.66 2.67.64 1.11-.02 1.81-.99 2.49-1.97.78-1.13 1.1-2.22 1.12-2.27-.02-.01-2.15-.83-2.18-3.28zM15.05 6.16c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.4 1.23-.53.61-.99 1.59-.86 2.52.91.07 1.84-.46 2.41-1.15z" />
  </svg>
);

/** Two-tone PayPal wordmark — italic "Pay" in #003087, "Pal" in #009cde. */
const PayPalWordmark = () => (
  <Box component="span" sx={{
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontWeight: 800,
    fontStyle: 'italic',
    fontSize: 18,
    letterSpacing: '-0.02em',
    lineHeight: 1,
  }}>
    <Box component="span" sx={{ color: '#003087' }}>Pay</Box>
    <Box component="span" sx={{ color: '#009cde' }}>Pal</Box>
  </Box>
);

export default PaymentMethodSelector;
