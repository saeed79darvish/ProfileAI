const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { SupportTicket, User } = require('../models');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { callAI } = require('../services/ai/core');
const {
  sendSupportTicketToAdmin,
  sendSupportTicketConfirmation,
  sendSupportReplyToUser
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
// close to the route logic that owns it. When policy / pricing changes,
// update BOTH this prompt AND the Terms/Pricing pages so the assistant
// doesn't cite stale numbers.
const SUPPORT_SYSTEM_PROMPT = `You are the ProfilleAI support assistant. You are warm, concise, and honest.

═══ PRODUCT ═══
ProfilleAI is a career platform for candidates and recruiters. Core features:
- Candidate profile creation: resume upload (PDF/DOCX), LinkedIn import (via LinkedIn's "Save to PDF" export uploaded to us), or start from scratch.
- AI resume tailoring per job description.
- AI cover letter generation.
- ApplyPilot: our Chrome extension that detects job listings on LinkedIn, Greenhouse, Lever, Workday and 20+ ATS platforms, auto-tailors the resume, and fills the application form.
- Agent Arena: AI-driven salary negotiation practice with a synthetic recruiter agent.
- Job browsing at /jobs, saved jobs, and application tracking.

═══ SUBSCRIPTION PLANS (as of July 2026) ═══
- Free (trial): 1 resume parse / month, 1 profile enhancement / month, 3 resume tailorings LIFETIME, 2 AI cover letters / month, 5 career suggestions / month, basic profile.
- Pro ($14.99 / month or $119 / year): 50 tailorings / month, 30 cover letters / month, 20 resume parses / month, 30 profile enhancements / month, unlimited career suggestions, watermark-free exports, priority support.
- Pro+ ($29.99 / month or $239 / year): everything in Pro PLUS ApplyPilot auto-apply (30 applications / week), 200 tailorings / month, 200 cover letters / month, unlimited interview prep, batch tailoring.
- Billing is handled by Stripe. Manage subscription is under Account or via the Pricing page.

═══ REFUND POLICY (7-day money-back guarantee) ═══
Users can request a full refund within 7 days of their INITIAL subscription purchase, ONLY IF:
1. They have NOT consumed ANY AI credits (a single resume tailoring, profile enhancement, cover letter, resume parse, or career suggestion voids eligibility).
2. They have not violated the Terms of Service (no fraud, spam, abuse, scraping, or account sharing).
Additional rules to cite when relevant:
- Beyond 7 days: no refunds by default. Cancellation stops future billing but does not refund past charges.
- AI credits already consumed are never refundable, even inside the 7-day window, because they incur third-party API costs at the time of use.
- No refunds are prorated for partial months, unused credits, or unused features.
- Annual plans: full refund inside 7 days if eligible. After 7 days, access continues until the annual term ends but no partial-year refund.
- Users in the EU, UK, and other jurisdictions with statutory withdrawal or refund rights retain those rights regardless of the above.
- All refund requests go to billing@profileai.com from the account email, with the ticket or order reference.
- Chargebacks initiated without contacting billing first may result in permanent account suspension.

═══ CANCELLATION ═══
- Users cancel any time from Account Settings.
- Cancelling stops future billing. Access continues to the end of the current period.
- Restarting a canceled subscription is one click.

═══ ACCOUNT DELETION ═══
- Users can request account deletion via a support ticket. Data is permanently removed within 30 days per the Privacy Policy.

═══ HOW TO HELP ═══
- Answer product, pricing, and policy questions directly and clearly. Quote the policy above verbatim when the answer is a policy question (refunds, cancellation, plans, credits).
- For account-specific issues (bug, missing data, billing dispute, refund request, account locked, etc.):
  * DO NOT invent an answer or promise an outcome.
  * Say you'll open a support ticket, then ask for enough info to include: their account email, what happened, what they expected, when it happened, and any screenshot or reference.
  * Once they provide the info, tell them the team will follow up by email within 1 business day.
- Never claim to have taken an action you cannot take. You can only answer questions and hand off to the team.
- Never fabricate features, credit limits, prices, dates, or timelines. If the policy above doesn't cover it, say so and offer a ticket.
- Keep responses under 200 words unless the user asks for a walkthrough.

═══ FORMATTING ═══
- You may use Markdown formatting (short lists, bold for emphasis, backticks for exact strings) because the client renders it. Keep it minimal, no walls of text.
- Never use em-dashes or en-dashes. Use commas or plain hyphens.
- Do not include disclaimers like "I'm an AI" unless the user explicitly asks.`;

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
        // Use the default (Sonnet) model. Prod's Anthropic key doesn't
        // have Haiku access, so pinning to HAIKU_MODEL was 404-ing.
        // Support chat is low-volume, so the cost delta is negligible.
        max_tokens: 400,
        temperature: 0.4
      });

      const reply = response.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return res.status(502).json({ error: 'Support assistant did not return a response. Please try again.' });
      }

      res.json({ success: true, message: reply });
    } catch (error) {
      // Log everything we can so Render logs surface the real cause. The
      // response stays user-friendly but includes a `detail` field so the
      // browser network tab shows what actually broke.
      console.error('[Support chat] Error:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 4).join('\n')
      });
      res.status(500).json({
        error: 'Support assistant is temporarily unavailable. Please try again in a moment, or open a ticket.',
        detail: error?.message || 'unknown'
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
      console.error('[Support ticket] Error:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 4).join('\n')
      });
      res.status(500).json({
        error: 'Could not create your support ticket. Please try again.',
        detail: error?.message || 'unknown'
      });
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

// ═════════════════════════════════════════════════════════════════
// Admin endpoints — inbox, detail, reply, status update
// All require admin role (adminMiddleware checks req.user.role).
// ═════════════════════════════════════════════════════════════════

// @route   GET /api/support/admin/tickets
// @desc    List tickets with filters and pagination.
// @access  Admin
router.get('/admin/tickets', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, category, search, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (category && category !== 'all') where.category = category;
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { subject: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { rows: tickets, count } = await SupportTicket.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
      attributes: {
        // Skip large fields on the list view for perf.
        exclude: ['chatTranscript', 'replies']
      }
    });

    // Counts by status for the filter chips.
    const counts = await SupportTicket.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    const countsByStatus = counts.reduce((acc, r) => {
      acc[r.status] = Number(r.count);
      return acc;
    }, { open: 0, in_progress: 0, resolved: 0, closed: 0 });

    res.json({ tickets, total: count, countsByStatus });
  } catch (error) {
    console.error('[Support admin] list error:', error);
    res.status(500).json({ error: 'Could not load tickets.', detail: error?.message });
  }
});

// @route   GET /api/support/admin/tickets/:id
// @desc    Full ticket detail incl. chat transcript + reply thread.
// @access  Admin
router.get('/admin/tickets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    res.json({ ticket });
  } catch (error) {
    console.error('[Support admin] detail error:', error);
    res.status(500).json({ error: 'Could not load ticket.', detail: error?.message });
  }
});

// @route   POST /api/support/admin/tickets/:id/reply
// @desc    Admin replies to a ticket. Appends to the thread and emails
//          the user. Optionally bumps status to 'in_progress'.
// @access  Admin
router.post(
  '/admin/tickets/:id/reply',
  authMiddleware,
  adminMiddleware,
  [
    body('body').isString().trim().isLength({ min: 1, max: 8000 }).withMessage('Reply must be 1\u20138000 chars'),
    body('markStatus').optional().isIn(['open', 'in_progress', 'resolved', 'closed'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const ticket = await SupportTicket.findByPk(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

      const admin = await User.findByPk(req.user.id);
      const adminName = admin
        ? [admin.firstName, admin.lastName].filter(Boolean).join(' ') || 'ProfilleAI Support'
        : 'ProfilleAI Support';

      const newReply = {
        by: 'admin',
        adminId: req.user.id,
        adminName,
        body: req.body.body.trim(),
        createdAt: new Date().toISOString()
      };

      const updates = {
        replies: [...(ticket.replies || []), newReply]
      };
      if (req.body.markStatus) {
        updates.status = req.body.markStatus;
        if (req.body.markStatus === 'resolved' || req.body.markStatus === 'closed') {
          updates.resolvedAt = updates.resolvedAt || new Date();
        }
      } else if (ticket.status === 'open') {
        // Auto-promote from 'open' to 'in_progress' once an admin engages.
        updates.status = 'in_progress';
      }
      await ticket.update(updates);

      // Fire-and-forget email so the response isn't gated on SMTP.
      Promise.resolve(sendSupportReplyToUser({
        ticket: ticket.toJSON(),
        replyBody: newReply.body,
        adminName
      })).catch((err) => console.warn('[Support] reply email failed:', err?.message));

      res.json({ success: true, ticket });
    } catch (error) {
      console.error('[Support admin] reply error:', error);
      res.status(500).json({ error: 'Could not send reply.', detail: error?.message });
    }
  }
);

// @route   PATCH /api/support/admin/tickets/:id
// @desc    Update status / category / adminNotes.
// @access  Admin
router.patch(
  '/admin/tickets/:id',
  authMiddleware,
  adminMiddleware,
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('category').optional().isIn(['bug', 'feature', 'billing', 'account', 'question', 'other']),
    body('adminNotes').optional().isString().isLength({ max: 8000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const ticket = await SupportTicket.findByPk(req.params.id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

      const updates = {};
      if (req.body.status !== undefined) {
        updates.status = req.body.status;
        if (req.body.status === 'resolved' || req.body.status === 'closed') {
          updates.resolvedAt = ticket.resolvedAt || new Date();
        }
        if (req.body.status === 'open' || req.body.status === 'in_progress') {
          updates.resolvedAt = null;
        }
      }
      if (req.body.category !== undefined) updates.category = req.body.category;
      if (req.body.adminNotes !== undefined) updates.adminNotes = req.body.adminNotes;

      await ticket.update(updates);
      res.json({ success: true, ticket });
    } catch (error) {
      console.error('[Support admin] patch error:', error);
      res.status(500).json({ error: 'Could not update ticket.', detail: error?.message });
    }
  }
);

module.exports = router;
