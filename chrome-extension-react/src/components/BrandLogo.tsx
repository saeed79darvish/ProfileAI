import React, { useId } from 'react';

/**
 * The extension's copy of the canonical ProfilleAI brand mark, kept in sync
 * with the web app's `frontend/src/components/BrandIcon.jsx` +
 * `BrandWordmark.jsx`. The extension can't import from the web bundle, so the
 * artwork is duplicated here — if the brand changes, change both.
 *
 * Mark: two rounded squares on a 40x40 footprint, the second offset
 * diagonally. Wordmark: lowercase "profille" + accent "ai".
 */

interface BrandIconProps {
  size?: number;
  /** Swaps the back square for translucent white so the two-tone mark reads on dark. */
  onDark?: boolean;
  className?: string;
}

export const BrandIcon: React.FC<BrandIconProps> = ({ size = 24, onDark = true, className }) => {
  // Gradient ids must be unique per instance or every mark on the page inherits
  // whichever definition rendered last.
  const gid = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`bi-${gid}`} x1="14" y1="14" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5A4BB4" />
          <stop offset="1" stopColor="#241C61" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="26" height="26" rx="6" fill={onDark ? 'rgba(255,255,255,0.38)' : '#C9CCE9'} />
      <rect x="14" y="14" width="26" height="26" rx="6" fill={`url(#bi-${gid})`} />
    </svg>
  );
};

interface BrandLogoProps {
  iconSize?: number;
  /** Font size of the wordmark. Inherits the surrounding weight/spacing. */
  fontSize?: number | string;
  onDark?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  iconSize = 24,
  fontSize,
  onDark = true,
  className,
}) => (
  <span className={`brand-logo${className ? ` ${className}` : ''}`}>
    <BrandIcon size={iconSize} onDark={onDark} />
    <span className="brand-wordmark" style={fontSize ? { fontSize } : undefined}>
      profille<span className="brand-wordmark-accent">ai</span>
    </span>
  </span>
);

export default BrandLogo;
