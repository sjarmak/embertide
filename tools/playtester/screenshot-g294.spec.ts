/**
 * One-off screenshot capture for embertide-g294.
 *
 * Boots the play board at 1280×800 with the princess-crystal-freed
 * debug seed and captures the new VoidPane in three states:
 *
 *   1. Empty void pane — fresh seed, nothing voided yet
 *      (.screenshots/g294-void-empty.png)
 *   2. Populated void pane after a hand-banish (mocked by appending
 *      directly to state.voided so the playtest doesn't need a card
 *      with a `banish-from-hand` effect — the visual surface is what
 *      this bead is verifying)
 *      (.screenshots/g294-void-banished.png)
 *   3. Populated void pane after a monster-defeat — push a defeated
 *      monster into state.voided to verify the same pane surfaces
 *      combat kills, not just banishes
 *      (.screenshots/g294-void-defeated.png)
 *   4. Full 1280×800 board so the user can eyeball Discard + Void
 *      sitting side-by-side in .trays-row-pile-column
 *      (.screenshots/g294-fullboard-1280x800.png)
 *
 * NOT run in CI — used ad-hoc during the g294 eyeball pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

interface DebugCard {
  readonly id: string;
  readonly name?: string;
  readonly role?: string;
}

interface DebugState {
  voided: DebugCard[];
  players: { hand: DebugCard[]; deck: DebugCard[] }[];
  currentPlayerIndex: number;
}

test('g294 — void pane empty / banished / defeated + full-board layout', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('rasc.dropHintSeen', '1'));
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  await expect(page.getByTestId('game-board')).toBeVisible();

  // 1. Empty void pane — fresh seed has nothing in state.voided.
  const empty = page.getByTestId('void-pane');
  await expect(empty).toBeVisible();
  await expect(empty).toHaveAttribute('data-empty', 'true');
  await empty.screenshot({ path: '.screenshots/g294-void-empty.png' });

  // 2. Push a card into state.voided to simulate a hand-banish landing.
  //    Pulled from the active player's hand so the visual matches the
  //    "I just banished this card" user story.
  await page.evaluate(() => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('g294: __gameStore not exposed by debug seed');
    const state = store.getState() as DebugState;
    const idx = state.currentPlayerIndex;
    const player = state.players[idx];
    const source = player.hand.length > 0 ? 'hand' : 'deck';
    const pool = source === 'hand' ? player.hand : player.deck;
    if (pool.length === 0) throw new Error('g294: no card available for void seed');
    const moved = pool[0];
    const remaining = pool.slice(1);
    const players = state.players.map((p, i) => (i === idx ? { ...p, [source]: remaining } : p));
    store.setState({
      ...state,
      players,
      voided: [...state.voided, moved],
    });
  });

  const banished = page.getByTestId('void-pane');
  await expect(banished).toBeVisible();
  await expect(banished).not.toHaveAttribute('data-empty', 'true');
  await expect(page.getByTestId('void-pane-top')).toBeVisible();
  await banished.screenshot({ path: '.screenshots/g294-void-banished.png' });

  // 3. Push a SECOND card into state.voided — pulled from the player's
  //    deck — so the screenshot covers the multi-void case (count badge
  //    visible, top tile is the most-recent push). Uses a real card so
  //    CardTemplate can render the full chrome rather than choking on a
  //    fake object. Conceptually this stands in for "a monster was
  //    defeated and routed to the void after the earlier banish".
  await page.evaluate(() => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore!;
    const state = store.getState() as DebugState;
    const idx = state.currentPlayerIndex;
    const player = state.players[idx];
    const pool = player.deck.length > 0 ? player.deck : player.hand;
    if (pool.length === 0) throw new Error('g294: no card available for second void seed');
    const moved = pool[0];
    const remaining = pool.slice(1);
    const source = player.deck.length > 0 ? 'deck' : 'hand';
    const players = state.players.map((p, i) => (i === idx ? { ...p, [source]: remaining } : p));
    store.setState({
      ...state,
      players,
      voided: [...state.voided, moved],
    });
  });

  const populated = page.getByTestId('void-pane');
  await expect(populated).toBeVisible();
  await expect(populated).toHaveAttribute('data-count', '2');
  await populated.screenshot({ path: '.screenshots/g294-void-defeated.png' });

  // 4. Full-board capture — confirms Discard + Void sit side-by-side in
  //    .trays-row-pile-column without breaking the play-zones / hand-row /
  //    trays-row centred-alignment.
  await page.screenshot({ path: '.screenshots/g294-fullboard-1280x800.png' });
});
