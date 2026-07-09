import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// `defineConfig` can take a fn so we get `mode` — reliable in `vite build`
// (always 'production' by default), unlike `process.env.NODE_ENV` which
// isn't populated by the CLI and left the previous drop-console rule
// silently disabled in prod.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/system',
      '@mui/styled-engine',
      'styled-components',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/assets': path.resolve(__dirname, './src/assets'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
  esbuild: {
    // Strip chatty logs from prod bundles. Keep warn/error so real issues
    // still surface for anyone (or Sentry) watching the console. Drops
    // `debugger` too. Dev builds keep everything.
    pure: mode === 'production'
      ? ['console.log', 'console.info', 'console.debug', 'console.trace']
      : [],
    drop: mode === 'production' ? ['debugger'] : [],
  },
}));
