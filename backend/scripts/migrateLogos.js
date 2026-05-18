/**
 * Migrate broken Clearbit logo URLs to working alternatives.
 * 
 * Strategy:
 *   1. For companies with a domain, try to find a TheirStack logo from ExternalJob metadata
 *   2. Fall back to DuckDuckGo icon API (always works, returns favicons)
 *
 * Usage: cd backend && node scripts/migrateLogos.js
 */
require('dotenv').config();
const { Company, ExternalJob } = require('../models');
const { Op } = require('sequelize');

async function main() {
  // Find all companies with broken Clearbit logos
  const companies = await Company.findAll({
    where: { logoUrl: { [Op.like]: '%clearbit%' } },
    attributes: ['id', 'name', 'slug', 'domain', 'logoUrl'],
    raw: true
  });

  console.log(`Found ${companies.length} companies with Clearbit logos to migrate`);

  let theirStackCount = 0;
  let duckduckgoCount = 0;
  let skipped = 0;

  for (const company of companies) {
    // Try to find a TheirStack logo from job metadata
    let newLogoUrl = null;

    const theirStackJob = await ExternalJob.findOne({
      where: {
        companyId: company.id,
        source: 'theirstack',
        isActive: true
      },
      attributes: ['metadata'],
      raw: true
    });

    if (theirStackJob?.metadata?.company_logo) {
      const logo = theirStackJob.metadata.company_logo;
      if (typeof logo === 'string' && logo.startsWith('http')) {
        newLogoUrl = logo;
        theirStackCount++;
      }
    }

    // Also check JSearch employer_logo
    if (!newLogoUrl) {
      const jsearchJob = await ExternalJob.findOne({
        where: {
          companyId: company.id,
          source: 'jsearch',
          isActive: true
        },
        attributes: ['metadata'],
        raw: true
      });

      if (jsearchJob?.metadata?.employer_logo) {
        const logo = jsearchJob.metadata.employer_logo;
        if (typeof logo === 'string' && logo.startsWith('http')) {
          newLogoUrl = logo;
          theirStackCount++; // count as "sourced from metadata"
        }
      }
    }

    // Also check RemoteOK company_logo
    if (!newLogoUrl) {
      const remoteOKJob = await ExternalJob.findOne({
        where: {
          companyId: company.id,
          source: 'remoteok',
          isActive: true
        },
        attributes: ['metadata'],
        raw: true
      });

      if (remoteOKJob?.metadata?.company_logo) {
        const logo = remoteOKJob.metadata.company_logo;
        if (typeof logo === 'string' && logo.startsWith('http')) {
          newLogoUrl = logo;
          theirStackCount++;
        }
      }
    }

    // Fallback: DuckDuckGo icons API
    if (!newLogoUrl && company.domain) {
      newLogoUrl = `https://icons.duckduckgo.com/ip3/${company.domain}.ico`;
      duckduckgoCount++;
    }

    if (newLogoUrl) {
      await Company.update({ logoUrl: newLogoUrl }, { where: { id: company.id } });
    } else {
      skipped++;
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  From job metadata (TheirStack/JSearch/RemoteOK): ${theirStackCount}`);
  console.log(`  DuckDuckGo fallback: ${duckduckgoCount}`);
  console.log(`  Skipped (no domain): ${skipped}`);

  // Also update companies with null logos that have a domain
  const nullLogos = await Company.findAll({
    where: { logoUrl: null, domain: { [Op.ne]: null } },
    attributes: ['id', 'domain'],
    raw: true
  });
  
  if (nullLogos.length > 0) {
    for (const c of nullLogos) {
      await Company.update(
        { logoUrl: `https://icons.duckduckgo.com/ip3/${c.domain}.ico` },
        { where: { id: c.id } }
      );
    }
    console.log(`  Fixed ${nullLogos.length} companies with null logos`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
