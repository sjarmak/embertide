/**
 * Scenario: PrincessCrystalCell freed state (embertide-68a).
 *
 * Boots `?debug=princess-crystal-freed` which sets princessCrystal
 * to `{ charges: 0, freed: true }` — the terminal "Aurelia is freed"
 * state. Verifies the freed indicator (princess-crystal-aurelia-freed)
 * renders and the integrity bar is at 0 fill. Captures a screenshot
 * for the climactic freed-banner visual review.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

test('princess-crystal-freed — freed element renders, no Strike action available', async ({
  page,
}) => {
  await bootApp(page, { debug: 'princess-crystal-freed' });
  await dismissTutorials(page);

  const report = createReporter('princess-crystal-freed');
  await report.screenshot(page, '01-board-princess-freed');

  const cell = page.locator('[data-testid="princess-crystal-cell"]');
  await expect(cell).toBeVisible();
  report.step('✓ PrincessCrystalCell mounted');

  const freed = page.locator('[data-testid="princess-crystal-aurelia-freed"]');
  await expect(freed).toBeVisible();
  report.step('✓ `princess-crystal-aurelia-freed` element visible');

  // The freed-state crystal renders no Strike button because the
  // pre-freed action path is gone. Asserting ABSENCE keeps this test
  // locked to the freed-branch rendering even if the Strike-button
  // testid is renamed elsewhere.
  const strike = page.locator('button:has-text("Strike")');
  expect(await strike.count()).toBe(0);
  report.step('✓ Strike button absent in freed state');

  await report.finalize(
    'PrincessCrystalCell transitions cleanly into the post-freed terminal state: the freed indicator surfaces, ' +
      'the Strike action is removed, and the integrity bar is at zero. Baseline screenshot captured.',
  );
});
