/**
 * One-off measurement probe + regression spec for embertide-ef6n.
 *
 * User report 2026-05-09 (C0B13JE7M35): "when it is resized the player
 * pane and discard and void sections end up lowering to be cut off at
 * the bottom." On narrow-viewport resize the player tray + discard +
 * void piles slide down past the viewport bottom.
 *
 * The 2u9w + rz26 fixes addressed the right rail; the bottom stack
 * (.trays-row containing PlayerTray plate + DiscardPile + VoidPane)
 * may still grow past the viewport at narrow widths.
 *
 * Sweeps the canonical narrow-viewport widths (1024 / 1180 / 1280 /
 * 1366 / 1920) at h=800 and asserts that each of:
 *   - player-tray-p0 / player-tray-p1
 *   - discard-pile
 *   - void-pane
 * has `bounding-rect.bottom <= window.innerHeight`. Fails loud if any
 * surface clips below the viewport.
 *
 * Output:
 *   .screenshots/ef6n-bottom-stack-<W>x<H>.png
 *   stdout: per-viewport JSON of bottom rects + overflow deltas
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

// Cover the bead's stated acceptance matrix: viewport widths 1024..1920
// at any height >= 700. Pairs each width with a "tight" h variant
// (700/720 — the floor) and the "comfortable" h actually shipped on
// laptops at that width. The tight pairs are the most likely regression
// surfaces because the bottom stack has the least vertical headroom.
const VIEWPORTS = [
  { w: 1024, h: 700 },
  { w: 1024, h: 800 },
  { w: 1180, h: 700 },
  { w: 1180, h: 800 },
  { w: 1280, h: 720 },
  { w: 1280, h: 800 },
  { w: 1366, h: 720 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1600, h: 900 },
  { w: 1920, h: 1080 },
] as const;

const TARGETS: Record<string, string> = {
  playerTrayP0: '[data-testid="player-tray-p0"]',
  playerTrayP1: '[data-testid="player-tray-p1"]',
  discardPile: '[data-testid="discard-pile"]',
  voidPane: '[data-testid="void-pane"]',
};

const CONTEXT_SELECTORS: Record<string, string> = {
  appRoot: '.app-root',
  gameBoard: '[data-testid="game-board"]',
  boardGrid: '.board-grid',
  boardMain: '.board-main',
  traysRow: '.trays-row',
  trays: '.board-main .trays',
  traysRowPileColumn: '[data-testid="trays-row-pile-column"]',
};

for (const v of VIEWPORTS) {
  test(`ef6n — bottom-stack inside viewport at ${v.w}x${v.h}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await bootApp(page, { debug: 'hp-downed' });
    await dismissTutorials(page);

    const contextRects: Record<string, { top: number; bottom: number; height: number } | null> = {};
    for (const [name, sel] of Object.entries(CONTEXT_SELECTORS)) {
      const handle = page.locator(sel).first();
      if ((await handle.count()) === 0) {
        contextRects[name] = null;
        continue;
      }
      const box = await handle.boundingBox();
      contextRects[name] = box
        ? { top: box.y, bottom: box.y + box.height, height: box.height }
        : null;
    }

    const winInner = await page.evaluate(() => window.innerHeight);
    const targetRects: Record<
      string,
      { top: number; bottom: number; height: number; clippedPx: number } | null
    > = {};
    for (const [name, sel] of Object.entries(TARGETS)) {
      const handle = page.locator(sel).first();
      if ((await handle.count()) === 0) {
        targetRects[name] = null;
        continue;
      }
      const box = await handle.boundingBox();
      if (!box) {
        targetRects[name] = null;
        continue;
      }
      const bottom = box.y + box.height;
      targetRects[name] = {
        top: box.y,
        bottom,
        height: box.height,
        clippedPx: bottom - winInner,
      };
    }

    const summary = {
      viewport: `${v.w}x${v.h}`,
      windowInner: winInner,
      context: contextRects,
      targets: targetRects,
    };
    console.log(`\n=== ef6n probe ${v.w}x${v.h} ===`);
    console.log(JSON.stringify(summary, null, 2));

    await page.screenshot({
      path: `.screenshots/ef6n-bottom-stack-${v.w}x${v.h}.png`,
      fullPage: false,
    });

    // Hard assertions — the acceptance: each target's bottom <= viewport.
    for (const [name, rect] of Object.entries(targetRects)) {
      if (rect === null) continue;
      expect(
        rect.bottom,
        `${name} bottom ${rect.bottom} > viewport ${winInner} at ${v.w}x${v.h}`,
      ).toBeLessThanOrEqual(winInner);
    }
  });
}
