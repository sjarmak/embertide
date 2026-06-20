/**
 * Scenario: smart-2p-coop-walk — credible-human decision policy
 * (embertide-7boo follow-up, 2026-04-25).
 *
 * The acmf-dual-phase-walk uses a fixed-order naive-greedy policy
 * (play → trade → chest → buy → mystic) on every seat-turn. That
 * pipeline drains all green into the trade → chest pipe before the
 * buy step ever sees a positive balance, which is why post-knob2
 * runs still showed 16/14/16 chest opens vs 0/2/0 field buys. The
 * question this spec answers: is the field-buy bypass a real game
 * problem, or a harness artifact of the naive-greedy ordering?
 *
 * Decision policy (per seat-turn, Main phase):
 *   1. Play every shard/hero card in hand (same as acmf — pumps
 *      the resource pool to its peak before any spend decision).
 *   2. Decide between trade / chest / field-buy via these rules:
 *      a. If a non-monster field card is affordable AND the seat
 *         hasn't yet bought N=2 field cards this game, buy the
 *         cheapest affordable card (heroes preferred over items
 *         at equal cost — heroes are dual-phase). This mimics
 *         "I want a couple of cool field cards before I cycle
 *         chests for the rest."
 *      b. Else if green ≥ 5 AND keys < 2 AND the seat hasn't
 *         already traded this turn (knob 2 1-trade cap — checking
 *         the button's `disabled` attr is the DOM-level signal),
 *         trade Pell. The green ≥ 5 check leaves 1g spillover
 *         for next turn instead of fully draining the pool.
 *      c. Else if keys ≥ 1 AND a chest is enabled, open the
 *         cheapest chest tier.
 *      d. Else end turn (also tries the always-available mystic
 *         as a green-pump if nothing else is affordable, since
 *         it's a net shard bank).
 *   3. End Turn.
 *
 * Diversification quota: per-seat (p0 / p1) target is 2 field
 * buys. Once the seat hits its quota, it falls back to the
 * trade / chest pipe — matching the acmf workload from that
 * point forward.
 *
 * Tunable constants documented inline so a designer can adjust
 * the policy without re-reading the spec body. This file is
 * ~140 lines vs the < 30-line guidance — the playtester skill
 * deviation is justified by the multi-rule policy logic.
 *
 * Run: PLAYTEST_NARRATE=1 pnpm playtest smart-2p-coop-walk.spec.ts
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

// ---- Tunable policy constants (designer-facing) -------------------
const FIELD_BUY_QUOTA_PER_SEAT = 2; // diversification target
const TRADE_GREEN_FLOOR = 5; // min green before a trade fires (leaves spillover)
const TRADE_KEY_CAP = 2; // don't trade if keys >= cap (already supplied)
const SEAT_TURN_CAP = 32; // 16 turns × 2 seats
const TURN_CAP = 16;

interface SeatSnapshot {
  readonly seat: 'p0' | 'p1';
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly items: number;
  readonly chests: number;
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
    items: await readNumber(page.locator(`[data-testid="tray-items-${seat}"]`)),
    chests: await readNumber(page.locator(`[data-testid="tray-chests-${seat}"]`)),
  };
}

function fmtSeat(s: SeatSnapshot): string {
  return `${s.seat}{g=${s.green} r=${s.red} k=${s.keys} items=${s.items} chests=${s.chests}}`;
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

async function playAllInHand(page: Page, cap: number = 12): Promise<string[]> {
  const played: string[] = [];
  for (let i = 0; i < cap; i += 1) {
    const card = page.locator('[data-testid^="hand-card-"]').first();
    if ((await card.count()) === 0) break;
    const tid = (await card.getAttribute('data-testid').catch(() => null)) ?? '';
    const id = tid.replace(/^hand-card-/, '');
    await card.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(140);
    await clearOverlays(page);
    if (id) played.push(id);
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

/**
 * Find the cheapest affordable non-monster field card. Heroes
 * preferred over items at equal cost (heroes are dual-phase).
 * The DOM-level `disabled` attribute is computed by Field.tsx
 * via `canAfford`, so an enabled tile is by definition payable
 * with the active seat's current resources. Returns the card id
 * (data-testid suffix) and its inferred role.
 */
async function pickFieldBuy(page: Page): Promise<{ id: string; role: string } | null> {
  const tiles = page.locator(
    '[data-testid^="field-card-"]:not([data-role="monster"]):not([data-role="mini-boss"]):not([data-role="final-boss"])',
  );
  const count = await tiles.count();
  // Two passes: heroes first, then items. Within each pass, the
  // first enabled tile in DOM order is "cheapest" — Field.tsx
  // renders cards in canonical row order, which is monotone in
  // cost for the supply rows.
  for (const preferRole of ['hero', 'item']) {
    for (let i = 0; i < count; i += 1) {
      const tile = tiles.nth(i);
      const role = (await tile.getAttribute('data-role').catch(() => '')) ?? '';
      if (role !== preferRole) continue;
      if (!(await isEnabled(tile))) continue;
      const tid = (await tile.getAttribute('data-testid').catch(() => '')) ?? '';
      const id = tid.replace(/^field-card-/, '');
      return { id, role };
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

async function tryOpenChest(page: Page): Promise<string | null> {
  for (const variant of ['std', 'mid', 'boss'] as const) {
    const chest = page.locator(`[data-testid="chest-slot-${variant}"]`);
    if (!(await isEnabled(chest))) continue;
    await chest
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(280);
    await clearOverlays(page);
    return variant;
  }
  return null;
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

const RUNS = ['run-1', 'run-2', 'run-3'] as const;

for (const run of RUNS) {
  test(`smart-2p-coop-walk — ${run} (16-turn fresh 2P co-op, smart policy)`, async ({ page }) => {
    // 5-minute budget: smart policy peeks DOM/state ~4× per seat-turn
    // (readSeat, pickFieldBuy, isEnabled, etc.) so a 32-seat-turn walk
    // sits at ~150-220s — well over the harness default 180s. Bumping
    // generously so a slow CI box or noisy seed doesn't time out
    // mid-walk during the final report screenshot.
    test.setTimeout(300_000);
    const report = createReporter(`smart-2p-coop-walk-${run}`);
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

    await bootApp(page);
    await dismissTutorials(page);
    report.step(`booted smart-${run} (fresh Date.now() seed via Setup → initGame)`);

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
    await page
      .locator('[data-testid="start-button"]')
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    await dismissTutorials(page);
    await page.waitForSelector('[data-testid="game-board"]', { state: 'visible', timeout: 10_000 });

    const fieldBuysPerSeat: Record<string, number> = { p0: 0, p1: 0 };
    const counts = { play: 0, trade: 0, chest: 0, buy: 0, mystic: 0 } as Record<string, number>;
    const decisionTrace: string[] = [];

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
      // Active seat slug — PLAYER 1 → p0, PLAYER 2 → p1.
      const activeSeat: 'p0' | 'p1' = /PLAYER\s*1/i.test(activeText) ? 'p0' : 'p1';

      // 1. Play hand greedily — pumps green/red pool to peak.
      const played = await playAllInHand(page);
      counts.play += played.length;

      // Smart loop — at most ~4 sub-decisions per seat-turn before
      // we end (prevents infinite loops if a button mis-reports
      // its disabled state). Each decision re-reads the seat tray
      // because each action mutates resources.
      for (let decision = 0; decision < 4; decision += 1) {
        const seat = await readSeat(page, activeSeat);
        const quotaHit = (fieldBuysPerSeat[activeSeat] ?? 0) >= FIELD_BUY_QUOTA_PER_SEAT;
        // Rule a — diversification: prefer field buy until quota.
        if (!quotaHit) {
          const pick = await pickFieldBuy(page);
          if (pick) {
            const ok = await buyById(page, pick.id);
            if (ok) {
              counts.buy += 1;
              fieldBuysPerSeat[activeSeat] = (fieldBuysPerSeat[activeSeat] ?? 0) + 1;
              decisionTrace.push(`T${currentTurn}/${activeSeat} BUY ${pick.role}:${pick.id}`);
              continue;
            }
          }
        }
        // Rule b — trade only with green floor + key headroom.
        const vendorEnabled = await isEnabled(
          page.locator('[data-testid="always-available-key-vendor"]'),
        );
        if (vendorEnabled && seat.green >= TRADE_GREEN_FLOOR && seat.keys < TRADE_KEY_CAP) {
          if (await tryTradeOnce(page)) {
            counts.trade += 1;
            decisionTrace.push(`T${currentTurn}/${activeSeat} TRADE (g=${seat.green}→k+1)`);
            continue;
          }
        }
        // Rule c — chest cycle when keys are in hand.
        if (seat.keys >= 1) {
          const variant = await tryOpenChest(page);
          if (variant) {
            counts.chest += 1;
            decisionTrace.push(`T${currentTurn}/${activeSeat} CHEST ${variant}`);
            continue;
          }
        }
        // Rule d — top-off mystic if nothing else moves; quietly
        // pumps green into the next turn. If neither, fall through.
        if (await tryBuyMystic(page)) {
          counts.mystic += 1;
          decisionTrace.push(`T${currentTurn}/${activeSeat} MYSTIC`);
        }
        break;
      }

      await endTurn(page);
    }

    // ---- Final tray reads ----
    // Skip screenshot — at TURN_CAP the test is up against the wall-clock
    // budget. Numeric/state findings are captured below; visual
    // confirmation is not load-bearing for a tuning-validation walk.
    const p0Final = await readSeat(page, 'p0');
    const p1Final = await readSeat(page, 'p1');
    const p0HpText =
      (await page
        .locator('[data-testid="player-tray-p0"]')
        .innerText()
        .catch(() => '')) ?? '';
    const p1HpText =
      (await page
        .locator('[data-testid="player-tray-p1"]')
        .innerText()
        .catch(() => '')) ?? '';
    const zoneText =
      (await page
        .locator('[data-testid="zone-label"]')
        .innerText()
        .catch(() => '')) ?? '';

    const consoleSummary = consoleEvents.length
      ? `\n\n### Console events (${consoleEvents.length})\n\n` +
        consoleEvents
          .slice(0, 15)
          .map((e) => `- \`${e}\``)
          .join('\n')
      : '\n\n### Console events\n\n_None observed._';

    const decisionTail = decisionTrace
      .slice(-30)
      .map((d) => `- ${d}`)
      .join('\n');

    const summary =
      `Smart 2P co-op walk, ${run}: ${counts.play} hand plays, ${counts.trade} key-vendor trades, ${counts.chest} chest opens, **${counts.buy} field buys**, ${counts.mystic} mystic buys. Field buys per seat: p0=${fieldBuysPerSeat.p0}, p1=${fieldBuysPerSeat.p1}. Quota=${FIELD_BUY_QUOTA_PER_SEAT}/seat, trade-green-floor=${TRADE_GREEN_FLOOR}, trade-key-cap=${TRADE_KEY_CAP}.\n\n` +
      `### Final state\n\n` +
      `- Zone: \`${zoneText}\`\n` +
      `- p0 HP/tray: \`${p0HpText.replace(/\n/g, ' | ').slice(0, 200)}\` → ${fmtSeat(p0Final)}\n` +
      `- p1 HP/tray: \`${p1HpText.replace(/\n/g, ' | ').slice(0, 200)}\` → ${fmtSeat(p1Final)}\n\n` +
      `### Decision tail (last 30)\n\n${decisionTail || '_no decisions logged._'}` +
      consoleSummary;

    await report.finalize(summary);

    // Structural-only — no balance asserts. Skill says numbers go in
    // the narrative report, not expect().
    expect(await page.locator('[data-testid="app-root"]').count()).toBeGreaterThan(0);
    expect(counts.play).toBeGreaterThan(0);
  });
}
