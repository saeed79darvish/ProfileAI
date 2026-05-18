/**
 * MCP server definition for ProfileAI's Claude.ai Custom Connector.
 *
 * Exposes five tools:
 *   - search_jobs           (candidates)
 *   - get_job_details       (any authed user)
 *   - search_candidates     (recruiters only)
 *   - get_candidate_profile (recruiters only)
 *   - connect_with_user     (any authed user, rate-limited 20/day)
 *
 * Each tool returns dual content: a Markdown card for chat rendering
 * AND `structuredContent` so Claude can reason about the result.
 *
 * IMPORTANT: this module exports a *factory*. Auth context is per
 * request, so the transport layer (backend/mcp/transport.js) builds a
 * fresh McpServer per session, injecting the resolved `user`.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

const jobSearchService = require('../services/jobSearchService');
const candidateSearchService = require('../services/candidateSearchService');
const connectionService = require('../services/connectionService');
const { requireAuth, requireRole } = require('./auth');
const renderers = require('./renderers');

// In-memory daily rate-limit window for `connect_with_user`. A more
// durable counter (e.g. Redis) can replace this without touching tools.
const connectQuota = new Map(); // userId -> { day: YYYY-MM-DD, count }
const CONNECT_DAILY_LIMIT = 20;

function consumeConnectQuota(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const bucket = connectQuota.get(userId);
  if (!bucket || bucket.day !== today) {
    connectQuota.set(userId, { day: today, count: 1 });
    return;
  }
  if (bucket.count >= CONNECT_DAILY_LIMIT) {
    const err = new Error(
      `Daily limit reached (${CONNECT_DAILY_LIMIT} connection messages/day). Open ProfileAI to keep messaging.`,
    );
    err.code = 'RATE_LIMITED';
    throw err;
  }
  bucket.count += 1;
}

function toToolError(err) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `\u26a0\ufe0f ${err.message || 'Something went wrong.'}`,
      },
    ],
  };
}

/**
 * Build a new McpServer instance bound to the given auth context.
 * `ctx.getUser()` is called inside each handler so a per-session
 * refresh strategy can be added later.
 */
function buildMcpServer(ctx) {
  const server = new McpServer({
    name: 'profileai',
    version: '1.0.0',
  });

  // -------------------- search_jobs --------------------
  server.tool(
    'search_jobs',
    'Search ProfileAI job postings. Use for any "find me a job", "open roles at \u2026", or "what jobs match my background" question. Returns up to 10 results with company, location, salary, and a deep link to apply (with one-click AI Resume Tailoring).',
    {
      query: z
        .string()
        .min(1)
        .describe('Free-text query, e.g. "senior backend engineer" or "product designer fintech".'),
      location: z.string().optional().describe('City, region, or country, e.g. "San Francisco".'),
      locationType: z.enum(['remote', 'hybrid', 'onsite']).optional(),
      employmentType: z
        .enum(['full-time', 'part-time', 'contract', 'internship', 'temporary'])
        .optional(),
      experienceLevel: z
        .enum(['entry', 'mid', 'senior', 'lead', 'executive'])
        .optional(),
      salaryMin: z.number().int().positive().optional(),
      salaryMax: z.number().int().positive().optional(),
      datePosted: z
        .enum(['day', '3days', 'week', '2weeks', 'month', '3months'])
        .optional(),
      limit: z.number().int().min(1).max(10).optional().default(10),
    },
    async (args) => {
      try {
        // Auth optional for search_jobs to lower friction.
        const { jobs } = await jobSearchService.searchJobs({
          ...args,
          page: 1,
          limit: args.limit || 10,
        });
        return {
          content: [
            { type: 'text', text: renderers.renderJobsListMarkdown(args.query, jobs) },
          ],
          structuredContent: {
            count: jobs.length,
            jobs: jobs.map((j) => ({
              id: j.id,
              title: j.title,
              company: j.company,
              location: j.location,
              locationType: j.locationType,
              employmentType: j.employmentType,
              experienceLevel: j.experienceLevel,
              salaryMin: j.salaryMin,
              salaryMax: j.salaryMax,
              url: renderers.jobUrl(j.id),
            })),
          },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // -------------------- get_job_details --------------------
  server.tool(
    'get_job_details',
    'Fetch the full description, requirements, and benefits for one ProfileAI job, plus the apply link. Call after `search_jobs` to drill into a specific role.',
    {
      id: z.string().uuid().describe('ProfileAI job id (UUID from `search_jobs`).'),
    },
    async ({ id }) => {
      try {
        const job = await jobSearchService.getJobById(id, { incrementViews: false });
        if (!job) {
          return toToolError(new Error('Job not found or no longer active.'));
        }
        return {
          content: [{ type: 'text', text: renderers.renderJobDetailMarkdown(job) }],
          structuredContent: {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            url: renderers.jobUrl(job.id),
          },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // -------------------- search_candidates (recruiters only) --------------------
  server.tool(
    'search_candidates',
    'RECRUITERS ONLY. Search ProfileAI candidate profiles by skills, experience, location, or free text. Returns up to 10 candidates with title, top skills, AI-generated summary, and a deep link to view the full profile or reach out.',
    {
      query: z.string().optional().describe('Free-text search across title, summary, skills, and name.'),
      skills: z.array(z.string()).optional().describe('List of required skills, e.g. ["React", "TypeScript"].'),
      location: z.string().optional(),
      experienceLevel: z
        .enum(['Entry', 'Junior', 'Mid-Level', 'Senior'])
        .optional(),
      aiEnhanced: z
        .boolean()
        .optional()
        .describe('Require an AI-generated summary on the profile.'),
      sortBy: z.enum(['recent', 'experience', 'aiScore']).optional().default('recent'),
      limit: z.number().int().min(1).max(10).optional().default(10),
    },
    async (args) => {
      try {
        const user = requireRole(await ctx.getUser(), ['recruiter']);
        const { profiles, total } = await candidateSearchService.searchProfiles({
          ...args,
          limit: args.limit || 10,
          offset: 0,
        });
        const displayQuery =
          args.query || (args.skills && args.skills.join(', ')) || 'your criteria';
        return {
          content: [
            {
              type: 'text',
              text: renderers.renderCandidatesListMarkdown(displayQuery, profiles),
            },
          ],
          structuredContent: {
            count: profiles.length,
            total,
            candidates: profiles.map((p) => ({
              id: p.user?.id,
              slug: p.user?.slug,
              name: [p.user?.firstName, p.user?.lastName].filter(Boolean).join(' '),
              title: p.title,
              location: p.location,
              experienceLevel: p.experienceLevel,
              url: renderers.profileUrl(p.user?.slug || p.user?.id),
            })),
          },
          _meta: { authedUserId: user.id },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // -------------------- get_candidate_profile (recruiters only) --------------------
  server.tool(
    'get_candidate_profile',
    'RECRUITERS ONLY. Fetch the full public profile for one candidate \u2014 experience, education, skills, and AI summary \u2014 plus deep links to view or message them.',
    {
      id: z.string().describe('Candidate user id (UUID) or profile slug from `search_candidates`.'),
    },
    async ({ id }) => {
      try {
        requireRole(await ctx.getUser(), ['recruiter']);
        const profile = await candidateSearchService.getProfileById(id);
        if (!profile) return toToolError(new Error('Candidate profile not found or not public.'));
        return {
          content: [{ type: 'text', text: renderers.renderCandidateDetailMarkdown(profile) }],
          structuredContent: {
            id: profile.user?.id,
            slug: profile.user?.slug,
            name: [profile.user?.firstName, profile.user?.lastName].filter(Boolean).join(' '),
            title: profile.title,
            experienceLevel: profile.experienceLevel,
            url: renderers.profileUrl(profile.user?.slug || profile.user?.id),
          },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // -------------------- connect_with_user --------------------
  server.tool(
    'connect_with_user',
    'Send a first-contact message to another ProfileAI user (a recruiter to a candidate, or a candidate to a recruiter/hiring manager). Use the recipient\u2019s user id from `search_candidates` / `search_jobs`. Limited to 20 messages per day.',
    {
      recipientUserId: z
        .string()
        .uuid()
        .describe('Recipient user UUID (from `search_candidates`/`search_jobs`).'),
      message: z
        .string()
        .min(1)
        .max(2000)
        .describe('Your message body. Keep it personal and concise.'),
      context: z
        .object({
          jobId: z.string().uuid().optional(),
          profileId: z.string().optional(),
        })
        .optional()
        .describe('Optional context Claude can include for analytics.'),
    },
    async ({ recipientUserId, message }) => {
      try {
        const user = requireAuth(await ctx.getUser());
        consumeConnectQuota(user.id);
        const result = await connectionService.startConversation(
          user.id,
          recipientUserId,
          message,
        );
        return {
          content: [{ type: 'text', text: renderers.renderConnectConfirmation(result) }],
          structuredContent: {
            conversationId: result.conversationId,
            messageId: result.messageId,
            recipient: result.recipient,
            url: renderers.conversationUrl(result.conversationId),
          },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  return server;
}

module.exports = { buildMcpServer };
