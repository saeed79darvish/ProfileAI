import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// No-op when VITE_SENTRY_DSN is unset (local dev).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

function Fallback({ error, resetError }) {
  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h2>Something went wrong</h2>
      <p>The page hit an unexpected error. Our team has been notified.</p>
      <button onClick={resetError} style={{ padding: '8px 16px', cursor: 'pointer' }}>
        Try again
      </button>
      {import.meta.env.DEV && (
        <pre style={{ marginTop: 16, color: '#b00', whiteSpace: 'pre-wrap' }}>
          {String(error)}
        </pre>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Sentry.ErrorBoundary fallback={Fallback}>
    <App />
  </Sentry.ErrorBoundary>
);
