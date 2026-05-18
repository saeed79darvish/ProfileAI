const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  { host: process.env.DB_HOST, dialect: 'postgres', logging: false }
);

(async () => {
  try {
    // Delete posts with corrupted content (> 2000 chars)
    const [deleted] = await sequelize.query(`
      DELETE FROM "Posts" 
      WHERE LENGTH(content) > 2000
      RETURNING id
    `);
    console.log('Deleted corrupted posts:', deleted.length);
    
    // Show remaining posts
    const [posts] = await sequelize.query(`
      SELECT id, LEFT(content, 60) as preview, LENGTH(content) as len 
      FROM "Posts" 
      ORDER BY "createdAt" DESC 
      LIMIT 10
    `);
    console.log('\nRemaining posts:');
    posts.forEach(p => console.log(` [${p.len} chars] ${p.preview}...`));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
