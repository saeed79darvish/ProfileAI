// One-off: mark the demo "John Doe" account email as verified so it can use
// gated features (AI tailoring, extension) without a real inbox.
//
// Usage (from backend/):  node scripts/verify-demo-account.js
//
// Uses the backend's own DB connection (backend/.env), so it talks to the
// same database the API uses. Safe to re-run.

require('dotenv').config();
const { User } = require('../models');

const DEMO_EMAIL = 'john.doe.demo@profilleai.com';

(async () => {
  try {
    const user = await User.findOne({ where: { email: DEMO_EMAIL } });
    if (!user) {
      console.error(`❌ No user found with email ${DEMO_EMAIL}. Run the seed script first.`);
      process.exit(1);
    }

    await user.update({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationCode: null,
      emailVerificationExpiresAt: null,
    });

    console.log(`✅ ${DEMO_EMAIL} is now email-verified.`);
    console.log('   You can log in and use all features for screenshots.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to verify demo account:', err.message);
    process.exit(1);
  }
})();
