import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

export const Card = styled.div`
  background: white;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 600px;
  width: 100%;
  overflow: hidden;
  animation: ${fadeIn} 0.5s ease-out;
`;

export const Header = styled.div`
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  padding: 32px;
  text-align: center;
  color: white;
`;

export const Logo = styled.div`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  svg {
    color: #667eea;
  }
`;

export const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
`;

export const Subtitle = styled.p`
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
`;

export const Content = styled.div`
  padding: 32px;
`;

export const JobCard = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
`;

export const JobTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
`;

export const CompanyName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #64748b;
  margin-bottom: 16px;
  
  svg {
    font-size: 20px;
    color: #667eea;
  }
`;

export const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`;

export const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #64748b;
  
  svg {
    font-size: 18px;
    color: #94a3b8;
  }
`;

export const PersonalMessage = styled.div`
  background: #eff6ff;
  border-left: 4px solid #667eea;
  padding: 16px;
  border-radius: 0 8px 8px 0;
  margin-bottom: 24px;
  
  p {
    font-style: italic;
    color: #475569;
    margin: 0 0 8px;
  }
  
  .author {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
  }
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #374151;
`;

export const Input = styled.input`
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 16px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const PasswordWrapper = styled.div`
  position: relative;
  
  input {
    width: 100%;
    padding-right: 48px;
  }
  
  button {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 4px;
    display: flex;
    
    &:hover {
      color: #1e293b;
    }
  }
`;

export const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const ConsentSection = styled.div`
  background: #fefce8;
  border: 1px solid #fef08a;
  border-radius: 12px;
  padding: 20px;
`;

export const ConsentTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    color: #eab308;
  }
`;

export const ConsentItem = styled.label`
  display: flex;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  input {
    width: 20px;
    height: 20px;
    accent-color: #667eea;
  }
  
  .text {
    flex: 1;
    
    .title {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 2px;
    }
    
    .description {
      font-size: 13px;
      color: #64748b;
    }
  }
`;

export const Features = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const Feature = styled.div`
  text-align: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  
  svg {
    font-size: 28px;
    color: #667eea;
    margin-bottom: 8px;
  }
  
  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 4px;
  }
  
  p {
    font-size: 12px;
    color: #64748b;
    margin: 0;
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

export const Button = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    
    &:hover:not(:disabled) {
      background: #f8fafc;
      color: #1e293b;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const ErrorMessage = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const ExpiredMessage = styled.div`
  text-align: center;
  padding: 48px 24px;
  
  svg {
    font-size: 64px;
    color: #f59e0b;
    margin-bottom: 16px;
  }
  
  h2 {
    font-size: 24px;
    color: #1e293b;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 16px;
    color: #64748b;
    margin: 0;
  }
`;

export const SuccessMessage = styled.div`
  text-align: center;
  padding: 48px 24px;
  
  svg {
    font-size: 64px;
    color: #22c55e;
    margin-bottom: 16px;
  }
  
  h2 {
    font-size: 24px;
    color: #1e293b;
    margin: 0 0 8px;
  }
  
  p {
    font-size: 16px;
    color: #64748b;
    margin: 0 0 24px;
  }
`;

export const LoadingSpinner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  p {
    margin-top: 16px;
    color: #64748b;
  }
`;
