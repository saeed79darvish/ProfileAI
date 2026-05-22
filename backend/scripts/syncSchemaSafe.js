const { sequelize } = require('../models');

/**
 * One-off safe schema sync for environments where tables are missing.
 * Uses alter mode (no force/drop) so existing data is preserved.
 */
async function syncSchemaSafe() {
  try {
    console.log('Starting safe schema sync...');
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    await sequelize.sync({ alter: true });
    console.log('✓ Schema synchronized (alter mode, non-destructive)');

    process.exit(0);
  } catch (error) {
    console.error('✗ Safe schema sync failed:', error);
    process.exit(1);
  }
}

syncSchemaSafe();
