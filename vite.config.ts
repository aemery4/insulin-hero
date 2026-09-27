/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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
  plugins: [react(), cspPlugin(), capturePlugin()],
  test: {
    // Pure logic runs in node; UI tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
