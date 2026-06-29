/**
 * Pluralize a noun based on count.
 *
 * Returns just the noun, leaving formatting (e.g. "1 Role" vs "2 Roles")
 * to the caller. English convention is followed: count of 0 takes the
 * plural form ("0 Roles").
 *
 *   pluralize(1, 'Role')                  // 'Role'
 *   pluralize(0, 'Role')                  // 'Roles'
 *   pluralize(2, 'Role')                  // 'Roles'
 *
 * For irregular plurals, pass the plural form explicitly:
 *   pluralize(2, 'child', 'children')     // 'children'
 *
 * For mass nouns where the label should be identical regardless of
 * count (e.g. "Education"), pass the same string twice to make the
 * opt-out explicit at the call site:
 *   pluralize(1, 'Education', 'Education') // 'Education'
 *
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]  Defaults to `singular + 's'`.
 * @returns {string}
 */
export const pluralize = (count, singular, plural) =>
  count === 1 ? singular : (plural ?? `${singular}s`);
