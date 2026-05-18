/**
 * Build a human-readable benefit string for a promo.
 */
export function getBenefitText(promo: any): string {
  if (promo.type === 'ai_bonus') {
    const parts: string[] = [];
    if (promo.dailyMultiplier > 1) parts.push(`${promo.dailyMultiplier}x daily`);
    if (promo.dailyBonusFlat > 0) parts.push(`+${promo.dailyBonusFlat} flat`);
    return parts.join(' + ') || 'No bonus';
  }
  if (promo.type === 'subscription_upgrade') {
    return `→ ${promo.grantTier}`;
  }
  return `+${promo.durationDays}d trial`;
}
