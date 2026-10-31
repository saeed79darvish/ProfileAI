import React from 'react';
import CookieConsent from 'react-cookie-consent';
import { Link } from 'react-router-dom';
import { createGlobalStyle } from 'styled-components';
import { COOKIE_CONSENT_NAME, clearAnalyticsSession } from '@/utils/analytics';

/* A compact dark bar floating above the page. disableStyles drops the
   library's inline styles so these classes, media queries included, apply. */
const BannerStyles = createGlobalStyle`
  .cookie-banner {
    position: fixed;
    left: 50%;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    z-index: 1200;
    width: min(640px, calc(100% - 24px));
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px 12px 18px;
    background: #1e2235;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.32);
    color: rgba(255, 255, 255, 0.82);
    font-size: 14px;
    line-height: 1.4;

    @media (max-width: 600px) {
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      padding: 10px 10px 10px 16px;
    }
  }

  .cookie-banner__text {
    flex: 1;
    min-width: 0;

    a {
      color: #a5b4fc;
      font-weight: 600;
      text-decoration: underline;
    }
  }

  .cookie-banner__buttons {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .cookie-banner__accept,
  .cookie-banner__decline {
    height: 42px;
    padding: 0 18px;
    border-radius: 12px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    @media (max-width: 600px) {
      padding: 0 14px;
    }
  }

  .cookie-banner__accept {
    background: #5b5fd6;
    color: #fff;
    border: none;
  }

  .cookie-banner__decline {
    background: transparent;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.24);
  }
`;

/**
 * GDPR cookie consent banner. Decline is real: it turns off the in-house
 * usage analytics (see utils/analytics.js); sign-in storage is essential and
 * stays either way.
 */
const CookieConsentBanner = () => (
  <>
    <BannerStyles />
    <CookieConsent
      disableStyles
      location="none"
      buttonText="Accept"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName={COOKIE_CONSENT_NAME}
      expires={365}
      containerClasses="cookie-banner"
      contentClasses="cookie-banner__text"
      buttonWrapperClasses="cookie-banner__buttons"
      buttonClasses="cookie-banner__accept"
      declineButtonClasses="cookie-banner__decline"
      customContainerAttributes={{ role: 'region', 'aria-label': 'Cookie consent' }}
      onDecline={clearAnalyticsSession}
    >
      We use cookies. <Link to="/privacy">Privacy Policy</Link>
    </CookieConsent>
  </>
);

export default CookieConsentBanner;
