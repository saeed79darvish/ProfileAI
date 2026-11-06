import React, { useCallback, useState } from 'react';
import { Box, Button, CircularProgress, Collapse, Typography } from '@mui/material';
import { Mic as MicIcon, Stop as StopIcon, EditNote as EditNoteIcon } from '@mui/icons-material';
import { useDictation } from '@/pages/ProfileCoach/useDictation';
import NoteField from '@/components/flow/NoteField';
import { profileAPI } from '@/services/api';

/*
 * Under a description box: dictate into it, and (when AI is on) tell the AI
 * what to change in a few words, typed or spoken, before pressing Enhance.
 *
 * Dictation here is the same engine as the coach and the tailoring flow: a live
 * browser preview, then a real speech model for the final text, appended to
 * what is already in the box. The instruction is sent with the Enhance request
 * ("add that I led a team of 5"), so the rewrite applies it to the text.
 */
export default function DescriptionAssist({
  value,
  onChange,
  maxLength,
  hints = '',
  label = 'description',
  showInstruction = true,
  instruction,
  onInstructionChange,
  onError,
}) {
  const [open, setOpen] = useState(false);
  const transcribe = useCallback((blob) => profileAPI.coachTranscribe(blob, hints), [hints]);
  const dictation = useDictation({
    onText: (text) => onChange(maxLength ? text.slice(0, maxLength) : text),
    transcribe,
    onError: (code) => onError?.(
      code === 'not-allowed'
        ? 'Microphone access is blocked. Allow it in your browser, or type instead.'
        : 'Could not hear that. Try again, or type instead.',
    ),
  });

  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {dictation.supported && (
          <Button
            type="button"
            size="small"
            onClick={() => dictation.toggle(value || '')}
            disabled={dictation.transcribing}
            aria-pressed={dictation.listening}
            aria-label={dictation.listening ? `Stop dictating the ${label}` : `Dictate the ${label}`}
            startIcon={dictation.transcribing
              ? <CircularProgress size={14} sx={{ color: '#4f46e5' }} />
              : dictation.listening ? <StopIcon sx={{ fontSize: 16 }} /> : <MicIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 12.5,
              borderRadius: 1.5,
              color: dictation.listening ? '#fff' : '#4f46e5',
              background: dictation.listening ? '#dc2626' : 'rgba(79,70,229,0.08)',
              '&:hover': { background: dictation.listening ? '#b91c1c' : 'rgba(79,70,229,0.16)' },
            }}
          >
            {dictation.transcribing ? 'Transcribing...' : dictation.listening ? 'Stop' : 'Dictate'}
          </Button>
        )}
        {showInstruction && (
          <Button
            type="button"
            size="small"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            startIcon={<EditNoteIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12.5, color: '#4f46e5' }}
          >
            {open ? 'Hide instruction' : 'Tell AI what to change'}
          </Button>
        )}
        {dictation.listening && (
          <Typography variant="caption" role="status" sx={{ color: '#dc2626', fontWeight: 600 }}>
            Listening. Tap Stop when you are done.
          </Typography>
        )}
      </Box>
      {showInstruction && (
        <Collapse in={open} unmountOnExit>
          <NoteField
            value={instruction || ''}
            onChange={onInstructionChange}
            placeholder="e.g. add that I led a team of 5"
            label={`Instruction for the AI rewrite of the ${label}`}
            hints={hints}
            maxLength={300}
          />
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 0.5 }}>
            The AI applies this when you press Enhance with AI. Say it or type it.
          </Typography>
        </Collapse>
      )}
    </Box>
  );
}
