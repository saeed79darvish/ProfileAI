const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { SupportTicket, User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { callAI, HAIKU_MODEL } = require('../services/ai/core');
const {
  sendSupportTicketToAdmin,
  sendSupportTicketConfirmation
} = require('../services/emailService');

// ─── Rate limits ─────────────────────────────────────────────────────
// Chat: chatty by design, but capped so a single user can't rack up huge
// AI bills refreshing the widget.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You\u2019re messaging support too quickly. Please slow down.' }
});

// Ticket: much lower cap since each create hits SMTP.
const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support tickets created recently. Please try again in a while.' }
});

// ─── Help-desk chatbot system prompt ─────────────────────────────────
// Kept in this file (rather than services/ai/prompts) so the tone stays
// close to the route logic that owns it. Update the product-knowledge
// section as features ship.
const SUPPORT_SYSTEM_PROMPT = `You are the ProfilleAI support assistant \u2014 warm, concise, and honest.

ProfilleAI is a career platform for candidates and recruiters. Key features:
- Candidate profile creation (resume upload, LinkedIn import via PDF, manual)
- AI resume tailoring and cover letter generation
- ApplyPilot: Chrome extension that auto-fills job applications
- Agent Arena: AI-driven salary negotiation practice
- Job browsing, saved jobs, applications
- Subscription plans: Free (limited monthly credits), Pro ($14.99/mo), Pro+ ($29.99/mo)

How to help users:
- Answer product questions directly and clearly. No fluff.
- If a user reports a specific bug, missing data, billing issue, or account problem,
  DO NOT invent an answer. Say you'll open a support ticket for the team and ask
  for enough info (what they were doing, expected vs. actual, screenshots if possible)
  to include in the ticket.
- If a user asks how to do something you don't recognise, say so honestly and offer
  to open a ticket.
- Never claim to have taken an action (like resetting a password or refunding).
  You can only answer questions and hand off to humans.
- Keep responses under 150 words unless a longer walkthrough is genuinely needed.
- Never use em-dashes or en-dashes in output. Use commas or hyphens.`;

// @route   POST /api/support/chat
// @desc    AI helpdesk assistant. Client sends conversation history; we
//          reply with the next assistant message. Session-only \u2014 chat is
//          not persisted unless the user creates a ticket.
// @access  Private
router.post(
  '/chat',
  authMiddleware,
  chatLimiter,
  [
    body('messages')
      .isArray({ min: 1, max: 30 }).withMessage('messages must be a 1\u201330 element array'),
    body('messages.*.role').isIn(['user', 'assistant']).withMessage('role must be user or assistant'),
    body('messages.*.content').isString().isLength({ min: 1, max: 4000 }).withMessage('content must be 1\u20134000 chars')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { messages } = req.body;

      // Ensure the conversation ends with a user turn \u2014 the model can't
      // generate a reply otherwise.
      if (messages[messages.length - 1]?.role !== 'user') {
        return res.status(400).json({ error: 'The last message must be from the user.' });
      }

      const response = await callAI({
        messages: [
          { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
          ...messages
        ],
        model: HAIKU_MODEL, // fast/cheap; support chat rarely needs Sonnet
        max_tokens: 400,
        temperature: 0.4
      });

      const reply = response.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return res.status(502).json({ error: 'Support assistant did not return a response. Please try again.' });
      }

      res.json({ success: true, message: reply });
    } catch (error) {
      console.error('[Support chat] Error:', error?.message);
      res.status(500).json({
        error: 'Support assistant is temporarily unavailable. Please try again in a moment, or open a ticket.'
      });
    }
  }
);

// @route   POST /api/support/ticket
// @desc    Create a support ticket. Persists to DB, emails admin, sends
//          the user a confirmation. Optional chatTranscript captures the
//          AI conversation that led here.
// @access  Private
router.post(
  '/ticket',
  authMiddleware,
  ticketLimiter,
  [
    body('subject').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Subject must be 3\u2013200 chars'),
    body('message').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Message must be 10\u20135000 chars'),
    body('category').optional().isIn(['bug', 'feature', 'billing', 'account', 'question', 'other']),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
    body('name').optional({ checkFalsy: true }).isString().trim().isLength({ max: 200 }),
    body('chatTranscript').optional().isArray({ max: 40 }),
    body('chatTranscript.*.role').optional().isIn(['user', 'assistant']),
    body('chatTranscript.*.content').optional().isString().isLength({ max: 5000 }),
    body('source').optional().isString().trim().isLength({ max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Prefer the user's real account details; fall back to body values
      // (useful if we ever open this route to guests).
      const user = req.user?.id ? await User.findByPk(req.user.id) : null;
      const email = (user?.email || req.body.email || '').trim();
      const name = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ') || null
        : (req.body.name || null);

      if (!email) {
        return res.status(400).json({ error: 'Email is required so we can respond to you.' });
      }

      const ticket = await SupportTicket.create({
        userId: req.user?.id || null,
        email,
        name,
        category: req.body.category || 'question',
        subject: req.body.subject.trim(),
        message: req.body.message.trim(),
        chatTranscript: req.body.chatTranscript || null,
        source: req.body.source || 'help_center',
        metadata: {
          userAgent: req.get('user-agent') || null,
          plan: user?.subscriptionTier || null
        }
      });

      // Fire-and-forget emails \u2014 don't block the response on SMTP latency
      // or fail the ticket if email delivery hiccups.
      Promise.allSettled([
        sendSupportTicketToAdmin(ticket.toJSON()),
        sendSupportTicketConfirmation(ticket.toJSON())
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`[Support] email ${i === 0 ? 'admin' : 'user'} failed:`, r.reason?.message);
          }
        });
      });

      res.status(201).json({
        success: true,
        ticket: {
          id: ticket.id,
          reference: ticket.id.slice(0, 8),
          status: ticket.status,
          createdAt: ticket.createdAt
        }
      });
    } catch (error) {
      console.error('[Support ticket] Error:', error?.message);
      res.status(500).json({ error: 'Could not create your support ticket. Please try again.' });
    }
  }
);

// @route   GET /api/support/my-tickets
// @desc    List the current user's own tickets (for a future "your open
//          tickets" section in the Help Center).
// @access  Private
router.get('/my-tickets', authMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'subject', 'category', 'status', 'createdAt', 'resolvedAt'],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ tickets });
  } catch (error) {
    console.error('[Support] my-tickets error:', error?.message);
    res.status(500).json({ error: 'Could not load your support tickets.' });
  }
});

module.exports = router;
