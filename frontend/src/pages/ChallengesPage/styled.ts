import styled, { keyframes } from 'styled-components';

export const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

export const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ============ STYLED COMPONENTS ============
export const PageContainer = styled.div`
  min-height: 100vh;
  background: #eef1f8;
  padding-top: 24px;
  padding-bottom: 64px;
`;

export const HeroSection = styled.div`
  background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 100%);
  border-radius: 24px;
  padding: 48px 40px 32px;
  margin-bottom: 32px;
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -80%;
    right: -15%;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%);
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -60%;
    left: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
    border-radius: 50%;
  }

  @media (max-width: 600px) {
    padding: 28px 20px 24px;
    border-radius: 16px;
  }
`;

export const LiveBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 6px 16px;
  border-radius: 24px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 20px;
`;

export const LiveDot = styled.span`
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: ${pulse} 2s infinite;
`;

export const GradientText = styled.span`
  background: linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

export const StatsRow = styled.div`
  display: flex;
  gap: 32px;
  margin-top: 28px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    gap: 16px;
  }
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const StatIconCircle = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$bg || 'rgba(139, 92, 246, 0.25)'};
`;

export const TrendingBar = styled.div`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 14px 20px;
  margin-top: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
`;

export const TrendingLabel = styled.span`
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

export const FilterSection = styled.div`
  background: white;
  border-radius: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

export const ChallengeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

export const ChallengeCardStyled = styled.div`
  background: white;
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 16px 48px rgba(99, 102, 241, 0.15);
  }
`;

export const CardImageWrapper = styled.div`
  height: 180px;
  position: relative;
  overflow: hidden;
  background: ${props => props.$gradient || 'linear-gradient(135deg, #6366f1, #8b5cf6)'};
`;

export const CardImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const CategoryBadge = styled.div`
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const CategoryDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$color || '#22c55e'};
`;

export const FavoriteButton = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s ease;

  &:hover {
    background: white;
    transform: scale(1.1);
  }
`;

export const TimeBadge = styled.div`
  position: absolute;
  bottom: 14px;
  left: 14px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const CardBody = styled.div`
  padding: 20px;
`;

export const XpBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
`;

export const ViewDetailsLink = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6366f1;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: gap 0.2s ease;

  &:hover {
    gap: 8px;
  }
`;

export const LeaderboardSection = styled.div`
  background: white;
  border-radius: 20px;
  padding: 32px;
  margin-top: 40px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
`;

export const LeaderboardTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
`;

export const LeaderboardRow = styled.tr`
  background: ${props => props.$isTop ? 'linear-gradient(135deg, #fefce8, #fef9c3)' : '#f8fafc'};
  border-radius: 12px;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    transform: translateX(4px);
  }

  td {
    padding: 14px 16px;

    &:first-child {
      border-radius: 12px 0 0 12px;
    }

    &:last-child {
      border-radius: 0 12px 12px 0;
    }
  }
`;

export const RankBadge = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  background: ${props => {
    if (props.$rank === 1) return 'linear-gradient(135deg, #f59e0b, #d97706)';
    if (props.$rank === 2) return 'linear-gradient(135deg, #94a3b8, #64748b)';
    if (props.$rank === 3) return 'linear-gradient(135deg, #d97706, #b45309)';
    return '#e2e8f0';
  }};
  color: ${props => props.$rank <= 3 ? 'white' : '#475569'};
`;
