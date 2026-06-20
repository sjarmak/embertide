/**
 * One-off screenshot capture for embertide-nmmc.
 *
 * Boots default at 1280×800 → board, opens the items bag chip, and
 * captures the popover. Verifies the chip's count badge no longer
 * shows `0/3` (legacy ITEM_CAP=3) and renders just the bare count.
 *
 * NOT run in CI — used ad-hoc during the polish pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('nmmc — items bag chip shows bare count, no legacy /3 cap badge', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  const chip = page.getByTestId('items-bag-chip');
  await expect(chip).toBeVisible();

  // Capture closed-state screenshot of the bag chip.
  await chip.screenshot({ path: '.screenshots/nmmc-bag-chip-closed.png' });

  const count = page.getByTestId('items-bag-chip-count');
  const countText = (await count.innerText()).trim();
  // No "/3" or "/N" — just the count.
  expect(countText).not.toMatch(/\//);
  expect(countText).toMatch(/^\d+$/);

  // Open the popover and screenshot it (empty state at default boot).
  await chip.click();
  const popover = page.getByTestId('items-bag-popover');
  await expect(popover).toBeVisible();
  await page.screenshot({ path: '.screenshots/nmmc-bag-popover-open-1280x800.png' });
});
