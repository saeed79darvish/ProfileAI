import styled from 'styled-components';
import { COLORS, GRADIENTS } from '../../designTokens';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: ${COLORS.BG_LIGHT};
  position: relative;
`;

export const Header = styled.header`
  text-align: center;
  padding: 60px 20px 40px;
  background: ${COLORS.BG_WHITE};
`;

export const SpecialBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: ${GRADIENTS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  padding: 8px 16px;
  border-radius: 50px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 24px;
  
  svg {
    font-size: 16px;
  }
`;

export const Title = styled.h1`
  font-size: 48px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 16px;
  
  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

export const Subtitle = styled.p`
  font-size: 18px;
  color: ${COLORS.TEXT_SECONDARY};
  margin: 0 0 8px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
`;

export const BillingToggle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 32px;
  padding: 4px;
  background: ${COLORS.BG_GRAY};
  border-radius: 50px;
`;

export const BillingOption = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? COLORS.BG_WHITE : 'transparent'};
  color: ${props => props.$active ? COLORS.TEXT_PRIMARY : COLORS.TEXT_SECONDARY};
  box-shadow: ${props => props.$active ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};
`;

export const SaveBadge = styled.span`
  background: ${COLORS.SUCCESS};
  color: ${COLORS.TEXT_WHITE};
  padding: 4px 10px;
  border-radius: 50px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 4px;
`;

export const PlansSection = styled.section`
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px 60px;
`;

export const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
  max-width: 1100px;
  margin: 0 auto;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
    max-width: 720px;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    max-width: 400px;
  }
`;

export const PlanCard = styled.div`
  background: ${props => props.$popular ? COLORS.TEXT_PRIMARY : COLORS.BG_WHITE};
  color: ${props => props.$popular ? COLORS.BG_WHITE : COLORS.TEXT_PRIMARY};
  border-radius: 20px;
  padding: 28px 24px;
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;

  ${props => props.$popular && `
    transform: scale(1.04);

    @media (max-width: 1024px) {
      transform: scale(1);
    }
  `}
  
  &:hover {
    transform: ${props => props.$popular ? 'scale(1.07)' : 'translateY(-4px)'};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    
    @media (max-width: 968px) {
      transform: translateY(-4px);
    }
  }
`;

export const PopularBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: ${COLORS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  padding: 6px 16px;
  border-radius: 50px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const PlanIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${props => props.$popular ? 'rgba(102, 126, 234, 0.2)' : COLORS.BG_GRAY};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  
  svg {
    font-size: 24px;
    color: ${props => props.$popular ? '#a78bfa' : COLORS.PRIMARY};
  }
`;

export const PlanName = styled.h3`
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
`;

export const PlanDescription = styled.p`
  font-size: 14px;
  color: ${props => props.$popular ? 'rgba(255,255,255,0.7)' : COLORS.TEXT_SECONDARY};
  margin: 0 0 24px;
`;

export const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
`;

export const Price = styled.span`
  font-size: 48px;
  font-weight: 700;
`;

export const PricePeriod = styled.span`
  font-size: 16px;
  color: ${props => props.$popular ? 'rgba(255,255,255,0.7)' : COLORS.TEXT_SECONDARY};
`;

export const BilledText = styled.p`
  font-size: 13px;
  color: ${props => props.$popular ? 'rgba(255,255,255,0.5)' : COLORS.TEXT_MUTED};
  margin: 0 0 24px;
`;

export const PlanButton = styled.button`
  width: 100%;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 24px;
  text-align: center;

  ${props => props.$current ? `
    background: transparent;
    color: ${props.$popular ? 'rgba(255,255,255,0.7)' : COLORS.TEXT_SECONDARY};
    border: 1px dashed ${props.$popular ? 'rgba(255,255,255,0.25)' : COLORS.BORDER_LIGHT};
    cursor: default;
    font-weight: 500;
    letter-spacing: 0.2px;
  ` : props.$popular ? `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_PRIMARY};
    border: none;

    &:hover {
      background: ${COLORS.BG_GRAY};
    }
  ` : `
    background: ${COLORS.BG_DARK};
    color: ${COLORS.TEXT_WHITE};
    border: none;

    &:hover {
      background: #2d2d44;
    }
  `}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

export const FeaturesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

export const FeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  font-size: 14px;
  color: ${props => props.$popular ? 'rgba(255,255,255,0.9)' : '#374151'};
  
  svg {
    flex-shrink: 0;
    font-size: 18px;
    color: ${props => props.$popular ? '#a78bfa' : COLORS.SUCCESS};
    margin-top: 2px;
  }
`;

// Compare Section
export const CompareSection = styled.section`
  max-width: 900px;
  margin: 0 auto;
  padding: 60px 20px;
`;

// Promo Section
export const PromoButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #f8f0ff 0%, #fff0f5 100%);
  border: 1px solid #e8d5f5;
  border-radius: 50px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.SECONDARY};
  transition: all 0.2s;
  
  .icon {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      color: ${COLORS.TEXT_WHITE};
      font-size: 16px;
    }
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(240, 147, 251, 0.25);
    border-color: #d8b4fe;
  }

  @media (max-width: 768px) {
    position: relative;
    top: auto;
    right: auto;
    margin: 12px auto 0;
    display: flex;
    justify-content: center;
    font-size: 13px;
    padding: 8px 16px;
  }
`;

export const SectionTitle = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  text-align: center;
  margin: 0 0 40px;
`;

export const CompareTable = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
`;

export const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 20px 24px;
  background: ${COLORS.BG_LIGHT};
  border-bottom: 1px solid ${COLORS.BORDER_LIGHT};

  @media (max-width: 768px) {
    grid-template-columns: 1.4fr 0.9fr 0.9fr 0.9fr;
    padding: 16px 12px;
  }
`;

export const TableHeaderCell = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$highlight ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY};
  text-align: ${props => props.$center ? 'center' : 'left'};
`;

export const TableRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 16px 24px;
  border-bottom: 1px solid ${COLORS.BG_GRAY};

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1.4fr 0.9fr 0.9fr 0.9fr;
    padding: 12px;
  }
`;

export const TableCell = styled.div`
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: ${props => props.$center ? 'center' : 'flex-start'};
  
  svg {
    font-size: 20px;
  }
  
  .check {
    color: ${COLORS.SUCCESS};
  }
  
  .cross {
    color: ${COLORS.BORDER_DEFAULT};
  }
`;

// FAQ Section
export const FAQSection = styled.section`
  max-width: 700px;
  margin: 0 auto;
  padding: 60px 20px;
`;

export const FAQItem = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
`;

export const FAQQuestion = styled.button`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: ${COLORS.BG_WHITE};
  border: none;
  cursor: pointer;
  text-align: left;
  
  h4 {
    font-size: 15px;
    font-weight: 600;
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0;
  }
  
  svg {
    color: ${COLORS.TEXT_SECONDARY};
    transition: transform 0.2s;
    transform: ${props => props.$open ? 'rotate(180deg)' : 'rotate(0)'};
  }
`;

export const FAQAnswer = styled.div`
  padding: ${props => props.$open ? '0 24px 20px' : '0 24px'};
  max-height: ${props => props.$open ? '200px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
  
  p {
    font-size: 14px;
    color: ${COLORS.TEXT_SECONDARY};
    line-height: 1.6;
    margin: 0;
  }
`;

// CTA Section
export const CTASection = styled.section`
  background: ${COLORS.BG_DARK};
  padding: 60px 20px;
  text-align: center;
  margin-top: 40px;
  border-radius: 24px;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 60px;
`;

export const CTATitle = styled.h3`
  font-size: 28px;
  font-weight: 700;
  color: ${COLORS.TEXT_WHITE};
  margin: 0 0 12px;
`;

export const CTASubtitle = styled.p`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 32px;
`;

export const CTAButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
`;

export const CTAButton = styled.button`
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_PRIMARY};
    border: none;
    
    &:hover {
      background: ${COLORS.BG_GRAY};
    }
  ` : `
    background: transparent;
    color: ${COLORS.TEXT_WHITE};
    border: 2px solid rgba(255, 255, 255, 0.3);
    
    &:hover {
      border-color: ${COLORS.TEXT_WHITE};
    }
  `}
`;

// Credit Packs Section
export const CreditPacksSection = styled.section`
  max-width: 1000px;
  margin: 0 auto;
  padding: 60px 20px;
`;

export const CreditPacksGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 900px;
  margin: 0 auto 32px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 400px;
  }
`;

export const CreditPackCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border: ${props => props.$popular ? `2px solid ${COLORS.PRIMARY}` : `1px solid ${COLORS.BORDER_LIGHT}`};
  position: relative;
  transition: all 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
`;

export const PackBadge = styled.div`
  position: absolute;
  top: -10px;
  right: 16px;
  background: ${GRADIENTS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  padding: 4px 12px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 600;
`;

export const PackName = styled.h4`
  font-size: 16px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 4px;
`;

export const PackDescription = styled.p`
  font-size: 13px;
  color: ${COLORS.TEXT_SECONDARY};
  margin: 0 0 16px;
  line-height: 1.4;
`;

export const PackPrice = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${COLORS.TEXT_PRIMARY};
  margin-bottom: 4px;
`;

export const PackPerCredit = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_MUTED};
  margin-bottom: 16px;
`;

export const PackButton = styled.button`
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$popular ? '${GRADIENTS.PRIMARY}' : COLORS.BG_GRAY};
  color: ${props => props.$popular ? COLORS.BG_WHITE : '#374151'};
  
  &:hover {
    background: ${props => props.$popular ? 'linear-gradient(135deg, #5a6fd6, #6a4198)' : COLORS.BORDER_LIGHT};
  }
`;

export const AddOnGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 320px;
    margin: 0 auto;
  }
`;

export const AddOnCard = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid ${COLORS.BORDER_LIGHT};
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  }
`;

export const AddOnIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: ${props => props.$color || COLORS.BG_GRAY};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    color: ${COLORS.TEXT_WHITE};
    font-size: 22px;
  }
`;

export const AddOnInfo = styled.div`
  flex: 1;
`;

export const AddOnName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${COLORS.TEXT_PRIMARY};
`;

export const AddOnDesc = styled.div`
  font-size: 12px;
  color: ${COLORS.TEXT_SECONDARY};
`;

export const AddOnPrice = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${COLORS.PRIMARY};
  flex-shrink: 0;
`;

// Snackbar
export const Snackbar = styled.div`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) ${props => props.$show ? 'translateY(0)' : 'translateY(100px)'};
  background: ${props => props.$type === 'success' ? COLORS.SUCCESS : props.$type === 'error' ? COLORS.ERROR : COLORS.INFO};
  color: ${COLORS.TEXT_WHITE};
  padding: 16px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  opacity: ${props => props.$show ? 1 : 0};
  transition: all 0.3s ease;
  z-index: 1000;
`;

// ─── Styled components for previously inlined styles ─────────────

export const CreditPacksSubtitle = styled.p`
  text-align: center;
  color: ${COLORS.TEXT_SECONDARY};
  margin-top: -24px;
  margin-bottom: 32px;
  font-size: 15px;
`;

export const AddOnSectionHeader = styled.p`
  text-align: center;
  color: ${COLORS.TEXT_MUTED};
  font-size: 13px;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
`;

// ─── MUI sx prop exports ─────────────────────────────────────────

export const dialogPaperSx = {
  borderRadius: 3,
  p: 1,
} as const;

export const dialogTitleSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  pb: 1,
} as const;

export const promoIconBoxSx = {
  width: 36,
  height: 36,
  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export const giftIconSx = {
  color: 'white',
  fontSize: 18,
} as const;
