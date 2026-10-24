/**
 * Profile Reminder Service
 *
 * Someone who signs up without going through the coach lands on the
 * dashboard's start screen. Most who leave from there never come back on
 * their own, so a day later they get one email pointing at the coach.
 *
 * One email, ever. Users.profileReminderSentAt is claimed before sending, so
 * overlapping runs cannot double-send, and it is never cleared after a send.
 *
 * Eligible = candidate, active, email verified, not opted out of emails,
 * signed up between 1 and 7 days ago, and still no profile. The 7-day cap
 * means the first run after deploy does not email the whole back catalogue.
 * Unverified addresses are skipped: they may be typos or someone else's
 * address, and mail to them hurts deliverability for everything else.
 */

const { Op } = require('sequelize');
const { User, Profile, sequelize } = require('../models');
const emailService = require('./emailService');
const { signUnsubscribeToken } = require('./jobDigestService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const HOUR = 60 * 60 * 1000;
const MIN_AGE_HOURS = 24;
const MAX_AGE_DAYS = 7;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function coachUrl() {
  // Through /login so a signed-out click still ends up in their own account;
  // a signed-in visitor is forwarded straight on.
  return `${FRONTEND_URL}/login?redirect=${encodeURIComponent('/profile/create')}&utm_source=profile_reminder`;
}

function unsubscribeUrl(userId) {
  return `${FRONTEND_URL}/api/external-jobs/digest/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(userId))}`;
}

function renderHtml(user) {
  const firstName = escapeHtml(user.firstName || 'there');
  const url = coachUrl();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:20px 24px;border-bottom:1px solid #EEF0F4;">
          <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.5px;">profile<span style="color:#4F46E5;">ai</span></span>
        </td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#111827;line-height:1.3;">Your profile is a few minutes away, ${firstName}.</h1>
          <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">
            You signed up yesterday but have not built your profile yet. It is what gets you matched to jobs and lets you apply.
          </p>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">
            Pick whichever is easiest: upload a resume if you have one, talk it through on a short call, or answer a few questions in chat.
          </p>
        </td></tr>
        <tr><td style="padding:20px 24px 28px 24px;">
          <a href="${url}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">Build my profile</a>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:18px 24px;border-top:1px solid #EEF0F4;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9CA3AF;">
            This is the only reminder we will send about it.<br>
            548 Market Street, San Francisco, CA 94104
          </p>
          <p style="margin:8px 0 0 0;font-size:12px;">
            <a href="${unsubscribeUrl(user.id)}" style="color:#6B7280;text-decoration:none;">Unsubscribe from emails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(user) {
  return [
    `Hi ${user.firstName || 'there'},`,
    '',
    'You signed up yesterday but have not built your profile yet. It is what gets you matched to jobs and lets you apply.',
    '',
    'Pick whichever is easiest: upload a resume if you have one, talk it through on a short call, or answer a few questions in chat.',
    '',
    `Build my profile: ${coachUrl()}`,
    '',
    'This is the only reminder we will send about it.',
    `Unsubscribe: ${unsubscribeUrl(user.id)}`,
  ].join('\n');
}

/**
 * Claim the reminder for this user. Returns true only for the run that set
 * the timestamp, so two overlapping runs cannot both send.
 */
async function claim(userId) {
  const [, meta] = await sequelize.query(
    `UPDATE "Users" SET "profileReminderSentAt" = NOW()
     WHERE id = :userId AND "profileReminderSentAt" IS NULL`,
    { replacements: { userId } }
  );
  return (meta?.rowCount ?? meta) > 0;
}

async function release(userId) {
  await User.update({ profileReminderSentAt: null }, { where: { id: userId } });
}

async function runProfileReminders({ limit = 200 } = {}) {
  const now = Date.now();
  const users = await User.findAll({
    where: {
      role: 'candidate',
      isActive: true,
      emailVerified: true,
      jobDigestOptOut: false,
      profileReminderSentAt: null,
      createdAt: {
        [Op.lte]: new Date(now - MIN_AGE_HOURS * HOUR),
        [Op.gte]: new Date(now - MAX_AGE_DAYS * 24 * HOUR),
      },
      '$profile.id$': null,
    },
    attributes: ['id', 'email', 'firstName'],
    include: [{ model: Profile, as: 'profile', required: false, attributes: [] }],
    limit,
    subQuery: false,
  });

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      if (!(await claim(user.id))) continue;
      const ok = await emailService.sendEmail({
        to: user.email,
        subject: `Your profile is a few minutes away, ${user.firstName || 'there'}`,
        html: renderHtml(user),
        text: renderText(user),
      });
      if (ok) {
        sent++;
      } else {
        // Provider refused it; let the next run try again.
        failed++;
        await release(user.id);
      }
    } catch (err) {
      failed++;
      console.error(`[ProfileReminder] Failed for ${user.id}:`, err.message);
      await release(user.id).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (users.length) {
    console.log(`[ProfileReminder] eligible=${users.length} sent=${sent} failed=${failed}`);
  }
  return { eligible: users.length, sent, failed };
}

module.exports = { runProfileReminders };
