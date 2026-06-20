/**
 * One-off measurement probe for embertide-2u9w.
 *
 * User feedback 2026-04-26: "the bottom is cut off." The bead's
 * description listed band budgets when play-zones was capped at 84px,
 * but lqg6 (2026-04-26) bumped play-zones max-height 130 → 156 to fit
 * the DiscardPile pane. That delta likely pushes total board height
 * over the 800px viewport budget at 1280×800. This probe captures
 * actual band bottom-positions + heights via getBoundingClientRect()
 * at the three canonical viewports (1280×800, 1366×768, 1920×1080)
 * and saves full-page screenshots so the implementer can see the
 * exact overflow.
 *
 * NOT run in CI — used ad-hoc to source the fix.
 *
 * Output:
 *   .screenshots/2u9w-bottom-cutoff-{1280x800,1366x768,1920x1080}.png
 *   stdout: per-viewport JSON of band rects + total board bottom
 */

import { test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORTS = [
  { w: 1280, h: 800 },
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
] as const;

const SELECTORS: Record<string, string> = {
  gameBoard: '[data-testid="game-board"]',
  alwaysRow: '[data-testid="always-available-row"]',
  marketRow: '[data-testid="market-row"]',
  playZones: '.play-zones',
  handRow: '.hand-row',
  hand: '[data-testid="hand"]',
  traysRow: '.trays-row',
  trays: '.board-main .trays',
};

for (const v of VIEWPORTS) {
  test(`2u9w — band heights at ${v.w}x${v.h}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await bootApp(page, { debug: 'embertide-filled' });
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
    console.log(`\n=== 2u9w probe ${v.w}x${v.h} ===`);
    console.log(JSON.stringify(summary, null, 2));

    await page.screenshot({
      path: `.screenshots/2u9w-bottom-cutoff-${v.w}x${v.h}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `.screenshots/2u9w-fullpage-${v.w}x${v.h}.png`,
      fullPage: true,
    });
  });
}
