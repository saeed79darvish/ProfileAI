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
  const metaParts = [job.company, job.location, job.postedAgo].filter(Boolean).map(escapeHtml).join(' · ');
  const delta = job.tailoredScore - job.nowScore;
  const deltaStr = delta > 0 ? `+${delta}` : String(delta);
  const progressPct = Math.min(100, Math.max(0, job.tailoredScore));

  const allSkills = [...job.present, ...job.missing].slice(0, 5);
  const skillChips = allSkills
    .map(k => `<span style="display:inline-block;background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;border-radius:6px;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0;">${escapeHtml(k)}</span>`)
    .join('');

  const tailorUrl = `${FRONTEND_URL}/jobs?externalJobId=${encodeURIComponent(job.id)}&tailor=1&utm_source=daily_digest`;
  const viewUrl = `${FRONTEND_URL}/jobs?externalJobId=${encodeURIComponent(job.id)}&utm_source=daily_digest`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;margin:0 0 16px 0;overflow:hidden;">
    <tr><td style="padding:16px 18px 18px 18px;">
      <!-- Company logo + title -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="40" valign="top">
            <div style="width:40px;height:40px;border-radius:9px;background:${color};color:#fff;font-weight:700;font-size:17px;line-height:40px;text-align:center;">${initial}</div>
          </td>
          <td valign="top" style="padding-left:12px;">
            <div style="font-size:16px;font-weight:700;color:#111827;line-height:1.3;">${escapeHtml(job.title)}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:3px;">${metaParts}</div>
          </td>
        </tr>
      </table>
      <!-- Inline score -->
      <div style="margin-top:12px;font-size:13px;color:#6B7280;">
        Match <span style="font-weight:600;color:#374151;">${job.nowScore}%</span>
        &nbsp;&rarr;&nbsp;
        <span style="font-weight:700;color:#059669;">${job.tailoredScore}% after tailoring</span>
        <span style="color:#059669;font-weight:600;">(${deltaStr})</span>
      </div>
      <!-- Progress bar -->
      <div style="margin-top:7px;background:#E5E7EB;border-radius:999px;height:6px;overflow:hidden;">
        <div style="background:#059669;width:${progressPct}%;height:6px;border-radius:999px;"></div>
      </div>
      <!-- Skill chips -->
      ${skillChips ? `<div style="margin-top:12px;">${skillChips}</div>` : ''}
      <!-- Actions -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
        <tr>
          <td>
            <a href="${tailorUrl}" style="display:block;background:#4F46E5;color:#fff;text-decoration:none;text-align:center;font-weight:600;font-size:14px;padding:11px 16px;border-radius:8px;">Tailor &amp; apply</a>
          </td>
          <td width="16"></td>
          <td width="90" valign="middle" align="right">
            <a href="${viewUrl}" style="color:#6B7280;text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;">View job &rarr;</a>
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

  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const now = new Date();
  const digestDate = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const matchCount = matches.length;
  const matchWord = matchCount >= 0 && matchCount <= 10 ? WORDS[matchCount] : String(matchCount);
  const scannedFormatted = jobsScanned.toLocaleString('en-US');

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 480px) {
      .email-body { padding: 0 !important; }
      .email-container { border-radius: 0 !important; }
      .stat-cell { display: block !important; width: 100% !important; border-right: none !important; border-bottom: 1px solid #EEF0F4 !important; }
      .stat-cell:last-child { border-bottom: none !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
    <tr><td align="center">
      <table class="email-container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">

        <!-- Header bar -->
        <tr><td style="padding:20px 24px;border-bottom:1px solid #EEF0F4;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.5px;">profile<span style="color:#4F46E5;">ai</span></span>
              </td>
              <td align="right">
                <span style="font-size:11px;font-weight:600;letter-spacing:1.5px;color:#9CA3AF;text-transform:uppercase;">ApplyPilot Digest</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:28px 24px 20px 24px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#4F46E5;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(String(matchCount))} new matches &middot; ${escapeHtml(digestDate)}</div>
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#111827;line-height:1.25;">${matchWord} role${matchCount === 1 ? '' : 's'} match your profile, ${firstName}.</h1>
          <p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#374151;">
            We read through <strong>${scannedFormatted} postings</strong> overnight and found ${matchCount} worth your time. Each one shows your match score today, and where a two-minute tailor would take it.
          </p>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:0 24px 20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EEF0F4;border-radius:10px;">
            <tr>
              <td class="stat-cell" align="center" style="padding:16px 8px;border-right:1px solid #EEF0F4;">
                <div style="font-size:24px;font-weight:700;color:#111827;">${scannedFormatted}</div>
                <div style="font-size:10px;letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;margin-top:3px;">Scanned</div>
              </td>
              <td class="stat-cell" align="center" style="padding:16px 8px;border-right:1px solid #EEF0F4;">
                <div style="font-size:24px;font-weight:700;color:#111827;">${matchCount}</div>
                <div style="font-size:10px;letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;margin-top:3px;">Matched</div>
              </td>
              <td class="stat-cell" align="center" style="padding:16px 8px;">
                <div style="font-size:24px;font-weight:700;color:#111827;">2 min</div>
                <div style="font-size:10px;letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;margin-top:3px;">To Apply</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ATS callout -->
        <tr><td style="padding:0 24px 20px 24px;">
          <div style="border-left:4px solid #4F46E5;padding:12px 16px;background:#F9FAFB;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#374151;">
            Roughly <strong>three in four r&eacute;sum&eacute;s</strong> are filtered out by applicant-tracking software before a person ever reads them. Your match score tracks how well you line up with each posting&#39;s keywords &mdash; clearing <strong>80%</strong> is what gets you past the filter.
          </div>
        </td></tr>

        <!-- Section label -->
        <tr><td style="padding:4px 24px 12px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#9CA3AF;text-transform:uppercase;">Your Matches</td>
              <td align="right" style="font-size:11px;color:#9CA3AF;">today &rarr; tailored</td>
            </tr>
          </table>
        </td></tr>

        <!-- Job cards -->
        <tr><td style="padding:0 24px 8px 24px;">
          ${matches.map(renderJobCard).join('')}
        </td></tr>

        <!-- See all link -->
        <tr><td style="padding:0 24px 24px 24px;" align="center">
          <a href="${allMatchesUrl}" style="color:#4F46E5;text-decoration:none;font-weight:600;font-size:14px;">See all ${matchCount} matches in ApplyPilot &rarr;</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:22px 24px;border-top:1px solid #EEF0F4;">
          <div style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.5px;">profile<span style="color:#4F46E5;">ai</span></div>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#9CA3AF;">
            You&#39;re receiving this because ApplyPilot is on for your search.<br>
            548 Market Street, San Francisco, CA 94104
          </p>
          <p style="margin:10px 0 0 0;font-size:12px;color:#9CA3AF;">
            <a href="${prefsUrl}" style="color:#6B7280;text-decoration:none;">Match settings</a>
            &nbsp;&middot;&nbsp;
            <a href="${prefsUrl}" style="color:#6B7280;text-decoration:none;">Pause emails</a>
            &nbsp;&middot;&nbsp;
            <a href="${unsubUrl}" style="color:#6B7280;text-decoration:none;">Unsubscribe</a>
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
