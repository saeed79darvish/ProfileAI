import React from 'react';

/**
 * Visual guide for step 2 of the LinkedIn PDF import flow: shows the
 * LinkedIn profile action bar with the ••• (three dots) button ringed,
 * then the resulting dropdown with "Save to PDF" highlighted.
 *
 * Inline SVG so we don't need to host image assets, don't hotlink to
 * LinkedIn (ToS + hotlink-breakage risk), and don't ship any user data.
 * Uses LinkedIn's brand blue (#0a66c2) for recognisability.
 */
const LinkedInPdfHint = () => (
  <svg
    viewBox="0 0 360 170"
    role="img"
    aria-label="Screenshot guide: click the three-dots button, then Save to PDF"
    style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block' }}
  >
    {/* Panel background */}
    <rect x="0" y="0" width="360" height="170" rx="10" fill="#f3f6fb" />

    {/* ── LEFT: LinkedIn action-bar mock ─────────────────────────── */}
    <g transform="translate(12, 20)">
      {/* "500+ connections" label */}
      <text x="0" y="10" fill="#0a66c2" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="600">
        500+ connections
      </text>

      {/* "Open to" primary button */}
      <rect x="0" y="18" width="52" height="22" rx="11" fill="#0a66c2" />
      <text x="26" y="33" fill="#fff" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700" textAnchor="middle">
        Open to
      </text>

      {/* "Add section" outline button */}
      <rect x="58" y="18" width="66" height="22" rx="11" fill="#fff" stroke="#0a66c2" strokeWidth="1.2" />
      <text x="91" y="33" fill="#0a66c2" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700" textAnchor="middle">
        Add section
      </text>

      {/* ⋯ three-dot button — the star of the show */}
      <circle cx="141" cy="29" r="11" fill="#fff" stroke="#0a66c2" strokeWidth="1.2" />
      <circle cx="136.5" cy="29" r="1.4" fill="#0a66c2" />
      <circle cx="141" cy="29" r="1.4" fill="#0a66c2" />
      <circle cx="145.5" cy="29" r="1.4" fill="#0a66c2" />

      {/* Attention ring + label around the three-dot button */}
      <circle cx="141" cy="29" r="16" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeDasharray="3 2" />
      <g transform="translate(141, 55)">
        <rect x="-14" y="0" width="28" height="14" rx="7" fill="#ef4444" />
        <text x="0" y="10" fill="#fff" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="700" textAnchor="middle">
          click
        </text>
      </g>
    </g>

    {/* ── Arrow from three-dot button to dropdown ───────────────── */}
    <g stroke="#0a66c2" strokeWidth="1.6" fill="none">
      <path d="M 175 95 C 195 95, 200 95, 215 95" strokeLinecap="round" />
      <path d="M 210 91 L 216 95 L 210 99" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    {/* ── RIGHT: dropdown mock ──────────────────────────────────── */}
    <g transform="translate(220, 42)">
      {/* Drop shadow + panel */}
      <rect x="2" y="4" width="128" height="112" rx="8" fill="#000" opacity="0.06" />
      <rect x="0" y="0" width="128" height="112" rx="8" fill="#fff" stroke="#e5e7eb" strokeWidth="1" />

      {/* Menu items — "Save to PDF" (2nd) is the target */}
      <g fontFamily="system-ui, sans-serif" fontSize="9" fill="#333">
        {/* Send profile in a message */}
        <text x="30" y="20">Send profile</text>
        {/* Save to PDF — highlighted row */}
        <rect x="4" y="30" width="120" height="22" rx="4" fill="#eaf3fc" />
        <path
          d="M 14 41 v -6 M 11 39 l 3 3 l 3 -3 M 10 45 h 8"
          stroke="#0a66c2"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <text x="24" y="44" fill="#0a66c2" fontWeight="700">Save to PDF</text>
        {/* Saved items */}
        <text x="30" y="65">Saved items</text>
        {/* Activity */}
        <text x="30" y="82">Activity</text>
        {/* About this member */}
        <text x="30" y="99">About this member</text>
      </g>

      {/* Left-side icon column (generic dots so we don't imply LinkedIn's exact iconography) */}
      <g fill="#9ca3af">
        <circle cx="16" cy="17" r="1.8" />
        <circle cx="16" cy="62" r="1.8" />
        <circle cx="16" cy="79" r="1.8" />
        <circle cx="16" cy="96" r="1.8" />
      </g>
    </g>
  </svg>
);

export default LinkedInPdfHint;
