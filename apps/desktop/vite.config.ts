import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const LOOPBACK_HOST = '127.0.0.1';
const PRODUCTION_ENTRYPOINT = '/src/production-index.tsx';
const BROWSER_TEST_ENTRYPOINT = '/src/index.ts';
const PRODUCTION_OPERATIONS_MODULE = './features/premium-operations-production.js';
const BROWSER_TEST_OPERATIONS_MODULE = fileURLToPath(
  new URL('./src/features/premium-operations.tsx', import.meta.url),
);
const DESKTOP_HTML = fileURLToPath(new URL('./index.html', import.meta.url));

const browserTestComposition = (): Plugin => ({
  name: 'liiiraa-desktop-browser-test-composition',
  enforce: 'pre',
  configResolved() {
    if (!readFileSync(DESKTOP_HTML, 'utf8').includes(PRODUCTION_ENTRYPOINT)) {
      throw new Error('Desktop browser test refused: production entrypoint was not found.');
    }
  },
  resolveId(source) {
    return source === PRODUCTION_OPERATIONS_MODULE ? BROWSER_TEST_OPERATIONS_MODULE : null;
  },
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      if (!html.includes(PRODUCTION_ENTRYPOINT)) {
        throw new Error('Desktop browser test refused: production entrypoint was not found.');
      }
      return html.replace(PRODUCTION_ENTRYPOINT, BROWSER_TEST_ENTRYPOINT);
    },
  },
});

export default defineConfig(({ mode }) => ({
  appType: 'spa',
  base: './',
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
  },
  cacheDir: '../../node_modules/.vite/apps-desktop',
  clearScreen: false,
  plugins: [...(mode === 'browser-test' ? [browserTestComposition()] : []), react(), tailwindcss()],
  preview: {
    host: LOOPBACK_HOST,
    port: 4173,
    strictPort: true,
  },
  publicDir: 'public',
  server: {
    host: LOOPBACK_HOST,
    port: 1420,
    strictPort: true,
  },
}));
