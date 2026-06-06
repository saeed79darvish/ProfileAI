// Heuristics that turn the flat keyword-analysis result into the richer
// "ranked by impact" + "AI can boost to X%" UX. No backend changes required —
// the extension already extracts keywords roughly in importance order.

export type Impact = 'high' | 'medium' | 'low';

export interface RankedKeyword {
  keyword: string;
  impact: Impact;
}

// Tech/domain terms that are almost always hard requirements when present.
const HIGH_IMPACT_HINTS = [
  'security', 'compliance', 'accessibility', 'scalab', 'architecture',
  'leadership', 'senior', 'cloud', 'kubernetes', 'aws', 'azure', 'gcp',
  'machine learning', 'ai', 'data', 'testing', 'ci/cd', 'devops',
];

export function rankMissingKeywords(missing: string[]): RankedKeyword[] {
  return missing.map((keyword, i) => {
    const k = keyword.toLowerCase();
    const matchesHint = HIGH_IMPACT_HINTS.some((h) => k.includes(h));
    // Position matters: the extractor surfaces the most frequent terms first.
    let impact: Impact;
    if (matchesHint || i < 2) impact = 'high';
    else if (i < 5) impact = 'medium';
    else impact = 'low';
    return { keyword, impact };
  });
}

// Estimate where tailoring lands the score: tailoring reliably folds in most of
// the missing keywords (additive edits), so we project ~80% coverage of the gap.
export function predictBoostedScore(
  matchScore: number,
  presentCount: number,
  missingCount: number,
  totalKeywords: number
): number {
  if (!totalKeywords || missingCount === 0) return matchScore;
  const projectedCovered = presentCount + Math.round(missingCount * 0.8);
  const projected = Math.round((projectedCovered / totalKeywords) * 100);
  // Never predict below the current score, cap at a believable 95%.
  return Math.min(95, Math.max(matchScore + 5, projected));
}

export interface ScoreVerdict {
  /** css modifier: low | medium | good */
  level: 'low' | 'medium' | 'good';
  label: string;
}

export function scoreVerdict(score: number): ScoreVerdict {
  if (score >= 85) return { level: 'good', label: 'Excellent' };
  if (score >= 70) return { level: 'good', label: 'Strong match' };
  if (score >= 50) return { level: 'medium', label: 'Good start' };
  return { level: 'low', label: 'Needs work' };
}
