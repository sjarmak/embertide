/**
 * iPad layout audit screenshots — embertide-n8s5 (i5fk.audit phase).
 *
 * Captures 8 screenshots (4 surfaces × 2 iPad orientations) so the i5fk
 * fix phase has concrete visual signal for layout work. Read-only —
 * makes no production source changes.
 *
 * Output paths (per parent bead acceptance A1):
 *   .screenshots/i5fk-audit-ipad-{portrait,landscape}-{gameboard,combat,zoneselect,market}.png
 *
 * Surface mapping (the bead names 4 "screens"; the actual app composes
 * three of them inside GameBoard, so we exercise each one with a
 * targeted seed + screenshot strategy):
 *   - gameboard:  full page from ?debug=wild-boss-slot — default 2P
 *                 board with both altar slots populated.
 *   - combat:     full page from ?debug=craghorn — CombatScreen at start.
 *   - zoneselect: full page from ?debug=zone-emberpeak — board
 *                 in emberpeak zone state (different zone art /
 *                 ZoneCell distribution than wild-boss-slot).
 *   - market:     element-screenshot of [data-testid="market-row"]
 *                 from wild-boss-slot — focused signal on market
 *                 layout/wrap at iPad widths.
 *
 * Not run in CI. Invoke ad-hoc via:
 *   pnpm playtest tools/playtester/screenshot-i5fk-audit.spec.ts
 */

import { test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const IPAD_PORTRAIT = { width: 768, height: 1024 } as const;
const IPAD_LANDSCAPE = { width: 1024, height: 768 } as const;

interface SurfaceCapture {
  readonly id: 'gameboard' | 'combat' | 'zoneselect' | 'market';
  readonly seed: string;
  readonly waitFor: string;
  readonly clipTo?: string;
}

const SURFACES: readonly SurfaceCapture[] = [
  { id: 'gameboard', seed: 'wild-boss-slot', waitFor: '[data-testid="game-board"]' },
  { id: 'combat', seed: 'craghorn', waitFor: '[data-testid="combat-screen"]' },
  { id: 'zoneselect', seed: 'zone-emberpeak', waitFor: '[data-testid="game-board"]' },
  {
    id: 'market',
    seed: 'wild-boss-slot',
    waitFor: '[data-testid="market-row"]',
    clipTo: '[data-testid="market-row"]',
  },
] as const;

const ORIENTATIONS = [
  { label: 'portrait', viewport: IPAD_PORTRAIT },
  { label: 'landscape', viewport: IPAD_LANDSCAPE },
] as const;

for (const { label, viewport } of ORIENTATIONS) {
  test.describe(`iPad ${label} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport });

    for (const surface of SURFACES) {
      test(`i5fk-audit — ${surface.id} @ ${label}`, async ({ page }) => {
        await bootApp(page, { debug: surface.seed });
        await dismissTutorials(page);
        await page.waitForSelector(surface.waitFor, { state: 'visible' });
        // Settle layout: wait for any chest-reveal / zone-advance
        // animation to finish before snapshotting.
        await page.waitForTimeout(250);

        const path = `.screenshots/i5fk-audit-ipad-${label}-${surface.id}.png`;
        if (surface.clipTo) {
          await page.locator(surface.clipTo).first().screenshot({ path });
        } else {
          await page.screenshot({ path, fullPage: true });
        }
      });
    }
  });
}
