/**
 * Per-sector wizard configuration.
 *
 * The wizard is the same shape for everyone, but a Lawyer doesn't have a
 * GitHub, an Accountant doesn't ship "side projects" in the tech sense,
 * and a Designer's portfolio lives on Behance — not on a personal-site
 * URL alone. This file is the single source of truth for everything the
 * wizard needs to vary per industry: labels, placeholders, the
 * AI-agent portfolio input, and the "no work history" spotlight copy.
 *
 * Adding a new sector? Add it here and the wizard adapts automatically.
 *
 * Each entry produces:
 *   - portfolio: how we ask for an online artefact the AI agent can
 *                review (URL or handle), with prefix + placeholder.
 *   - projects: nomenclature for the user-supplied work samples
 *               (Projects / Case studies / Matters / Campaigns / Deals).
 *   - agentBlurb: one-sentence explanation of what our AI agent does
 *                 with the portfolio link for this sector.
 */

export type SectorPortfolio = {
  /** Property on the wizard data to write into. */
  field: 'githubUsername' | 'portfolioUrl';
  /** Label above the input. */
  label: string;
  /** Placeholder inside the input. */
  placeholder: string;
  /** Optional prefix shown as InputAdornment (e.g. "github.com/"). */
  prefix?: string;
  /** Short helper text underneath. */
  helper: string;
};

export type SectorProjectsCopy = {
  /** Word used everywhere instead of "Project" — keeps copy native to
   *  the candidate's field. Singular form. */
  noun: string;
  /** Plural form. */
  nounPlural: string;
  /** Headline at the top of the projects step. */
  headline: string;
  /** Sub-headline / blurb. */
  blurb: string;
  /** Placeholder for the work-sample title field. */
  titlePlaceholder: string;
  /** Placeholder for the role field (may be empty if not relevant). */
  rolePlaceholder: string;
  /** Placeholder for the description textarea. */
  descriptionPlaceholder: string;
  /** Placeholder for the optional URL field. */
  urlPlaceholder: string;
};

/**
 * Copy that drives the Experience step. Tech-flavoured words like
 * "shipped" or "built" make sense for engineers, but a lawyer's roles are
 * matters, a nurse's are rotations, an AE's are quotas. Each sector
 * supplies its own vocabulary so the form sounds native.
 */
export type SectorExperienceCopy = {
  /** Step headline, e.g. "Tell us about your work history" vs
   *  "Your matters & engagements". */
  headline: string;
  /** Sub-blurb under the headline. */
  blurb: string;
  /** Singular noun for one entry, e.g. "role" / "matter" / "engagement". */
  roleNoun: string;
  /** Label for the company field. */
  companyLabel: string;
  /** Placeholder for the job-title field. */
  titlePlaceholder: string;
  /** Placeholder for the company field. */
  companyPlaceholder: string;
  /** Placeholder for the description textarea. */
  descriptionPlaceholder: string;
  /** Helper line under the AI Draft button — industry-specific cue
   *  on what makes a strong description. */
  descriptionHelper: string;
  /** Sent to the AI Draft endpoint as `context` so GPT-4 rewrites in the
   *  right voice (e.g. "quantify scope, jurisdiction, outcome" vs
   *  "quantify users, revenue, latency"). */
  aiContextHint: string;
};

export type SectorSkillsCopy = {
  /** Step headline override. */
  headline: string;
  /** Sub-blurb override. */
  blurb: string;
  /** Label on the auto-add button. */
  autoAddCta: string;
};

export type SectorEducationCopy = {
  /** Step headline override. */
  headline: string;
  /** Sub-blurb override. */
  blurb: string;
  /** Optional callout above the form recommending a license / cert
   *  candidates in this sector should include (Bar, RN, CPA, etc.). */
  licenseHint?: string;
  /** Placeholder for the institution field. */
  institutionPlaceholder: string;
};

export type SectorProfile = {
  /** Friendly title for the AI-agent portfolio panel. */
  agentTitle: string;
  /** Short blurb explaining what the agent will do. */
  agentBlurb: string;
  portfolio: SectorPortfolio;
  projects: SectorProjectsCopy;
  /** Optional — falls back to neutral defaults when not set. Override per
   *  sector whenever the default copy reads tech-flavoured or wrong. */
  experience?: SectorExperienceCopy;
  skills?: SectorSkillsCopy;
  education?: SectorEducationCopy;
};

/** Same as SectorProfile but with experience/skills/education guaranteed.
 *  This is what getSectorProfile returns — callers never have to null-check. */
export type ResolvedSectorProfile = SectorProfile & {
  experience: SectorExperienceCopy;
  skills: SectorSkillsCopy;
  education: SectorEducationCopy;
};

const DEFAULTS: SectorProfile = {
  agentTitle: 'Let our AI agent find your best work',
  agentBlurb:
    'Share your portfolio or personal site and the agent will recommend which projects to feature here.',
  portfolio: {
    field: 'portfolioUrl',
    label: 'Portfolio / personal site',
    placeholder: 'https://your-portfolio.com',
    helper: 'Optional. Public pages only — the agent reads, never posts.',
  },
  projects: {
    noun: 'Project',
    nounPlural: 'Projects',
    headline: "Projects you've worked on",
    blurb:
      'Side projects, school work, freelance — anything that shows what you can do.',
    titlePlaceholder: 'Project title',
    rolePlaceholder: 'Your role (e.g. Lead, Sole contributor)',
    descriptionPlaceholder: 'What is it? What did you do? What was the impact?',
    urlPlaceholder: 'Link (case study, write-up, live demo)',
  },
  experience: {
    headline: 'Tell us about your work experience',
    blurb:
      'Add the roles that matter most for your target job. Quality beats quantity — one well-described role is enough.',
    roleNoun: 'role',
    companyLabel: 'Company',
    titlePlaceholder: 'e.g. Senior Manager',
    companyPlaceholder: 'Company name',
    descriptionPlaceholder: 'What did you own? What did you ship? What changed because of you?',
    descriptionHelper: 'AI rewrites with crisp verbs and impact.',
    aiContextHint:
      'Rewrite as 2-3 punchy bullets focused on ownership and measurable outcomes. Strong action verbs. Numbers where possible.',
  },
  skills: {
    headline: 'What are your top skills?',
    blurb: 'Tap the skills you use day-to-day. Aim for 8-12.',
    autoAddCta: 'Add the top skills employers look for',
  },
  education: {
    headline: 'Your education',
    blurb: 'Degrees, bootcamps, certifications — anything that helps a recruiter understand your background.',
    institutionPlaceholder: 'University / institution',
  },
};

export const SECTOR_PROFILES: Record<string, SectorProfile> = {
  tech: {
    agentTitle: 'Let our AI agent scan your GitHub',
    agentBlurb:
      'Drop your GitHub username — the agent reviews stars, recency, README quality and language match with your target role.',
    portfolio: {
      field: 'githubUsername',
      label: 'GitHub username',
      placeholder: 'your-username',
      prefix: 'github.com/',
      helper: 'Optional. We only read public repos — nothing is changed or committed.',
    },
    projects: {
      noun: 'Project',
      nounPlural: 'Projects',
      headline: "Projects you've shipped",
      blurb:
        'Side projects, open-source contributions, hackathons — anything that shows what you can build.',
      titlePlaceholder: 'Project title',
      rolePlaceholder: 'Your role (e.g. Sole developer, Tech lead)',
      descriptionPlaceholder: 'What did you build? What stack? What was the impact?',
      urlPlaceholder: 'Link (GitHub, live demo, write-up)',
    },
    experience: {
      headline: 'Tell us about your engineering experience',
      blurb: 'Lead with scope (team size, system scale) and measurable wins (latency, revenue, reliability).',
      roleNoun: 'role',
      companyLabel: 'Company',
      titlePlaceholder: 'e.g. Senior Backend Engineer',
      companyPlaceholder: 'Company name',
      descriptionPlaceholder: 'What did you build? Scale? Stack? Quantified impact?',
      descriptionHelper: 'AI rewrites with strong verbs, system scale and measurable impact.',
      aiContextHint:
        'Rewrite as 2-3 punchy bullets. Mention systems built, stack used, scale (RPS, data volume, users), and measurable outcomes (latency cuts, uptime, cost savings, revenue lift).',
    },
    skills: {
      headline: 'What languages, frameworks and tools do you use?',
      blurb: 'Aim for 8-12 — mix languages, frameworks and infra. Recruiters search by these.',
      autoAddCta: 'Add the top engineering skills',
    },
    education: {
      headline: 'Your education & certifications',
      blurb: 'CS degree, bootcamp, cloud certs (AWS / GCP / Azure) — anything that backs your stack.',
      institutionPlaceholder: 'University / bootcamp',
    },
  },

  data: {
    agentTitle: 'Let our AI agent scan your data work',
    agentBlurb:
      'GitHub for notebooks, Kaggle, or a portfolio site — the agent will surface the analyses that map best to your target role.',
    portfolio: {
      field: 'githubUsername',
      label: 'GitHub or Kaggle handle',
      placeholder: 'your-username',
      prefix: 'github.com/',
      helper: 'Optional. We read public notebooks, dashboards and write-ups only.',
    },
    projects: {
      noun: 'Analysis',
      nounPlural: 'Analyses & Models',
      headline: 'Analyses & models you\'ve built',
      blurb:
        'Notebooks, dashboards, Kaggle entries, models in production — anything that proves you can turn data into decisions.',
      titlePlaceholder: 'Analysis / model title',
      rolePlaceholder: 'Your role (e.g. Sole analyst)',
      descriptionPlaceholder: 'What question did it answer? What data + methods? What did the business do with the result?',
      urlPlaceholder: 'Link (notebook, dashboard, Kaggle, write-up)',
    },
  },

  product: {
    agentTitle: 'Let our AI agent review your product work',
    agentBlurb:
      'Share a portfolio, Medium, or case-study site and the agent will spotlight your strongest PRDs, launches and metrics.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'Portfolio / case-study site',
      placeholder: 'https://your-portfolio.com  or  Medium URL',
      helper: 'Optional. Public pages only — case studies, launch retros, Medium posts.',
    },
    projects: {
      noun: 'Launch',
      nounPlural: 'Launches & Case Studies',
      headline: 'Launches & case studies',
      blurb:
        'Features you shipped, products you launched, strategy work — anything with a problem, a decision and a measurable outcome.',
      titlePlaceholder: 'Launch or initiative title',
      rolePlaceholder: 'Your role (e.g. Lead PM)',
      descriptionPlaceholder: 'Problem → decision → outcome. What metrics moved?',
      urlPlaceholder: 'Link (case study, Medium post, launch announcement)',
    },
  },

  design: {
    agentTitle: 'Let our AI agent review your design portfolio',
    agentBlurb:
      'Behance, Dribbble, Figma community or your personal site — the agent picks the strongest pieces for your target role.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'Portfolio (Behance, Dribbble, personal site)',
      placeholder: 'https://behance.net/your-handle  or  https://dribbble.com/...',
      helper: 'Optional. Public pages only. Multiple links? Use a Linktree.',
    },
    projects: {
      noun: 'Case Study',
      nounPlural: 'Case Studies',
      headline: 'Design case studies',
      blurb:
        'Real client work, redesigns, design-system contributions, side projects — anything with a brief, a process and a final.',
      titlePlaceholder: 'Case study / project title',
      rolePlaceholder: 'Your role (e.g. Lead designer)',
      descriptionPlaceholder: 'The brief, your process, the final outcome and any measured impact.',
      urlPlaceholder: 'Link (case study, Behance, Dribbble shot, Figma)',
    },
  },

  marketing: {
    agentTitle: 'Let our AI agent review your marketing work',
    agentBlurb:
      'Portfolio, Substack, Medium, a campaign deck on Notion — the agent will highlight your strongest campaigns and metrics.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'Portfolio / Substack / campaign deck',
      placeholder: 'https://your-portfolio.com  or  Substack URL',
      helper: 'Optional. Public pages only — campaigns, write-ups, newsletter.',
    },
    projects: {
      noun: 'Campaign',
      nounPlural: 'Campaigns',
      headline: 'Campaigns you\'ve run',
      blurb:
        'Paid campaigns, content launches, SEO wins, brand projects — anything where you owned the brief and the result.',
      titlePlaceholder: 'Campaign title',
      rolePlaceholder: 'Your role (e.g. Sole owner, Lead)',
      descriptionPlaceholder: 'Goal, channels, budget if any, and the result with numbers.',
      urlPlaceholder: 'Link (case study, landing page, post)',
    },
    experience: {
      headline: 'Tell us about your marketing roles',
      blurb: 'Lead with the brand or product, your channel mix, and the numbers — CAC, ROAS, conversion lift, pipeline.',
      roleNoun: 'role',
      companyLabel: 'Company / agency / brand',
      titlePlaceholder: 'e.g. Digital Marketing Manager',
      companyPlaceholder: 'Company, agency or brand name',
      descriptionPlaceholder: 'Channels owned, budget managed, programs you ran, and the measurable result.',
      descriptionHelper: 'AI rewrites with channel mix, spend and measurable lift.',
      aiContextHint:
        'Rewrite as 2-3 marketing bullets. Cite channels owned (paid social, SEO, lifecycle), budget managed, programs run, and measurable lift (CAC, ROAS, conversion, pipeline contribution).',
    },
    skills: {
      headline: 'Pick the marketing skills you use',
      blurb: 'Mix channels (SEO, paid, lifecycle), tools (HubSpot, GA4) and craft (copy, brand).',
      autoAddCta: 'Add the top marketing skills',
    },
  },

  sales: {
    agentTitle: 'Let our AI agent review your sales record',
    agentBlurb:
      'Drop a LinkedIn URL or portfolio — the agent will help you frame your quota attainment, deals and playbooks.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / portfolio / case-study URL',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only.',
    },
    projects: {
      noun: 'Deal',
      nounPlural: 'Notable Deals & Playbooks',
      headline: 'Notable deals & playbooks',
      blurb:
        'Big logos closed, expansion deals, playbooks built, new territories opened — anything that shows how you sell.',
      titlePlaceholder: 'Deal or playbook title',
      rolePlaceholder: 'Your role (e.g. AE, SDR lead)',
      descriptionPlaceholder: 'The account, the challenge, your motion, the close — and the ACV / impact.',
      urlPlaceholder: 'Link (case study, write-up, deck)',
    },
    experience: {
      headline: 'Tell us about your sales experience',
      blurb: 'Lead with quota attainment, segment, deal size and motion (outbound, inbound, expansion).',
      roleNoun: 'role',
      companyLabel: 'Company',
      titlePlaceholder: 'e.g. Enterprise Account Executive',
      companyPlaceholder: 'Company name',
      descriptionPlaceholder: 'Quota, segment, ACV, motion, notable logos won — numbers first.',
      descriptionHelper: 'AI rewrites with quota %, deal size and segment up front.',
      aiContextHint:
        'Rewrite as 2-3 sales bullets. Lead each with a number where possible: quota attainment %, ACV, pipeline generated, deals closed, segment (SMB / Mid / Ent), and notable logos.',
    },
    skills: {
      headline: 'Pick the sales skills and tools you use',
      blurb: 'Mix motion (outbound, discovery, closing) and tools (Salesforce, Outreach, Gong).',
      autoAddCta: 'Add the top sales skills',
    },
  },

  finance: {
    agentTitle: 'Let our AI agent review your finance work',
    agentBlurb:
      'Share a LinkedIn URL, portfolio or published research — the agent will help you frame your models, audits and analyses.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / portfolio / published research',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only — write-ups, research, articles.',
    },
    projects: {
      noun: 'Engagement',
      nounPlural: 'Engagements & Models',
      headline: 'Engagements & models',
      blurb:
        'Audits, valuations, M&A deals, models built, controls implemented — anything with scope, your role and a tangible outcome.',
      titlePlaceholder: 'Engagement or model title',
      rolePlaceholder: 'Your role (e.g. Lead analyst, Senior auditor)',
      descriptionPlaceholder: 'Client / company size, scope, your role, methods used and the outcome (savings, valuation, opinion).',
      urlPlaceholder: 'Link (case study, published article)',
    },
    experience: {
      headline: 'Tell us about your finance roles',
      blurb: 'Lead with $ managed, scope (entity size, deals), models built and audit / accuracy outcomes.',
      roleNoun: 'role',
      companyLabel: 'Firm / company',
      titlePlaceholder: 'e.g. Senior Financial Analyst',
      companyPlaceholder: 'Firm or company name',
      descriptionPlaceholder: 'Scope ($ managed, deals worked), models or audits owned, and the outcome (savings, valuation, opinion).',
      descriptionHelper: 'AI rewrites with $ scope, model / audit owned and outcome.',
      aiContextHint:
        'Rewrite as 2-3 finance bullets. Cite $ managed or transacted, entity size, models / audits owned, GAAP / IFRS scope, and the outcome (cost savings, valuation, audit opinion, accuracy).',
    },
    skills: {
      headline: 'Pick the finance disciplines and tools you use',
      blurb: 'Mix disciplines (FP&A, audit, tax), software (Excel, NetSuite, SAP) and standards (GAAP, IFRS).',
      autoAddCta: 'Add the top finance skills',
    },
    education: {
      headline: 'Your education & certifications',
      blurb: 'Degree plus certifications (CPA, CFA, ACCA) — these matter to finance recruiters.',
      licenseHint: 'Recommended: list any active CPA, CFA, CMA or ACCA designation here.',
      institutionPlaceholder: 'University',
    },
  },

  operations: {
    agentTitle: 'Let our AI agent review your operations work',
    agentBlurb:
      'LinkedIn, a portfolio, or a Notion case-study page — the agent will help you frame the systems and processes you built.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / portfolio / Notion page',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only.',
    },
    projects: {
      noun: 'Initiative',
      nounPlural: 'Initiatives & Process Wins',
      headline: 'Initiatives & process wins',
      blurb:
        'Process redesigns, vendor rollouts, cross-functional programs — anything where you scoped, ran it and measured the gain.',
      titlePlaceholder: 'Initiative title',
      rolePlaceholder: 'Your role (e.g. Program lead)',
      descriptionPlaceholder: 'Scope, stakeholders, what you changed and the measured improvement (time, cost, quality).',
      urlPlaceholder: 'Link (case study, post, doc)',
    },
  },

  healthcare: {
    agentTitle: 'Add a profile or publication link',
    agentBlurb:
      'LinkedIn, a Doximity profile, ORCID or any published work — the agent will help you frame your clinical and research history.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / Doximity / ORCID / publication URL',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only.',
    },
    projects: {
      noun: 'Project',
      nounPlural: 'Research & Clinical Projects',
      headline: 'Research & clinical projects',
      blurb:
        'Published research, QI projects, clinical rotations of note, fellowships, certifications earned — anything that shows your specialty depth.',
      titlePlaceholder: 'Project / study / publication title',
      rolePlaceholder: 'Your role (e.g. PI, Co-author)',
      descriptionPlaceholder: 'Setting, your role, methods or scope, and the outcome (publication, certification, patient impact).',
      urlPlaceholder: 'Link (PubMed, journal, certificate)',
    },
    experience: {
      headline: 'Tell us about your clinical experience',
      blurb: 'Lead with setting (hospital, clinic, ICU), patient population, scope and outcomes — keep PHI off the page.',
      roleNoun: 'role',
      companyLabel: 'Hospital / clinic / employer',
      titlePlaceholder: 'e.g. Registered Nurse, ICU',
      companyPlaceholder: 'Hospital, clinic or system name',
      descriptionPlaceholder: 'Setting, patient population, scope of practice, and outcomes (quality metrics, certifications earned). No PHI.',
      descriptionHelper: 'AI rewrites with setting, scope and quality outcomes. PHI is never included.',
      aiContextHint:
        'Rewrite as 2-3 clinical bullets. Cite setting (hospital, clinic, unit), patient population, scope of practice / responsibilities, certifications earned and quality outcomes (e.g. readmit rate, satisfaction scores). Never include patient identifiers.',
    },
    skills: {
      headline: 'Pick your clinical skills and specialties',
      blurb: 'Mix clinical skills (EMR, triage), specialties (ICU, oncology) and compliance (HIPAA).',
      autoAddCta: 'Add the top clinical skills',
    },
    education: {
      headline: 'Your education & licensure',
      blurb: 'Degree, residency / fellowship, board certifications — licensure is essential for healthcare recruiters.',
      licenseHint: 'Recommended: list your RN / NP / MD / DO / PharmD license and state(s) of practice.',
      institutionPlaceholder: 'Medical / nursing school',
    },
  },

  education: {
    agentTitle: 'Add a profile, blog or curriculum link',
    agentBlurb:
      'LinkedIn, a teaching blog, or a curriculum doc — the agent will help you frame your teaching wins and results.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / teaching blog / curriculum site',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only.',
    },
    projects: {
      noun: 'Initiative',
      nounPlural: 'Teaching Initiatives',
      headline: 'Teaching initiatives & results',
      blurb:
        'Curriculum you built, programs you ran, measurable student outcomes, conferences presented — anything that shows your craft.',
      titlePlaceholder: 'Initiative / curriculum / program title',
      rolePlaceholder: 'Your role (e.g. Lead teacher, Curriculum designer)',
      descriptionPlaceholder: 'Audience, what you designed or taught, and the result (scores, engagement, completion).',
      urlPlaceholder: 'Link (curriculum doc, blog post, conference talk)',
    },
    experience: {
      headline: 'Tell us about your teaching experience',
      blurb: 'Lead with subject, grade or audience, class size, and measurable student outcomes.',
      roleNoun: 'role',
      companyLabel: 'School / institution',
      titlePlaceholder: 'e.g. 5th Grade Teacher',
      companyPlaceholder: 'School or institution name',
      descriptionPlaceholder: 'Subject / grade, class size, what you designed or taught, and the measured outcome (scores, engagement, completion).',
      descriptionHelper: 'AI rewrites with subject, audience and measurable student outcomes.',
      aiContextHint:
        'Rewrite as 2-3 teaching bullets. Cite subject / grade / audience, class size, programs designed or taught, and measurable outcomes (test score gains, engagement, completion, college acceptance).',
    },
    skills: {
      headline: 'Pick the teaching skills and tools you use',
      blurb: 'Mix craft (curriculum design, classroom management) and tools (Google Classroom, Canvas).',
      autoAddCta: 'Add the top teaching skills',
    },
    education: {
      headline: 'Your education & certifications',
      blurb: 'Degrees plus teaching credentials — state license, subject endorsements, ESL / SPED certifications.',
      licenseHint: 'Recommended: list your teaching license, state(s) and any subject or grade endorsements.',
      institutionPlaceholder: 'University',
    },
  },

  legal: {
    agentTitle: 'Add your bar profile or publication link',
    agentBlurb:
      'LinkedIn, state-bar profile, SSRN or a publication URL — the agent will help you frame your matters and publications.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / bar profile / SSRN / publication URL',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only — no privileged info.',
    },
    projects: {
      noun: 'Matter',
      nounPlural: 'Matters & Publications',
      headline: 'Matters & publications',
      blurb:
        'Significant matters, deals closed, opinions written, articles published, pro bono work — anything that shows your practice depth. Never share privileged or confidential details.',
      titlePlaceholder: 'Matter or publication title',
      rolePlaceholder: 'Your role (e.g. Lead associate, Co-counsel)',
      descriptionPlaceholder: 'Practice area, your role, scope and outcome (disposition, deal size, publication venue). Keep it public-record.',
      urlPlaceholder: 'Link (publication, opinion, case docket)',
    },
    experience: {
      headline: 'Tell us about your legal experience',
      blurb: 'Lead with practice area, scope (matter size, deal value) and outcome. Never share privileged or confidential details.',
      roleNoun: 'role',
      companyLabel: 'Firm / employer',
      titlePlaceholder: 'e.g. Associate Attorney',
      companyPlaceholder: 'Firm or employer name',
      descriptionPlaceholder: 'Practice area, scope of matters (deal value, case load), your responsibilities, and outcome — public-record only.',
      descriptionHelper: 'AI rewrites with practice area, scope and outcome. No privileged info.',
      aiContextHint:
        'Rewrite as 2-3 legal bullets. Cite practice area, scope (deal value, matter count, jurisdiction), your responsibilities (drafting, negotiation, court appearances) and outcome (disposition, deal closed, opinion published). Use only public-record facts — never identify privileged clients or details.',
    },
    skills: {
      headline: 'Pick your practice areas and tools',
      blurb: 'Mix areas of practice (Corporate, IP, Litigation), skills (drafting, negotiation) and tools (Westlaw, LexisNexis).',
      autoAddCta: 'Add the top legal skills',
    },
    education: {
      headline: 'Your education & bar admission',
      blurb: 'Law school, bar admission(s) and any LLM or specialist certifications.',
      licenseHint: 'Recommended: list your state bar admission(s) and year admitted.',
      institutionPlaceholder: 'Law school',
    },
  },

  hr: {
    agentTitle: 'Add a LinkedIn or portfolio link',
    agentBlurb:
      'LinkedIn, a personal site, or a Notion case-study page — the agent will help you frame the programs you built and the people impact.',
    portfolio: {
      field: 'portfolioUrl',
      label: 'LinkedIn / portfolio / case-study page',
      placeholder: 'https://linkedin.com/in/your-handle',
      helper: 'Optional. Public pages only — never share employee data.',
    },
    projects: {
      noun: 'Program',
      nounPlural: 'Programs & Initiatives',
      headline: 'People programs & initiatives',
      blurb:
        'Hiring programs, L&D launches, compensation overhauls, culture initiatives — anything where you scoped, ran it and measured the impact.',
      titlePlaceholder: 'Program / initiative title',
      rolePlaceholder: 'Your role (e.g. People lead, HRBP)',
      descriptionPlaceholder: 'Scope, who it served, what you launched, and the measured outcome (retention, NPS, time-to-hire).',
      urlPlaceholder: 'Link (case study, post, internal doc made public)',
    },
    experience: {
      headline: 'Tell us about your people / HR roles',
      blurb: 'Lead with team or employee population served, programs owned and people-impact metrics.',
      roleNoun: 'role',
      companyLabel: 'Company',
      titlePlaceholder: 'e.g. Senior HR Business Partner',
      companyPlaceholder: 'Company name',
      descriptionPlaceholder: 'Population served, programs you owned (hiring, L&D, comp), and the measured outcome (retention, time-to-hire, engagement).',
      descriptionHelper: 'AI rewrites with population served, programs owned and people metrics.',
      aiContextHint:
        'Rewrite as 2-3 people / HR bullets. Cite headcount or population served, programs owned (TA, L&D, comp, ER), and measurable outcomes (retention %, time-to-hire, engagement / eNPS, hiring volume). Never disclose individual employee data.',
    },
    skills: {
      headline: 'Pick your people / HR skills',
      blurb: 'Mix craft (TA, L&D, comp, ER) and tools (Workday, Greenhouse, BambooHR).',
      autoAddCta: 'Add the top people / HR skills',
    },
  },
};

/**
 * Resolve a sector id to its config, falling back to neutral defaults when
 * the user hasn't picked one yet or for any sector we don't override.
 *
 * experience / skills / education are filled in from DEFAULTS so callers
 * can always read `sp.experience.headline` without null-checks.
 */
export function getSectorProfile(sectorId?: string): ResolvedSectorProfile {
  const base = (sectorId && SECTOR_PROFILES[sectorId]) || DEFAULTS;
  return {
    ...base,
    experience: base.experience || DEFAULTS.experience!,
    skills: base.skills || DEFAULTS.skills!,
    education: base.education || DEFAULTS.education!,
  };
}

/* ─── Level-aware coach copy ────────────────────────────────────────
   The wizard's voice changes with the candidate's career stage. A new
   grad needs reassurance and a spotlight on projects + education; a
   senior wants efficiency and credit for impact. Keeping this in one
   place so every step can speak the same way without scattering
   ternaries through the JSX.
*/

export type CareerStageId =
  | 'experienced'
  | 'internship'
  | 'new_grad'
  | 'career_change'
  | 'self_taught'
  | '';

export type StageCopy = {
  /** Encouraging line that fronts the Projects step when the candidate
   *  has limited work history. Empty for experienced candidates. */
  projectsSpotlight: string;
  /** Empty-state nudge under the "no roles yet" card on the Experience
   *  step (only shown for stages that DO collect roles). */
  experienceEmptyNudge: string;
  /** Reassurance card shown on the Experience step for stages that skip
   *  the roles form entirely (new_grad / self_taught). */
  noWorkHistoryCalloutTitle: string;
  noWorkHistoryCalloutBody: string;
};

const STAGE_COPY: Record<Exclude<CareerStageId, ''>, StageCopy> = {
  experienced: {
    projectsSpotlight: '',
    experienceEmptyNudge:
      'Add your most recent role first. One well-described role unlocks AI tailoring.',
    noWorkHistoryCalloutTitle: '',
    noWorkHistoryCalloutBody: '',
  },
  internship: {
    projectsSpotlight:
      'Internships count — include school projects too. Recruiters love seeing what you ship outside class.',
    experienceEmptyNudge:
      'Add your internship(s). Even a 10-week summer internship counts as real experience.',
    noWorkHistoryCalloutTitle: '',
    noWorkHistoryCalloutBody: '',
  },
  new_grad: {
    projectsSpotlight:
      "This is your spotlight. New grads who lead with 1–2 strong projects out-perform résumés with vague internship-only entries.",
    experienceEmptyNudge:
      'Skipping ahead — recruiters expect new grads to lead with Education + Projects.',
    noWorkHistoryCalloutTitle: 'Great — no work history needed.',
    noWorkHistoryCalloutBody:
      "We'll spotlight your Education and Projects, which is exactly what hiring managers look at for new grads.",
  },
  career_change: {
    projectsSpotlight:
      "Projects are your bridge. One pivot project that shows you can do the new craft is worth more than 5 years in the old one.",
    experienceEmptyNudge:
      'Add your most recent role — even from the field you are leaving. The story matters; we will help you frame the pivot.',
    noWorkHistoryCalloutTitle: '',
    noWorkHistoryCalloutBody: '',
  },
  self_taught: {
    projectsSpotlight:
      "Self-taught? Projects are your résumé. Recruiters take them seriously when something is shipped and shareable.",
    experienceEmptyNudge:
      'No formal roles yet? Skip ahead — we will lead with Projects and any bootcamp / courses under Education.',
    noWorkHistoryCalloutTitle: 'Great — no work history needed.',
    noWorkHistoryCalloutBody:
      "Recruiters know self-taught engineers, designers and marketers ship great work. We'll spotlight your Projects and learning.",
  },
};

const EMPTY_STAGE_COPY: StageCopy = {
  projectsSpotlight: '',
  experienceEmptyNudge:
    'Add your most recent role first. One well-described entry unlocks AI tailoring.',
  noWorkHistoryCalloutTitle: '',
  noWorkHistoryCalloutBody: '',
};

export function getStageCopy(stageId?: string): StageCopy {
  if (!stageId || !(stageId in STAGE_COPY)) return EMPTY_STAGE_COPY;
  return STAGE_COPY[stageId as Exclude<CareerStageId, ''>];
}

