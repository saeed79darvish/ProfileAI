/**
 * Saved work preferences onto jobs-page filters.
 *
 * The coach asks how someone wants to work (remote, hybrid, on-site,
 * flexible) and what kind of work they want (full-time, contract...). Those
 * answers live on the career context, and two places turn them into filters:
 * the matches pop-up at the end of onboarding and the jobs page on a fresh
 * visit. One mapping, so the two never disagree about what a preference means.
 */

// Every employment type the jobs feed knows (ExternalJobs.employmentType).
const FEED_EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'temporary'];

/* Coach answers that are not feed values map onto the nearest one. Freelance
   work is posted as contract work; an apprenticeship is posted beside
   internships; seasonal hospitality work is posted as temporary. */
const ROLE_TYPE_TO_FEED = {
  'full-time': 'full-time',
  'part-time': 'part-time',
  contract: 'contract',
  freelance: 'contract',
  internship: 'internship',
  apprenticeship: 'internship',
  seasonal: 'temporary',
  temporary: 'temporary',
};

const LOCATION_TYPES = ['remote', 'hybrid', 'onsite'];

/**
 * @param {{ workStyle?: string, roleTypes?: string[] }} prefs
 * @returns {{ locationType?: string, employmentType?: string }} jobs-page
 *   filters. employmentType is comma-separated when several types were picked,
 *   which the feed treats as "any of these". "Flexible", or every type picked,
 *   means no filter, which is what the jobs page calls "Any".
 */
export const jobFiltersFrom = (prefs = {}) => {
  const filters = {};
  if (LOCATION_TYPES.includes(prefs?.workStyle)) filters.locationType = prefs.workStyle;
  const roleTypes = Array.isArray(prefs?.roleTypes) ? prefs.roleTypes : [];
  const types = [...new Set(roleTypes.map((t) => ROLE_TYPE_TO_FEED[String(t).toLowerCase()]).filter(Boolean))];
  if (types.length && types.length < FEED_EMPLOYMENT_TYPES.length) {
    // Feed order, so the same preferences always produce the same URL.
    filters.employmentType = FEED_EMPLOYMENT_TYPES.filter((t) => types.includes(t)).join(',');
  }
  return filters;
};

const EMPLOYMENT_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
};

/** "full-time,contract" as "Full-time, Contract" for a filter chip. */
export const employmentTypeLabel = (value = '') => String(value)
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)
  .map((t) => EMPLOYMENT_LABELS[t] || t)
  .join(', ');

const LOCATION_LABELS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

/** "onsite" as "On-site" for a filter chip. */
export const locationTypeLabel = (value = '') => LOCATION_LABELS[value] || value;
