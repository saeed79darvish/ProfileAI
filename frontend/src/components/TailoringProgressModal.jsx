import React from 'react';
import ProgressModal from './ProgressModal';

/**
 * Thin wrapper kept so existing tailoring call sites keep their prop shape.
 * The design now lives in ProgressModal, which every long-running flow shares.
 * Prefer importing ProgressModal directly in new code.
 */
export default function TailoringProgressModal({
  open,
  onMinimize,
  onViewResult,
  jobTitle,
  company,
  startFromStep = 0,
  maxStep,
  completed = false,
}) {
  const context = (jobTitle || company)
    ? <>{jobTitle}{company ? <> at <strong>{company}</strong></> : ''}</>
    : null;

  return (
    <ProgressModal
      open={open}
      variant="tailor"
      context={context}
      startFromStep={startFromStep}
      maxStep={maxStep}
      completed={completed}
      onViewResult={onViewResult || onMinimize}
      viewResultLabel="View Tailored Resume"
    />
  );
}
