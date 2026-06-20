/**
 * Scenario: Region-slot gating (gm0.12 REVERSE-Q8 rewrite).
 *
 * Pre-gm0.12 this spec asserted the region slot was engageable directly
 * at boot (REQ-32 / u-9a: no wild-clear gate). gm0.12 reverses that
 * decision — the region slot is SEALED until the zone's wild-boss key
 * has dropped.
 *
 * The `wild-boss-slot` debug seed pre-populates `bossKeys.sylvani` so
 * the visual-altar-row regression baseline stays stable. To exercise
 * the locked-door transition, this spec uses the `__gameStore` window
 * hook to temporarily clear the keys, asserts SEALED, restores the
 * key, asserts UNLOCKED, and finally taps the region slot to confirm
 * region-boss reachability via the new gating path.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('region-slot-gating — SEALED pre-key, UNLOCKED post-key (gm0.12)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const wildSlot = page.locator('[data-testid="wild-boss-slot"]');
  const regionSlot = page.locator('[data-testid="region-boss-slot"]');
  await expect(wildSlot).toBeVisible();
  await expect(regionSlot).toBeVisible();

  // Step 1 — force the locked branch by clearing the key that the
  // debug seed pre-populated. Proves the gm0.12 gate hides Broodmaw
  // behind a SEALED placeholder with `data-locked="true"`.
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          bossKeys: Record<string, readonly string[]>;
        };
        setState(next: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return;
    const state = store.getState();
    store.setState({
      ...state,
      bossKeys: { ...state.bossKeys, sylvani: [] },
    });
  });
  await expect(regionSlot).toHaveAttribute('data-locked', 'true');
  await expect(regionSlot).toHaveAttribute('data-disabled', 'true');

  // Step 2 — drop the key back in and confirm the slot unlocks.
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          bossKeys: Record<string, readonly string[]>;
        };
        setState(next: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return;
    const state = store.getState();
    store.setState({
      ...state,
      bossKeys: { ...state.bossKeys, sylvani: ['craghorn'] },
    });
  });
  await expect(regionSlot).toHaveAttribute('data-locked', 'false');
  await expect(regionSlot).toHaveAttribute('data-disabled', 'false');

  // Step 3 — tapping the unlocked region slot mounts the combat
  // screen. Preserves the original "region-boss reachability" intent
  // via the new gating path.
  await regionSlot.click();
  await dismissTutorials(page);
  await expect(page.locator('[data-testid="combat-screen"]')).toBeVisible({
    timeout: 3_000,
  });
  console.log('region-slot-gating: region combat-screen mounted post-gate');
});
