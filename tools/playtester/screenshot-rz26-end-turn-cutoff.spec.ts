/**
 * One-off measurement probe for embertide-rz26.
 *
 * User report 2026-05-08 (C0B13JE7M35): "when at 100% in the browser
 * UI the end turn button is out of view." Captures the End-Turn
 * button's position vs viewport at three canonical viewports
 * (1280×800, 1366×768, 1920×1080) for two GameBoard states:
 *
 *   1. hp-downed       — vanilla post-Setup state with one player downed
 *      (colosseum LOCKED → ColosseumEntryPane returns null)
 *   2. embertide-filled — same shape, all three Embertide shards lit
 *      (still LOCKED — exercises the same right-rail content path)
 *
 * The right rail stack is: BossAltarRow → CrystalEmbertidePane →
 * ColosseumEntryPane → EndTurnButton. The fix lives in
 * `app.css @media (width <= 1440px)` and shrinks the rail content
 * (boss-altar art 96 → 72, crystal art 120 → 96, embertide strip
 * max-width 132 → 108, paddings/gaps tightened) so the rail's
 * intrinsic height fits inside the available board-grid track.
 *
 * Asserts End-Turn's bottom edge stays at or above the viewport bottom
 * for every state × viewport combination. Hard-fails if the rail grows
 * past the available board-grid track again — the original user-
 * reported symptom.
 *
 * Output:
 *   .screenshots/rz26-end-turn-<state>-<W>x<H>.png
 *   stdout: per-state JSON of End-Turn rect + viewport bottom delta
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORTS = [
  { w: 1280, h: 800 },
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
] as const;

const SELECTORS: Record<string, string> = {
  appRoot: '.app-root',
  gameBoard: '[data-testid="game-board"]',
  boardGrid: '.board-grid',
  boardSide: '.board-side',
  boardSideCrystalRail: '.board-side-crystal-rail',
  bossAltarRow: '[data-testid="boss-altar-row"]',
  crystalEmbertidePane: '[data-testid="crystal-embertide-pane"]',
  princessCrystalArt: '.princess-crystal-art-surface',
  princessCrystalBar: '[data-testid="princess-crystal-integrity-bar"]',
  embertideHud: '.embertide-hud',
  embertideStrip: '[data-testid="embertide-strip"]',
  bossAltarArt: '.boss-altar-pane-art',
  colosseumEntryPane: '[data-testid="colosseum-entry-pane"]',
  endTurn: '[data-testid="end-turn"]',
};

const STATES = [
  { id: 'hp-downed', debug: 'hp-downed' },
  { id: 'embertide-filled', debug: 'embertide-filled' },
] as const;

for (const v of VIEWPORTS) {
  for (const state of STATES) {
    test(`rz26 — end-turn visibility at ${v.w}x${v.h} (${state.id})`, async ({ page }) => {
      await page.setViewportSize({ width: v.w, height: v.h });
      await bootApp(page, { debug: state.debug });
      await dismissTutorials(page);

      const rects: Record<string, { top: number; bottom: number; height: number } | null> = {};
      for (const [name, sel] of Object.entries(SELECTORS)) {
        const handle = page.locator(sel).first();
        const count = await handle.count();
        if (count === 0) {
          rects[name] = null;
          continue;
        }
        const box = await handle.boundingBox();
        rects[name] = box ? { top: box.y, bottom: box.y + box.height, height: box.height } : null;
      }

      const winInner = await page.evaluate(() => window.innerHeight);
      const endTurnRect = rects.endTurn;
      const clippedPx = endTurnRect ? endTurnRect.bottom - winInner : null;

      const summary = {
        state: state.id,
        viewport: `${v.w}x${v.h}`,
        windowInner: winInner,
        endTurnVisible: endTurnRect !== null && endTurnRect.bottom <= winInner,
        endTurnClippedPx: clippedPx,
        bands: rects,
      };
      console.log(`\n=== rz26 probe ${state.id} ${v.w}x${v.h} ===`);
      console.log(JSON.stringify(summary, null, 2));

      await page.screenshot({
        path: `.screenshots/rz26-end-turn-${state.id}-${v.w}x${v.h}.png`,
        fullPage: false,
      });

      // Hard regression assert. Pre-fix, End-Turn sat ~67px below the
      // viewport bottom at 1280×800 — the very symptom the user
      // reported. If the rail grows past the available track again,
      // fail loudly here instead of letting the JSON go quietly red.
      expect(endTurnRect, `End-Turn rect missing for ${state.id} @ ${v.w}x${v.h}`).not.toBeNull();
      expect(
        endTurnRect!.bottom,
        `End-Turn clipped by ${clippedPx}px at ${state.id} @ ${v.w}x${v.h} (windowInner=${winInner}, rect.bottom=${endTurnRect!.bottom})`,
      ).toBeLessThanOrEqual(winInner);
    });
  }
}
