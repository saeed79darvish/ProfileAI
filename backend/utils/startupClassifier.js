/**
 * Startup classifier helpers.
 *
 * The "Startups" filter on the candidate job board ORs together a few
 * weak signals — source-of-feed, employee count, employee range bucket,
 * and funding stage. That works well at the long tail but lets through
 * a handful of household-name unicorns that are *technically* startups
 * by funding stage (still private, recent rounds) but are NOT what a
 * candidate means by "startup" — Stripe, OpenAI, Anthropic, Databricks,
 * SpaceX, etc.
 *
 * We solve that with an explicit company-name deny-list, plus an
 * exclusion for any company whose funding stage is late/IPO/public.
 * The deny-list is centralized here so the route handler and the
 * semantic ranker stay in sync.
 *
 * Names are lower-cased and matched as exact equality against
 * `LOWER(ej."company")`. Aliases for the same company go in as
 * separate entries (e.g. "x", "twitter", "x corp").
 */

// Companies that are too large, too established, or too well-funded
// to feel like a startup to a candidate. Sourced from a manual audit
// of the top results that surfaced under the Startups filter and that
// candidates flagged as obvious mismatches.
const NON_STARTUP_COMPANIES = [
  // Late-stage / decacorns commonly mis-categorized:
  'stripe',
  'openai',
  'anthropic',
  'databricks',
  'canva',
  'figma',
  'notion',
  'discord',
  'reddit',
  'gitlab',
  'github',
  'plaid',
  'brex',
  'rippling',
  'instacart',
  'doordash',
  'snowflake',
  'mongodb',
  'datadog',
  'cloudflare',
  'twilio',
  'okta',
  'zoom',
  'slack',
  'atlassian',
  'asana',
  'monday.com',
  'shopify',
  'square',
  'block',
  'coinbase',
  'robinhood',
  'palantir',
  'spacex',
  'tesla',
  'epic games',
  'epic',
  'unity',
  'unity technologies',
  // Newer unicorns:
  'perplexity',
  'perplexity ai',
  'glean',
  'mistral',
  'mistral ai',
  'scale ai',
  'scale',
  'character ai',
  'character.ai',
  'runway',
  'runway ml',
  'cohere',
  'huggingface',
  'hugging face',
  'replicate',
  'vercel',
  'supabase',
  'planetscale',
  'turso',
  // Productivity unicorns:
  'clickup',
  'airtable',
  'miro',
  'mural',
  'loom',
  'calendly',
  'gusto',
  'hubspot',
  'zendesk',
  'intercom',
  'twilio inc',
];

const NON_STARTUP_SET = new Set(NON_STARTUP_COMPANIES.map(s => s.toLowerCase()));

// Funding stages that disqualify a company from "startup" regardless of
// the other signals. Mirrors Crunchbase / PitchBook stage strings we've
// seen in the Companies.fundingStage column.
const NON_STARTUP_FUNDING_STAGES = [
  'late',
  'late stage',
  'late-stage',
  'late_stage',
  'ipo',
  'public',
  'post-ipo',
  'post ipo',
  'post_ipo',
  'series-d',
  'series d',
  'series_d',
  'series-e',
  'series e',
  'series_e',
  'series-f',
  'series f',
  'series_f',
  'series-g',
  'series g',
  'series_g',
  'private equity',
  'private_equity',
  'private-equity',
  'acquired',
  'subsidiary',
];

/**
 * Return true when this company name is on the curated non-startup list.
 * Case-insensitive, exact match on the normalized name.
 */
function isNonStartupCompanyName(company) {
  if (!company || typeof company !== 'string') return false;
  return NON_STARTUP_SET.has(company.trim().toLowerCase());
}

module.exports = {
  NON_STARTUP_COMPANIES,
  NON_STARTUP_SET,
  NON_STARTUP_FUNDING_STAGES,
  isNonStartupCompanyName,
};
