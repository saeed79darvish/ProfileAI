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
        // Log the FULL provider error so prod diagnosis doesn't need a
        // debugger attach. Resend commonly returns things like:
        //   - validation_error   (bad from-address / not verified)
        //   - unauthorized       (bad API key)
        //   - rate_limit_exceeded
        console.error('[sendEmail] Resend rejected:', {
          name: error?.name,
          message: error?.message,
          statusCode: error?.statusCode,
          from: fromAddress,
          to,
          subject,
        });
        return false;
      }

      console.log('Email sent via Resend:', data?.id, '→', to);
      return true;
    }

    // No email provider configured. This is the "silent no-op" trap — prod
    // envs sometimes ship without EMAIL_* / RESEND_API_KEY set and users
    // wonder why their reports never arrive. Log loudly so any prod call
    // shows the misconfiguration.
    console.error('[sendEmail] NO PROVIDER CONFIGURED — email dropped', {
      to,
      subject,
      hasEmailUserPass: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      hasResendKey: !!process.env.RESEND_API_KEY,
      fromAddress,
    });
    return false;
  } catch (error) {
    console.error('[sendEmail] threw:', error?.message, {
      to,
      subject,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    });
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

  const subject = `We got your message. ProfilleAI support`;
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

/**
 * Admin reply to a support ticket. Delivered to the user's email with a
 * Reply-To of the admin (ADMIN_EMAIL / SUPPORT_EMAIL) so the user can
 * simply hit Reply to continue the thread.
 */
const sendSupportReplyToUser = async ({ ticket, replyBody, adminName }) => {
  if (!ticket?.email || !replyBody) return false;

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL;
  const displayFrom = adminName || 'ProfilleAI Support';
  const subject = `Re: ${ticket.subject}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Reply from ${escapeHtml(displayFrom)}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(ticket.subject)}</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px;">
        <p style="font-size:15px;margin:0 0 12px;">Hi ${escapeHtml(ticket.name || 'there')},</p>
        <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(replyBody)}</div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">
          <div>Reply to this email to continue the conversation.</div>
          <div style="margin-top:6px;">Ticket reference: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${ticket.id.slice(0, 8)}</code></div>
        </div>
      </div>
    </div>
  `;

  const text = `Hi ${ticket.name || 'there'},\n\n${replyBody}\n\n` +
    `Reply to this email to continue the conversation.\n` +
    `Ticket reference: ${ticket.id.slice(0, 8)}\n\n- ${displayFrom}`;

  try {
    return await sendEmail({
      to: ticket.email,
      subject,
      html,
      text,
      // Route the user's Reply back to the admin inbox so we can see it.
      replyTo: adminEmail || undefined
    });
  } catch (err) {
    console.warn('[Support] Could not send reply to user:', err?.message);
    return false;
  }
};

// ── LinkedIn Profile Analyzer — guest report email ─────────────────────
//
// Sent after a signed-out user submits their email from the guest teaser
// modal. Contains the FULL analysis (scores, verdict, all 5 priority
// fixes, per-section suggestions with paste-ready rewrites, keyword
// chips) plus a signup CTA and a stateless unsubscribe link.
//
// Called from POST /api/profiles/guest-report-email.
// Named `escapeGuestReportHtml` to avoid colliding with the same-named
// helper already defined higher up in this file.
const escapeGuestReportHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const buildGuestReportEmail = ({ analysis, targetTitle, profileUrl, signupUrl, unsubscribeUrl }) => {
  const overall = Number(analysis?.overallScore) || 0;
  const fit = Number(analysis?.recruiterFitScore) || 0;
  const search = Number(analysis?.searchVisibilityScore) || 0;
  const verdict = String(analysis?.verdict || 'maybe').toLowerCase();
  const verdictLabel = verdict === 'shortlist' ? 'SHORTLIST' : verdict === 'pass' ? 'PASS' : 'MAYBE';
  // Amber for MAYBE / red for PASS / green for SHORTLIST. All shades match
  // the reference design.
  const verdictColor = verdict === 'shortlist' ? '#059669' : verdict === 'pass' ? '#DC2626' : '#D97706';
  const verdictTintBg = verdict === 'shortlist' ? '#ECFDF5' : verdict === 'pass' ? '#FEF2F2' : '#FEF3C7';
  const summary = String(analysis?.summary || '');
  const priorityFixes = Array.isArray(analysis?.priorityFixes) ? analysis.priorityFixes : [];
  const sections = Array.isArray(analysis?.sections) ? analysis.sections : [];

  // Effective role label — shown in hero + used in copy fallbacks.
  const roleLabel = (targetTitle && String(targetTitle).trim()) || 'your target role';

  // Preheader (hidden by clients, previewed in inbox list).
  const preheader = `${Math.max(3, priorityFixes.length || 5)} fixes and paste-ready rewrites inside`;

  // UTM helper — every CTA link is auth'd back to a distinct source so
  // funnel analysis can tell which card drove the click.
  const withUtm = (url, content) => {
    if (!url) return '#';
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_content=${encodeURIComponent(content)}`;
  };

  // Score-number color follows the same band as the extension: >=70 green,
  // >=50 amber, <50 red. Matches the mockup where 62 is dark, 68 is dark,
  // 52 is orange.
  const scoreColor = (n) => (n >= 70 ? '#111827' : n >= 50 ? '#D97706' : '#DC2626');

  const scoreCard = (label, val) => `
    <td align="center" width="33%" style="padding:20px 12px;border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">
      <div style="font:700 40px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${scoreColor(val)};letter-spacing:-0.02em;">
        ${val}<span style="font-size:15px;font-weight:600;color:#9CA3AF;letter-spacing:0;">/100</span>
      </div>
      <div style="font:600 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;margin-top:8px;">${escapeGuestReportHtml(label)}</div>
    </td>
  `;

  const fixItems = priorityFixes.slice(0, 5).map((raw, i) => {
    const text = String(raw || '').trim();
    // Split into a bolded lead sentence + body, if the fix reads like
    // "Do X. Because Y." Otherwise use the whole thing as the body.
    const firstStop = text.search(/[.!?]\s+/);
    let title = text;
    let body = '';
    if (firstStop > 0) {
      title = text.slice(0, firstStop).trim().replace(/[.!?]+$/, '');
      body = text.slice(firstStop + 1).trim();
    }
    return `
      <tr><td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-left:3px solid #7C3AED;border-radius:8px;background:#FFFFFF;">
          <tr>
            <td width="52" valign="top" style="padding:16px 0 16px 18px;font:800 20px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;letter-spacing:-0.02em;">${String(i + 1).padStart(2, '0')}</td>
            <td valign="top" style="padding:16px 20px 16px 8px;">
              <div style="font:700 15px/1.35 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:${body ? '6px' : '0'};">${escapeGuestReportHtml(title)}</div>
              ${body ? `<div style="font:400 14px/1.55 -apple-system,'Segoe UI',sans-serif;color:#4B5563;">${escapeGuestReportHtml(body)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>
    `;
  }).join('');

  // Score-chip color for per-section score badges (mockup shows a soft
  // red/amber/green pill).
  const chipColor = (n) => {
    if (n >= 70) return { bg: '#DCFCE7', fg: '#166534' };
    if (n >= 50) return { bg: '#FEF3C7', fg: '#92400E' };
    return { bg: '#FEE2E2', fg: '#991B1B' };
  };

  const sectionCards = sections.slice(0, 3).map((s) => {
    const chip = chipColor(Number(s?.score) || 0);
    return `
      <tr><td style="padding:0 0 16px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">
          <tr><td style="padding:20px 20px 4px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font:700 18px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;">${escapeGuestReportHtml(s?.name || '')}</td>
                <td align="right" style="white-space:nowrap;">
                  <span style="display:inline-block;padding:4px 12px;background:${chip.bg};color:${chip.fg};border-radius:999px;font:700 12px/1 -apple-system,'Segoe UI',sans-serif;">${Number(s?.score) || 0}/100</span>
                </td>
              </tr>
            </table>
          </td></tr>
          ${Array.isArray(s?.findings) && s.findings.length ? `
          <tr><td style="padding:12px 20px 4px 20px;">
            <ul style="margin:0 0 6px 18px;padding:0;color:#374151;font:400 14px/1.6 -apple-system,'Segoe UI',sans-serif;">
              ${s.findings.map((f) => `<li style="margin:0 0 4px 0;">${escapeGuestReportHtml(f)}</li>`).join('')}
            </ul>
          </td></tr>` : ''}
          ${s?.suggestion ? `
          <tr><td style="padding:8px 20px 20px 20px;">
            <div style="padding:14px 16px;background:#F5F3FF;border:1px solid #E9E4FF;border-radius:8px;">
              <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Paste-ready rewrite</div>
              <div style="font:400 14px/1.6 -apple-system,'Segoe UI',sans-serif;color:#111827;white-space:pre-wrap;">${escapeGuestReportHtml(s.suggestion)}</div>
            </div>
          </td></tr>` : ''}
        </table>
      </td></tr>
    `;
  }).join('');

  // Feature grid (six tiles, 2 columns × 3 rows). Icons are simple emoji
  // stand-ins for a colored tile so we don't rely on external images.
  const featureCard = ({ emoji, title, body, cta, url }) => `
    <td width="50%" valign="top" style="padding:0 8px 16px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">
        <tr><td style="padding:18px 18px 16px 18px;">
          <div style="width:36px;height:36px;background:#F5F3FF;border-radius:8px;text-align:center;line-height:36px;font-size:18px;margin-bottom:12px;">${emoji}</div>
          <div style="font:700 15px/1.3 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:6px;">${escapeGuestReportHtml(title)}</div>
          <div style="font:400 13px/1.55 -apple-system,'Segoe UI',sans-serif;color:#4B5563;margin-bottom:12px;min-height:44px;">${escapeGuestReportHtml(body)}</div>
          <a href="${escapeGuestReportHtml(url)}" style="font:600 13px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;text-decoration:none;">${escapeGuestReportHtml(cta)} &rarr;</a>
        </td></tr>
      </table>
    </td>
  `;

  const features = [
    { emoji: '📊', title: 'Unlimited LinkedIn analyses', body: 'Re-run this report as many times as you want, on any profile.', cta: 'Try it free', url: withUtm(signupUrl, 'feature_unlimited_analyses') },
    { emoji: '🤖', title: 'AI profile builder',           body: 'One resume upload builds a complete ProfilleAI profile in seconds.', cta: 'Try it free', url: withUtm(signupUrl, 'feature_profile_builder') },
    { emoji: '📝', title: 'Resume tailoring',              body: 'Rewrite your resume to any job description in under a minute.',       cta: 'Try it free', url: withUtm(signupUrl, 'feature_resume_tailoring') },
    { emoji: '✉️',  title: 'AI cover letters',             body: "One-click cover letters that don't read like AI wrote them.",         cta: 'Try it free', url: withUtm(signupUrl, 'feature_cover_letters') },
    { emoji: '⚡',  title: 'Chrome extension autofill',    body: 'Auto-fill Greenhouse, Lever, Ashby, Workday and 40+ boards.',          cta: 'Install',      url: withUtm(signupUrl, 'feature_extension') },
    { emoji: '🎯',  title: 'Matched jobs feed',            body: 'Live feed of jobs matching your skills across 500+ boards.',           cta: 'Browse jobs',  url: withUtm(signupUrl, 'feature_jobs_feed') },
  ];

  // Build the 2-column grid as pairs of rows.
  const featureRows = [];
  for (let i = 0; i < features.length; i += 2) {
    featureRows.push(`<tr>${featureCard(features[i])}${features[i + 1] ? featureCard(features[i + 1]) : '<td width="50%"></td>'}</tr>`);
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Your LinkedIn scored ${overall}/100</title>
  </head>
  <body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeGuestReportHtml(preheader)}</span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

          <!-- HERO: violet gradient -->
          <tr><td style="padding:36px 36px 40px 36px;background:linear-gradient(135deg,#7C3AED 0%,#6366F1 100%);color:#FFFFFF;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="font:700 20px/1 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;letter-spacing:-0.01em;">ProfilleAI</td>
                <td valign="middle" align="right">
                  <span style="display:inline-block;padding:6px 12px;background:rgba(255,255,255,0.18);border-radius:999px;font:700 10px/1 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;letter-spacing:0.12em;text-transform:uppercase;">LinkedIn Report</span>
                </td>
              </tr>
            </table>
            <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.12em;margin-top:32px;margin-bottom:14px;">Your LinkedIn profile</div>
            <div style="font:800 36px/1.15 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;letter-spacing:-0.02em;margin-bottom:16px;">You scored ${overall} out of 100</div>
            <div style="font:400 15px/1.55 -apple-system,'Segoe UI',sans-serif;color:rgba(255,255,255,0.92);max-width:540px;">
              Target role: <strong style="color:#FFFFFF;">${escapeGuestReportHtml(roleLabel)}</strong>. Below is what a senior recruiter would see, and the paste-ready fixes that would land you in the shortlist pile.
            </div>
          </td></tr>

          <!-- SCORES: three-card row -->
          <tr><td style="padding:28px 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-spacing:8px 0;">
              <tr>${scoreCard('Overall', overall)}${scoreCard('Recruiter Fit', fit)}${scoreCard('Search Visibility', search)}</tr>
            </table>
          </td></tr>

          <!-- VERDICT card -->
          <tr><td style="padding:16px 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${verdictTintBg};border-left:4px solid ${verdictColor};border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:${verdictColor};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Recruiter Verdict: ${verdictLabel}</div>
                <div style="font:400 14px/1.6 -apple-system,'Segoe UI',sans-serif;color:#111827;">${escapeGuestReportHtml(summary)}</div>
              </td></tr>
            </table>
          </td></tr>

          <!-- Score-lift CTA card -->
          <tr><td style="padding:12px 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3FF;border:1px solid #E9E4FF;border-radius:10px;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font:700 15px/1.3 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:4px;">Want to lift this score to 90+?</div>
                  <div style="font:400 13px/1.5 -apple-system,'Segoe UI',sans-serif;color:#4B5563;">Free account applies every rewrite in one click, then re-analyzes.</div>
                </td>
                <td align="right" style="padding:16px 18px;white-space:nowrap;">
                  <a href="${escapeGuestReportHtml(withUtm(signupUrl, 'lift_score_card'))}" style="display:inline-block;padding:11px 18px;background:#7C3AED;color:#FFFFFF;text-decoration:none;border-radius:8px;font:700 13px/1 -apple-system,'Segoe UI',sans-serif;">Lift my score &rarr;</a>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- TOP FIXES -->
          ${priorityFixes.length ? `
          <tr><td style="padding:28px 32px 0 32px;">
            <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#6B7280;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;">Do these first</div>
            <div style="font:800 22px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;letter-spacing:-0.01em;margin-bottom:20px;">Top ${Math.min(priorityFixes.length, 5)} fixes for your profile</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${fixItems}</table>
          </td></tr>` : ''}

          <!-- CHROME EXTENSION BLACK CARD -->
          <tr><td style="padding:12px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;border-radius:14px;">
              <tr><td style="padding:24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="top" style="padding-right:16px;">
                      <span style="display:inline-block;padding:5px 11px;background:#7C3AED;color:#FFFFFF;border-radius:6px;font:700 10px/1 -apple-system,'Segoe UI',sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Chrome Extension</span>
                      <div style="font:800 22px/1.2 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;letter-spacing:-0.01em;margin-top:14px;margin-bottom:10px;">Apply to jobs in one click.</div>
                      <div style="font:400 13px/1.55 -apple-system,'Segoe UI',sans-serif;color:#CBD5E1;margin-bottom:18px;">The ProfilleAI extension auto-fills every application form on Greenhouse, Lever, Ashby, Workday and 40+ boards. Resume, cover letter, and every screening question, filled from your profile in seconds.</div>
                      <a href="${escapeGuestReportHtml(withUtm(signupUrl, 'extension_card'))}" style="display:inline-block;padding:11px 18px;background:#FFFFFF;color:#0F172A;text-decoration:none;border-radius:8px;font:700 13px/1 -apple-system,'Segoe UI',sans-serif;">Install the extension &rarr;</a>
                      <div style="font:400 12px/1.5 -apple-system,'Segoe UI',sans-serif;color:#94A3B8;margin-top:12px;">Works with LinkedIn Easy Apply too.</div>
                    </td>
                    <td width="220" valign="top" style="padding-left:8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1E293B;border:1px solid #334155;border-radius:10px;">
                        <tr><td style="padding:16px;">
                          <span style="display:inline-block;padding:4px 10px;background:#7C3AED;color:#FFFFFF;border-radius:5px;font:700 10px/1 -apple-system,'Segoe UI',sans-serif;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px;">Auto-filled</span>
                          <div style="font:600 11px/1 -apple-system,'Segoe UI',sans-serif;color:#94A3B8;margin-top:10px;margin-bottom:3px;">Full name</div>
                          <div style="font:600 13px/1.3 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;">${escapeGuestReportHtml(analysis?.name || 'Your name')}</div>
                          <div style="font:600 11px/1 -apple-system,'Segoe UI',sans-serif;color:#94A3B8;margin-top:14px;margin-bottom:3px;">Resume</div>
                          <div style="font:600 13px/1.3 -apple-system,'Segoe UI',sans-serif;color:#A78BFA;">Resume_${(analysis?.name || 'you').split(' ')[0]}.pdf</div>
                          <div style="font:600 11px/1 -apple-system,'Segoe UI',sans-serif;color:#94A3B8;margin-top:14px;margin-bottom:3px;">Why this role?</div>
                          <div style="font:400 12px/1.4 -apple-system,'Segoe UI',sans-serif;color:#CBD5E1;">Tailored by AI from your profile...</div>
                        </td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- SECTION-BY-SECTION rewrites (first 3 sections only in email; rest is in the app) -->
          ${sectionCards ? `
          <tr><td style="padding:32px 32px 0 32px;">
            <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#6B7280;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;">Section by section</div>
            <div style="font:800 22px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;letter-spacing:-0.01em;margin-bottom:20px;">Paste-ready rewrites</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sectionCards}</table>
          </td></tr>` : ''}

          <!-- FEATURE GRID -->
          <tr><td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding-bottom:24px;">
                <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">Free with your account</div>
                <div style="font:800 22px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;letter-spacing:-0.01em;margin-bottom:10px;">Six ways ProfilleAI accelerates your search</div>
                <div style="font:400 14px/1.55 -apple-system,'Segoe UI',sans-serif;color:#4B5563;max-width:440px;margin:0 auto;">One free account unlocks the tools senior candidates use to fix their profile, tailor every application, and get in front of recruiters faster.</div>
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px;">
              ${featureRows.join('')}
            </table>
          </td></tr>

          <!-- TESTIMONIALS -->
          <tr><td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding-bottom:20px;">
                <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#6B7280;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px;">Loved by candidates</div>
                <div style="font:800 22px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;letter-spacing:-0.01em;">2,400+ users landed roles in 2025</div>
              </td></tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-spacing:8px 0;">
              <tr>
                <td width="50%" valign="top" style="padding:0 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">
                    <tr><td style="padding:20px;">
                      <div style="color:#F59E0B;font-size:14px;letter-spacing:2px;margin-bottom:10px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                      <div style="font:400 13.5px/1.55 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:16px;">The rewrites are what got me the interview. My headline was invisible before ProfilleAI. Two weeks in, I had 5 recruiter InMails.</div>
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td width="32" valign="middle"><div style="width:28px;height:28px;background:#F97316;color:#FFFFFF;border-radius:50%;text-align:center;line-height:28px;font:700 12px/28px -apple-system,sans-serif;">M</div></td>
                        <td valign="middle" style="padding-left:8px;">
                          <div style="font:700 13px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;">Maya P.</div>
                          <div style="font:400 12px/1.3 -apple-system,'Segoe UI',sans-serif;color:#6B7280;">Senior PM, hired at Stripe</div>
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" valign="top" style="padding:0 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;background:#FFFFFF;">
                    <tr><td style="padding:20px;">
                      <div style="color:#F59E0B;font-size:14px;letter-spacing:2px;margin-bottom:10px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                      <div style="font:400 13.5px/1.55 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:16px;">The extension is the reason I applied to 60 roles in a weekend without losing my mind. Resume tailoring per job was the killer feature.</div>
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td width="32" valign="middle"><div style="width:28px;height:28px;background:#7C3AED;color:#FFFFFF;border-radius:50%;text-align:center;line-height:28px;font:700 12px/28px -apple-system,sans-serif;">J</div></td>
                        <td valign="middle" style="padding-left:8px;">
                          <div style="font:700 13px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;">James K.</div>
                          <div style="font:400 12px/1.3 -apple-system,'Segoe UI',sans-serif;color:#6B7280;">Staff Eng, hired at Notion</div>
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- PRIMARY VIOLET CTA -->
          <tr><td style="padding:32px 32px 12px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#7C3AED 0%,#6366F1 100%);border-radius:14px;">
              <tr><td align="center" style="padding:36px 28px 28px 28px;">
                <div style="font:800 24px/1.2 -apple-system,'Segoe UI',sans-serif;color:#FFFFFF;letter-spacing:-0.01em;margin-bottom:10px;">Fix your profile in the next 15 minutes</div>
                <div style="font:400 14px/1.55 -apple-system,'Segoe UI',sans-serif;color:rgba(255,255,255,0.92);margin-bottom:22px;max-width:420px;">Create a free account and start applying the rewrites, tailoring your resume, and browsing matched roles.</div>
                <a href="${escapeGuestReportHtml(withUtm(signupUrl, 'primary_cta'))}" style="display:inline-block;padding:14px 26px;background:#FFFFFF;color:#7C3AED;text-decoration:none;border-radius:10px;font:700 15px/1 -apple-system,'Segoe UI',sans-serif;">Create free account &rarr;</a>
                <div style="font:400 12px/1.5 -apple-system,'Segoe UI',sans-serif;color:rgba(255,255,255,0.85);margin-top:12px;">No credit card. Sign up with Google or LinkedIn.</div>
                <div style="height:1px;background:rgba(255,255,255,0.20);margin:22px 0 14px 0;"></div>
                <div style="font:600 12px/1.4 -apple-system,'Segoe UI',sans-serif;color:rgba(255,255,255,0.90);">2,400+ users &nbsp;|&nbsp; Rated 4.9&#9733; &nbsp;|&nbsp; Chrome Web Store featured</div>
              </td></tr>
            </table>
          </td></tr>

          <!-- HOW IT WORKS -->
          <tr><td style="padding:20px 32px 24px 32px;">
            <div style="font:700 11px/1 -apple-system,'Segoe UI',sans-serif;color:#6B7280;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px;">How ProfilleAI works</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" valign="top" style="padding-right:12px;">
                  <div style="font:800 24px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;margin-bottom:8px;">01</div>
                  <div style="font:700 14px/1.35 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:4px;">Import your resume</div>
                  <div style="font:400 13px/1.5 -apple-system,'Segoe UI',sans-serif;color:#4B5563;">One upload builds your ProfilleAI profile in seconds.</div>
                </td>
                <td width="33%" valign="top" style="padding:0 6px;">
                  <div style="font:800 24px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;margin-bottom:8px;">02</div>
                  <div style="font:700 14px/1.35 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:4px;">Fix your LinkedIn</div>
                  <div style="font:400 13px/1.5 -apple-system,'Segoe UI',sans-serif;color:#4B5563;">Paste the rewrites, add the missing keywords, and analyze again.</div>
                </td>
                <td width="33%" valign="top" style="padding-left:12px;">
                  <div style="font:800 24px/1 -apple-system,'Segoe UI',sans-serif;color:#7C3AED;margin-bottom:8px;">03</div>
                  <div style="font:700 14px/1.35 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:4px;">Apply with the extension</div>
                  <div style="font:400 13px/1.5 -apple-system,'Segoe UI',sans-serif;color:#4B5563;">Auto-fill forms with a tailored resume and cover letter.</div>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- FOOTER -->
          <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E7EB;">
            <div style="font:700 14px/1.2 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:10px;">ProfilleAI</div>
            <div style="font:400 12px/1.55 -apple-system,'Segoe UI',sans-serif;color:#6B7280;margin-bottom:10px;">
              You received this because you asked for a LinkedIn profile report at <a href="${escapeGuestReportHtml(profileUrl || '')}" style="color:#7C3AED;text-decoration:none;">${escapeGuestReportHtml((profileUrl || '').replace(/^https?:\/\//, ''))}</a>. We don't post anything to LinkedIn and don't store your profile data beyond this report.
            </div>
            <div style="font:600 12px/1.4 -apple-system,'Segoe UI',sans-serif;color:#111827;margin-bottom:8px;">
              <a href="${escapeGuestReportHtml(unsubscribeUrl)}" style="color:#111827;text-decoration:underline;">Unsubscribe</a>
              <span style="color:#D1D5DB;margin:0 6px;">&middot;</span>
              <a href="https://www.profilleai.com/privacy" style="color:#111827;text-decoration:underline;">Privacy</a>
              <span style="color:#D1D5DB;margin:0 6px;">&middot;</span>
              <a href="https://www.profilleai.com/contact" style="color:#111827;text-decoration:underline;">Contact us</a>
            </div>
          </td></tr>

        </table>
        <div style="max-width:640px;margin:14px auto 0;font:400 11px/1.4 -apple-system,'Segoe UI',sans-serif;color:#9CA3AF;text-align:center;">&copy; ${new Date().getFullYear()} ProfilleAI</div>
      </td></tr>
    </table>
  </body>
</html>`;

  const textLines = [
    `Your LinkedIn scored ${overall}/100 for ${roleLabel}`,
    ``,
    `Overall: ${overall}/100 | Recruiter fit: ${fit}/100 | Search visibility: ${search}/100`,
    `Recruiter verdict: ${verdictLabel}`,
    ``,
    summary,
    ``,
    priorityFixes.length ? `TOP ${Math.min(priorityFixes.length, 5)} FIXES FOR YOUR PROFILE:` : '',
    ...priorityFixes.slice(0, 5).map((f, i) => `  ${String(i + 1).padStart(2, '0')}. ${f}`),
    ``,
    sections.slice(0, 3).map((s) => {
      const rewrite = s?.suggestion ? `\n\nPaste-ready rewrite:\n${s.suggestion}` : '';
      const findings = Array.isArray(s?.findings) && s.findings.length
        ? '\n' + s.findings.map((f) => `  - ${f}`).join('\n')
        : '';
      return `${(s?.name || '').toUpperCase()} (${Number(s?.score) || 0}/100)${findings}${rewrite}`;
    }).join('\n\n'),
    ``,
    `----`,
    `Fix your profile in the next 15 minutes.`,
    `Create a free account: ${withUtm(signupUrl, 'text_cta')}`,
    ``,
    `Install the Chrome extension: ${withUtm(signupUrl, 'text_extension')}`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter(Boolean);

  return {
    subject: `Your LinkedIn scored ${overall}/100 · ${(priorityFixes.length || 5) >= 1 ? `${Math.min(priorityFixes.length || 5, 5)} ${(Math.min(priorityFixes.length || 5, 5) === 1 ? 'fix' : 'fixes')}` : '5 fixes'} and paste-ready rewrites inside`,
    html,
    text: textLines.join('\n'),
  };
};

const sendGuestLinkedInReport = async ({ email, analysis, targetTitle, profileUrl, signupUrl, unsubscribeUrl }) => {
  const { subject, html, text } = buildGuestReportEmail({
    analysis,
    targetTitle,
    profileUrl,
    signupUrl,
    unsubscribeUrl,
  });
  return sendEmail({ to: email, subject, html, text });
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
  sendSupportTicketConfirmation,
  sendSupportReplyToUser,
  sendGuestLinkedInReport,
};
