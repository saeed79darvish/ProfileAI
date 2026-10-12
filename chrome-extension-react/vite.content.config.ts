import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * The content script gets its own build, on purpose.
 *
 * MV3 content scripts are CLASSIC scripts — there is no `"type": "module"` for
 * them — so `dist/content.js` must contain every line it needs. In the main
 * build it was one entry among several, and the moment it shared a module with
 * the background worker (the job scraper, which both have to run) Rollup did
 * the correct thing for a web app and the wrong thing for an extension: it
 * hoisted the shared code into `assets/jobScrape-*.js` and emitted
 *
 *     import{s as ut}from"./assets/jobScrape-D4WMXhhj.js";
 *
 * at the top of content.js. That throws `Cannot use import statement outside a
 * module` before the first statement runs, which kills the content script on
 * every page — no overlay, no autofill, no job detection, and nothing in the
 * extension's own logs to say why.
 *
 * Building it alone as an IIFE removes the possibility: with one entry there is
 * nothing to share a chunk with, so the scraper is inlined into both this
 * bundle and the background bundle.
 *
 * `emptyOutDir` is false because this runs AFTER the main build and must not
 * delete its output — see the `build` script in package.json.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    // A library build gives a single self-contained file with no code
    // splitting and no import statements.
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'ProfileAIContent',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        // Content scripts load no CSS of their own; content.css is copied
        // straight from public/ by the main build.
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
