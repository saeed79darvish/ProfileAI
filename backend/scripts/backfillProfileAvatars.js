/**
 * Backfill Profile.profilePicture and RecruiterProfile.profilePicture
 * from User.profilePictureUrl (captured during Google/GitHub OAuth).
 *
 * Why: SSO sign-in stores the provider photo on the User row, but
 * profiles created before the seed-on-create logic shipped have
 * profilePicture = NULL. The runtime GET /profiles/me backfill (added
 * in 780a01e) only fixes a row on first read by its owner. This script
 * fixes every existing row in one pass — useful right after the deploy
 * so support doesn't have to wait for each user to revisit /profile.
 *
 * Idempotent. Only touches rows where profilePicture IS NULL and the
 * linked user has a non-null profilePictureUrl. Re-running is a no-op.
 *
 * Usage:
 *   node scripts/backfillProfileAvatars.js
 *
 * Dry-run (logs intended writes, doesn't touch the DB):
 *   DRY_RUN=1 node scripts/backfillProfileAvatars.js
 */
const { sequelize, User, Profile, RecruiterProfile } = require('../models');

const DRY_RUN = process.env.DRY_RUN === '1';

async function backfillTable(Model, label) {
  const rows = await Model.findAll({
    where: { profilePicture: null },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'profilePictureUrl'],
      required: true,
      where: {
        profilePictureUrl: { [sequelize.Sequelize.Op.ne]: null },
      },
    }],
  });

  console.log(`\n[${label}] candidates for backfill: ${rows.length}`);
  if (rows.length === 0) return { updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const url = row.user?.profilePictureUrl;
    if (!url) { skipped += 1; continue; }
    if (DRY_RUN) {
      console.log(`  [dry-run] ${label} #${row.id} (${row.user.email}) → ${url.slice(0, 80)}`);
      updated += 1;
      continue;
    }
    try {
      await row.update({ profilePicture: url });
      updated += 1;
    } catch (err) {
      console.warn(`  ! failed for ${label} #${row.id}: ${err.message}`);
      skipped += 1;
    }
  }
  console.log(`[${label}] updated=${updated} skipped=${skipped}`);
  return { updated, skipped };
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established');
    console.log(DRY_RUN ? '(dry-run mode — no writes)' : '(writing changes)');

    const candidate = await backfillTable(Profile, 'Profile');
    const recruiter = await backfillTable(RecruiterProfile, 'RecruiterProfile');

    console.log('\n— Summary —');
    console.log(`  Profile         updated=${candidate.updated} skipped=${candidate.skipped}`);
    console.log(`  RecruiterProfile updated=${recruiter.updated} skipped=${recruiter.skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
})();
