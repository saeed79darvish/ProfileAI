// Default name for a downloaded resume: <First>-<Last>-<Role>-<Company>, e.g.
// Saeed-Darvish-Software-Engineer-Google. Recruiters and ATS uploads see this
// name, and some email clients cut names past ~40 characters, so it stays within
// RESUME_FILENAME_MAX by dropping whole words from the front of the role, which
// keeps the job itself ("Engineer", "Manager") over its qualifiers.
//
// A name already used for a download gets a number, so two resumes for the same
// company do not overwrite each other in a downloads folder: Google, then
// Google-2, Google-3 (see uniqueResumeName and rememberResumeName).

export const RESUME_FILENAME_MAX = 40;

// Spellings that would otherwise come out as "Front-End" or "Fullstack".
const KNOWN_WORDS = {
  'front-end': 'Frontend',
  frontend: 'Frontend',
  'back-end': 'Backend',
  backend: 'Backend',
  'full-stack': 'FullStack',
  fullstack: 'FullStack',
};

// "Acme Inc." is "Acme" in a file name.
const COMPANY_SUFFIX = /\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|plc)\.?$/i;

function fileWord(word) {
  const known = KNOWN_WORDS[word.toLowerCase().replace(/[^a-z-]/g, '')];
  if (known) return known;
  return word
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .split('-')
    .filter(Boolean)
    // Acronyms keep their capitals (UI, AWS, QA); other words are title-cased.
    .map((part) => (/^[\p{Lu}\p{N}]{2,5}$/u.test(part)
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}

const words = (text) => String(text || '').split(/\s+/).map(fileWord).filter(Boolean);

export function buildResumeFilename(fullName, title, company) {
  const nameWords = words(fullName);
  if (!nameWords.length) nameWords.push('Candidate');
  // The role is the title up to its first qualifier:
  // "Staff Front-end UI Architect, Full-Stack" keeps "Staff Front-end UI Architect".
  const role = words(String(title || '').split(/[,|(/–—]|\s-\s/)[0]);
  const companyWords = words(String(company || '').replace(COMPANY_SUFFIX, '').trim());

  const join = () => [...nameWords, ...role, ...companyWords].join('-');
  while (role.length > 1 && join().length > RESUME_FILENAME_MAX) role.shift();
  // Still too long (a long company name): the company is cut from its end.
  while (companyWords.length > 1 && join().length > RESUME_FILENAME_MAX) companyWords.pop();

  const out = join();
  if (!role.length && !companyWords.length) return `${out}-Resume`.slice(0, RESUME_FILENAME_MAX);
  return out.slice(0, RESUME_FILENAME_MAX).replace(/-+$/, '');
}

// Names already downloaded, in this browser. Per user, so a shared computer does
// not number one person's resumes by another's.
const USED_KEY = 'profileai_resume_names';
const USED_CAP = 300;
const key = (userId) => `${USED_KEY}:${userId || 'anon'}`;

export function usedResumeNames(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(list) ? list.map((n) => String(n).toLowerCase()) : [];
  } catch {
    return [];
  }
}

export function rememberResumeName(userId, name) {
  const clean = String(name || '').replace(/\.(pdf|docx)$/i, '').trim().toLowerCase();
  if (!clean) return;
  try {
    const list = usedResumeNames(userId).filter((n) => n !== clean);
    list.push(clean);
    localStorage.setItem(key(userId), JSON.stringify(list.slice(-USED_CAP)));
  } catch { /* storage can be unavailable (private window, blocked site data) */ }
}

/** `base`, or `base-2`, `base-3` ... the first one not in `used` (lower-cased names). */
export function uniqueResumeName(base, used = []) {
  const taken = new Set(used.map((n) => String(n).toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, RESUME_FILENAME_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}
