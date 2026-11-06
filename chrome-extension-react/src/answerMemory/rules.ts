/**
 * Bump this whenever the rules for what a generated answer may contain change.
 * Every cached smart answer written under an older version is thrown away once,
 * because older answers could contain personal facts the model invented.
 */
export const ANSWERS_RULES_VERSION = 2;

export interface VersionedCache<T> {
  cache: Record<string, T>;
  version: number;
  /** True when old entries were discarded and the caller must persist. */
  reset: boolean;
}

export function applyRulesVersion<T>(
  stored: Record<string, T> | null | undefined,
  storedVersion: number | null | undefined,
  current: number = ANSWERS_RULES_VERSION,
): VersionedCache<T> {
  if (storedVersion === current) {
    return { cache: stored || {}, version: current, reset: false };
  }
  return { cache: {}, version: current, reset: true };
}

/** Local seed answer keys from older extension builds, mapped to memory stories. */
export const SEED_TO_STORY: Record<string, string> = {
  career_motivation: 'motivation',
  ideal_role: 'idealRole',
  career_goals: 'careerGoals',
  proudest_achievement: 'proudestAchievement',
  unique_strength: 'uniqueStrength',
  work_style: 'workStyle',
};

export interface SeedMigration {
  patch: Record<string, { text: string }>;
  count: number;
}

/** The server memory wins: a story that already has text is never overwritten. */
export function buildSeedStoryPatch(
  seed: Record<string, unknown> | null | undefined,
  existingStories: Record<string, { text?: string } | undefined> | null | undefined,
): SeedMigration {
  const patch: Record<string, { text: string }> = {};
  if (!seed) return { patch, count: 0 };
  for (const [key, storyId] of Object.entries(SEED_TO_STORY)) {
    const raw = seed[key];
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) continue;
    if (existingStories?.[storyId]?.text?.trim()) continue;
    patch[storyId] = { text };
  }
  return { patch, count: Object.keys(patch).length };
}
