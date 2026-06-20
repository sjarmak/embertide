/**
 * Visual-regression: Colosseum tier-1 backdrop + portrait composite
 * (embertide-bcq8 — y3no UI-review follow-up).
 *
 * Boots `?debug=colosseum-tier1` (craghorn via colosseum-slot) so
 * CombatScreen resolves the tier-1 colosseum raster
 * (cathedral_colosseum_bg_tier1_001.webp) behind the boss portrait.
 * Captures the full combat surface so the committed baseline serves as
 * pixel-consistency evidence for the readability judgment recorded in
 * `bd memories embertide-ui-reviewer-bcq8-*`.
 *
 * Tolerance: 5% (mirrors visual-combat-sylvani.spec.ts) — covers AA/font
 * variance across Playwright environments.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-colosseum-tier1 — craghorn portrait on tier-1 backdrop matches baseline', async ({
  page,
}) => {
  await bootApp(page, { debug: 'colosseum-tier1' });
  await dismissTutorials(page);

  await page.locator('[data-testid="combat-screen"]').waitFor({ state: 'visible' });
  await page.locator('[data-testid="combat-bg-slot"]').waitFor({ state: 'visible' });
  // combat-boss-stage waitFor is colosseum-specific (sylvani/temple specs
  // omit it). Colosseum-slot entries dispatch via kind:'boss' and the
  // boss-stage portrait resolves async via illustrationForBaseId; without
  // this wait the screenshot can fire before the portrait socket renders.
  await page.locator('[data-testid="combat-boss-stage"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);

  await expect(page.locator('[data-testid="combat-screen"]')).toHaveScreenshot(
    'colosseum-tier1.png',
    { maxDiffPixelRatio: 0.05, animations: 'disabled' },
  );
});
