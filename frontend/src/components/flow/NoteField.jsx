import React, { useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { CircularProgress } from '@mui/material';
import { Mic as MicIcon, Stop as StopIcon } from '@mui/icons-material';
import { useDictation } from '@/pages/ProfileCoach/useDictation';
import { profileAPI } from '@/services/api';

/*
 * The "Anything else?" box in the step flows, with the onboarding coach's
 * dictation: tap the mic, speak, tap again. The words land in the box to be
 * read and edited; nothing is sent by speaking.
 */

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35); }
  100% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
`;

const Wrap = styled.div`
  position: relative;
  margin-top: 12px;

  input {
    width: 100%;
    box-sizing: border-box;
    height: 48px;
    padding: 0 52px 0 16px;
    border: 1.5px dashed #d9dbe5;
    border-radius: 14px;
    background: #f8f9fc;
    font: inherit;
    font-size: 16px;
    color: #13152a;
    outline: none;

    &:focus { border-color: #5b5fd6; border-style: solid; background: #fff; }
    &::placeholder { color: #9ca3af; }
  }

  button {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${p => (p.$listening ? '#dc2626' : '#eef0ff')};
    color: ${p => (p.$listening ? '#fff' : '#5b5fd6')};
    cursor: pointer;
    animation: ${p => (p.$listening ? pulse : 'none')} 1.2s ease-out infinite;

    svg { font-size: 20px; }
    &:disabled { cursor: default; }
  }
`;

export default function NoteField({ value, onChange, placeholder, label, hints = '', maxLength = 300 }) {
  const transcribe = useCallback((blob) => profileAPI.coachTranscribe(blob, hints), [hints]);
  const dictation = useDictation({ onText: (text) => onChange(text.slice(0, maxLength)), transcribe });

  return (
    <Wrap $listening={dictation.listening}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={dictation.listening ? 'Listening… tap the mic to stop' : placeholder}
        maxLength={maxLength}
        aria-label={label}
      />
      {dictation.supported && (
        <button
          type="button"
          onClick={() => dictation.toggle(value)}
          disabled={dictation.transcribing}
          aria-label={dictation.listening ? 'Stop dictation' : 'Dictate instead of typing'}
          aria-pressed={dictation.listening}
        >
          {dictation.transcribing
            ? <CircularProgress size={16} sx={{ color: '#5b5fd6' }} />
            : dictation.listening ? <StopIcon /> : <MicIcon />}
        </button>
      )}
    </Wrap>
  );
}
