/**
 * One-off screenshot capture for embertide-35rv (player-pane
 * compaction + per-player items button).
 *
 * Boots `?debug=wild-boss-slot` (default 2P co-op state) at 1280×800
 * and captures the trays band for both pre- and post-bag-open states.
 *
 * NOT run in CI — used ad-hoc during the polish pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('35rv — per-player items button + cream tray + 24px icons', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  // Capture full trays band so we can see both player panes side-by-side.
  const trays = page.locator('.trays').first();
  await expect(trays).toBeVisible();
  await trays.screenshot({ path: '.screenshots/35rv-trays-band.png' });

  // Capture full board (verifies rail still fits + nothing broken).
  await page.screenshot({ path: '.screenshots/35rv-fullboard-1280x800.png' });

  // Both players have their own bag chip; only p0 (active) is interactive.
  const p0Bag = page.getByTestId('items-bag-p0');
  const p1Bag = page.getByTestId('items-bag-p1');
  await expect(p0Bag).toBeVisible();
  await expect(p1Bag).toBeVisible();

  // Active player's chip is enabled; teammate's is disabled.
  const p0Chip = page.getByTestId('items-bag-chip-p0');
  const p1Chip = page.getByTestId('items-bag-chip-p1');
  await expect(p0Chip).toBeEnabled();
  await expect(p1Chip).toBeDisabled();
});
