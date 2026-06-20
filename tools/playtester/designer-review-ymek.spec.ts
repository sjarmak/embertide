/**
 * Designer review pass for the play-area redesign batch (sv77 + bbr8 +
 * fsyd + 7cew + v7u4 + uwg5 user overrides). Captures the in-game board
 * in several specific states so the Embertide designer persona can
 * verify cathedral vocabulary, kid-readability, and 1280×800 fit:
 *
 *   1. Embertide medallion lit-state — uses ?debug=embertide-filled to
 *      flip all three shards on so the canonical Embertide silhouette
 *      and amber glow are visible.
 *   2. Items-bag chip popover OPEN — clicks the chip and snapshots the
 *      upward-expanding popover above the trays band.
 *   3. Always-row strip EXPANDED — clicks the chevron to flip the
 *      default-collapsed state to expanded for a side-by-side compare
 *      against the collapsed default.
 *   4. Hand → drop-zone drag mid-flight — initiates an HTML5 drag from
 *      the first hand card and snapshots while hovering the drop-zone.
 *   5. Overflow probe — page.evaluate-driven check for any element with
 *      bottom > 800 inside the 1280×800 viewport.
 *
 * All screenshots land under .screenshots/designer-review-* with
 * descriptive slugs so the review writeup can reference them by name.
 */

import { test, expect, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 800;

async function reachBoard(page: Page, debugSeed?: string): Promise<void> {
  if (debugSeed) {
    await bootApp(page, { debug: debugSeed });
  } else {
    await bootApp(page);
  }
  // For seeds that don't auto-route to GameBoard, click Start.
  const startBtn = page.getByTestId('start-button');
  if (await startBtn.count()) {
    await startBtn.click().catch(() => undefined);
  }
  await page.waitForSelector('[data-testid="game-board"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  await dismissTutorials(page);
  await page.waitForTimeout(200);
}

test('designer-review: Embertide medallion lit (all three shards filled via debug seed)', async ({
  page,
}) => {
  await reachBoard(page, 'embertide-filled');
  // Sanity-check that the seed actually flipped the shards on.
  const power = await page.getByTestId('embertide-shard-power').getAttribute('data-filled');
  const wisdom = await page.getByTestId('embertide-shard-wisdom').getAttribute('data-filled');
  const courage = await page.getByTestId('embertide-shard-courage').getAttribute('data-filled');
  expect({ power, wisdom, courage }).toEqual({
    power: 'true',
    wisdom: 'true',
    courage: 'true',
  });
  // Tight clip on the title-strip so the medallion pip arrangement is
  // legible at viewing scale (60px tall strip + breathing room).
  await page.screenshot({
    path: '.screenshots/designer-review-embertide-medallion-lit.png',
    clip: { x: 0, y: 0, width: VIEW_WIDTH, height: 120 },
  });
  // Full board too so canonical silhouette can be read in context.
  await page.screenshot({
    path: '.screenshots/designer-review-embertide-medallion-lit-fullboard.png',
    fullPage: false,
  });
});

test('designer-review: Items-bag chip popover OPEN (above trays band)', async ({ page }) => {
  await reachBoard(page);
  const chip = page.getByTestId('items-bag-chip');
  await expect(chip).toBeVisible();
  await chip.click();
  await page.waitForTimeout(220);
  // Confirm the popover mounted before snapshotting.
  await expect(page.getByTestId('items-bag-popover')).toBeVisible();
  await page.screenshot({
    path: '.screenshots/designer-review-items-bag-popover-open.png',
    fullPage: false,
  });
});

test('designer-review: Always-row strip EXPANDED (chevron click flips default-collapsed)', async ({
  page,
}) => {
  await reachBoard(page);
  // Default state per the user override is collapsed; capture it first
  // for compare context, then expand and snapshot.
  await page.screenshot({
    path: '.screenshots/designer-review-always-row-collapsed.png',
    clip: { x: 0, y: 0, width: VIEW_WIDTH, height: 200 },
  });
  await page.getByTestId('always-row-strip-chevron').click();
  await page.waitForTimeout(280);
  const expanded = await page.getByTestId('always-row-strip').getAttribute('data-expanded');
  expect(expanded).toBe('true');
  await page.screenshot({
    path: '.screenshots/designer-review-always-row-expanded.png',
    clip: { x: 0, y: 0, width: VIEW_WIDTH, height: 280 },
  });
});

test('designer-review: Hand → drop-zone drag mid-flight', async ({ page }) => {
  await reachBoard(page);
  // First hand card → bounding box → drop-zone → bounding box.
  const handCard = page.locator('[data-testid^="hand-card-"]').first();
  await expect(handCard).toBeVisible();
  const dropZone = page.getByTestId('in-play');
  await expect(dropZone).toBeVisible();

  const handBox = await handCard.boundingBox();
  const dropBox = await dropZone.boundingBox();
  if (!handBox || !dropBox) {
    throw new Error('designer-review: missing bounding box for hand or drop zone');
  }

  const startX = handBox.x + handBox.width / 2;
  const startY = handBox.y + handBox.height / 2;
  const endX = dropBox.x + dropBox.width / 2;
  const endY = dropBox.y + dropBox.height / 2;

  // Snapshot pre-drag so the designer can compare hand state before/after.
  await page.screenshot({
    path: '.screenshots/designer-review-hand-pre-drag.png',
    fullPage: false,
  });

  // HTML5 DnD via Playwright's mouse API. This will fire dragstart on
  // the source button (its `draggable` + onDragStart wiring populates
  // dataTransfer) and dragover on the drop-zone (which sets
  // data-drop-active='true'). Mid-drag screenshot lands while the mouse
  // is over the drop-zone with the button still held.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in two hops so the browser has a chance to fire dragstart +
  // dragenter. A single jump-to-target sometimes elides the visual
  // dragover state in headless Chromium.
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 8 });
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.waitForTimeout(120);
  await page.screenshot({
    path: '.screenshots/designer-review-hand-mid-drag.png',
    fullPage: false,
  });
  await page.mouse.up();
  await page.waitForTimeout(220);
  await page.screenshot({
    path: '.screenshots/designer-review-hand-post-drag.png',
    fullPage: false,
  });
});

test('designer-review: 1280×800 overflow probe — list any element bottom > 800', async ({
  page,
}) => {
  await reachBoard(page);
  // Walk every element rendered inside the .game-board and report any
  // whose bounding rect bottom exceeds the 800px viewport. We filter to
  // visually-meaningful overflow only (height > 4, width > 4) so noise
  // from zero-size sentinels doesn't pollute the report. Excludes
  // overlays / popovers we explicitly want floating over the band.
  const overflow = await page.evaluate(
    ({ width, height }) => {
      const root = document.querySelector('[data-testid="game-board"]');
      if (!root) return { docHeight: 0, viewport: { width, height }, items: [] };
      const items: Array<{
        tag: string;
        testid: string | null;
        cls: string;
        bottom: number;
        right: number;
        width: number;
        height: number;
      }> = [];
      const all = root.querySelectorAll('*');
      all.forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.height < 4 || rect.width < 4) return;
        if (rect.bottom > height + 0.5 || rect.right > width + 0.5) {
          items.push({
            tag: el.tagName.toLowerCase(),
            testid: el.getAttribute('data-testid'),
            cls: (el.getAttribute('class') ?? '').slice(0, 80),
            bottom: Math.round(rect.bottom),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      });
      return {
        docHeight: document.body.getBoundingClientRect().height,
        viewport: { width, height },
        items: items.slice(0, 40),
      };
    },
    { width: VIEW_WIDTH, height: VIEW_HEIGHT },
  );
  // Persist the probe payload alongside the screenshots so the review
  // can cite specific elements by testid+class. Always print to stdout
  // (Playwright reporter captures it) for the designer to read inline.

  console.log('OVERFLOW_PROBE_JSON', JSON.stringify(overflow, null, 2));
  await page.screenshot({
    path: '.screenshots/designer-review-overflow-probe-fullpage.png',
    fullPage: true,
  });
});
