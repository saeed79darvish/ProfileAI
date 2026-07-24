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

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
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
        ? Math.round(plan.price * 10) // 17% discount
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
        success_url: `${process.env.CORS_ORIGIN}/dashboard?subscription=success`,
        cancel_url: `${process.env.CORS_ORIGIN}/pricing?subscription=cancelled`,
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
        ? Math.round(plan.price * 10) // 17% discount
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
            return_url: `${process.env.CORS_ORIGIN}/dashboard?subscription=success&provider=paypal`,
            cancel_url: `${process.env.CORS_ORIGIN}/pricing?subscription=cancelled`,
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
        ? Math.round(plan.price * 10)
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

      await stripe.subscriptions.cancel(user.stripeSubscriptionId);

      await Subscription.update(
        { status: 'cancelled' },
        { where: { userId: user.id, status: 'active' } }
      );

      await User.update(
        { subscriptionStatus: 'cancelled' },
        { where: { id: user.id } }
      );

      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
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
      await User.update({
        subscriptionStatus: subscription.status
      }, { where: { id: user.id } });

      await Subscription.update({
        status: subscription.status
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
