/**
 * Candidate Invitation Service
 * 
 * Handles sending invitations to imported candidates and processing their responses.
 * 
 * Flow:
 * 1. createInvitationsForImport - Creates invitation records for all candidates in an import
 * 2. sendInvitations - Sends email invitations with unique tokens
 * 3. processAcceptance - Handles when candidate accepts (creates user/profile, consent)
 * 4. processDecline - Handles when candidate declines
 */

const { 
  sequelize, 
  CandidateInvitation, 
  CandidateImport, 
  ImportedCandidate,
  User, 
  Profile, 
  Job, 
  JobApplication,
  RecruiterProfile
} = require('../models');
const emailService = require('./emailService');
const crypto = require('crypto');

// Invitation expiry: 14 days
const INVITATION_EXPIRY_DAYS = 14;

// Terms and conditions version (update when T&C change)
const TERMS_VERSION = '1.0.0';

/**
 * Create invitations for all candidates in an import batch
 */
async function createInvitationsForImport(importId, options = {}) {
  const {
    personalMessage = null,
    expiryDays = INVITATION_EXPIRY_DAYS
  } = options;
  
  const transaction = await sequelize.transaction();
  
  try {
    // Get the import with candidates
    const candidateImport = await CandidateImport.findByPk(importId, {
      include: [
        {
          model: ImportedCandidate,
          as: 'candidates',
          where: { importStatus: 'success' } // Only invite successfully imported candidates
        },
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'recruiter',
          include: [{
            model: RecruiterProfile,
            as: 'recruiterProfile'
          }]
        }
      ],
      transaction
    });
    
    if (!candidateImport) {
      throw new Error('Import batch not found');
    }
    
    if (!candidateImport.candidates || candidateImport.candidates.length === 0) {
      throw new Error('No eligible candidates found in this import');
    }
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    const invitations = [];
    const skipped = [];
    
    for (const candidate of candidateImport.candidates) {
      // Check if invitation already exists for this candidate
      const existingInvitation = await CandidateInvitation.findOne({
        where: {
          importedCandidateId: candidate.id,
          status: { [sequelize.Sequelize.Op.notIn]: ['expired', 'bounced'] }
        },
        transaction
      });
      
      if (existingInvitation) {
        skipped.push({
          email: candidate.email,
          reason: 'Invitation already exists'
        });
        continue;
      }
      
      // Check if candidate already has an account
      const existingUser = await User.findOne({
        where: { email: candidate.email.toLowerCase() },
        transaction
      });
      
      if (existingUser) {
        // If user exists, we might want to just create an application
        skipped.push({
          email: candidate.email,
          reason: 'User already has an account',
          userId: existingUser.id
        });
        continue;
      }
      
      // Generate unique token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      
      const invitation = await CandidateInvitation.create({
        importId: candidateImport.id,
        importedCandidateId: candidate.id,
        jobId: candidateImport.jobId,
        recruiterId: candidateImport.recruiterId,
        email: candidate.email.toLowerCase(),
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        invitationToken,
        status: 'pending',
        expiresAt,
        personalMessage
      }, { transaction });
      
      invitations.push(invitation);
    }
    
    await transaction.commit();
    
    return {
      success: true,
      importId,
      totalCandidates: candidateImport.candidates.length,
      invitationsCreated: invitations.length,
      skipped: skipped.length,
      skippedDetails: skipped,
      invitations
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Send pending invitations via email
 */
async function sendInvitations(importId, options = {}) {
  const {
    batchSize = 50,
    delayBetweenBatches = 1000 // ms
  } = options;
  
  try {
    // Get pending invitations for this import
    const invitations = await CandidateInvitation.findAll({
      where: {
        importId,
        status: 'pending'
      },
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'recruiter',
          include: [{
            model: RecruiterProfile,
            as: 'recruiterProfile'
          }]
        }
      ],
      limit: batchSize
    });
    
    if (invitations.length === 0) {
      return {
        success: true,
        sent: 0,
        message: 'No pending invitations to send'
      };
    }
    
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };
    
    for (const invitation of invitations) {
      try {
        await sendInvitationEmail(invitation);
        
        await invitation.update({
          status: 'sent',
          sentAt: new Date(),
          sendAttempts: invitation.sendAttempts + 1
        });
        
        results.sent++;
        
      } catch (error) {
        console.error(`[Invitation] Failed to send to ${invitation.email}:`, error);
        
        await invitation.update({
          sendAttempts: invitation.sendAttempts + 1,
          lastError: error.message
        });
        
        results.failed++;
        results.errors.push({
          email: invitation.email,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      ...results
    };
    
  } catch (error) {
    console.error('[Invitation] Send error:', error);
    throw error;
  }
}

/**
 * Send individual invitation email
 */
async function sendInvitationEmail(invitation) {
  const job = invitation.job;
  const recruiter = invitation.recruiter;
  const companyName = recruiter?.recruiterProfile?.companyName || 'A company';
  
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invitation.invitationToken}`;
  const screenUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/screen/${invitation.invitationToken}`;
  
  const subject = job 
    ? `You're invited to apply for ${job.title} at ${companyName}`
    : `${companyName} would like to connect with you`;
  
  const candidateName = invitation.firstName || 'there';
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { font-size: 24px; font-weight: 700; color: #667eea; }
    .card { background: #f8fafc; border-radius: 16px; padding: 32px; margin-bottom: 24px; }
    .job-title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }
    .company { font-size: 16px; color: #64748b; margin: 0 0 16px; }
    .description { font-size: 14px; color: #475569; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0; }
    .features { margin: 24px 0; }
    .feature { display: flex; align-items: center; gap: 12px; margin: 12px 0; font-size: 14px; color: #475569; }
    .feature-icon { color: #22c55e; font-weight: bold; }
    .personal-message { background: white; border-left: 4px solid #667eea; padding: 16px; margin: 24px 0; font-style: italic; color: #475569; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 32px; }
    .footer a { color: #667eea; }
    .expire-notice { font-size: 13px; color: #f59e0b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">ProfilleAI</div>
    </div>
    
    <p>Hi ${candidateName},</p>
    
    ${job ? `
    <p>${companyName} has identified you as a potential match for an exciting opportunity and would like to invite you to apply.</p>
    
    <div class="card">
      <h2 class="job-title">${job.title}</h2>
      <p class="company">${companyName} • ${job.location || 'Remote'}</p>
      ${job.salaryMin && job.salaryMax ? `<p class="description">💰 $${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}</p>` : ''}
    </div>
    ` : `
    <p>${companyName} is interested in your profile and would like to connect with you about potential opportunities.</p>
    `}
    
    ${invitation.personalMessage ? `
    <div class="personal-message">
      "${invitation.personalMessage}"
      <br><br>
      — ${recruiter.firstName} ${recruiter.lastName}
    </div>
    ` : ''}
    
    <div class="features">
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span><strong>Quick Submit:</strong> Upload resume + answer a few questions (2 min, no signup)</span>
      </div>
      <div class="feature">
        <span class="feature-icon">✓</span>
        <span><strong>Or join ProfilleAI:</strong> Create a full profile for more opportunities</span>
      </div>
      <div class="feature">
        <span class="feature-icon">✓</span>
        <span>AI-powered matching with instant feedback</span>
      </div>
    </div>
    
    <center>
      <a href="${screenUrl}" class="cta-button">⚡ Quick Submit (2 min) →</a>
      <br>
      <a href="${inviteUrl}" style="display: inline-block; background: #1e293b; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 12px 0;">Join ProfilleAI for Full Profile →</a>
    </center>
    
    <p class="expire-notice">⏰ This invitation expires on ${invitation.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    
    <div class="footer">
      <p>You received this because ${companyName} identified you as a potential candidate.</p>
      <p>
        <a href="${inviteUrl}?action=decline">Not interested? Decline this invitation</a>
      </p>
      <p>© ${new Date().getFullYear()} ProfilleAI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  const textContent = `
Hi ${candidateName},

${job 
  ? `${companyName} has identified you as a potential match for ${job.title} and would like to invite you to apply.`
  : `${companyName} is interested in your profile and would like to connect with you about potential opportunities.`
}

${invitation.personalMessage ? `\nMessage from recruiter:\n"${invitation.personalMessage}"\n` : ''}

What happens next:
• Quick Submit (2 min): Upload your resume + answer a few questions — no signup needed
• Or join ProfilleAI: Create a full profile for more opportunities
• AI-powered matching with instant feedback

Quick Submit (no signup): ${screenUrl}
Join ProfilleAI (full profile): ${inviteUrl}

Accept your invitation: ${inviteUrl}

This invitation expires on ${invitation.expiresAt.toLocaleDateString()}.

Not interested? Decline here: ${inviteUrl}?action=decline

---
You received this because ${companyName} identified you as a potential candidate.
© ${new Date().getFullYear()} ProfilleAI
  `;
  
  // Send the email
  await emailService.sendEmail({
    to: invitation.email,
    subject,
    html: htmlContent,
    text: textContent
  });
}

/**
 * Process invitation acceptance
 * Creates user account, profile, and job application
 */
async function processAcceptance(invitationToken, acceptanceData) {
  const {
    password,
    firstName,
    lastName,
    phone,
    consentToScreening,
    consentToTerms,
    ipAddress,
    userAgent
  } = acceptanceData;
  
  if (!consentToScreening || !consentToTerms) {
    throw new Error('You must consent to the terms and AI screening to proceed');
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    // Find the invitation
    const invitation = await CandidateInvitation.findOne({
      where: { invitationToken },
      include: [
        { model: Job, as: 'job' },
        { model: ImportedCandidate, as: 'importedCandidate' },
        { model: User, as: 'recruiter' }
      ],
      transaction
    });
    
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }
    
    if (invitation.isExpired()) {
      await invitation.update({ status: 'expired' }, { transaction });
      throw new Error('This invitation has expired');
    }
    
    if (!invitation.canRespond()) {
      throw new Error('This invitation has already been processed');
    }
    
    // Check if user already exists
    let user = await User.findOne({
      where: { email: invitation.email.toLowerCase() },
      transaction
    });
    
    if (!user) {
      // Create new user account
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      user = await User.create({
        email: invitation.email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || invitation.firstName,
        lastName: lastName || invitation.lastName,
        role: 'candidate',
        isActive: true
      }, { transaction });
    }
    
    // Check if profile exists
    let profile = await Profile.findOne({
      where: { userId: user.id },
      transaction
    });
    
    if (!profile) {
      // Create profile from imported candidate data
      const importedCandidate = invitation.importedCandidate;
      
      profile = await Profile.create({
        userId: user.id,
        headline: importedCandidate?.currentTitle || '',
        summary: '',
        location: importedCandidate?.location || '',
        phone: phone || importedCandidate?.phone || '',
        linkedinUrl: importedCandidate?.linkedinUrl || '',
        skills: [],
        experience: [],
        education: [],
        isPublic: true,
        importSource: 'csv',
        importedAt: new Date(),
        importBatchId: invitation.importId
      }, { transaction });
    }
    
    // Create job application if job exists
    let jobApplication = null;
    if (invitation.jobId) {
      jobApplication = await JobApplication.create({
        jobId: invitation.jobId,
        candidateId: user.id,
        status: 'pending_screening',
        coverLetter: `Invited by recruiter via ProfilleAI`,
        screeningConsent: true,
        screeningConsentAt: new Date(),
        source: 'invitation'
      }, { transaction });
    }
    
    // Record consent
    const consentData = {
      termsVersion: TERMS_VERSION,
      consentToTerms: true,
      consentToScreening: true,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent
    };
    
    // Update invitation
    await invitation.update({
      status: 'accepted',
      respondedAt: new Date(),
      userId: user.id,
      profileId: profile.id,
      jobApplicationId: jobApplication?.id || null,
      consentData
    }, { transaction });
    
    // Update imported candidate
    if (invitation.importedCandidate) {
      await invitation.importedCandidate.update({
        userId: user.id,
        profileId: profile.id,
        importStatus: 'success'
      }, { transaction });
    }
    
    await transaction.commit();
    
    return {
      success: true,
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      profile: {
        id: profile.id
      },
      jobApplication: jobApplication ? {
        id: jobApplication.id,
        jobId: jobApplication.jobId
      } : null,
      job: invitation.job ? {
        id: invitation.job.id,
        title: invitation.job.title,
        company: invitation.job.company
      } : null
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Process invitation decline
 */
async function processDecline(invitationToken, declineData = {}) {
  const { reason } = declineData;
  
  const invitation = await CandidateInvitation.findOne({
    where: { invitationToken }
  });
  
  if (!invitation) {
    throw new Error('Invalid invitation token');
  }
  
  if (invitation.status === 'declined') {
    return { success: true, message: 'Already declined' };
  }
  
  await invitation.update({
    status: 'declined',
    respondedAt: new Date(),
    declineReason: reason || null
  });
  
  return {
    success: true,
    message: 'Invitation declined'
  };
}

/**
 * Get invitation by token (for display)
 */
async function getInvitationByToken(invitationToken) {
  const invitation = await CandidateInvitation.findOne({
    where: { invitationToken },
    include: [
      {
        model: Job,
        as: 'job',
        attributes: ['id', 'title', 'company', 'location', 'employmentType', 'salaryMin', 'salaryMax', 'description']
      },
      {
        model: User,
        as: 'recruiter',
        attributes: ['firstName', 'lastName'],
        include: [{
          model: RecruiterProfile,
          as: 'recruiterProfile',
          attributes: ['companyName', 'companyLogo', 'industry']
        }]
      }
    ]
  });
  
  if (!invitation) {
    return null;
  }
  
  return {
    id: invitation.id,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    status: invitation.status,
    isExpired: invitation.isExpired(),
    canRespond: invitation.canRespond(),
    expiresAt: invitation.expiresAt,
    personalMessage: invitation.personalMessage,
    job: invitation.job,
    recruiter: invitation.recruiter ? {
      name: `${invitation.recruiter.firstName} ${invitation.recruiter.lastName}`,
      company: invitation.recruiter.recruiterProfile?.companyName,
      logo: invitation.recruiter.recruiterProfile?.companyLogo,
      industry: invitation.recruiter.recruiterProfile?.industry
    } : null
  };
}

/**
 * Get invitation statistics for an import
 */
async function getInvitationStats(importId) {
  const invitations = await CandidateInvitation.findAll({
    where: { importId },
    attributes: ['status']
  });
  
  const stats = {
    total: invitations.length,
    pending: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    bounced: 0
  };
  
  for (const inv of invitations) {
    stats[inv.status] = (stats[inv.status] || 0) + 1;
  }
  
  stats.responseRate = stats.total > 0 
    ? ((stats.accepted + stats.declined) / stats.total * 100).toFixed(1)
    : 0;
  stats.acceptanceRate = (stats.accepted + stats.declined) > 0
    ? (stats.accepted / (stats.accepted + stats.declined) * 100).toFixed(1)
    : 0;
    
  return stats;
}

/**
 * Send reminder emails to candidates who haven't responded
 */
async function sendReminders(importId, options = {}) {
  const { maxReminders = 2 } = options;
  
  const invitations = await CandidateInvitation.findAll({
    where: {
      importId,
      status: ['sent', 'delivered', 'opened', 'clicked'],
      remindersSent: { [sequelize.Sequelize.Op.lt]: maxReminders }
    },
    include: [
      { model: Job, as: 'job' },
      { model: User, as: 'recruiter' }
    ]
  });
  
  let sentCount = 0;
  
  for (const invitation of invitations) {
    if (invitation.isExpired()) continue;
    
    // Don't send reminder within 3 days of last email
    const lastSent = invitation.lastReminderAt || invitation.sentAt;
    const daysSinceLast = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLast < 3) continue;
    
    try {
      await sendReminderEmail(invitation);
      await invitation.update({
        remindersSent: invitation.remindersSent + 1,
        lastReminderAt: new Date()
      });
      sentCount++;
    } catch (error) {
      console.error(`[Reminder] Failed for ${invitation.email}:`, error);
    }
  }
  
  return { sent: sentCount };
}

/**
 * Send reminder email
 */
async function sendReminderEmail(invitation) {
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invitation.invitationToken}`;
  const job = invitation.job;
  const daysLeft = Math.ceil((new Date(invitation.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24));
  
  const subject = job 
    ? `Reminder: You're invited to apply for ${job.title}`
    : `Reminder: You have a pending invitation`;
  
  await emailService.sendEmail({
    to: invitation.email,
    subject,
    html: `
      <p>Hi ${invitation.firstName || 'there'},</p>
      <p>Just a friendly reminder that you have a pending invitation${job ? ` for ${job.title}` : ''}.</p>
      <p>Your invitation expires in <strong>${daysLeft} days</strong>.</p>
      <p><a href="${inviteUrl}" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Accept Invitation</a></p>
    `,
    text: `Hi ${invitation.firstName || 'there'}, reminder: you have a pending invitation. Accept here: ${inviteUrl}`
  });
}

module.exports = {
  createInvitationsForImport,
  sendInvitations,
  sendInvitationEmail,
  processAcceptance,
  processDecline,
  getInvitationByToken,
  getInvitationStats,
  sendReminders,
  TERMS_VERSION
};
