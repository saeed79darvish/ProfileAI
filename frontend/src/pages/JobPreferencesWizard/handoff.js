/**
 * Pure transforms that map JobPreferencesWizard state into the shape the
 * ProfileForm editor consumes via `location.state.resumeData`.
 *
 * Extracted so the mapping is unit-testable and so the editor and wizard
 * stay in sync on per-row fields like `employmentType` and the
 * "currently here" state — historically dropped in the handoff.
 */

// Wizard EMPLOYMENT_TYPES ids (lowercase, hyphenated) → ProfileForm dropdown
// values (capitalized first word). Mirrors the <option> list in
// ProfileForm/index.jsx (around line 2992).
const EMPLOYMENT_TYPE_BY_WIZARD_ID = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
};

/**
 * Translate a wizard EMPLOYMENT_TYPES id (e.g. 'full-time') into the value
 * the editor's dropdown expects (e.g. 'Full-time'). Returns '' for unknown
 * or missing ids so the editor falls back to "Select type".
 *
 * @param {string|undefined|null} wizardId
 * @returns {string}
 */
export const wizardEmploymentTypeToEditorValue = (wizardId) =>
  EMPLOYMENT_TYPE_BY_WIZARD_ID[String(wizardId || '').toLowerCase()] || '';

/**
 * Pick a sensible default `employmentType` for a wizard experience row.
 * The wizard doesn't collect per-role employment type — it asks for
 * opportunity-type preferences globally — so we have to infer.
 *
 * Precedence:
 *   1. careerStage === 'internship' → 'Internship'
 *   2. First selected wizard `employmentTypes` (mapped to editor value)
 *   3. '' (editor dropdown stays at "Select type")
 *
 * @param {{ employmentTypes?: string[], careerStage?: string }} prefs
 * @returns {string}
 */
export const inferDefaultEmploymentType = (prefs = {}) => {
  if (prefs.careerStage === 'internship') return 'Internship';
  const first = Array.isArray(prefs.employmentTypes) ? prefs.employmentTypes[0] : '';
  return wizardEmploymentTypeToEditorValue(first);
};

/**
 * Transform a single wizard experience row into the shape the ProfileForm
 * editor expects.
 *
 *  - When `current: true`, the editor's "Present · ongoing role" pill is
 *    driven by `endDate === 'Present'` (see `isPresentValue` in
 *    @/utils/dateRange) — NOT by a separate boolean. We force the sentinel
 *    string here so the editor renders the pill instead of an empty End
 *    date input. This is the fix for the data-loss bug where the
 *    checkbox arrived unchecked and end-date was blank.
 *  - `currentlyWorking` is emitted alongside as a semantic alias. The
 *    editor doesn't read it today, but JSONB storage preserves it for
 *    downstream consumers / future migration off the sentinel string.
 *  - `employmentType` is seeded via `inferDefaultEmploymentType` since the
 *    wizard's experience rows have no per-row employment-type field.
 *
 * @param {{
 *   title?: string, company?: string,
 *   startDate?: string, endDate?: string,
 *   current?: boolean, description?: string
 * }} row
 * @param {{ employmentTypes?: string[], careerStage?: string }} prefs
 */
export const mapWizardExperienceToEditor = (row = {}, prefs = {}) => {
  const isCurrent = !!row.current;
  return {
    title: row.title || '',
    company: row.company || '',
    startDate: row.startDate || '',
    // The wizard disables the End-date input when "I currently work here"
    // is ticked but doesn't clear the underlying string, so the checkbox
    // is authoritative — override any stale endDate.
    endDate: isCurrent ? 'Present' : (row.endDate || ''),
    currentlyWorking: isCurrent,
    description: row.description || '',
    employmentType: inferDefaultEmploymentType(prefs),
  };
};

/**
 * Adapter that maps wizard state into the Profile-shaped object that the
 * canonical `computeProfileCompletion` consumes. This is what lets the
 * wizard meter, the editor sidebar, the success modal, and the Dashboard
 * card all report the same percentage for the same logical profile.
 *
 * Caveats baked into the mapping:
 *   - The wizard never collects a summary or a profile photo — those are
 *     added in the editor afterwards. Both come through as empty here,
 *     which correctly costs the user ~22% of completion (2 of 9 items).
 *     That's intentional: a wizard-only profile should not show 100%.
 *   - The wizard's `githubUsername` is a bare handle. We synthesise a
 *     full github URL so the rubric's "links" check passes.
 *
 * @param {object} data wizard state (the `data` useState above)
 * @returns {object} profile-shaped object
 */
export const wizardDataToProfileShape = (data = {}) => {
  const github = (data.githubUsername || '').trim();
  return {
    title: data.title || '',
    location: data.location || '',
    summary: '', // wizard doesn't capture summary
    profilePicture: '', // wizard doesn't capture photo
    skills: data.skills || [], // flat array; computeProfileCompletion handles both shapes
    experience: data.experience || [],
    education: data.education || [],
    projects: data.projects || [],
    linkedinUrl: '',
    githubUrl: github ? `https://github.com/${github}` : '',
    portfolioUrl: data.portfolioUrl || '',
  };
};

// Source-code hosts that should populate the editor's "GitHub / Source Code"
// field instead of "Live Demo". Matched on registrable hostname (parsed via
// URL — substring matching is too lax and would route a phishing host like
// "github.com.evil.com" to the source-code field).
const SOURCE_CODE_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'gitlab.com',
  'www.gitlab.com',
  'bitbucket.org',
  'www.bitbucket.org',
]);

/**
 * Return true when `value` is a syntactically valid http(s) URL whose
 * hostname is one of the well-known source-code hosts above.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export const isSourceCodeUrl = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return SOURCE_CODE_HOSTS.has(parsed.hostname.toLowerCase());
};

/**
 * Transform a single wizard project row into the shape the ProfileForm
 * editor expects.
 *
 * The wizard has ONE URL input per project; the editor has two — Live Demo
 * (`url`) and GitHub / Source Code (`githubUrl`). To preserve user intent
 * without making the wizard more complex, we route by hostname:
 *
 *   - github.com / gitlab.com / bitbucket.org  → editor `githubUrl`
 *   - everything else valid                    → editor `url` (live demo)
 *   - empty / unparseable                      → both empty
 *
 * Other fields (title, role, description) pass through unchanged so the
 * editor's existing project schema (technologies, imageUrl, startDate,
 * endDate) defaults to empty for fields the wizard doesn't collect.
 *
 * @param {{ title?: string, role?: string, description?: string, url?: string }} p
 * @returns {object} editor-shaped project row
 */
export const mapWizardProjectToEditor = (p = {}) => {
  const rawUrl = (p.url || '').trim();
  const routesToSource = isSourceCodeUrl(rawUrl);
  return {
    title: p.title || '',
    role: p.role || '',
    description: p.description || '',
    url: routesToSource ? '' : rawUrl,
    githubUrl: routesToSource ? rawUrl : '',
    technologies: [],
    imageUrl: '',
    startDate: '',
    endDate: '',
  };
};
