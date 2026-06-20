/**
 * Scenario: Regular-monster damage attribution (embertide-3wsx — ycj.1.2).
 *
 * Tuning question (per bead): "compare cumulative regular-monster damage
 * to the heart top-up landed on boss defeat".
 *
 * Architectural caveat surfaced during authoring: `buildCombatDeck`
 * (src/core/combat/deck.ts) only pulls heroes + active items from the
 * two players — regular monsters are NOT shuffled into a boss combat
 * deck. The boss attacks via its `attackPattern.damagePerTurn` (or a
 * registered `bossAttackResolver`), routed through `targeting`. There
 * is no "regular monster card resolved an attack" step on the boss side.
 *
 * Re-scope (autonomously chosen, surfaced in the report): instead of
 * attributing boss-turn damage by source CARD (impossible — only the
 * boss attacks), attribute it by:
 *   - resolver  (static dpt vs registered bossAttackResolver id)
 *   - phase     (normal vs desperation AoE — `boss.hp < 25% hpMax`)
 *   - targeting (player-hp / battlefield-then-player / aoe)
 * and compare cumulative damage to the on-defeat heart top-up. This
 * gives the same downstream answer ("does boss combat drain players
 * faster than the on-defeat reward heals?") without inventing a
 * mechanic that doesn't exist.
 *
 * Spec asserts only structural invariants (combat terminates).
 * Numeric findings live in the narrative report.
 */

import { expect, test, type Page } from '@playwright/test';
import { bootApp, clickFirstCard, combatEnded, dismissTutorials, passTurn } from './harness';
import { createReporter } from './narrative';

interface CombatRead {
  readonly bossHp: number;
  readonly bossHpMax: number;
  readonly bossSourceId: string;
  readonly resolverId: string | null;
  readonly damagePerTurn: number;
  readonly targeting: string;
  readonly bossStunTurns: number;
  readonly turnIndex: number;
  readonly activeActor: string;
  readonly playsThisTurn: number;
  readonly p0Hp: number;
  readonly p0HpMax: number;
  readonly p1Hp: number;
  readonly p1HpMax: number;
  readonly inCombat: boolean;
}

interface MainBoardRead {
  readonly p0Hp: number;
  readonly p1Hp: number;
}

async function readCombat(page: Page): Promise<CombatRead | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          players: { hp: number; hpMax: number }[];
          activeCombat: {
            boss: {
              hp: number;
              hpMax: number;
              sourceCardId: string;
              attackPattern: {
                damagePerTurn: number;
                targeting: string;
                bossAttackResolver?: string;
              };
            };
            turnIndex: number;
            activeActor: string;
            bossStunTurns?: number;
            playsThisTurn?: number;
          } | null;
        };
      };
    };
    const store = w.__gameStore;
    if (!store) return null;
    const s = store.getState();
    const c = s.activeCombat;
    return {
      bossHp: c?.boss.hp ?? 0,
      bossHpMax: c?.boss.hpMax ?? 0,
      bossSourceId: c?.boss.sourceCardId ?? '',
      resolverId: c?.boss.attackPattern.bossAttackResolver ?? null,
      damagePerTurn: c?.boss.attackPattern.damagePerTurn ?? 0,
      targeting: c?.boss.attackPattern.targeting ?? '',
      bossStunTurns: c?.bossStunTurns ?? 0,
      turnIndex: c?.turnIndex ?? 0,
      activeActor: c?.activeActor ?? '',
      playsThisTurn: c?.playsThisTurn ?? 0,
      p0Hp: s.players[0]?.hp ?? 0,
      p0HpMax: s.players[0]?.hpMax ?? 0,
      p1Hp: s.players[1]?.hp ?? 0,
      p1HpMax: s.players[1]?.hpMax ?? 0,
      inCombat: c !== null,
    };
  });
}

async function readMainBoard(page: Page): Promise<MainBoardRead | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { players: { hp: number }[] };
      };
    };
    const store = w.__gameStore;
    if (!store) return null;
    const s = store.getState();
    return { p0Hp: s.players[0]?.hp ?? 0, p1Hp: s.players[1]?.hp ?? 0 };
  });
}

interface TurnSlice {
  readonly turn: number;
  readonly bossHpBefore: number;
  readonly bossHpAfter: number;
  readonly bossDamageTaken: number;
  readonly p0Damage: number;
  readonly p1Damage: number;
  readonly resolverId: string | null;
  readonly desperation: boolean;
  readonly targeting: string;
  readonly stunned: boolean;
}

const DESPERATION_HP_PCT = 0.25; // mirror src/core/balance.ts

test('regular-monster-damage-attribution — craghorn boss-turn damage breakdown', async ({ page }) => {
  test.setTimeout(120_000);
  const report = createReporter('regular-monster-damage-attribution');

  await bootApp(page, { debug: 'craghorn' });
  await dismissTutorials(page);

  const initial = await readCombat(page);
  if (!initial || !initial.inCombat) {
    throw new Error('readCombat: craghorn seed did not enter combat');
  }
  report.step(
    `boss=${initial.bossSourceId} hp=${initial.bossHp}/${initial.bossHpMax} ` +
      `resolver=${initial.resolverId ?? 'static'} dpt=${initial.damagePerTurn} ` +
      `targeting=${initial.targeting} | p0=${initial.p0Hp}/${initial.p0HpMax} p1=${initial.p1Hp}/${initial.p1HpMax}`,
  );
  await report.screenshot(page, '01-combat-start');

  const slices: TurnSlice[] = [];
  const MAX_ROUNDS = 30;
  let rounds = 0;
  let prevBossHp = initial.bossHp;
  let prevP0Hp = initial.p0Hp;
  let prevP1Hp = initial.p1Hp;

  while (!(await combatEnded(page)) && rounds < MAX_ROUNDS) {
    // Play out the players-turn — one card at a time, capped at the
    // engine's per-turn play limit (mirrors craghorn-winnable's policy).
    for (let i = 0; i < 4; i += 1) {
      const c = await readCombat(page);
      if (!c || !c.inCombat) break;
      if (c.activeActor !== 'players') break;
      const played = await clickFirstCard(page);
      if (played === null) break;
      await dismissTutorials(page);
    }

    if (await combatEnded(page)) break;

    const before = await readCombat(page);
    if (!before || !before.inCombat) break;
    const desperationBefore = before.bossHp < DESPERATION_HP_PCT * before.bossHpMax;
    const stunnedBefore = before.bossStunTurns > 0;

    await passTurn(page);
    await dismissTutorials(page);

    const ended = await combatEnded(page);
    let bossHpAfter = 0;
    let p0HpAfter = prevP0Hp;
    let p1HpAfter = prevP1Hp;
    let targetingAfter = before.targeting;

    if (ended) {
      const main = await readMainBoard(page);
      if (main) {
        p0HpAfter = main.p0Hp;
        p1HpAfter = main.p1Hp;
      }
    } else {
      const after = await readCombat(page);
      if (!after) break;
      bossHpAfter = after.bossHp;
      p0HpAfter = after.p0Hp;
      p1HpAfter = after.p1Hp;
      targetingAfter = after.targeting;
    }

    const slice: TurnSlice = {
      turn: rounds,
      bossHpBefore: prevBossHp,
      bossHpAfter,
      bossDamageTaken: prevBossHp - bossHpAfter,
      p0Damage: prevP0Hp - p0HpAfter,
      p1Damage: prevP1Hp - p1HpAfter,
      resolverId: before.resolverId,
      desperation: desperationBefore,
      targeting: targetingAfter,
      stunned: stunnedBefore,
    };
    slices.push(slice);

    report.step(
      `T${rounds}: boss ${prevBossHp}→${bossHpAfter} (-${slice.bossDamageTaken}) | ` +
        `p0 ${prevP0Hp}→${p0HpAfter} (-${slice.p0Damage}) p1 ${prevP1Hp}→${p1HpAfter} (-${slice.p1Damage}) | ` +
        `resolver=${slice.resolverId ?? 'static'} desp=${slice.desperation} stun=${slice.stunned} target=${slice.targeting}`,
    );

    prevBossHp = bossHpAfter;
    prevP0Hp = p0HpAfter;
    prevP1Hp = p1HpAfter;
    rounds += 1;

    if (ended) break;
  }

  await report.screenshot(page, '02-combat-end');

  const finalMain = await readMainBoard(page);
  const heartTopUp = finalMain ? finalMain.p0Hp - prevP0Hp + (finalMain.p1Hp - prevP1Hp) : 0;
  const cumP0 = slices.reduce((acc, s) => acc + s.p0Damage, 0);
  const cumP1 = slices.reduce((acc, s) => acc + s.p1Damage, 0);
  const cumBoss = cumP0 + cumP1;

  // Slice cumulative damage by attribution dimension.
  const byPhase = slices.reduce(
    (acc, s) => {
      const k = s.stunned ? 'stunned' : s.desperation ? 'desperation' : 'normal';
      acc[k] = (acc[k] ?? 0) + s.p0Damage + s.p1Damage;
      return acc;
    },
    {} as Record<string, number>,
  );
  const byTargeting = slices.reduce(
    (acc, s) => {
      acc[s.targeting] = (acc[s.targeting] ?? 0) + s.p0Damage + s.p1Damage;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summary = [
    `### Architectural finding`,
    ``,
    `\`buildCombatDeck\` (src/core/combat/deck.ts) pulls only heroes + active`,
    `items from each player. Regular monsters never enter the boss combat`,
    `deck. Boss damage is computed from \`attackPattern.damagePerTurn\` (or a`,
    `registered \`bossAttackResolver\`) and routed via \`targeting\`. The`,
    `bead's premise — "regulars contribute to per-turn boss-damage rolls"`,
    `— does not match the engine. Damage attribution by **source card**`,
    `is not measurable because there is only one source: the boss itself.`,
    ``,
    `### Re-scoped attribution (this run, ${rounds} turns)`,
    ``,
    `Boss: ${initial.bossSourceId} (hp ${initial.bossHpMax}, dpt ${initial.damagePerTurn}, resolver ${initial.resolverId ?? 'static'})`,
    ``,
    `| dimension | bucket | cumulative player damage |`,
    `| --- | --- | --- |`,
    ...Object.entries(byPhase).map(([k, v]) => `| phase | ${k} | ${v} |`),
    ...Object.entries(byTargeting).map(([k, v]) => `| targeting | ${k} | ${v} |`),
    ``,
    `Total cumulative boss → players: **${cumBoss}** (p0=${cumP0}, p1=${cumP1}).`,
    `Players → boss: **${initial.bossHpMax - prevBossHp}**.`,
    ``,
    `### Heart top-up vs cumulative damage`,
    ``,
    `On-defeat heart top-up (post-combat main-board hp delta): **${heartTopUp}**.`,
    `Net hp swing across this combat: **${heartTopUp - cumBoss}** ` +
      `(positive = combat is heart-positive; negative = combat drains hearts).`,
    ``,
    `### Recommendation`,
    ``,
    `Re-scope this measurement track. The original "regular-monster damage"`,
    `concept appears to be a misreading of the engine. Two options for the`,
    `actual tuning question:`,
    ``,
    `1. Field-side regulars (already covered by g5mu's ` +
      `\`regular-monster-pacing.spec.ts\` — Sylvani found NET POSITIVE engagement).`,
    `2. Boss-side combat damage by phase (this spec). Run with N=5+ seeds`,
    `   across each zone to compare craghorn / ashen-tyrant / tidewraith / etc.`,
    `   tuning bands.`,
    ``,
    `### Confidence`,
    `N=1 run (single craghorn seed, deterministic greedy policy). For tuning`,
    `decisions, re-run with seed variation across the wild-boss roster`,
    `(craghorn / sentinel / silver-chimera / boulderkin) before drawing curves.`,
  ].join('\n');

  await report.finalize(summary);

  // Structural assertions only — numeric findings stay in the report.
  expect(rounds).toBeLessThan(MAX_ROUNDS);
  expect(slices.length).toBeGreaterThanOrEqual(1);
});
