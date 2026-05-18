import React, { createContext, useContext, useState, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';

const ToastContext = createContext();

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
`;

const TOAST_CONFIG = {
  success: { icon: CheckCircleIcon, bg: '#ecfdf5', border: '#6ee7b7', color: '#065f46', iconColor: '#10b981' },
  error: { icon: ErrorIcon, bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', iconColor: '#ef4444' },
  warning: { icon: WarningIcon, bg: '#fffbeb', border: '#fcd34d', color: '#92400e', iconColor: '#f59e0b' },
  info: { icon: InfoIcon, bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', iconColor: '#3b82f6' },
};

const Container = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
`;

const ToastItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  min-width: 300px;
  max-width: 440px;
  border-radius: 12px;
  background: ${p => TOAST_CONFIG[p.$type]?.bg || TOAST_CONFIG.info.bg};
  border: 1px solid ${p => TOAST_CONFIG[p.$type]?.border || TOAST_CONFIG.info.border};
  color: ${p => TOAST_CONFIG[p.$type]?.color || TOAST_CONFIG.info.color};
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: auto;
  animation: ${p => p.$exiting
    ? css`${slideOut} 0.3s ease forwards`
    : css`${slideIn} 0.3s ease`};
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;

  .toast-icon { flex-shrink: 0; }
  .toast-msg { flex: 1; }
  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    color: inherit;
    opacity: 0.6;
    display: flex;
    &:hover { opacity: 1; }
  }
`;

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, duration) => showToast(msg, 'success', duration),
    error: (msg, duration) => showToast(msg, 'error', duration ?? 6000),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Container>
        {toasts.map(t => {
          const cfg = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <ToastItem key={t.id} $type={t.type} $exiting={t.exiting}>
              <Icon className="toast-icon" sx={{ fontSize: 20, color: cfg.iconColor }} />
              <span className="toast-msg">{t.message}</span>
              <button type="button" className="toast-close" onClick={() => removeToast(t.id)}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            </ToastItem>
          );
        })}
      </Container>
    </ToastContext.Provider>
  );
}

export default ToastContext;
