/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { capturePlugin } from './tools/capture-plugin';

// Strict Content Security Policy for production builds. Everything is served from
// our own origin; no third-party network access is possible. (Omitted in dev
// because Vite's HMR client needs inline scripts and a websocket.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'insulin-hero-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  base: '/insulin-hero/',
  plugins: [
    react(),
    cspPlugin(),
    capturePlugin(),
    VitePWA({
      // New deploys activate on next load; no stale caches, no "update?" prompt.
      registerType: 'autoUpdate',
      injectRegister: 'script-defer', // external registerSW.js keeps the CSP free of inline scripts
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Insulin Hero',
        short_name: 'Insulin Hero',
        description: 'A learning game that shows how blood sugar and insulin work inside the body.',
        theme_color: '#141833',
        background_color: '#141833',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    // Pure logic runs in node; UI tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
