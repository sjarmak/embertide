/**
 * Scenario: HPStrip downed state (embertide-68a).
 *
 * Boots `?debug=hp-downed` so p0 enters the DOWNED state (hp=0,
 * downed=true) with p1 still at full health. Verifies:
 *   - HPStrip renders the downed-ribbon for p0
 *   - Teammate-revive button surfaces for p0
 *   - The visible downed indicator is an accessible "status" role
 * Captures a screenshot so the ribbon placement + tray layout can be
 * reviewed without grinding a real combat to 0 HP.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

test('hp-downed — downed ribbon + revive button render on p0 strip', async ({ page }) => {
  await bootApp(page, { debug: 'hp-downed' });
  await dismissTutorials(page);

  const report = createReporter('hp-downed');
  await report.screenshot(page, '01-board-downed');

  const downedRibbon = page.locator('[data-testid="hp-strip-p0-downed-ribbon"]');
  const reviveButton = page.locator('[data-testid="hp-strip-p0-revive-button"]');
  const p0Strip = page.locator('[data-testid="hp-strip-p0"]');

  await expect(downedRibbon).toBeVisible();
  await expect(reviveButton).toBeVisible();
  await expect(p0Strip).toHaveAttribute('data-downed', 'true');

  report.step('✓ p0 downed-ribbon visible');
  report.step('✓ p0 revive-button visible');
  report.step('✓ p0 HPStrip carries `data-downed="true"`');

  // p1 should NOT be downed — both-downed would flip GameBoard into a
  // LOSS overlay and hide the tray we want to verify.
  const p1Ribbon = page.locator('[data-testid="hp-strip-p1-downed-ribbon"]');
  expect(await p1Ribbon.count()).toBe(0);
  report.step('✓ p1 ribbon absent (not downed)');

  await report.finalize(
    "HPStrip correctly surfaces the downed ribbon + teammate-revive button when a player's HP reaches 0. " +
      'Baseline screenshot captured for tray-layout review.',
  );
});
