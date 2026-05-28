import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * SEO component — sets per-route <title>, <meta>, canonical, OG/Twitter,
 * and optional JSON-LD structured data. Use on every public-facing page.
 *
 * Example:
 *   <SEO
 *     title="Pricing"
 *     description="ProfilleAI pricing — free, pro and enterprise plans."
 *     path="/pricing"
 *     jsonLd={{ '@context': 'https://schema.org', '@type': 'WebPage', ... }}
 *   />
 */

const SITE_URL = 'https://www.profilleai.com';
const SITE_NAME = 'ProfilleAI';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const TITLE_SUFFIX = ' | ProfilleAI';

function absoluteUrl(path) {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function SEO({
  title,
  description,
  path,
  image,
  type = 'website',
  noIndex = false,
  keywords,
  jsonLd,
}) {
  const fullTitle = title
    ? title.includes(SITE_NAME) ? title : `${title}${TITLE_SUFFIX}`
    : 'ProfilleAI — AI Resume Tailoring, Auto-Apply & Negotiation Coach';

  const url = absoluteUrl(path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const img = image ? absoluteUrl(image) : DEFAULT_IMAGE;
  const desc =
    description ||
    'AI career copilot: tailor resumes in seconds, auto-apply to jobs, and practice salary negotiation with AI agents.';

  const structured = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content={
          noIndex
            ? 'noindex, nofollow'
            : 'index, follow, max-image-preview:large, max-snippet:-1'
        }
      />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {structured.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}
