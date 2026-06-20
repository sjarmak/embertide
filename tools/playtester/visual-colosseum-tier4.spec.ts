/**
 * Visual-regression: Colosseum tier-4 backdrop + portrait composite
 * (embertide-mvvw — bcq8 extension once wacl widened TierId to
 * include tier-4 + authored tier4.ts roster).
 *
 * Boots `?debug=colosseum-tier4` (Ossiarch — first entry in
 * TIER_4_ROSTER, mirrors the tier1/tier2 first-of-roster pick) so
 * CombatScreen resolves the tier-4 colosseum raster
 * (cathedral_colosseum_bg_tier4_001.webp) behind the boss portrait.
 * Captures the full combat surface so the committed baseline serves as
 * pixel-consistency evidence that tier-4 art governance + readability
 * land at parity with tier1/tier2/tier5.
 *
 * Tolerance: 5% (mirrors visual-combat-sylvani.spec.ts) — covers AA/font
 * variance across Playwright environments. Ossiarch HP=36 has a 2-digit
 * count (vs craghorn HP=14 = 2-digit; trinity-aurogax HP=60 = 2-digit), so
 * digit-count drift is not expected to push past 5%; if CI reveals
 * drift, tighten the locator (clip out the HP row) before relaxing.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-colosseum-tier4 — ossiarch portrait on tier-4 backdrop matches baseline', async ({
  page,
}) => {
  await bootApp(page, { debug: 'colosseum-tier4' });
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
    'colosseum-tier4.png',
    { maxDiffPixelRatio: 0.05, animations: 'disabled' },
  );
});
