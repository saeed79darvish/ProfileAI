export type MicProblem = 'denied' | 'missing' | 'unsupported' | 'other';

/** Turns a getUserMedia / MediaRecorder failure into one of four plain cases. */
export function classifyMicError(err: unknown): MicProblem {
  const name = (err as { name?: string } | null)?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotSupportedError' || name === 'TypeError') return 'unsupported';
  return 'other';
}

export function micProblemMessage(p: MicProblem): string {
  switch (p) {
    case 'denied': return 'Chrome did not let this panel use your microphone.';
    case 'missing': return 'No microphone was found on this computer.';
    case 'unsupported': return 'This browser cannot record audio here.';
    default: return 'The recording did not start.';
  }
}

export const MAX_RECORD_SECONDS = 60;

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
