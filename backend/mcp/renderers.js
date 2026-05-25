/**
 * Markdown renderers for the Claude MCP connector.
 *
 * Every tool response includes ProfilleAI branding (logo) plus a guide
 * pointing the user at our differentiators (AI Tailoring + Chrome
 * Extension) so Claude\u2019s rendered cards drive traffic back to the
 * platform.
 */

const BASE_URL = process.env.PUBLIC_APP_URL || 'https://profileai.pro';
const LOGO_URL =
  process.env.PUBLIC_LOGO_URL ||
  'https://profileai.pro/logo.png';
const CHROME_EXTENSION_URL =
  process.env.PUBLIC_CHROME_EXTENSION_URL ||
  'https://chromewebstore.google.com/detail/profileai';

const UTM = 'utm_source=claude&utm_medium=mcp&utm_campaign=connector';

function withUtm(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE_URL}${path}${sep}${UTM}`;
}

function jobUrl(id) {
  return withUtm(`/jobs/${id}`);
}
function profileUrl(idOrSlug) {
  return withUtm(`/profile/${idOrSlug}`);
}
function conversationUrl(id) {
  return withUtm(`/messages/${id}`);
}
function jobSearchUrl(query) {
  return withUtm(`/jobs?search=${encodeURIComponent(query || '')}`);
}

function relativeTime(date) {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} weeks ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} months ago`;
  return `${Math.floor(diff / (365 * day))} years ago`;
}

function formatSalary(job) {
  if (!job.salaryMin && !job.salaryMax) return '';
  const cur = job.salaryCurrency || 'USD';
  const period = job.salaryPeriod || 'yearly';
  const fmt = (n) => new Intl.NumberFormat('en-US').format(n);
  if (job.salaryMin && job.salaryMax) {
    return `${cur} ${fmt(job.salaryMin)}\u2013${fmt(job.salaryMax)} ${period}`;
  }
  return `${cur} ${fmt(job.salaryMin || job.salaryMax)} ${period}`;
}

function topSkills(skills, n = 5) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.slice(0, n);
  // Profile skills can arrive as { technical: [...], soft: [...] }
  if (typeof skills === 'object') {
    return Object.values(skills).flat().map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean).slice(0, n);
  }
  return [];
}

function header(title, tip) {
  return [
    `![ProfilleAI](${LOGO_URL})`,
    `**ProfilleAI \u2014 ${title}**`,
    '',
    tip ? `\ud83d\udca1 ${tip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function footer(extraLines = []) {
  return [
    '---',
    `\ud83e\udd1d **Tailor your resume with AI** \u2014 every job on ProfilleAI offers one-click AI Resume Tailoring.`,
    `\ud83e\udde9 **Auto-apply across the web** with the [ProfilleAI Chrome Extension](${CHROME_EXTENSION_URL}).`,
    ...extraLines,
  ].join('\n');
}

/** Top-of-response banner for job search results. */
function renderJobsHeader(query, count) {
  return header(
    count === 0
      ? `No jobs found for \u201c${query}\u201d`
      : `${count} job${count === 1 ? '' : 's'} matching \u201c${query}\u201d`,
    'Open any job on ProfilleAI for one-click **AI Resume Tailoring**, or install the **Chrome Extension** to auto-apply.',
  );
}

/** A compact card per job for the search-results list. */
function renderJobCard(job) {
  const recruiter = job.recruiter || {};
  const recruiterProfile = recruiter.recruiterProfile || {};
  const companyName = job.company || recruiterProfile.companyName || 'Unknown company';
  const skills = topSkills(job.skills, 3);
  const lines = [
    `### [${job.title}](${jobUrl(job.id)})`,
    `\ud83c\udfe2 **${companyName}** \u00b7 \ud83d\udccd ${job.location || 'Location N/A'}${
      job.locationType ? ` (${job.locationType})` : ''
    } \u00b7 \ud83d\udd52 Posted ${relativeTime(job.createdAt)}`,
  ];
  const salary = formatSalary(job);
  if (salary) lines.push(`\ud83d\udcb0 ${salary}`);
  if (job.employmentType || job.experienceLevel) {
    lines.push(
      `\ud83d\udcbc ${[job.employmentType, job.experienceLevel].filter(Boolean).join(' \u00b7 ')}`,
    );
  }
  if (skills.length) lines.push(`\ud83d\udd16 ${skills.join(' \u00b7 ')}`);
  if (job.description) {
    const snippet = String(job.description).replace(/\s+/g, ' ').slice(0, 180);
    lines.push(`> ${snippet}${snippet.length === 180 ? '\u2026' : ''}`);
  }
  lines.push(`[Apply on ProfilleAI \u2192](${jobUrl(job.id)})`);
  return lines.join('\n');
}

function renderJobsListMarkdown(query, jobs) {
  const parts = [renderJobsHeader(query, jobs.length)];
  if (jobs.length === 0) {
    parts.push(
      `Try a broader keyword or fewer filters. You can also [browse all jobs on ProfilleAI](${jobSearchUrl(query)}).`,
    );
    parts.push(footer());
    return parts.join('\n\n');
  }
  for (const job of jobs) parts.push(renderJobCard(job));
  parts.push(footer([`\ud83d\udd0d [See all results on ProfilleAI](${jobSearchUrl(query)})`]));
  return parts.join('\n\n');
}

/** Full job detail page. */
function renderJobDetailMarkdown(job) {
  const recruiter = job.recruiter || {};
  const recruiterProfile = recruiter.recruiterProfile || {};
  const companyName = job.company || recruiterProfile.companyName || 'Unknown company';
  const skills = topSkills(job.skills, 12);

  const head = [
    `![ProfilleAI](${LOGO_URL})`,
    `# [${job.title}](${jobUrl(job.id)})`,
    `\ud83c\udfe2 **${companyName}** \u00b7 \ud83d\udccd ${job.location || 'Location N/A'}${
      job.locationType ? ` (${job.locationType})` : ''
    }`,
  ];

  const meta = [];
  const salary = formatSalary(job);
  if (salary) meta.push(`\ud83d\udcb0 ${salary}`);
  if (job.employmentType) meta.push(`\ud83d\udcbc ${job.employmentType}`);
  if (job.experienceLevel) meta.push(`\ud83d\udcc8 ${job.experienceLevel}`);
  if (job.applicationDeadline) meta.push(`\u23f0 Apply by ${new Date(job.applicationDeadline).toLocaleDateString()}`);
  meta.push(`\ud83d\udd52 Posted ${relativeTime(job.createdAt)}`);

  const sections = [
    `**[Apply on ProfilleAI \u2192](${jobUrl(job.id)})**`,
  ];
  if (job.description) sections.push(`## Description\n\n${job.description}`);
  if (job.requirements) sections.push(`## Requirements\n\n${job.requirements}`);
  if (job.benefits) sections.push(`## Benefits\n\n${job.benefits}`);
  if (skills.length) sections.push(`## Skills\n\n${skills.map((s) => `\`${s}\``).join(' ')}`);

  if (recruiter.firstName) {
    sections.push(
      `## Posted by\n\n${recruiter.firstName} ${recruiter.lastName || ''}${
        recruiterProfile.companyName ? ` at ${recruiterProfile.companyName}` : ''
      }`,
    );
  }

  return [head.join('\n'), meta.join(' \u00b7 '), sections.join('\n\n'), footer()].join('\n\n');
}

/** Header for candidate search results. */
function renderCandidatesHeader(query, count) {
  return header(
    count === 0
      ? `No candidates found for \u201c${query}\u201d`
      : `${count} candidate${count === 1 ? '' : 's'} matching \u201c${query}\u201d`,
    'Open a profile on ProfilleAI to use **Smart Matching**, view the **AI Recruiter Insights**, or bulk-invite to a job.',
  );
}

function renderCandidateCard(profile) {
  const user = profile.user || {};
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Anonymous candidate';
  const skills = topSkills(profile.skills, 5);
  const linkTarget = user.slug || user.id;
  const lines = [
    `### [${fullName}](${profileUrl(linkTarget)})`,
    `\ud83c\udfaf ${profile.title || 'Open to opportunities'} \u00b7 \ud83d\udccd ${profile.location || 'Location N/A'}`,
    `\ud83d\udcc8 ${profile.experienceLevel || 'Entry'} \u00b7 ${profile.experienceCount || 0} role${
      profile.experienceCount === 1 ? '' : 's'
    } of experience`,
  ];
  if (skills.length) lines.push(`\ud83d\udd16 ${skills.join(' \u00b7 ')}`);
  if (profile.aiSummary) {
    const snippet = String(profile.aiSummary).replace(/\s+/g, ' ').slice(0, 200);
    lines.push(`> ${snippet}${snippet.length === 200 ? '\u2026' : ''}`);
  }
  lines.push(
    `[View profile \u2192](${profileUrl(linkTarget)})${
      user.id ? `  \u00b7  Use \`connect_with_user\` (recipientUserId: \`${user.id}\`) to reach out` : ''
    }`,
  );
  return lines.join('\n');
}

function renderCandidatesListMarkdown(query, profiles) {
  const parts = [renderCandidatesHeader(query, profiles.length)];
  if (profiles.length === 0) {
    parts.push(
      `Try removing some filters or broadening the search term. You can also [browse all candidates on ProfilleAI](${withUtm('/browse')}).`,
    );
    parts.push(footer());
    return parts.join('\n\n');
  }
  for (const p of profiles) parts.push(renderCandidateCard(p));
  parts.push(footer([`\ud83d\udd0d [Browse more candidates on ProfilleAI](${withUtm('/browse')})`]));
  return parts.join('\n\n');
}

function renderCandidateDetailMarkdown(profile) {
  const user = profile.user || {};
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Anonymous candidate';
  const linkTarget = user.slug || user.id;
  const skills = topSkills(profile.skills, 20);

  const head = [
    `![ProfilleAI](${LOGO_URL})`,
    `# [${fullName}](${profileUrl(linkTarget)})`,
    `\ud83c\udfaf ${profile.title || 'Open to opportunities'} \u00b7 \ud83d\udccd ${profile.location || 'Location N/A'}`,
    `\ud83d\udcc8 ${profile.experienceLevel} \u00b7 ${profile.experienceCount} role${profile.experienceCount === 1 ? '' : 's'}`,
  ];

  const sections = [];
  if (profile.aiSummary) sections.push(`## AI summary\n\n${profile.aiSummary}`);
  else if (profile.summary) sections.push(`## Summary\n\n${profile.summary}`);
  if (skills.length) sections.push(`## Skills\n\n${skills.map((s) => `\`${s}\``).join(' ')}`);
  if (Array.isArray(profile.experience) && profile.experience.length) {
    const lines = profile.experience.slice(0, 8).map((e) => {
      const title = e.title || e.role || 'Role';
      const company = e.company || e.organization || '';
      const period = [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' \u2013 ');
      return `- **${title}**${company ? ` at ${company}` : ''}${period ? ` (${period})` : ''}`;
    });
    sections.push(`## Experience\n\n${lines.join('\n')}`);
  }
  if (Array.isArray(profile.education) && profile.education.length) {
    const lines = profile.education.slice(0, 5).map((e) => {
      const deg = e.degree || e.title || 'Education';
      const school = e.school || e.institution || '';
      return `- **${deg}**${school ? ` \u2014 ${school}` : ''}`;
    });
    sections.push(`## Education\n\n${lines.join('\n')}`);
  }

  const cta = [
    `**[View full profile \u2192](${profileUrl(linkTarget)})**`,
    user.id ? `**Reach out:** call \`connect_with_user\` with \`recipientUserId: ${user.id}\`.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [head.join('\n'), cta, sections.join('\n\n'), footer()].join('\n\n');
}

function renderConnectConfirmation({ recipient, conversationId }) {
  const name = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || 'the recipient';
  return [
    `![ProfilleAI](${LOGO_URL})`,
    `\u2705 **Message sent to ${name}.**`,
    '',
    `Continue the conversation on ProfilleAI: [Open inbox \u2192](${conversationUrl(conversationId)})`,
    '',
    footer(),
  ].join('\n');
}

module.exports = {
  // urls
  BASE_URL,
  LOGO_URL,
  withUtm,
  jobUrl,
  profileUrl,
  conversationUrl,
  jobSearchUrl,
  // renderers
  renderJobsListMarkdown,
  renderJobDetailMarkdown,
  renderCandidatesListMarkdown,
  renderCandidateDetailMarkdown,
  renderConnectConfirmation,
};
