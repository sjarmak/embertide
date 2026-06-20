/**
 * Regression guard for embertide-1rrk — "Shield/item card art renders
 * oversized in boss combat area — hides most of the hand".
 *
 * A played combat-absorb card (shield) becomes a battlefield defender
 * rendered via CardTemplate. Before the fix, `.combat-battlefield-card` had
 * no explicit width and the card art (`<svg width:100%;height:100%>`) blew
 * the tile up to ~243×311px, growing the defenders pane to ~327px and
 * pushing the combat hand (and End Turn button) off-screen at 1280×800.
 *
 * This spec injects defenders straight onto activeCombat.battlefield via the
 * dev-only window.__gameStore (same hook the playtest seeds expose) and
 * asserts the played card stays in its slot and the hand + End Turn button
 * remain inside the viewport — for a single shield, multiple shields, and a
 * shield carrying one of the new bespoke item portraits (aegis-pane).
 *
 * Run against the live dev server (port 5173) or let the harness boot its
 * own preview on 6174:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 \
 *     pnpm exec playwright test --config tools/playtester/playwright.config.ts \
 *     regression-1rrk-shield-sizing
 */

import { test, expect, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORT = { width: 1280, height: 800 } as const;

/** Upper bound for a contained defender tile / its art panel (px). The fix
 *  pins the tile to 96px wide and the art band to 64px; 130 leaves slack for
 *  the gold border + future tuning while still failing hard on the ~243px
 *  balloon this regression guards against. */
const MAX_CONTAINED = 130;

async function injectField(page: Page, cardIds: readonly string[]): Promise<void> {
  await page.evaluate(
    (ids) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__gameStore;
      if (!store) throw new Error('__gameStore not exposed — run against a dev build');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.setState((s: any) => {
        if (!s.activeCombat) return s;
        const battlefield = ids.map((cardId: string) => ({
          cardId,
          hp: 4,
          hpMax: 4,
          combatEffectId: 'combat-absorb:4',
        }));
        return { activeCombat: { ...s.activeCombat, battlefield } };
      });
    },
    [...cardIds],
  );
}

async function rectOf(
  page: Page,
  selector: string,
): Promise<{ w: number; h: number; bottom: number }> {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, bottom: r.bottom };
    });
}

const CASES: ReadonlyArray<{ name: string; ids: readonly string[] }> = [
  { name: 'single absorb shield (tower-shield)', ids: ['tower-shield'] },
  { name: 'bespoke-art shield (aegis-pane)', ids: ['aegis-pane'] },
  { name: 'three shields in a row', ids: ['tower-shield', 'elysian-shield', 'aegis-pane'] },
];

for (const c of CASES) {
  test(`1rrk — ${c.name}: played card stays in its slot, hand + End Turn visible`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await bootApp(page, { debug: 'craghorn' });
    await dismissTutorials(page);
    await injectField(page, c.ids);

    const card = page.locator('[data-testid^="combat-battlefield-card-"]').first();
    await expect(card).toBeVisible();

    // The tile and its art panel must be contained — not the ~243px balloon.
    const tile = await rectOf(page, '[data-testid^="combat-battlefield-card-"]');
    const art = await rectOf(
      page,
      '[data-testid^="combat-battlefield-card-"] [data-testid="card-template-art"]',
    );
    expect(tile.w, 'defender tile width must stay contained').toBeLessThanOrEqual(MAX_CONTAINED);
    expect(art.w, 'defender art width must stay contained').toBeLessThanOrEqual(MAX_CONTAINED);
    expect(art.h, 'defender art height must stay contained').toBeLessThanOrEqual(MAX_CONTAINED);
    // Art must actually render (the height-cap fix must not starve it to ~0).
    expect(art.h, 'defender art must not collapse to nothing').toBeGreaterThan(24);

    // The combat hand and the End Turn button must remain inside the viewport.
    const hand = await rectOf(page, '[data-testid="combat-hand"]');
    const pass = await rectOf(page, '[data-testid="combat-pass-turn"]');
    expect(hand.bottom, 'combat hand must stay fully on-screen').toBeLessThanOrEqual(
      VIEWPORT.height,
    );
    expect(pass.bottom, 'End Turn button must stay on-screen').toBeLessThanOrEqual(VIEWPORT.height);
  });
}
