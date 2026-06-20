/**
 * One-off screenshot capture for embertide-rkbf.
 *
 * Boots the play board at 1280×800 with the princess-crystal-freed debug
 * seed, populates the active player's in-play with the starter green
 * shard card so the new card-art (vertical-hex Aurelia-canon shard) is on
 * screen, and snapshots:
 *
 *   1. full board                        — .screenshots/rkbf-fullboard-1280x800.png
 *   2. populated in-play (shard tile)    — .screenshots/rkbf-shard-inplay.png
 *   3. trays-row close-up (GreenRupee
 *      counter icon)                     — .screenshots/rkbf-trays-row.png
 *   4. hand-row close-up (shard in hand) — .screenshots/rkbf-hand-row.png
 *   5. card-detail modal (zoom on the
 *      shard card showing full art)      — .screenshots/rkbf-shard-detail.png
 *
 * NOT run in CI — used ad-hoc during the rkbf eyeball pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('rkbf — vertical-hex shard on hand, in-play, tray, and card-detail', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('rasc.dropHintSeen', '1'));
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  await expect(page.getByTestId('game-board')).toBeVisible();

  // Push the active player's first starter-green-shard card into inPlay
  // so the in-play tile shows the new vertical-hex shard art.
  await page.evaluate(() => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('rkbf: __gameStore not exposed by debug seed');
    const state = store.getState() as {
      players: { hand: { id: string }[]; inPlay: { id: string }[] }[];
      currentPlayerIndex: number;
    };
    const idx = state.currentPlayerIndex;
    const hand = state.players[idx].hand;
    const greenIdx = hand.findIndex((c) => c.id === 'starter-green-shard');
    const target = greenIdx >= 0 ? greenIdx : 0;
    const moved = hand[target];
    if (!moved) return;
    const players = state.players.map((p, i) =>
      i === idx
        ? {
            ...p,
            inPlay: [moved],
            hand: hand.filter((_, j) => j !== target),
          }
        : p,
    );
    store.setState({ ...state, players });
  });

  await expect(page.getByTestId('drop-zone-empty')).toHaveCount(0);

  // 1. Full board.
  await page.screenshot({ path: '.screenshots/rkbf-fullboard-1280x800.png' });

  // 2. In-play tile close-up.
  const inPlay = page.getByTestId('in-play');
  await expect(inPlay).toBeVisible();
  await inPlay.screenshot({ path: '.screenshots/rkbf-shard-inplay.png' });

  // 3. Trays-row close-up — verifies the GreenRupee tray-counter icon
  //    rendered with the new vertical-hex silhouette.
  const traysRow = page.locator('.trays-row');
  await traysRow.screenshot({ path: '.screenshots/rkbf-trays-row.png' });

  // 4. Hand-row close-up — verifies any remaining shard cards in hand
  //    show the new card-art and the cost-pip (if visible) is the new
  //    vertical hex.
  const handRow = page.locator('.hand-row, [data-testid="player-hand"]').first();
  if (await handRow.count()) {
    await handRow.screenshot({ path: '.screenshots/rkbf-hand-row.png' });
  } else {
    await page.screenshot({
      path: '.screenshots/rkbf-hand-row.png',
      clip: { x: 0, y: 600, width: 1280, height: 200 },
    });
  }

  // 5. Card-detail modal — open the in-play shard tile to inspect the
  //    full card-art at zoom.
  await inPlay
    .locator('[data-testid^="in-play-card"], button, [role="button"]')
    .first()
    .click({ trial: false })
    .catch(() => undefined);
  await page.waitForTimeout(400);
  const detail = page.locator('[role="dialog"], [data-testid="card-detail-modal"]').first();
  if (await detail.count()) {
    await detail.screenshot({ path: '.screenshots/rkbf-shard-detail.png' });
  } else {
    await page.screenshot({
      path: '.screenshots/rkbf-shard-detail.png',
      clip: { x: 200, y: 100, width: 880, height: 600 },
    });
  }
});
