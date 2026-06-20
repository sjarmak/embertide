/**
 * One-off screenshot capture for embertide-7g0n.
 *
 * Boots the play board at 1280×800 and screenshots the cathedral
 * title strip alone so the new continuous edge ornament is visible
 * without competing detail. The four corner trefoil cornices are
 * gone; the strip should now read as cream parchment ground + 2px
 * gold border + a faded beige/gold tracery line along the top and
 * bottom edges that quiets in the centre.
 *
 * NOT run in CI — used ad-hoc during the polish pass.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test.use({ viewport: { width: 1280, height: 800 } });

test('7g0n — title strip continuous edge ornament (no corner pips)', async ({ page }) => {
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);

  const strip = page.getByTestId('cathedral-title-strip');
  await expect(strip).toBeVisible();

  // Tight crop: just the title strip.
  await strip.screenshot({ path: '.screenshots/7g0n-title-strip.png' });
  // Full-board reference so we can see the strip in context.
  await page.screenshot({ path: '.screenshots/7g0n-fullboard-1280x800.png' });
});
