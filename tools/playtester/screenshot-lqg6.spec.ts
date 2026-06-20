/**
 * One-off screenshot capture for embertide-lqg6.
 *
 * Boots the play board at 1280×800 with the princess-crystal-freed
 * debug seed and captures the new DiscardPile pane in three states:
 *
 *   1. empty discard pane (.screenshots/lqg6-discard-empty.png)
 *   2. populated discard pane after one buy (.screenshots/lqg6-discard-populated.png)
 *   3. tap-zoom modal showing the discarded card (.screenshots/lqg6-discard-zoom.png)
 *   4. full board (1280×800) with the populated discard pile + matching
 *      hand-row spacer for the user-eyeball alignment check
 *      (.screenshots/lqg6-fullboard-1280x800.png)
 *
 * NOT run in CI — used ad-hoc during the lqg6 eyeball pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('lqg6 — discard pile empty / populated / zoom + full-board layout', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('rasc.dropHintSeen', '1'));
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  await expect(page.getByTestId('game-board')).toBeVisible();

  // 1. Empty discard pane — fresh seed has no cards in discard yet.
  const empty = page.getByTestId('discard-pile');
  await expect(empty).toBeVisible();
  await expect(empty).toHaveAttribute('data-empty', 'true');
  await empty.screenshot({ path: '.screenshots/lqg6-discard-empty.png' });

  // 2. Push a card into the active player's discard pile so the top
  //    tile renders face-up. Pull from the player's deck (avoids needing
  //    valid market funds) and shove it onto the discard's tail.
  await page.evaluate(() => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('lqg6: __gameStore not exposed by debug seed');
    const state = store.getState() as {
      players: {
        deck: { id: string }[];
        hand: { id: string }[];
        discard: { id: string }[];
      }[];
      currentPlayerIndex: number;
    };
    const idx = state.currentPlayerIndex;
    const player = state.players[idx];
    // Prefer a hand card so the test reflects the "I just acquired this"
    // user story; fall back to deck if hand is empty.
    const source = player.hand.length > 0 ? 'hand' : 'deck';
    const pool = source === 'hand' ? player.hand : player.deck;
    if (pool.length === 0) throw new Error('lqg6: no card available for discard seed');
    const moved = pool[0];
    const remaining = pool.slice(1);
    const players = state.players.map((p, i) =>
      i === idx
        ? {
            ...p,
            [source]: remaining,
            discard: [...p.discard, moved],
          }
        : p,
    );
    store.setState({ ...state, players });
  });

  const pile = page.getByTestId('discard-pile');
  await expect(pile).toBeVisible();
  await expect(pile).not.toHaveAttribute('data-empty', 'true');
  await expect(page.getByTestId('discard-pile-top')).toBeVisible();
  await pile.screenshot({ path: '.screenshots/lqg6-discard-populated.png' });

  // 3. Tap-zoom modal — opens CardDetailModal in read-only mode (only
  //    the Close button renders; no action button).
  await page.getByTestId('discard-pile-top').click();
  await page.waitForTimeout(300);
  const modal = page.locator('[role="dialog"][aria-label$="detail"]').first();
  await expect(modal).toBeVisible();
  // Confirm read-only mode: the action button should NOT be in the DOM.
  await expect(page.getByTestId('card-detail-action')).toHaveCount(0);
  await expect(page.getByTestId('card-detail-cancel')).toBeVisible();
  await modal.screenshot({ path: '.screenshots/lqg6-discard-zoom.png' });

  // Dismiss the modal so the full-board screenshot shows the pile, not
  // the modal backdrop.
  await page.getByTestId('card-detail-cancel').click();
  await page.waitForTimeout(200);

  // 4. Full board — confirms the play-zones / hand-row / trays-row
  //    centred-alignment survives the DiscardPile + matching spacers.
  await page.screenshot({ path: '.screenshots/lqg6-fullboard-1280x800.png' });
});
