import React from 'react';
import styled from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import CloseIcon from '@mui/icons-material/Close';
import BrandIcon from './BrandIcon';
import { GoogleLogo } from './GoogleAuthButton';

/**
 * Consent step shown when a user starts an OAuth signup.
 *
 * The email form collects consent with an inline checkbox, but the OAuth
 * buttons hand off to a provider immediately, so consent has to be captured in
 * front of that handoff. Accepting here both records the consent sent to the
 * register endpoint and continues straight into the provider flow.
 *
 * The dialog doubles as the hand-off explainer: it names what leaves the
 * provider, what we never touch, and lets the user switch providers without
 * closing and re-picking. `onAccept` receives the provider that was chosen —
 * the secondary button passes the *other* one — so the caller can keep the
 * click inside the browser's user-gesture window and avoid a blocked popup.
 */

const PROVIDERS = {
  linkedin: {
    name: 'LinkedIn',
    receives: [
      'Your name and profile photo',
      'Your email address',
      'Your headline and current role',
    ],
    assurance: 'We never post to LinkedIn or message your connections.',
  },
  google: {
    name: 'Google',
    receives: [
      'Your name and profile photo',
      'Your email address',
    ],
    assurance: 'We never read your Gmail, Drive or contacts.',
  },
};

const OTHER_PROVIDER = { linkedin: 'google', google: 'linkedin' };

const Wrap = styled.div`
  position: relative;
  padding: 34px 30px 30px;
  background: #fff;
  text-align: center;
`;

const Close = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: none;
  color: #9aa0ac;
  cursor: pointer;

  &:hover { background: #f3f4f8; color: #0f1020; }
`;

const Marks = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const BrandTile = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #6d5ae6, #4c3bc7);
`;

const ProviderTile = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: #fff;
  border: 1px solid #e7e9f0;
  box-shadow: 0 1px 3px rgba(15, 16, 32, 0.06);
`;

const Dots = styled.div`
  display: flex;
  gap: 4px;

  span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #c9cce0;
  }
`;

const LinkedInTile = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #0a66c2;
`;

const Title = styled.h3`
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: #0f1020;
`;

const Copy = styled.p`
  margin: 0 auto 22px;
  max-width: 340px;
  font-size: 15px;
  line-height: 1.5;
  color: #5b6270;
`;

const Panel = styled.div`
  padding: 16px 18px;
  border-radius: 14px;
  background: #f8f9fc;
  border: 1px solid #eceef4;
  text-align: left;
  margin-bottom: 12px;
`;

const PanelLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 12px;
`;

const Receives = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 9px;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14.5px;
    color: #2b2f3a;
  }
`;

const Assurance = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f0fbf4;
  border: 1px solid #d8f0e2;
  text-align: left;
  font-size: 14px;
  line-height: 1.45;
  color: #1f5c3d;
  margin-bottom: 18px;
`;

const Legal = styled.p`
  margin: 0 auto 18px;
  max-width: 350px;
  font-size: 13px;
  line-height: 1.5;
  color: #6b7280;

  a {
    color: #5b4fe0;
    font-weight: 700;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

const Action = styled.button`
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 15.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  /* LinkedIn is the only provider with a filled treatment — Google's brand
     guidelines require the "G" to sit on white. */
  ${({ $filled }) => ($filled ? `
    border: none;
    background: #0a66c2;
    color: #fff;
    &:hover { background: #004182; }
  ` : `
    border: 1px solid #e2e5ec;
    background: #fff;
    color: #0f1020;
    &:hover { background: #f8f9fc; border-color: #d5d9e2; }
  `)}

  & + & { margin-top: 10px; }
`;

const CheckMark = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
    <path
      d="M3 8.4l3.2 3.2L13 4.8"
      stroke="#1a9f5f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldMark = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
    <path
      d="M10 2l6 2.2v4.9c0 3.7-2.5 7-6 8.1-3.5-1.1-6-4.4-6-8.1V4.2L10 2z"
      stroke="#2f8f63"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const ProviderMark = ({ provider }) => (
  provider === 'linkedin'
    ? <LinkedInTile><LinkedInIcon sx={{ fontSize: 26, color: '#fff' }} /></LinkedInTile>
    : <GoogleLogo width="30" height="30" />
);

// Small inline glyph for the two action buttons (the header uses the larger
// tiled treatment above). On the filled LinkedIn button the mark goes white so
// it reads against the blue; everywhere else it keeps its brand colour.
const ProviderGlyph = ({ provider, filled }) => (
  provider === 'linkedin'
    ? <LinkedInIcon sx={{ fontSize: 22, color: filled ? '#fff' : '#0a66c2' }} />
    : <GoogleLogo width="19" height="19" />
);

export default function TermsConsentDialog({
  open,
  provider,
  onAccept,
  onCancel,
  termsPath = '/terms',
  privacyPath = '/privacy',
}) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const config = PROVIDERS[provider];
  const otherKey = OTHER_PROVIDER[provider];
  const other = PROVIDERS[otherKey];

  return (
    <Dialog
      open={Boolean(open && config)}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ style: { borderRadius: isMobile ? 16 : 24, overflow: 'hidden' } }}
    >
      {config && (
        <Wrap>
          <Close type="button" onClick={onCancel} aria-label="Close">
            <CloseIcon sx={{ fontSize: 20 }} />
          </Close>

          <Marks>
            {/* White-on-purple: the mark's default indigo gradient would sink
                into the tile behind it. */}
            <BrandTile><BrandIcon size={32} onDark from="#ffffff" to="#efeaff" /></BrandTile>
            <Dots><span /><span /><span /></Dots>
            <ProviderTile><ProviderMark provider={provider} /></ProviderTile>
          </Marks>

          <Title>Continue with {config.name}</Title>
          <Copy>
            You&apos;ll sign in on {config.name}, then come right back here.
            It takes a few seconds.
          </Copy>

          <Panel>
            <PanelLabel>What ProfilleAI will receive</PanelLabel>
            <Receives>
              {config.receives.map((item) => (
                <li key={item}><CheckMark />{item}</li>
              ))}
            </Receives>
          </Panel>

          <Assurance>
            <ShieldMark />
            <span>{config.assurance}</span>
          </Assurance>

          <Legal>
            By continuing you agree to our{' '}
            <RouterLink to={termsPath} target="_blank" rel="noopener">Terms and Conditions</RouterLink>
            {' '}and{' '}
            <RouterLink to={privacyPath} target="_blank" rel="noopener">Privacy Policy</RouterLink>.
          </Legal>

          <Action
            type="button"
            $filled={provider === 'linkedin'}
            onClick={() => onAccept(provider)}
          >
            <ProviderGlyph provider={provider} filled={provider === 'linkedin'} />
            Continue with {config.name}
          </Action>
          <Action type="button" onClick={() => onAccept(otherKey)}>
            <ProviderGlyph provider={otherKey} />
            Continue with {other.name} instead
          </Action>
        </Wrap>
      )}
    </Dialog>
  );
}
