# Payment Integration Setup Guide

This guide explains how to set up real payment processing with Stripe and PayPal for ProfileAI.

## Overview

ProfileAI supports two payment methods:
- **Stripe** - Credit/Debit card processing
- **PayPal** - PayPal account payments

## Stripe Setup

### 1. Create a Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Sign up for a free account
3. Complete your business profile

### 2. Get API Keys
1. Go to **Developers** → **API keys** in Stripe Dashboard
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

### 3. Set Up Webhook
1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set URL to: `https://your domain.com/api/subscriptions/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### 4. Update Environment Variables
Edit `backend/.env`:
```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## PayPal Setup

### 1. Create PayPal Developer Account
1. Go to [https://developer.paypal.com](https://developer.paypal.com)
2. Log in with your PayPal account
3. Go to **Dashboard**

### 2. Create an App
1. Go to **Apps & Credentials**
2. Click **Create App**
3. Enter app name (e.g., "ProfileAI")
4. Select app type: **Merchant**

### 3. Get API Credentials
1. After creating the app, you'll see:
   - **Client ID**
   - **Secret**
2. Copy both values

### 4. Create Subscription Plans (Optional)
For recurring subscriptions, you need to create billing plans:
1. Go to **Products** in PayPal Dashboard
2. Create products for each plan (Candidate Pro, Candidate Enterprise, etc.)
3. Create pricing plans for monthly and yearly billing
4. Note the **Plan ID** for each

### 5. Update Environment Variables
Edit `backend/.env`:
```env
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_MODE=sandbox  # Use 'live' for production
```

## Testing

### Stripe Test Cards
Use these test card numbers in development:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires authentication**: 4000 0025 0000 3155

Use any future expiry date, any 3-digit CVC, and any ZIP code.

### PayPal Sandbox
1. Go to **Sandbox** → **Accounts** in PayPal Developer Dashboard
2. Use sandbox accounts for testing
3. Personal account for buyer
4. Business account for merchant

## Production Deployment

### Stripe
1. Switch from test keys to live keys
2. Update webhook URL to production domain
3. Test thoroughly in production environment

### PayPal
1. Change `PAYPAL_MODE` from `sandbox` to `live`
2. Use production credentials instead of sandbox
3. Create live billing plans

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit API keys** to version control
2. Always use environment variables
3. Validate webhook signatures
4. Use HTTPS in production
5. Implement rate limiting
6. Log payment events for audit trails
7. Handle failed payments gracefully
8. Send confirmation emails

## Webhook Handling

The backend automatically handles webhooks at:
- **Stripe**: `POST /api/subscriptions/webhook`

Webhooks update:
- Subscription status
- Payment success/failure
- Subscription cancellations
- Trial expiration

## Troubleshooting

### Stripe Issues
- **Invalid API key**: Check that you're using the correct environment (test/live)
- **Webhook not working**: Verify webhook secret and endpoint URL
- **Payment declined**: Use test cards or check actual card details

### PayPal Issues
- **Subscription not created**: Ensure billing plans are set up correctly
- **Sandbox errors**: Check that you're using sandbox credentials in sandbox mode
- **API errors**: Verify Client ID and Secret are correct

## Support

- **Stripe**: https://support.stripe.com
- **PayPal**: https://developer.paypal.com/support

## Current Status

✅ Stripe Checkout Session integration
✅ PayPal subscription integration  
✅ Webhook handling
✅ Subscription management
✅ Payment method selection UI
⏳ Production deployment (requires live credentials)
