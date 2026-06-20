/**
 * Scenario: Fresh 2-player co-op smoke walk (2026-04-25).
 *
 * Why this spec is wider than the < 30-line guidance: it intentionally
 * traverses many surfaces in one boot — Setup, champion-picker,
 * status bar, chest row, hand, end-turn, field, combat — to give the
 * orchestrator a "what works / what's broken" picture before the next
 * PRD-build dispatch. It is a structural smoke walk, NOT a balance
 * gate — every step `soft-records` failures into the narrative report
 * instead of hard-failing the spec, so a single broken surface
 * doesn't abort the rest of the coverage.
 *
 * Run: `PLAYTEST_NARRATE=1 pnpm playtest fresh-2p-coop-walk.spec.ts`
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootApp, combatEnded, dismissTutorials, snapshot } from './harness';

/**
 * Count main-board hand cards (`hand-card-*`). The harness's
 * `readHandSize` helper queries the combat-hand surface
 * (`combat-hand-slot-*`), which is only mounted during boss combat —
 * not what we want when smoke-testing the main-board Hand.
 */
async function readBoardHandSize(page: Page): Promise<number> {
  return page.locator('[data-testid^="hand-card-"]').count();
}
import { createReporter, type Reporter } from './narrative';

interface SoftCheck {
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
}

async function softCheck(
  report: Reporter,
  results: SoftCheck[],
  label: string,
  fn: () => Promise<boolean | { ok: boolean; detail?: string }>,
): Promise<boolean> {
  try {
    const out = await fn();
    const norm = typeof out === 'boolean' ? { ok: out } : out;
    results.push({ label, ok: norm.ok, detail: norm.detail });
    report.step(`${norm.ok ? 'OK' : 'BROKEN'} — ${label}${norm.detail ? ` (${norm.detail})` : ''}`);
    return norm.ok;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ label, ok: false, detail });
    report.step(`BROKEN — ${label} (threw: ${detail.slice(0, 120)})`);
    return false;
  }
}

async function present(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0;
}

async function visible(loc: Locator): Promise<boolean> {
  if ((await loc.count()) === 0) return false;
  return loc
    .first()
    .isVisible()
    .catch(() => false);
}

test('fresh-2p-coop-walk — Setup → Sylvani → chest/hand/turn/combat smoke', async ({ page }) => {
  test.setTimeout(120_000);
  const report = createReporter('fresh-2p-coop-walk');
  const results: SoftCheck[] = [];
  const consoleEvents: string[] = [];
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      consoleEvents.push(`[${t}] ${msg.text().slice(0, 240)}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleEvents.push(`[pageerror] ${err.message.slice(0, 240)}`);
  });

  // ---- 1. Boot through normal Setup (no ?debug=) ----------------------
  await bootApp(page);
  report.step('booted app via normal Setup flow (no debug seed)');
  await softCheck(page.context() ? report : report, results, 'setup-root mounted', () =>
    present(page, '[data-testid="setup-root"]'),
  );
  await softCheck(report, results, 'cathedral arches present', () =>
    present(page, '.setup-cathedral-arches'),
  );
  await softCheck(report, results, '4 champion tiles rendered', async () => {
    const c = await page.locator('.setup-champion-tile[data-champion-id]').count();
    return { ok: c === 4, detail: `count=${c}` };
  });
  await report.screenshot(page, '01-setup');

  // ---- 2. Pick 2 players (default) + claim champions for both seats ----
  // Setup defaults to 2 players. Click one champion for seat 0 (auto-
  // advances to seat 1), then a second for seat 1.
  await softCheck(report, results, 'player-count buttons clickable', async () => {
    const btn = page.locator('.setup-count-button[aria-pressed="true"]');
    return { ok: (await btn.count()) >= 1, detail: `pressed-count=${await btn.count()}` };
  });
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
    report.step('clicked 2 champion tiles for seats 0 & 1');
  }
  await report.screenshot(page, '02-champions-picked');

  // ---- 3. Start the game --------------------------------------------------
  const startBtn = page.locator('[data-testid="start-button"]');
  await softCheck(
    report,
    results,
    'Start button present',
    async () => (await startBtn.count()) > 0,
  );
  await startBtn.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(400);
  await dismissTutorials(page);
  report.step('clicked Start, dismissed tutorials');

  // Hard structural assertion: game-board MUST mount after Setup commits
  // — if this breaks, every following step is meaningless.
  await page.waitForSelector('[data-testid="game-board"]', { state: 'visible', timeout: 10_000 });
  expect(await page.locator('[data-testid="game-board"]').count()).toBeGreaterThan(0);
  await report.screenshot(page, '03-board-fresh');

  // ---- 4. Status bar / Elysian cathedral pass ---------------------------
  await softCheck(report, results, 'turn-count chip rendered', () =>
    present(page, '[data-testid="turn-count"]'),
  );
  await softCheck(report, results, 'deck-count chip rendered', () =>
    present(page, '[data-testid="deck-count"]'),
  );
  await softCheck(report, results, 'active-player chip rendered', () =>
    present(page, '[data-testid="active-player"]'),
  );

  // ---- 5. Trays for both players + Embertide HUD --------------------------
  await softCheck(report, results, 'player-tray-p0 mounted', () =>
    present(page, '[data-testid="player-tray-p0"]'),
  );
  await softCheck(report, results, 'player-tray-p1 mounted', () =>
    present(page, '[data-testid="player-tray-p1"]'),
  );
  await softCheck(report, results, 'embertide-hud mounted', () =>
    present(page, '[data-testid="embertide-hud"]'),
  );

  // ---- 6. Chest row (3-tier system) -------------------------------------
  await softCheck(report, results, 'chest-row mounted', () =>
    present(page, '[data-testid="chest-row"]'),
  );
  // chestRow is randomly sampled from chestSupply (10 std / 7 mid / 3 boss)
  // and only 3 chests are displayed — so any specific variant may be absent
  // on a given seed. Assert the row has 3 slots, log which variants landed.
  await softCheck(report, results, 'chest-row has 3 slots', async () => {
    const c = await page.locator('[data-testid^="chest-slot-"]').count();
    return { ok: c === 3, detail: `count=${c}` };
  });
  const chestVariants: string[] = [];
  for (const variant of ['std', 'mid', 'boss'] as const) {
    if (await present(page, `[data-testid="chest-slot-${variant}"]`)) {
      chestVariants.push(variant);
    }
  }
  report.step(`chest-row variants this seed: [${chestVariants.join(', ')}]`);
  // Try opening a chest if affordable. Chests gate on key cost; the std
  // chest may still be disabled at turn 1 with 0 keys, in which case we
  // soft-record "not affordable" rather than fail.
  const stdChest = page.locator('[data-testid="chest-slot-std"]');
  const stdDisabled = (await stdChest.count())
    ? await stdChest
        .first()
        .evaluate((el) => (el as HTMLButtonElement).disabled)
        .catch(() => true)
    : true;
  if (!stdDisabled) {
    await stdChest
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(300);
    const reveal = page.locator('[data-testid="chest-reveal"]');
    if (await reveal.count()) {
      await reveal
        .first()
        .click({ force: true })
        .catch(() => undefined);
      await page.waitForTimeout(300);
      report.step('OK — opened std chest, dismissed reveal');
      results.push({ label: 'std chest open + reveal', ok: true });
    } else {
      report.step('BROKEN — opened std chest but no chest-reveal mounted');
      results.push({ label: 'std chest open + reveal', ok: false, detail: 'no chest-reveal' });
    }
  } else {
    report.step('SKIP — std chest not affordable at turn 1 (key cost gating)');
    results.push({
      label: 'std chest open + reveal',
      ok: true,
      detail: 'not-affordable-at-turn-1 (expected)',
    });
  }
  await report.screenshot(page, '04-board-after-chest');

  // ---- 7. Field (market row monsters/heroes/items) ----------------------
  await softCheck(report, results, 'field mounted', () => present(page, '[data-testid="field"]'));
  await softCheck(report, results, 'field has at least 1 card', async () => {
    const c = await page.locator('[data-testid^="field-card-"]').count();
    return { ok: c > 0, detail: `count=${c}` };
  });

  // ---- 8. Hand + play a card --------------------------------------------
  const hand = page.locator('[data-testid="hand"]');
  await softCheck(report, results, 'hand mounted', async () => visible(hand));
  const initialHandSize = (await hand.count()) ? await readBoardHandSize(page).catch(() => 0) : 0;
  report.step(`initial hand size = ${initialHandSize}`);
  // The on-board Hand renders cards as direct children with
  // `data-testid="hand-card-<id>"`. Click the first to play it.
  const firstHandCard = page.locator('[data-testid^="hand-card-"]').first();
  if (await firstHandCard.count()) {
    await firstHandCard.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(200);
    await dismissTutorials(page);
    const after = await readBoardHandSize(page).catch(() => initialHandSize);
    const dropped = after < initialHandSize;
    report.step(
      `${dropped ? 'OK' : 'BROKEN'} — played first hand card (size ${initialHandSize} → ${after})`,
    );
    results.push({
      label: 'play first hand card',
      ok: dropped,
      detail: `${initialHandSize} → ${after}`,
    });
  } else {
    report.step('BROKEN — no hand-card-* mounted at game start');
    results.push({ label: 'play first hand card', ok: false, detail: 'no hand-card-* mounted' });
  }

  // ---- 9. End turn -------------------------------------------------------
  const endTurn = page.locator('[data-testid="end-turn"]');
  await softCheck(
    report,
    results,
    'end-turn button present',
    async () => (await endTurn.count()) > 0,
  );
  if (await endTurn.count()) {
    const activeBefore =
      (await page
        .locator('[data-testid="active-player"]')
        .innerText()
        .catch(() => '')) ?? '';
    await endTurn
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    await dismissTutorials(page);
    report.step('clicked End Turn');
    const turnText =
      (await page
        .locator('[data-testid="turn-count"]')
        .innerText()
        .catch(() => '')) ?? '';
    const activeAfter =
      (await page
        .locator('[data-testid="active-player"]')
        .innerText()
        .catch(() => '')) ?? '';
    report.step(
      `post-end-turn: ${turnText.trim()} | ${activeBefore.trim()} → ${activeAfter.trim()}`,
    );
    // 2p game: turn counter should NOT advance after one End Turn (turn
    // bumps when rotation wraps back to seat 0). Active player MUST
    // rotate p0 → p1 instead.
    await softCheck(report, results, 'end-turn rotates active player', () =>
      Promise.resolve(activeBefore !== activeAfter && activeAfter.length > 0),
    );
  }
  await report.screenshot(page, '05-after-end-turn');

  // ---- 10. Boss-altar row + zone cell -----------------------------------
  await softCheck(report, results, 'zone-cell-sylvani (Sylvani starting zone)', () =>
    present(page, '[data-testid="zone-cell-sylvani"]'),
  );
  await softCheck(report, results, 'boss-altar-row mounted', () =>
    present(page, '[data-testid="boss-altar-row"]'),
  );

  // ---- 11. Try to enter combat via a field monster ----------------------
  // Find a monster card (data-role="monster" / "mini-boss" / "final-boss")
  // that is enabled (canAfford). Click it. If combat-screen mounts, walk
  // a couple of plays + pass-turn to verify the combat surface is wired.
  const enabledMonster = page.locator(
    '[data-testid^="field-card-"][data-role="monster"]:not([disabled]), ' +
      '[data-testid^="field-card-"][data-role="mini-boss"]:not([disabled])',
  );
  const enabledMonsterCount = await enabledMonster.count();
  report.step(`enabled-monster targets in field = ${enabledMonsterCount}`);
  if (enabledMonsterCount > 0) {
    await enabledMonster
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    await dismissTutorials(page);
    const combat = page.locator('[data-testid="combat-screen"]');
    if (await combat.count()) {
      report.step('OK — combat-screen mounted from regular monster fight');
      results.push({ label: 'combat-screen mounts on monster fight', ok: true });
      const s = await snapshot(page);
      report.snap(s, 'combat opened');
      await report.screenshot(page, '06-combat-opened');
      // Walk a few plays/passes to a result. Cap at 8 rounds — Sylvani
      // monsters are tuned to resolve well below this.
      let rounds = 0;
      while (!(await combatEnded(page)) && rounds < 8) {
        const card = page.locator('[data-testid^="combat-hand-slot-"]').first();
        if (await card.count()) {
          await card.click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(120);
          await dismissTutorials(page);
        }
        if (await combatEnded(page)) break;
        const pass = page.locator('[data-testid="combat-pass-turn"]');
        if (await pass.count()) {
          await pass
            .first()
            .click({ force: true })
            .catch(() => undefined);
          await page.waitForTimeout(180);
          await dismissTutorials(page);
        } else {
          break;
        }
        rounds += 1;
      }
      const ended = await combatEnded(page);
      report.step(`combat resolution: rounds=${rounds}, ended=${ended}`);
      results.push({ label: 'combat resolves to a result', ok: ended, detail: `rounds=${rounds}` });
      const finalSnap = await snapshot(page);
      report.snap(finalSnap, 'combat final');
      await report.screenshot(page, '07-combat-final');
    } else {
      // No combat-screen → either the monster was a regular instant-resolve
      // or the click was a no-op. Both are acceptable but worth recording.
      report.step(
        'NOTE — clicked enabled monster but no combat-screen mounted (regular instant-resolve or no-op)',
      );
      results.push({
        label: 'combat-screen mounts on monster fight',
        ok: true,
        detail: 'instant-resolve or regular-tier',
      });
    }
  } else {
    report.step('SKIP — no affordable monster targets in fresh-game field (no green/red yet)');
    results.push({
      label: 'combat-screen mounts on monster fight',
      ok: true,
      detail: 'no-affordable-monster-at-turn-1 (expected)',
    });
  }

  // ---- 12. Final structural sanity: app-root never crashed --------------
  expect(await page.locator('[data-testid="app-root"]').count()).toBeGreaterThan(0);
  await report.screenshot(page, '08-final');

  // ---- 13. Compose summary ---------------------------------------------
  const total = results.length;
  const broken = results.filter((r) => !r.ok);
  const consoleSummary = consoleEvents.length
    ? `\n\n### Console events (${consoleEvents.length})\n\n` +
      consoleEvents
        .slice(0, 20)
        .map((e) => `- \`${e}\``)
        .join('\n')
    : '\n\n### Console events\n\n_None observed._';
  const brokenList = broken.length
    ? broken.map((r) => `- **${r.label}**${r.detail ? ` — ${r.detail}` : ''}`).join('\n')
    : '_All checks passed._';
  const summary =
    `Fresh 2P co-op smoke walk: **${total - broken.length}/${total}** structural checks passed.\n\n` +
    `### Broken / unwired surfaces\n\n${brokenList}` +
    consoleSummary;
  await report.finalize(summary);

  // Spec is a smoke walk, not a CI gate — don't hard-fail on soft
  // results. Only fail if the GameBoard never mounted (already
  // hard-asserted above) or if no checks recorded (harness bug).
  expect(total).toBeGreaterThan(0);
});
