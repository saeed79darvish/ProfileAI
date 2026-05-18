import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Warning, Info, CheckCircle, Close, Delete, Error as ErrorIcon } from '@mui/icons-material';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
  animation: ${fadeIn} 0.2s ease;
`;

const Modal = styled.div`
  background: white;
  border-radius: 24px;
  padding: 0;
  max-width: ${props => props.$size === 'small' ? '380px' : props.$size === 'large' ? '520px' : '420px'};
  width: 90%;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: ${slideUp} 0.3s ease;
`;

const ModalHeader = styled.div`
  padding: 24px 28px;
  color: white;
  
  ${props => {
    switch (props.$variant) {
      case 'danger':
        return `background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);`;
      case 'warning':
        return `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);`;
      case 'success':
        return `background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);`;
      case 'info':
      default:
        return `background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);`;
    }
  }}
  
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
      font-size: 20px;
      font-weight: 700;
    }
    
    p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
  }
`;

const ModalBody = styled.div`
  padding: 28px;
`;

const MessageBox = styled.div`
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  ${props => {
    switch (props.$variant) {
      case 'danger':
        return `
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          .icon { color: #dc2626; }
          .message { color: #991b1b; }
        `;
      case 'warning':
        return `
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          .icon { color: #d97706; }
          .message { color: #92400e; }
        `;
      case 'success':
        return `
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          .icon { color: #16a34a; }
          .message { color: #166534; }
        `;
      case 'info':
      default:
        return `
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          .icon { color: #6366f1; }
          .message { color: #3730a3; }
        `;
    }
  }}
  
  .icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  .message {
    font-size: 15px;
    line-height: 1.5;
  }
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  padding-top: 8px;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  
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
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  ` : props.$variant === 'warning' ? `
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    }
  ` : props.$variant === 'success' ? `
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
    }
  ` : `
    background: #f1f5f9;
    color: #475569;
    border: 2px solid #e2e8f0;
    
    &:hover {
      background: #e2e8f0;
      border-color: #cbd5e1;
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `}
`;

const getIcon = (variant, customIcon) => {
  if (customIcon) return customIcon;
  
  switch (variant) {
    case 'danger':
      return <Warning />;
    case 'warning':
      return <ErrorIcon />;
    case 'success':
      return <CheckCircle />;
    case 'info':
    default:
      return <Info />;
  }
};

/**
 * Reusable Confirm Modal Component
 * 
 * @param {Object} props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {function} props.onClose - Called when modal is closed/cancelled
 * @param {function} props.onConfirm - Called when confirm button is clicked
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message/description
 * @param {string} props.subtitle - Optional subtitle shown under title
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {string} props.variant - Modal variant: 'danger', 'warning', 'success', 'info' (default: 'info')
 * @param {string} props.size - Modal size: 'small', 'medium', 'large' (default: 'medium')
 * @param {boolean} props.loading - Whether confirm action is loading
 * @param {string} props.loadingText - Text shown when loading
 * @param {React.ReactNode} props.icon - Custom icon for header
 * @param {React.ReactNode} props.children - Optional additional content
 */
const ConfirmModal = ({
  show,
  onClose,
  onConfirm,
  title,
  message,
  subtitle,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  size = 'medium',
  loading = false,
  loadingText,
  icon,
  children
}) => {
  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <Modal $size={size} onClick={e => e.stopPropagation()}>
        <ModalHeader $variant={variant}>
          <div className="header-content">
            <div className="icon">
              {getIcon(variant, icon)}
            </div>
            <div className="text">
              <h3>{title}</h3>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
        </ModalHeader>
        
        <ModalBody>
          {message && (
            <MessageBox $variant={variant}>
              <div className="icon">
                <Warning />
              </div>
              <div className="message">{message}</div>
            </MessageBox>
          )}
          
          {children}
          
          <ModalActions>
            <Button
              $variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              $variant={variant === 'info' ? 'primary' : variant}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (loadingText || 'Processing...') : confirmText}
            </Button>
          </ModalActions>
        </ModalBody>
      </Modal>
    </ModalOverlay>
  );
};

export default ConfirmModal;
