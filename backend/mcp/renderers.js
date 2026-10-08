/**
 * Markdown renderers for the Claude MCP connector.
 *
 * Every tool response includes ProfilleAI branding (logo) plus a guide
 * pointing the user at our differentiators (AI Tailoring + Chrome
 * Extension) so Claude\u2019s rendered cards drive traffic back to the
 * platform.
 */

const BASE_URL = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://www.profilleai.com';
const LOGO_URL =
  process.env.PUBLIC_LOGO_URL ||
  `${BASE_URL}/logo.png`;
const CHROME_EXTENSION_URL =
  process.env.PUBLIC_CHROME_EXTENSION_URL ||
  `${BASE_URL}/extension`;

const UTM = 'utm_source=claude&utm_medium=mcp&utm_campaign=connector';

function withUtm(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE_URL}${path}${sep}${UTM}`;
}

function jobUrl(id) {
  // External job ids resolve on the /jobs list page via ?jobId=, not /jobs/:id.
  return withUtm(`/jobs?jobId=${encodeURIComponent(id)}`);
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
function resumeUrl(id) {
  return withUtm(`/profile?tailored=${encodeURIComponent(id || '')}`);
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
    `**Do more on ProfilleAI:**`,
    `\ud83c\udfaf **Tailor your resume with AI** \u2014 open any job on ProfilleAI for one-click AI Resume Tailoring + cover letters.`,
    `\u26a1 **Apply in under a minute** \u2014 the [ProfilleAI Chrome Extension](${CHROME_EXTENSION_URL}) auto-fills and submits applications for you.`,
    `\ud83c\udf99\ufe0f **Ace the interview** \u2014 ask me to prep you from your tailored resume's questions and skill gaps.`,
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

/** List of the user's tailored resumes, for interview prep. */
function renderTailoredResumesListMarkdown(resumes) {
  if (!resumes || resumes.length === 0) {
    return [
      header('No tailored resumes yet', 'Tailor your resume to a job on ProfilleAI, then come back to prep for the interview.'),
      '',
      `Get started: [Tailor a resume on ProfilleAI](${withUtm('/profile')})`,
      '',
      footer(),
    ].join('\n');
  }

  const parts = [
    header(
      `${resumes.length} tailored resume${resumes.length === 1 ? '' : 's'} ready for interview prep`,
      'Pick one, then ask me to prep you for its interview — I’ll use that role’s questions and skill gaps.',
    ),
    '',
  ];

  resumes.forEach((r) => {
    const bits = [];
    if (r.companyName) bits.push(r.companyName);
    if (typeof r.matchScore === 'number') bits.push(`${r.matchScore}% match`);
    bits.push(`${r.gapCount} gap${r.gapCount === 1 ? '' : 's'}`);
    bits.push(r.hasInterviewPrep ? 'prep ready' : 'prep on demand');
    parts.push(`### ${r.jobTitle}`);
    parts.push(bits.join(' · '));
    parts.push(`\`id: ${r.id}\` · [View on ProfilleAI](${resumeUrl(r.id)})`);
    parts.push('');
  });

  parts.push(footer());
  return parts.join('\n');
}

/** Full interview-prep guide for one tailored resume. */
function renderInterviewPrepMarkdown(resume) {
  const title = resume.companyName
    ? `${resume.jobTitle} at ${resume.companyName}`
    : resume.jobTitle;
  const parts = [header(`Interview prep: ${title}`, 'Ask me to run a mock interview, drill any question, or coach you through a gap.'), ''];

  const gaps = resume.skillGaps || [];
  const prep = resume.interviewPrep || null;

  if (typeof resume.matchScore === 'number') {
    parts.push(`**Match:** ${resume.matchScore}%`);
    parts.push('');
  }

  if (prep?.roundOverview) {
    parts.push(`**What to expect:** ${prep.roundOverview}`);
    parts.push('');
  }

  if (Array.isArray(prep?.expectedTopics) && prep.expectedTopics.length) {
    parts.push('**Likely topics**');
    prep.expectedTopics.forEach((t) => parts.push(`- ${t}`));
    parts.push('');
  }

  const tq = Array.isArray(prep?.technicalQuestions) ? prep.technicalQuestions : [];
  if (tq.length) {
    parts.push('## Technical questions');
    tq.forEach((q, i) => {
      parts.push(`**${i + 1}. ${q.question}**`);
      if (q.whyAsked) parts.push(`- _Why:_ ${q.whyAsked}`);
      if (q.suggestedApproach) parts.push(`- _Approach:_ ${q.suggestedApproach}`);
      if (q.relatedGap) parts.push(`- _Related gap:_ ${q.relatedGap}`);
      parts.push('');
    });
  }

  const bq = Array.isArray(prep?.behavioralQuestions) ? prep.behavioralQuestions : [];
  if (bq.length) {
    parts.push('## Behavioral questions');
    bq.forEach((q, i) => {
      parts.push(`**${i + 1}. ${q.question}**`);
      if (q.whyAsked) parts.push(`- _Why:_ ${q.whyAsked}`);
      if (q.starExample) parts.push(`- _STAR:_ ${q.starExample}`);
      parts.push('');
    });
  }

  if (gaps.length) {
    parts.push('## Skill gaps to address');
    gaps.forEach((g) => {
      const sev = g.severity ? ` _(${g.severity})_` : '';
      parts.push(`- **${g.skill || g.name}**${sev}${g.description ? ` — ${g.description}` : ''}`);
    });
    parts.push('');
  }

  const gm = Array.isArray(prep?.gapMitigation) ? prep.gapMitigation : [];
  if (gm.length) {
    parts.push('## How to handle gap questions');
    gm.forEach((m) => parts.push(`- **${m.gap}:** ${m.strategy}`));
    parts.push('');
  }

  if (Array.isArray(prep?.talkingPoints) && prep.talkingPoints.length) {
    parts.push('## Lead with these');
    prep.talkingPoints.forEach((t) => parts.push(`- ${t}`));
    parts.push('');
  }

  if (Array.isArray(prep?.questionsToAsk) && prep.questionsToAsk.length) {
    parts.push('## Questions to ask them');
    prep.questionsToAsk.forEach((q) => parts.push(`- ${q}`));
    parts.push('');
  }

  if (!prep) {
    parts.push(
      '_Detailed prep hasn’t been generated for this resume yet — the questions above are derived from its skill gaps. Generate full prep on ProfilleAI for STAR examples, a study plan, and do’s/don’ts._',
    );
    parts.push('');
    parts.push(`[Open this resume on ProfilleAI](${resumeUrl(resume.id)})`);
    parts.push('');
  }

  parts.push(footer());
  return parts.join('\n');
}


/** Verdict chip — same three bands the extension and the report email use. */
function verdictLabel(verdict) {
  const v = String(verdict || 'maybe').toLowerCase();
  if (v === 'shortlist') return '\u2705 SHORTLIST';
  if (v === 'pass') return '\u274c PASS';
  return '\u26a0\ufe0f MAYBE';
}

/**
 * Where the numbers came from. The tool grades whatever content it could
 * resolve, and the three sources are not interchangeable — a stored
 * ProfilleAI profile is not the live LinkedIn page, and saying so is the
 * difference between a useful tool and one that quietly grades the wrong
 * document.
 */
function sourceNote(source, profileUrl) {
  if (source === 'cache') {
    return `Graded from the saved analysis of ${profileUrl || 'this profile'} (analyses are kept for 7 days).`;
  }
  if (source === 'text') {
    return 'Graded from the profile text you provided.';
  }
  return 'Graded from your ProfilleAI profile — not your live LinkedIn page. For the live page, use the Chrome extension or paste the profile text.';
}

/** Result card for `analyze_linkedin_profile`. */
function renderLinkedInAnalysisMarkdown(a) {
  // header() already bolds its title, so the target role goes in unstyled —
  // nested asterisks render as literal asterisks, not emphasis.
  const target = a.targetTitle ? ` for ${a.targetTitle}` : '';
  const fixes = (a.fixes || []).map((f, i) => `${i + 1}. ${f.body}`);
  const lines = [
    header(`LinkedIn profile grade${target}`, sourceNote(a.source, a.profileUrl)),
    '',
    `**${a.overallScore}/100 overall** \u00b7 Recruiter fit ${a.recruiterFitScore}/100 \u00b7 Search visibility ${a.searchVisibilityScore}/100`,
    '',
    `**Recruiter verdict:** ${verdictLabel(a.verdict)}`,
  ];
  if (a.summary) lines.push('', a.summary);
  if (fixes.length) lines.push('', '**Fix these first:**', '', ...fixes);
  lines.push(
    '',
    footer([
      `\ud83d\udd0d **Re-grade any profile in one click** \u2014 the [ProfilleAI Chrome Extension](${CHROME_EXTENSION_URL}) reads the LinkedIn page you're on and grades it live.`,
    ]),
  );
  // Blank lines are load-bearing in markdown — without them every line above
  // collapses into one paragraph. Only runs of them get squeezed.
  return lines.filter((line, i) => line !== '' || lines[i - 1] !== '').join('\n');
}

/**
 * Shown when no source could be resolved. Deliberately not an error: the
 * three ways to get an analysis are the product surface, so this response
 * is a menu, not a dead end.
 */
function renderAnalyzerHandoffMarkdown({ hasProfileUrl, textTooShort }) {
  const lead = textTooShort
    ? "That's too little text to grade fairly \u2014 a headline alone tells a recruiter almost nothing."
    : hasProfileUrl
      ? "I don't have an analysis of that profile yet, and I can't read LinkedIn pages directly \u2014 LinkedIn only shows profiles to a signed-in browser."
      : "I can grade a LinkedIn profile, but I need its content first \u2014 I can't read LinkedIn pages directly.";
  return [
    header('Pick how to get the profile in', lead),
    '',
    '**1. Paste it** \u2014 copy the headline, About and experience from the profile and send them here.',
    `**2. Send the PDF** \u2014 on the profile, open More, choose Save to PDF, then share that file with me. Takes about ten seconds.`,
    `**3. Grade it live** \u2014 install the [ProfilleAI Chrome Extension](${CHROME_EXTENSION_URL}). It reads whichever LinkedIn profile you're viewing and grades it in place, no copying at all.`,
    '',
    `Or ask me to grade your [ProfilleAI profile](${withUtm('/profile')}) instead \u2014 I can do that one right now.`,
  ].join('\n');
}

module.exports = {
  // urls
  BASE_URL,
  CHROME_EXTENSION_URL,
  LOGO_URL,
  withUtm,
  jobUrl,
  profileUrl,
  conversationUrl,
  jobSearchUrl,
  resumeUrl,
  // renderers
  renderLinkedInAnalysisMarkdown,
  renderAnalyzerHandoffMarkdown,
  renderJobsListMarkdown,
  renderJobDetailMarkdown,
  renderCandidatesListMarkdown,
  renderCandidateDetailMarkdown,
  renderConnectConfirmation,
  renderTailoredResumesListMarkdown,
  renderInterviewPrepMarkdown,
};
