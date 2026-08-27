/**
 * Invitation Routes
 * 
 * Handles candidate invitation workflow for imported candidates.
 * 
 * Routes:
 * - POST /api/invitations/import/:importId/create - Create invitations for import batch
 * - POST /api/invitations/import/:importId/send - Send pending invitations
 * - POST /api/invitations/import/:importId/remind - Send reminders
 * - GET /api/invitations/import/:importId/stats - Get invitation statistics
 * - GET /api/invitations/import/:importId - List invitations for import
 * - GET /api/invitations/:token - Get invitation by token (public)
 * - POST /api/invitations/:token/accept - Accept invitation (public)
 * - POST /api/invitations/:token/decline - Decline invitation (public)
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const requireRecruiterSurface = require('../middleware/recruiterSurface');
const {
  createInvitationsForImport,
  sendInvitations,
  processAcceptance,
  processDecline,
  getInvitationByToken,
  getInvitationStats,
  sendReminders,
  TERMS_VERSION
} = require('../services/invitationService');
const { CandidateInvitation, CandidateImport, Job } = require('../models');
const { clientIp } = require('../utils/clientIp');

/**
 * @route   POST /api/invitations/import/:importId/create
 * @desc    Create invitations for all candidates in an import batch
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/create', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    // Verify user is a recruiter
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can send invitations'
      });
    }
    
    const { importId } = req.params;
    const { personalMessage, expiryDays } = req.body;
    
    // Verify the import belongs to this recruiter
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport) {
      return res.status(404).json({
        success: false,
        error: 'Import not found'
      });
    }
    
    if (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this import'
      });
    }
    
    const result = await createInvitationsForImport(importId, {
      personalMessage,
      expiryDays
    });
    
    res.status(201).json({
      success: true,
      message: `Created ${result.invitationsCreated} invitations`,
      data: result
    });
    
  } catch (error) {
    console.error('[Invitations] Create error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create invitations'
    });
  }
});

/**
 * @route   POST /api/invitations/import/:importId/send
 * @desc    Send pending invitations via email
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/send', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can send invitations'
      });
    }
    
    const { importId } = req.params;
    
    // Verify ownership
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport || (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const result = await sendInvitations(importId);
    
    res.json({
      success: true,
      message: `Sent ${result.sent} invitation emails`,
      data: result
    });
    
  } catch (error) {
    console.error('[Invitations] Send error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send invitations'
    });
  }
});

/**
 * @route   POST /api/invitations/import/:importId/send-all
 * @desc    Create and send invitations in one step
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/send-all', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can send invitations'
      });
    }
    
    const { importId } = req.params;
    const { personalMessage } = req.body;
    
    // Verify ownership
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport || (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    // Create invitations
    const createResult = await createInvitationsForImport(importId, { personalMessage });
    
    // Send invitations
    const sendResult = await sendInvitations(importId);
    
    res.json({
      success: true,
      message: `Created ${createResult.invitationsCreated} invitations, sent ${sendResult.sent} emails`,
      data: {
        created: createResult.invitationsCreated,
        skipped: createResult.skipped,
        sent: sendResult.sent,
        failed: sendResult.failed,
        errors: sendResult.errors
      }
    });
    
  } catch (error) {
    console.error('[Invitations] Send-all error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send invitations'
    });
  }
});

/**
 * @route   POST /api/invitations/import/:importId/remind
 * @desc    Send reminder emails to non-responders
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/remind', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can send reminders'
      });
    }
    
    const { importId } = req.params;
    
    // Verify ownership
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport || (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const result = await sendReminders(importId);
    
    res.json({
      success: true,
      message: `Sent ${result.sent} reminder emails`,
      data: result
    });
    
  } catch (error) {
    console.error('[Invitations] Remind error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send reminders'
    });
  }
});

/**
 * @route   GET /api/invitations/import/:importId/stats
 * @desc    Get invitation statistics for an import
 * @access  Private (Recruiters only)
 */
router.get('/import/:importId/stats', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    
    // Verify ownership
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport || (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const stats = await getInvitationStats(importId);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[Invitations] Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get statistics'
    });
  }
});

/**
 * @route   GET /api/invitations/import/:importId
 * @desc    List all invitations for an import
 * @access  Private (Recruiters only)
 */
router.get('/import/:importId', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    
    // Verify ownership
    const candidateImport = await CandidateImport.findByPk(importId);
    if (!candidateImport || (candidateImport.recruiterId !== req.user.id && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }
    
    const where = { importId };
    if (status) {
      where.status = status;
    }
    
    const { rows: invitations, count: total } = await CandidateInvitation.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    
    res.json({
      success: true,
      data: {
        invitations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('[Invitations] List error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list invitations'
    });
  }
});

// ===== PUBLIC ROUTES (No auth required) =====

/**
 * @route   GET /api/invitations/:token
 * @desc    Get invitation details by token (for accept page)
 * @access  Public
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const invitation = await getInvitationByToken(token);
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found or invalid'
      });
    }
    
    res.json({
      success: true,
      data: {
        ...invitation,
        termsVersion: TERMS_VERSION
      }
    });
    
  } catch (error) {
    console.error('[Invitations] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitation'
    });
  }
});

/**
 * @route   POST /api/invitations/:token/accept
 * @desc    Accept invitation and create account
 * @access  Public
 */
router.post('/:token/accept', [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('consentToTerms').isBoolean().equals('true').withMessage('You must accept the terms'),
  body('consentToScreening').isBoolean().equals('true').withMessage('You must consent to AI screening')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { token } = req.params;
    const { password, firstName, lastName, phone, consentToTerms, consentToScreening } = req.body;
    
    const result = await processAcceptance(token, {
      password,
      firstName,
      lastName,
      phone,
      consentToTerms: consentToTerms === true || consentToTerms === 'true',
      consentToScreening: consentToScreening === true || consentToScreening === 'true',
      ipAddress: clientIp(req),
      userAgent: req.get('User-Agent')
    });
    
    // Generate JWT token for auto-login
    const jwt = require('jsonwebtoken');
    const authToken = jwt.sign(
      { userId: result.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Invitation accepted! Your account has been created.',
      data: {
        ...result,
        token: authToken
      }
    });
    
  } catch (error) {
    console.error('[Invitations] Accept error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to accept invitation'
    });
  }
});

/**
 * @route   POST /api/invitations/:token/decline
 * @desc    Decline invitation
 * @access  Public
 */
router.post('/:token/decline', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    
    const result = await processDecline(token, { reason });
    
    res.json({
      success: true,
      message: 'Invitation declined'
    });
    
  } catch (error) {
    console.error('[Invitations] Decline error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to decline invitation'
    });
  }
});

/**
 * @route   POST /api/invitations/:token/track
 * @desc    Track email open/click events
 * @access  Public
 */
router.post('/:token/track', async (req, res) => {
  try {
    const { token } = req.params;
    const { event } = req.body; // 'opened' or 'clicked'
    
    const invitation = await CandidateInvitation.findOne({
      where: { invitationToken: token }
    });
    
    if (invitation && ['sent', 'delivered', 'opened'].includes(invitation.status)) {
      const updates = { status: event };
      if (event === 'opened' && !invitation.openedAt) {
        updates.openedAt = new Date();
      } else if (event === 'clicked' && !invitation.clickedAt) {
        updates.clickedAt = new Date();
      }
      await invitation.update(updates);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    res.json({ success: true }); // Don't expose errors for tracking
  }
});

/**
 * @route   POST /api/invitations/bulk
 * @desc    Send bulk invitations to email list (without import)
 * @access  Private (Recruiters only)
 */
router.post('/bulk', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can send invitations'
      });
    }
    
    const { emails, jobId, personalMessage } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email list is required'
      });
    }
    
    // Validate job if provided
    if (jobId) {
      const job = await Job.findByPk(jobId);
      if (!job || (job.userId !== req.user.id && req.user.role !== 'admin')) {
        return res.status(403).json({
          success: false,
          error: 'Job not found or not authorized'
        });
      }
    }
    
    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    // Send invitations
    for (const email of emails) {
      try {
        // Create invitation record
        const invitation = await CandidateInvitation.create({
          importId: null,
          jobId: jobId || null,
          email: email.trim().toLowerCase(),
          recruiterId: req.user.id,
          personalMessage,
          status: 'pending',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
        
        // TODO: Send actual email here
        // For now, just mark as sent
        await invitation.update({ 
          status: 'sent',
          sentAt: new Date()
        });
        
        results.sent++;
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ email, error: error.message });
        }
      }
    }
    
    res.json({
      success: true,
      message: `Sent ${results.sent} invitations`,
      data: results
    });
    
  } catch (error) {
    console.error('[Invitations] Bulk send error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send invitations'
    });
  }
});

module.exports = router;
