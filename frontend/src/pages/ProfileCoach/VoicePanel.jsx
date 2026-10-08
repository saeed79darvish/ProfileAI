import React from 'react';
import { CallEnd as EndIcon } from '@mui/icons-material';

import { TEXT } from './constants';
import { VOICE_STATES } from './useVoiceCall';
import {
  VoiceVeil, VoiceWho, Orb, VoiceStatus, VoiceCaption, VoiceActions, EndCall, VoiceQuiet,
} from './styled';

/**
 * Voice mode.
 *
 * Takes the whole screen on purpose. While someone is talking there is
 * nothing to read and nothing to tap, and a microphone button tucked into a
 * chat composer makes a phone call look like a form field. One lit thing,
 * plainly alive, and a way out.
 *
 * The caption is the part that earns its place: speech recognition mangles
 * company names constantly, and seeing "Equinix" come back as "Equinox"
 * while you are still in the call is the difference between fixing it in
 * three words and finding it on your profile a week later.
 */
const VoicePanel = ({ state, speaking, lastLine, onEnd }) => {
  const connecting = state === VOICE_STATES.connecting;

  const status = connecting
    ? TEXT.VOICE_CONNECTING
    : speaking
      ? `${TEXT.COACH_NAME} is speaking`
      : TEXT.VOICE_LIVE;

  return (
    <VoiceVeil role="dialog" aria-modal="true" aria-label={`Talking to ${TEXT.COACH_NAME}`}>
      <VoiceWho>
        <h2>{TEXT.COACH_NAME}</h2>
        <p>Your career coach</p>
      </VoiceWho>

      <Orb $speaking={speaking} aria-hidden="true" />

      {/* Announced politely: a screen reader should hear the state change
          without the caption re-reading itself on every partial. */}
      <VoiceStatus aria-live="polite">{status}</VoiceStatus>

      <VoiceCaption $dim={!lastLine}>
        {lastLine ? (
          <>
            <span>{lastLine.role === 'coach' ? TEXT.COACH_NAME : 'You'}</span>
            {lastLine.text}
          </>
        ) : (
          connecting ? '' : 'Say anything — what you do, where, how long.'
        )}
      </VoiceCaption>

      <VoiceActions>
        <EndCall type="button" onClick={onEnd}>
          <EndIcon /> {TEXT.VOICE_END}
        </EndCall>
      </VoiceActions>

      <VoiceQuiet type="button" onClick={onEnd}>
        {TEXT.VOICE_KEEP_TYPING}
      </VoiceQuiet>
    </VoiceVeil>
  );
};

export default VoicePanel;
