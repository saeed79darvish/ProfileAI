import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Styled Components
export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Header = styled.header`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  padding: 2rem 0;
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

  &::after {
    content: '';
    position: absolute;
    bottom: -80px;
    left: -40px;
    width: 250px;
    height: 250px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
`;

export const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
`;

export const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255,255,255,0.25);
    color: white;
    border-color: rgba(255,255,255,0.5);
  }
`;

export const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    color: rgba(255,255,255,0.8);
    font-size: 32px;
  }
`;

export const Content = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
`;

export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

export const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  animation: ${fadeIn} 0.3s ease;
  
  .icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.$bg || '#f0fdf4'};
    
    svg {
      font-size: 24px;
      color: ${props => props.$color || '#22c55e'};
    }
  }
  
  .content {
    h3 {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }
    
    p {
      font-size: 14px;
      color: #64748b;
      margin: 4px 0 0;
    }
  }
`;

export const FiltersSection = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;
`;

export const SearchInput = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  flex: 1;
  max-width: 400px;
  
  svg {
    color: #94a3b8;
    font-size: 20px;
  }
  
  input {
    border: none;
    outline: none;
    width: 100%;
    font-size: 14px;
    color: #1e293b;
    
    &::placeholder {
      color: #94a3b8;
    }
  }
`;

export const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: ${props => props.$active ? '#7c3aed' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#7c3aed' : '#e2e8f0'};
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    background: ${props => props.$active ? '#5a6fd6' : '#f8fafc'};
    border-color: ${props => props.$active ? '#5a6fd6' : '#cbd5e1'};
  }
`;

export const DownloadTemplateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
  
  svg {
    font-size: 18px;
  }
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
`;

export const ImportsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const ImportCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

export const ImportHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

export const ImportInfo = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-start;
`;

export const ImportIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => {
    switch (props.$type) {
      case 'csv': return '#fef3c7';
      case 'linkedin': return '#dbeafe';
      case 'email': return '#fce7f3';
      default: return '#f1f5f9';
    }
  }};
  
  svg {
    font-size: 24px;
    color: ${props => {
      switch (props.$type) {
        case 'csv': return '#f59e0b';
        case 'linkedin': return '#0077b5';
        case 'email': return '#ec4899';
        default: return '#64748b';
      }
    }};
  }
`;

export const ImportDetails = styled.div`
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }
  
  .meta {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    
    span {
      font-size: 13px;
      color: #94a3b8;
    }
  }
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  
  svg {
    font-size: 16px;
  }
  
  ${props => {
    switch (props.$status) {
      case 'completed':
        return `
          background: #f0fdf4;
          color: #22c55e;
        `;
      case 'processing':
        return `
          background: #fef3c7;
          color: #f59e0b;
          
          svg {
            animation: ${spin} 1s linear infinite;
          }
        `;
      case 'failed':
        return `
          background: #fef2f2;
          color: #ef4444;
        `;
      case 'pending':
        return `
          background: #f1f5f9;
          color: #64748b;
        `;
      default:
        return `
          background: #f1f5f9;
          color: #64748b;
        `;
    }
  }}
`;

export const ImportStats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 16px;
`;

export const ImportStat = styled.div`
  text-align: center;
  
  .value {
    font-size: 20px;
    font-weight: 700;
    color: ${props => props.$color || '#1e293b'};
  }
  
  .label {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }
`;

export const ImportActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: ${props => props.$variant === 'danger' ? '#fef2f2' : 'white'};
  color: ${props => props.$variant === 'danger' ? '#ef4444' : '#64748b'};
  border: 1px solid ${props => props.$variant === 'danger' ? '#fecaca' : '#e2e8f0'};
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  
  svg {
    font-size: 16px;
  }
  
  &:hover {
    background: ${props => props.$variant === 'danger' ? '#fee2e2' : '#f8fafc'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 12px;
  animation: ${fadeIn} 0.3s ease;
  
  svg {
    font-size: 64px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 20px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }
`;

export const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
  
  svg {
    font-size: 48px;
    color: #7c3aed;
    animation: ${spin} 1s linear infinite;
  }
`;

export const Toast = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  background: ${props => props.$type === 'error' ? '#ef4444' : '#22c55e'};
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: ${fadeIn} 0.3s ease;
`;
