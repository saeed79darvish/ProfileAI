/**
 * Seed Companies table from existing ExternalJob data.
 *
 * For each unique company name across all ExternalJobs:
 *   1. Create a Company row (deduped by slug).
 *   2. Populate metadata from the richest source available
 *      (TheirStack > JSearch > RemoteOK > others).
 *   3. Set ExternalJob.companyId for every matching job.
 *
 * Usage:  cd backend && node scripts/seedCompanies.js
 */

const sequelize = require('../config/database');
const { Company, ExternalJob } = require('../models');
const { Op } = require('sequelize');

// DuckDuckGo icon API (free, always works)
const logoUrlFromDomain = (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Well-known company domains for logo fallback
const KNOWN_DOMAINS = Object.create(null);
Object.assign(KNOWN_DOMAINS, {
  'airbnb': 'airbnb.com', 'coinbase': 'coinbase.com', 'stripe': 'stripe.com',
  'discord': 'discord.com', 'figma': 'figma.com', 'datadog': 'datadoghq.com',
  'mongodb': 'mongodb.com', 'cloudflare': 'cloudflare.com', 'twitch': 'twitch.tv',
  'pinterest': 'pinterest.com', 'lyft': 'lyft.com', 'robinhood': 'robinhood.com',
  'airtable': 'airtable.com', 'gitlab': 'gitlab.com', 'elastic': 'elastic.co',
  'databricks': 'databricks.com', 'okta': 'okta.com', 'pagerduty': 'pagerduty.com',
  'cockroach labs': 'cockroachlabs.com', 'brex': 'brex.com', 'verkada': 'verkada.com',
  'gusto': 'gusto.com', 'anthropic': 'anthropic.com', 'duolingo': 'duolingo.com',
  'asana': 'asana.com', 'dropbox': 'dropbox.com', 'twilio': 'twilio.com',
  'spacex': 'spacex.com', 'reddit': 'reddit.com', 'instacart': 'instacart.com',
  'samsara': 'samsara.com', 'chime': 'chime.com', 'flexport': 'flexport.com',
  'coupang': 'coupang.com', 'anduril': 'anduril.com', 'anduril industries': 'anduril.com',
  'scale ai': 'scale.com', 'scale': 'scale.com', 'plaid': 'plaid.com',
  'netflix': 'netflix.com', 'google': 'google.com', 'meta': 'meta.com',
  'apple': 'apple.com', 'amazon': 'amazon.com', 'microsoft': 'microsoft.com',
  'spotify': 'spotify.com', 'uber': 'uber.com', 'snap': 'snap.com',
  'doordash': 'doordash.com', 'notion': 'notion.so', 'vercel': 'vercel.com',
  'hashicorp': 'hashicorp.com', 'postman': 'postman.com', 'openai': 'openai.com',
  'deel': 'deel.com', 'ramp': 'ramp.com', 'cohere': 'cohere.com',
  'clickup': 'clickup.com', 'replit': 'replit.com', 'perplexity': 'perplexity.ai',
  'supabase': 'supabase.com', 'linear': 'linear.app', 'clerk': 'clerk.com',
  'neon': 'neon.tech', 'render': 'render.com', 'railway': 'railway.app',
  'resend': 'resend.com',
});

function makeSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function employeeCountToRange(count) {
  if (!count) return null;
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  if (count <= 500) return '201-500';
  if (count <= 1000) return '501-1000';
  if (count <= 5000) return '1001-5000';
  return '5000+';
}

/**
 * Extract company info from a job's metadata + source.
 * Returns a partial Company-like object.
 */
// Only accept string values (metadata can contain arrays/objects)
function str(val) {
  return (typeof val === 'string' && val.trim()) ? val.trim() : null;
}

function extractCompanyInfo(job) {
  const meta = job.metadata || {};
  const info = {};

  if (job.source === 'theirstack') {
    // TheirStack has the richest company metadata
    if (str(meta.company_domain)) info.domain = str(meta.company_domain);
    if (str(meta.company_logo)) info.logoUrl = str(meta.company_logo);
    if (str(meta.company_industry)) info.industry = str(meta.company_industry);
    if (meta.company_employee_count) {
      info.employeeCount = parseInt(meta.company_employee_count, 10) || null;
      info.employeeRange = employeeCountToRange(info.employeeCount);
    }
    if (str(meta.company_linkedin_url)) info.linkedinUrl = str(meta.company_linkedin_url);
    if (str(meta.company_funding_stage)) info.fundingStage = str(meta.company_funding_stage);
    if (str(meta.company_revenue)) info.metadata = { ...info.metadata, revenue: str(meta.company_revenue) };
  } else if (job.source === 'jsearch') {
    if (str(meta.employer_logo)) info.logoUrl = str(meta.employer_logo);
    if (str(meta.employer_website)) {
      info.website = str(meta.employer_website);
      // Extract domain from website URL
      try {
        const url = new URL(meta.employer_website);
        info.domain = url.hostname.replace(/^www\./, '');
      } catch {}
    }
  } else if (job.source === 'remoteok') {
    if (str(meta.company_logo)) info.logoUrl = str(meta.company_logo);
  }

  return info;
}

/**
 * Merge extracted info into an existing company record,
 * preferring non-null values and TheirStack data.
 */
function mergeCompanyInfo(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value != null && !merged[key]) {
      merged[key] = value;
    }
  }
  return merged;
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // 1. Get all active external jobs grouped by company
    const jobs = await ExternalJob.findAll({
      where: { isActive: true },
      attributes: ['id', 'company', 'source', 'metadata'],
      order: [
        // Process TheirStack first (richest metadata), then JSearch, then others
        [sequelize.literal("CASE source WHEN 'theirstack' THEN 1 WHEN 'jsearch' THEN 2 WHEN 'remoteok' THEN 3 ELSE 4 END"), 'ASC']
      ],
      raw: true
    });

    console.log(`Found ${jobs.length} active jobs`);

    // 2. Build company map: slug → company info
    const companyMap = new Map(); // slug → { name, ...info }

    for (const job of jobs) {
      if (!job.company || job.company === 'Unknown') continue;

      const slug = makeSlug(job.company);
      if (!slug) continue;

      const info = extractCompanyInfo(job);

      if (!companyMap.has(slug)) {
        companyMap.set(slug, {
          name: job.company,
          slug,
          ...info
        });
      } else {
        const existing = companyMap.get(slug);
        companyMap.set(slug, mergeCompanyInfo(existing, info));
      }
    }

    console.log(`Found ${companyMap.size} unique companies`);

    // 3. Enrich with known domains + Clearbit logo URLs where missing
    for (const [slug, company] of companyMap) {
      // Try to resolve domain from known domains map
      if (!company.domain) {
        const knownDomain = KNOWN_DOMAINS[company.name.toLowerCase()] || KNOWN_DOMAINS[slug];
        if (knownDomain) {
          company.domain = knownDomain;
        }
      }

      // If we have a domain but no logo, use Clearbit
      if (company.domain && !company.logoUrl) {
        company.logoUrl = logoUrlFromDomain(company.domain);
      }

      // If we don't have a domain, try to guess from company name
      // (many companies have companyname.com)
      if (!company.domain && !company.logoUrl) {
        // Only for simple single-word names
        const simpleName = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (simpleName.length >= 3 && simpleName.length <= 20) {
          company.domain = `${simpleName}.com`;
          company.logoUrl = logoUrlFromDomain(company.domain);
        }
      }

      // Set website from domain if missing
      if (company.domain && !company.website) {
        company.website = `https://${company.domain}`;
      }
    }

    // 4. Bulk upsert companies
    const companyRecords = Array.from(companyMap.values());
    let created = 0, updated = 0;

    for (const data of companyRecords) {
      const [record, wasCreated] = await Company.findOrCreate({
        where: { slug: data.slug },
        defaults: data
      });

      if (wasCreated) {
        created++;
      } else {
        // Update with any new non-null fields
        const updates = {};
        for (const [key, value] of Object.entries(data)) {
          if (key === 'slug' || key === 'id') continue;
          if (value != null && !record[key]) {
            updates[key] = value;
          }
        }
        if (Object.keys(updates).length > 0) {
          await record.update(updates);
          updated++;
        }
      }
    }

    console.log(`Companies: ${created} created, ${updated} updated`);

    // 5. Link ExternalJobs to Companies via companyId
    // Build slug → companyId map
    const allCompanies = await Company.findAll({
      attributes: ['id', 'slug'],
      raw: true
    });
    const slugToId = new Map(allCompanies.map(c => [c.slug, c.id]));

    // Batch update jobs
    let linked = 0;
    const batchSize = 500;
    const unlinkedJobs = await ExternalJob.findAll({
      where: {
        isActive: true,
        companyId: null,
        company: { [Op.ne]: null }
      },
      attributes: ['id', 'company'],
      raw: true
    });

    console.log(`Linking ${unlinkedJobs.length} jobs to companies...`);

    for (let i = 0; i < unlinkedJobs.length; i += batchSize) {
      const batch = unlinkedJobs.slice(i, i + batchSize);
      const updates = [];

      for (const job of batch) {
        const slug = makeSlug(job.company);
        const companyId = slugToId.get(slug);
        if (companyId) {
          updates.push({ jobId: job.id, companyId });
        }
      }

      // Execute batch updates
      for (const { jobId, companyId } of updates) {
        await ExternalJob.update(
          { companyId },
          { where: { id: jobId } }
        );
        linked++;
      }

      process.stdout.write(`\r  Linked ${linked} jobs...`);
    }

    console.log(`\nDone! Linked ${linked} jobs to companies.`);

    // 6. Summary stats
    const stats = await Company.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('logoUrl')), 'withLogo'],
        [sequelize.fn('COUNT', sequelize.col('industry')), 'withIndustry'],
        [sequelize.fn('COUNT', sequelize.col('employeeCount')), 'withEmployeeCount'],
        [sequelize.fn('COUNT', sequelize.col('domain')), 'withDomain'],
      ],
      raw: true
    });
    console.log('\nCompany data coverage:');
    console.log(JSON.stringify(stats[0], null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
