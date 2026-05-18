/**
 * Backfill slugs for existing users.
 *
 * Why: when slug support shipped, existing rows had `slug = null`.
 * This script generates a unique slug for every user that's missing one
 * (idempotent — safe to re-run).
 *
 * Usage:
 *   node scripts/backfillUserSlugs.js
 *
 * To preview without writing:
 *   DRY_RUN=1 node scripts/backfillUserSlugs.js
 */
const { sequelize, User } = require('../models');
const { buildUniqueUserSlug } = require('../utils/slug');

const DRY_RUN = process.env.DRY_RUN === '1';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    const users = await User.findAll({
      where: { slug: null },
      attributes: ['id', 'firstName', 'lastName', 'slug'],
      order: [['createdAt', 'ASC']], // Older accounts get the bare slug; newer get -2, -3
    });

    console.log(`Found ${users.length} user(s) without a slug.`);
    if (DRY_RUN) console.log('(DRY_RUN — no writes will happen)');

    let success = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const slug = await buildUniqueUserSlug(
          User,
          user.firstName,
          user.lastName,
          { excludeUserId: user.id }
        );

        if (DRY_RUN) {
          console.log(`  [DRY] ${user.id}  ${user.firstName} ${user.lastName}  →  ${slug}`);
        } else {
          await user.update({ slug });
          console.log(`  ✓     ${user.id}  ${user.firstName} ${user.lastName}  →  ${slug}`);
        }
        success++;
      } catch (err) {
        console.error(`  ✗     ${user.id}  ${user.firstName} ${user.lastName}  failed:`, err.message);
        failed++;
      }
    }

    console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
})();
