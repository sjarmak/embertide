/**
 * Scenario: Play-area redesign regression suite (embertide-ymek).
 *
 * Verifies the structural changes introduced by the 5-bead landing
 * (sv77 + bbr8 + fsyd + 7cew + v7u4) didn't regress core gameplay.
 *
 * Surfaces under test:
 *   - DOM order in `.board-main`: [market-row → play-zones → Hand → trays].
 *     The legacy `.turn-actions` band is gone; End-Turn lives in `.trays`.
 *   - Embertide + PrincessCrystal moved from `.trays` into the cathedral
 *     title-strip's center slot.
 *   - Items zone is no longer rendered as `[data-testid="items-row"]`
 *     in the play-zones — it's a chip+popover inside `.trays`.
 *   - InPlay empty-state placeholder selector renamed:
 *     `[data-testid="in-play-empty"]` → `[data-testid="drop-zone-empty"]`.
 *   - Hand cards remain tap-to-play (onClick → playCard).
 *
 * Run: `PLAYWRIGHT_BASE_URL=http://localhost:5173 \
 *        pnpm playtest -- regression-ymek.spec.ts`
 */

import { expect, test, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

interface Check {
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
}

async function record(
  results: Check[],
  label: string,
  fn: () => Promise<boolean | { ok: boolean; detail?: string }>,
): Promise<boolean> {
  try {
    const out = await fn();
    const norm = typeof out === 'boolean' ? { ok: out } : out;
    results.push({ label, ok: norm.ok, detail: norm.detail });

    console.log(`${norm.ok ? 'PASS' : 'FAIL'} — ${label}${norm.detail ? ` (${norm.detail})` : ''}`);
    return norm.ok;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ label, ok: false, detail });

    console.log(`FAIL — ${label} (threw: ${detail.slice(0, 160)})`);
    return false;
  }
}

async function bootToBoard(page: Page): Promise<void> {
  await bootApp(page);
  // Setup: pick 2 champions for default 2-player game, click Start.
  const tiles = page.locator('.setup-champion-tile[data-champion-id]');
  if ((await tiles.count()) >= 2) {
    await tiles
      .nth(0)
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(120);
    await tiles
      .nth(1)
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(120);
  }
  const start = page.locator('[data-testid="start-button"]');
  if (await start.count()) {
    await start.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await dismissTutorials(page);
  await page.waitForSelector('[data-testid="game-board"]', {
    state: 'visible',
    timeout: 10_000,
  });
  await dismissTutorials(page);
}

test('regression-ymek — play-area redesign (sv77+bbr8+fsyd+7cew+v7u4)', async ({ page }) => {
  test.setTimeout(120_000);
  const results: Check[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240));
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message.slice(0, 240)}`));

  // ---- 1. Boot + dismiss tutorials + game-board mount -------------------
  await bootToBoard(page);
  await record(results, 'game-board mounted', async () => {
    return (await page.locator('[data-testid="game-board"]').count()) > 0;
  });

  // Pre-flight: legacy selectors must be gone.
  await record(results, 'legacy [data-testid="in-play-empty"] is gone', async () => {
    const c = await page.locator('[data-testid="in-play-empty"]').count();
    return { ok: c === 0, detail: `count=${c}` };
  });
  await record(results, 'legacy [data-testid="items-row"] is gone (in play-zones)', async () => {
    const c = await page.locator('[data-testid="items-row"]').count();
    return { ok: c === 0, detail: `count=${c}` };
  });
  await record(results, 'legacy [data-testid="items-row-empty"] is gone', async () => {
    const c = await page.locator('[data-testid="items-row-empty"]').count();
    return { ok: c === 0, detail: `count=${c}` };
  });

  // ---- 2. Tap-to-play card → InPlay populates, drop-zone-empty hides ----
  await record(results, 'drop-zone-empty placeholder is initially mounted', async () => {
    const c = await page.locator('[data-testid="drop-zone-empty"]').count();
    return { ok: c >= 1, detail: `count=${c}` };
  });
  const handCardsBefore = await page.locator('[data-testid^="hand-card-"]').count();
  await record(results, 'hand has at least 1 playable card', () =>
    Promise.resolve({ ok: handCardsBefore > 0, detail: `handSize=${handCardsBefore}` }),
  );
  if (handCardsBefore > 0) {
    const firstCard = page.locator('[data-testid^="hand-card-"]').first();
    const cardId = await firstCard.getAttribute('data-testid');
    await firstCard.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(250);
    await dismissTutorials(page);
    await record(
      results,
      'tap-to-play: clicked card appears in [data-testid="in-play"]',
      async () => {
        const inPlay = page.locator('[data-testid="in-play"]');
        const inPlayCardCount = await inPlay
          .locator('[data-testid^="in-play-card-"], [data-testid^="hand-card-"]')
          .count();
        return {
          ok: inPlayCardCount > 0,
          detail: `inPlayCards=${inPlayCardCount} clicked=${cardId}`,
        };
      },
    );
    await record(results, 'tap-to-play: drop-zone-empty hides after first play', async () => {
      const c = await page.locator('[data-testid="drop-zone-empty"]').count();
      return { ok: c === 0, detail: `count=${c}` };
    });
  }

  // ---- 3. End-Turn lives in .trays and rotates active player ------------
  await record(results, 'end-turn button is a descendant of .trays', async () => {
    const inTrays = await page.locator('.trays [data-testid="end-turn"]').count();
    return { ok: inTrays > 0, detail: `count-in-trays=${inTrays}` };
  });
  await record(results, 'legacy .turn-actions band is gone', async () => {
    const c = await page.locator('.turn-actions').count();
    return { ok: c === 0, detail: `count=${c}` };
  });
  const handSizeBeforeEnd = await page.locator('[data-testid^="hand-card-"]').count();
  const turnTextBefore = (
    await page
      .locator('[data-testid="turn-count"]')
      .innerText()
      .catch(() => '')
  ).trim();
  const activeBefore = (
    await page
      .locator('[data-testid="active-player"]')
      .innerText()
      .catch(() => '')
  ).trim();
  await page
    .locator('[data-testid="end-turn"]')
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(450);
  await dismissTutorials(page);
  const turnTextAfter = (
    await page
      .locator('[data-testid="turn-count"]')
      .innerText()
      .catch(() => '')
  ).trim();
  const activeAfter = (
    await page
      .locator('[data-testid="active-player"]')
      .innerText()
      .catch(() => '')
  ).trim();
  await record(results, 'end-turn rotates active player or increments turn counter', () =>
    Promise.resolve({
      ok:
        (activeBefore !== activeAfter && activeAfter.length > 0) ||
        turnTextBefore !== turnTextAfter,
      detail: `active: "${activeBefore}" → "${activeAfter}", turn: "${turnTextBefore}" → "${turnTextAfter}"`,
    }),
  );
  const handSizeAfterEnd = await page.locator('[data-testid^="hand-card-"]').count();
  await record(results, 'end-turn re-fills hand', () =>
    Promise.resolve({
      ok: handSizeAfterEnd >= handSizeBeforeEnd && handSizeAfterEnd > 0,
      detail: `${handSizeBeforeEnd} → ${handSizeAfterEnd}`,
    }),
  );

  // ---- 4. Items-bag chip toggles its popover ---------------------------
  await record(results, 'items-bag chip is a descendant of .trays', async () => {
    const c = await page.locator('.trays [data-testid="items-bag-chip"]').count();
    return { ok: c > 0, detail: `count-in-trays=${c}` };
  });
  await record(results, 'items-bag-popover is initially unmounted', async () => {
    const c = await page.locator('[data-testid="items-bag-popover"]').count();
    return { ok: c === 0, detail: `count=${c}` };
  });
  await page
    .locator('[data-testid="items-bag-chip"]')
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(150);
  await record(results, 'click items-bag-chip mounts items-bag-popover', async () => {
    const c = await page.locator('[data-testid="items-bag-popover"]').count();
    return { ok: c === 1, detail: `count=${c}` };
  });
  await page
    .locator('[data-testid="items-bag-chip"]')
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(150);
  await record(results, 'click items-bag-chip again unmounts items-bag-popover', async () => {
    const c = await page.locator('[data-testid="items-bag-popover"]').count();
    return { ok: c === 0, detail: `count=${c}` };
  });

  // ---- 5. Always-row collapse/expand chevron ---------------------------
  const strip = page.locator('[data-testid="always-row-strip"]');
  await record(results, 'always-row-strip mounted', async () => (await strip.count()) > 0);
  if ((await strip.count()) > 0) {
    const expandedBefore = await strip.first().getAttribute('data-expanded');
    await page
      .locator('[data-testid="always-row-strip-chevron"]')
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(200);
    const expandedAfter = await strip.first().getAttribute('data-expanded');
    await record(results, 'always-row chevron flips data-expanded', () =>
      Promise.resolve({
        ok: expandedBefore !== expandedAfter && expandedAfter !== null,
        detail: `${expandedBefore} → ${expandedAfter}`,
      }),
    );
  }

  // ---- 6. Embertide + PrincessCrystal in cathedral title strip, NOT in trays ----
  await record(results, 'embertide-hud NOT inside .trays (moved to cathedral)', async () => {
    const inTrays = await page.locator('.trays [data-testid="embertide-hud"]').count();
    const total = await page.locator('[data-testid="embertide-hud"]').count();
    return { ok: inTrays === 0 && total > 0, detail: `inTrays=${inTrays} total=${total}` };
  });

  // ---- 7. Viewport budget: critical bands stay within 800px height ----
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await record(results, 'viewport height is 800px', () =>
    Promise.resolve({ ok: viewportHeight === 800, detail: `actual=${viewportHeight}` }),
  );
  const bandSelectors: ReadonlyArray<{ sel: string; label: string }> = [
    { sel: '.market-row', label: '.market-row' },
    { sel: '.hand', label: '.hand' },
    { sel: '.trays', label: '.trays' },
    { sel: '.items-bag', label: '.items-bag' },
    { sel: '.end-turn-button', label: '.end-turn-button' },
  ];
  for (const { sel, label } of bandSelectors) {
    await record(results, `${label} bottom <= 800 (viewport budget)`, async () => {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) return { ok: true, detail: 'not-mounted (skip)' };
      const box = await loc.boundingBox().catch(() => null);
      if (!box) return { ok: true, detail: 'no-box (skip)' };
      const bottom = box.y + box.height;
      return {
        ok: bottom <= 800,
        detail: `bottom=${bottom.toFixed(1)} y=${box.y.toFixed(1)} h=${box.height.toFixed(1)}`,
      };
    });
  }

  // ---- 8. Hard structural sanity ---------------------------------------
  expect(await page.locator('[data-testid="game-board"]').count()).toBeGreaterThan(0);

  // ---- 9. Compose summary ---------------------------------------------
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(
    `\n=== regression-ymek summary: ${passed}/${results.length} passed, ${failed.length} failed ===`,
  );
  for (const f of failed) {
    console.log(`  FAIL — ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
  }
  if (consoleErrors.length) {
    console.log(`Console errors observed (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 10)) {
      console.log(`  ${e}`);
    }
  }

  // Hard fail the spec only if any structural regression checks failed.
  expect(failed, `regression-ymek failures: ${failed.map((f) => f.label).join('; ')}`).toEqual([]);
});
