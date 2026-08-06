import React from 'react';
import ProgressModal from './ProgressModal';

/**
 * Thin wrapper kept so existing call sites keep their prop shape. The dark
 * purple treatment this used to render was replaced by the shared stepped
 * design in ProgressModal. Prefer importing ProgressModal directly in new code.
 *
 * `phase` is intentionally dropped: it duplicated a single hardcoded string
 * where the shared modal now shows the real step the flow is on.
 */
export default function AIProcessingModal({
  open,
  onClose,
  onCancel,
  title,
  subtitle,
  progress = 0,
  stats = null,
  type = 'enhance',
}) {
  return (
    <ProgressModal
      open={open}
      type={type}
      title={title}
      subtitle={subtitle}
      // Only hand over the bar when the caller actually drives it; passing 0
      // would pin the progress bar at zero for the whole run.
      progress={progress > 0 ? progress : undefined}
      stats={stats}
      onCancel={onCancel}
      onClose={onClose}
    />
  );
}
