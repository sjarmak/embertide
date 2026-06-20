/**
 * One-off screenshot capture for embertide-ymgc.
 *
 * Boots the app at 1280×800, populates `lastChestReward` +
 * `lastChestRewardCard` directly via the exposed `window.__gameStore` so
 * the ChestReveal popup mounts on the cream parchment pane. Captures
 * two reward types — a hero (champion) and a premium-item (legendary
 * sword) — so the user can eyeball both the new card-art surface and
 * the cream + lead-gold panel chrome.
 *
 * NOT run in CI — used ad-hoc for the bead's verify mandate.
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

test('ymgc — chest reveal hero reward (rolled card art on cream pane)', async ({ page }) => {
  // Use any debug seed that exposes __gameStore + lands us on GameBoard.
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  // Pull the real Card object out of the active deck so the card carries
  // its full `effects` shape (CardTemplate's effectText resolution dives
  // into `card.effects.kind` and crashes on a hand-rolled fixture).
  // Also stub out `clearLastChestReward` BEFORE setting the reward so the
  // 1.6s auto-dismiss timer fires a no-op — the popup stays mounted long
  // enough for the screenshot.
  await page.evaluate(() => {
    const store = window.__gameStore;
    if (!store) throw new Error('__gameStore not exposed');
    const state = store.getState() as unknown as {
      players: ReadonlyArray<{ inPlay: ReadonlyArray<{ role: string }> }>;
    };
    const hero = state.players[0].inPlay.find((c) => c.role === 'hero');
    if (!hero) throw new Error('No hero found in inPlay deck');
    store.setState({
      clearLastChestReward: () => undefined,
      lastChestReward: 'hero',
      lastChestRewardCard: hero as unknown,
    } as Record<string, unknown>);
  });

  await page.waitForSelector('[data-testid="chest-reveal-backdrop"]', {
    state: 'visible',
    timeout: 2_000,
  });
  // Tiny settle for the framer-motion spring to land before capture.
  await page.waitForTimeout(600);

  await page.screenshot({
    path: '.screenshots/embertide-ymgc-hero.png',
    fullPage: false,
  });
});

test('ymgc — chest reveal premium-item reward (legendary sword card art)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const board = page.locator('[data-testid="game-board"]');
  await expect(board).toBeVisible();

  await page.evaluate(() => {
    const store = window.__gameStore;
    if (!store) throw new Error('__gameStore not exposed');
    const state = store.getState() as unknown as {
      players: ReadonlyArray<{ items: ReadonlyArray<{ role: string }> }>;
    };
    // Pull a legendary-sword from the seed-stocked items zone — falls
    // back to ANY item if none equipped (the wild-boss-slot seed gives
    // p0 a tower-shield + sentinel-eye, p1 a chimera-sword).
    const legendary =
      state.players[1].items.find((c) => c.role === 'legendary-sword') ?? state.players[0].items[0];
    if (!legendary) throw new Error('No item found in items zone');
    store.setState({
      clearLastChestReward: () => undefined,
      lastChestReward: 'premium-item',
      lastChestRewardCard: legendary as unknown,
    } as Record<string, unknown>);
  });

  await page.waitForSelector('[data-testid="chest-reveal-backdrop"]', {
    state: 'visible',
    timeout: 2_000,
  });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: '.screenshots/embertide-ymgc-item.png',
    fullPage: false,
  });
});
