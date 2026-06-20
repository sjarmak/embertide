/**
 * Scenario: smart-dune-sanctum-walk — Dune Sanctum pacing measurement
 * (embertide-7itk, ricb prereq, 2026-04-25).
 *
 * The bead `embertide-ricb` defers the Dune Sanctum
 * sandstorm-discard semantics ("every 3 turns the wind blows, discard
 * one hand-card") behind a playtester pacing pass to confirm the rule
 * isn't cruel for a 6yo audience without tuning. This spec produces
 * the data that lets the designer make that call.
 *
 * What the existing harnesses can NOT answer:
 *   - smart-2p-coop-walk runs from a fresh-2P start in Sylvani and
 *     never advances zone in a 16-turn budget (run-1 final state
 *     reports zero zone progression — just chest farming). So it
 *     can't observe end-phase ticks while currentZone === 'spirit-
 *     temple'.
 *
 * What this spec does:
 *   1. Boots `?debug=zone-dune-sanctum` (new in this commit) which
 *      drops a 2-player init straight into Dune Sanctum, exposing
 *      `window.__gameStore` so the harness can read sandstormCounter
 *      and per-player hand sizes via page.evaluate.
 *   2. Walks 16 turns × 2 seats with the same smart-policy shape as
 *      smart-2p-coop-walk (play hand → diversify field-buy quota →
 *      trade → chest → mystic → end turn). Policy parity matters
 *      because pacing depends on action volume per seat-turn.
 *   3. AT EACH END-TURN BOUNDARY, captures a tick sample:
 *        { turn, activeSeat, sandstormCounter, p0Hand, p1Hand }
 *      The sandstormCounter read happens AFTER endTurn resolves so
 *      it reflects the post-tick value (mirrors what a discard hook
 *      would see if it fired at the same site).
 *   4. Computes & reports pacing analytics:
 *        - Total ticks while in dune-sanctum
 *        - Counter trajectory (how often the cap was hit)
 *        - Hypothetical discard count under two interpretations:
 *            (a) "every 3 SEAT-TURN ticks" — fires every 3rd tick
 *            (b) "every 3 GAME-TURNS" — fires once per 3 game-turns
 *              (one seat's perspective; cuts frequency in half)
 *        - Hand size distribution at each potential discard moment
 *
 * Output: docs/playtest-reports/<runId>.md with the pacing summary.
 * Structural-only Playwright assertions; the narrative report is the
 * deliverable.
 *
 * Run: PLAYTEST_NARRATE=1 pnpm playtest smart-dune-sanctum-walk.spec.ts
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

// ---- Tunable policy constants (mirrors smart-2p-coop-walk) ----------
const FIELD_BUY_QUOTA_PER_SEAT = 2;
const TRADE_GREEN_FLOOR = 5;
const TRADE_KEY_CAP = 2;
const SEAT_TURN_CAP = 32;
const TURN_CAP = 16;

interface SeatSnapshot {
  readonly seat: 'p0' | 'p1';
  readonly green: number;
  readonly red: number;
  readonly keys: number;
}

interface TickSample {
  readonly turn: number;
  readonly activeSeat: 'p0' | 'p1';
  readonly sandstormCounter: number;
  readonly p0Hand: number;
  readonly p1Hand: number;
  readonly currentZone: string;
}

async function readNumber(loc: Locator): Promise<number> {
  if ((await loc.count()) === 0) return 0;
  const text =
    (await loc
      .first()
      .innerText()
      .catch(() => '')) ?? '';
  const match = text.match(/(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

async function readSeat(page: Page, seat: 'p0' | 'p1'): Promise<SeatSnapshot> {
  return {
    seat,
    green: await readNumber(page.locator(`[data-testid="tray-green-${seat}"]`)),
    red: await readNumber(page.locator(`[data-testid="tray-red-${seat}"]`)),
    keys: await readNumber(page.locator(`[data-testid="tray-keys-${seat}"]`)),
  };
}

/**
 * Read sandstormCounter, both seats' hand sizes, and currentZone from
 * the live store via the exposed `window.__gameStore`. Returns null if
 * the store isn't reachable (defensive — shouldn't happen because the
 * zone-dune-sanctum seed calls exposeGameStoreForPlaytest).
 */
async function readTick(page: Page): Promise<Omit<TickSample, 'turn' | 'activeSeat'> | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: { getState: () => unknown };
    };
    const store = w.__gameStore;
    if (!store) return null;
    const state = store.getState() as {
      sandstormCounter: number;
      currentZone: string;
      players: ReadonlyArray<{ hand: ReadonlyArray<unknown> }>;
    };
    return {
      sandstormCounter: state.sandstormCounter,
      p0Hand: state.players[0]?.hand.length ?? 0,
      p1Hand: state.players[1]?.hand.length ?? 0,
      currentZone: state.currentZone,
    };
  });
}

async function clearOverlays(page: Page): Promise<void> {
  await dismissTutorials(page);
  const reveal = page.locator('[data-testid="chest-reveal"]');
  for (let i = 0; i < 3; i += 1) {
    if ((await reveal.count()) === 0) break;
    await reveal
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(140);
  }
  const backdrop = page.locator('[data-testid="chest-reveal-backdrop"]');
  for (let i = 0; i < 3; i += 1) {
    if ((await backdrop.count()) === 0) break;
    await backdrop
      .first()
      .click({ force: true, position: { x: 5, y: 5 } })
      .catch(() => undefined);
    await page.waitForTimeout(120);
  }
}

async function playAllInHand(page: Page, cap: number = 12): Promise<number> {
  let played = 0;
  for (let i = 0; i < cap; i += 1) {
    const card = page.locator('[data-testid^="hand-card-"]').first();
    if ((await card.count()) === 0) break;
    await card.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(140);
    await clearOverlays(page);
    played += 1;
  }
  return played;
}

async function isEnabled(loc: Locator): Promise<boolean> {
  if ((await loc.count()) === 0) return false;
  const disabled = await loc
    .first()
    .evaluate((el) => (el as HTMLButtonElement).disabled)
    .catch(() => true);
  return !disabled;
}

async function pickFieldBuy(page: Page): Promise<string | null> {
  const tiles = page.locator(
    '[data-testid^="field-card-"]:not([data-role="monster"]):not([data-role="mini-boss"]):not([data-role="final-boss"])',
  );
  const count = await tiles.count();
  for (const preferRole of ['hero', 'item']) {
    for (let i = 0; i < count; i += 1) {
      const tile = tiles.nth(i);
      const role = (await tile.getAttribute('data-role').catch(() => '')) ?? '';
      if (role !== preferRole) continue;
      if (!(await isEnabled(tile))) continue;
      const tid = (await tile.getAttribute('data-testid').catch(() => '')) ?? '';
      return tid.replace(/^field-card-/, '');
    }
  }
  return null;
}

async function buyById(page: Page, id: string): Promise<boolean> {
  const tile = page.locator(`[data-testid="field-card-${id}"]`);
  if (!(await isEnabled(tile))) return false;
  await tile
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(160);
  await clearOverlays(page);
  return true;
}

async function tryTradeOnce(page: Page): Promise<boolean> {
  const vendor = page.locator('[data-testid="always-available-key-vendor"]');
  if (!(await isEnabled(vendor))) return false;
  await vendor
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(140);
  await clearOverlays(page);
  return true;
}

async function tryOpenChest(page: Page): Promise<boolean> {
  for (const variant of ['std', 'mid', 'boss'] as const) {
    const chest = page.locator(`[data-testid="chest-slot-${variant}"]`);
    if (!(await isEnabled(chest))) continue;
    await chest
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(280);
    await clearOverlays(page);
    return true;
  }
  return false;
}

async function tryBuyMystic(page: Page): Promise<boolean> {
  const tile = page.locator('[data-testid="always-available-mystic"]');
  if (!(await isEnabled(tile))) return false;
  await tile
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(140);
  await clearOverlays(page);
  return true;
}

async function endTurn(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="end-turn"]');
  if ((await btn.count()) === 0) return;
  await btn
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(260);
  await clearOverlays(page);
}

interface PacingAnalytics {
  readonly totalTicks: number;
  readonly ticksInZone: number;
  readonly cappedTicks: number;
  readonly counterTrajectory: ReadonlyArray<number>;
  readonly handAtTickAvg: number;
  readonly handAtTickMin: number;
  readonly handAtTickMax: number;
  readonly hypotheticalDiscardsByTickRule: number;
  readonly hypotheticalDiscardsByGameTurnRule: number;
  readonly handAtHypotheticalDiscardTicks: ReadonlyArray<number>;
}

function computePacing(samples: ReadonlyArray<TickSample>): PacingAnalytics {
  const inZone = samples.filter((s) => s.currentZone === 'dune-sanctum');
  const counters = inZone.map((s) => s.sandstormCounter);
  const cappedTicks = counters.filter((c) => c === 3).length;

  const handsAtTick = inZone.map((s) => (s.activeSeat === 'p0' ? s.p0Hand : s.p1Hand));
  const handAvg =
    handsAtTick.length === 0 ? 0 : handsAtTick.reduce((a, b) => a + b, 0) / handsAtTick.length;
  const handMin = handsAtTick.length === 0 ? 0 : Math.min(...handsAtTick);
  const handMax = handsAtTick.length === 0 ? 0 : Math.max(...handsAtTick);

  // Rule (a): every 3 SEAT-TURN ticks fires a discard. In a 2P game
  // each seat-turn ends with one tick, so discards land every 3 seat-
  // turns = every 1.5 game-turns. Aggressive interpretation.
  const tickRuleDiscards = Math.floor(inZone.length / 3);

  // Rule (b): every 3 GAME-TURNS fires a discard (one seat's
  // perspective). Half the frequency of rule (a). Humane interpretation.
  const distinctTurns = new Set(inZone.map((s) => s.turn)).size;
  const turnRuleDiscards = Math.floor(distinctTurns / 3);

  // Hand sizes at hypothetical discard moments (every 3rd tick under
  // rule a). The active seat at that tick would lose one card.
  const hypoticHands: number[] = [];
  for (let i = 2; i < inZone.length; i += 3) {
    hypoticHands.push(handsAtTick[i] ?? 0);
  }

  return {
    totalTicks: samples.length,
    ticksInZone: inZone.length,
    cappedTicks,
    counterTrajectory: counters,
    handAtTickAvg: handAvg,
    handAtTickMin: handMin,
    handAtTickMax: handMax,
    hypotheticalDiscardsByTickRule: tickRuleDiscards,
    hypotheticalDiscardsByGameTurnRule: turnRuleDiscards,
    handAtHypotheticalDiscardTicks: hypoticHands,
  };
}

const RUNS = ['run-1', 'run-2', 'run-3'] as const;

for (const run of RUNS) {
  test(`smart-dune-sanctum-walk — ${run} (16-turn pacing measurement)`, async ({ page }) => {
    test.setTimeout(300_000);
    const report = createReporter(`smart-dune-sanctum-walk-${run}`);
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

    await bootApp(page, { debug: 'zone-dune-sanctum' });
    await dismissTutorials(page);
    report.step(
      `booted ${run} via ?debug=zone-dune-sanctum — 2P init, currentZone='dune-sanctum'`,
    );

    await page.waitForSelector('[data-testid="game-board"]', { state: 'visible', timeout: 10_000 });

    const fieldBuysPerSeat: Record<string, number> = { p0: 0, p1: 0 };
    const tickSamples: TickSample[] = [];
    const counts = { play: 0, trade: 0, chest: 0, buy: 0, mystic: 0 } as Record<string, number>;

    for (let seatTurn = 0; seatTurn < SEAT_TURN_CAP; seatTurn += 1) {
      const turnText =
        (await page
          .locator('[data-testid="turn-count"]')
          .innerText()
          .catch(() => '')) ?? '';
      const turnMatch = turnText.match(/TURN\s+(\d+)/i);
      const currentTurn = turnMatch ? Number(turnMatch[1]) : 1;
      if (currentTurn > TURN_CAP) break;
      const activeText =
        (await page
          .locator('[data-testid="active-player"]')
          .innerText()
          .catch(() => '')) ?? '';
      const activeSeat: 'p0' | 'p1' = /PLAYER\s*1/i.test(activeText) ? 'p0' : 'p1';

      counts.play += await playAllInHand(page);

      for (let decision = 0; decision < 4; decision += 1) {
        const seat = await readSeat(page, activeSeat);
        const quotaHit = (fieldBuysPerSeat[activeSeat] ?? 0) >= FIELD_BUY_QUOTA_PER_SEAT;
        if (!quotaHit) {
          const pick = await pickFieldBuy(page);
          if (pick && (await buyById(page, pick))) {
            counts.buy += 1;
            fieldBuysPerSeat[activeSeat] = (fieldBuysPerSeat[activeSeat] ?? 0) + 1;
            continue;
          }
        }
        const vendorEnabled = await isEnabled(
          page.locator('[data-testid="always-available-key-vendor"]'),
        );
        if (vendorEnabled && seat.green >= TRADE_GREEN_FLOOR && seat.keys < TRADE_KEY_CAP) {
          if (await tryTradeOnce(page)) {
            counts.trade += 1;
            continue;
          }
        }
        if (seat.keys >= 1 && (await tryOpenChest(page))) {
          counts.chest += 1;
          continue;
        }
        if (await tryBuyMystic(page)) {
          counts.mystic += 1;
        }
        break;
      }

      await endTurn(page);

      // Capture the tick sample AFTER endTurn resolves — incrementSandstormCounter
      // has fired by this point, so state.sandstormCounter reflects the post-tick
      // value. This is exactly what a hypothetical discard hook at the same
      // call site would observe.
      const tick = await readTick(page);
      if (tick) {
        tickSamples.push({
          turn: currentTurn,
          activeSeat,
          ...tick,
        });
      }
    }

    const pacing = computePacing(tickSamples);

    const trajectoryLine =
      pacing.counterTrajectory.length === 0
        ? '_no in-zone ticks captured_'
        : pacing.counterTrajectory.join(' → ');

    const hypoticHandsLine =
      pacing.handAtHypotheticalDiscardTicks.length === 0
        ? '_none — fewer than 3 in-zone ticks_'
        : pacing.handAtHypotheticalDiscardTicks.join(', ');

    const consoleSummary = consoleEvents.length
      ? `\n\n### Console events (${consoleEvents.length})\n\n` +
        consoleEvents
          .slice(0, 15)
          .map((e) => `- \`${e}\``)
          .join('\n')
      : '\n\n### Console events\n\n_None observed._';

    const summary =
      `Dune Sanctum pacing walk, ${run}: ${counts.play} hand plays, ${counts.trade} key-vendor trades, ${counts.chest} chest opens, ${counts.buy} field buys, ${counts.mystic} mystic buys. Field buys per seat: p0=${fieldBuysPerSeat.p0}, p1=${fieldBuysPerSeat.p1}.\n\n` +
      `### Sandstorm pacing (in dune-sanctum)\n\n` +
      `- Total end-phase ticks captured: **${pacing.totalTicks}**\n` +
      `- Ticks while \`currentZone === 'dune-sanctum'\`: **${pacing.ticksInZone}**\n` +
      `- Ticks at counter cap (3): **${pacing.cappedTicks}**\n` +
      `- Counter trajectory: \`${trajectoryLine}\`\n\n` +
      `### Hand size at tick (active-seat perspective)\n\n` +
      `- min / avg / max: **${pacing.handAtTickMin}** / **${pacing.handAtTickAvg.toFixed(1)}** / **${pacing.handAtTickMax}**\n\n` +
      `### Hypothetical "every 3 turns the wind blows, discard 1 hand-card"\n\n` +
      `- Rule (a) "every 3 seat-turn ticks fires a discard": **${pacing.hypotheticalDiscardsByTickRule}** discards in ${pacing.ticksInZone} ticks (aggressive — discards every 1.5 game-turns in 2P)\n` +
      `- Rule (b) "every 3 game-turns fires a discard": **${pacing.hypotheticalDiscardsByGameTurnRule}** discards (humane — half the frequency)\n` +
      `- Hand sizes at rule-(a) discard moments: \`[${hypoticHandsLine}]\`\n` +
      consoleSummary;

    await report.finalize(summary);

    expect(await page.locator('[data-testid="app-root"]').count()).toBeGreaterThan(0);
    expect(counts.play).toBeGreaterThan(0);
  });
}
