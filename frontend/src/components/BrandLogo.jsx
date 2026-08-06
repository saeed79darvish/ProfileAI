import React from 'react';
import BrandIcon from './BrandIcon';
import BrandWordmark from './BrandWordmark';

/**
 * Icon + wordmark lockup — the full logo.
 *
 * Use this anywhere the product signs its own name (nav, auth screens, empty
 * states). Use BrandIcon alone only where space forbids the wordmark.
 */
const BrandLogo = ({
  iconSize = 32,
  fontSize = '1.35rem',
  gap = 10,
  onDark = false,
  accentColor,
  color,
  ...rest
}) => (
  <span
    style={{ display: 'inline-flex', alignItems: 'center', gap }}
    {...rest}
  >
    <BrandIcon size={iconSize} onDark={onDark} />
    <BrandWordmark
      accentColor={accentColor || (onDark ? 'rgba(255,255,255,0.55)' : '#9CA3AF')}
      style={{
        fontSize,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: color || (onDark ? '#fff' : '#0F1020'),
        lineHeight: 1,
      }}
    />
  </span>
);

export default BrandLogo;
