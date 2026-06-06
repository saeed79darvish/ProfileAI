/**
 * Manual test / one-off runner for the daily job-match digest email.
 *
 * Usage:
 *   node scripts/send-job-digest.js                # send to all eligible candidates
 *   node scripts/send-job-digest.js you@email.com  # send only to one user (test)
 */
require('dotenv').config();

const { User, Profile } = require('../models');
const { runDailyJobDigest, sendDigestToUser } = require('../services/jobDigestService');

async function main() {
  const targetEmail = process.argv[2];

  if (targetEmail) {
    const user = await User.findOne({
      where: { email: targetEmail },
      include: [{ model: Profile, as: 'profile' }],
    });
    if (!user) {
      console.error(`No user found with email ${targetEmail}`);
      process.exit(1);
    }
    console.log(`Sending test digest to ${targetEmail}...`);
    const ok = await sendDigestToUser(user);
    console.log(ok ? '✅ Sent (or no matches/profile → skipped).' : '⚠️  Skipped: no profile or no matching jobs.');
  } else {
    const result = await runDailyJobDigest();
    console.log('Result:', result);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
