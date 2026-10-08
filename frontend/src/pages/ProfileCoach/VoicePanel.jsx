import React from 'react';
import {
  Close as CloseIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
} from '@mui/icons-material';

import { TEXT } from './constants';
import { VOICE_STATES } from './useVoiceCall';
import {
  VoiceVeil, VoiceWho, VoiceStage, Orb, VoiceStatus, VoiceCaption, VoiceActions,
  EndCall, VoiceQuiet, MuteButton,
} from './styled';

/**
 * Voice mode.
 *
 * Takes the whole screen on purpose. While someone is talking there is
 * nothing to read and nothing to tap, and a microphone button tucked into a
 * chat composer makes a phone call look like a form field. One soft thing
 * moving, and a way out.
 *
 * Laid out for a phone held in one hand: the orb sits where the eye rests and
 * every control is in the bottom band where the thumb already is. The three
 * of them — keep typing, mute, leave — are the only decisions available
 * mid-call, so they are the only things on screen.
 *
 * The caption is the part that earns its place: speech recognition mangles
 * company names constantly, and seeing "Equinix" come back as "Equinox"
 * while you are still in the call is the difference between fixing it in
 * three words and finding it on your profile a week later.
 */
const VoicePanel = ({ state, speaking, level = 0, muted, onToggleMute, lastLine, onEnd }) => {
  const connecting = state === VOICE_STATES.connecting;

  const status = connecting
    ? TEXT.VOICE_CONNECTING
    : muted
      ? TEXT.VOICE_MUTED
      : speaking
        ? `${TEXT.COACH_NAME} is speaking`
        : TEXT.VOICE_LIVE;

  return (
    <VoiceVeil role="dialog" aria-modal="true" aria-label={`Talking to ${TEXT.COACH_NAME}`}>
      <VoiceWho>
        <h2>{TEXT.COACH_NAME}</h2>
        <p>Your career coach</p>
      </VoiceWho>

      <VoiceStage>
        {/* The live volume drives the orb through a CSS variable rather than
            React state in the style of every frame — one custom property set,
            the compositor does the rest. */}
        <Orb style={{ '--level': speaking ? level : 0 }} aria-hidden="true" />

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
      </VoiceStage>

      <VoiceActions>
        {/* Shaped like the composer it returns you to. Ending the call and
            going back to typing are the same action here, because the call
            has already handed everything it heard to the draft. */}
        <VoiceQuiet type="button" onClick={onEnd}>
          {TEXT.VOICE_KEEP_TYPING}
        </VoiceQuiet>
        <MuteButton
          type="button"
          $on={muted}
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? TEXT.VOICE_UNMUTE : TEXT.VOICE_MUTE}
          title={muted ? TEXT.VOICE_UNMUTE : TEXT.VOICE_MUTE}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </MuteButton>
        <EndCall type="button" onClick={onEnd} aria-label={TEXT.VOICE_END} title={TEXT.VOICE_END}>
          <CloseIcon />
        </EndCall>
      </VoiceActions>
    </VoiceVeil>
  );
};

export default VoicePanel;
