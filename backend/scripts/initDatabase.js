const { sequelize } = require('../models');

const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Sync all models
    await sequelize.sync({ force: true });
    console.log('✓ Database tables created successfully');

    console.log('\nDatabase initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    process.exit(1);
  }
};

initDatabase();
