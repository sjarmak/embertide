/**
 * Scenario: Wild-boss loot pacing (embertide-g5mu — ycj.1).
 *
 * Tuning question: does the wild-boss tier feel "stingy" given that
 * every wild also drops a wisp? The 2026-04-22 nibble bumped king-
 * ashjaw hearts 2 → 4 and the open call is whether Sentinel (Death
 * Mountain wild) wants 2 → 3 — which would force Silver Chimera ≥ 5
 * and compress its gap to Prism Chimera.
 *
 * ons0 (ycj.1.1, 2026-05-01) — parametrized across 4 wild-boss arms
 * (craghorn / sentinel / silver-chimera / boulderkin) so the designer can
 * read a cross-tier hp-delta table and lock per-boss hearts tuning.
 *
 * Metric: per-player hp delta (hp_before vs hp_after) across one
 * wild-boss kill. Boots ?debug=<arm.seed>. Greedy "play first card,
 * repeat, pass turn" policy. Numeric findings go to the narrative
 * report; spec only asserts combat terminates.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  bootApp,
  clickFirstCard,
  combatEnded,
  dismissTutorials,
  passTurn,
  snapshot,
} from './harness';
import { createReporter } from './narrative';

interface HpRead {
  readonly p0: { hp: number; hpMax: number };
  readonly p1: { hp: number; hpMax: number };
}

interface WildBossArm {
  readonly slug: string;
  readonly debug: string;
  readonly bossLabel: string;
  readonly zoneLabel: string;
  readonly bossHp: number;
}

const ARMS: readonly WildBossArm[] = [
  { slug: 'craghorn', debug: 'craghorn', bossLabel: 'Craghorn', zoneLabel: 'Sylvani', bossHp: 10 },
  {
    slug: 'sentinel',
    debug: 'sentinel-combat',
    bossLabel: 'Sentinel',
    zoneLabel: 'Temple',
    bossHp: 10,
  },
  {
    slug: 'silver-chimera',
    debug: 'silver-chimera-combat',
    bossLabel: 'Silver Chimera',
    zoneLabel: 'Temple',
    bossHp: 15,
  },
  {
    slug: 'boulderkin',
    debug: 'boulderkin-combat',
    bossLabel: 'Boulderkin',
    zoneLabel: 'Emberpeak',
    bossHp: 10,
  },
];

async function readHp(page: Page): Promise<HpRead | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: { getState(): { players: { hp: number; hpMax: number }[] } };
    };
    const s = w.__gameStore?.getState();
    if (!s) return null;
    return {
      p0: { hp: s.players[0].hp, hpMax: s.players[0].hpMax },
      p1: { hp: s.players[1].hp, hpMax: s.players[1].hpMax },
    };
  });
}

for (const arm of ARMS) {
  test(`wild-boss-loot-pacing — ${arm.slug} kill hp delta`, async ({ page }) => {
    test.setTimeout(120_000);
    const report = createReporter(`wild-boss-loot-pacing-${arm.slug}`);
    await bootApp(page, { debug: arm.debug });
    await dismissTutorials(page);

    const before = await readHp(page);
    report.step(
      `pre-combat hp: p0=${before?.p0.hp}/${before?.p0.hpMax} p1=${before?.p1.hp}/${before?.p1.hpMax}`,
    );
    await report.screenshot(page, '01-combat-start');

    const MAX_ROUNDS = 30;
    let rounds = 0;
    while (!(await combatEnded(page)) && rounds < MAX_ROUNDS) {
      for (let i = 0; i < 3; i += 1) {
        const s = await snapshot(page);
        if (s.ended || s.handSize === 0 || s.plays[0] >= s.plays[1]) break;
        await clickFirstCard(page);
        await dismissTutorials(page);
      }
      if (await combatEnded(page)) break;
      await passTurn(page);
      await dismissTutorials(page);
      rounds += 1;
    }

    const after = await readHp(page);
    await report.screenshot(page, '02-post-combat');
    const dp0 = after && before ? after.p0.hp - before.p0.hp : null;
    const dp1 = after && before ? after.p1.hp - before.p1.hp : null;
    await report.finalize(
      `Wild-boss (${arm.bossLabel} / ${arm.zoneLabel}) terminated in **${rounds} rounds**. ` +
        `HP delta — p0: ${before?.p0.hp}/${before?.p0.hpMax} → ${after?.p0.hp}/${after?.p0.hpMax} (Δ${dp0}); ` +
        `p1: ${before?.p1.hp}/${before?.p1.hpMax} → ${after?.p1.hp}/${after?.p1.hpMax} (Δ${dp1}). ` +
        `Greedy policy. Reward signal = post-fight hp delta vs ${arm.bossLabel} HP=${arm.bossHp} boss.`,
    );

    expect(rounds).toBeLessThan(MAX_ROUNDS);
  });
}
