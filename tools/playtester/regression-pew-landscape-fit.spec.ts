/**
 * Regression spec for embertide-pew — landscape-mobile playability.
 *
 * The game is desktop-tuned; on a phone held in landscape the full board
 * (always-row + market + play area + player trays + right boss rail)
 * overflowed the viewport and forced a vertical scroll. Measured before
 * the fix at 852x393: document.scrollHeight = 563px in a 393px viewport
 * (170px of overflow), because the dedicated phone media block
 * (`@media (orientation: landscape) and (height <= 500px)`) was losing
 * the cascade to two `!important` laptop blocks (`width <= 1100px` and
 * `height <= 760px`) that also matched the phone viewports.
 *
 * Acceptance (bead embertide-pew):
 *   - Full board fits 852x393 (iPhone 15) and 932x430 (Pro Max) landscape
 *     with NO vertical scroll (and no horizontal scroll).
 *   - All interactive controls keep the 44px tap-target floor — asserted
 *     here on the End Turn button (`.board-side-end-turn`), the primary
 *     turn-commit CTA.
 *
 * Oracle: `document.documentElement.scrollHeight <= window.innerHeight`
 * (and the same on the width axis), within a small sub-pixel tolerance.
 * This runs in a real layout engine (Playwright) — a jsdom unit test
 * cannot measure this because jsdom does no layout.
 *
 * Output:
 *   .screenshots/pew-landscape-<W>x<H>.png
 *   stdout: per-viewport scroll/inner deltas + band rects for diagnosis.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

// The two acceptance phones, both held in landscape (width > height,
// height <= 500 → the dedicated phone media block applies).
const VIEWPORTS = [
  { name: 'iphone-15', w: 852, h: 393 },
  { name: 'iphone-15-pro-max', w: 932, h: 430 },
] as const;

// Board states that stress the layout differently. `hp-downed` shows
// dormant boss slots + empty discard/void piles (early game). The
// `wild-boss-slot` seed makes a boss slot ENGAGEABLE, so the right rail
// renders the full boss stamp (.boss-altar-pane-art + name + HP) — the
// tallest the boss rail gets on the main board, and the worst case for
// rail overflow. Both must fit; a fix that only checked the dormant
// state would miss the engaged-boss overflow.
const SEEDS = [
  { seed: 'hp-downed', label: 'dormant-board' },
  { seed: 'wild-boss-slot', label: 'engaged-boss' },
] as const;

// Sub-pixel + scrollbar-gutter slack. Kept tight (2px) on purpose: a
// returning band is >=16px tall, so this tolerance cannot mask a real
// regression while still absorbing devicePixelRatio rounding.
const TOL = 2;

const TOUCH_MIN = 44;

// Bands logged on failure so a future regression points straight at the
// column/element that grew, without re-running a manual probe.
const BANDS: Record<string, string> = {
  gameBoard: '[data-testid="game-board"]',
  alwaysRow: '.always-row-strip',
  boardGrid: '.board-grid',
  boardMain: '.board-main',
  marketRow: '[data-testid="market-row"]',
  playZones: '.play-zones',
  handRow: '.hand-row',
  traysRow: '.trays-row',
  boardSide: '.board-side',
  bossAltarRow: '[data-testid="boss-altar-row"]',
  crystalEmbertide: '[data-testid="crystal-embertide-pane"]',
  endTurn: '.board-side-end-turn',
};

for (const s of SEEDS) {
  for (const v of VIEWPORTS) {
    test(`pew — full board fits ${v.name} landscape (${v.w}x${v.h}) [${s.label}] without scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: v.w, height: v.h });
      await bootApp(page, { debug: s.seed });
      await dismissTutorials(page);

      const metrics = await page.evaluate(() => ({
        scrollH: document.documentElement.scrollHeight,
        scrollW: document.documentElement.scrollWidth,
        innerH: window.innerHeight,
        innerW: window.innerWidth,
      }));

      const bandRects: Record<string, { top: number; bottom: number; height: number } | null> = {};
      for (const [name, sel] of Object.entries(BANDS)) {
        const handle = page.locator(sel).first();
        if ((await handle.count()) === 0) {
          bandRects[name] = null;
          continue;
        }
        const box = await handle.boundingBox();
        bandRects[name] = box
          ? { top: box.y, bottom: box.y + box.height, height: box.height }
          : null;
      }

      console.log(`\n=== pew landscape ${v.name} ${v.w}x${v.h} [${s.label}] ===`);
      console.log(
        JSON.stringify(
          {
            viewport: `${v.w}x${v.h}`,
            seed: s.seed,
            metrics,
            overflowY: metrics.scrollH - metrics.innerH,
            overflowX: metrics.scrollW - metrics.innerW,
            bands: bandRects,
          },
          null,
          2,
        ),
      );

      await page.screenshot({
        path: `.screenshots/pew-landscape-${s.label}-${v.w}x${v.h}.png`,
        fullPage: false,
      });

      // Primary acceptance: no vertical scroll, no horizontal scroll.
      expect(
        metrics.scrollH,
        `vertical overflow ${metrics.scrollH - metrics.innerH}px at ${v.w}x${v.h} [${s.label}]`,
      ).toBeLessThanOrEqual(metrics.innerH + TOL);
      expect(
        metrics.scrollW,
        `horizontal overflow ${metrics.scrollW - metrics.innerW}px at ${v.w}x${v.h} [${s.label}]`,
      ).toBeLessThanOrEqual(metrics.innerW + TOL);

      // Tap-target floor on the End Turn CTA must survive the compaction.
      // Hard-assert presence first so a vanished button fails loudly rather
      // than skipping the check. The 44px floor is asserted directly (the
      // inline END_TURN_STYLE pins 88×44); a tiny epsilon absorbs only
      // sub-pixel rounding, NOT a real sub-44 regression.
      const endTurn = page.locator('.board-side-end-turn').first();
      await expect(endTurn).toBeVisible();
      const box = await endTurn.boundingBox();
      expect(box, 'end-turn button has a layout box').not.toBeNull();
      if (box) {
        expect(box.width, `End Turn width ${box.width} < ${TOUCH_MIN}`).toBeGreaterThanOrEqual(
          TOUCH_MIN - 0.5,
        );
        expect(box.height, `End Turn height ${box.height} < ${TOUCH_MIN}`).toBeGreaterThanOrEqual(
          TOUCH_MIN - 0.5,
        );
      }
    });
  }
}
