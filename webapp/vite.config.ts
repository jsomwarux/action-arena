import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Mirrors landing/vite.config.ts, plus an `@` alias so webapp imports read the
// same way the mobile app's `@/...` imports do.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    // React Native provides `__DEV__` as a global. The lib/ and hooks/ files
    // ported from mobile guard dev-only logging on it, so define it here rather
    // than editing each ported file. Declared for tsc in src/types/globals.d.ts.
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
  },
}));
