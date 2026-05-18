import styled from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Header = styled.header`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  padding: 1.5rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
`;

export const HeaderContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgba(255,255,255,0.5);
    background: rgba(255,255,255,0.25);
  }
`;

export const Title = styled.div`
  h1 {
    font-size: 24px;
    font-weight: 700;
    color: white;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 14px;
    color: rgba(255,255,255,0.7);
    margin: 0;
  }
`;

export const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
`;

export const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: white;
    color: #7c3aed;
    border: none;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
    }
  ` : `
    background: rgba(255,255,255,0.15);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    
    &:hover {
      border-color: #cbd5e1;
      color: #374151;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const Content = styled.main`
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

export const Panel = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

export const PanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  
  h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }
`;

export const PanelBody = styled.div`
  padding: 24px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
`;

export const TemplateCard = styled.div`
  padding: 16px;
  border: 2px solid ${props => props.$selected ? '#7c3aed' : '#e2e8f0'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
  
  &:hover {
    border-color: #7c3aed;
    background: #f8fafc;
  }
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 8px;
  }
  
  .count {
    font-size: 12px;
    color: #7c3aed;
    font-weight: 500;
  }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  
  svg {
    font-size: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  }
  
  p {
    font-size: 14px;
    margin: 8px 0 0;
  }
`;

export const LoadingState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export const QuestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const QuestionCard = styled.div`
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  .drag-handle {
    color: #94a3b8;
    cursor: grab;
    margin-top: 2px;
  }
  
  .content {
    flex: 1;
    
    .label {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    
    .type {
      font-size: 12px;
      color: #7c3aed;
      text-transform: uppercase;
      font-weight: 500;
    }
    
    .required {
      display: inline-block;
      margin-left: 8px;
      font-size: 11px;
      padding: 2px 6px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 4px;
    }
  }
  
  .delete {
    color: #94a3b8;
    cursor: pointer;
    transition: color 0.2s;
    
    &:hover {
      color: #dc2626;
    }
  }
`;
