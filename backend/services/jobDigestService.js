/**
 * Daily Job-Match Digest Service
 *
 * Sends each candidate a once-a-day email containing the best ~10 external
 * jobs matched against their profile. The goal is re-engagement: show the
 * candidate their current match score per role, the keywords they're missing,
 * and how much AI resume tailoring would lift their score — then drive them
 * back to ProfilleAI to tailor & apply.
 *
 * Matching reuses the same keyword ranking the live /external-jobs feed uses
 * (jobRelevanceService.rankJobs), so the email and the site agree on scores.
 */

const crypto = require('crypto');
const { Op, literal } = require('sequelize');
const { User, Profile, ExternalJob, Company } = require('../models');
const { rankJobs } = require('./jobRelevanceService');
const emailService = require('./emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Only surface jobs that clear a minimum match so the email feels relevant.
// Title is the dominant signal (see jobRelevanceService.scoreJob), so we set
// a meaningful overall floor AND a hard title floor below — a job must be a
// real role-type match, not just a keyword-overlap coincidence.
const MIN_RELEVANCE = 50;
const MIN_TITLE_MATCH = 12; // out of 45 — requires genuine role/title overlap
const MAX_JOBS = 10;
// How far back to pull the candidate pool from (days).
const POOL_WINDOW_DAYS = 30;
const POOL_SIZE = 400;

/* ------------------------------------------------------------------ */
/* Unsubscribe token (stateless, signed with JWT_SECRET)               */
/* ------------------------------------------------------------------ */

function signUnsubscribeToken(userId) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const payload = Buffer.from(JSON.stringify({ uid: userId, t: 'jobdigest' })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyUnsubscribeToken(token) {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    // Constant-time compare
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.t !== 'jobdigest' || !data.uid) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toTitleCase(s) {
  return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(date) {
  const t = date ? new Date(date).getTime() : 0;
  if (!t) return 'recently';
  const diff = Date.now() - t;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return 'a while ago';
}

function formatSalary(job) {
  const { salaryMin, salaryMax, salaryCurrency } = job;
  if (!salaryMin && !salaryMax) return null;
  const sym = salaryCurrency === 'USD' || !salaryCurrency ? '$' : `${salaryCurrency} `;
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (salaryMin && salaryMax) return `${sym}${k(salaryMin)}–${sym}${k(salaryMax)}`;
  return `${sym}${k(salaryMin || salaryMax)}`;
}

// Deterministic accent color for a company's logo tile.
function companyColor(name) {
  const palette = ['#2563EB', '#0EA5E9', '#7C3AED', '#DB2777', '#059669', '#D97706', '#DC2626', '#4F46E5'];
  let h = 0;
  for (const ch of String(name || 'A')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function extractProfileSkillSet(profile) {
  const out = new Set();
  const raw = profile.skills;
  if (!raw) return out;
  const add = (s) => {
    const v = (typeof s === 'string' ? s : (s && s.name) || '').toLowerCase().trim();
    if (v) out.add(v);
  };
  if (Array.isArray(raw)) raw.forEach(add);
  else if (typeof raw === 'object') Object.values(raw).forEach(arr => Array.isArray(arr) && arr.forEach(add));
  return out;
}

/**
 * Estimate the tailored match score — how high we expect the candidate's
 * score to climb after AI adds the missing (but safe/additive) keywords.
 * Heuristic, deterministic, capped so we never over-promise.
 */
function estimateTailoredScore(nowScore, missingCount) {
  const headroom = 95 - nowScore;
  // Each missing keyword we can add recovers some of the gap.
  const boost = Math.min(headroom, Math.max(12, missingCount * 9 + 14));
  return Math.min(94, Math.round(nowScore + boost));
}

/**
 * Build the matched-jobs payload for a single profile.
 * Returns { matches, jobsScanned }.
 */
async function buildMatchesForProfile(profile) {
  const since = new Date(Date.now() - POOL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const jobsScanned = await ExternalJob.count({
    where: {
      isActive: true,
      [Op.or]: [
        { postedAt: { [Op.gte]: since } },
        { postedAt: null, createdAt: { [Op.gte]: since } },
      ],
    },
  });

  const pool = await ExternalJob.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { postedAt: { [Op.gte]: since } },
        { postedAt: null, createdAt: { [Op.gte]: since } },
      ],
    },
    order: [literal('COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") DESC NULLS LAST')],
    limit: POOL_SIZE,
    attributes: { exclude: ['descriptionHtml', 'metadata', 'embedding'] },
    include: [{
      model: Company,
      as: 'companyInfo',
      attributes: ['id', 'name', 'slug', 'domain', 'logoUrl'],
    }],
  });

  if (pool.length === 0) return { matches: [], jobsScanned };

  const ranked = rankJobs(pool, profile, { sortMode: 'match' });
  const profileSkills = extractProfileSkillSet(profile);

  const matches = ranked
    .filter(j => (j.relevanceScore || 0) >= MIN_RELEVANCE && (j.titleMatch || 0) >= MIN_TITLE_MATCH)
    .slice(0, MAX_JOBS)
    .map(job => {
      const jobSkills = Array.isArray(job.skills)
        ? job.skills.map(s => String(s).toLowerCase().trim()).filter(Boolean)
        : [];
      const present = [];
      const missing = [];
      for (const s of jobSkills) {
        if (profileSkills.has(s) || [...profileSkills].some(ps => ps.includes(s) || s.includes(ps))) {
          present.push(s);
        } else {
          missing.push(s);
        }
      }
      // Fall back to matchedSkills from the ranker when the job has no skills array.
      if (present.length === 0 && Array.isArray(job.matchedSkills)) {
        for (const s of job.matchedSkills) present.push(String(s).toLowerCase());
      }
      const nowScore = Math.round(job.relevanceScore || 0);
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        locationType: job.locationType,
        employmentType: job.employmentType,
        salary: formatSalary(job),
        postedAgo: timeAgo(job.postedAt || job.createdAt),
        applyUrl: job.applyUrl,
        logoUrl: job.companyInfo && job.companyInfo.logoUrl,
        present: [...new Set(present)].slice(0, 4).map(toTitleCase),
        missing: [...new Set(missing)].slice(0, 4).map(toTitleCase),
        nowScore,
        tailoredScore: estimateTailoredScore(nowScore, missing.length),
      };
    });

  return { matches, jobsScanned };
}

/* ------------------------------------------------------------------ */
/* HTML template                                                       */
/* ------------------------------------------------------------------ */

function scoreColor(score) {
  if (score >= 80) return '#059669';
  if (score >= 55) return '#D97706';
  return '#DC2626';
}

function renderJobCard(job) {
  const initial = escapeHtml((job.company || '?').trim().charAt(0).toUpperCase());
  const color = companyColor(job.company);
  const metaParts = [job.company, job.location].filter(Boolean).map(escapeHtml).join(' · ');
  const subParts = [
    job.employmentType ? toTitleCase(job.employmentType) : null,
    job.salary,
    job.postedAgo ? `Posted ${job.postedAgo}` : null,
  ].filter(Boolean).map(escapeHtml).join('  ·  ');

  const presentChips = job.present.map(k =>
    `<span style="display:inline-block;background:#ECFDF5;color:#047857;border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">&#10003; ${escapeHtml(k)}</span>`
  ).join('');
  const missingChips = job.missing.map(k =>
    `<span style="display:inline-block;background:#FEF2F2;color:#B91C1C;border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">&#10005; ${escapeHtml(k)}</span>`
  ).join('');

  const tailorUrl = `${FRONTEND_URL}/jobs?externalJobId=${encodeURIComponent(job.id)}&tailor=1&utm_source=daily_digest`;
  const viewUrl = `${FRONTEND_URL}/jobs?externalJobId=${encodeURIComponent(job.id)}&utm_source=daily_digest`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;margin:0 0 16px 0;">
    <tr><td style="padding:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48" valign="top">
            <div style="width:44px;height:44px;border-radius:10px;background:${color};color:#fff;font-weight:700;font-size:18px;line-height:44px;text-align:center;">${initial}</div>
          </td>
          <td valign="top" style="padding-left:12px;">
            <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(job.title)}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:2px;">${metaParts}</div>
            <div style="font-size:12px;color:#9CA3AF;margin-top:2px;">${subParts}</div>
          </td>
          <td valign="top" align="right" width="150">
            <table role="presentation" cellpadding="0" cellspacing="0" align="right">
              <tr>
                <td style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:6px 10px;text-align:center;">
                  <div style="font-size:16px;font-weight:700;color:${scoreColor(job.nowScore)};">${job.nowScore}%</div>
                  <div style="font-size:9px;letter-spacing:.5px;color:#9CA3AF;">NOW</div>
                </td>
                <td style="padding:0 6px;color:#9CA3AF;">&#8594;</td>
                <td style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:6px 10px;text-align:center;">
                  <div style="font-size:16px;font-weight:700;color:#059669;">${job.tailoredScore}%</div>
                  <div style="font-size:9px;letter-spacing:.5px;color:#9CA3AF;">TAILORED</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${(presentChips || missingChips) ? `<div style="margin-top:12px;">${presentChips}${missingChips}</div>` : ''}

      ${job.missing.length > 0 ? `
      <div style="background:#EEF2FF;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:13px;color:#4338CA;">
        &#10024; AI can add the missing keywords to your profile — safe, additive edits only. No fabrication.
      </div>` : ''}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
        <tr>
          <td>
            <a href="${tailorUrl}" style="display:block;background:#4F46E5;color:#fff;text-decoration:none;text-align:center;font-weight:600;font-size:14px;padding:12px;border-radius:8px;">&#10024; Tailor Resume to Boost Score</a>
          </td>
          <td width="12"></td>
          <td width="110">
            <a href="${viewUrl}" style="display:block;border:1px solid #C7D2FE;color:#4F46E5;text-decoration:none;text-align:center;font-weight:600;font-size:14px;padding:12px;border-radius:8px;">View Job</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

function renderDigestHtml({ user, matches, jobsScanned }) {
  const firstName = escapeHtml(user.firstName || 'there');
  const unsubUrl = `${FRONTEND_URL}/api/external-jobs/digest/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(user.id))}`;
  const allMatchesUrl = `${FRONTEND_URL}/jobs?utm_source=daily_digest`;
  const prefsUrl = `${FRONTEND_URL}/settings?utm_source=daily_digest`;

  const stat = (value, label) =>
    `<td align="center" style="padding:14px 8px;border-right:1px solid #EEF0F4;">
       <div style="font-size:20px;font-weight:700;color:#4F46E5;">${escapeHtml(value)}</div>
       <div style="font-size:11px;color:#6B7280;margin-top:2px;">${escapeHtml(label)}</div>
     </td>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:28px;text-align:center;">
          <div style="color:#fff;font-size:20px;font-weight:700;">&#128142; ProfilleAI</div>
          <div style="color:#C7D2FE;font-size:13px;margin-top:4px;">Your AI-powered job match engine</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 28px 8px 28px;">
          <h1 style="margin:0;font-size:22px;color:#111827;">Hi ${firstName} &#128075;</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">
            We scanned <strong>${jobsScanned} postings</strong> and found
            <strong>${matches.length} role${matches.length === 1 ? '' : 's'} that match your profile</strong>.
            See your current match score for each — then tailor your resume with AI to maximize your shot
            at landing a human reviewer.
          </p>
        </td></tr>

        <!-- ATS callout -->
        <tr><td style="padding:18px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;">
            <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#92400E;">
              <strong>&#9889; Most applications never reach a human reviewer.</strong> ATS systems filter out
              ~75% of resumes before anyone reads them. Your match score shows how well your profile aligns
              with each job's keywords — tailoring it above 80% puts you in the zone where applications get through.
            </td></tr>
          </table>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:18px 28px 4px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EEF0F4;border-radius:10px;">
            <tr>
              ${stat(String(jobsScanned), 'Jobs scanned')}
              ${stat(String(matches.length), 'Matches found')}
              ${stat('75%', 'ATS rejection rate')}
              <td align="center" style="padding:14px 8px;">
                <div style="font-size:20px;font-weight:700;color:#4F46E5;">&lt; 2 min</div>
                <div style="font-size:11px;color:#6B7280;margin-top:2px;">To tailor &amp; apply</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Section label -->
        <tr><td style="padding:22px 28px 10px 28px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;">
            Your matches — current score &#8594; after tailoring
          </div>
        </td></tr>

        <!-- Job cards -->
        <tr><td style="padding:0 28px 8px 28px;">
          ${matches.map(renderJobCard).join('')}
        </td></tr>

        <!-- CTA to all matches -->
        <tr><td style="padding:8px 28px 24px 28px;" align="center">
          <a href="${allMatchesUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">View all matches on ProfilleAI</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:22px 28px;border-top:1px solid #EEF0F4;">
          <div style="font-size:13px;font-weight:700;color:#4F46E5;">&#128142; ProfilleAI</div>
          <p style="margin:8px 0 0 0;font-size:11px;line-height:1.6;color:#9CA3AF;">
            You're receiving this because you enabled job alerts. Scores are calculated by comparing your
            current profile against each job's listed requirements.
          </p>
          <p style="margin:10px 0 0 0;font-size:11px;color:#9CA3AF;">
            <a href="${prefsUrl}" style="color:#6B7280;">Update preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${allMatchesUrl}" style="color:#6B7280;">View all matches</a>
            &nbsp;&middot;&nbsp;
            <a href="${unsubUrl}" style="color:#6B7280;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderDigestText({ user, matches, jobsScanned }) {
  const lines = [];
  lines.push(`Hi ${user.firstName || 'there'},`);
  lines.push('');
  lines.push(`We scanned ${jobsScanned} postings and found ${matches.length} roles that match your profile.`);
  lines.push('');
  matches.forEach((j, i) => {
    lines.push(`${i + 1}. ${j.title} — ${j.company}${j.location ? ` (${j.location})` : ''}`);
    lines.push(`   Match now: ${j.nowScore}% → after tailoring: ${j.tailoredScore}%`);
    if (j.missing.length) lines.push(`   Missing keywords: ${j.missing.join(', ')}`);
    lines.push(`   Tailor & apply: ${FRONTEND_URL}/jobs?externalJobId=${j.id}&tailor=1`);
    lines.push('');
  });
  lines.push(`View all matches: ${FRONTEND_URL}/jobs`);
  lines.push('');
  lines.push('— The ProfilleAI Team');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

/**
 * Build & send the digest to a single user. Returns true if an email was sent.
 * Skips silently (returns false) if the user has no profile or no matches.
 */
async function sendDigestToUser(user) {
  const profile = user.profile || await Profile.findOne({ where: { userId: user.id } });
  if (!profile) return false;

  const { matches, jobsScanned } = await buildMatchesForProfile(profile);
  if (matches.length === 0) return false;

  const subject = `${matches.length} new job match${matches.length === 1 ? '' : 'es'} for you, ${user.firstName || 'there'} — tailor & apply in 2 min`;
  const html = renderDigestHtml({ user, matches, jobsScanned });
  const text = renderDigestText({ user, matches, jobsScanned });

  const ok = await emailService.sendEmail({ to: user.email, subject, html, text });
  if (ok) console.log(`[JobDigest] Sent ${matches.length} matches to ${user.email}`);
  return ok;
}

/**
 * Run the daily digest for all eligible candidates.
 * Eligible = role 'candidate', email verified, opted in, account active.
 */
async function runDailyJobDigest({ limit = null } = {}) {
  console.log('[JobDigest] Starting daily job-match digest run...');

  const where = {
    role: 'candidate',
    emailVerified: true,
    jobDigestOptOut: false,
    isActive: true,
  };

  const users = await User.findAll({
    where,
    attributes: ['id', 'email', 'firstName', 'lastName'],
    include: [{ model: Profile, as: 'profile', required: true }],
    ...(limit ? { limit } : {}),
  });

  console.log(`[JobDigest] ${users.length} eligible candidate(s).`);

  let sent = 0, skipped = 0, failed = 0;
  for (const user of users) {
    try {
      const ok = await sendDigestToUser(user);
      if (ok) sent++; else skipped++;
    } catch (err) {
      failed++;
      console.error(`[JobDigest] Failed for ${user.email}:`, err.message);
    }
    // Gentle pacing so we don't hammer the email provider's rate limit.
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[JobDigest] Done. sent=${sent} skipped=${skipped} failed=${failed}`);
  return { eligible: users.length, sent, skipped, failed };
}

module.exports = {
  runDailyJobDigest,
  sendDigestToUser,
  buildMatchesForProfile,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
};
