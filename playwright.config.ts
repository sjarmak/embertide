// playwright.config.ts
//
// Elysian Cathedral — E2E config. Owned by PRD T-4.
// - a11y: axe-core sweep against the built app (blocking in CI).
// - perf: chest-reveal + ambient-board FPS scaffolds (warn-only until V-7c
//   per A-18′ / R-15; PRD §8.5).
//
// Device projects cover the sign-off matrix referenced by accessibility.md §11
// (desktop 1280 is the "desktop" bucket; iPhone SE is the mobile bucket).
//
// Chromium pinning: `@playwright/test` is pinned in package.json to a specific
// minor version; `npx playwright install chromium` is expected to run before
// the first test (CI does it as a discrete step).

import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    trace: 'retain-on-failure',
    // Default to reduced motion so a11y sweeps aren't flaky on transitions.
    // Perf specs override per test via `page.emulateMedia`.
    reducedMotion: 'reduce',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
      },
    },
  ],

  webServer: {
    // `vite preview` serves the built dist/. The CI step builds before
    // running Playwright; locally the flag auto-builds too (preview refuses
    // to start without a fresh dist but `build && preview` is chained by
    // the a11y:axe script).
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
