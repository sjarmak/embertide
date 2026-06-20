/**
 * Scenario: Session-arc Stirring → Rising transition (gm0.9 / REQ-19).
 *
 * Boots a fresh `game-board` via the `wild-boss-slot` debug seed, then
 * pins `state.turn = 1` via the `__gameStore` hook to force the
 * Stirring phase. Asserts that the wild-boss altar renders the dormant
 * placeholder (testId `wild-boss-slot-dormant`) and that the live
 * `wild-boss-slot` is NOT mounted. Advances `turn` to 3 (Rising), then
 * re-asserts that the dormant placeholder is gone and the interactive
 * `wild-boss-slot` is mounted.
 *
 * This is the playtester hook specified in the gm0.9 acceptance — a
 * single end-to-end run proves the 4-phase arc's dormant → interactive
 * flip on the wild slot.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('session-arc — Stirring (turn 1) renders dormant wild slot, Rising (turn 3) unlocks interactive slot (gm0.9 REQ-19)', async ({
  page,
}) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  // The `wild-boss-slot` debug seed pins turn=6 (Boss phase) so both
  // altars are engageable for downstream scenarios. Override to turn 1
  // (Stirring) via the __gameStore hook so this scenario can observe
  // the dormant placeholder deterministically.
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { turn: number };
        setState(next: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('__gameStore hook missing — dev build or wiring regression');
    const state = store.getState();
    store.setState({ ...state, turn: 1 });
  });

  // Stirring: dormant placeholder is the only wild slot element mounted.
  const dormant = page.locator('[data-testid="wild-boss-slot-dormant"]');
  const live = page.locator('[data-testid="wild-boss-slot"]');
  await expect(dormant).toBeVisible();
  await expect(live).toHaveCount(0);
  // The dormant pane is non-interactive; `data-disabled="true"` so
  // regression suites can query either attribute.
  await expect(dormant).toHaveAttribute('data-disabled', 'true');

  // Advance to Rising (turn 3). The dormant placeholder disappears and
  // the interactive wild-boss slot mounts in its place.
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { turn: number };
        setState(next: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return;
    const state = store.getState();
    store.setState({ ...state, turn: 3 });
  });

  await expect(dormant).toHaveCount(0);
  await expect(live).toBeVisible();
  await expect(live).toHaveAttribute('data-disabled', 'false');

  console.log('session-arc-stirring: wild slot flipped dormant → interactive at turn 1 → 3');
});
