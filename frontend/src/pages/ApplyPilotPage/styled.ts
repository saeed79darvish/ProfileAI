import { keyframes } from '@emotion/react';

export const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-14px); }
`;

export const floatReverse = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(10px); }
`;

export const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;
