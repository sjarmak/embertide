/**
 * Visual verification for the Setup landing background regen
 * (embertide-aigj) + the green jellet raster regen (9fos).
 *
 * Not a balance test — this just confirms the rasters render where
 * expected so the post-regen review doesn't have to be done by spinning
 * up the dev server by hand. Captures full-page screenshots for both
 * surfaces; the user reviews them visually.
 *
 * Resolves a couple of open behavior assertions:
 *   - Setup landing image loads (no 404 on the swapped webp URL)
 *   - The green jellet image loads if the card is present in the field
 *     (we don't force the field state — jellet may not be visible in a
 *     fresh game; the test passes if either the card raster or the
 *     setup background renders cleanly).
 */

import { test, expect } from '@playwright/test';
import { bootApp } from './harness';

test('aigj: Setup landing renders the regenerated Embertide background webp', async ({ page }) => {
  await bootApp(page);
  const setupRoot = page.locator('[data-testid="setup-root"]');
  await expect(setupRoot).toBeVisible();

  // Confirm the landing webp URL is reachable from the browser context.
  const response = await page.request.get('/illustrations/cathedral_setup_landing_001.webp');
  expect(response.status()).toBe(200);
  const buffer = await response.body();
  expect(buffer.byteLength).toBeGreaterThan(20_000); // sanity: not a placeholder

  // Snapshot the full Setup screen for visual review.
  await page.screenshot({
    path: '.screenshots/aigj-setup-landing.png',
    fullPage: false,
  });
});

test('9fos: green jellet webp is reachable and is not a placeholder', async ({ page }) => {
  await bootApp(page);
  // Direct asset fetch — the raster lives on disk regardless of whether
  // the jellet card is visible in the current game state.
  const response = await page.request.get('/illustrations/cathedral_monster_jellet_001.webp');
  expect(response.status()).toBe(200);
  const buffer = await response.body();
  expect(buffer.byteLength).toBeGreaterThan(20_000);

  // Save a screenshot of the file for visual review by piping the asset
  // into the page as an inline image.
  await page.setContent(`
    <html><body style="background:#0b1228; margin:0; padding:24px;">
      <img src="/illustrations/cathedral_monster_jellet_001.webp"
           style="width:512px; height:512px; display:block; image-rendering:auto;" />
    </body></html>
  `);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: '.screenshots/9fos-green-jellet.png',
    fullPage: false,
  });
});
