const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Initialize Resend client (preferred for production)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Configure nodemailer transporter (fallback)
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const SIMPLE_EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const getDefaultFromDomain = () => {
  try {
    const host = new URL(process.env.FRONTEND_URL || 'http://localhost:3000').hostname;
    return host.replace(/^www\./, '');
  } catch {
    return 'profilleai.com';
  }
};

const normalizeFromAddress = () => {
  const raw = String(process.env.EMAIL_FROM || '').trim();

  // Plain email: email@example.com
  if (SIMPLE_EMAIL_RE.test(raw)) return raw;

  // Name <email@example.com> or "Name" <email@example.com>
  const namedMatch = raw.match(/^\s*"?([^"<>]*)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (namedMatch && SIMPLE_EMAIL_RE.test(namedMatch[2])) {
    const safeName = namedMatch[1].trim().replace(/^"|"$/g, '');
    return safeName ? `${safeName} <${namedMatch[2]}>` : namedMatch[2];
  }

  if (process.env.EMAIL_USER && SIMPLE_EMAIL_RE.test(process.env.EMAIL_USER)) {
    return `ProfilleAI <${process.env.EMAIL_USER}>`;
  }

  return `ProfilleAI <no-reply@${getDefaultFromDomain()}>`;
};

/**
 * Send an email using Resend (primary) or Nodemailer (fallback)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email body (HTML)
 * @param {string} text - Email body (Text fallback)
 */
const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  try {
    const fromAddress = normalizeFromAddress();

    // Option 1: Use Gmail/Nodemailer (if configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html,
        ...(replyTo ? { replyTo } : {})
      });

      console.log('Email sent via Gmail:', info.messageId);
      return true;
    }

    // Option 2: Use Resend (fallback)
    if (resend) {
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {})
      });

      if (error) {
        console.error('Resend error:', error);
        return false;
      }

      console.log('Email sent via Resend:', data?.id);
      return true;
    }

    // No email provider configured - log for development
    console.warn('⚠️ No email provider configured. Email not sent:', { to, subject });
    return false;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * Send candidate shortlist notification
 */
const sendShortlistNotification = async (candidate, job, recruiter) => {
  const subject = `Great News! You've been shortlisted for ${job.title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${candidate.firstName},</h2>
      <p>We have some exciting news! Our AI recruiting system has identified you as a top match for the <strong>${job.title}</strong> position at <strong>${job.company || 'our company'}</strong>.</p>
      
      <p>Based on your profile and experience, we think you'd be a great fit. We've already conducted an initial AI screening, and you passed with flying colors!</p>
      
      <h3>Next Steps</h3>
      <p>We'd love to invite you to a quick AI-led screening call to discuss the role further. You can schedule it directly through your ProfilleAI dashboard.</p>
      
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/messages" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Message & Schedule</a>
      </p>
      
      <p>Best regards,<br>${recruiter.firstName} (via ProfilleAI)</p>
    </div>
  `;
  
  const text = `Hi ${candidate.firstName}, You've been shortlisted for ${job.title}. Log in to ProfilleAI to schedule your screening call.`;

  return sendEmail({ to: candidate.email, subject, html, text });
};

/**
 * Send phone screening call results to recruiter
 */
const sendScreeningCallResults = async (phoneScreeningCallId) => {
  // Import here to avoid circular dependency
  const { PhoneScreeningCall, Job, User, Profile } = require('../models');
  
  const screening = await PhoneScreeningCall.findByPk(phoneScreeningCallId, {
    include: [
      { model: Job, attributes: ['id', 'title', 'company'] },
      { 
        model: User, 
        as: 'candidate',
        attributes: ['id', 'email'],
        include: [{ model: Profile, attributes: ['firstName', 'lastName'] }]
      },
      {
        model: User,
        as: 'recruiter',
        attributes: ['id', 'email']
      }
    ]
  });
  
  if (!screening || !screening.recruiter) {
    console.warn('Cannot send screening results - missing data');
    return false;
  }
  
  const candidateName = `${screening.candidate?.Profile?.firstName || 'Unknown'} ${screening.candidate?.Profile?.lastName || 'Candidate'}`;
  const jobTitle = screening.Job?.title || 'Position';
  const company = screening.Job?.company || 'Company';
  
  // Determine recommendation styling
  const getRecommendationColor = (rec) => {
    switch(rec) {
      case 'strong_yes': return '#059669';
      case 'yes': return '#10B981';
      case 'maybe': return '#F59E0B';
      case 'no': return '#EF4444';
      case 'strong_no': return '#DC2626';
      default: return '#6B7280';
    }
  };
  
  const getRecommendationLabel = (rec) => {
    switch(rec) {
      case 'strong_yes': return '🌟 Strong Yes';
      case 'yes': return '✅ Yes';
      case 'maybe': return '🤔 Maybe';
      case 'no': return '❌ No';
      case 'strong_no': return '⛔ Strong No';
      default: return 'Pending Review';
    }
  };
  
  const scoreBreakdown = screening.scoreBreakdown || {};
  const strengths = screening.strengths || [];
  const concerns = screening.concerns || [];
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  const subject = `📞 Phone Screening Complete: ${candidateName} for ${jobTitle}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1F2937; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
        Phone Screening Results
      </h2>
      
      <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0;">Candidate: ${candidateName}</h3>
        <p style="margin: 0; color: #6B7280;">Position: ${jobTitle} at ${company}</p>
        <p style="margin: 5px 0 0 0; color: #6B7280;">Duration: ${screening.actualDuration || screening.duration || '15'} minutes</p>
      </div>
      
      <div style="background: ${getRecommendationColor(screening.recommendation)}15; border-left: 4px solid ${getRecommendationColor(screening.recommendation)}; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0; color: ${getRecommendationColor(screening.recommendation)};">
          Overall Recommendation: ${getRecommendationLabel(screening.recommendation)}
        </h3>
        <p style="font-size: 24px; margin: 10px 0 0 0; color: #1F2937;">
          Score: <strong>${screening.screeningScore || 'N/A'}/100</strong>
        </p>
      </div>
      
      ${screening.aiSummary ? `
        <div style="margin: 20px 0;">
          <h3 style="color: #1F2937;">AI Summary</h3>
          <p style="color: #4B5563; line-height: 1.6;">${screening.aiSummary}</p>
        </div>
      ` : ''}
      
      <div style="display: flex; gap: 20px; margin: 20px 0;">
        <div style="flex: 1;">
          <h4 style="color: #059669;">✓ Strengths</h4>
          <ul style="color: #4B5563; padding-left: 20px;">
            ${strengths.length > 0 ? strengths.map(s => `<li>${s}</li>`).join('') : '<li>No specific strengths noted</li>'}
          </ul>
        </div>
        <div style="flex: 1;">
          <h4 style="color: #EF4444;">⚠ Concerns</h4>
          <ul style="color: #4B5563; padding-left: 20px;">
            ${concerns.length > 0 ? concerns.map(c => `<li>${c}</li>`).join('') : '<li>No specific concerns noted</li>'}
          </ul>
        </div>
      </div>
      
      ${Object.keys(scoreBreakdown).length > 0 ? `
        <div style="margin: 20px 0;">
          <h4 style="color: #1F2937;">Score Breakdown</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${Object.entries(scoreBreakdown).map(([key, value]) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1').trim()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">
                  <strong>${value}/100</strong>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}
      
      ${screening.extractedData && Object.keys(screening.extractedData).some(k => screening.extractedData[k]) ? `
        <div style="margin: 20px 0; background: #F9FAFB; padding: 15px; border-radius: 8px;">
          <h4 style="color: #1F2937; margin-top: 0;">Extracted Information</h4>
          <ul style="color: #4B5563; list-style: none; padding: 0;">
            ${screening.extractedData.salaryExpectation ? `<li>💰 Salary Expectation: ${screening.extractedData.salaryExpectation}</li>` : ''}
            ${screening.extractedData.availability ? `<li>📅 Availability: ${screening.extractedData.availability}</li>` : ''}
            ${screening.extractedData.noticePeriod ? `<li>⏰ Notice Period: ${screening.extractedData.noticePeriod}</li>` : ''}
            ${screening.extractedData.yearsExperience ? `<li>📊 Years Experience: ${screening.extractedData.yearsExperience}</li>` : ''}
          </ul>
        </div>
      ` : ''}
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${frontendUrl}/phone-screening/${screening.id}/results" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
          View Full Results
        </a>
        ${screening.recordingUrl ? `
          <a href="${screening.recordingUrl}" 
             style="background-color: #6B7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Listen to Recording
          </a>
        ` : ''}
      </div>
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">
        This screening was conducted by ProfilleAI's AI Phone Screening System.<br>
        Results should be used as one factor in your hiring decision.
      </p>
    </div>
  `;
  
  const text = `Phone Screening Results for ${candidateName}
  
Position: ${jobTitle} at ${company}
Overall Score: ${screening.screeningScore || 'N/A'}/100
Recommendation: ${getRecommendationLabel(screening.recommendation)}

${screening.aiSummary || ''}

View full results at: ${frontendUrl}/phone-screening/${screening.id}/results`;

  return sendEmail({ 
    to: screening.recruiter.email, 
    subject, 
    html, 
    text 
  });
};

/**
 * Send application confirmation to candidate
 */
const sendApplicationConfirmation = async (candidate, job) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `Application Received: ${job.title} at ${job.company}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1F2937;">Thank you for applying!</h2>
      
      <p>Hi ${candidate.firstName},</p>
      
      <p>We've successfully received your application for the <strong>${job.title}</strong> position at <strong>${job.company}</strong>.</p>
      
      <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #4F46E5;">Application Details</h3>
        <p style="margin: 5px 0;"><strong>Position:</strong> ${job.title}</p>
        <p style="margin: 5px 0;"><strong>Company:</strong> ${job.company}</p>
        <p style="margin: 5px 0;"><strong>Location:</strong> ${job.location || 'Not specified'}</p>
        <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
      </div>
      
      <h3 style="color: #1F2937;">What Happens Next?</h3>
      <ol style="color: #4B5563; line-height: 1.8;">
        <li>Our team will review your application</li>
        <li>If you're a good match, we'll reach out to schedule an interview</li>
        <li>You can track your application status in your dashboard</li>
      </ol>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${frontendUrl}/candidate/jobs" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View My Applications
        </a>
      </div>
      
      <p style="color: #6B7280;">
        Best of luck!<br>
        The ${job.company} Team via ProfilleAI
      </p>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
        You received this email because you applied for a job on ProfilleAI.<br>
        If you didn't apply, please ignore this email.
      </p>
    </div>
  `;
  
  const text = `Thank you for applying!

Hi ${candidate.firstName},

We've received your application for ${job.title} at ${job.company}.

What happens next:
1. Our team will review your application
2. If you're a good match, we'll reach out to schedule an interview
3. You can track your application status in your dashboard

View your applications at: ${frontendUrl}/candidate/jobs

Best of luck!
The ${job.company} Team via ProfilleAI`;

  return sendEmail({ to: candidate.email, subject, html, text });
};

/**
 * Notify recruiter of new application
 */
const sendNewApplicationNotification = async (recruiter, candidate, job, application) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const subject = `New Application: ${candidate.firstName} ${candidate.lastName} for ${job.title}`;
  
  const aiScoreSection = application.aiMatchScore 
    ? `<p style="margin: 5px 0;"><strong>AI Match Score:</strong> <span style="color: ${application.aiMatchScore >= 70 ? '#059669' : application.aiMatchScore >= 50 ? '#F59E0B' : '#EF4444'}; font-weight: bold;">${application.aiMatchScore}%</span></p>`
    : '';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1F2937;">🎯 New Application Received</h2>
      
      <p>Hi ${recruiter.firstName},</p>
      
      <p>A new candidate has applied for your job posting!</p>
      
      <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #4F46E5;">Candidate Details</h3>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${candidate.firstName} ${candidate.lastName}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${candidate.email}</p>
        ${candidate.profile?.headline ? `<p style="margin: 5px 0;"><strong>Headline:</strong> ${candidate.profile.headline}</p>` : ''}
        ${aiScoreSection}
      </div>
      
      <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #4338CA;">Position Applied For</h3>
        <p style="margin: 5px 0;"><strong>${job.title}</strong></p>
        <p style="margin: 5px 0; color: #6B7280;">${job.company} • ${job.location || 'Remote'}</p>
      </div>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${frontendUrl}/recruiter/jobs/${job.id}/applications" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
          Review Application
        </a>
        <a href="${frontendUrl}/profile/${candidate.id}" 
           style="background-color: #6B7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Profile
        </a>
      </div>
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">
        You're receiving this because you're the recruiter for this job on ProfilleAI.
      </p>
    </div>
  `;
  
  const text = `New Application Received

Hi ${recruiter.firstName},

${candidate.firstName} ${candidate.lastName} has applied for ${job.title}.

Email: ${candidate.email}
${application.aiMatchScore ? `AI Match Score: ${application.aiMatchScore}%` : ''}

Review the application at: ${frontendUrl}/recruiter/jobs/${job.id}/applications`;

  return sendEmail({ to: recruiter.email, subject, html, text });
};

/**
 * Send application status update to candidate
 */
const sendApplicationStatusUpdate = async (candidate, job, newStatus, recruiterNotes = null) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  const statusConfig = {
    'under_review': {
      emoji: '👀',
      title: 'Application Under Review',
      message: `Your application for ${job.title} is now being reviewed by the hiring team.`,
      color: '#F59E0B'
    },
    'shortlisted': {
      emoji: '🌟',
      title: 'Congratulations! You\'ve Been Shortlisted',
      message: `Great news! You've been shortlisted for the ${job.title} position. The recruiter will be in touch soon to discuss next steps.`,
      color: '#059669'
    },
    'interview_scheduled': {
      emoji: '📅',
      title: 'Interview Scheduled',
      message: `Your interview for ${job.title} has been scheduled. Check your dashboard for details.`,
      color: '#4F46E5'
    },
    'offered': {
      emoji: '🎉',
      title: 'Job Offer!',
      message: `Congratulations! You've received an offer for the ${job.title} position!`,
      color: '#059669'
    },
    'rejected': {
      emoji: '📝',
      title: 'Application Update',
      message: `Thank you for your interest in ${job.title}. After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current needs.`,
      color: '#6B7280'
    }
  };
  
  const config = statusConfig[newStatus] || {
    emoji: '📋',
    title: 'Application Status Update',
    message: `Your application status for ${job.title} has been updated to: ${newStatus}`,
    color: '#6B7280'
  };
  
  const subject = `${config.emoji} ${config.title} - ${job.title} at ${job.company}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${config.color}15; border-left: 4px solid ${config.color}; padding: 20px; border-radius: 0 8px 8px 0;">
        <h2 style="color: ${config.color}; margin: 0 0 10px 0;">${config.emoji} ${config.title}</h2>
        <p style="margin: 0; color: #4B5563;">${job.title} at ${job.company}</p>
      </div>
      
      <div style="padding: 20px 0;">
        <p>Hi ${candidate.firstName},</p>
        <p style="line-height: 1.6; color: #374151;">${config.message}</p>
        
        ${recruiterNotes ? `
          <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1F2937;">Message from the recruiter:</h4>
            <p style="margin: 0; color: #4B5563; font-style: italic;">"${recruiterNotes}"</p>
          </div>
        ` : ''}
        
        ${newStatus !== 'rejected' ? `
          <div style="margin: 30px 0; text-align: center;">
            <a href="${frontendUrl}/candidate/jobs" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Application Status
            </a>
          </div>
        ` : `
          <p style="color: #6B7280; margin-top: 20px;">
            Don't be discouraged! There are many other opportunities on ProfilleAI that might be a great fit for you.
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${frontendUrl}/jobs" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Browse More Jobs
            </a>
          </div>
        `}
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
        You received this email because you applied for a job on ProfilleAI.
      </p>
    </div>
  `;
  
  const text = `${config.title}

Hi ${candidate.firstName},

${config.message}

${recruiterNotes ? `Message from recruiter: "${recruiterNotes}"` : ''}

${newStatus !== 'rejected' 
  ? `View your application at: ${frontendUrl}/candidate/jobs`
  : `Browse more jobs at: ${frontendUrl}/jobs`
}`;

  return sendEmail({ to: candidate.email, subject, html, text });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, firstName, resetLink) => {
  // Log to console in development for easy testing
  console.log('\n========================================');
  console.log('🔑 PASSWORD RESET LINK (for development)');
  console.log('========================================');
  console.log(`Email: ${email}`);
  console.log(`Link: ${resetLink}`);
  console.log('========================================\n');

  const subject = 'Reset Your ProfilleAI Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #4F46E5; margin: 0;">ProfilleAI</h1>
      </div>
      
      <h2 style="color: #1F2937;">Hi ${firstName || 'there'},</h2>
      
      <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">
        We received a request to reset your password for your ProfilleAI account. 
        Click the button below to create a new password:
      </p>
      
      <div style="margin: 30px 0; text-align: center;">
        <a href="${resetLink}" 
           style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      
      <p style="color: #6B7280; font-size: 14px;">
        This link will expire in <strong>1 hour</strong> for security reasons.
      </p>
      
      <p style="color: #6B7280; font-size: 14px;">
        If you didn't request a password reset, you can safely ignore this email. 
        Your password will remain unchanged.
      </p>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #9CA3AF; font-size: 12px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color: #4F46E5; word-break: break-all;">${resetLink}</a>
      </p>
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">
        &copy; ${new Date().getFullYear()} ProfilleAI. All rights reserved.
      </p>
    </div>
  `;
  
  const text = `Hi ${firstName || 'there'},

We received a request to reset your password for your ProfilleAI account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

- The ProfilleAI Team`;

  return sendEmail({ to: email, subject, html, text });
};

/**
 * Send email verification link to a newly registered user.
 */
const sendEmailVerification = async (email, firstName, verifyLink, verificationCode) => {
  console.log('\n========================================');
  console.log('✉️  EMAIL VERIFICATION LINK (for development)');
  console.log('========================================');
  console.log(`Email: ${email}`);
  console.log(`Link: ${verifyLink}`);
  if (verificationCode) {
    console.log(`Code: ${verificationCode}`);
  }
  console.log('========================================\n');

  const subject = 'Verify your ProfilleAI email';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #4F46E5; margin: 0;">ProfilleAI</h1>
      </div>

      <h2 style="color: #1F2937;">Hi ${firstName || 'there'},</h2>

      <p style="color: #4B5563; font-size: 16px; line-height: 1.6;">
        Thanks for signing up! Please confirm your email address so we know it's really you.
      </p>

      <div style="margin: 30px 0; text-align: center;">
        <a href="${verifyLink}"
           style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
          Verify Email
        </a>
      </div>

      ${verificationCode ? `
        <div style="margin: 22px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">Or enter this verification code:</p>
          <div style="display: inline-block; padding: 10px 16px; border: 1px dashed #C7D2FE; border-radius: 8px; font-size: 24px; letter-spacing: 4px; font-weight: 700; color: #1F2937;">
            ${verificationCode}
          </div>
        </div>
      ` : ''}

      <p style="color: #6B7280; font-size: 14px;">
        This link expires in <strong>24 hours</strong>. If it expires, you can request a new one from your account.
      </p>

      <p style="color: #6B7280; font-size: 14px;">
        If you didn't create a ProfilleAI account, you can safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

      <p style="color: #9CA3AF; font-size: 12px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${verifyLink}" style="color: #4F46E5; word-break: break-all;">${verifyLink}</a>
      </p>

      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px;">
        &copy; ${new Date().getFullYear()} ProfilleAI. All rights reserved.
      </p>
    </div>
  `;

  const text = `Hi ${firstName || 'there'},

Thanks for signing up to ProfilleAI. Please confirm your email by opening the link below:

${verifyLink}

${verificationCode ? `Or enter this verification code in the app:
${verificationCode}
` : ''}

This link expires in 24 hours.

If you didn't create a ProfilleAI account, you can ignore this email.

- The ProfilleAI Team`;

  return sendEmail({ to: email, subject, html, text });
};

// ═════════════════════════════════════════════════════════════════
// Support ticket notifications
// ═════════════════════════════════════════════════════════════════

const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * Notify the admin inbox that a new support ticket was opened.
 * Silent no-op if ADMIN_EMAIL isn't configured — the ticket is still
 * persisted, so admins can pick it up from the /admin dashboard.
 */
const sendSupportTicketToAdmin = async (ticket) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL;
  if (!adminEmail) {
    console.warn('[Support] ADMIN_EMAIL not set — skipping admin notification');
    return false;
  }

  const subject = `[Support] ${ticket.category.toUpperCase()}: ${ticket.subject}`;
  const dashUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin`;

  const transcriptHtml = Array.isArray(ticket.chatTranscript) && ticket.chatTranscript.length > 0
    ? `<h3 style="margin-top:24px;color:#374151;font-size:14px;">AI chat transcript</h3>
       <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;max-height:400px;overflow:auto;">
         ${ticket.chatTranscript.map((m) => `
           <div style="margin-bottom:10px;">
             <div style="font-weight:600;color:${m.role === 'user' ? '#0a66c2' : '#7c3aed'};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${m.role}</div>
             <div style="color:#374151;white-space:pre-wrap;">${escapeHtml(m.content)}</div>
           </div>
         `).join('')}
       </div>`
    : '';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">New support ticket</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(ticket.subject)}</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px;">
        <table style="width:100%;font-size:13px;color:#374151;">
          <tr><td style="padding:4px 0;color:#6b7280;">From</td><td style="padding:4px 0;">${escapeHtml(ticket.name || '\u2014')} &lt;${escapeHtml(ticket.email)}&gt;</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Category</td><td style="padding:4px 0;">${escapeHtml(ticket.category)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Source</td><td style="padding:4px 0;">${escapeHtml(ticket.source || 'help_center')}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">User ID</td><td style="padding:4px 0;font-family:monospace;font-size:11px;">${ticket.userId || 'guest'}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;">Ticket ID</td><td style="padding:4px 0;font-family:monospace;font-size:11px;">${ticket.id}</td></tr>
        </table>
        <h3 style="margin-top:20px;color:#374151;font-size:14px;">Message</h3>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:14px;color:#111827;">${escapeHtml(ticket.message)}</div>
        ${transcriptHtml}
        <div style="margin-top:24px;text-align:center;">
          <a href="${dashUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">Open admin dashboard</a>
        </div>
        <div style="margin-top:20px;font-size:12px;color:#9ca3af;text-align:center;">Reply directly to this email to respond to the user.</div>
      </div>
    </div>
  `;

  const text = `New support ticket [${ticket.category}]\n\n` +
    `From: ${ticket.name || '-'} <${ticket.email}>\n` +
    `Subject: ${ticket.subject}\n` +
    `Ticket ID: ${ticket.id}\n\n` +
    `${ticket.message}\n\n` +
    `Reply directly to this email to respond to the user.`;

  // replyTo lets admins hit reply and land in the user's inbox.
  return sendEmail({ to: adminEmail, subject, html, text, replyTo: ticket.email });
};

/**
 * Confirmation email to the user who opened the ticket. Non-critical —
 * failure to send is logged but doesn't block ticket creation.
 */
const sendSupportTicketConfirmation = async (ticket) => {
  if (!ticket.email) return false;

  const subject = `We got your message — ProfilleAI support`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <div style="font-size:22px;font-weight:700;">Thanks for reaching out</div>
        <div style="font-size:14px;opacity:0.9;margin-top:4px;">We'll get back to you soon.</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px;color:#374151;">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(ticket.name || 'there')},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">We received your message and someone from the ProfilleAI team will get back to you shortly. Our typical response time is within 1 business day.</p>
        <div style="background:#f9fafb;border-left:3px solid #667eea;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:4px;">Your message</div>
          <div style="font-size:14px;color:#111827;font-weight:600;margin-bottom:6px;">${escapeHtml(ticket.subject)}</div>
          <div style="font-size:13px;color:#4b5563;white-space:pre-wrap;">${escapeHtml(ticket.message)}</div>
        </div>
        <p style="font-size:13px;color:#6b7280;margin:16px 0 0;">Ticket reference: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${ticket.id.slice(0, 8)}</code></p>
      </div>
    </div>
  `;
  const text = `Hi ${ticket.name || 'there'},\n\n` +
    `We received your message and someone from the ProfilleAI team will get back to you shortly.\n\n` +
    `Your message:\n${ticket.subject}\n\n${ticket.message}\n\n` +
    `Ticket reference: ${ticket.id.slice(0, 8)}\n\n- The ProfilleAI Team`;

  try {
    return await sendEmail({ to: ticket.email, subject, html, text });
  } catch (err) {
    console.warn('[Support] Could not send confirmation to user:', err?.message);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendShortlistNotification,
  sendScreeningCallResults,
  sendApplicationConfirmation,
  sendNewApplicationNotification,
  sendApplicationStatusUpdate,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSupportTicketToAdmin,
  sendSupportTicketConfirmation
};
