const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { CreditPack, User } = require('../models');
const { CREDIT_PACKS } = require('../config/aiLimits');
const { Op } = require('sequelize');

// Optional: Stripe for actual payment processing
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
} catch (e) {
  console.warn('Stripe not configured for credit packs');
}

/**
 * Returns true when STRIPE_SECRET_KEY looks like a real (non-placeholder)
 * Stripe key. Catches the common "I copied .env.example and forgot to swap
 * the value" cases — keys containing `***`, `xxx`, `your`, `here`, or
 * `placeholder`, or keys that aren't long enough to be real, all count
 * as fake. Real Stripe test keys are ~107 characters with the prefix
 * `sk_test_` followed by long random chars.
 */
function isRealStripeKey() {
  const k = process.env.STRIPE_SECRET_KEY || '';
  if (!k) return false;
  if (!/^sk_(test|live)_/.test(k)) return false;
  if (k.length < 30) return false;
  const fakeMarkers = ['placeholder', '***', 'xxx', 'your', 'here', '...'];
  const lower = k.toLowerCase();
  if (fakeMarkers.some(m => lower.includes(m))) return false;
  return true;
}

/**
 * @route   GET /api/credit-packs/catalog
 * @desc    Get available credit pack catalog
 * @access  Public
 */
router.get('/catalog', (req, res) => {
  try {
    const catalog = Object.entries(CREDIT_PACKS).map(([key, pack]) => ({
      id: key,
      ...pack
    }));
    res.json(catalog);
  } catch (error) {
    console.error('Error fetching credit pack catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

/**
 * @route   GET /api/credit-packs/my-credits
 * @desc    Get user's current credit pack balances
 * @access  Private
 */
router.get('/my-credits', authMiddleware, async (req, res) => {
  try {
    const packs = await CreditPack.findAll({
      where: {
        userId: req.user.id,
        status: 'active',
        creditsRemaining: { [Op.gt]: 0 }
      },
      order: [['purchasedAt', 'ASC']]
    });

    // Aggregate by feature type
    const creditsByFeature = {};
    for (const pack of packs) {
      if (!creditsByFeature[pack.featureType]) {
        creditsByFeature[pack.featureType] = 0;
      }
      creditsByFeature[pack.featureType] += pack.creditsRemaining;
    }

    // Get purchase history (last 20)
    const history = await CreditPack.findAll({
      where: { userId: req.user.id },
      order: [['purchasedAt', 'DESC']],
      limit: 20
    });

    res.json({
      credits: creditsByFeature,
      totalPacks: packs.length,
      history: history.map(p => ({
        id: p.id,
        packType: p.packType,
        featureType: p.featureType,
        creditsTotal: p.creditsTotal,
        creditsRemaining: p.creditsRemaining,
        amountPaid: p.amountPaid,
        status: p.status,
        purchasedAt: p.purchasedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching user credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

/**
 * @route   POST /api/credit-packs/purchase
 * @desc    Purchase a credit pack (creates Stripe checkout session)
 * @access  Private
 */
router.post('/purchase', authMiddleware, async (req, res) => {
  try {
    const { packId } = req.body;
    
    if (!packId || !CREDIT_PACKS[packId]) {
      return res.status(400).json({ error: 'Invalid pack ID' });
    }

    const pack = CREDIT_PACKS[packId];
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Stripe checkout session for one-time payment when a real
    // Stripe key is configured. Otherwise fall through to the dev grant
    // path below so local development isn't blocked by missing keys.
    if (stripe && isRealStripeKey()) {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId: user.id }
        });
        customerId = customer.id;
        await User.update({ stripeCustomerId: customerId }, { where: { id: user.id } });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: pack.name,
              description: pack.description,
            },
            unit_amount: Math.round(pack.price * 100),
          },
          quantity: 1,
        }],
        metadata: {
          userId: user.id,
          packId,
          type: 'credit_pack'
        },
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?purchase=success&pack=${packId}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?purchase=cancelled`,
      });

      return res.json({
        checkoutUrl: session.url,
        sessionId: session.id
      });
    }

    // Development fallback: instantly grant credits without payment
    const creditEntries = [];
    for (const [featureType, credits] of Object.entries(pack.credits)) {
      const entry = await CreditPack.create({
        userId: user.id,
        packType: packId,
        featureType,
        creditsTotal: credits,
        creditsRemaining: credits,
        amountPaid: pack.price / Object.keys(pack.credits).length,
        currency: 'USD',
        status: 'active',
        purchasedAt: new Date(),
        metadata: { devMode: true }
      });
      creditEntries.push(entry);
    }

    res.json({
      success: true,
      message: `${pack.name} purchased successfully!`,
      credits: creditEntries.map(e => ({
        featureType: e.featureType,
        credits: e.creditsRemaining
      })),
      devMode: true
    });
  } catch (error) {
    console.error('Error purchasing credit pack:', error);
    // Surface the underlying Stripe / system error so the frontend can show
    // something useful instead of a generic "Failed to process purchase".
    const raw = error?.message || '';
    let userMsg = 'Failed to process purchase';
    if (/api key/i.test(raw)) {
      userMsg = 'Payments aren\'t configured yet. Set STRIPE_SECRET_KEY in backend/.env, or remove it for dev-mode credits.';
    } else if (/network|timeout/i.test(raw)) {
      userMsg = 'Network error talking to Stripe. Try again.';
    }
    res.status(500).json({ error: userMsg, detail: raw });
  }
});

/**
 * @route   POST /api/credit-packs/webhook/stripe
 * @desc    Handle Stripe webhook for credit pack payments
 * @access  Public (Stripe webhook)
 */
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_CREDIT_PACK_WEBHOOK_SECRET;
    
    let event;
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      if (session.metadata?.type === 'credit_pack') {
        const { userId, packId } = session.metadata;
        const pack = CREDIT_PACKS[packId];
        
        if (pack && userId) {
          // Grant credits
          for (const [featureType, credits] of Object.entries(pack.credits)) {
            await CreditPack.create({
              userId,
              packType: packId,
              featureType,
              creditsTotal: credits,
              creditsRemaining: credits,
              amountPaid: pack.price / Object.keys(pack.credits).length,
              currency: 'USD',
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent,
              status: 'active',
              purchasedAt: new Date()
            });
          }
          console.log(`✓ Credit pack '${packId}' granted to user ${userId}`);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Credit pack webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

module.exports = router;
