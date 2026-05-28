// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 40px;
  background: white;
  border-bottom: 1px solid #f0f0f0;

  @media (max-width: 768px) {
    padding: 16px 20px;
  }
`;

export const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  svg { font-size: 26px; color: #667eea; }
`;

export const MainContent = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;

  @media (max-width: 480px) {
    padding: 24px 16px;
    align-items: flex-start;
  }
`;

export const ContentWrapper = styled.div`
  max-width: 720px;
  width: 100%;
  animation: ${fadeIn} 0.5s ease;
`;

export const WelcomeBubble = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border-radius: 50px;
  padding: 8px 24px 8px 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  width: fit-content;
  margin: 0 auto 32px;

  @media (max-width: 480px) {
    gap: 10px;
    padding: 6px 16px 6px 6px;
    margin-bottom: 24px;
  }
`;

export const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 36px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const ChoiceCard = styled.div`
  background: white;
  border-radius: 18px;
  padding: 32px 28px;
  text-align: center;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  border: 2px solid transparent;
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: ${props => props.$disabled ? 0.7 : 1};

  @media (max-width: 480px) {
    padding: 24px 20px;
    border-radius: 14px;
  }

  &:hover {
    border-color: ${props => props.$disabled ? 'transparent' : '#667eea'};
    transform: ${props => props.$disabled ? 'none' : 'translateY(-4px)'};
    box-shadow: ${props => props.$disabled ? '0 2px 16px rgba(0,0,0,0.05)' : '0 8px 28px rgba(102,126,234,0.15)'};
  }

  &:focus-visible {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102,126,234,0.25), 0 8px 28px rgba(102,126,234,0.15);
  }
`;

export const IconCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: ${props => props.$gradient || 'linear-gradient(135deg, #667eea, #764ba2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 14px ${props => props.$shadow || 'rgba(102,126,234,0.3)'};

  @media (max-width: 480px) {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    margin-bottom: 16px;
    svg { font-size: 24px !important; }
  }

  svg {
    font-size: 28px;
    color: white;
  }
`;

export const CardButton = styled.div`
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: ${props => props.$bg || 'linear-gradient(135deg, #667eea, #764ba2)'};
  color: white;
  font-weight: 600;
  font-size: 14px;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: auto;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 4px 14px rgba(102,126,234,0.4);
  }

  svg { font-size: 18px; }
`;

export const FeatureTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${props => props.$bg || 'rgba(102,126,234,0.08)'};
  color: ${props => props.$color || '#667eea'};
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  margin-top: 12px;
`;

export const UploadOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
`;