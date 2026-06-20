/**
 * Regression spec for embertide-r9ze.
 *
 * User report 2026-05-09 (C0B13JE7M35): "when resizing the window to be
 * thinner the top row image of cards goes behind the text e.g. Player 1
 * (Valor Warden) — Turn 1 / Turn 1 / Deck: 5 / Discard: 0 / Active:
 * Player 1". The top-row card art renders BEHIND the status/title-text
 * labels at narrow viewport widths.
 *
 * Root cause (pre-fix): `.always-row-strip-body` is `flex: 1 1 auto;
 * min-width: 0` and its inner card tiles carry `!important` widths that
 * don't shrink. At narrow widths the cards overflow the body's flex
 * box (default `overflow: visible`) and bleed into the rail's column.
 * Because `.always-row-strip-rail` comes AFTER the body in DOM order
 * with no z-index, the rail's status text paints over the overflowed
 * card art — Stephanie's reported symptom.
 *
 * Acceptance (per bead):
 *  - At 100% browser zoom, viewport widths from 1024 up to 1920, all
 *    top-row text labels remain fully readable in front of any card
 *    art / illustration layer.
 *  - Computed z-index of the rail must be higher than the body's so
 *    text always wins the stacking contest if any layout edge case
 *    re-introduces overlap.
 *  - The rail and the body MUST NOT visually overlap horizontally —
 *    rail.left >= body.right at every measured viewport width.
 *
 * Output:
 *   .screenshots/r9ze-toprow-overlap-<W>x<H>.png
 *   stdout: per-viewport JSON of body/rail rects + computed z-index
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORTS = [
  { w: 1024, h: 800 },
  { w: 1180, h: 800 },
  { w: 1280, h: 800 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1600, h: 900 },
  { w: 1920, h: 1080 },
] as const;

for (const v of VIEWPORTS) {
  test(`r9ze — top-row rail does not overlap card body at ${v.w}x${v.h}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await bootApp(page, { debug: 'hp-downed' });
    await dismissTutorials(page);

    const stripHandle = page.locator('[data-testid="always-row-strip"]').first();
    await stripHandle.waitFor({ state: 'visible', timeout: 5_000 });

    const bodyHandle = stripHandle.locator('.always-row-strip-body').first();
    const railHandle = page.locator('[data-testid="always-row-strip-rail"]').first();

    const bodyBox = await bodyHandle.boundingBox();
    const railBox = await railHandle.boundingBox();

    const railZ = await railHandle.evaluate((el) => window.getComputedStyle(el).zIndex);
    const bodyZ = await bodyHandle.evaluate((el) => window.getComputedStyle(el).zIndex);
    const railOverflow = await bodyHandle.evaluate((el) => window.getComputedStyle(el).overflowX);

    // Inspect the FIRST card tile within the body — that's the surface
    // Stephanie observed disappearing under the rail text.
    const firstTileHandle = bodyHandle.locator('.field-card-tile').first();
    const firstTileBox = await firstTileHandle.boundingBox();

    // Inspect a rail status text node — at minimum the active-player
    // span ("Active: Player 1") which is what the user quoted.
    const activePlayerHandle = railHandle.locator('[data-testid="active-player"]').first();
    const activePlayerBox = await activePlayerHandle.boundingBox();

    const summary = {
      viewport: `${v.w}x${v.h}`,
      bodyBox,
      railBox,
      firstTileBox,
      activePlayerBox,
      bodyZ,
      railZ,
      bodyOverflowX: railOverflow,
    };
    console.log(`\n=== r9ze probe ${v.w}x${v.h} ===`);
    console.log(JSON.stringify(summary, null, 2));

    await page.screenshot({
      path: `.screenshots/r9ze-toprow-overlap-${v.w}x${v.h}.png`,
      fullPage: false,
    });

    // Acceptance assertions.
    expect(bodyBox, `body bounding box missing at ${v.w}x${v.h}`).not.toBeNull();
    expect(railBox, `rail bounding box missing at ${v.w}x${v.h}`).not.toBeNull();
    if (bodyBox && railBox) {
      const bodyRight = bodyBox.x + bodyBox.width;
      // Rail must start at or after the body's right edge — no overlap.
      expect(
        railBox.x,
        `rail.left=${railBox.x} overlaps body.right=${bodyRight} at ${v.w}x${v.h}`,
      ).toBeGreaterThanOrEqual(bodyRight - 0.5); // tolerate sub-pixel rounding
    }

    // The rail must paint on top per the acceptance criterion.
    // The body sits at the strip's `z-index: 5` stacking context root,
    // so the rail needs a positive z-index to stay above any card-art
    // overflow if a layout regression re-introduces it.
    const parsedRailZ = railZ === 'auto' ? 0 : Number.parseInt(railZ, 10);
    expect(
      parsedRailZ,
      `rail computed z-index ${railZ} must be > 0 to guarantee text-on-top contract`,
    ).toBeGreaterThan(0);

    // The first card tile must be visible (have positive width) at
    // every supported viewport — i.e., the cards aren't fully eaten
    // by the rail.
    expect(firstTileBox, `first card tile missing at ${v.w}x${v.h}`).not.toBeNull();
    if (firstTileBox) {
      expect(
        firstTileBox.width,
        `first card tile width=${firstTileBox.width} at ${v.w}x${v.h}`,
      ).toBeGreaterThan(40);
    }

    // The active-player label must remain visible (positive width).
    expect(activePlayerBox, `active-player label missing at ${v.w}x${v.h}`).not.toBeNull();
    if (activePlayerBox) {
      expect(
        activePlayerBox.width,
        `active-player label width=${activePlayerBox.width} at ${v.w}x${v.h}`,
      ).toBeGreaterThan(0);
    }
  });
}
