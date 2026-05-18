import React from 'react';
import CookieConsent from 'react-cookie-consent';
import { Link } from 'react-router-dom';

/**
 * GDPR-compliant cookie consent banner
 * Uses react-cookie-consent library which handles localStorage automatically
 */
const CookieConsentBanner = () => {
  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept All"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName="profileai_cookie_consent"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        alignItems: 'center',
        padding: '16px 24px',
        fontSize: '14px',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
      }}
      buttonStyle={{
        background: '#ffffff',
        color: '#667eea',
        fontSize: '14px',
        fontWeight: '600',
        borderRadius: '8px',
        padding: '10px 24px',
        cursor: 'pointer',
        border: 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      declineButtonStyle={{
        background: 'transparent',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '10px 24px',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        marginRight: '10px',
        transition: 'background 0.2s',
      }}
      expires={365}
      onAccept={() => {
        // Enable analytics, tracking, etc.
        console.log('Cookie consent accepted');
      }}
      onDecline={() => {
        // Disable non-essential cookies
        console.log('Cookie consent declined');
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        🍪 We use cookies to enhance your experience. By continuing to visit this site, you agree to our use of cookies.{' '}
        <Link 
          to="/privacy" 
          style={{ 
            color: '#ffffff', 
            textDecoration: 'underline',
            fontWeight: '500',
          }}
        >
          Learn more in our Privacy Policy
        </Link>
      </span>
    </CookieConsent>
  );
};

export default CookieConsentBanner;
