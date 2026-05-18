/**
 * Slug helpers for user / profile public URLs.
 *
 * Used by:
 *   - routes/auth.js  (generate slug on user create — register / Google / GitHub)
 *   - routes/profiles.js  (look up by slug at GET /profiles/:id)
 *   - scripts/backfillUserSlugs.js  (backfill existing users)
 */

/**
 * Convert an arbitrary string to a URL-safe slug.
 *   slugify("Saeed Darvish")          → "saeed-darvish"
 *   slugify("  Anna-María O'Brien!")  → "anna-maria-obrien"
 *   slugify("---")                    → ""
 */
const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .normalize('NFKD')                       // strip accents
    .replace(/[\u0300-\u036f]/g, '')         // remove combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')            // drop everything except alnum, space, hyphen
    .replace(/\s+/g, '-')                    // spaces → single hyphen
    .replace(/-+/g, '-')                     // collapse repeated hyphens
    .replace(/^-+|-+$/g, '');                // trim leading/trailing hyphens
};

/**
 * UUID v1-v5 detection. Used by /profiles/:id so the same param can be a slug
 * (saeed-darvish) or a UUID (legacy / direct DB id).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/**
 * Reserved paths that must never be a slug, otherwise /profile/<reserved>
 * would shadow real routes.
 */
const RESERVED_SLUGS = new Set([
  'me', 'admin', 'api', 'auth', 'edit', 'create', 'create-form',
  'new', 'login', 'logout', 'register', 'signup', 'signin',
  'settings', 'dashboard', 'browse', 'search', 'public', 'private',
]);

/**
 * Build a unique slug for a User, given a Sequelize User model.
 *
 *   await buildUniqueUserSlug(User, 'Saeed', 'Darvish')   // first user
 *     → "saeed-darvish"
 *   await buildUniqueUserSlug(User, 'Saeed', 'Darvish')   // already taken
 *     → "saeed-darvish-2"
 *
 * If firstName + lastName produce an empty slug (e.g. names that contain only
 * non-Latin characters that strip to nothing), we fall back to "user-<random>".
 *
 * @param {object} User      Sequelize User model
 * @param {string} firstName
 * @param {string} lastName
 * @param {object} [opts]
 * @param {string} [opts.excludeUserId]  Skip this user when checking uniqueness
 *                                       (useful when re-generating for an existing user).
 */
const buildUniqueUserSlug = async (User, firstName, lastName, opts = {}) => {
  const { Op } = require('sequelize');
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  let base = slugify(fullName);

  if (!base || RESERVED_SLUGS.has(base)) {
    base = `user-${Math.random().toString(36).slice(2, 8)}`;
  }

  const where = (slug) => ({
    slug,
    ...(opts.excludeUserId ? { id: { [Op.ne]: opts.excludeUserId } } : {}),
  });

  // Try the bare slug first, then -2, -3, … up to a sensible cap.
  let candidate = base;
  for (let n = 1; n <= 1000; n++) {
    if (n > 1) candidate = `${base}-${n}`;
    const taken = await User.findOne({ where: where(candidate), attributes: ['id'] });
    if (!taken) return candidate;
  }
  // Extreme collision case: append random suffix
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

module.exports = {
  slugify,
  isUuid,
  buildUniqueUserSlug,
  RESERVED_SLUGS,
};
