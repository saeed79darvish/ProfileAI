import { useParams, useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Breadcrumbs, Typography, CircularProgress, Snackbar, Alert as MuiAlert } from '@mui/material';
import { COLORS, GRADIENTS, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT, TRANSITIONS } from '@/designTokens';

export const PageContainer = styled.div`
  min-height: 100vh;
  background: ${COLORS.BG_LIGHT};
  padding: 80px 24px 40px;
`;

export const Content = styled.main`
  max-width: 800px;
  margin: 0 auto;
`;

export const Header = styled.div`
  margin-bottom: 32px;
`;

export const BreadcrumbsWrapper = styled.div`
  margin-bottom: 24px;
  
  .MuiBreadcrumbs-root {
    color: ${COLORS.TEXT_SECONDARY};
  }
  
  .MuiBreadcrumbs-separator {
    color: ${COLORS.TEXT_MUTED};
  }
`;

export const BreadcrumbLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${COLORS.PRIMARY};
  text-decoration: none;
  font-size: ${FONT_SIZE.BASE};
  padding: 4px 8px;
  border-radius: 6px;
  transition: ${TRANSITIONS.FAST};
  
  &:hover {
    background: rgba(102, 126, 234, 0.1);
    color: ${COLORS.PRIMARY};
  }
  
  svg {
    font-size: 18px;
  }
`;

export const BreadcrumbCurrent = styled(Typography)`
  && {
    color: ${COLORS.TEXT_PRIMARY};
    font-size: ${FONT_SIZE.BASE};
    font-weight: ${FONT_WEIGHT.MEDIUM};
  }
`;

export const Title = styled.h1`
  font-size: ${FONT_SIZE.XXXL};
  font-weight: ${FONT_WEIGHT.BOLD};
  color: ${COLORS.TEXT_PRIMARY};
  margin: 0 0 8px;
`;

export const Subtitle = styled.p`
  font-size: ${FONT_SIZE.LG};
  color: ${COLORS.TEXT_SECONDARY};
  margin: 0;
`;

export const Card = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: ${RADIUS.XXL};
  box-shadow: ${SHADOWS.ELEVATED};
  padding: 32px;
  margin-bottom: 24px;
`;

export const JobInfo = styled.div`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: ${RADIUS.LARGE};
  padding: 20px;
  margin-bottom: 32px;
  
  h3 {
    font-size: ${FONT_SIZE.XL};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 8px;
  }
  
  p {
    font-size: ${FONT_SIZE.BASE};
    color: ${COLORS.TEXT_SECONDARY};
    margin: 4px 0;
  }
`;

export const FormSection = styled.div`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const Label = styled.label`
  display: block;
  font-size: ${FONT_SIZE.BASE};
  font-weight: ${FONT_WEIGHT.SEMIBOLD};
  color: ${COLORS.TEXT_PRIMARY};
  margin-bottom: 8px;
`;

export const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.SMALL};
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  transition: ${TRANSITIONS.FAST};
  
  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const Textarea = styled.textarea`
  width: 100%;
  min-height: 150px;
  padding: 12px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.SMALL};
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  font-family: inherit;
  resize: vertical;
  transition: ${TRANSITIONS.FAST};
  
  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const FileUploadArea = styled.div`
  border: 2px dashed ${COLORS.BORDER_DEFAULT};
  border-radius: ${RADIUS.LARGE};
  padding: 32px;
  text-align: center;
  transition: ${TRANSITIONS.FAST};
  cursor: pointer;
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    background: rgba(102, 126, 234, 0.02);
  }
  
  input {
    display: none;
  }
`;

export const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: ${COLORS.BG_LIGHT};
  border-radius: ${RADIUS.SMALL};
  margin-top: 12px;
  
  svg {
    color: ${COLORS.PRIMARY};
    font-size: 24px;
  }
  
  .file-details {
    flex: 1;
    text-align: left;
  }
  
  .file-name {
    font-size: ${FONT_SIZE.BASE};
    font-weight: ${FONT_WEIGHT.MEDIUM};
    color: ${COLORS.TEXT_PRIMARY};
  }
  
  .file-size {
    font-size: ${FONT_SIZE.SM};
    color: ${COLORS.TEXT_SECONDARY};
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
`;

export const Button = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    border: none;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  ` : `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_SECONDARY};
    border: 1px solid ${COLORS.BORDER_LIGHT};
    
    &:hover {
      border-color: ${COLORS.PRIMARY};
      color: ${COLORS.PRIMARY};
    }
  `}
`;

// Additional styled components for dynamic form elements
export const Select = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.SMALL};
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  background: ${COLORS.BG_WHITE};
  cursor: pointer;
  transition: ${TRANSITIONS.FAST};
  
  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

export const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;
  padding: 12px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.SMALL};
  transition: ${TRANSITIONS.FAST};
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    background: rgba(102, 126, 234, 0.02);
  }
  
  input {
    accent-color: ${COLORS.PRIMARY};
    width: 18px;
    height: 18px;
  }
`;

export const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: ${COLORS.TEXT_PRIMARY};
  cursor: pointer;
  padding: 12px 16px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.SMALL};
  transition: ${TRANSITIONS.FAST};
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    background: rgba(102, 126, 234, 0.02);
  }
  
  input {
    accent-color: ${COLORS.PRIMARY};
    width: 18px;
    height: 18px;
  }
`;

export const SectionDivider = styled.div`
  display: flex;
  align-items: center;
  margin: 32px 0;
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${COLORS.BORDER_LIGHT};
  }
  
  span {
    padding: 0 16px;
    font-size: ${FONT_SIZE.BASE};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_SECONDARY};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

export const QuestionDescription = styled.p`
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_SECONDARY};
  margin: 4px 0 12px;
  font-style: italic;
`;

export const SuccessMessage = styled.div`
  text-align: center;
  padding: 40px;
  
  svg {
    font-size: 64px;
    color: ${COLORS.SUCCESS};
    margin-bottom: 16px;
  }
  
  h2 {
    font-size: ${FONT_SIZE.XXL};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    color: ${COLORS.TEXT_PRIMARY};
    margin: 0 0 12px;
  }
  
  p {
    font-size: 15px;
    color: ${COLORS.TEXT_SECONDARY};
    margin: 0 0 24px;
  }
`;

// Resume Parse Modal Components
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

export const ModalContent = styled.div`
  background: ${COLORS.BG_WHITE};
  border-radius: ${RADIUS.XXL};
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
`;

export const ModalHeader = styled.div`
  padding: 24px;
  background: ${GRADIENTS.PRIMARY};
  color: ${COLORS.TEXT_WHITE};
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }
`;

export const ModalCloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: ${COLORS.TEXT_WHITE};
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

export const ModalBody = styled.div`
  padding: 24px;
  
  p {
    color: ${COLORS.TEXT_SECONDARY};
    margin: 0 0 20px;
    font-size: 15px;
    line-height: 1.6;
  }
`;

export const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px 24px 24px;
`;

export const ParseButton = styled.button`
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  
  ${props => props.$primary ? `
    background: ${GRADIENTS.PRIMARY};
    color: ${COLORS.TEXT_WHITE};
    border: none;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: ${SHADOWS.PRIMARY_GLOW_STRONG};
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  ` : `
    background: ${COLORS.BG_WHITE};
    color: ${COLORS.TEXT_SECONDARY};
    border: 1px solid ${COLORS.BORDER_LIGHT};
    
    &:hover {
      border-color: ${COLORS.PRIMARY};
      color: ${COLORS.PRIMARY};
    }
  `}
`;

export const ParsingIndicator = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  
  p {
    margin-top: 16px;
    color: ${COLORS.PRIMARY};
    font-weight: ${FONT_WEIGHT.MEDIUM};
  }
`;

// Experience & Education List Components
export const ListSection = styled.div`
  margin-top: 12px;
`;

export const ListItem = styled.div`
  background: ${COLORS.BG_LIGHT};
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: ${RADIUS.LARGE};
  padding: 16px;
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const ListItemHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  
  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    color: ${COLORS.PRIMARY};
    font-weight: ${FONT_WEIGHT.SEMIBOLD};
    
    svg {
      font-size: 18px;
    }
  }
`;

export const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${COLORS.ERROR};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }
`;

export const ListItemFields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

export const SmallInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: 6px;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  
  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
  }
`;

export const SmallLabel = styled.label`
  display: block;
  font-size: ${FONT_SIZE.SM};
  color: ${COLORS.TEXT_SECONDARY};
  margin-bottom: 4px;
`;

export const FieldGroup = styled.div`
  ${props => props.$fullWidth && `
    grid-column: span 2;
    
    @media (max-width: 600px) {
      grid-column: span 1;
    }
  `}
`;

export const AddItemButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: ${COLORS.BG_WHITE};
  border: 2px dashed ${COLORS.BORDER_DEFAULT};
  border-radius: ${RADIUS.MEDIUM};
  color: ${COLORS.TEXT_SECONDARY};
  font-size: ${FONT_SIZE.BASE};
  cursor: pointer;
  transition: ${TRANSITIONS.FAST};
  margin-top: 12px;
  
  &:hover {
    border-color: ${COLORS.PRIMARY};
    color: ${COLORS.PRIMARY};
    background: rgba(102, 126, 234, 0.02);
  }
`;

export const SmallTextarea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${COLORS.BORDER_LIGHT};
  border-radius: 6px;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_PRIMARY};
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
  
  &:focus {
    outline: none;
    border-color: ${COLORS.PRIMARY};
  }
`;

export const CheckboxWrapper = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${FONT_SIZE.MD};
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  
  input {
    accent-color: ${COLORS.PRIMARY};
  }
`;
