/**
 * Scenario: Vurmox final-boss loot feel (embertide-g5mu — ycj.1).
 *
 * Tuning question: Vurmox hearts = 4 + power-shard + courage-shard = 6.
 * Open call is whether 4 → 5 (Vurmox base) makes the encounter feel
 * less like a loot anticlimax. Prism Chimera sits at 5 (parity
 * ceiling) but it's optional, so 5 for Vurmox would still respect
 * tier ordering.
 *
 * Metric: rounds-to-kill + final hp + post-defeat win-state state
 * (sharedTriforce, princessCrystal). Boots ?debug=temple-combat which
 * drops into cagewright-vurmox combat in Gilded Cage. Greedy
 * policy. Spec only asserts combat terminates; numbers go in the
 * narrative report.
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

interface PostState {
  readonly p0Hp: { hp: number; hpMax: number };
  readonly p1Hp: { hp: number; hpMax: number };
  readonly outcome: string | null;
  readonly sharedTriforce: { wisdom: boolean; courage: boolean; power: boolean };
  readonly princessCrystal: { charges: number; freed: boolean };
  readonly defeatedBossIds: string[];
}

async function readPostState(page: Page): Promise<PostState | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          players: { hp: number; hpMax: number }[];
          outcome: string | null;
          sharedTriforce: { wisdom: boolean; courage: boolean; power: boolean };
          princessCrystal: { charges: number; freed: boolean };
          defeatedBossIds: string[];
        };
      };
    };
    const s = w.__gameStore?.getState();
    if (!s) return null;
    return {
      p0Hp: { hp: s.players[0].hp, hpMax: s.players[0].hpMax },
      p1Hp: { hp: s.players[1].hp, hpMax: s.players[1].hpMax },
      outcome: s.outcome,
      sharedTriforce: { ...s.sharedTriforce },
      princessCrystal: { ...s.princessCrystal },
      defeatedBossIds: [...s.defeatedBossIds],
    };
  });
}

test('vurmox-loot-feel — Vurmox kill hp + win-state', async ({ page }) => {
  test.setTimeout(180_000);
  const report = createReporter('vurmox-loot-feel');
  await bootApp(page, { debug: 'temple-combat' });
  await dismissTutorials(page);

  const initial = await snapshot(page);
  report.step(
    `pre-combat: boss=${initial.boss[0]}/${initial.boss[1]} (Vurmox) hand=${initial.handSize}`,
  );
  await report.screenshot(page, '01-combat-start');

  const MAX_ROUNDS = 40;
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

  const post = await readPostState(page);
  await report.screenshot(page, '02-post-combat');
  await report.finalize(
    `Vurmox combat terminated in **${rounds} rounds** (boss starting HP ${initial.boss[1]}). ` +
      `outcome=${post?.outcome}, defeated=[${post?.defeatedBossIds.join(', ')}]. ` +
      `p0=${post?.p0Hp.hp}/${post?.p0Hp.hpMax} p1=${post?.p1Hp.hp}/${post?.p1Hp.hpMax}. ` +
      `Embertide=${JSON.stringify(post?.sharedTriforce)}, Crystal=${JSON.stringify(post?.princessCrystal)}. ` +
      `Reward signal = post-defeat hp + win-state surfaces vs Vurmox HP=${initial.boss[1]}.`,
  );

  expect(rounds).toBeLessThan(MAX_ROUNDS);
});
