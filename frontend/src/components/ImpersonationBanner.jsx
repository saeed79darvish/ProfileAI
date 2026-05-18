import React from 'react';
import styled from 'styled-components';
import { ExitToApp as ExitIcon, Person as PersonIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Banner = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  color: white;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 9999;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
`;

const BannerContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    font-size: 20px;
  }
`;

const BannerText = styled.span`
  font-size: 14px;
  font-weight: 500;
  
  strong {
    font-weight: 700;
  }
`;

const ExitButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  svg {
    font-size: 18px;
  }
`;

const ImpersonationBanner = () => {
  const { user, isImpersonating, exitImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = async () => {
    try {
      await exitImpersonation();
      navigate('/recruiter/profiles'); // Return to recruiter profiles page
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
    }
  };

  return (
    <Banner>
      <BannerContent>
        <PersonIcon />
        <BannerText>
          You are viewing as <strong>{user?.firstName} {user?.lastName}</strong>
          {user?.impersonatedBy && (
            <> (logged in by {user.impersonatedBy.firstName} {user.impersonatedBy.lastName})</>
          )}
        </BannerText>
      </BannerContent>
      <ExitButton onClick={handleExit}>
        <ExitIcon />
        Exit View
      </ExitButton>
    </Banner>
  );
};

export default ImpersonationBanner;
