const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  logging: false
});

(async () => {
  try {
    const [posts] = await sequelize.query('SELECT id, content FROM "Posts"');
    
    for (const post of posts) {
      if (!post.content) continue;
      
      // Split into sentences and deduplicate
      const sentences = post.content.split(/(?<=[.!?])\s+/);
      const seen = new Set();
      const unique = [];
      for (const s of sentences) {
        const normalized = s.toLowerCase().replace(/\s+/g, ' ').trim();
        if (normalized.length > 20 && !seen.has(normalized)) {
          seen.add(normalized);
          unique.push(s);
        } else if (normalized.length <= 20) {
          unique.push(s);
        }
      }
      const cleaned = unique.join(' ');
      
      if (cleaned.length < post.content.length) {
        console.log('Cleaning post:', post.id);
        console.log('Before:', post.content.length, 'chars | After:', cleaned.length, 'chars');
        await sequelize.query('UPDATE "Posts" SET content = $1 WHERE id = $2', {
          bind: [cleaned, post.id]
        });
      }
    }
    console.log('Done!');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
