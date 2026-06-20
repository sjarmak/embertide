/**
 * Playtester config (embertide-ov9). Runs against a Vite dev server.
 *
 * Server resolution order:
 *   1. `PLAYWRIGHT_BASE_URL` env var — used verbatim. Intended for agents
 *      running in a worktree that already have Vite up on a non-default
 *      port, or CI pointed at a pre-built preview.
 *   2. Default `http://localhost:6174` with `reuseExistingServer: false`.
 *      Playwright ALWAYS spawns `pnpm dev` for THIS worktree on a
 *      dedicated port so the specs never accidentally screenshot the
 *      designer's live HMR of a DIFFERENT branch. This closes the
 *      review-methodology hazard hit in u-10b round 2 (baselines
 *      captured against :5173-on-main, verified against
 *      :5173-on-worktree → 8% pixel diff on font / text surfaces).
 *
 * Port 6174 is chosen so concurrent worktree playtest runs don't
 * collide with `pnpm dev` (5173) or vite preview (4173). Override via
 * `PLAYWRIGHT_BASE_URL` when CI / preview infrastructure controls the
 * target explicitly.
 *
 * Scenarios must be idempotent — re-running should not leak state.
 */

import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORT = 6174;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${DEFAULT_PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 180_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // scenarios share the dev server; serial is safer
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  // Always spawn a dedicated dev server for THIS worktree's sources so
  // snapshot baselines are always captured from the tree that's about
  // to be verified. `reuseExistingServer: false` means a prior leftover
  // on :6174 is killed and restarted; `strictPort` fails fast if
  // anything else claims the port. When `PLAYWRIGHT_BASE_URL` is set,
  // we skip the webServer entirely because the caller is asserting
  // "I control the target" (CI, preview deploy, etc).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --host 127.0.0.1 --port ${DEFAULT_PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
