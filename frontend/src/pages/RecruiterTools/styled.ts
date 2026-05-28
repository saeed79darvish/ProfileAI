// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes } from 'styled-components';

export const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const PageWrap = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const HeroSection = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  padding: 2.5rem 0 4rem;
  color: white;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -80px;
    right: -80px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: rgba(255,255,255,0.07);
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -100px;
    left: -50px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
`;

export const HeroInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
`;

export const HeroRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
`;

export const HeroLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const HeroBackBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.12);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 20px;

  &:hover {
    background: rgba(255,255,255,0.22);
    border-color: rgba(255,255,255,0.5);
  }
`;

export const HeroTitle = styled.h1`
  font-size: 32px;
  font-weight: 800;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const HeroSub = styled.p`
  font-size: 16px;
  margin: 0;
  opacity: 0.8;
`;

export const ViewProfileBtn = styled.button`
  padding: 10px 22px;
  border-radius: 10px;
  border: none;
  background: white;
  color: #7c3aed;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  }
`;

export const ProfileCard = styled.div`
  max-width: 1100px;
  margin: -2.5rem auto 0;
  padding: 0 24px;
  position: relative;
  z-index: 10;
  animation: ${fadeIn} 0.4s ease;
`;

export const ProfileInner = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 28px 32px;
  display: flex;
  gap: 28px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    padding: 20px;
    gap: 16px;
  }
`;

export const ProfileMain = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 260px;
`;

export const ProfileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ProfileName = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
`;

export const ProfileRole = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const ProfileMeta = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: flex-start;
  flex: 1;
`;

export const MetaBlock = styled.div`
  min-width: 160px;

  .label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin: 0 0 6px;
  }
`;

export const TabBar = styled.div`
  max-width: 1100px;
  margin: 24px auto 0;
  padding: 0 24px;
`;

export const TabStrip = styled.div`
  display: flex;
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
`;

export const TabItem = styled.button`
  flex: 1;
  min-width: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 12px;
  border: none;
  background: ${p => p.$active ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#64748b'};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 14px;
  transition: all 0.25s;
  white-space: nowrap;

  &:hover {
    background: ${p => p.$active ? '' : '#f5f3ff'};
    color: ${p => p.$active ? 'white' : '#7c3aed'};
  }

  svg { font-size: 20px; }
`;

export const ContentArea = styled.div`
  max-width: 1100px;
  margin: 20px auto 48px;
  padding: 0 24px;
`;

export const Panel = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  padding: 28px 32px;
  animation: ${fadeIn} 0.35s ease;

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

export const PanelHeader = styled.div`
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 6px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  p {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }
`;

export const AutoPopBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f5f3ff;
  border: 1px solid #ede9fe;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 18px;
  color: #6d28d9;
  font-size: 14px;
  font-weight: 500;

  svg { font-size: 20px; opacity: 0.7; }
`;

export const GenerateBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(124,58,237,0.35);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

export const ReadyBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #059669;
  border: 1px solid #a7f3d0;
  background: #ecfdf5;
`;

export const ResultCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 24px;
  margin-top: 20px;
  animation: ${fadeIn} 0.4s ease;
`;

export const ScoreBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  border-radius: 24px;
  font-weight: 700;
  font-size: 14px;
  background: ${p => {
    if (p.$score >= 80) return '#ecfdf5';
    if (p.$score >= 50) return '#fffbeb';
    return '#fef2f2';
  }};
  color: ${p => {
    if (p.$score >= 80) return '#059669';
    if (p.$score >= 50) return '#d97706';
    return '#dc2626';
  }};
`;