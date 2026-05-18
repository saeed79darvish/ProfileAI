// Shared responsive breakpoints used across the app.
// Three-tier navigation strategy:
//   - desktop  : >= 1024px  → full nav (icons + labels)
//   - tablet   : 640–1023px → icon-only nav
//   - mobile   : < 640px    → hamburger / drawer
//
// Use the `media` helpers below in styled-components for consistency.

export const BP = {
  mobileMax: 639,   // < 640px → hamburger drawer only
  tabletMin: 640,   // 640–1023px → icon-only nav
  tabletMax: 1023,
  desktopMin: 1024, // >= 1024px → full nav with labels
  wide: 1400,
  ultrawide: 1600,
};

export const media = {
  // mobile: < 640px
  mobile: `@media (max-width: ${BP.mobileMax}px)`,
  // tablet: 640–1023px
  tablet: `@media (min-width: ${BP.tabletMin}px) and (max-width: ${BP.tabletMax}px)`,
  // tablet and below: < 1024px
  tabletDown: `@media (max-width: ${BP.tabletMax}px)`,
  // desktop: >= 1024px
  desktop: `@media (min-width: ${BP.desktopMin}px)`,
  // wide and ultrawide
  wide: `@media (min-width: ${BP.wide}px)`,
  ultrawide: `@media (min-width: ${BP.ultrawide}px)`,
};

export default BP;
