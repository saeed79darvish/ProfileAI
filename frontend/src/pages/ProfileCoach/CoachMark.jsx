import React from 'react';

/**
 * The coach's face.
 *
 * It was a sparkle in a rounded square — the house style for "this bit is
 * AI", which is exactly the wrong thing to say here. Everything else in this
 * product is a feature; this one is supposed to read as somebody asking you
 * about your career, and people extend more patience to a face than to a
 * feature badge.
 *
 * Drawn rather than photographed, deliberately. A stock photo of a person who
 * is not on the other end is a small lie, and it dates the product the first
 * time anyone sees the same face elsewhere. A clean figure mark is honest
 * about being an illustration while still reading, instantly and at 38px, as
 * a person rather than a spark.
 *
 * Head and shoulders only, because that is what survives the size: anything
 * with a face inside it turns to mud below about 40px, and a silhouette does
 * not.
 */
const CoachMark = ({ size = 38 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    role="img"
    aria-label="Your ProfilleAI coach"
    focusable="false"
  >
    <defs>
      <linearGradient id="coachMarkFace" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7c85f5" />
        <stop offset="100%" stopColor="#5457e5" />
      </linearGradient>
      {/* Keeps the shoulders inside the circle instead of squaring off at
          the bottom edge. */}
      <clipPath id="coachMarkClip">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
    </defs>

    <g clipPath="url(#coachMarkClip)">
      <circle cx="20" cy="20" r="20" fill="url(#coachMarkFace)" />
      {/* Shoulders first, head over them, so the neckline reads as depth
          rather than as two shapes touching. */}
      <path d="M20 23.4c7.4 0 13.4 5.2 13.4 11.6v6H6.6v-6c0-6.4 6-11.6 13.4-11.6z" fill="#fff" opacity="0.93" />
      <circle cx="20" cy="15.1" r="6.6" fill="#fff" />
    </g>
  </svg>
);

export default CoachMark;
