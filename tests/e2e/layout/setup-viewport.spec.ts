// tests/e2e/layout/setup-viewport.spec.ts
//
// embertide-1vm — Opening Setup page viewport fit.
//
// The opening Setup screen must fit in a 1280x800 viewport without a vertical
// scrollbar. This is the "single-screen" design target called out in the PRD
// and the embertide-edv follow-up memory: Setup champion tiles + board
// grid should not require scrolling at the baseline desktop viewport.
//
// Regression origin: embertide-edv (commit 581c3a6) introduced per-seat
// champion rows, stacking N champion rows vertically and blowing past the
// viewport at playerCount >= 2. The fix compacts seat rows and switches
// .setup-root min-height from 100vh to 100% so the parent .app-root padding
// (4px top/bottom) is honored.
//
// Assertions cover all 4 player counts because seat rows multiply vertically
// with playerCount; a fix that only addresses players=2 would leave players=3
// and players=4 still broken.

import { test, expect } from '@playwright/test';

test.describe('Setup viewport fit @layout', () => {
  for (const players of [1, 2, 3, 4] as const) {
    test(`fits 1280x800 without vertical scrollbar at players=${players}`, async ({
      page,
      viewport,
    }) => {
      // This spec is scoped to the desktop 1280x800 baseline. Other Playwright
      // projects (e.g. iphone-se) should skip rather than crash on viewport
      // mismatch. The `desktop` project pins 1280x800 in playwright.config.ts.
      test.skip(
        viewport?.width !== 1280 || viewport?.height !== 800,
        `desktop-only spec; current viewport=${viewport?.width}x${viewport?.height}`,
      );

      await page.goto('/');
      await page.waitForSelector('[data-testid="setup-root"]');

      // Click the player-count gem (default is 2; explicit click is a no-op
      // on players=2 and a state change on 1/3/4).
      await page
        .locator('button[data-variant="gem"]')
        .filter({ hasText: String(players) })
        .click();

      // Let React commit the re-render and the layout settle.
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-seat]').length === n,
        players,
      );

      const metrics = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      // Hard contract: no vertical overflow. The acceptance criterion is
      // "Opening page fits 1280x800 without vertical scrollbar" — document
      // scrollHeight MUST be <= viewport innerHeight.
      expect(
        metrics.scrollHeight,
        `players=${players} produced vertical overflow: ${metrics.scrollHeight - metrics.innerHeight}px past innerHeight`,
      ).toBeLessThanOrEqual(metrics.innerHeight);

      // Horizontal overflow is less common but still a scrollbar trigger —
      // guard against it so a future champion-row refactor doesn't regress.
      expect(
        metrics.scrollWidth,
        `players=${players} produced horizontal overflow: ${metrics.scrollWidth - metrics.innerWidth}px past innerWidth`,
      ).toBeLessThanOrEqual(metrics.innerWidth);
    });
  }
});
