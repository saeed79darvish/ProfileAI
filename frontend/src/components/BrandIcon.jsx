import React, { useId } from 'react';

/**
 * Canonical brand mark: two rounded squares on a 40×40 footprint, the second
 * offset diagonally so the whole mark is square rather than wide.
 *
 * Replaces the ad-hoc "gradient box with a sparkle icon" that several surfaces
 * drew inline, each with its own size, radius and gradient.
 *
 * Props:
 *   - size:   rendered px (the artwork always scales from the 40×40 viewBox)
 *   - muted:  colour of the square behind
 *   - from/to: gradient stops of the foreground square
 *   - onDark: swaps the back square for a translucent white so the mark keeps
 *             its two-tone read on dark backgrounds
 */
const BrandIcon = ({
  size = 32,
  muted = '#C9CCE9',
  from = '#5A4BB4',
  to = '#241C61',
  onDark = false,
  title,
  ...rest
}) => {
  // Gradient ids must be unique per instance or several marks on one page all
  // inherit whichever definition rendered last.
  const gid = useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`bi-${gid}`} x1="14" y1="14" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect
        x="0" y="0" width="26" height="26" rx="6"
        fill={onDark ? 'rgba(255,255,255,0.38)' : muted}
      />
      <rect x="14" y="14" width="26" height="26" rx="6" fill={`url(#bi-${gid})`} />
    </svg>
  );
};

export default BrandIcon;
