require('dotenv').config();
const { Company } = require('../models');
const { Op } = require('sequelize');

(async () => {
  // Count by logo pattern
  const clearbitCount = await Company.count({ where: { logoUrl: { [Op.like]: '%clearbit%' } } });
  const otherCount = await Company.count({ where: { logoUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.notLike]: '%clearbit%' }] } } });
  const nullCount = await Company.count({ where: { logoUrl: null } });
  console.log('=== Logo sources ===');
  console.log('Clearbit:', clearbitCount);
  console.log('Other (e.g. TheirStack/JSearch):', otherCount);
  console.log('None:', nullCount);

  // Show some non-clearbit logos
  const others = await Company.findAll({
    where: { logoUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.notLike]: '%clearbit%' }] } },
    attributes: ['name', 'logoUrl'],
    raw: true, limit: 10
  });
  console.log('\n=== Non-Clearbit logos ===');
  for (const c of others) console.log(c.name, '->', c.logoUrl?.substring(0, 120));

  // Test Clearbit URL accessibility
  const https = require('https');
  const testUrl = (url) => new Promise((resolve) => {
    https.get(url, { timeout: 5000 }, (res) => {
      resolve({ status: res.statusCode, type: res.headers['content-type'] });
    }).on('error', (e) => resolve({ error: e.message }));
  });

  console.log('\n=== Testing Clearbit logo URLs ===');
  const testDomains = ['okta.com', 'plaid.com', 'cloudflare.com', 'fidelity.com', 'google.com'];
  for (const domain of testDomains) {
    const result = await testUrl(`https://logo.clearbit.com/${domain}?size=128`);
    console.log(`logo.clearbit.com/${domain}:`, JSON.stringify(result));
  }

  console.log('\n=== Testing Alternative Logo APIs ===');
  const testDomains2 = ['okta.com', 'plaid.com', 'cloudflare.com'];

  // img.logo.dev (new Clearbit replacement by same team)
  for (const domain of testDomains2) {
    const result = await testUrl(`https://img.logo.dev/${domain}?token=pk_anonymous&size=128`);
    console.log(`img.logo.dev/${domain}:`, JSON.stringify(result));
  }

  // favicon.im
  for (const domain of testDomains2) {
    const result = await testUrl(`https://favicon.im/${domain}?larger=true`);
    console.log(`favicon.im/${domain}:`, JSON.stringify(result));
  }

  // Unavatar (aggregator)
  for (const domain of testDomains2) {
    const result = await testUrl(`https://unavatar.io/${domain}?fallback=false`);
    console.log(`unavatar.io/${domain}:`, JSON.stringify(result));
  }

  // DuckDuckGo icons  
  for (const domain of testDomains2) {
    const result = await testUrl(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    console.log(`duckduckgo/${domain}:`, JSON.stringify(result));
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
