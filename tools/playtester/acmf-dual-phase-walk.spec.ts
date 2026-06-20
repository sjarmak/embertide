/**
 * Scenario: acmf — dual-phase audit verification walk (2026-04-25).
 *
 * Bead: embertide-acmf ("wun (D): playtest tuning pass after dual-
 * phase effects ship"). The dual-phase audit landed in 3 commits:
 *   - 7828d24 (s2ub) — 9 supply items fire on-equip equip-bonus
 *   - c73729f (uz7k) — 6 heirlooms fire on-equip
 *   - c03c872 (mvjx) — scholar-princess (+2g) / ranch-keeper (+1g)
 * mains. This spec generates play-signal for the 5 tuning questions
 * filed on the bead. Per the playtester skill: NO balance asserts,
 * findings go in the narrative report only.
 *
 * Approach: drive a fresh 2-player co-op game through ~16 seat-turns
 * on three independently-seeded runs (one per top-level test() — the
 * Date.now() seed inside `initGame` re-rolls per boot).
 *
 * On each seat-turn, in order:
 *   1. Dismiss any tutorial / chest-reveal overlay.
 *   2. Play hand cards greedily (max-out the resources first).
 *   3. Trade green→key via Pell when 4g+ available (only one trade
 *      per turn — Pell is gated on green pool, so a single 4g pool
 *      yields exactly one key).
 *   4. Open the cheapest affordable chest (mints supply item → fires
 *      `equip-bonus` on equip, e.g. tower-shield +1 gem).
 *   5. Buy the cheapest non-monster field card (heroes / items).
 *   6. Snapshot AFTER actions and BEFORE End Turn (the End phase zeros
 *      green/red, so a pre-End snapshot is the only way to read peak
 *      resource values per turn).
 *   7. End Turn.
 *
 * Snapshots fire at turns 5 / 10 / 15 by reading the turn-count chip.
 * Each snapshot records: green / red / keys / items / chestsOpened
 * for both seats, plus deck/discard/hand IDs.
 *
 * Run: `PLAYTEST_NARRATE=1 pnpm playtest acmf-dual-phase-walk.spec.ts`
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

interface SeatSnapshot {
  readonly seat: 'p0' | 'p1';
  readonly green: number;
  readonly red: number;
  readonly keys: number;
  readonly items: number;
  readonly chests: number;
}

interface TurnSnapshot {
  readonly turn: number;
  readonly active: string;
  readonly deck: number;
  readonly discard: number;
  readonly handSize: number;
  readonly handIds: readonly string[];
  readonly p0: SeatSnapshot;
  readonly p1: SeatSnapshot;
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

async function readSeatSnapshot(page: Page, seat: 'p0' | 'p1'): Promise<SeatSnapshot> {
  return {
    seat,
    green: await readNumber(page.locator(`[data-testid="tray-green-${seat}"]`)),
    red: await readNumber(page.locator(`[data-testid="tray-red-${seat}"]`)),
    keys: await readNumber(page.locator(`[data-testid="tray-keys-${seat}"]`)),
    items: await readNumber(page.locator(`[data-testid="tray-items-${seat}"]`)),
    chests: await readNumber(page.locator(`[data-testid="tray-chests-${seat}"]`)),
  };
}

async function readBoardHandIds(page: Page): Promise<string[]> {
  const handles = await page.locator('[data-testid^="hand-card-"]').all();
  const ids: string[] = [];
  for (const h of handles) {
    const tid = await h.getAttribute('data-testid').catch(() => null);
    if (tid && tid.startsWith('hand-card-')) ids.push(tid.slice('hand-card-'.length));
  }
  return ids;
}

async function readTurnSnapshot(page: Page, turn: number): Promise<TurnSnapshot> {
  const activeText =
    (await page
      .locator('[data-testid="active-player"]')
      .innerText()
      .catch(() => '')) ?? '';
  const handIds = await readBoardHandIds(page);
  return {
    turn,
    active: activeText.replace(/^ACTIVE:\s*/i, '').trim() || activeText.trim(),
    deck: await readNumber(page.locator('[data-testid="deck-count"]')),
    discard: await readNumber(page.locator('[data-testid="discard-count"]')),
    handSize: handIds.length,
    handIds,
    p0: await readSeatSnapshot(page, 'p0'),
    p1: await readSeatSnapshot(page, 'p1'),
  };
}

function fmtSeat(s: SeatSnapshot): string {
  return `${s.seat}{g=${s.green} r=${s.red} k=${s.keys} items=${s.items} chests=${s.chests}}`;
}

function fmtTurn(s: TurnSnapshot): string {
  return `T${s.turn} active=${s.active} deck=${s.deck} discard=${s.discard} hand=${s.handSize}[${s.handIds.join(',')}] | ${fmtSeat(s.p0)} | ${fmtSeat(s.p1)}`;
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

/** Play every card currently in hand (loop, not a for-each over a frozen list). */
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

/** Trade with Pell (key-vendor) once if affordable. */
async function tryTradeKeyVendor(page: Page): Promise<boolean> {
  const vendor = page.locator('[data-testid="always-available-key-vendor"]');
  if ((await vendor.count()) === 0) return false;
  const disabled = await vendor
    .first()
    .evaluate((el) => (el as HTMLButtonElement).disabled)
    .catch(() => true);
  if (disabled) return false;
  await vendor
    .first()
    .click({ force: true })
    .catch(() => undefined);
  await page.waitForTimeout(140);
  await clearOverlays(page);
  return true;
}

/** Open the cheapest affordable chest. Returns the variant or null. */
async function tryOpenChest(page: Page): Promise<string | null> {
  for (const variant of ['std', 'mid', 'boss'] as const) {
    const chest = page.locator(`[data-testid="chest-slot-${variant}"]`);
    if ((await chest.count()) === 0) continue;
    const disabled = await chest
      .first()
      .evaluate((el) => (el as HTMLButtonElement).disabled)
      .catch(() => true);
    if (disabled) continue;
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

/** Buy the cheapest enabled non-monster field card (skips monsters). */
async function tryBuyField(page: Page): Promise<string | null> {
  const cards = page.locator(
    '[data-testid^="field-card-"]:not([disabled]):not([data-role="monster"]):not([data-role="mini-boss"]):not([data-role="final-boss"])',
  );
  if ((await cards.count()) === 0) return null;
  const first = cards.first();
  const id = (await first.getAttribute('data-testid'))?.replace(/^field-card-/, '') ?? null;
  await first.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(160);
  await clearOverlays(page);
  return id;
}

/** Buy the always-available mystic (gain +2g, +3g cost — net shard bank). */
async function tryBuyMystic(page: Page): Promise<boolean> {
  const tile = page.locator('[data-testid="always-available-mystic"]');
  if ((await tile.count()) === 0) return false;
  const disabled = await tile
    .first()
    .evaluate((el) => (el as HTMLButtonElement).disabled)
    .catch(() => true);
  if (disabled) return false;
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
  test(`acmf-dual-phase-walk — ${run} (16-turn fresh 2P co-op)`, async ({ page }) => {
    test.setTimeout(180_000);
    const report = createReporter(`acmf-dual-phase-walk-${run}`);
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

    // ---- Boot through fresh Setup (no debug seed, fresh Date.now() seed) ----
    await bootApp(page);
    await dismissTutorials(page);
    report.step(`booted ${run} (fresh Date.now() seed via Setup → initGame)`);

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
    const startBtn = page.locator('[data-testid="start-button"]');
    await startBtn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
    await dismissTutorials(page);
    await page.waitForSelector('[data-testid="game-board"]', { state: 'visible', timeout: 10_000 });

    const initial = await readTurnSnapshot(page, 1);
    report.step(`initial state: ${fmtTurn(initial)}`);
    await report.screenshot(page, '01-board-fresh');

    // ---- Walk loop. Each iteration is one *seat-turn*. After seat-1's
    // End Turn the turn-count bumps. We capture snapshots AFTER plays /
    // buys / chests / vendors but BEFORE End Turn (end zeros green/red).
    const captured: TurnSnapshot[] = [];
    const captureTurns = new Set([5, 10, 15]);
    const capturedSeats = new Set<string>(); // turn-seat key, e.g. "5-PLAYER 1"

    const purchaseLog: Array<{
      turn: number;
      active: string;
      kind: 'chest' | 'buy' | 'play' | 'trade' | 'mystic';
      id: string;
    }> = [];
    const playHistogram: Record<string, number> = {};

    for (let seatTurn = 0; seatTurn < 32; seatTurn += 1) {
      const turnText =
        (await page
          .locator('[data-testid="turn-count"]')
          .innerText()
          .catch(() => '')) ?? '';
      const turnMatch = turnText.match(/TURN\s+(\d+)/i);
      const currentTurn = turnMatch ? Number(turnMatch[1]) : 1;
      if (currentTurn > 16) break;
      const activeText =
        (await page
          .locator('[data-testid="active-player"]')
          .innerText()
          .catch(() => '')) ?? '';

      // Per seat-turn micro-action sequence — play first (so green
      // accumulates), then trade, then chest, then field-buy.
      const played = await playAllInHand(page);
      for (const id of played) {
        playHistogram[id] = (playHistogram[id] ?? 0) + 1;
        purchaseLog.push({ turn: currentTurn, active: activeText, kind: 'play', id });
      }

      // Trade once per turn — Pell: 4g → 1 key. Repeat-call only useful
      // when green ≥ 8, which won't happen turn 1-2 but might from turn
      // 5+ once mystic buys are netting +2g per buy.
      let trades = 0;
      while (trades < 3 && (await tryTradeKeyVendor(page))) {
        trades += 1;
        purchaseLog.push({
          turn: currentTurn,
          active: activeText,
          kind: 'trade',
          id: 'key-vendor',
        });
      }

      const chestVariant = await tryOpenChest(page);
      if (chestVariant) {
        purchaseLog.push({
          turn: currentTurn,
          active: activeText,
          kind: 'chest',
          id: chestVariant,
        });
      }

      // Field buy — supply items will be present in the field row. Try
      // up to 2 buys per turn (some turns we have leftover green after
      // the chest open).
      for (let i = 0; i < 2; i += 1) {
        const bought = await tryBuyField(page);
        if (!bought) break;
        purchaseLog.push({ turn: currentTurn, active: activeText, kind: 'buy', id: bought });
      }

      // Mystic top-off (gain +2g back) — keeps the green pump primed
      // when nothing else is affordable.
      if (await tryBuyMystic(page)) {
        purchaseLog.push({ turn: currentTurn, active: activeText, kind: 'mystic', id: 'mystic' });
      }

      // SNAPSHOT post-actions, pre-End. One per (turn, active-player) so
      // we get both seats' peaks at each capture turn.
      if (captureTurns.has(currentTurn)) {
        const key = `${currentTurn}-${activeText}`;
        if (!capturedSeats.has(key)) {
          const snap = await readTurnSnapshot(page, currentTurn);
          captured.push(snap);
          capturedSeats.add(key);
          report.step(`SNAP turn=${currentTurn} active=${activeText}: ${fmtTurn(snap)}`);
        }
      }

      await endTurn(page);
    }

    const finalSnap = await readTurnSnapshot(page, -1);
    captured.push(finalSnap);
    report.step(`FINAL: ${fmtTurn(finalSnap)}`);
    await report.screenshot(page, '02-board-final');

    // ---- Compose summary table ----
    const tableHeader = `| turn | active | deck | hand | p0.green | p0.red | p0.keys | p0.items | p0.chests | p1.green | p1.red | p1.keys | p1.items | p1.chests |\n`;
    const tableSep = `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    const tableRows = captured
      .map(
        (s) =>
          `| ${s.turn} | ${s.active} | ${s.deck} | ${s.handSize} | ${s.p0.green} | ${s.p0.red} | ${s.p0.keys} | ${s.p0.items} | ${s.p0.chests} | ${s.p1.green} | ${s.p1.red} | ${s.p1.keys} | ${s.p1.items} | ${s.p1.chests} |`,
      )
      .join('\n');

    const counts = {
      chest: 0,
      buy: 0,
      play: 0,
      trade: 0,
      mystic: 0,
    } as const as Record<string, number>;
    for (const p of purchaseLog) counts[p.kind] = (counts[p.kind] ?? 0) + 1;

    const purchases = purchaseLog
      .filter((p) => p.kind !== 'play')
      .map((p) => `- T${p.turn} (${p.active}) **${p.kind}** \`${p.id}\``)
      .join('\n');

    const histTop = Object.entries(playHistogram)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([id, n]) => `\`${id}\`×${n}`)
      .join(', ');

    const consoleSummary = consoleEvents.length
      ? `\n\n### Console events (${consoleEvents.length})\n\n` +
        consoleEvents
          .slice(0, 15)
          .map((e) => `- \`${e}\``)
          .join('\n')
      : '\n\n### Console events\n\n_None observed._';

    const summary =
      `Fresh 2P co-op walk, ${run}: ${counts.play ?? 0} hand plays, ${counts.trade ?? 0} key-vendor trades, ${counts.chest ?? 0} chest opens, ${counts.buy ?? 0} field buys, ${counts.mystic ?? 0} mystic buys.\n\n` +
      `### Snapshots (turn 5 / 10 / 15 — captured AFTER plays + buys, BEFORE End Turn zeroes green/red)\n\n${tableHeader}${tableSep}${tableRows}\n\n` +
      `### Purchases\n\n` +
      (counts.chest + counts.buy + counts.trade + counts.mystic > 0
        ? purchases
        : '_No purchases — economy never crossed any cost threshold._') +
      `\n\n### Top played cards\n\n${histTop || '_No plays recorded._'}` +
      consoleSummary;

    await report.finalize(summary);

    // No balance asserts — playtester skill says numbers go in narrative
    // not expect(). Only structural sanity.
    expect(await page.locator('[data-testid="app-root"]').count()).toBeGreaterThan(0);
    expect(captured.length).toBeGreaterThan(0);
  });
}
