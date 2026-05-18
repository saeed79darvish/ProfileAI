const sequelize = require('../config/database');

/**
 * Migration script to add 'reschedule_requested' to Interview status ENUM
 * Run this script once to update the database:
 * node scripts/addRescheduleRequestedStatus.js
 */
const addRescheduleRequestedStatus = async () => {
  try {
    console.log('Adding reschedule_requested status to Interview model...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Add the new ENUM value to PostgreSQL
    // PostgreSQL requires ALTER TYPE to add new enum values
    await sequelize.query(`
      DO $$ 
      BEGIN
        -- Check if the value already exists before adding
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'reschedule_requested' 
          AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_Interviews_status'
          )
        ) THEN
          ALTER TYPE "enum_Interviews_status" ADD VALUE 'reschedule_requested';
          RAISE NOTICE 'Added reschedule_requested to enum_Interviews_status';
        ELSE
          RAISE NOTICE 'reschedule_requested already exists in enum_Interviews_status';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error or enum type does not exist: %', SQLERRM;
      END $$;
    `);

    console.log('✓ Migration complete! reschedule_requested status is now available.');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
};

addRescheduleRequestedStatus();
