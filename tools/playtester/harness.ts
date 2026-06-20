/**
 * Playtester harness (embertide-ov9).
 *
 * Shared helpers for Playwright-driven playtest scenarios. Scenarios
 * live alongside this file and import the helpers to keep individual
 * spec files thin (<30 lines apiece). See also: docs/playtester-guide.md.
 */

import type { Page } from '@playwright/test';

export interface BootOptions {
  /** `?debug=<seed>` playtest-seed hook. Omit for normal Setup flow. */
  readonly debug?: string;
  /** Dev server base URL. Defaults to http://localhost:5173. */
  readonly baseURL?: string;
}

/**
 * Boot the app at the configured base URL, optionally appending a
 * ?debug=<seed> query string. Waits for either the Setup screen or the
 * GameBoard to be visible before returning.
 */
export async function bootApp(page: Page, options: BootOptions = {}): Promise<void> {
  // Prefer relative URLs so Playwright's config.use.baseURL drives the
  // actual host+port — that's the authoritative source (respects the
  // config's auto-spawn webServer port and any `PLAYWRIGHT_BASE_URL`
  // override). Only fall back to an explicit absolute URL when the
  // caller passes one in `options.baseURL`.
  const path = options.debug ? `/?debug=${options.debug}` : '/';
  const url = options.baseURL ? `${options.baseURL}${path}` : path;
  await page.goto(url, { waitUntil: 'networkidle' });
  // Wait for either the app-root or the combat-screen (debug-seed case)
  // or the setup surface to appear.
  await page.waitForSelector(
    '[data-testid="combat-screen"], [data-testid="game-board"], [data-testid="champion-picker"], form, main',
    { state: 'visible', timeout: 10_000 },
  );
}

/** Read the boss HP readout ("N / M") as a tuple [current, max]. */
export async function readBossHp(page: Page): Promise<[number, number]> {
  const text = await page.locator('[data-testid="combat-boss-hp-readout"]').innerText();
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) throw new Error(`readBossHp: unexpected text "${text}"`);
  return [Number(match[1]), Number(match[2])];
}

/** Count cards currently in the combat hand. */
export async function readHandSize(page: Page): Promise<number> {
  return page.locator('[data-testid^="combat-hand-slot-"]').count();
}

/** Read the card ids currently in the combat hand (stable order). */
export async function readHandCardIds(page: Page): Promise<string[]> {
  const handles = await page.locator('[data-testid^="combat-hand-slot-"]').all();
  const ids: string[] = [];
  for (const h of handles) {
    const cid = await h.getAttribute('data-card-id');
    if (cid) ids.push(cid);
  }
  return ids;
}

/** Read the "Plays this turn: N/M" counter as a tuple [N, M]. */
export async function readPlaysCounter(page: Page): Promise<[number, number]> {
  const text = await page.locator('[data-testid="combat-plays-counter"]').innerText();
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) throw new Error(`readPlaysCounter: unexpected text "${text}"`);
  return [Number(match[1]), Number(match[2])];
}

/** Read all combat-log entries in display order. */
export async function readCombatLog(page: Page): Promise<string[]> {
  // CombatLog renders the last 3 events in <li> items inside the log.
  // Quick bail when the log isn't mounted (combat ended, or the surface
  // changed). Timeout is kept tight so a missing log doesn't gate a
  // whole scenario run.
  const log = page.locator('[data-testid="combat-log"]');
  if ((await log.count()) === 0) return [];
  const text = await log.innerText({ timeout: 2_000 }).catch(() => '');
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Click a specific hand slot by index. */
export async function clickSlot(page: Page, idx: number): Promise<void> {
  await page.locator(`[data-testid="combat-hand-slot-${idx}"]`).click();
  await page.waitForTimeout(50);
}

/** Click the first card in hand (useful when the agent doesn't care which). */
export async function clickFirstCard(page: Page): Promise<string | null> {
  const ids = await readHandCardIds(page);
  if (ids.length === 0) return null;
  await clickSlot(page, 0);
  return ids[0];
}

/**
 * Dismiss any open tutorial backdrop (main or combat). Some scenarios
 * boot with one or both overlays up; call this in the scenario's
 * preamble to clear them before clicking game buttons. Stack-safe:
 * dismisses main first (it's on top), then combat.
 */
export async function dismissTutorials(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const mainDismiss = page.locator('[data-testid="tutorial-dismiss"]');
    if (await mainDismiss.count()) {
      await mainDismiss.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(80);
      continue;
    }
    const combatDismiss = page.locator('[data-testid="combat-tutorial-dismiss"]');
    if (await combatDismiss.count()) {
      await combatDismiss.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(80);
      continue;
    }
    break;
  }
}

/** Press the Pass Turn button; resolves the boss attack immediately. */
export async function passTurn(page: Page): Promise<void> {
  await page.locator('[data-testid="combat-pass-turn"]').click();
  await page.waitForTimeout(100);
}

/** True when activeCombat is null — i.e., combat has ended. */
export async function combatEnded(page: Page): Promise<boolean> {
  const count = await page.locator('[data-testid="combat-screen"]').count();
  return count === 0;
}

/**
 * Read player HP. Prefers the main-board `player-tray-<id>` surface;
 * falls back to the CombatScreen's `combat-player-hp-readout-<id>`
 * when the tray is unmounted (CombatScreen replaces the main board
 * during combat). Returns null when neither surface is present.
 */
export async function readPlayerHp(
  page: Page,
  playerId: string = 'p0',
): Promise<[number, number] | null> {
  const tray = page.locator(`[data-testid="player-tray-${playerId}"]`);
  if (await tray.count()) {
    const text = await tray.innerText({ timeout: 2_000 }).catch(() => '');
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  const combatHp = page.locator(`[data-testid="combat-player-hp-readout-${playerId}"]`);
  if (await combatHp.count()) {
    const text = await combatHp.innerText({ timeout: 2_000 }).catch(() => '');
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  return null;
}

/**
 * Snapshot of the current combat state for narrative reporting.
 * Intentionally shallow — raw strings/numbers so reports can be
 * diffed as plain markdown.
 */
export interface CombatSnapshot {
  readonly boss: [number, number];
  readonly handSize: number;
  readonly handIds: readonly string[];
  readonly plays: [number, number];
  readonly p0Hp: [number, number] | null;
  readonly p1Hp: [number, number] | null;
  readonly log: readonly string[];
  readonly ended: boolean;
}

export async function snapshot(page: Page): Promise<CombatSnapshot> {
  const ended = await combatEnded(page);
  if (ended) {
    return {
      boss: [0, 0],
      handSize: 0,
      handIds: [],
      plays: [0, 0],
      p0Hp: await readPlayerHp(page, 'p0').catch(() => null),
      p1Hp: await readPlayerHp(page, 'p1').catch(() => null),
      log: [],
      ended: true,
    };
  }
  return {
    boss: await readBossHp(page),
    handSize: await readHandSize(page),
    handIds: await readHandCardIds(page),
    plays: await readPlaysCounter(page),
    p0Hp: await readPlayerHp(page, 'p0'),
    p1Hp: await readPlayerHp(page, 'p1'),
    log: await readCombatLog(page),
    ended: false,
  };
}

/** Format a snapshot as a one-line string for narrative logs. */
export function formatSnapshot(s: CombatSnapshot): string {
  if (s.ended) return `COMBAT ENDED — p0=${s.p0Hp} p1=${s.p1Hp}`;
  return `boss=${s.boss[0]}/${s.boss[1]} hand=${s.handSize}(${s.handIds.join(',')}) plays=${s.plays[0]}/${s.plays[1]} p0=${s.p0Hp} p1=${s.p1Hp}`;
}
