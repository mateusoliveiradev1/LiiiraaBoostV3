import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const LOOPBACK_HOST = '127.0.0.1';

export default defineConfig({
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
  plugins: [react(), tailwindcss()],
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
});
