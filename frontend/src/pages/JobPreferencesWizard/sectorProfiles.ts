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

export type SectorProfile = {
  /** Friendly title for the AI-agent portfolio panel. */
  agentTitle: string;
  /** Short blurb explaining what the agent will do. */
  agentBlurb: string;
  portfolio: SectorPortfolio;
  projects: SectorProjectsCopy;
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
  },
};

/**
 * Resolve a sector id to its config, falling back to neutral defaults when
 * the user hasn't picked one yet or for any sector we don't override.
 */
export function getSectorProfile(sectorId?: string): SectorProfile {
  if (!sectorId) return DEFAULTS;
  return SECTOR_PROFILES[sectorId] || DEFAULTS;
}
