import React from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  AutoAwesome as AIIcon,
  TimerOutlined as TimerIcon,
} from '@mui/icons-material';

/**
 * Sector-curated portfolio-project ideas for candidates who don't have any
 * real projects to add yet — most often new grads, self-taught learners
 * and career changers.
 *
 * The list is intentionally hand-curated (not LLM-generated) so it stays
 * fast, free, deterministic and always returns the same recommended-by-
 * recruiters classics for each field. Each idea can be one-click added to
 * the wizard's projects array with a smart starter description the user
 * can edit (and then run AI Draft on).
 */

const IDEAS_BY_SECTOR = {
  tech: [
    {
      title: 'Personal portfolio site',
      effort: 'Weekend',
      role: 'Frontend developer',
      description: 'Designed and built my own portfolio in React + Tailwind to showcase projects, contact info and case studies. Deployed on Vercel with a custom domain.',
    },
    {
      title: 'Full-stack todo / habit tracker',
      effort: '2-3 days',
      role: 'Full-stack developer',
      description: 'Built a habit-tracking SPA with React, Node.js/Express and Postgres. Implemented JWT auth, REST API and a streak-tracking algorithm. Deployed front-end on Vercel and back-end on Render.',
    },
    {
      title: 'Public API mashup (e.g. weather + maps)',
      effort: 'Weekend',
      role: 'Frontend developer',
      description: 'Built a single-page app that combines two public APIs to solve a real problem (e.g. weather-aware trip planner). Practiced async state management and error handling.',
    },
  ],
  data: [
    {
      title: 'Kaggle competition write-up',
      effort: '1-2 weeks',
      role: 'Data scientist',
      description: 'Entered a Kaggle competition (e.g. House Prices, Titanic) and published a clean notebook explaining EDA, feature engineering, model selection and final score on the leaderboard.',
    },
    {
      title: 'Public dashboard from open data',
      effort: 'Weekend',
      role: 'Data analyst',
      description: 'Pulled a public dataset (Our World in Data, NYC Open Data) into a Tableau / Power BI / Streamlit dashboard. Wrote a Medium post on insights.',
    },
    {
      title: 'ML model + API deployment',
      effort: '1 week',
      role: 'ML engineer',
      description: 'Trained a scikit-learn / PyTorch model on a public dataset, wrapped it in a FastAPI endpoint and deployed to Hugging Face Spaces. Documented architecture and trade-offs.',
    },
  ],
  product: [
    {
      title: 'PRD for a redesign',
      effort: '2-3 days',
      role: 'Product manager',
      description: 'Wrote a full PRD redesigning a popular app feature: problem statement, target users, goals, user stories, wireframes, success metrics and rollout plan.',
    },
    {
      title: 'Feature teardown + case study',
      effort: 'Weekend',
      role: 'Product strategist',
      description: 'Picked a recently launched feature (e.g. Spotify Daylist), reverse-engineered the goal, user flow and trade-offs, and proposed three improvements with metrics to measure.',
    },
    {
      title: 'User-research interview series',
      effort: '1 week',
      role: 'PM intern',
      description: 'Ran 5 user interviews on a real pain point, synthesised insights into an affinity map, and shipped a one-page brief recommending the next experiment.',
    },
  ],
  design: [
    {
      title: 'Daily UI challenge (30 days)',
      effort: '30 days · 30 min/day',
      role: 'UI designer',
      description: 'Completed the Daily UI 30-day challenge. Posted each design on Dribbble, refined typography and component reuse across the set.',
    },
    {
      title: 'Redesign of a public app',
      effort: '1 week',
      role: 'Product designer',
      description: 'Picked an app with known UX issues, ran a heuristic eval, produced new wireframes + hi-fi mockups in Figma with a design system. Published a case study on Behance.',
    },
    {
      title: 'Open-source design system contribution',
      effort: '2-3 days',
      role: 'Design systems contributor',
      description: 'Designed and documented a new component for an open-source design system (e.g. shadcn, Radix). Followed accessibility and theming conventions.',
    },
  ],
  marketing: [
    {
      title: 'Launch a Substack / niche newsletter',
      effort: 'Ongoing',
      role: 'Content marketer',
      description: 'Launched a weekly newsletter on a niche topic, grew to first 100 subscribers in 4 weeks using SEO + LinkedIn. Tracked open-rate and CTR.',
    },
    {
      title: 'SEO audit + content plan',
      effort: 'Weekend',
      role: 'SEO specialist',
      description: 'Picked a small business website, ran a technical + content SEO audit using Ahrefs/SEMrush free tier, and shipped a 90-day content plan with target keywords.',
    },
    {
      title: 'Paid-ads micro-campaign',
      effort: '1 week · $50 budget',
      role: 'Growth marketer',
      description: 'Ran a paid Meta or TikTok ad campaign for a personal landing page. A/B tested two creatives, measured CTR/CPC/CPM and wrote up learnings.',
    },
  ],
  sales: [
    {
      title: 'Outbound prospecting case study',
      effort: 'Weekend',
      role: 'SDR',
      description: 'Built a prospect list of 50 ICP accounts using LinkedIn Sales Nav free tier, ran a multi-touch outbound sequence and tracked reply / meeting-booked rates.',
    },
    {
      title: 'Mock discovery-call recording',
      effort: '1 day',
      role: 'Account executive',
      description: 'Recorded a mock 30-min discovery call with a peer playing the prospect. Self-graded using MEDDIC or BANT and shipped the recording + scorecard.',
    },
    {
      title: 'Sales playbook for a real product',
      effort: '2-3 days',
      role: 'Sales strategist',
      description: 'Picked a real SaaS product, built a 1-pager playbook: ICP, qualifying questions, objection handlers and a 5-step outbound cadence.',
    },
  ],
  finance: [
    {
      title: 'DCF model + investment memo',
      effort: '1 week',
      role: 'Financial analyst',
      description: 'Built a 3-statement DCF model for a public company in Excel/Google Sheets and wrote a 2-page investment recommendation (buy/hold/sell with target price).',
    },
    {
      title: 'Personal-finance dashboard',
      effort: 'Weekend',
      role: 'FP&A analyst',
      description: 'Built a personal budget/forecast dashboard in Excel or Power BI with category trends, variance analysis and a 12-month rolling forecast.',
    },
    {
      title: 'Industry teardown',
      effort: '1 week',
      role: 'Equity research analyst',
      description: 'Wrote a short industry primer on a sector (e.g. EV charging, edtech): market sizing, key players, unit economics and the top 3 risks.',
    },
  ],
  operations: [
    {
      title: 'Process redesign case study',
      effort: '1 week',
      role: 'Operations lead',
      description: 'Mapped an end-to-end process at a current/past role, identified the top 3 bottlenecks, redesigned it and quantified the time/cost saved.',
    },
    {
      title: 'Vendor selection write-up',
      effort: 'Weekend',
      role: 'Program manager',
      description: 'Built an RFP scorecard for a category (CRM, payroll, freight), evaluated 3 vendors against weighted criteria and recommended a winner with a TCO model.',
    },
    {
      title: 'Cross-functional program plan',
      effort: '2-3 days',
      role: 'Program manager',
      description: 'Wrote a one-page program plan for a cross-functional rollout: goals, milestones, RACI, risks and a launch checklist.',
    },
  ],
  healthcare: [
    {
      title: 'Quality-improvement (QI) project write-up',
      effort: '1-2 weeks',
      role: 'Clinician / QI lead',
      description: 'Picked a clinical metric (readmission rate, vaccination uptake, wait time), proposed an intervention with measurable goals, documented the PDSA cycles and results.',
    },
    {
      title: 'Specialty certification or course',
      effort: '2-4 weeks',
      role: 'Clinician / allied health',
      description: 'Completed a recognised specialty certification or CME course (e.g. ACLS, PALS, BLS, FNP modules) and documented learnings on a personal blog.',
    },
    {
      title: 'Patient-education resource',
      effort: 'Weekend',
      role: 'Clinician / educator',
      description: 'Authored a plain-language patient-education handout on a common condition, vetted with clinical references, and shared with a clinic or community group.',
    },
  ],
  education: [
    {
      title: 'Curriculum unit (5 lessons)',
      effort: '1 week',
      role: 'Teacher / curriculum designer',
      description: 'Designed a 5-lesson unit aligned to standards, with objectives, activities, formative assessment and a final task. Published on Teachers Pay Teachers or a personal blog.',
    },
    {
      title: 'Classroom-tech pilot write-up',
      effort: '2-3 weeks',
      role: 'Teacher',
      description: 'Piloted a new tool (AI assistant, formative-assessment platform) with one class, tracked engagement / grade impact, and wrote a short reflection.',
    },
    {
      title: 'Conference talk or workshop',
      effort: '2-3 days prep',
      role: 'Educator / speaker',
      description: 'Proposed and delivered a session at a local edcamp, district PD day or virtual unconference. Posted the slides + recording publicly.',
    },
  ],
  legal: [
    {
      title: 'Published case note or article',
      effort: '2-3 weeks',
      role: 'Author',
      description: 'Wrote and published a short case note or article on a recent decision in your practice area on SSRN, a bar journal or a personal blog. Cited and referenceable.',
    },
    {
      title: 'Pro bono engagement',
      effort: 'Ongoing',
      role: 'Volunteer counsel',
      description: 'Took on a pro bono matter through a clinic (immigration, expungement, housing). Document scope, hours, the outcome and a written reference from the clinic.',
    },
    {
      title: 'Bar-association committee work',
      effort: 'Ongoing',
      role: 'Committee member',
      description: 'Joined a state or local bar committee (young lawyers, diversity, a substantive section) and contributed to a publication, CLE or report.',
    },
  ],
  hr: [
    {
      title: 'Hiring playbook for one role',
      effort: 'Weekend',
      role: 'Recruiter / HRBP',
      description: 'Wrote a one-page hiring playbook for a specific role: ICP, sourcing channels, interview loop, scorecard rubric and a 30/60/90 onboarding plan.',
    },
    {
      title: 'Onboarding redesign',
      effort: '1 week',
      role: 'People ops',
      description: 'Mapped an existing onboarding flow, identified gaps with a survey, and shipped a redesign with measurable metrics (time-to-productivity, eNPS).',
    },
    {
      title: 'Compensation-band research',
      effort: 'Weekend',
      role: 'Total rewards',
      description: 'Benchmarked salary bands for a role family using Levels.fyi / public data, proposed a new band and modelled the budget impact.',
    },
  ],
};

// Generic fallback when sector has no curated list — still useful, still
// concrete enough to one-click add.
const GENERIC_IDEAS = [
  {
    title: 'Process improvement at a current/past role',
    effort: 'Write-up: 1 day',
    role: 'Process lead',
    description: 'Documented a process improvement I implemented (e.g. faster onboarding, fewer support tickets) with before/after metrics and lessons learned.',
  },
  {
    title: 'Volunteer / pro-bono engagement',
    effort: '1-2 weeks',
    role: 'Volunteer consultant',
    description: 'Volunteered on Catchafire / VolunteerMatch for a nonprofit. Delivered a concrete artifact (deck, plan, content) and gathered a written reference.',
  },
  {
    title: 'Industry write-up / opinion piece',
    effort: 'Weekend',
    role: 'Author',
    description: 'Published a Medium / LinkedIn post breaking down a current trend in my industry. Synthesised 3 sources and offered an opinion supported by data.',
  },
];

const ProjectIdeasModal = ({ open, onClose, sector, onAdd }) => {
  const ideas = IDEAS_BY_SECTOR[sector] || GENERIC_IDEAS;
  const sectorLabel = sector
    ? sector.charAt(0).toUpperCase() + sector.slice(1)
    : 'your field';

  const handleAdd = (idea) => {
    onAdd?.({ title: idea.title, role: idea.role, description: idea.description, url: '' });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '92vh' } }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
          color: '#fff',
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8, color: alpha('#fff', 0.85) }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: alpha('#fff', 0.18),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(255,255,255,0.18)',
            }}
          >
            <AIIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, opacity: 0.9 }}>
            AI project ideas
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.5 }}>
          Build one of these in a weekend
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, fontSize: 13.5 }}>
          Recruiter-recommended portfolio projects for {sectorLabel}. One click adds it to your projects with a starter description you can refine.
        </Typography>
      </Box>

      <Box sx={{ p: 3, backgroundColor: '#fafafa', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {ideas.map((idea) => (
            <Box
              key={idea.title}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1.5px solid #e5e7eb',
                backgroundColor: '#fff',
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: '#6366f1', boxShadow: '0 6px 16px -8px rgba(99,102,241,0.35)' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                    {idea.title}
                  </Typography>
                  <Chip
                    icon={<TimerIcon sx={{ fontSize: 12 }} />}
                    label={idea.effort}
                    size="small"
                    sx={{ height: 18, fontSize: 10.5, fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569', '& .MuiChip-icon': { color: '#475569', ml: '4px' } }}
                  />
                </Box>
                <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: 12, mb: 0.5 }}>
                  Role: {idea.role}
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', fontSize: 12.5, lineHeight: 1.5 }}>
                  {idea.description}
                </Typography>
              </Box>
              <Button
                onClick={() => handleAdd(idea)}
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1.25,
                  borderRadius: 1.5,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
                  flexShrink: 0,
                }}
              >
                Add
              </Button>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.75,
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fff',
        }}
      >
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 12 }}>
          Tip: pick one and aim to ship it in the next 7 days.
        </Typography>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600 }}>
          Done
        </Button>
      </Box>
    </Dialog>
  );
};

export default ProjectIdeasModal;
