/**
 * Builds the payload the download path posts to /resume/generate.
 *
 * This lived inline in TailoredResults and carried the bug that made every
 * tailored resume come back with the SAME headline: `title` was resolved as
 * `profile.title || tailoredProfile.title`, so the candidate's stored profile
 * title won unconditionally and the JD-mirrored title the tailoring engine
 * produced was unreachable for anyone whose profile had a title set. A resume
 * tailored to a Staff posting shipped with the "Senior Software Engineer"
 * headline from the stored profile.
 *
 * Extracted here so the precedence is testable without mounting React — the
 * ordering is the whole point of the function and nothing was measuring it.
 */

export interface TailoredForDownload {
  title?: string;
  jobTitle?: string;
  company?: string;
  summary?: string;
  skills?: string[];
  skillsGrouped?: Record<string, string[]>;
  experience?: any[];
  education?: any[];
  projects?: any[];
  matchScore?: number;
}

export interface ProfileForDownload {
  firstName?: string;
  lastName?: string;
  email?: string;
  title?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary?: string;
  skills?: string[];
  experience?: any[];
  education?: any[];
  certifications?: any[];
  projects?: any[];
}

/**
 * The headline the resume is rendered with.
 *
 * Precedence, most specific first:
 *   1. `tailoredProfile.title` — the engine's JD-mirrored title. This is the
 *      field the tailoring prompt's TITLE rule exists to produce.
 *   2. `tailoredProfile.jobTitle` — the posting's title as scraped, stamped on
 *      by the background worker. Right role, unadapted wording.
 *   3. `profile.title` — the candidate's standing title. Correct only when
 *      there was no tailoring to speak of.
 */
export function resolveResumeTitle(
  tailored: TailoredForDownload | null | undefined,
  profile: ProfileForDownload | null | undefined
): string {
  const pick = (v?: string) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  return pick(tailored?.title) || pick(tailored?.jobTitle) || pick(profile?.title) || '';
}

/**
 * Prefer a tailored section when the engine actually returned one.
 *
 * Presence, not truthiness: an empty `projects` array is a DECISION (the
 * candidate turned projects off and the backend hard-enforces that by emptying
 * the array), so falling back to the profile's projects on emptiness would
 * resurrect a section the user switched off.
 */
function preferTailoredSection<T>(tailoredValue: T[] | undefined, profileValue: T[] | undefined): T[] {
  if (Array.isArray(tailoredValue)) return tailoredValue;
  return Array.isArray(profileValue) ? profileValue : [];
}

export function buildDownloadPayload(
  tailoredProfile: TailoredForDownload | null | undefined,
  profile: ProfileForDownload | null | undefined
) {
  const tailored = tailoredProfile || {};
  return {
    // Contact details are the profile's and only the profile's — the tailoring
    // engine is explicitly forbidden from emitting them.
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedinUrl: profile?.linkedinUrl || '',
    githubUrl: profile?.githubUrl || '',
    portfolioUrl: profile?.portfolioUrl || '',

    title: resolveResumeTitle(tailored, profile),
    summary: tailored.summary || profile?.summary || '',
    skills: preferTailoredSection(tailored.skills, profile?.skills),
    // Carried through so the renderer can keep the engine's
    // Languages/Frameworks/Infrastructure grouping instead of a flat list.
    skillsGrouped: tailored.skillsGrouped || undefined,
    experience: preferTailoredSection(tailored.experience, profile?.experience),
    education: preferTailoredSection(tailored.education, profile?.education),
    projects: preferTailoredSection(tailored.projects, profile?.projects),
    // Not a section the tailoring engine rewrites.
    certifications: profile?.certifications || [],

    matchScore: tailored.matchScore,
    jobTitle: tailored.jobTitle,
    company: tailored.company,
  };
}
