/**
 * Scenario: visual regression — DESTINY slot bespoke Vurmox altar
 * (embertide u-10d, REQ-33 §D3).
 *
 * Boots `?debug=vurmox-destiny` (u-10d seed) which drops the player on
 * the main GameBoard with `currentZone === 'gilded-cage'` and both
 * Temple wild bosses (`sentinel`, `silver-chimera`) in `defeatedBossIds`,
 * so `GameBoard` mounts `<VurmoxDestinySlot />` in the altar row.
 * Screenshots the slot locator and asserts against a committed
 * baseline.
 *
 * Assertion coverage per PRD §D3 acceptance criteria:
 *   1. the destiny ornament <img> is present + decoded
 *      (src matches /cathedral_altar_destiny_vurmox_001\.webp/)
 *   2. the CSS mandala overlay <div> is present
 *      (data-testid="boss-altar-pane-mandala")
 *   3. a screenshot diff against the committed baseline stays within 2%
 *      pixel ratio (matches u-10c's altar-row tolerance — same surface
 *      category, not a full combat screen).
 *
 * Baseline:
 *   tools/playtester/visual-destiny-slot.spec.ts-snapshots/
 *     destiny-slot-desktop-linux.png
 *
 * The `animations: 'disabled'` screenshot option freezes the mandala
 * spin so the diff is stable across runs — we assert on the rule /
 * element presence, not on any specific rotation phase.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

test('visual-destiny-slot — Vurmox destiny altar renders with bespoke art + mandala (u-10d)', async ({
  page,
}) => {
  await bootApp(page, { debug: 'vurmox-destiny' });
  await dismissTutorials(page);

  const slot = page.locator('[data-testid="vurmox-destiny-slot"]');
  await expect(slot).toBeVisible();

  // Wait for the ornament raster to finish decoding so the screenshot
  // captures a fully-rasterized frame. Same pattern as u-10c's
  // visual-altar-row spec.
  const ornament = slot.locator('[data-testid="boss-altar-pane-ornament"]');
  await expect(ornament).toBeVisible();
  await ornament.evaluate((el: HTMLImageElement) =>
    el.complete ? null : el.decode().catch(() => null),
  );
  await expect(ornament).toHaveAttribute('src', /cathedral_altar_destiny_vurmox_001\.webp$/);

  // The mandala overlay is attached even when hidden behind children —
  // `toBeAttached` avoids false negatives from the z-index stack.
  const mandala = slot.locator('[data-testid="boss-altar-pane-mandala"]');
  await expect(mandala).toBeAttached();

  await expect(slot).toHaveScreenshot('destiny-slot.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});
