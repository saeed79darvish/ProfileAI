/**
 * Guest Screening Routes
 * 
 * Public routes for external candidates invited via email to submit
 * their resume and screening answers WITHOUT creating an account.
 * 
 * Routes:
 * - GET  /api/guest-screening/:token       - Get invitation details + job + screening questions
 * - POST /api/guest-screening/:token/submit - Submit resume + answers (guest screening)
 * - GET  /api/guest-screening/track/:code   - Check application status by tracking code
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const {
  CandidateInvitation,
  ImportedCandidate,
  Job,
  JobApplication,
  CandidateImport,
  User
} = require('../models');
const resumeParser = require('../services/resumeParserService');
const { clientIp } = require('../utils/clientIp');

// Configure multer for resume upload (memory storage, no auth needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

/**
 * Generate a unique 8-character tracking code
 */
function generateTrackingCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
}

/**
 * @route   GET /api/guest-screening/:token
 * @desc    Get invitation details, job info, and screening questions (public)
 * @access  Public
 */
router.get('/:token', [
  param('token').isLength({ min: 64, max: 64 }).withMessage('Invalid invitation token')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token } = req.params;

    const invitation = await CandidateInvitation.findOne({
      where: { invitationToken: token },
      include: [
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'company', 'location', 'employmentType', 'salaryMin', 'salaryMax', 'description', 'applicationQuestions']
        },
        {
          model: ImportedCandidate,
          as: 'importedCandidate',
          attributes: ['id', 'firstName', 'lastName', 'email', 'currentTitle']
        },
        {
          model: User,
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    // Check if already responded
    if (['accepted', 'submitted', 'declined'].includes(invitation.status)) {
      return res.status(400).json({
        success: false,
        error: 'This invitation has already been responded to',
        status: invitation.status
      });
    }

    // Check if expired
    if (invitation.isExpired()) {
      return res.status(410).json({
        success: false,
        error: 'This invitation has expired',
        expiredAt: invitation.expiresAt
      });
    }

    // Track that the link was clicked
    if (['sent', 'delivered', 'opened'].includes(invitation.status)) {
      await invitation.update({ 
        status: 'clicked',
        clickedAt: new Date()
      });
    }

    // Build screening questions
    // Use job's applicationQuestions if set, otherwise use sensible defaults
    let screeningQuestions = [];
    if (invitation.job?.applicationQuestions?.length > 0) {
      // Filter to only questions that make sense for guest screening
      // (exclude file upload, diversity questions)
      screeningQuestions = invitation.job.applicationQuestions.filter(q => 
        !['file', 'resume'].includes(q.type) && 
        q.category !== 'diversity'
      );
    } else {
      // Default screening questions for guest candidates
      screeningQuestions = [
        {
          id: 'years_experience',
          question: 'How many years of relevant experience do you have?',
          type: 'select',
          required: true,
          options: ['Less than 1 year', '1-2 years', '3-5 years', '5-10 years', '10+ years']
        },
        {
          id: 'work_authorization',
          question: 'Are you authorized to work in the job location?',
          type: 'radio',
          required: true,
          options: ['Yes', 'No', 'Require sponsorship']
        },
        {
          id: 'notice_period',
          question: 'What is your notice period / availability?',
          type: 'select',
          required: false,
          options: ['Immediately', '2 weeks', '1 month', '2 months', '3+ months']
        },
        {
          id: 'why_interested',
          question: 'Why are you interested in this role? (brief)',
          type: 'textarea',
          required: false,
          maxLength: 500
        }
      ];
    }

    res.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          email: invitation.email,
          personalMessage: invitation.personalMessage,
          expiresAt: invitation.expiresAt
        },
        job: invitation.job ? {
          id: invitation.job.id,
          title: invitation.job.title,
          company: invitation.job.company,
          location: invitation.job.location,
          employmentType: invitation.job.employmentType,
          salaryMin: invitation.job.salaryMin,
          salaryMax: invitation.job.salaryMax,
          description: invitation.job.description
        } : null,
        recruiter: invitation.recruiter ? {
          name: `${invitation.recruiter.firstName} ${invitation.recruiter.lastName}`
        } : null,
        screeningQuestions,
        options: {
          canSignUp: true,       // Option to create full account
          canGuestSubmit: true,  // Option for quick guest submission
          signUpUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${token}`
        }
      }
    });
  } catch (error) {
    console.error('Error fetching guest screening data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load screening information'
    });
  }
});

/**
 * @route   POST /api/guest-screening/:token/submit
 * @desc    Submit guest screening (resume + answers, no account needed)
 * @access  Public
 */
router.post('/:token/submit', upload.single('resume'), [
  param('token').isLength({ min: 64, max: 64 }).withMessage('Invalid invitation token'),
  body('consentToScreening').equals('true').withMessage('You must consent to AI screening'),
  body('consentToTerms').equals('true').withMessage('You must accept the Terms of Service')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token } = req.params;
    const { answers, consentToScreening, consentToTerms } = req.body;

    // Parse answers if it's a string (from FormData)
    let parsedAnswers = answers;
    if (typeof answers === 'string') {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch {
        parsedAnswers = {};
      }
    }

    // Find invitation with associations
    const invitation = await CandidateInvitation.findOne({
      where: { invitationToken: token },
      include: [
        { model: Job, as: 'job' },
        { model: ImportedCandidate, as: 'importedCandidate' }
      ]
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    // Validate invitation can accept guest screening
    if (!invitation.canSubmitGuestScreening()) {
      return res.status(400).json({
        success: false,
        error: invitation.isExpired() 
          ? 'This invitation has expired' 
          : 'This invitation has already been responded to'
      });
    }

    // Parse resume if uploaded
    let parsedResumeData = null;
    let resumeText = '';
    if (req.file) {
      try {
        // Extract text from file
        resumeText = await resumeParser.extractTextFromResume(req.file);
        
        // AI-parse resume for structured data
        if (resumeText && resumeText.length > 50) {
          parsedResumeData = await resumeParser.parseResumeWithAI(resumeText);
        } else {
          // Fallback to pattern matching
          parsedResumeData = await resumeParser.parseResumeWithPatterns(resumeText);
        }
      } catch (parseError) {
        console.error('Resume parsing error (non-fatal):', parseError.message);
        // Continue without parsed data — resume text is still stored
      }
    }

    // Generate tracking code
    const trackingCode = generateTrackingCode();

    // Update ImportedCandidate with parsed resume data
    if (invitation.importedCandidate) {
      const enrichedData = {
        ...invitation.importedCandidate.enrichedData,
        resumeParsed: true,
        parsedAt: new Date().toISOString(),
        ...(parsedResumeData && {
          skills: parsedResumeData.skills || [],
          experience: parsedResumeData.experience || [],
          education: parsedResumeData.education || [],
          summary: parsedResumeData.summary || '',
          currentTitle: parsedResumeData.currentTitle || invitation.importedCandidate.currentTitle
        }),
        screeningAnswers: parsedAnswers
      };

      await invitation.importedCandidate.update({
        enrichedData,
        enrichmentStatus: 'completed',
        enrichedAt: new Date(),
        // Update title from resume if we parsed it
        ...(parsedResumeData?.currentTitle && { currentTitle: parsedResumeData.currentTitle })
      });
    }

    // Create JobApplication record for this guest submission
    let jobApplication = null;
    if (invitation.jobId) {
      jobApplication = await JobApplication.create({
        jobId: invitation.jobId,
        candidateId: null, // No user account
        importedCandidateId: invitation.importedCandidateId,
        status: 'pending_screening',
        answers: parsedAnswers,
        resumeUrl: null, // Could store to Cloudinary if needed
        coverLetter: parsedAnswers?.why_interested || null,
        source: 'guest_screening',
        screeningConsent: true,
        screeningConsentAt: new Date(),
        trackingCode,
        parsedResumeData,
        guestEmail: invitation.email,
        guestName: `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim()
      });
    }

    // Record consent data
    const consentData = {
      consentToScreening: consentToScreening === 'true',
      consentToTerms: consentToTerms === 'true',
      timestamp: new Date().toISOString(),
      ipAddress: clientIp(req),
      userAgent: req.get('User-Agent'),
      submissionType: 'guest_screening'
    };

    // Update invitation status
    await invitation.update({
      status: 'submitted',
      submissionType: 'guest_screening',
      respondedAt: new Date(),
      consentData,
      jobApplicationId: jobApplication?.id || null
    });

    res.json({
      success: true,
      data: {
        message: 'Your screening submission has been received successfully!',
        trackingCode,
        applicationId: jobApplication?.id,
        nextSteps: [
          'Your resume will be reviewed by our AI screening system',
          'The recruiter will be notified of your submission',
          'You can track your application status using your tracking code',
          'If shortlisted, you may be invited for a phone screening interview'
        ]
      }
    });
  } catch (error) {
    console.error('Error processing guest screening submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process your submission. Please try again.'
    });
  }
});

/**
 * @route   GET /api/guest-screening/track/:code
 * @desc    Check application status by tracking code (public)
 * @access  Public
 */
router.get('/track/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const application = await JobApplication.findOne({
      where: { trackingCode: code.toUpperCase() },
      include: [
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'company', 'location']
        }
      ],
      attributes: ['id', 'status', 'createdAt', 'guestName', 'guestEmail', 'aiMatchScore']
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'No application found with this tracking code'
      });
    }

    // Map internal statuses to user-friendly labels
    const statusLabels = {
      'pending_screening': 'Submitted — Awaiting AI Review',
      'submitted': 'Submitted',
      'under_review': 'Under Review by Recruiter',
      'screening': 'AI Screening in Progress',
      'shortlisted': 'Shortlisted! 🎉',
      'interview_scheduled': 'Interview Scheduled',
      'interview_completed': 'Interview Completed',
      'offered': 'Offer Extended',
      'accepted': 'Offer Accepted',
      'rejected': 'Application Not Selected',
      'withdrawn': 'Withdrawn'
    };

    res.json({
      success: true,
      data: {
        status: application.status,
        statusLabel: statusLabels[application.status] || application.status,
        job: application.job ? {
          title: application.job.title,
          company: application.job.company,
          location: application.job.location
        } : null,
        appliedAt: application.createdAt,
        applicantName: application.guestName,
        // Only show match score if screening is done
        matchScore: ['shortlisted', 'interview_scheduled', 'interview_completed', 'offered', 'accepted'].includes(application.status)
          ? application.aiMatchScore
          : null
      }
    });
  } catch (error) {
    console.error('Error tracking application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to lookup application status'
    });
  }
});

module.exports = router;
