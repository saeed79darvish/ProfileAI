// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled from 'styled-components';
import { Button } from '@mui/material';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../designTokens';

export const RoleToggleWrapper = styled.div`
  display: flex;
  background: ${COLORS.BG_GRAY};
  border-radius: ${RADIUS.LARGE};
  padding: 4px;
  margin-bottom: 24px;
`;

export const RoleOption = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: ${RADIUS.MEDIUM};
  cursor: pointer;
  font-size: ${FONT_SIZE.BASE};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  font-family: inherit;
  transition: all 0.25s ease;
  background: ${(props) =>
    props.$active
      ? GRADIENTS.PRIMARY
      : 'transparent'};
  color: ${(props) => (props.$active ? COLORS.TEXT_WHITE : '#666')};
  box-shadow: ${(props) =>
    props.$active ? SHADOWS.PRIMARY_GLOW : 'none'};

  &:hover {
    background: ${(props) =>
      props.$active
        ? GRADIENTS.PRIMARY
        : 'rgba(102,126,234,0.08)'};
  }

  svg {
    font-size: 20px;
  }
`;

export const PasswordReq = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: ${(props) => (props.$met ? COLORS.SUCCESS_LIGHT : COLORS.TEXT_MUTED)};
  svg {
    font-size: 15px;
  }
`;

export const GradientButton = styled(Button)`
  && {
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    text-transform: none;
    font-size: 15px;
    padding: 12px;
    border-radius: ${RADIUS.MEDIUM};

    &:hover {
      background: linear-gradient(135deg, #5a6fd6 0%, #6a4291 100%);
      box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
    }

    &:disabled {
      background: #e0e0e0;
      color: #9e9e9e;
    }
  }
`;

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: RADIUS.MEDIUM,
    backgroundColor: COLORS.BG_LIGHT,
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.PRIMARY },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.PRIMARY }
  }
};

// --- Extracted sx objects ---

export const headingSx = { fontWeight: 700, mb: 0.5, letterSpacing: '-0.3px', display: { xs: 'none', md: 'block' } };

export const subtitleSx = { mb: 3, display: { xs: 'none', md: 'block' } };

export const alertSx = { mb: 2, borderRadius: RADIUS.MEDIUM };

export const socialButtonsWrapperSx = {
  display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'stretch', mb: 0
};

export const googleButtonWrapperSx = { display: 'flex', justifyContent: 'center', width: '100%', '& > div, & iframe': { width: '100% !important', colorScheme: 'light' } };

export const linkedinButtonSx = {
  borderRadius: RADIUS.MEDIUM,
  borderColor: '#0A66C2',
  color: '#0A66C2',
  textTransform: 'none',
  fontWeight: FONT_WEIGHT.MEDIUM,
  fontSize: FONT_SIZE.BASE,
  py: 1.2,
  width: '100%',
  height: 40,
  '&:hover': { borderColor: '#004182', backgroundColor: 'rgba(10,102,194,0.06)' }
};

export const dividerSx = { my: 2.5 };

export const dividerTextSx = { fontSize: '0.8rem', px: 1 };

export const fieldLabelSx = { mb: 0.5, fontWeight: FONT_WEIGHT.MEDIUM };

export const passwordStrengthWrapperSx = { mt: 1 };

export const progressBarRowSx = { display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 };

export const getProgressBarSx = (color: string) => ({
  flexGrow: 1,
  height: 5,
  borderRadius: 3,
  backgroundColor: COLORS.BORDER_LIGHT,
  '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 3 }
});

export const getStrengthLabelSx = (color: string) => ({
  color,
  fontWeight: FONT_WEIGHT.SEMIBOLD,
  textTransform: 'capitalize',
  minWidth: 42,
  fontSize: '0.7rem'
});

export const passwordReqGridSx = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25 };

export const termsSx = { mt: 2, display: 'block', lineHeight: 1.6 };

export const termsLinkSx = { color: COLORS.PRIMARY, fontWeight: FONT_WEIGHT.MEDIUM };

export const submitButtonSx = { mt: 2.5 };

export const loginPromptSx = { textAlign: 'center', mt: 2 };

export const loginLinkSx = { color: COLORS.PRIMARY, fontWeight: FONT_WEIGHT.SEMIBOLD };

export const recruiterOptionStyle = {
  opacity: 0.45,
  cursor: 'not-allowed' as const,
  pointerEvents: 'none' as const,
  position: 'relative' as const
};

export const comingSoonBadgeStyle = {
  fontSize: '0.6rem',
  fontWeight: FONT_WEIGHT.BOLD,
  color: '#d97706',
  background: 'rgba(245,158,11,0.12)',
  borderRadius: 6,
  padding: '1px 6px',
  marginLeft: 6,
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap' as const
};