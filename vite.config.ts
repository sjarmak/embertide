/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { tokensPlugin } from './tools/vite-plugin-tokens';
import { pwaNoForcedReload } from './tools/vite-plugin-pwa-no-reload';

// Remote-tunnel hosts (e.g. cloudflared) must be opted in explicitly via env.
// Default is empty so the dev server only accepts default host headers
// (localhost, LAN IP). Example for a remote playtest session:
//   VITE_ALLOWED_HOSTS="my-tunnel-abc.trycloudflare.com" pnpm dev
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Public base path for the built app. Defaults to '/' (root host, e.g. the
// local dev server). Set EMBERTIDE_BASE to deploy under a sub-path — e.g.
// `EMBERTIDE_BASE=/games/embertide/ npm run build` so every asset URL, the
// PWA service-worker scope, and the manifest start_url resolve correctly
// when the app is served at https://sjarmak.ai/games/embertide/. The value
// MUST have a leading and trailing slash for sub-path builds.
const deployBase = process.env.EMBERTIDE_BASE ?? '/';

export default defineConfig({
  base: deployBase,
  plugins: [
    tokensPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Embertide ships as a committed static build behind Cloudflare + Render
      // (deploy-site.mjs) with content-hashed assets — the cache-first service
      // worker buys almost no offline value and has twice caused "stuck SW
      // serving stale art" incidents (white boss backgrounds; the
      // [v2-art-pending] combat backdrop never clearing on some devices).
      //
      // `selfDestroying` makes every build emit a worker that, on activate,
      // deletes all Cache Storage entries and unregisters itself. That evicts
      // the previously-registered embertide-scoped worker (and its stale
      // precached app shell) from every device, and keeps the staleness class
      // from recurring. We deliberately rely on the plugin-generated worker
      // rather than re-adding the earlier custom public/sw.js — that version
      // force-reloaded clients (`client.navigate`), which can reload-loop and
      // is the likely reason 75f7368 was reverted minutes later (b3f65a2).
      selfDestroying: true,
      integration: { closeBundleOrder: 'pre' },
      // scope + start_url track the deploy base so the installed PWA and its
      // service worker stay confined to (and launch into) the sub-path.
      scope: deployBase,
      manifest: {
        name: 'Realm Ascension',
        short_name: 'Realm',
        description: 'Local-household card game (v0.1)',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: deployBase,
      },
    }),
    pwaNoForcedReload(),
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
