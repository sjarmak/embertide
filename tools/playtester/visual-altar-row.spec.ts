/**
 * Scenario: visual regression — altar row with ornamented wild + region
 * frames (embertide u-10c).
 *
 * Boots `?debug=wild-boss-slot` (u-9e seed) which drops the player on
 * the main GameBoard with both the Sylvani wild + region altars
 * populated. Screenshots the `boss-altar-row` locator and asserts
 * against a committed baseline.
 *
 * The baseline lives at
 * `tools/playtester/__snapshots__/visual-altar-row.spec.ts-snapshots/`.
 * First run (or intentional art update) regenerates via
 * `pnpm playtest --update-snapshots`.
 *
 * Tolerance: ±2% pixel diff — tolerates font kerning and sub-pixel
 * anti-aliasing without letting genuine regressions through.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-altar-row — wild + region altars render with ornaments (u-10c)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const row = page.locator('[data-testid="boss-altar-row"]');
  await expect(row).toBeVisible();

  // Wait for the ornament <img> tags to finish decoding. Without this
  // the first render after boot can screenshot a row with the frames
  // still rasterizing, producing a noisy diff.
  const ornaments = page.locator('[data-testid="boss-altar-pane-ornament"]');
  const count = await ornaments.count();
  for (let i = 0; i < count; i += 1) {
    const img = ornaments.nth(i);
    await img.evaluate((el: HTMLImageElement) =>
      el.complete ? null : el.decode().catch(() => null),
    );
  }

  await expect(row).toHaveScreenshot('altar-row-wild-region.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});
