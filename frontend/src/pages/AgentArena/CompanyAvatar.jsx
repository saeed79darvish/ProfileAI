import React, { useState, useMemo } from 'react';
import styled from 'styled-components';

/* ================================================================
   CompanyAvatar
   - Renders a real favicon when we can derive a domain from the
     company name (or a known companyKey).
   - Falls back to a letter avatar with a *hash-of-the-company-name*
     background so different companies look different even when no
     favicon is available.
   ================================================================ */

const KNOWN_DOMAINS = {
  // companyKey overrides
  stripe: 'stripe.com',
  linear: 'linear.app',
  vercel: 'vercel.com',
  shopify: 'shopify.com',
  figma: 'figma.com',
  notion: 'notion.so',
  openai: 'openai.com',
  meta: 'meta.com',
  // common slugs we'll see from scouted jobs
  okta: 'okta.com',
  auth0: 'auth0.com',
  anthropic: 'anthropic.com',
  brex: 'brex.com',
  replit: 'replit.com',
  samsara: 'samsara.com',
  twilio: 'twilio.com',
  verkada: 'verkada.com',
  coinbase: 'coinbase.com',
  google: 'google.com',
  apple: 'apple.com',
  microsoft: 'microsoft.com',
  amazon: 'amazon.com',
  netflix: 'netflix.com',
  airbnb: 'airbnb.com',
  uber: 'uber.com',
  lyft: 'lyft.com',
  databricks: 'databricks.com',
  snowflake: 'snowflake.com',
  datadog: 'datadoghq.com',
  cloudflare: 'cloudflare.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  atlassian: 'atlassian.com',
  slack: 'slack.com',
  discord: 'discord.com',
  spotify: 'spotify.com',
};

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const deriveDomain = (company, key) => {
  const k = String(key || '').toLowerCase();
  if (k && k !== 'generic' && KNOWN_DOMAINS[k]) return KNOWN_DOMAINS[k];
  const slug = slugify(company);
  if (!slug) return null;
  if (KNOWN_DOMAINS[slug]) return KNOWN_DOMAINS[slug];
  // Generic guess: first token .com (works for most well-known orgs).
  // We rely on the favicon service returning a default when this is wrong;
  // onError handler then drops back to the hash-color letter avatar.
  return `${slug}.com`;
};

const hashHue = (s) => {
  const str = String(s || '?');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
};

const Box = styled.div`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${(p) => p.$radius}px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
  background: ${(p) => p.$bg};
  font-size: ${(p) => Math.max(11, Math.round(p.$size * 0.4))}px;
  letter-spacing: -0.01em;
  border: 1px solid rgba(0, 0, 0, 0.04);

  img {
    width: 70%;
    height: 70%;
    object-fit: contain;
    display: block;
  }
`;

const CompanyAvatar = ({
  company,
  companyKey,
  letter,
  size = 36,
  radius = 10,
  className,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => deriveDomain(company, companyKey), [company, companyKey]);
  const hue = useMemo(() => hashHue(company || companyKey || letter), [company, companyKey, letter]);
  const showImg = !!domain && !failed;
  const bg = showImg ? '#FFFFFF' : `hsl(${hue}, 58%, 45%)`;
  const text = (letter && String(letter).slice(0, 2)) || (company && company.trim()[0]?.toUpperCase()) || '•';

  return (
    <Box $size={size} $radius={radius} $bg={bg} className={className} style={style}>
      {showImg ? (
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{text}</span>
      )}
    </Box>
  );
};

export default CompanyAvatar;
