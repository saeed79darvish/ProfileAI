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
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  animation: ${fadeIn} 0.6s ease-out;
`;

export const Header = styled.div`
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  padding: 32px;
  color: white;
  text-align: center;
`;

export const Logo = styled.div`
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
  span { color: #a78bfa; }
`;

export const Title = styled.h1`
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
  color: white;
`;

export const Subtitle = styled.p`
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
`;

export const Content = styled.div`
  padding: 32px;
`;

export const SearchForm = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

export const SearchInput = styled.input`
  flex: 1;
  padding: 14px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #1e293b;
  outline: none;
  text-align: center;
  font-family: monospace;
  
  &:focus { border-color: #667eea; }
  &::placeholder { 
    color: #cbd5e1; 
    letter-spacing: 2px; 
    font-size: 14px;
    font-weight: 400;
  }
`;

export const SearchButton = styled.button`
  padding: 14px 20px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

export const ResultCard = styled.div`
  animation: ${fadeIn} 0.4s ease-out;
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
`;

export const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 16px;
  
  ${p => {
    switch (p.$status) {
      case 'pending_screening':
      case 'submitted':
        return 'background: #fef3c7; color: #92400e;';
      case 'under_review':
      case 'screening':
        return 'background: #dbeafe; color: #1e40af;';
      case 'shortlisted':
        return 'background: #dcfce7; color: #166534;';
      case 'interview_scheduled':
      case 'interview_completed':
        return 'background: #e0e7ff; color: #3730a3;';
      case 'offered':
      case 'accepted':
        return 'background: #d1fae5; color: #065f46;';
      case 'rejected':
        return 'background: #fef2f2; color: #991b1b;';
      default:
        return 'background: #f1f5f9; color: #475569;';
    }
  }}
`;

export const JobInfo = styled.div`
  margin-bottom: 16px;
`;

export const JobTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
`;

export const JobMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

export const JobMetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
  svg { font-size: 16px; }
`;

export const AppliedDate = styled.p`
  font-size: 13px;
  color: #94a3b8;
  margin: 16px 0 0;
`;

export const MatchScore = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  margin-top: 12px;
`;

export const ErrorMsg = styled.p`
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
`;

export const HomeLink = styled.button`
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
  padding: 0;
  
  &:hover { text-decoration: underline; }
`;
