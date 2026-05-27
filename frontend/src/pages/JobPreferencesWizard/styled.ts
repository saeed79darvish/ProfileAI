import styled, { keyframes, css } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const slideInRight = keyframes`
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const slideInLeft = keyframes`
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
`;

export const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7ff 0%, #f0f0f8 50%, #faf5ff 100%);
  display: flex;
  flex-direction: column;
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(102, 126, 234, 0.08);

  @media (max-width: 768px) {
    padding: 12px 16px;
  }
`;

export const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  svg { font-size: 24px; color: #667eea; }
`;

export const SkipLink = styled.button`
  background: none;
  border: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
  &:hover { color: #667eea; background: rgba(102, 126, 234, 0.06); }
`;

export const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 40px;

  @media (max-width: 480px) {
    padding: 20px 12px 32px;
  }
`;

export const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 32px;

  @media (max-width: 480px) {
    margin-bottom: 28px;
    transform: scale(0.9);
  }
`;

export const StepDot = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  @media (max-width: 480px) {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  ${props => props.$state === 'completed' && css`
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    box-shadow: 0 3px 12px rgba(102, 126, 234, 0.35);
  `}
  ${props => props.$state === 'active' && css`
    background: white;
    color: #667eea;
    border: 2.5px solid #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.12);
  `}
  ${props => props.$state === 'upcoming' && css`
    background: #e8ecf4;
    color: #aab0c0;
    border: 2px solid transparent;
  `}
`;

export const StepLine = styled.div`
  width: 40px;
  height: 3px;
  border-radius: 3px;
  transition: all 0.4s ease;
  background: ${props => props.$done
    ? 'linear-gradient(90deg, #667eea, #764ba2)'
    : '#e0e4ec'};

  @media (max-width: 480px) {
    width: 24px;
  }
`;

export const StepLabel = styled.span`
  position: absolute;
  top: 42px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
  color: ${props => props.$active ? '#667eea' : '#b0b5c4'};
  transition: color 0.3s;

  @media (max-width: 480px) {
    display: none;
  }
`;

export const WizardCard = styled.div`
  width: 100%;
  max-width: 640px;
  background: white;
  border-radius: 24px;
  padding: 40px 36px 32px;
  box-shadow:
    0 4px 24px rgba(102, 126, 234, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  animation: ${fadeIn} 0.4s ease;

  @media (max-width: 640px) {
    padding: 28px 20px 24px;
    border-radius: 18px;
  }

  @media (max-width: 480px) {
    padding: 22px 16px 20px;
    border-radius: 16px;
  }
`;

export const StepContent = styled.div`
  animation: ${props => props.$dir === 'right' ? slideInRight : slideInLeft} 0.35s ease;
`;

export const TipBubble = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.06), rgba(118, 75, 162, 0.06));
  border: 1px solid rgba(102, 126, 234, 0.12);
  border-radius: 14px;
  padding: 10px 16px;
  margin-bottom: 24px;

  @media (max-width: 480px) {
    padding: 8px 12px;
    margin-bottom: 18px;
    gap: 8px;
  }
`;

export const Pill = styled.button`
  padding: 10px 20px;
  border-radius: 50px;
  border: 2px solid ${props => props.$selected ? 'transparent' : '#e4e7f0'};
  background: ${props => props.$selected
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : 'white'};
  color: ${props => props.$selected ? 'white' : '#4a5068'};
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;

  @media (max-width: 480px) {
    padding: 8px 14px;
    font-size: 13px;
    gap: 5px;
  }

  &:hover {
    border-color: ${props => props.$selected ? 'transparent' : '#667eea'};
    transform: translateY(-2px);
    box-shadow: ${props => props.$selected
      ? '0 6px 20px rgba(102, 126, 234, 0.35)'
      : '0 4px 12px rgba(0, 0, 0, 0.06)'};
  }

  &:active { transform: translateY(0); }
`;

export const SelectionCard = styled.button`
  width: 100%;
  padding: 14px 18px;
  border-radius: 14px;
  border: 2px solid ${props => props.$selected ? 'transparent' : '#e8ecf4'};
  background: ${props => props.$selected
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : 'white'};
  color: ${props => props.$selected ? 'white' : '#1a1a2e'};
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 14px;

  @media (max-width: 480px) {
    padding: 12px 14px;
    gap: 10px;
    border-radius: 12px;
  }

  &:hover {
    border-color: ${props => props.$selected ? 'transparent' : '#667eea'};
    transform: translateY(-1px);
    box-shadow: ${props => props.$selected
      ? '0 6px 20px rgba(102, 126, 234, 0.3)'
      : '0 4px 12px rgba(0, 0, 0, 0.05)'};
  }
`;

export const CardIcon = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: ${props => props.$selected
    ? 'rgba(255,255,255,0.2)'
    : 'linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.08))'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: all 0.25s;

  svg {
    font-size: 20px;
    color: ${props => props.$selected ? 'white' : '#667eea'};
  }

  @media (max-width: 480px) {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 16px;
    svg { font-size: 18px; }
  }
`;

export const WorkSetupGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const WorkCard = styled.button`
  padding: 20px 16px;
  border-radius: 16px;
  border: 2px solid ${props => props.$selected ? 'transparent' : '#e8ecf4'};
  background: ${props => props.$selected
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : 'white'};
  color: ${props => props.$selected ? 'white' : '#1a1a2e'};
  text-align: center;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  @media (max-width: 480px) {
    padding: 14px 12px;
    border-radius: 12px;
    gap: 4px;
    svg { font-size: 24px !important; }
  }
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  svg {
    font-size: 28px;
    color: ${props => props.$selected ? 'white' : '#667eea'};
    transition: color 0.25s;
  }

  &:hover {
    border-color: ${props => props.$selected ? 'transparent' : '#667eea'};
    transform: translateY(-2px);
    box-shadow: ${props => props.$selected
      ? '0 8px 24px rgba(102, 126, 234, 0.3)'
      : '0 4px 14px rgba(0,0,0,0.06)'};
  }
`;

export const SkillChipGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  @media (max-width: 480px) {
    gap: 6px;
  }
`;

export const SkillChip = styled.button`
  padding: 7px 14px;
  border-radius: 50px;
  border: 1.5px solid ${props => props.$selected ? 'transparent' : '#e0e4ec'};
  background: ${props => props.$selected
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : '#fafbfd'};
  color: ${props => props.$selected ? 'white' : '#555c72'};
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;

  @media (max-width: 480px) {
    padding: 6px 11px;
    font-size: 12px;
  }

  &:hover {
    border-color: ${props => props.$selected ? 'transparent' : '#b0b8d4'};
    background: ${props => props.$selected
      ? 'linear-gradient(135deg, #5a71d4, #6a42a0)'
      : '#f0f2f8'};
  }

  svg { font-size: 14px; }
`;

export const SelectedSkillsArea = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
  padding: 14px;
  border-radius: 14px;
  border: 1.5px dashed #d8dce8;
  background: #fafbfd;
  margin-bottom: 20px;

  @media (max-width: 480px) {
    padding: 10px;
    gap: 6px;
    min-height: 36px;
    margin-bottom: 14px;
  }
`;

export const SelectedTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 50px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 12.5px;
  font-weight: 600;

  svg {
    font-size: 14px;
    cursor: pointer;
    opacity: 0.8;
    &:hover { opacity: 1; }
  }

  @media (max-width: 480px) {
    padding: 5px 10px;
    font-size: 11.5px;
  }
`;

export const CategoryLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #8b90a3;
  margin: 16px 0 8px;
  &:first-of-type { margin-top: 0; }
`;

export const SalaryDisplay = styled.div`
  text-align: center;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(102,126,234,0.05), rgba(118,75,162,0.05));
  border: 1px solid rgba(102,126,234,0.1);
  margin-bottom: 20px;

  @media (max-width: 480px) {
    padding: 16px;
    border-radius: 12px;
  }
`;

export const NavRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #f0f1f5;

  @media (max-width: 480px) {
    margin-top: 24px;
    padding-top: 16px;
  }
`;

export const NavButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: ${props => props.$primary ? '12px 28px' : '12px 20px'};
  border-radius: 50px;
  border: ${props => props.$primary ? 'none' : '2px solid #e4e7f0'};
  background: ${props => props.$primary
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : 'white'};
  color: ${props => props.$primary ? 'white' : '#6b7185'};
  font-size: 14.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.25s;

  @media (max-width: 480px) {
    padding: ${props => props.$primary ? '10px 20px' : '10px 16px'};
    font-size: 13.5px;
    gap: 6px;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => props.$primary
      ? '0 6px 20px rgba(102,126,234,0.4)'
      : '0 3px 10px rgba(0,0,0,0.06)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  svg { font-size: 18px; }
`;

export const FinishButton = styled(NavButton)`
  animation: ${pulse} 2s infinite;
  padding: 14px 36px;
  font-size: 15px;

  @media (max-width: 480px) {
    padding: 12px 24px;
    font-size: 14px;
  }
`;
