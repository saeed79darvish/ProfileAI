const { sequelize, Post } = require('../models');

async function cleanOldImages() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Update posts with local file paths to have null imageUrl
    const [updatedCount] = await Post.update(
      { imageUrl: null },
      {
        where: {
          imageUrl: {
            [sequelize.Sequelize.Op.like]: '/uploads/%'
          }
        }
      }
    );

    console.log(`✓ Updated ${updatedCount} posts with old local image paths`);
    
    // Show remaining posts with images
    const postsWithImages = await Post.count({
      where: {
        imageUrl: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    });
    
    console.log(`✓ Posts with valid images remaining: ${postsWithImages}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning old images:', error);
    process.exit(1);
  }
}

cleanOldImages();
