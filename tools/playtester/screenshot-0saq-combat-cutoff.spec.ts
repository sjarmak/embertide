/**
 * One-off measurement probe for embertide-0saq.
 *
 * User feedback 2026-05-02 (post-2u9w): "the boss view UI is still cut
 * off (needs to be zoomed out at 90% still)". 2u9w landed compaction
 * on the main GameBoard — the combat (boss-view) screen is a SEPARATE
 * surface (CombatScreen + CombatBossStage + CombatBattlefield +
 * CombatHand) and still overflows.
 *
 * This probe captures actual band bottom-positions + heights via
 * getBoundingClientRect() at the three canonical viewports
 * (1280×800, 1366×768, 1920×1080) and saves full-page + visible-area
 * screenshots so the implementer can see the exact overflow.
 *
 * NOT run in CI — used ad-hoc to source the fix.
 *
 * Output:
 *   .screenshots/0saq-combat-cutoff-{1280x800,1366x768,1920x1080}.png
 *   .screenshots/0saq-combat-fullpage-{1280x800,1366x768,1920x1080}.png
 *   stdout: per-viewport JSON of band rects + total combat-screen bottom
 */

import { test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORTS = [
  { w: 1280, h: 800 },
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
  // Effective viewport at "1280x800 OS screen with a browser" — chrome (~74px
  // tab+address bar) + OS taskbar (~40px). The user reports needing 90% zoom
  // at their normal browser size; this band approximates what they're seeing.
  { w: 1280, h: 686 },
  // 90% of a 1280x800 viewport — emulates the user's "zoom out 90%" workaround
  // to validate that the same pixels fit when scaled back.
  { w: 1280, h: 720 },
] as const;

const SELECTORS: Record<string, string> = {
  combatScreen: '[data-testid="combat-screen"]',
  bossStage: '[data-testid="combat-boss-stage"]',
  battlefield: '[data-testid="combat-battlefield"]',
  hand: '[data-testid="combat-hand"]',
  passButton: '[data-testid="combat-pass-turn"]',
  combatLog: '[data-testid="combat-log"]',
};

for (const v of VIEWPORTS) {
  test(`0saq — combat-screen band heights at ${v.w}x${v.h}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await bootApp(page, { debug: 'craghorn' });
    await dismissTutorials(page);

    const rects: Record<string, { top: number; bottom: number; height: number } | null> = {};
    for (const [name, sel] of Object.entries(SELECTORS)) {
      const handle = await page.locator(sel).first();
      const count = await handle.count();
      if (count === 0) {
        rects[name] = null;
        continue;
      }
      const box = await handle.boundingBox();
      rects[name] = box ? { top: box.y, bottom: box.y + box.height, height: box.height } : null;
    }

    const bodyBottom = await page.evaluate(() => document.body.scrollHeight);
    const winInner = await page.evaluate(() => window.innerHeight);
    const cutoff = bodyBottom - winInner;

    const summary = {
      viewport: `${v.w}x${v.h}`,
      windowInner: winInner,
      bodyScrollHeight: bodyBottom,
      cutoffPx: cutoff,
      bands: rects,
    };
    console.log(`\n=== 0saq combat probe ${v.w}x${v.h} ===`);
    console.log(JSON.stringify(summary, null, 2));

    await page.screenshot({
      path: `.screenshots/0saq-combat-cutoff-${v.w}x${v.h}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `.screenshots/0saq-combat-fullpage-${v.w}x${v.h}.png`,
      fullPage: true,
    });
  });
}
