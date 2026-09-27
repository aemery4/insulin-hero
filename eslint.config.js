import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// All data stays on the device. These rules make any attempt at network access
// in app code a lint error, as a guard alongside the production CSP.
const NO_NETWORK = 'Insulin Hero is offline-only: no network calls are allowed in app code.';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NO_NETWORK },
        { name: 'XMLHttpRequest', message: NO_NETWORK },
        { name: 'WebSocket', message: NO_NETWORK },
        { name: 'EventSource', message: NO_NETWORK },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: NO_NETWORK },
        { object: 'globalThis', property: 'fetch', message: NO_NETWORK },
        { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
      ],
    },
  },
);
