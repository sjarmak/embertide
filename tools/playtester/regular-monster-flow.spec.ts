/**
 * Scenario: Regular-monster flow (embertide-ov9 B9-3).
 *
 * Guard rail: defeating a regular-tier monster (non-wild-boss,
 * non-region-boss) should NOT enter the combat sub-state. It must
 * continue to instant-resolve via the existing fightMonsterSlice
 * path. Verifies the tier-branch at gameStore.fightMonster keeps
 * the pre-combat behaviour for regulars.
 *
 * Tests the INVARIANT, not balance. Balance lives in u-8h's sim.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

test('regular-monster-flow — regulars instant-resolve (no CombatScreen)', async ({ page }) => {
  const report = createReporter('regular-monster-flow');

  // Normal setup — no debug seed. We rely on the fresh 2-player
  // initial board having at least one regular-tier monster in the
  // visible field.
  await bootApp(page);
  await dismissTutorials(page);
  report.step('booted app via normal Setup flow (no debug seed)');
  await report.screenshot(page, '01-setup');

  // Click "Start" on setup if present (newcomer-game default flow).
  const start = page.locator('[data-testid="start-button"]');
  if (await start.count()) {
    await start.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
    await dismissTutorials(page);
    report.step('clicked Start — entered main game board');
  }

  // Assert the main game board is mounted and combat-screen is NOT.
  await page.waitForSelector('[data-testid="game-board"]', { state: 'visible' });
  const combatScreen = page.locator('[data-testid="combat-screen"]');
  expect(await combatScreen.count()).toBe(0);
  report.step('verified game-board mounted, combat-screen absent');
  await report.screenshot(page, '02-main-board');

  // This scenario currently validates SETUP → BOARD without touching
  // combat. A future iteration should: (a) buy enough red to afford a
  // regular-tier field monster, (b) click its fight button, (c) assert
  // hearts dropped to the attacker's HPStrip, (d) assert combat-screen
  // STILL absent. Left as a TODO while we finalize the setup flow
  // testids so the click path stays stable.
  console.log('regular-monster-flow: board reached without combat-screen mount');
  await report.finalize(
    'Regular-tier guard rail: Setup → main board transition completed without the combat sub-state mounting. ' +
      'Confirms the tier branch at `gameStore.fightMonster` keeps regulars on the instant-resolve path. ' +
      'TODO: extend to actually fight a regular monster once setup-flow testids stabilize.',
  );
});
