import React from 'react';
import styled from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BrandIcon from './BrandIcon';

/**
 * Consent step shown when a user starts an OAuth signup.
 *
 * The email form collects consent with an inline checkbox, but the OAuth
 * buttons hand off to a provider immediately, so consent has to be captured in
 * front of that handoff. Accepting here both records the consent sent to the
 * register endpoint and continues straight into the provider flow.
 */

const Wrap = styled.div`
  position: relative;
  padding: 30px 28px 24px;
  background: #fff;
`;

const IconFrame = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  background: linear-gradient(135deg, #eef2ff, #f5f3ff);
  border: 1px solid #e7e9f5;
`;

const Title = styled.h3`
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #0f1020;
`;

const Copy = styled.p`
  margin: 0 0 22px;
  font-size: 14.5px;
  line-height: 1.55;
  color: #4b5563;

  a {
    color: #5b4fe0;
    font-weight: 700;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

const Provider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8f9fc;
  border: 1px solid #eceef3;
  font-size: 13.5px;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 20px;
`;

const Accept = styled.button`
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #5b4fe0, #8b5cf6);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(91, 79, 224, 0.35); }
`;

const Cancel = styled.button`
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border: none;
  background: none;
  border-radius: 10px;
  color: #6b7280;
  font-size: 14.5px;
  font-weight: 700;
  cursor: pointer;

  &:hover { background: #f9fafb; color: #0f1020; }
`;

const PROVIDER_LABEL = {
  google: 'Continuing with Google',
  linkedin: 'Continuing with LinkedIn',
};

const PROVIDER_GLYPH = {
  google: 'G',
  linkedin: 'in',
};

export default function TermsConsentDialog({
  open,
  provider,
  onAccept,
  onCancel,
  termsPath = '/terms',
  privacyPath = '/privacy',
}) {
  const isMobile = useMediaQuery('(max-width:600px)');

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ style: { borderRadius: isMobile ? 14 : 20, overflow: 'hidden' } }}
    >
      <Wrap>
        <IconFrame><BrandIcon size={30} /></IconFrame>
        <Title>Before you continue</Title>
        <Copy>
          By creating an account you confirm that you have read and agree to our{' '}
          <RouterLink to={termsPath} target="_blank" rel="noopener">Terms and Conditions</RouterLink>
          {' '}and{' '}
          <RouterLink to={privacyPath} target="_blank" rel="noopener">Privacy Policy</RouterLink>.
        </Copy>

        {provider && (
          <Provider>
            <strong>{PROVIDER_GLYPH[provider]}</strong>
            {PROVIDER_LABEL[provider]}
          </Provider>
        )}

        <Accept onClick={onAccept}>Accept and continue</Accept>
        <Cancel onClick={onCancel}>Cancel</Cancel>
      </Wrap>
    </Dialog>
  );
}
