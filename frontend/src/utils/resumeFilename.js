// Default name for a downloaded resume: <FirstLast>-<Role>, e.g.
// SaeedDarvish-StaffFrontendUIArchitect. Recruiters and ATS uploads see this
// name, and some email clients cut names past ~40 characters, so it stays
// within RESUME_FILENAME_MAX by dropping whole words from the front of the role,
// which keeps the job itself ("Engineer", "Manager") over its qualifiers.

export const RESUME_FILENAME_MAX = 40;

// Spellings that would otherwise come out as "FrontEnd" or "Fullstack".
const KNOWN_WORDS = {
  'front-end': 'Frontend',
  frontend: 'Frontend',
  'back-end': 'Backend',
  backend: 'Backend',
  'full-stack': 'FullStack',
  fullstack: 'FullStack',
};

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

export function buildResumeFilename(fullName, title) {
  const namePart = String(fullName || '').split(/\s+/).map(fileWord).join('') || 'Candidate';
  // The role is the title up to its first qualifier:
  // "Staff Front-end UI Architect, Full-Stack" keeps "Staff Front-end UI Architect".
  const role = String(title || '').split(/[,|(/–—]|\s-\s/)[0];
  const words = role.split(/\s+/).map(fileWord).filter(Boolean);
  while (words.length && `${namePart}-${words.join('')}`.length > RESUME_FILENAME_MAX) words.shift();
  const name = words.length ? `${namePart}-${words.join('')}` : `${namePart}-Resume`;
  return name.slice(0, RESUME_FILENAME_MAX);
}
