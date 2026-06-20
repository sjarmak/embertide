/**
 * Visual-regression: Colosseum tier-5 backdrop + portrait composite
 * (embertide-bcq8 — y3no UI-review follow-up).
 *
 * Boots `?debug=colosseum-tier5` (trinity-aurogax via colosseum-slot —
 * the capstone). Captures the full combat surface so the committed
 * baseline serves as pixel-consistency evidence for the readability
 * judgment recorded in `bd memories embertide-ui-reviewer-bcq8-*`.
 *
 * Tolerance: 5% (mirrors visual-combat-sylvani.spec.ts) — covers AA/font
 * variance across Playwright environments. Note (architect MEDIUM #3):
 * trinity-aurogax ships at HP=60 vs craghorn HP=14, so HP-text rendering
 * has higher digit count. If CI reveals drift exceeding 5%, bump this
 * spec to a tighter locator (clip out the HP row) before relaxing
 * tolerance.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-colosseum-tier5 — trinity-aurogax portrait on tier-5 backdrop matches baseline', async ({
  page,
}) => {
  await bootApp(page, { debug: 'colosseum-tier5' });
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
    'colosseum-tier5.png',
    { maxDiffPixelRatio: 0.05, animations: 'disabled' },
  );
});
