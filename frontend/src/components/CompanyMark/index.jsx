import React, { useState } from 'react';
import styled from 'styled-components';

/**
 * A company's logo, or its initial on a steady colour when there is no logo
 * (or it fails to load), so a list of jobs still reads as different
 * employers at a glance. Used by the coach's jobs card and the matches
 * pop-up.
 */

const TINTS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];
const tintFor = (name = '') => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];

const CompanyMark = ({ name, logoUrl, size = 40 }) => {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      <Box $size={size}>
        <img src={logoUrl} alt="" onError={() => setBroken(true)} />
      </Box>
    );
  }
  return (
    <Box $size={size} $tint={tintFor(name || '')} aria-hidden="true">
      {(name || '?').trim().charAt(0).toUpperCase()}
    </Box>
  );
};

const Box = styled.span`
  flex: none;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => Math.round($size * 0.26)}px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: ${({ $tint }) => $tint || '#fff'};
  border: 1px solid ${({ $tint }) => ($tint ? 'transparent' : '#ececf3')};
  color: #fff;
  font-weight: 750;
  font-size: ${({ $size }) => Math.round($size * 0.42)}px;

  img { width: 100%; height: 100%; object-fit: contain; padding: 4px; box-sizing: border-box; }
`;

export default CompanyMark;
