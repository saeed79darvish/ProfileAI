import { Button } from '@mui/material';
import styled from 'styled-components';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../designTokens';

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
} as const;

export const titleSx = { fontWeight: FONT_WEIGHT.BOLD, mb: 0.5, letterSpacing: '-0.3px', display: { xs: 'none', md: 'block' } } as const;

export const subtitleSx = { mb: 4, display: { xs: 'none', md: 'block' } } as const;

export const alertSx = { mb: 2.5, borderRadius: RADIUS.MEDIUM } as const;

export const socialButtonsContainerSx = { display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'stretch', mb: 0 } as const;

export const googleLoginWrapperSx = { display: 'flex', justifyContent: 'center', width: '100%', '& > div, & iframe': { width: '100% !important', colorScheme: 'light' } } as const;

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
} as const;

export const dividerSx = { my: 2.5 } as const;

export const dividerTextSx = { fontSize: '0.8rem', px: 1 } as const;

export const emailGroupSx = { mb: 2 } as const;

export const passwordGroupSx = { mb: 1 } as const;

export const fieldLabelSx = { mb: 0.5, fontWeight: FONT_WEIGHT.MEDIUM } as const;

export const forgotPasswordWrapperSx = { textAlign: 'right', mb: 1 } as const;

export const forgotPasswordLinkSx = { color: COLORS.PRIMARY, fontWeight: FONT_WEIGHT.MEDIUM, fontSize: '0.85rem' } as const;

export const submitButtonSx = { mt: 1 } as const;

export const footerTextSx = { textAlign: 'center', mt: 2.5 } as const;

export const signUpLinkSx = { color: COLORS.PRIMARY, fontWeight: FONT_WEIGHT.SEMIBOLD } as const;
