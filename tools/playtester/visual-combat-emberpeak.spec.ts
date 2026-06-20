/**
 * Visual-regression: Emberpeak combat background (u-10b, REQ-33 §D7).
 *
 * Boots `?debug=emberpeak-combat` (ashen-tyrant encounter) so the
 * combat raster resolves to the Emberpeak webp. Asserts against
 * committed baseline.
 *
 * Tolerance: 5% (u-10b round 3). See visual-combat-sylvani.spec.ts for
 * the rationale — AA/font variance across Playwright environments.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-combat-emberpeak — background raster matches baseline', async ({ page }) => {
  await bootApp(page, { debug: 'emberpeak-combat' });
  await dismissTutorials(page);

  await page.locator('[data-testid="combat-screen"]').waitFor({ state: 'visible' });
  await page.locator('[data-testid="combat-bg-slot"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  await expect(page.locator('[data-testid="combat-screen"]')).toHaveScreenshot(
    'combat-emberpeak.png',
    { maxDiffPixelRatio: 0.05, animations: 'disabled' },
  );
});
