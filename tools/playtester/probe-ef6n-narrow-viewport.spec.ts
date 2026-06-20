/**
 * Probe spec for embertide-ef6n.
 *
 * User report 2026-05-09 (C0B13JE7M35): "when it is resized the player
 * pane and discard and void sections end up lowering to be cut off at
 * the bottom". Sister bug to rz26 (right-rail cutoff) but on the
 * opposite axis — at narrow viewports the BOTTOM band (.trays-row =
 * .trays player panes + .trays-row-pile-column DiscardPile/VoidPane)
 * drops below the viewport bottom.
 *
 * This probe captures bounding rects for the suspect bands across
 * several viewport widths so we can see exactly where the breakpoint
 * is and which element overflows. No assertions — read the JSON output
 * to design the fix, then promote into a regression spec.
 *
 * Output: stdout JSON per viewport.
 */

import { test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

// Cover the acceptance matrix (1024..1920 widths, height >= 700)
// PLUS short-height variants where the user's "resize cut-off" symptom
// is most likely to land. The original probe at 1024x768/1280x800 etc.
// all read "visible" — the breakpoint shows up when height drops to
// the 700-720 floor or when wide+short ratios put the bottom band
// past 100dvh.
const VIEWPORTS = [
  { w: 1024, h: 700 },
  { w: 1024, h: 768 },
  { w: 1180, h: 700 },
  { w: 1180, h: 800 },
  { w: 1280, h: 720 },
  { w: 1280, h: 800 },
  { w: 1366, h: 720 },
  { w: 1366, h: 768 },
  { w: 1440, h: 720 },
  { w: 1440, h: 900 },
  { w: 1600, h: 720 },
  { w: 1600, h: 900 },
  { w: 1920, h: 720 },
  { w: 1920, h: 1080 },
] as const;

const SELECTORS: Record<string, string> = {
  appRoot: '.app-root',
  gameBoard: '[data-testid="game-board"]',
  boardGrid: '[data-testid="board-grid"]',
  boardMain: '.board-main',
  boardSide: '.board-side',
  marketRow: '[data-testid="market-row"]',
  playZones: '.play-zones',
  handRow: '.hand-row',
  traysRow: '.trays-row',
  traysPlate: '.board-main .trays',
  trayActive: '.tray-active',
  trayP1: '.trays > .tray:nth-child(1)',
  trayP2: '.trays > .tray:nth-child(2)',
  pileColumn: '[data-testid="trays-row-pile-column"]',
  discardPile: '[data-testid="discard-pile"]',
  voidPane: '[data-testid="void-pane"]',
  endTurn: '[data-testid="end-turn"]',
};

for (const v of VIEWPORTS) {
  test(`ef6n probe — bottom band visibility at ${v.w}x${v.h}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await bootApp(page, { debug: 'hp-downed' });
    await dismissTutorials(page);

    const rects: Record<
      string,
      { top: number; bottom: number; height: number; width: number } | null
    > = {};
    for (const [name, sel] of Object.entries(SELECTORS)) {
      const handle = page.locator(sel).first();
      const count = await handle.count();
      if (count === 0) {
        rects[name] = null;
        continue;
      }
      const box = await handle.boundingBox();
      rects[name] = box
        ? {
            top: box.y,
            bottom: box.y + box.height,
            height: box.height,
            width: box.width,
          }
        : null;
    }

    const winInner = await page.evaluate(() => window.innerHeight);

    const summarize = (name: string) => {
      const r = rects[name];
      if (!r) return { name, present: false };
      const clippedPx = r.bottom - winInner;
      return {
        name,
        present: true,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        clippedPx: Math.round(clippedPx),
        visible: r.bottom <= winInner,
      };
    };

    const summary = {
      viewport: `${v.w}x${v.h}`,
      windowInner: winInner,
      bands: {
        traysRow: summarize('traysRow'),
        traysPlate: summarize('traysPlate'),
        trayP1: summarize('trayP1'),
        trayP2: summarize('trayP2'),
        pileColumn: summarize('pileColumn'),
        discardPile: summarize('discardPile'),
        voidPane: summarize('voidPane'),
        endTurn: summarize('endTurn'),
        boardGrid: summarize('boardGrid'),
      },
    };
    console.log(`\n=== ef6n probe ${v.w}x${v.h} ===`);
    console.log(JSON.stringify(summary, null, 2));

    await page.screenshot({
      path: `.screenshots/ef6n-bottom-band-${v.w}x${v.h}.png`,
      fullPage: false,
    });
  });
}
