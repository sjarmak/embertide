/**
 * Scenario: Non-Sylvani zone theming (embertide-68a).
 *
 * Boots `?debug=zone-emberpeak` and `?debug=zone-temple` in
 * turn to verify the non-default zones render their bespoke rasters
 * + theme hints. Sylvani (starting zone) is already covered by the
 * default boot flow in every other playtester scenario, so this
 * spec focuses on the two zones that players can only reach by
 * beating a region boss.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

test('zone-emberpeak — zone cell + raster render for the volcanic zone', async ({ page }) => {
  await bootApp(page, { debug: 'zone-emberpeak' });
  await dismissTutorials(page);

  const report = createReporter('zone-emberpeak');
  await report.screenshot(page, '01-zone-emberpeak');

  const cell = page.locator('[data-testid="zone-cell-emberpeak"]');
  const raster = page.locator('[data-testid="zone-raster-emberpeak"]');

  await expect(cell).toBeVisible();
  await expect(raster).toBeVisible();
  report.step('✓ `zone-cell-emberpeak` mounted');
  report.step('✓ `zone-raster-emberpeak` rendered');

  await report.finalize(
    'Emberpeak zone theme mounts correctly when currentZone === "emberpeak". ' +
      'Visual regression for the volcanic palette is covered by visual-combat-emberpeak.spec.ts.',
  );
});

test('zone-temple — zone cell + raster render for Gilded Cage', async ({ page }) => {
  await bootApp(page, { debug: 'zone-temple' });
  await dismissTutorials(page);

  const report = createReporter('zone-temple');
  await report.screenshot(page, '01-zone-temple');

  const cell = page.locator('[data-testid="zone-cell-gilded-cage"]');
  const raster = page.locator('[data-testid="zone-raster-gilded-cage"]');

  await expect(cell).toBeVisible();
  await expect(raster).toBeVisible();
  report.step('✓ `zone-cell-gilded-cage` mounted');
  report.step('✓ `zone-raster-gilded-cage` rendered');

  await report.finalize(
    'Gilded Cage zone theme mounts correctly when currentZone === "gilded-cage". ' +
      'Visual regression for the sanctum palette is covered by visual-combat-temple.spec.ts.',
  );
});
