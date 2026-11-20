const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const axios = require('axios');
const { User, Subscription } = require('../models');

class PaymentService {
  constructor() {
    this.paypalBaseURL = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  // Get PayPal Access Token
  async getPayPalAccessToken() {
    try {
      const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString('base64');

      const response = await axios.post(
        `${this.paypalBaseURL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting PayPal access token:', error);
      throw error;
    }
  }

  // Subscription.PLANS only has 'candidate' and 'recruiter' keys, but
  // User.role also allows 'admin' (used for dogfooding candidate features).
  // Treat admins as candidates for billing purposes so admin test accounts
  // don't crash indexing Subscription.PLANS['admin'].
  getPlansForRole(role) {
    return Subscription.PLANS[role] || Subscription.PLANS.candidate;
  }

  // Create Stripe Customer
  async createCustomer(user) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
          role: user.role
        }
      });

      await User.update(
        { stripeCustomerId: customer.id },
        { where: { id: user.id } }
      );

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create Stripe Checkout Session
  async createStripeCheckoutSession(userId, planType, billingCycle = 'monthly', opts = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      // Refuse a second subscription: a second checkout would charge twice.
      if (user.stripeSubscriptionId) {
        const existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
        if (existing && ['active', 'trialing', 'past_due'].includes(existing.status) && !existing.cancel_at_period_end) {
          const err = new Error('You already have an active subscription. Manage it from the billing page.');
          err.statusCode = 409;
          throw err;
        }
      }

      // Get or create Stripe customer. An id saved under another Stripe mode
      // (test keys, then live) or a deleted customer does not exist any more:
      // make a fresh one instead of failing every checkout.
      let customerId = user.stripeCustomerId;
      if (customerId) {
        const found = await stripe.customers.retrieve(customerId).catch(() => null);
        if (!found || found.deleted) customerId = null;
      }
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
      }

      // Get plan details
      const plans = this.getPlansForRole(user.role);
      const plan = plans[planType];

      if (!plan) throw new Error('Invalid plan type');

      // Calculate amount based on billing cycle
      const amount = billingCycle === 'yearly'
        ? (plan.yearlyPrice ?? Math.round(plan.price * 10)) // the price shown on the pricing page
        : plan.price;

      // Stripe Checkout's 'card' method type already includes Apple Pay /
      // Google Pay wallets when the account is configured for them and the
      // user's device supports them. The `preferredWallet` hint from the
      // route is currently informational — surfacing the wallet button on
      // Stripe Checkout's hosted page doesn't require a separate config.
      // (Kept as a parameter so we can wire it through later if Stripe
      // adds an explicit wallet-preference knob.)
      const preferredWallet = opts.preferredWallet || null;

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${plan.name} Plan - ${user.role === 'candidate' ? 'Candidate' : 'Recruiter'}`,
                description: `${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} subscription`,
              },
              recurring: {
                interval: billingCycle === 'monthly' ? 'month' : 'year',
              },
              unit_amount: Math.round(amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?subscription=success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?subscription=cancelled`,
        metadata: {
          userId: user.id,
          planType,
          billingCycle,
          userRole: user.role,
        },
        // Mirrored onto the resulting Subscription object so webhook events
        // that only carry the subscription (not the checkout session) can
        // still fulfill/repair it — see handleSubscriptionCreated below.
        subscription_data: {
          metadata: {
            userId: user.id,
            planType,
            billingCycle,
            userRole: user.role,
          },
        },
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  }

  // Create PayPal Subscription
  async createPayPalSubscription(userId, planType, billingCycle = 'monthly') {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      const plans = this.getPlansForRole(user.role);
      const plan = plans[planType];

      if (!plan) throw new Error('Invalid plan type');

      const amount = billingCycle === 'yearly'
        ? (plan.yearlyPrice ?? Math.round(plan.price * 10)) // the price shown on the pricing page
        : plan.price;

      const accessToken = await this.getPayPalAccessToken();

      // Create subscription
      const response = await axios.post(
        `${this.paypalBaseURL}/v1/billing/subscriptions`,
        {
          plan_id: this.getPayPalPlanId(user.role, planType, billingCycle),
          custom_id: user.id.toString(),
          application_context: {
            brand_name: 'ProfilleAI',
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?subscription=success&provider=paypal`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?subscription=cancelled`,
            user_action: 'SUBSCRIBE_NOW',
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const approvalLink = response.data.links.find(link => link.rel === 'approve');

      return {
        subscriptionId: response.data.id,
        approvalUrl: approvalLink.href,
      };
    } catch (error) {
      console.error('Error creating PayPal subscription:', error);
      throw error;
    }
  }

  // Complete subscription after payment
  async completeSubscription(userId, planType, billingCycle, paymentMethod, externalId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      const plans = this.getPlansForRole(user.role);
      const plan = plans[planType];

      const amount = billingCycle === 'yearly'
        ? (plan.yearlyPrice ?? Math.round(plan.price * 10))
        : plan.price;

      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Create or update subscription record
      const [subscription, created] = await Subscription.findOrCreate({
        where: { userId: user.id },
        defaults: {
          planType,
          userRole: user.role,
          status: 'active',
          amount,
          currency: 'USD',
          billingCycle,
          startDate,
          endDate,
          paymentMethod,
          stripeSubscriptionId: paymentMethod === 'stripe' ? externalId : null,
          features: plan.features,
          usageStats: {
            aiCreditsUsed: 0,
            aiCreditsLimit: plan.features.aiCredits,
            profileViewsUsed: 0,
            profileViewsLimit: plan.features.profileViews || plan.features.candidateViews || 0
          }
        }
      });

      if (!created) {
        await subscription.update({
          planType,
          status: 'active',
          amount,
          billingCycle,
          startDate,
          endDate,
          paymentMethod,
          stripeSubscriptionId: paymentMethod === 'stripe' ? externalId : null,
          features: plan.features,
        });
      }

      // Update user
      await User.update({
        subscriptionTier: planType,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: endDate,
        stripeSubscriptionId: paymentMethod === 'stripe' ? externalId : null,
      }, { where: { id: user.id } });

      return subscription;
    } catch (error) {
      console.error('Error completing subscription:', error);
      throw error;
    }
  }

  // Helper: Get PayPal Plan ID (you need to create these in PayPal Dashboard)
  getPayPalPlanId(role, planType, billingCycle) {
    // These should be created in your PayPal Business account
    // For now, returning placeholder
    return `PAYPAL_${role}_${planType}_${billingCycle}`.toUpperCase();
  }

  // Cancel Subscription
  async cancelSubscription(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      // Cancel at the END of the paid period, not now. Cancelling immediately
      // threw away time the customer had already paid for (a yearly plan lost
      // up to 11 months), which is exactly the billing trap users complain
      // about with competitors. Access is gated on subscriptionTier, which
      // stays paid until Stripe sends customer.subscription.deleted at the end
      // of the period (handleSubscriptionDeleted drops it to free).
      const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      const periodEnd =
        updated.items?.data?.[0]?.current_period_end ?? updated.current_period_end;
      const accessUntil = periodEnd ? new Date(periodEnd * 1000) : null;

      await Subscription.update(
        { status: 'cancelled' },
        { where: { userId: user.id, status: 'active' } }
      );

      await User.update(
        {
          subscriptionStatus: 'cancelled',
          ...(accessUntil ? { subscriptionExpiresAt: accessUntil } : {}),
        },
        { where: { id: user.id } }
      );

      return { success: true, cancelAtPeriodEnd: true, accessUntil };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Stripe's hosted page for card updates, invoices and receipts.
  async createBillingPortalSession(userId) {
    const user = await User.findByPk(userId);
    if (!user || !user.stripeCustomerId) {
      const err = new Error('No billing account yet');
      err.statusCode = 404;
      throw err;
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`,
    });
    return { url: session.url };
  }

  // Create Payment Intent (for one-time payments)
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Handle Webhook Events
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Primary fulfillment path: fires immediately after a successful Checkout
  // payment and carries the session metadata (userId/planType/billingCycle)
  // we set in createStripeCheckoutSession. This is the event Stripe
  // recommends for granting access, since 'customer.subscription.created'
  // alone doesn't include the checkout session's metadata.
  async handleCheckoutSessionCompleted(session) {
    if (session.mode !== 'subscription' || session.payment_status !== 'paid') return;

    const { userId, planType, billingCycle } = session.metadata || {};
    if (!userId || !planType) {
      console.error('checkout.session.completed missing metadata:', session.id);
      return;
    }

    await this.completeSubscription(userId, planType, billingCycle || 'monthly', 'stripe', session.subscription);
  }

  async handleSubscriptionCreated(subscription) {
    console.log('Subscription created:', subscription.id);

    // Fallback fulfillment in case the checkout.session.completed webhook
    // was missed or delivered out of order — completeSubscription is
    // idempotent (findOrCreate + update), so re-running it here is safe.
    const { userId, planType, billingCycle } = subscription.metadata || {};
    if (userId && planType) {
      await this.completeSubscription(userId, planType, billingCycle || 'monthly', 'stripe', subscription.id);
    }
  }

  async handleSubscriptionUpdated(subscription) {
    const user = await User.findOne({ 
      where: { stripeCustomerId: subscription.customer } 
    });

    if (user) {
      // Stripe statuses ('canceled', 'past_due', 'trialing'...) are not our
      // enum values, and writing them verbatim throws. A subscription that is
      // still active but set to end at period end is 'cancelled' here, which
      // keeps the account paid until the period actually ends.
      let status;
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        status = subscription.cancel_at_period_end ? 'cancelled' : 'active';
      } else if (subscription.status === 'canceled') {
        status = 'cancelled';
      } else {
        status = 'expired';
      }

      await User.update({
        subscriptionStatus: status
      }, { where: { id: user.id } });

      await Subscription.update({
        status
      }, {
        where: { 
          stripeSubscriptionId: subscription.id 
        } 
      });
    }
  }

  async handleSubscriptionDeleted(subscription) {
    const user = await User.findOne({ 
      where: { stripeCustomerId: subscription.customer } 
    });

    if (user) {
      await User.update({
        subscriptionTier: 'free',
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: null
      }, { where: { id: user.id } });

      await Subscription.update({
        status: 'cancelled'
      }, { 
        where: { 
          stripeSubscriptionId: subscription.id 
        } 
      });
    }
  }

  async handlePaymentSucceeded(invoice) {
    console.log('Payment succeeded for invoice:', invoice.id);
    // A renewal: move "access until" forward to the end of the paid period.
    const line = invoice.lines?.data?.[0];
    const periodEnd = line?.period?.end;
    if (!periodEnd || !invoice.customer) return;
    const user = await User.findOne({ where: { stripeCustomerId: invoice.customer } });
    if (!user) return;
    const endDate = new Date(periodEnd * 1000);
    await User.update({ subscriptionExpiresAt: endDate, subscriptionStatus: 'active' }, { where: { id: user.id } });
    await Subscription.update({ endDate, status: 'active' }, { where: { userId: user.id } });
  }

  async handlePaymentFailed(invoice) {
    console.log('Payment failed for invoice:', invoice.id);
    
    const user = await User.findOne({ 
      where: { stripeCustomerId: invoice.customer } 
    });

    if (user) {
      await User.update({
        subscriptionStatus: 'expired'
      }, { where: { id: user.id } });
    }
  }

  // Helper: Get Stripe Price ID
  getPriceId(role, planType, billingCycle) {
    // These should be your actual Stripe Price IDs
    // Create these in your Stripe Dashboard
    const priceIds = {
      candidate: {
        pro: {
          monthly: process.env.STRIPE_PRICE_CANDIDATE_PRO_MONTHLY,
          yearly: process.env.STRIPE_PRICE_CANDIDATE_PRO_YEARLY
        },
        enterprise: {
          monthly: process.env.STRIPE_PRICE_CANDIDATE_ENTERPRISE_MONTHLY,
          yearly: process.env.STRIPE_PRICE_CANDIDATE_ENTERPRISE_YEARLY
        }
      },
      recruiter: {
        pro: {
          monthly: process.env.STRIPE_PRICE_RECRUITER_PRO_MONTHLY,
          yearly: process.env.STRIPE_PRICE_RECRUITER_PRO_YEARLY
        },
        enterprise: {
          monthly: process.env.STRIPE_PRICE_RECRUITER_ENTERPRISE_MONTHLY,
          yearly: process.env.STRIPE_PRICE_RECRUITER_ENTERPRISE_YEARLY
        }
      }
    };

    return priceIds[role]?.[planType]?.[billingCycle] || null;
  }

  // Check if user has feature access
  async hasFeatureAccess(userId, featureName) {
    const subscription = await Subscription.findOne({
      where: { userId, status: 'active' },
      order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
      const user = await User.findByPk(userId);
      const freePlan = this.getPlansForRole(user.role).free;
      return freePlan.features[featureName] || false;
    }

    return subscription.features[featureName] || false;
  }

  // Check AI credits
  async checkAICredits(userId) {
    const subscription = await Subscription.findOne({
      where: { userId, status: 'active' },
      order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
      return { available: 3, used: 0, limit: 3 };
    }

    const { aiCreditsUsed, aiCreditsLimit } = subscription.usageStats;
    
    if (aiCreditsLimit === -1) {
      return { available: -1, used: aiCreditsUsed, limit: -1 }; // unlimited
    }

    return {
      available: Math.max(0, aiCreditsLimit - aiCreditsUsed),
      used: aiCreditsUsed,
      limit: aiCreditsLimit
    };
  }

  // Use AI credit
  async useAICredit(userId) {
    const subscription = await Subscription.findOne({
      where: { userId, status: 'active' },
      order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const { aiCreditsUsed, aiCreditsLimit } = subscription.usageStats;

    if (aiCreditsLimit !== -1 && aiCreditsUsed >= aiCreditsLimit) {
      throw new Error('AI credits limit reached. Please upgrade your plan.');
    }

    subscription.usageStats.aiCreditsUsed += 1;
    await subscription.save();

    return subscription.usageStats;
  }
}

module.exports = new PaymentService();
