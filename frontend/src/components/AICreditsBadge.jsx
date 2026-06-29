import React from 'react';
import useAICredits from '../hooks/useAICredits';

/**
 * Inline AI credits badge. Compact "8 credits left this week" pill that
 * lives near AI actions (wizard top bar, editor AIToolsBar, paywall
 * header). Always reads from the same source as the rate-limit middleware,
 * so the displayed number matches the paywall trigger.
 *
 * Props:
 *   feature       Backend feature key. Defaults to 'profile_enhance'
 *                 which covers the wizard's AI Draft + editor's Enhance.
 *   tone          'dark' (on dark-gradient nav) or 'light' (default).
 *   inline        Render as a <span> (default). Otherwise a tiny block.
 *   showLabel     When true, includes the "AI" label prefix.
 */
const AICreditsBadge = ({
  feature = 'profile_enhance',
  tone = 'light',
  inline = true,
  showLabel = false,
  style,
  className,
}) => {
  const { remaining, isUnlimited, period, loading, error } = useAICredits(feature);

  // Hide entirely while loading or on soft errors — never block UI.
  if (loading || error) return null;

  // `period` is which cap is currently binding (weekly vs monthly) so the
  // copy doesn't say "this week" when the monthly limit is the real one.
  const periodSuffix = period === 'month' ? 'this month' : 'this week';

  let text;
  let color;
  if (isUnlimited) {
    text = showLabel ? 'AI · unlimited' : 'Unlimited AI';
    color = tone === 'dark' ? '#86efac' : '#16a34a';
  } else if (remaining > 0) {
    text = showLabel
      ? `AI · ${remaining} credit${remaining === 1 ? '' : 's'} left ${periodSuffix}`
      : `${remaining} AI credit${remaining === 1 ? '' : 's'} left ${periodSuffix}`;
    color = tone === 'dark' ? '#c4b5fd' : '#6366f1';
  } else {
    text = `No AI credits left ${periodSuffix} — upgrade for more`;
    color = tone === 'dark' ? '#fca5a5' : '#dc2626';
  }

  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      className={className}
      style={{
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        color,
        whiteSpace: 'nowrap',
        ...style,
      }}
      aria-live="polite"
    >
      {text}
    </Tag>
  );
};

export default AICreditsBadge;
