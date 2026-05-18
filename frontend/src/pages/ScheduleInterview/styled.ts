import styled from 'styled-components';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CircularProgress, Tooltip, Switch, Breadcrumbs, Typography } from '@mui/material';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

export const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

export const BreadcrumbsWrapper = styled.div`
  margin-bottom: 24px;
  
  .MuiBreadcrumbs-root {
    color: #64748b;
  }
  
  .MuiBreadcrumbs-separator {
    color: #94a3b8;
  }
`;

export const BreadcrumbLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255,255,255,0.15);
    color: white;
  }
  
  svg {
    font-size: 18px;
  }
`;

export const BreadcrumbCurrent = styled(Typography)`
  && {
    color: white;
    font-size: 14px;
    font-weight: 500;
  }
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

export const HeroInner = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative;
  z-index: 1;
`;

export const Card = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 24px;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  
  h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
  
  svg {
    color: #7c3aed;
  }
`;

export const CandidateInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  
  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    object-fit: cover;
    background: #e2e8f0;
  }
  
  .details {
    flex: 1;
    
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 4px 0;
    }
    
    p {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
  }
`;

export const JobInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  
  .icon {
    width: 48px;
    height: 48px;
    background: #ede9fe;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      color: #7c3aed;
    }
  }
  
  .details {
    flex: 1;
    
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 4px 0;
    }
    
    p {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
  }
`;

export const FormSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
`;

export const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

export const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

export const TextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #1e293b;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

export const FormatOptions = styled.div`
  display: flex;
  gap: 12px;
`;

export const FormatOption = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: ${props => props.$selected ? '#ede9fe' : '#f8fafc'};
  border: 2px solid ${props => props.$selected ? '#7c3aed' : 'transparent'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  svg {
    color: ${props => props.$selected ? '#7c3aed' : '#64748b'};
    font-size: 28px;
  }
  
  span {
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.$selected ? '#7c3aed' : '#64748b'};
  }
  
  &:hover {
    background: ${props => props.$selected ? '#ede9fe' : '#f1f5f9'};
  }
`;

export const TimeSlots = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const TimeSlot = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .slot-inputs {
    flex: 1;
    display: flex;
    gap: 12px;
  }
`;

export const AddSlotButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border: 2px dashed #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #7c3aed;
    color: #7c3aed;
  }
`;

export const RemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #fee2e2;
  border: none;
  border-radius: 8px;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #fecaca;
  }
`;

export const PhoneScreeningSection = styled.div`
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
`;

export const PhoneScreeningHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

export const PhoneScreeningTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  
  .badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
`;

export const PhoneScreeningDescription = styled.p`
  font-size: 14px;
  opacity: 0.9;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

export const PhoneScreeningOptions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

export const DurationOption = styled.button`
  flex: 1;
  padding: 12px;
  background: ${props => props.$selected ? 'white' : 'rgba(255, 255, 255, 0.1)'};
  border: 2px solid ${props => props.$selected ? 'white' : 'transparent'};
  border-radius: 8px;
  color: ${props => props.$selected ? '#7c3aed' : 'white'};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$selected ? 'white' : 'rgba(255, 255, 255, 0.2)'};
  }
`;

export const PhoneWarning = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
  
  svg {
    font-size: 18px;
    margin-top: 2px;
  }
  
  p {
    font-size: 13px;
    margin: 0;
    opacity: 0.9;
  }
`;

export const SubmitButton = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  
  p {
    margin-top: 16px;
    color: #64748b;
  }
`;

export const ErrorMessage = styled.div`
  background: #fee2e2;
  color: #dc2626;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
`;
