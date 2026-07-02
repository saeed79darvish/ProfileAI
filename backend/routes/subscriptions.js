const express = require('express');
const router = express.Router();
const { Subscription, User } = require('../models');
const auth = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const { getUsageSummary } = require('../middleware/aiRateLimiter');

// Get subscription plans
router.get('/plans', (req, res) => {
  const { role } = req.query;
  
  if (role && Subscription.PLANS[role]) {
    return res.json({ plans: Subscription.PLANS[role] });
  }
  
  res.json({ plans: Subscription.PLANS });
});

// Get my subscription
router.get('/my-subscription', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      where: { userId: req.userId, status: 'active' },
      order: [['createdAt', 'DESC']]
    });

    const user = await User.findByPk(req.userId);

    res.json({
      subscription,
      user: {
        role: user.role,
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        expiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Stripe Checkout Session
router.post('/create-checkout-session', auth, async (req, res) => {
  try {
    const { planType, billingCycle, paymentMethod } = req.body;

    console.log('Checkout session request:', { planType, billingCycle, paymentMethod });

    // Validate inputs
    if (!planType) {
      return res.status(400).json({ error: 'Plan type is required' });
    }

    if (!['pro', 'enterprise'].includes(planType)) {
      return res.status(400).json({ error: `Invalid plan type: ${planType}. Must be 'pro' or 'enterprise'` });
    }

    // 'apple_pay' is a UI hint that maps to the same Stripe Checkout flow
    // as 'stripe' — Stripe surfaces the Apple Pay wallet on its checkout
    // page when the account is configured for it and the user's device
    // supports it. We forward the hint so paymentService can prefer the
    // wallet style if it ever wants to (no behavioral change required).
    if (!['stripe', 'paypal', 'apple_pay'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    let result;

    if (paymentMethod === 'paypal') {
      result = await paymentService.createPayPalSubscription(
        req.userId,
        planType,
        billingCycle || 'monthly'
      );
    } else {
      // 'stripe' or 'apple_pay' — both go through Stripe Checkout. Pass the
      // preference downstream so the service can hint Stripe (e.g., set
      // payment_method_types order) without changing the function shape.
      result = await paymentService.createStripeCheckoutSession(
        req.userId,
        planType,
        billingCycle || 'monthly',
        { preferredWallet: paymentMethod === 'apple_pay' ? 'apple_pay' : null }
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm subscription (after successful payment)
router.post('/confirm', auth, async (req, res) => {
  try {
    const { planType, billingCycle, paymentMethod, externalId } = req.body;

    const subscription = await paymentService.completeSubscription(
      req.userId,
      planType,
      billingCycle,
      paymentMethod,
      externalId
    );

    res.json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('Error confirming subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subscription (simplified for demo - backward compatibility)
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { planType, billingCycle } = req.body;

    // Validate plan type
    if (!['free', 'pro', 'enterprise'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Get user to check their role
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get plan details
    const userRole = user.role;
    const plans = Subscription.PLANS[userRole];
    const selectedPlan = plans[planType];

    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plan not available for your role' });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create or update subscription record
    const [subscription, created] = await Subscription.findOrCreate({
      where: { userId: req.userId },
      defaults: {
        planType,
        userRole,
        status: 'active',
        amount: selectedPlan.price[billingCycle] || 0,
        currency: 'USD',
        billingCycle: billingCycle || 'monthly',
        startDate,
        endDate,
        features: selectedPlan.features,
        usageStats: {
          aiCreditsUsed: 0,
          aiCreditsLimit: selectedPlan.features.aiCredits === -1 ? 999999 : selectedPlan.features.aiCredits,
          profileViewsUsed: 0,
          profileViewsLimit: 1000
        }
      }
    });

    // If subscription already exists, update it
    if (!created) {
      await subscription.update({
        planType,
        status: 'active',
        amount: selectedPlan.price[billingCycle] || 0,
        billingCycle: billingCycle || 'monthly',
        startDate,
        endDate,
        features: selectedPlan.features,
        usageStats: {
          aiCreditsUsed: 0,
          aiCreditsLimit: selectedPlan.features.aiCredits === -1 ? 999999 : selectedPlan.features.aiCredits,
          profileViewsUsed: 0,
          profileViewsLimit: 1000
        }
      });
    }

    // Update user subscription tier
    await user.update({
      subscriptionTier: planType,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: endDate
    });

    res.json({
      success: true,
      subscription,
      message: `Successfully subscribed to ${planType} plan`
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
});

// Cancel subscription
router.post('/cancel', auth, async (req, res) => {
  try {
    const result = await paymentService.cancelSubscription(req.userId);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message 
    });
  }
});

// Check feature access
router.get('/feature/:featureName', auth, async (req, res) => {
  try {
    const hasAccess = await paymentService.hasFeatureAccess(
      req.userId,
      req.params.featureName
    );

    res.json({ hasAccess, feature: req.params.featureName });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check AI credits
router.get('/ai-credits', auth, async (req, res) => {
  try {
    const credits = await paymentService.checkAICredits(req.userId);
    res.json(credits);
  } catch (error) {
    console.error('Error checking AI credits:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stripe webhook handler — mounted directly in server.js BEFORE express.json()
// so the raw body is preserved for signature verification. Do NOT add it to
// this router; it must receive the unparsed Buffer body.
const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await paymentService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// Get AI usage summary
// @route   GET /api/subscriptions/usage
// @desc    Get user's AI feature usage and limits
// @access  Private
router.get('/usage', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const usage = await getUsageSummary(
      req.userId,
      user.role || 'candidate',
      user.subscriptionTier || 'free'
    );

    res.json(usage);
  } catch (error) {
    // Log the FULL error so it shows up in Render logs — the generic message
    // hid the real cause of intermittent 500s (Sequelize errors, missing
    // columns from unmigrated schemas, etc.).
    console.error('[GET /api/subscriptions/usage] failed', {
      userId: req.userId,
      name: error?.name,
      message: error?.message,
      sql: error?.sql,
      original: error?.original?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      error: 'Failed to fetch AI usage',
      // Surface a short reason in non-production so testers can screenshot it;
      // still safe in prod because we only return the error name/message,
      // not the SQL or stack.
      reason: error?.message || error?.name || 'unknown',
    });
  }
});

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;
