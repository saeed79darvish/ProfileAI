import React from 'react';
import {
  AttachFile as AttachIcon,
  Close as CloseIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
} from '@mui/icons-material';

import { TEXT } from './constants';
import { VOICE_STATES } from './useVoiceCall';
import VoicePrint from './VoicePrint';
import {
  VoiceVeil, VoiceWho, VoiceStage, VoiceMark, VoiceStatus, VoiceCaption, VoiceActions,
  EndCall, VoiceQuiet, MuteButton, ShareButton,
} from './styled';

// What can be shown mid-call: pictures are seen, documents are read.
const SHARE_ACCEPT = 'image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Voice mode.
 *
 * Takes the whole screen on purpose. While someone is talking there is
 * nothing to read and nothing to tap, and a microphone button tucked into a
 * chat composer makes a phone call look like a form field. One soft thing
 * moving, and a way out.
 *
 * Laid out for a phone held in one hand: the voiceprint sits where the eye rests and
 * every control is in the bottom band where the thumb already is. The three
 * of them — keep typing, mute, leave — are the only decisions available
 * mid-call, so they are the only things on screen.
 *
 * The caption is the part that earns its place: speech recognition mangles
 * company names constantly, and seeing "Equinix" come back as "Equinox"
 * while you are still in the call is the difference between fixing it in
 * three words and finding it on your profile a week later.
 */
const VoicePanel = ({ state, speaking, level = 0, muted, onToggleMute, lastLine, onEnd, hint, onShare, sharing = false, note = '' }) => {
  const connecting = state === VOICE_STATES.connecting;
  const fileRef = React.useRef(null);

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
        {/* Remi's voiceprint: the ring follows Remi's real output level while
            speaking, and shows connecting, listening and muted on its own. */}
        <VoiceMark>
          <VoicePrint
            mode={connecting ? 'connecting' : muted ? 'muted' : speaking ? 'speaking' : 'listening'}
            level={speaking ? level : 0}
          />
        </VoiceMark>

        {/* Announced politely: a screen reader should hear the state change
            without the caption re-reading itself on every partial. */}
        <VoiceStatus aria-live="polite">{status}</VoiceStatus>

        <VoiceCaption $dim={!lastLine || sharing || !!note}>
          {sharing || note ? (sharing ? TEXT.VOICE_SHARING : note) : lastLine ? (
            <>
              <span>{lastLine.role === 'coach' ? TEXT.COACH_NAME : 'You'}</span>
              {lastLine.text}
            </>
          ) : (
            connecting ? '' : hint
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
        {/* "I can upload it" used to lead nowhere: there was no way to show
            Remi anything without hanging up. A photo is seen as it is; a
            PDF or Word file is read. */}
        {onShare && (
          <>
            <ShareButton
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={connecting || sharing}
              aria-label={TEXT.VOICE_SHARE}
              title={TEXT.VOICE_SHARE}
            >
              <AttachIcon />
            </ShareButton>
            <input
              ref={fileRef}
              type="file"
              accept={SHARE_ACCEPT}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onShare(file);
              }}
            />
          </>
        )}
        <EndCall type="button" onClick={onEnd} aria-label={TEXT.VOICE_END} title={TEXT.VOICE_END}>
          <CloseIcon />
        </EndCall>
      </VoiceActions>
    </VoiceVeil>
  );
};

export default VoicePanel;
