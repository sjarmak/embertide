/**
 * Visual capture of the combat-screen layout (embertide-p1rx).
 *
 * Boots ?debug=craghorn so the app drops directly into a Sylvani wild-boss
 * combat with a clean fresh state. Captures a full-viewport screenshot
 * for visual review of the bottom-of-screen UI clipping issue.
 */

import { test, expect } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('p1rx: combat layout — empty battlefield, full hand, End Turn visible', async ({ page }) => {
  await bootApp(page, { debug: 'craghorn' });
  await dismissTutorials(page);
  const stage = page.locator('[data-testid="combat-boss-stage"]');
  await expect(stage).toBeVisible();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: '.screenshots/p1rx-combat-layout.png',
    fullPage: false,
  });
});
