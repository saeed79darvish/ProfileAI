import React, { useEffect, useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  EmojiEvents as TrophyIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  PersonAdd as InviteIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { Snackbar, Alert } from '@mui/material';
import { referralAPI } from '../../services/api';
import { pluralize } from '../../utils/pluralize';

/* ═══════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════ */

const overlayFade = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  0%   { opacity: 0; transform: scale(0.9) translateY(16px); }
  60%  { transform: scale(1.02) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
`;

const trophyPop = keyframes`
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(8deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
`;

const haloPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,196,77,0.4); }
  50%      { box-shadow: 0 0 0 20px rgba(245,196,77,0); }
`;

const confettiFall = keyframes`
  0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const ringGrow = keyframes`
  from { stroke-dashoffset: 339; }
`;

/* ═══════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════ */

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(102,126,234,0.22), transparent 60%),
    radial-gradient(900px 500px at 90% 110%, rgba(240,147,251,0.18), transparent 60%),
    #0b1020;
  animation: ${overlayFade} 0.4s ease;
`;

const ConfettiLayer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) { display: none; }
`;

const ConfettiPiece = styled.span`
  position: absolute;
  top: -10vh;
  left: ${p => p.$left}%;
  width: ${p => p.$size}px;
  height: ${p => p.$size * 0.4}px;
  background: ${p => p.$color};
  border-radius: 2px;
  opacity: 0;
  animation: ${confettiFall} ${p => p.$dur}s linear ${p => p.$delay}s forwards;
`;

const Card = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 560px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 26px;
  padding: 40px 36px 32px;
  text-align: center;
  backdrop-filter: blur(8px);
  box-shadow: 0 30px 90px rgba(0,0,0,0.5);
  animation: ${popIn} 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  color: #fff;

  @media (max-width: 560px) { padding: 32px 22px 26px; border-radius: 20px; }
`;

const Trophy = styled.div`
  width: 88px;
  height: 88px;
  margin: 0 auto 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${trophyPop} 0.7s cubic-bezier(0.16, 1, 0.3, 1) both, ${haloPulse} 2.4s ease-in-out infinite 0.7s;

  svg { font-size: 46px; color: #fff; }

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 0 0 8px;
  line-height: 1.15;

  @media (max-width: 560px) { font-size: 23px; }
`;

const Subtitle = styled.p`
  font-size: 15px;
  color: rgba(255,255,255,0.7);
  margin: 0 0 24px;
  line-height: 1.5;
`;

/* Strength ring */
const RingWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 22px;

  @media (max-width: 480px) { flex-direction: column; gap: 12px; }
`;

const Ring = styled.svg`
  width: 120px;
  height: 120px;
  transform: rotate(-90deg);
  flex-shrink: 0;

  .track { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 10; }
  .bar {
    fill: none;
    stroke: url(#celebGrad);
    stroke-width: 10;
    stroke-linecap: round;
    stroke-dasharray: 339;
    stroke-dashoffset: ${p => 339 - (339 * p.$pct) / 100};
    animation: ${ringGrow} 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: stroke-dashoffset 0.6s ease;
  }
`;

const RingCenter = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 120px;

  .pct { font-size: 30px; font-weight: 800; line-height: 1; }
  .lbl { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); margin-top: 3px; letter-spacing: 0.4px; }
`;

const RingBlock = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StrengthCopy = styled.div`
  text-align: left;
  max-width: 200px;

  .headline { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .sub { font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.45; }

  @media (max-width: 480px) { text-align: center; }
`;

/* Stats */
const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 24px;

  @media (max-width: 480px) { grid-template-columns: repeat(2, 1fr); }
`;

const Stat = styled.div`
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  padding: 12px 8px;
  animation: ${countUp} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: ${p => p.$delay || '0s'};

  .num {
    font-size: 22px;
    font-weight: 800;
    background: linear-gradient(90deg, #a5b4fc, #f0abfc);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .lbl { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6); margin-top: 4px; }

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

/* Share / link */
const SectionLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  margin: 4px 0 10px;
`;

const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 8px 8px 8px 14px;
  margin-bottom: 16px;
`;

const LinkText = styled.span`
  flex: 1;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const IconBtn = styled.button`
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 9px;
  font-family: inherit;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 12px;
  color: #fff;
  background: ${p => p.$bg || 'rgba(255,255,255,0.14)'};
  transition: transform 0.15s ease, filter 0.15s ease;

  svg { font-size: 17px; }

  &:hover { transform: translateY(-1px); filter: brightness(1.1); }
  &:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
`;

const ShareRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 26px;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PrimaryBtn = styled.button`
  width: 100%;
  border: none;
  cursor: pointer;
  padding: 14px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102,126,234,0.45); }
  &:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
  svg { font-size: 19px; }
`;

const GhostBtn = styled.button`
  width: 100%;
  border: 1px solid rgba(255,255,255,0.18);
  cursor: pointer;
  padding: 12px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  background: transparent;
  transition: background 0.15s ease;

  &:hover { background: rgba(255,255,255,0.06); }
  &:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
`;

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

const CONFETTI_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fbbf24', '#34d399', '#60a5fa'];

const buildConfetti = (n = 32) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    size: 7 + Math.round(Math.random() * 8),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dur: 2.4 + Math.random() * 1.8,
    delay: Math.random() * 0.6,
  }));

// Friendly framing for the strength score.
const strengthCopy = (pct) => {
  if (pct >= 80) return { headline: 'Top-tier profile 🏆', sub: 'Recruiters love complete profiles like yours.' };
  if (pct >= 50) return { headline: "You're off to a great start", sub: 'A few more details will put you ahead of the pack.' };
  return { headline: 'Profile created!', sub: 'Add a bit more to dramatically boost your visibility.' };
};

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

/**
 * Celebration + share screen shown after a candidate creates their FIRST
 * profile. Surfaces profile strength, what was captured, a public-profile link,
 * and one-tap invite/share actions (the referral lever) before sending the
 * user to their dashboard.
 *
 * Props:
 *  - firstName: string
 *  - completion: { pct, label }
 *  - counts: { skills, experience, education, projects }
 *  - publicProfileUrl: string
 *  - onContinue: () => void   (go to dashboard)
 *  - onViewProfile: () => void
 */
const ProfileCelebration = ({
  firstName,
  completion = { pct: 0, label: 'Beginner' },
  counts = {},
  publicProfileUrl = '',
  onContinue,
  onViewProfile,
}) => {
  const [referralLink, setReferralLink] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const confetti = useMemo(() => buildConfetti(), []);
  const copy = strengthCopy(completion.pct);

  useEffect(() => {
    let active = true;
    referralAPI.getMyCode()
      .then((res) => {
        if (!active) return;
        const code = res?.data?.code;
        const link = res?.data?.referralLink
          || (code ? `${window.location.origin}/register?ref=${code}` : `${window.location.origin}/register`);
        setReferralLink(link);
      })
      .catch(() => {
        if (active) setReferralLink(`${window.location.origin}/register`);
      });
    return () => { active = false; };
  }, []);

  const inviteLink = referralLink || `${window.location.origin}/register`;

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const handleCopyProfile = async () => {
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      notify('Profile link copied!');
    } catch { notify('Could not copy link', 'error'); }
  };

  const handleCopyInvite = async () => {
    const text = `🚀 Join me on ProfilleAI!\n\nAI-powered career growth:\n✨ Profile enhancement\n🎯 Smart job matching\n💼 Interview prep\n\nSign up free: ${inviteLink}`;
    try {
      await navigator.clipboard.writeText(text);
      notify('Invite copied — paste it anywhere!');
      referralAPI.share('direct').catch(() => {});
    } catch { notify('Could not copy invite', 'error'); }
  };

  const openShare = (platform) => {
    const msg = {
      twitter: `🚀 Just built my AI-powered profile on ProfilleAI — smart job matching, profile enhancement & interview prep. Join free 👇`,
      linkedin: `I just set up my profile on ProfilleAI — AI-enhanced profiles, smart job matching, and interview prep. Worth a look:`,
      whatsapp: `Hey! 👋 Check out ProfilleAI — AI builds your profile, matches you with jobs, and preps you for interviews. Join free: ${inviteLink}`,
    };
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg.twitter)}&url=${encodeURIComponent(inviteLink)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteLink)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(msg.whatsapp)}`,
      email: `mailto:?subject=${encodeURIComponent('You should try ProfilleAI')}&body=${encodeURIComponent(`I just built my AI profile on ProfilleAI. Sign up free: ${inviteLink}`)}`,
    };
    window.open(urls[platform], platform === 'email' ? '_self' : '_blank', 'width=600,height=500');
    referralAPI.share(platform).catch(() => {});
  };

  return (
    <Screen role="dialog" aria-modal="true" aria-label="Profile created">
      <ConfettiLayer aria-hidden="true">
        {confetti.map((c) => (
          <ConfettiPiece
            key={c.id}
            $left={c.left}
            $size={c.size}
            $color={c.color}
            $dur={c.dur}
            $delay={c.delay}
          />
        ))}
      </ConfettiLayer>

      <Card>
        <Trophy><TrophyIcon /></Trophy>

        <Title>
          {firstName ? `You're all set, ${firstName}! 🎉` : "You're all set! 🎉"}
        </Title>
        <Subtitle>Your profile is live. Here's how it looks to recruiters.</Subtitle>

        <RingWrap>
          <RingBlock>
            <Ring viewBox="0 0 120 120" $pct={completion.pct}>
              <defs>
                <linearGradient id="celebGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#f093fb" />
                </linearGradient>
              </defs>
              <circle className="track" cx="60" cy="60" r="54" />
              <circle className="bar" cx="60" cy="60" r="54" />
            </Ring>
            <RingCenter>
              <span className="pct">{completion.pct}%</span>
              <span className="lbl">{completion.label}</span>
            </RingCenter>
          </RingBlock>
          <StrengthCopy>
            <div className="headline">{copy.headline}</div>
            <div className="sub">{copy.sub}</div>
          </StrengthCopy>
        </RingWrap>

        <Stats>
          <Stat $delay="0s">
            <div className="num">{counts.skills || 0}</div>
            <div className="lbl">{pluralize(counts.skills || 0, 'Skill')}</div>
          </Stat>
          <Stat $delay="0.08s">
            <div className="num">{counts.experience || 0}</div>
            <div className="lbl">{pluralize(counts.experience || 0, 'Role')}</div>
          </Stat>
          {/* Education is a mass noun — same label for any count. Pass
              singular twice to opt out of "s" pluralisation explicitly. */}
          <Stat $delay="0.16s">
            <div className="num">{counts.education || 0}</div>
            <div className="lbl">{pluralize(counts.education || 0, 'Education', 'Education')}</div>
          </Stat>
          <Stat $delay="0.24s">
            <div className="num">{counts.projects || 0}</div>
            <div className="lbl">{pluralize(counts.projects || 0, 'Project')}</div>
          </Stat>
        </Stats>

        {publicProfileUrl && (
          <>
            <SectionLabel>Your public profile</SectionLabel>
            <LinkRow>
              <LinkText>{publicProfileUrl.replace(/^https?:\/\//, '')}</LinkText>
              <IconBtn onClick={handleCopyProfile}><CopyIcon /> Copy</IconBtn>
              <IconBtn $bg="rgba(102,126,234,0.4)" onClick={() => window.open(publicProfileUrl, '_blank')}>
                <OpenIcon />
              </IconBtn>
            </LinkRow>
          </>
        )}

        <SectionLabel>Love it? Invite a friend</SectionLabel>
        <ShareRow>
          <IconBtn $bg="linear-gradient(135deg,#667eea,#764ba2)" onClick={handleCopyInvite}>
            <InviteIcon /> Copy invite
          </IconBtn>
          <IconBtn $bg="#1da1f2" onClick={() => openShare('twitter')} aria-label="Share on X / Twitter"><TwitterIcon /></IconBtn>
          <IconBtn $bg="#0a66c2" onClick={() => openShare('linkedin')} aria-label="Share on LinkedIn"><LinkedInIcon /></IconBtn>
          <IconBtn $bg="#25d366" onClick={() => openShare('whatsapp')} aria-label="Share on WhatsApp"><WhatsAppIcon /></IconBtn>
          <IconBtn $bg="#ea4335" onClick={() => openShare('email')} aria-label="Share via email"><EmailIcon /></IconBtn>
        </ShareRow>

        <Actions>
          <PrimaryBtn onClick={onContinue}>
            Go to my dashboard <ArrowIcon />
          </PrimaryBtn>
          {publicProfileUrl && (
            <GhostBtn onClick={onViewProfile || (() => window.open(publicProfileUrl, '_blank'))}>
              View my public profile
            </GhostBtn>
          )}
        </Actions>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" icon={<CheckIcon fontSize="inherit" />}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Screen>
  );
};

export default ProfileCelebration;
