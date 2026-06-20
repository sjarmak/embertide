/**
 * One-off screenshot capture for embertide-rtf4.
 *
 * Boots the play board at 1280×800 with the `wild-boss-slot` debug seed
 * (which lands the player on the main GameBoard with both altars
 * populated), then mutates the live game store via `window.__gameStore`
 * to walk the boss-altar row through the four phase-gate states the
 * rtf4 visual story exercises:
 *
 *   1. turn 1 — Stirring phase. BOTH altars phase-locked: wild slot
 *      shows the dormant variant ("Stirs at Turn 3"); region slot
 *      shows the new BossAltarPhaseLocked variant
 *      ("Available turn 6").
 *   2. turn 4 — Rising phase. Wild slot is engageable; region slot
 *      is still phase-locked.
 *   3. turn 6 — Boss phase, wild boss still alive (bossKeys empty).
 *      Region slot SEALED (padlock + boss-door); wild slot engageable.
 *   4. turn 6 — Boss phase, wild boss already cleared (bossKeys
 *      populated). Region slot engageable; wild slot cleared.
 *
 * NOT run in CI — used ad-hoc during the rtf4 review pass. Screenshots
 * land in `.screenshots/embertide-rtf4-*.png` for the main session
 * to review.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

interface BossKeys {
  readonly sylvani: readonly string[];
  readonly 'emberpeak': readonly string[];
  readonly maren: readonly string[];
  readonly 'hollow-shrine': readonly string[];
  readonly 'dune-sanctum': readonly string[];
  readonly 'gilded-cage': readonly string[];
}

interface MutableState {
  readonly turn: number;
  readonly bossKeys: BossKeys;
  readonly defeatedBossIds: readonly string[];
}

/**
 * Patch the live game store with new turn / bossKeys / defeatedBossIds
 * so the boss-altar row re-renders into the requested gate state.
 * Idempotent — re-running with the same inputs is a no-op.
 */
async function patchState(
  page: import('@playwright/test').Page,
  patch: Partial<MutableState>,
): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as {
      __gameStore?: { getState: () => unknown; setState: (s: unknown) => void };
    };
    const store = w.__gameStore;
    if (!store) throw new Error('rtf4: __gameStore not exposed by debug seed');
    const state = store.getState() as Record<string, unknown>;
    store.setState({ ...state, ...p });
  }, patch);
  await page.waitForTimeout(80);
}

test('rtf4 — boss-altar row phase-gate states (turn 1 / 4 / 6-sealed / 6-engageable)', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('rasc.dropHintSeen', '1'));
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  await expect(page.getByTestId('game-board')).toBeVisible();
  const row = page.getByTestId('boss-altar-row');
  await expect(row).toBeVisible();

  // 1. turn 1 (Stirring) — both altars phase-locked. The wild-boss-slot
  //    seed's bossKeys.sylvani = ['craghorn'] doesn't matter: the phase
  //    gate is checked first and BOTH slots render their phase-gated
  //    variants.
  await patchState(page, { turn: 1 });
  await expect(page.getByTestId('wild-boss-slot-dormant')).toBeVisible();
  await expect(page.getByTestId('region-boss-slot-phase-locked')).toBeVisible();
  await row.screenshot({
    path: '.screenshots/embertide-rtf4-turn1-both-phase-locked.png',
    animations: 'disabled',
  });

  // 2. turn 4 (Rising) — wild slot is engageable; region slot still
  //    phase-locked because the Boss phase hasn't started yet.
  await patchState(page, { turn: 4 });
  await expect(page.getByTestId('wild-boss-slot')).toBeVisible();
  await expect(page.getByTestId('region-boss-slot-phase-locked')).toBeVisible();
  await row.screenshot({
    path: '.screenshots/embertide-rtf4-turn4-mixed.png',
    animations: 'disabled',
  });

  // 3. turn 6 (Boss) — wild slot engageable; region slot SEALED with
  //    the wild-boss-key gate (no bossKeys populated for sylvani).
  await patchState(page, {
    turn: 6,
    bossKeys: {
      sylvani: [],
      'emberpeak': [],
      maren: [],
      'hollow-shrine': [],
      'dune-sanctum': [],
      'gilded-cage': [],
    },
  });
  await expect(page.getByTestId('wild-boss-slot')).toBeVisible();
  // SEALED renders under the `region-boss-slot` testId (the
  // BossAltarLocked sibling reuses it for back-compat).
  await expect(page.getByTestId('region-boss-slot')).toHaveAttribute('data-locked', 'true');
  await expect(page.getByTestId('boss-altar-pane-locked-glyph')).toBeVisible();
  await row.screenshot({
    path: '.screenshots/embertide-rtf4-turn6-sealed.png',
    animations: 'disabled',
  });

  // 4. turn 6 (Boss) — wild boss cleared (defeatedBossIds + bossKeys
  //    populated). Region slot engageable; wild slot shows cleared
  //    placeholder.
  await patchState(page, {
    turn: 6,
    defeatedBossIds: ['craghorn'],
    bossKeys: {
      sylvani: ['craghorn'],
      'emberpeak': [],
      maren: [],
      'hollow-shrine': [],
      'dune-sanctum': [],
      'gilded-cage': [],
    },
  });
  // Wild slot renders cleared (testId stays `wild-boss-slot`).
  await expect(page.getByTestId('wild-boss-slot')).toHaveAttribute('data-disabled', 'true');
  // Region slot is now engageable (BUTTON, data-locked="false").
  const region = page.getByTestId('region-boss-slot');
  await expect(region).toHaveAttribute('data-locked', 'false');
  await expect(region).toHaveAttribute('data-disabled', 'false');
  await row.screenshot({
    path: '.screenshots/embertide-rtf4-turn6-engageable.png',
    animations: 'disabled',
  });
});
