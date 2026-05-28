// @ts-nocheck — styled-components transient ($) props and theme keys are dynamic; TS strict typing adds no value here.
import styled, { keyframes } from 'styled-components';

export const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

export const Toast = styled.div`
  position: fixed;
  top: 100px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  animation: ${props => props.$show ? slideIn : slideOut} 0.3s ease forwards;
  max-width: 400px;
  
  ${props => props.$type === 'success' ? `
    background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    border: 1px solid #86efac;
    color: #166534;
  ` : props.$type === 'error' ? `
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border: 1px solid #fca5a5;
    color: #991b1b;
  ` : `
    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
    border: 1px solid #a5b4fc;
    color: #3730a3;
  `}
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${props => props.$type === 'success' ? '#22c55e' : props.$type === 'error' ? '#ef4444' : '#6366f1'};
    color: white;
    flex-shrink: 0;
  }
  
  .content {
    flex: 1;
    
    .title {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 2px;
    }
    
    .message {
      font-size: 14px;
      opacity: 0.9;
    }
  }
  
  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    opacity: 0.7;
    transition: opacity 0.2s;
    
    &:hover {
      opacity: 1;
    }
  }
`;

export const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding-top: 80px;
`;

export const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
`;

export const Header = styled.div`
  margin-bottom: 32px;
  
  h1 {
    font-size: 32px;
    color: #1e293b;
    margin: 0 0 8px;
    font-weight: 700;
  }
  
  p {
    color: #64748b;
    margin: 0;
    font-size: 16px;
  }
`;

export const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: white;
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
`;

export const Tab = styled.button`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  ${props => props.$active ? `
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  ` : `
    background: transparent;
    color: #64748b;
    
    &:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
  `}
  
  .count {
    background: ${props => props.$active ? 'rgba(255,255,255,0.2)' : '#e2e8f0'};
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
  }
`;

export const InterviewCard = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

export const CardHeader = styled.div`
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
`;

export const JobTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 20px;
  color: #1e293b;
  font-weight: 700;
`;

export const CompanyInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 14px;
  
  svg {
    font-size: 18px;
  }
`;

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 600;
  
  ${props => {
    switch (props.$status) {
      case 'pending':
        return `
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #4338ca;
        `;
      case 'confirmed':
        return `
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #166534;
        `;
      case 'awaiting':
        return `
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
        `;
      case 'cancelled':
        return `
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #991b1b;
        `;
      case 'completed':
        return `
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #3730a3;
        `;
      case 'interviewed':
        return `
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
          color: white;
        `;
      case 'in_call':
        return `
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
          color: white;
          animation: pulse 2s infinite;
        `;
      case 'call_failed':
        return `
          background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
          color: white;
        `;
      case 'needs_reschedule':
        return `
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: white;
        `;
      case 'needs_action':
        return `
          background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
          color: white;
        `;
      default:
        return `
          background: #f1f5f9;
          color: #475569;
        `;
    }
  }}
`;

export const CardBody = styled.div`
  padding: 24px;
`;

export const AICallBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid #c7d2fe;
  
  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 16px;
    color: white;
    flex-shrink: 0;
    
    svg {
      font-size: 28px;
    }
  }
  
  .content {
    flex: 1;
    
    .title {
      font-weight: 700;
      color: #3730a3;
      font-size: 16px;
      margin-bottom: 4px;
    }
    
    .description {
      font-size: 14px;
      color: #4338ca;
      line-height: 1.5;
    }
  }
`;

export const ScheduledTimeCard = styled.div`
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 2px solid #86efac;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    
    svg {
      color: #16a34a;
      font-size: 28px;
    }
    
    .title {
      font-weight: 700;
      color: #166534;
      font-size: 18px;
    }
  }
  
  .datetime {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: white;
      border-radius: 12px;
      
      svg {
        color: #22c55e;
        font-size: 22px;
      }
      
      .label {
        font-size: 12px;
        color: #15803d;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      
      .value {
        font-weight: 700;
        color: #166534;
        font-size: 15px;
      }
    }
  }
`;

export const InterviewDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

export const DetailCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: white;
    border-radius: 10px;
    color: #6366f1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  
  .info {
    .label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .value {
      font-weight: 600;
      color: #1e293b;
      font-size: 15px;
    }
  }
`;

export const RecruiterNotes = styled.div`
  padding: 20px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-radius: 12px;
  border-left: 4px solid #f59e0b;
  margin-bottom: 24px;
  
  .title {
    font-size: 14px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .content {
    color: #78350f;
    font-size: 14px;
    line-height: 1.6;
  }
`;

export const PhoneInfoBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #7dd3fc;
  border-radius: 12px;
  margin-bottom: 20px;
  
  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    border-radius: 12px;
    color: white;
    flex-shrink: 0;
  }
  
  .content {
    flex: 1;
    
    .label {
      font-size: 12px;
      font-weight: 600;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    
    .phone {
      font-size: 18px;
      font-weight: 700;
      color: #0c4a6e;
      font-family: 'Monaco', 'Menlo', monospace;
      letter-spacing: 1px;
    }
    
    .note {
      font-size: 12px;
      color: #0284c7;
      margin-top: 4px;
    }
    
    .caller-tip {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 12px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #fbbf24;
      border-radius: 8px;
      
      .tip-icon {
        color: #d97706;
        flex-shrink: 0;
        margin-top: 1px;
      }
      
      .tip-text {
        font-size: 13px;
        color: #92400e;
        line-height: 1.4;
        
        strong {
          color: #78350f;
        }
      }
    }
  }
`;

export const ScreeningResultCard = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    
    .icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border-radius: 10px;
      color: white;
    }
    
    .title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }
  }
  
  .score-section {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
    
    .score-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${props => {
        const score = props.$score || 0;
        if (score >= 80) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        if (score >= 60) return 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)';
        if (score >= 40) return 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)';
        return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
      }};
      color: white;
      
      .value {
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
      }
      
      .label {
        font-size: 10px;
        text-transform: uppercase;
        opacity: 0.9;
      }
    }
    
    .score-description {
      flex: 1;
      
      .score-label {
        font-size: 14px;
        font-weight: 600;
        color: #334155;
        margin-bottom: 4px;
      }
      
      .score-text {
        font-size: 13px;
        color: #64748b;
        line-height: 1.5;
      }
    }
  }
  
  .summary-section {
    .summary-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 8px;
    }
    
    .summary-text {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      background: white;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
  }
`;

export const CountdownTimer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #93c5fd;
  border-radius: 16px;
  margin-bottom: 20px;
  
  .countdown-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    
    .value {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
      font-family: 'Monaco', 'Menlo', monospace;
      min-width: 48px;
      text-align: center;
    }
    
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #3b82f6;
      font-weight: 600;
    }
  }
  
  .separator {
    font-size: 24px;
    font-weight: 700;
    color: #93c5fd;
  }
`;

export const SectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const TimeSlots = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
`;

export const TimeSlot = styled.button`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid ${props => props.$selected ? '#6366f1' : '#e2e8f0'};
  border-radius: 16px;
  background: ${props => props.$selected ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  
  &:hover {
    border-color: #6366f1;
    background: ${props => props.$selected ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' : '#f8faff'};
    transform: translateX(4px);
  }
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: ${props => props.$selected ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#f1f5f9'};
    border-radius: 12px;
    color: ${props => props.$selected ? 'white' : '#64748b'};
    
    svg {
      font-size: 24px;
    }
  }
  
  .details {
    flex: 1;
    
    .date {
      font-weight: 700;
      color: #1e293b;
      font-size: 16px;
      margin-bottom: 4px;
    }
    
    .time {
      font-size: 14px;
      color: #64748b;
    }
  }
  
  .check {
    color: ${props => props.$selected ? '#6366f1' : 'transparent'};
    font-size: 28px;
  }
`;

export const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

export const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  ` : props.$variant === 'danger' ? `
    background: white;
    color: #dc2626;
    border: 2px solid #fecaca;
    
    &:hover {
      background: #fef2f2;
      border-color: #dc2626;
    }
  ` : props.$variant === 'secondary' ? `
    background: #f1f5f9;
    color: #475569;
    border: 2px solid #e2e8f0;
    
    &:hover {
      background: #e2e8f0;
      border-color: #cbd5e1;
    }
  ` : props.$variant === 'ghost' ? `
    background: transparent;
    color: #64748b;
    border: none;
    padding: 10px 16px;
    
    &:hover {
      background: #f1f5f9;
      color: #475569;
    }
  ` : `
    background: white;
    color: #6366f1;
    border: 2px solid #c7d2fe;
    
    &:hover {
      background: #eef2ff;
      border-color: #6366f1;
    }
  `}
`;

export const RescheduleSection = styled.div`
  margin-top: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 16px;
  border: 1px solid #e2e8f0;
`;

export const RescheduleSlotRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  
  input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    transition: all 0.2s;
    
    &:focus {
      outline: none;
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
  }
  
  button {
    padding: 10px;
    background: #fee2e2;
    border: none;
    border-radius: 10px;
    color: #dc2626;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: #fecaca;
    }
  }
`;

export const AddSlotButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 2px dashed #c7d2fe;
  border-radius: 10px;
  color: #6366f1;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 20px;
  transition: all 0.2s;
  
  &:hover {
    background: #eef2ff;
    border-color: #6366f1;
  }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  
  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    border-radius: 20px;
    margin: 0 auto 24px;
    
    svg {
      font-size: 40px;
      color: #94a3b8;
    }
  }
  
  h3 {
    color: #1e293b;
    margin: 0 0 8px;
    font-size: 20px;
  }
  
  p {
    color: #64748b;
    margin: 0;
    font-size: 15px;
  }
`;

export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const Modal = styled.div`
  background: white;
  border-radius: 24px;
  padding: 0;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: slideUp 0.3s ease;
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const ModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  padding: 24px 28px;
  color: white;
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    
    svg {
      font-size: 28px;
    }
  }
  
  .text {
    h3 {
      margin: 0 0 4px 0;
      font-size: 22px;
      font-weight: 700;
    }
    
    p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
  }
`;

export const ModalBody = styled.div`
  padding: 28px;
`;

export const DateTimePickerContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
`;

export const DateTimeRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  
  label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  input {
    padding: 14px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 15px;
    transition: all 0.2s;
    background: #f8fafc;
    
    &:focus {
      outline: none;
      border-color: #6366f1;
      background: white;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
    }
    
    &:hover:not(:focus) {
      border-color: #cbd5e1;
    }
  }
`;

export const QuickTimeSlots = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

export const QuickTimeSlot = styled.button`
  padding: 8px 14px;
  border: 2px solid ${props => props.$selected ? '#6366f1' : '#e2e8f0'};
  border-radius: 20px;
  background: ${props => props.$selected ? '#eef2ff' : 'white'};
  color: ${props => props.$selected ? '#6366f1' : '#64748b'};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #6366f1;
    background: #f8faff;
    color: #6366f1;
  }
`;

export const CurrentScheduleInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  
  svg {
    color: #d97706;
    font-size: 22px;
  }
  
  .info {
    .label {
      font-size: 12px;
      color: #92400e;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .value {
      font-size: 14px;
      color: #78350f;
      font-weight: 600;
    }
  }
`;

export const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  margin-top: 8px;
  padding-top: 20px;
`;

export const LoadingSpinner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  p {
    margin-top: 16px;
    color: #64748b;
    font-size: 15px;
  }
`;