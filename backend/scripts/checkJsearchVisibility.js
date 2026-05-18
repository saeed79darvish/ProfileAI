require('dotenv').config();
const { sequelize } = require('../models');

async function check() {
  try {
    // Check source distribution in top 500 nearest neighbors using a JSearch job as query vector
    const rows = await sequelize.query(`
      SELECT source, COUNT(*) as cnt FROM (
        SELECT ej.source
        FROM "ExternalJobs" ej,
             (SELECT embedding FROM "ExternalJobs" WHERE source = 'jsearch' AND embedding IS NOT NULL LIMIT 1) s
        WHERE ej."isActive" = true AND ej.embedding IS NOT NULL
        ORDER BY ej.embedding <=> s.embedding
        LIMIT 500
      ) sub
      GROUP BY source
      ORDER BY cnt DESC
    `, { type: sequelize.constructor.QueryTypes.SELECT });
    
    console.log('Source distribution in top 500 nearest neighbors (using JSearch job embedding as query):');
    rows.forEach(r => console.log(`  ${r.source}: ${r.cnt}`));

    // Also check: what about top 20 (first page)?
    const top20 = await sequelize.query(`
      SELECT source, COUNT(*) as cnt FROM (
        SELECT ej.source
        FROM "ExternalJobs" ej,
             (SELECT embedding FROM "ExternalJobs" WHERE source = 'jsearch' AND embedding IS NOT NULL LIMIT 1) s
        WHERE ej."isActive" = true AND ej.embedding IS NOT NULL
        ORDER BY ej.embedding <=> s.embedding
        LIMIT 20
      ) sub
      GROUP BY source
      ORDER BY cnt DESC
    `, { type: sequelize.constructor.QueryTypes.SELECT });
    
    console.log('\nSource distribution in top 20 (first page):');
    top20.forEach(r => console.log(`  ${r.source}: ${r.cnt}`));

    // Check if JSearch embedding dimensions match Greenhouse embedding dimensions
    const dims = await sequelize.query(`
      SELECT source, array_length(embedding::real[], 1) as dim_count
      FROM "ExternalJobs"
      WHERE embedding IS NOT NULL
      GROUP BY source, array_length(embedding::real[], 1)
      ORDER BY source
    `, { type: sequelize.constructor.QueryTypes.SELECT });

    console.log('\nEmbedding dimensions by source:');
    dims.forEach(r => console.log(`  ${r.source}: ${r.dim_count} dims`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

check();
