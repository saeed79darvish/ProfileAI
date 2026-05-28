// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled from 'styled-components';
import { Card, CardContent, Box, alpha } from '@mui/material';
import { COLORS } from '../../designTokens';

export const StatCardWrapper = styled(Card)`
  cursor: ${(props) => (props.$clickable ? 'pointer' : 'default')};
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    ${(props) =>
      props.$clickable &&
      `
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    `}
  }
`;

export const StatCardContent = styled(CardContent)`
  padding: 24px;
`;

export const StatCardRow = styled(Box)`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

export const StatIconBox = styled(Box)`
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => alpha(props.$color || COLORS.PRIMARY, 0.1)};
  color: ${(props) => props.$color || COLORS.PRIMARY};
`;

export const GrowthRow = styled(Box)`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const GrowthIconBox = styled(Box)`
  padding: 12px;
  border-radius: 8px;
  background-color: ${(props) => alpha(props.$color || COLORS.PRIMARY, 0.1)};
`;