import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
// Side-effect import: installs window.error / unhandledrejection hooks and
// the window.__profileaiDiag() helper. Keep at top so it's first to run.
import { diag } from './utils/diagLogger';

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
  // Persist + log so we can reconstruct the crash across refreshes.
  React.useEffect(() => {
    try {
      const payload = {
        message: error?.message || String(error),
        stack: error?.stack || null,
        url: window.location.href,
        ts: new Date().toISOString(),
      };
      localStorage.setItem('profileai_last_error', JSON.stringify(payload));
      diag('sentry.fallback.rendered', payload);
    } catch { /* noop */ }
  }, [error]);

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h2>Something went wrong</h2>
      <p>The page hit an unexpected error. Our team has been notified.</p>
      <button onClick={resetError} style={{ padding: '8px 16px', cursor: 'pointer', marginRight: 8 }}>
        Try again
      </button>
      <button
        onClick={() => { window.location.href = '/'; }}
        style={{ padding: '8px 16px', cursor: 'pointer' }}
      >
        Go home
      </button>
      {/* Always show in prod for now — we are actively diagnosing a refresh crash. */}
      <pre
        style={{
          marginTop: 16,
          color: '#b00',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#fff5f5',
          border: '1px solid #fbb',
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          maxHeight: 360,
          overflow: 'auto',
        }}
      >
        {String(error?.message || error)}
        {error?.stack ? '\n\n' + error.stack : ''}
      </pre>
      <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
        Diag log: open DevTools console and run <code>__profileaiDiag()</code> to dump captured events.
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Sentry.ErrorBoundary fallback={Fallback}>
    <App />
  </Sentry.ErrorBoundary>
);
