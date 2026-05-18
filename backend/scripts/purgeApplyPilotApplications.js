#!/usr/bin/env node
/**
 * Hard-delete every ApplyPilotApplication row for a user so the queue
 * can be re-tested from scratch.
 *
 * Usage:
 *   node backend/scripts/purgeApplyPilotApplications.js <userEmail>
 *   node backend/scripts/purgeApplyPilotApplications.js --userId <uuid>
 *   node backend/scripts/purgeApplyPilotApplications.js --all   # every user (DEV ONLY)
 */
require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { ApplyPilotApplication, User } = require('../models');

(async () => {
  try {
    const args = process.argv.slice(2);
    let where = null;

    if (args.includes('--all')) {
      where = {};
      console.log('[purge] Deleting ApplyPilot applications for ALL users.');
    } else if (args.includes('--userId')) {
      const userId = args[args.indexOf('--userId') + 1];
      if (!userId) throw new Error('--userId requires a UUID');
      where = { userId };
      console.log(`[purge] Deleting ApplyPilot applications for userId=${userId}`);
    } else {
      const email = args[0];
      if (!email) {
        console.error('Usage: node backend/scripts/purgeApplyPilotApplications.js <email>');
        process.exit(1);
      }
      const user = await User.findOne({ where: { email } });
      if (!user) throw new Error(`No user with email ${email}`);
      where = { userId: user.id };
      console.log(`[purge] Deleting ApplyPilot applications for ${email} (userId=${user.id})`);
    }

    const before = await ApplyPilotApplication.count({ where });
    console.log(`[purge] Rows matched: ${before}`);

    const deleted = await ApplyPilotApplication.destroy({ where });
    console.log(`[purge] Deleted ${deleted} rows.`);

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('[purge] failed:', err);
    process.exit(1);
  }
})();
