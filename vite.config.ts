/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { tokensPlugin } from './tools/vite-plugin-tokens';

// Remote-tunnel hosts (e.g. cloudflared) must be opted in explicitly via env.
// Default is empty so the dev server only accepts default host headers
// (localhost, LAN IP). Example for a remote playtest session:
//   VITE_ALLOWED_HOSTS="my-tunnel-abc.trycloudflare.com" pnpm dev
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [
    tokensPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Realm Ascension',
        short_name: 'Realm',
        description: 'Local-household card game (v0.1)',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
      // Playwright E2E specs live under tests/e2e/** and must not be picked
      // up by Vitest (they depend on a running browser + dev/preview server).
      // See playwright.config.ts (testDir: 'tests/e2e').
      'tests/e2e/**',
      // Playtester scenarios (embertide-ov9) live under tools/playtester/
      // and are Playwright specs too — exclude from Vitest.
      'tools/playtester/**',
    ],
    coverage: {
      provider: 'v8',
      // Ratchet floor: measured 2026-06-12 at lines 80.04 / branches 85.48 /
      // functions 85.69 / statements 80.04. Thresholds sit ~5 points below
      // the measured baseline — raise them as coverage improves, never lower.
      thresholds: {
        lines: 75,
        branches: 80,
        functions: 80,
        statements: 75,
      },
    },
  },
});
