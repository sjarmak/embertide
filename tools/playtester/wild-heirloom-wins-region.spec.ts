/**
 * Scenario: Wild heirloom feeds a region win (REQ-32 u-9e).
 *
 * Drives the "wild-is-helpful-prep" design intent empirically: engage
 * the Sylvani wild (Craghorn) → WIN → receive Craghorn Tusk → engage region
 * (Broodmaw) → survive the combat with the heirloom in the combat deck.
 *
 * Structural assertions:
 *   - Craghorn Tusk lands in a player's items after the wild combat.
 *   - Region combat terminates cleanly (not hung).
 *   - Heirloom PERSISTS through the region combat (items are not
 *     consumed by combat-resolve; they ride along in the combat deck).
 *
 * Balance is NOT asserted — the scenario demonstrates the engagement +
 * persistence plumbing, not that the heirloom turns a losing combat
 * into a winning one. That demonstration lives in the balance sim.
 */

import { expect, test } from '@playwright/test';
import {
  bootApp,
  clickFirstCard,
  combatEnded,
  dismissTutorials,
  passTurn,
  snapshot,
} from './harness';

const MAX_ROUNDS = 40;

async function runCombatToTerminal(
  page: import('@playwright/test').Page,
  label: string,
): Promise<void> {
  let rounds = 0;
  while (!(await combatEnded(page)) && rounds < MAX_ROUNDS) {
    for (let i = 0; i < 3; i += 1) {
      const s = await snapshot(page);
      if (s.ended) break;
      if (s.plays[0] >= s.plays[1]) break;
      if (s.handSize === 0) break;
      await clickFirstCard(page);
      await dismissTutorials(page);
    }
    if (await combatEnded(page)) break;
    await passTurn(page);
    await dismissTutorials(page);
    rounds += 1;
  }
  console.log(`[${label}] ended after ${rounds} rounds`);
  expect(rounds, `${label} must terminate within ${MAX_ROUNDS} rounds`).toBeLessThan(MAX_ROUNDS);
}

async function readHeirloomOwnership(
  page: import('@playwright/test').Page,
): Promise<boolean | null> {
  return page.evaluate(() => {
    const store = (
      globalThis as unknown as {
        __gameStore?: {
          getState(): {
            players: {
              items: { id: string; baseId?: string }[];
            }[];
          };
        };
      }
    ).__gameStore;
    if (!store) return null;
    // Heirlooms are minted fresh (id `craghorn-tusk-<N>`, baseId `craghorn-tusk`)
    // so prefix / baseId match both hit.
    return store
      .getState()
      .players.some((p) =>
        p.items.some((it) => it.baseId === 'craghorn-tusk' || it.id.startsWith('craghorn-tusk')),
      );
  });
}

test('wild-heirloom-wins-region — heirloom acquired + persists through region combat', async ({
  page,
}) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  // Phase 1 — engage wild (Craghorn).
  const wildSlot = page.locator('[data-testid="wild-boss-slot"]');
  await expect(wildSlot).toBeVisible();
  await wildSlot.click();
  await dismissTutorials(page);
  await expect(page.locator('[data-testid="combat-screen"]')).toBeVisible();

  await runCombatToTerminal(page, 'wild-craghorn');

  // Phase 2 — verify heirloom landed.
  const beforeRegion = await readHeirloomOwnership(page);
  if (beforeRegion !== null) {
    expect(beforeRegion, 'Craghorn Tusk must be in one player items after wild defeat').toBe(true);
  } else {
    console.log(
      'wild-heirloom-wins-region: window.__gameStore not exposed; skipping heirloom read',
    );
  }

  // Phase 3 — engage region (Broodmaw). Heirloom should be in the combat
  // deck because items (including heirlooms) feed into buildCombatDeck
  // from each player's items + inPlay zones.
  await dismissTutorials(page);
  const regionSlot = page.locator('[data-testid="region-boss-slot"]');
  await expect(regionSlot).toBeVisible();
  await regionSlot.click();
  await dismissTutorials(page);
  await expect(page.locator('[data-testid="combat-screen"]')).toBeVisible();

  await runCombatToTerminal(page, 'region-broodmaw');

  // Phase 4 — heirloom persists regardless of combat outcome. Items are
  // not consumed by COMBAT_RESOLVE_WIN / _LOSS.
  const afterRegion = await readHeirloomOwnership(page);
  if (afterRegion !== null && beforeRegion !== null) {
    expect(
      afterRegion,
      'Craghorn Tusk must still be in a player items after region combat resolves',
    ).toBe(beforeRegion);
  }
});
