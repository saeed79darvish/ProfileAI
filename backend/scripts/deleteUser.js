/**
 * Delete a user (and cascaded rows) by email.
 *
 * Usage:
 *   cd backend
 *   node scripts/deleteUser.js saeed79darvish@gmail.com
 *   node scripts/deleteUser.js saeed79darvish@gmail.com --dry-run
 */
require('dotenv').config();
const { sequelize, User } = require('../models');

(async () => {
  const email = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!email) {
    console.error('Usage: node scripts/deleteUser.js <email> [--dry-run]');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      console.log(`No user found with email: ${email}`);
      process.exit(0);
    }

    console.log(`Found user id=${user.id} email=${user.email} role=${user.role}`);

    if (dryRun) {
      console.log('Dry run — not deleting.');
      process.exit(0);
    }

    await user.destroy();
    console.log(`Deleted user ${user.id} (${user.email}).`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to delete user:', err);
    process.exit(1);
  }
})();
