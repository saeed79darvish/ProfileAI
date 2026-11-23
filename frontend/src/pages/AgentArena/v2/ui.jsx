/* ApplyPilot v2 · shared design primitives.
   Tokens match the "ApplyPilot Redesign" canvas: one indigo accent,
   lavender surfaces, plain-language status colors. */
import React from 'react';
import styled, { css } from 'styled-components';

export const T = {
  ink: '#16152b',
  ink2: '#4a4d5a',
  ink3: '#5b5f6b',
  line: '#e7e4f7',
  lineStrong: '#d6d3ea',
  bg: '#faf9ff',
  card: '#ffffff',
  tint: '#f4f2ff',
  tint2: '#efedfd',
  brand: '#5b4bd6',
  brandInk: '#2f2780',
  night: '#1d1b30',
  nightInk: '#cfcde3',
  good: '#166534', goodBg: '#dcfce7',
  info: '#075985', infoBg: '#e0f2fe',
  warn: '#92400e', warnBg: '#fef3c7', warnLine: '#fcd34d', warnSoft: '#fffbeb',
  bad: '#991b1b', badBg: '#fee2e2', badLine: '#fecaca',
};

export const Page = styled.div`
  min-height: calc(100vh - 140px);
  background: ${T.bg};
  color: ${T.ink};
  font-family: Inter, -apple-system, 'Segoe UI', Roboto, sans-serif;
`;

export const Wrap = styled.main`
  max-width: ${(p) => p.$max || 1240}px;
  margin: 0 auto;
  padding: 32px 32px 72px;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 24}px;
  @media (max-width: 720px) { padding: 20px 16px 64px; }
`;

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${(p) => p.$gap ?? 12}px;
  align-items: ${(p) => p.$align || 'center'};
  justify-content: ${(p) => p.$justify || 'flex-start'};
`;

export const Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 12}px;
  min-width: 0;
  flex: ${(p) => p.$flex || 'initial'};
`;

export const Card = styled.section`
  background: ${T.card};
  border: 1px solid ${T.line};
  border-radius: 16px;
  padding: ${(p) => p.$pad ?? 20}px;
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 12}px;
  min-width: 0;
`;

export const H1 = styled.h1`
  margin: 0;
  font-size: ${(p) => p.$size || 30}px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
`;
export const H2 = styled.h2`
  margin: 0;
  font-size: ${(p) => p.$size || 19}px;
  font-weight: 800;
`;
export const Muted = styled.p`
  margin: 0;
  font-size: ${(p) => p.$size || 15}px;
  line-height: 1.6;
  color: ${T.ink2};
`;
export const Eyebrow = styled.span`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${(p) => p.$color || '#4b3fc4'};
`;

const btnBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: ${(p) => (p.$size === 'lg' ? 54 : p.$size === 'sm' ? 38 : 46)}px;
  padding: 0 ${(p) => (p.$size === 'lg' ? 28 : p.$size === 'sm' ? 12 : 18)}px;
  border-radius: 12px;
  font: inherit;
  font-size: ${(p) => (p.$size === 'lg' ? 16 : p.$size === 'sm' ? 14 : 15)}px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease;
  &:disabled { opacity: 0.55; cursor: not-allowed; }
  &:focus-visible { outline: 3px solid #b9b0f5; outline-offset: 2px; }
`;
export const Btn = styled.button.attrs((p) => ({ type: p.type || 'button' }))`
  ${btnBase}
  ${(p) => {
    switch (p.$kind) {
      case 'primary': return css`border: 0; background: ${T.brand}; color: #fff; &:hover:not(:disabled) { background: #4a3cc2; }`;
      case 'light': return css`border: 0; background: #fff; color: ${T.night};`;
      case 'warn': return css`border: 0; background: ${T.warn}; color: #fff;`;
      case 'danger': return css`border: 1px solid ${T.badLine}; background: #fff; color: #b91c1c;`;
      case 'ghost': return css`border: 0; background: transparent; color: #4b3fc4; padding-left: 8px; padding-right: 8px;`;
      case 'onDark': return css`border: 1px solid #4a4770; background: transparent; color: #fff;`;
      default: return css`border: 1px solid ${T.lineStrong}; background: #fff; color: ${T.ink}; &:hover:not(:disabled) { border-color: #b9b4e0; }`;
    }
  }}
`;
export const BtnLink = styled.a`${btnBase}
  ${(p) => (p.$kind === 'primary'
    ? css`border: 0; background: ${T.brand}; color: #fff !important;`
    : css`border: 1px solid ${T.lineStrong}; background: #fff; color: ${T.ink} !important;`)}
`;

export const Pill = styled.button.attrs({ type: 'button' })`
  min-height: 42px;
  padding: 0 16px;
  border-radius: 50px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  ${(p) => (p.$on
    ? css`border: 2px solid ${T.brand}; background: ${T.brand}; color: #fff;`
    : css`border: 1px solid ${T.lineStrong}; background: #fff; color: ${T.ink};`)}
  &:focus-visible { outline: 3px solid #b9b0f5; outline-offset: 2px; }
`;

export const Chip = styled.span`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 50px;
  white-space: nowrap;
  ${(p) => {
    const m = {
      good: [T.goodBg, T.good], info: [T.infoBg, T.info], warn: [T.warnBg, T.warn],
      bad: [T.badBg, T.bad], brand: [T.tint2, T.brandInk], neutral: ['#f1f0f6', '#3f4150'],
    }[p.$tone || 'neutral'];
    return css`background: ${m[0]}; color: ${m[1]};`;
  }}
`;

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  min-width: 0;
`;
export const Input = styled.input`
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid ${T.lineStrong};
  border-radius: 10px;
  font: inherit;
  font-weight: 400;
  background: #fff;
  color: ${T.ink};
  &:focus { outline: none; border-color: ${T.brand}; box-shadow: 0 0 0 3px #e3dffc; }
`;
export const Select = styled.select`
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid ${T.lineStrong};
  border-radius: 10px;
  font: inherit;
  font-weight: 400;
  background: #fff;
  color: ${T.ink};
`;
export const Textarea = styled.textarea`
  min-height: 110px;
  padding: 12px 14px;
  border: 1px solid ${T.lineStrong};
  border-radius: 10px;
  font: inherit;
  line-height: 1.55;
  resize: vertical;
  &:focus { outline: none; border-color: ${T.brand}; box-shadow: 0 0 0 3px #e3dffc; }
`;

export const Avatar = styled.span`
  width: ${(p) => p.$size || 42}px;
  height: ${(p) => p.$size || 42}px;
  flex: none;
  border-radius: 10px;
  background: #f3f2fb;
  color: #3a30a0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  overflow: hidden;
  img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
`;

export function CompanyMark({ name, logo, size }) {
  const [broken, setBroken] = React.useState(false);
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <Avatar $size={size} aria-hidden="true">
      {logo && !broken ? <img src={logo} alt="" onError={() => setBroken(true)} /> : initial}
    </Avatar>
  );
}

export const Banner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 14px;
  ${(p) => {
    if (p.$tone === 'warn') return css`background: ${T.warnSoft}; border: 1px solid ${T.warnLine}; color: #78350f;`;
    if (p.$tone === 'bad') return css`background: #fef2f2; border: 1px solid ${T.badLine}; color: #7f1d1d;`;
    if (p.$tone === 'good') return css`background: #ecfdf5; border: 1px solid #a7f3d0; color: ${T.good};`;
    return css`background: ${T.tint}; border: 1px solid ${T.line}; color: #2f2d45;`;
  }}
`;

export const Empty = styled.div`
  padding: 36px 24px;
  border-radius: 16px;
  border: 1px dashed ${T.lineStrong};
  background: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

export const ListBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${(p) => p.$line || T.line};
  background: ${(p) => p.$line || T.line};
`;

export const Spinner = styled.span`
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid ${T.line}; border-top-color: ${T.brand};
  animation: apspin 0.8s linear infinite;
  @keyframes apspin { to { transform: rotate(360deg); } }
`;

/* Loading placeholders shaped like the real content, with a soft shimmer.
   Screens show the skeleton of their own layout instead of a spinner. */
export const Bone = styled.span`
  display: block;
  width: ${(p) => p.$w || '100%'};
  height: ${(p) => p.$h || 14}px;
  border-radius: ${(p) => p.$r ?? 8}px;
  background: linear-gradient(90deg, #efedf8 0%, #f7f6fc 40%, #efedf8 80%);
  background-size: 300% 100%;
  animation: apshimmer 1.4s ease-in-out infinite;
  @keyframes apshimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export function SkeletonRows({ n = 5, avatar = true }) {
  return (
    <ListBox aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <Row key={i} $gap={14} style={{ padding: '16px 20px', background: '#fff' }}>
          {avatar && <Bone $w="42px" $h={42} $r={10} />}
          <Col $gap={8} $flex="1 1 auto">
            <Bone $w={`${60 - (i % 3) * 10}%`} $h={15} />
            <Bone $w="38%" $h={12} />
          </Col>
          <Bone $w="84px" $h={26} $r={50} />
        </Row>
      ))}
    </ListBox>
  );
}

export function Loading({ label = 'Loading', variant = 'page' }) {
  if (variant === 'detail') {
    return (
      <div role="status" aria-label={label} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Row $gap={16} $align="flex-start">
          <Bone $w="56px" $h={56} $r={14} />
          <Col $gap={10} $flex="1 1 auto"><Bone $w="55%" $h={24} /><Bone $w="35%" $h={14} /></Col>
          <Bone $w="70px" $h={34} />
        </Row>
        <Row $gap={10}>{[90, 110, 100, 80].map((w) => <Bone key={w} $w={`${w}px`} $h={30} $r={10} />)}</Row>
        <Bone $h={120} $r={16} />
        <Bone $h={260} $r={16} />
      </div>
    );
  }
  return (
    <Wrap role="status" aria-label={label}>
      <Bone $h={150} $r={20} />
      <Row $gap={24} $align="flex-start">
        <Col $gap={12} $flex="999 1 560px"><Bone $w="180px" $h={20} /><SkeletonRows n={5} /></Col>
        <Col $gap={16} $flex="1 1 320px"><Bone $h={120} $r={16} /><Bone $h={180} $r={16} /></Col>
      </Row>
    </Wrap>
  );
}

/* Match score → one shared vocabulary used on every screen. */
export function fitOf(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return { word: 'Match', tone: 'neutral', n: null };
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  if (pct >= 75) return { word: 'Strong', tone: 'good', n: pct };
  if (pct >= 65) return { word: 'Good', tone: 'brand', n: pct };
  return { word: 'Stretch', tone: 'warn', n: pct };
}

/* "Posted 2 days ago" from whatever date the row carries; never "Invalid Date". */
export function ago(value, prefix = '') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  let s;
  if (mins < 1) s = 'just now';
  else if (mins < 60) s = `${mins} minute${mins === 1 ? '' : 's'} ago`;
  else if (mins < 60 * 24) { const h = Math.round(mins / 60); s = `${h} hour${h === 1 ? '' : 's'} ago`; }
  else {
    const days = Math.round(mins / 1440);
    s = days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return prefix ? `${prefix} ${s}` : s.charAt(0).toUpperCase() + s.slice(1);
}

export function clockTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
