#!/usr/bin/env node

/**
 * Promote a user to admin role by email address.
 * 
 * Usage:
 *   node scripts/promote-admin.js user@example.com
 *   node scripts/promote-admin.js user@example.com --demote   (revert to candidate)
 */

const { User } = require('../models');
const { sequelize } = require('../models');

const email = process.argv[2];
const demote = process.argv.includes('--demote');

if (!email) {
  console.error('Usage: node scripts/promote-admin.js <email> [--demote]');
  process.exit(1);
}

(async () => {
  try {
    await sequelize.authenticate();

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      console.error(`✗ No user found with email: ${email}`);
      process.exit(1);
    }

    if (demote) {
      if (user.role !== 'admin') {
        console.log(`ℹ User ${email} is already "${user.role}", not admin.`);
        process.exit(0);
      }
      user.role = 'candidate';
      await user.save();
      console.log(`✓ Demoted ${user.firstName} ${user.lastName} (${email}) from admin → candidate`);
    } else {
      if (user.role === 'admin') {
        console.log(`ℹ User ${email} is already an admin.`);
        process.exit(0);
      }
      const previousRole = user.role;
      user.role = 'admin';
      await user.save();
      console.log(`✓ Promoted ${user.firstName} ${user.lastName} (${email}) from ${previousRole} → admin`);
    }

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
})();
