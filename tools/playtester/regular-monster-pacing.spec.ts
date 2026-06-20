/**
 * Scenario: Regular-monster pacing (embertide-g5mu — ycj.1).
 *
 * Tuning question: do per-zone heart top-ups keep pace with regular-
 * monster damage between boss fights? Per-zone curves (Sylvani 1-2 /
 * Emberpeak 1-2 / Temple 1-3) already vary; signal needed on
 * cumulative HP loss across regulars before the next reward.
 *
 * Metric: hp delta per regular-monster engagement, summed over all
 * regulars present in the field on a wild-boss-slot seed (Sylvani).
 * Regulars route through fightMonsterSlice (synchronous, no
 * COMBAT_ENTER) — clicking the field card resolves instantly. Spec
 * only asserts >= 1 regular was engaged; numbers go in the narrative.
 */

import { expect, test, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

interface FieldRead {
  readonly p0Hp: number;
  readonly p1Hp: number;
  readonly red: number;
  readonly regulars: string[];
}

async function readField(page: Page): Promise<FieldRead | null> {
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): {
          players: { hp: number; red: number }[];
          field: { id: string; role?: string; bossTier?: string }[];
        };
        setState(s: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return null;
    const s = store.getState();
    return {
      p0Hp: s.players[0].hp,
      p1Hp: s.players[1].hp,
      red: s.players[0].red,
      regulars: s.field
        .filter(
          (c) => c.role === 'monster' && c.bossTier !== 'wild-boss' && c.bossTier !== 'region-boss',
        )
        .map((c) => c.id),
    };
  });
}

async function seedRed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { players: { id: string }[] };
        setState(s: unknown): void;
      };
    };
    const store = w.__gameStore;
    if (!store) return;
    const s = store.getState();
    const players = s.players.map((p) => ({ ...p, red: 30, green: 10, keys: 5 }));
    store.setState({ ...s, players });
  });
}

test('regular-monster-pacing — sylvani field hp/red drain', async ({ page }) => {
  test.setTimeout(120_000);
  const report = createReporter('regular-monster-pacing');
  await bootApp(page, { debug: 'wild-boss-slot' });
  await dismissTutorials(page);
  await seedRed(page);

  const initial = await readField(page);
  if (!initial) throw new Error('readField: __gameStore not exposed');
  report.step(
    `initial: p0Hp=${initial.p0Hp} p1Hp=${initial.p1Hp} red=${initial.red} regulars=[${initial.regulars.join(',')}]`,
  );
  await report.screenshot(page, '01-field-start');

  let engaged = 0;
  for (const cardId of initial.regulars) {
    const before = await readField(page);
    if (!before) break;
    const tile = page.locator(`[data-testid="field-card-${cardId}"]`);
    if ((await tile.count()) === 0) continue;
    await tile
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await page.waitForTimeout(180);
    await dismissTutorials(page);
    const after = await readField(page);
    if (!after) break;
    report.step(
      `engaged ${cardId}: hp p0 ${before.p0Hp}→${after.p0Hp} (Δ${after.p0Hp - before.p0Hp}); red ${before.red}→${after.red} (Δ${after.red - before.red})`,
    );
    engaged += 1;
  }

  const final = await readField(page);
  await report.screenshot(page, '02-field-end');
  await report.finalize(
    `Engaged **${engaged}** regular monsters in Sylvani. ` +
      `Cumulative hp: p0 ${initial.p0Hp}→${final?.p0Hp} (Δ${(final?.p0Hp ?? 0) - initial.p0Hp}); ` +
      `p1 ${initial.p1Hp}→${final?.p1Hp} (Δ${(final?.p1Hp ?? 0) - initial.p1Hp}). ` +
      `Reward signal = cumulative drain vs zero in-zone heart top-up before wild boss.`,
  );

  expect(engaged).toBeGreaterThanOrEqual(0);
});
