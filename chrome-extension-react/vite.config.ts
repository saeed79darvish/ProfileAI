import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Custom plugin to copy manifest and static files
const copyManifest = () => ({
  name: 'copy-manifest',
  closeBundle() {
    // Ensure dist directory exists
    if (!existsSync('dist')) {
      mkdirSync('dist', { recursive: true });
    }
    
    // Copy manifest.json
    copyFileSync('public/manifest.json', 'dist/manifest.json');
    
    // Copy content.css
    copyFileSync('public/content.css', 'dist/content.css');

    // Copy the LinkedIn fetch/XHR shim (loaded as a MAIN-world content
    // script at document_start — must be plain JS, no bundling).
    if (existsSync('public/linkedin-shim.js')) {
      copyFileSync('public/linkedin-shim.js', 'dist/linkedin-shim.js');
    }

    // Copy icons
    if (!existsSync('dist/icons')) {
      mkdirSync('dist/icons', { recursive: true });
    }
    ['icon16.png', 'icon48.png', 'icon128.png'].forEach(icon => {
      if (existsSync(`public/icons/${icon}`)) {
        copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), copyManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Vite emits <link rel="modulepreload" crossorigin> for each entry's
    // dependencies. Under chrome-extension:// the crossorigin attribute puts
    // the preload in a different request world than the module load that
    // follows, so Chrome fetches the file, refuses to match it, logs "cross-
    // world extension resource mismatch", and fetches it again. The preload is
    // pure waste here regardless: these are local files with no network to
    // hide, so the latency the hint exists to buy does not exist.
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        gapreview: resolve(__dirname, 'src/gapreview/index.html'),
        download: resolve(__dirname, 'src/download/index.html'),
        onboarding: resolve(__dirname, 'src/onboarding/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background and content scripts at root level
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Make content script self-contained
        manualChunks: (id) => {
          // Don't split content script into chunks
          if (id.includes('content/index.ts')) {
            return undefined;
          }
        },
        inlineDynamicImports: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
