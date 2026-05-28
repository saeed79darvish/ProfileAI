// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled from 'styled-components';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

export const HeroSection = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  padding: 2rem 0;
  color: white;
  position: relative;
  overflow: hidden;
  margin-bottom: 24px;

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

export const HeroContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h1 {
    font-size: 28px;
    color: white;
    margin: 0;
  }
`;

export const CalendarNav = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    background: rgba(255,255,255,0.15);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(255,255,255,0.25);
      border-color: rgba(255,255,255,0.5);
    }
  }
  
  .month-year {
    font-size: 18px;
    font-weight: 600;
    color: white;
    min-width: 200px;
    text-align: center;
  }
`;

export const TodayButton = styled.button`
  padding: 8px 16px;
  background: white;
  color: #7c3aed;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #4f46e5;
  }
`;

export const CalendarGrid = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

export const WeekDays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

export const WeekDay = styled.div`
  padding: 12px;
  text-align: center;
  font-weight: 600;
  color: #64748b;
  font-size: 14px;
`;

export const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
`;

export const DayCell = styled.div`
  min-height: 120px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  padding: 8px;
  background: ${props => props.$isToday ? '#f0f9ff' : props.$isOtherMonth ? '#fafafa' : 'white'};
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:nth-child(7n) {
    border-right: none;
  }
  
  &:hover {
    background: #f8fafc;
  }
`;

export const DayNumber = styled.div`
  font-weight: ${props => props.$isToday ? '700' : '500'};
  color: ${props => props.$isToday ? '#7c3aed' : props.$isOtherMonth ? '#cbd5e1' : '#1e293b'};
  margin-bottom: 8px;
  
  ${props => props.$isToday && `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #7c3aed;
    color: white;
    border-radius: 50%;
  `}
`;

export const InterviewChip = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => {
    switch (props.$status) {
      case 'confirmed': return '#ecfdf5';
      case 'pending': return '#fef3c7';
      case 'cancelled': return '#fef2f2';
      default: return '#f1f5f9';
    }
  }};
  border-left: 3px solid ${props => {
    switch (props.$status) {
      case 'confirmed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#7c3aed';
    }
  }};
  border-radius: 4px;
  font-size: 11px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateX(2px);
  }
  
  .time {
    font-weight: 600;
    color: #1e293b;
  }
  
  .name {
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const Sidebar = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transform: translateX(${props => props.$open ? '0' : '100%'});
  transition: transform 0.3s ease;
  overflow-y: auto;
`;

export const SidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
  opacity: ${props => props.$open ? 1 : 0};
  pointer-events: ${props => props.$open ? 'auto' : 'none'};
  transition: opacity 0.3s ease;
`;

export const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h2 {
    margin: 0;
    font-size: 18px;
    color: #1e293b;
  }
  
  button {
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;
    font-size: 24px;
    
    &:hover {
      color: #1e293b;
    }
  }
`;

export const SidebarContent = styled.div`
  padding: 20px;
`;

export const InterviewDetail = styled.div`
  margin-bottom: 20px;
`;

export const DetailRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  
  svg {
    color: #7c3aed;
    margin-top: 2px;
  }
  
  .label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }
  
  .value {
    font-weight: 500;
    color: #1e293b;
  }
`;

export const CandidateCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  margin-bottom: 16px;
  
  img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
  }
  
  .info {
    flex: 1;
    
    .name {
      font-weight: 600;
      color: #1e293b;
    }
    
    .headline {
      font-size: 13px;
      color: #64748b;
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
  
  ${props => {
    switch (props.$status) {
      case 'confirmed':
        return `background: #ecfdf5; color: #065f46;`;
      case 'pending':
        return `background: #fef3c7; color: #92400e;`;
      case 'cancelled':
        return `background: #fef2f2; color: #991b1b;`;
      default:
        return `background: #f1f5f9; color: #475569;`;
    }
  }}
`;

export const AIScreeningBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  
  svg {
    font-size: 12px;
  }
`;

export const MeetingLink = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #7c3aed;
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  margin-top: 16px;
  transition: background 0.2s ease;
  
  &:hover {
    background: #4f46e5;
  }
`;

export const UpcomingSection = styled.div`
  margin-top: 32px;
`;

export const UpcomingCard = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

export const DateBlock = styled.div`
  text-align: center;
  min-width: 60px;
  
  .month {
    font-size: 12px;
    color: #7c3aed;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .day {
    font-size: 28px;
    font-weight: 700;
    color: #1e293b;
    line-height: 1;
  }
  
  .weekday {
    font-size: 12px;
    color: #64748b;
  }
`;

export const UpcomingInfo = styled.div`
  flex: 1;
  
  .time {
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 4px;
  }
  
  .candidate {
    color: #64748b;
    font-size: 14px;
  }
  
  .job {
    font-size: 13px;
    color: #94a3b8;
  }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  
  svg {
    font-size: 48px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  h3 {
    color: #1e293b;
    margin-bottom: 8px;
  }
`;