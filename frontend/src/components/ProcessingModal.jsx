import React from 'react';
import ProgressModal from './ProgressModal';

/**
 * Thin wrapper kept so existing call sites keep their prop shape.
 *
 * This component previously rendered two entirely different designs depending
 * on `type` — a stepped light card for enhance/tips and a gradient-purple card
 * for everything else. Both are gone; all flows now share ProgressModal.
 * Prefer importing ProgressModal directly in new code.
 */
export default function ProcessingModal({
  open,
  type = 'ai',
  title,
  subtitle,
  progress = 0,
  showProgress = true,
}) {
  return (
    <ProgressModal
      open={open}
      type={type}
      title={title}
      subtitle={subtitle}
      progress={showProgress && progress > 0 ? progress : undefined}
    />
  );
}
