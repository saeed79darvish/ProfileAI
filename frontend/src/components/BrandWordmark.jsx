import React from 'react';

/**
 * Canonical brand wordmark.
 *
 * The brand renders as a lowercase "profilleai" with the trailing "ai" in
 * an accent colour. Previously this was duplicated in three places (the
 * global Navbar lowercase styled split, the wizard top-bar's uppercase
 * "ProfilleAI", and several MUI Typography headings) which meant the
 * same product showed two different wordmarks to the user mid-flow.
 *
 * Font sizing / weight / letter-spacing are inherited from the parent so
 * each surface (dark nav vs. light wizard top bar) can size the mark
 * appropriately while keeping the case + split-colour treatment
 * identical.
 *
 * Props:
 *   - accentColor:  hex/string for the trailing "ai". Defaults to the
 *                   Navbar's lavender (#c4b5fd) which reads on dark
 *                   gradients; pass e.g. "#6366f1" on light surfaces.
 *   - accentStyle:  optional extra inline style for the accent span.
 *   - ...rest:      passed through to the outer <span> (className, style…).
 */
const BrandWordmark = ({ accentColor = '#c4b5fd', accentStyle, ...rest }) => (
  <span {...rest}>
    profille<span style={{ color: accentColor, ...accentStyle }}>ai</span>
  </span>
);

/** Plain-text spelling, useful for aria-labels and analytics events. */
export const BRAND_NAME = 'profilleai';

export default BrandWordmark;
