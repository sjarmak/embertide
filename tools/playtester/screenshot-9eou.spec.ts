/**
 * One-off screenshot capture for embertide-9eou.
 *
 * Boots `?debug=embertide-filled` at 1280×800 (the canonical play-area
 * viewport) so the right-rail crystal column shows Boss Altar → Princess
 * Crystal → Embertide niche, with all three Embertide shards lit so the
 * stained-glass-fills-empty-slots aesthetic is visible. Saves a
 * full-page screenshot + a tight rail-only crop for user eyeball
 * review per the play-area beads' Playwright-verify mandate.
 *
 * NOT run in CI — used ad-hoc during the polish pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('9eou — right-rail Boss Altar → Crystal → Embertide niche', async ({ page }) => {
  await bootApp(page, { debug: 'embertide-filled' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  const rail = page.locator('.board-side-crystal-rail').first();
  await expect(rail).toBeVisible();

  await page.screenshot({
    path: '.screenshots/9eou-rail-fullboard-1280x800.png',
    fullPage: false,
  });

  await rail.screenshot({
    path: '.screenshots/9eou-rail-only.png',
  });

  // Capture Embertide shards filled so the empty-slot-fills-with-gold
  // aesthetic is visible.
  for (const id of ['power', 'wisdom', 'courage'] as const) {
    const shard = page.getByTestId(`embertide-shard-${id}`);
    await expect(shard).toHaveAttribute('data-filled', 'true');
  }
});

test('9eou — right-rail with empty Embertide niches (no shards earned)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  const rail = page.locator('.board-side-crystal-rail').first();
  await expect(rail).toBeVisible();

  await page.screenshot({
    path: '.screenshots/9eou-rail-fullboard-empty-1280x800.png',
    fullPage: false,
  });
  await rail.screenshot({
    path: '.screenshots/9eou-rail-empty.png',
  });

  // Empty shards still render (cathedral-niche aesthetic = recessed hollows).
  for (const id of ['power', 'wisdom', 'courage'] as const) {
    const shard = page.getByTestId(`embertide-shard-${id}`);
    await expect(shard).toHaveAttribute('data-filled', 'false');
  }
});
