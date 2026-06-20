/**
 * Ad-hoc screenshot capture for embertide-6846 (not run in CI).
 * Captures d20 reveal, winner-overlay, and altar-row sanity at 1280x800.
 * Output: `.screenshots/embertide-6846-{d20,winner,altar-row}.png`.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

declare global {
  interface Window {
    __gameStore?: {
      setState: (partial: Record<string, unknown>) => void;
      getState: () => unknown;
    };
  }
}

test('6846 — dungeon-boss d20 reveal on cream veil', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);
  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  await page.evaluate(() => {
    const store = window.__gameStore;
    if (!store) throw new Error('__gameStore not exposed');
    store.setState({
      commitDungeonBossReward: () => undefined,
      pendingDungeonBossRoll: { face: 14, sourceCardId: 'chimera' },
    });
  });

  await page.waitForSelector('[data-testid="die-roll-reveal-backdrop"]', {
    state: 'visible',
    timeout: 2_000,
  });
  // Wait past tumble + settle so the d20 lands on its rolled face.
  await page.waitForTimeout(1_300);
  await page.screenshot({
    path: '.screenshots/embertide-6846-d20.png',
    fullPage: false,
  });
});

test('6846 — winner-overlay on cream-toned veil', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);
  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  // Force the overlay to mount without simulating a full final-boss kill.
  await page.evaluate(() => {
    const store = window.__gameStore;
    if (!store) throw new Error('__gameStore not exposed');
    store.setState({ outcome: 'win' });
  });

  await page.waitForSelector('[data-testid="winner-overlay"]', {
    state: 'visible',
    timeout: 2_000,
  });
  // Hold past the 320ms `winner-overlay-fade` + 420ms `winner-banner-rise`
  // so the capture lands on the steady-state surface, not a half-faded one.
  await page.waitForTimeout(500);
  await page.screenshot({
    path: '.screenshots/embertide-6846-winner.png',
    fullPage: false,
  });
});

test('6846 — boss-altar row sanity (region + wild slots)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);
  const altarRow = page.locator('.boss-altar-row').first();
  await expect(altarRow).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: '.screenshots/embertide-6846-altar-row.png',
    fullPage: false,
  });
});
