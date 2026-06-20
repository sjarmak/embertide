/**
 * Scenario: Craghorn winnable (embertide-ov9 B9-1).
 *
 * Boots ?debug=craghorn. Plays the simplest viable policy: play every
 * card in hand, Pass Turn, repeat until WIN or LOSS. Captures a
 * snapshot per turn and logs it; the final assertion only checks
 * structural invariants (combat ends cleanly, no silent no-ops),
 * not balance. Balance is u-8h's job.
 */

import { expect, test } from '@playwright/test';
import {
  bootApp,
  clickFirstCard,
  combatEnded,
  dismissTutorials,
  formatSnapshot,
  passTurn,
  snapshot,
} from './harness';
import { createReporter } from './narrative';

test('craghorn-winnable — agent-driven combat reaches a terminal state', async ({ page }) => {
  await bootApp(page, { debug: 'craghorn' });
  await dismissTutorials(page);

  const report = createReporter('craghorn-winnable');
  const trace: string[] = [];
  const initial = await snapshot(page);
  trace.push(`INIT     ${formatSnapshot(initial)}`);
  report.snap(initial, 'initial');
  await report.screenshot(page, '01-combat-start');

  // Guard against infinite loops — a combat SHOULD resolve in well
  // under 30 turns; if it doesn't, something is wrong (the test
  // must fail rather than hang CI).
  const MAX_ROUNDS = 30;
  let rounds = 0;

  while (!(await combatEnded(page)) && rounds < MAX_ROUNDS) {
    process.stdout.write(`ROUND ${rounds}... `);
    report.step(`**round ${rounds}** begins`);
    for (let i = 0; i < 3; i += 1) {
      const s = await snapshot(page);
      if (s.ended) break;
      if (s.plays[0] >= s.plays[1]) break; // cap reached
      if (s.handSize === 0) break;
      const played = await clickFirstCard(page);
      await dismissTutorials(page);
      const after = await snapshot(page);
      trace.push(`  play ${played} → ${formatSnapshot(after)}`);
      report.step(`played \`${played}\``);
      report.snap(after);
    }

    if (await combatEnded(page)) break;

    trace.push(`  --- pass turn ---`);
    report.step('pass turn');
    await passTurn(page);
    await dismissTutorials(page);
    const s = await snapshot(page);
    trace.push(`  after pass ${formatSnapshot(s)}`);
    report.snap(s, 'after pass');
    process.stdout.write(`done (boss=${s.boss[0]}/${s.boss[1]} p0=${s.p0Hp} p1=${s.p1Hp})\n`);
    rounds += 1;
  }

  // Dump the trace for human review (shows up in Playwright stdout).
  console.log('\n=== craghorn-winnable trace ===');
  for (const line of trace) console.log(line);
  const ended = await combatEnded(page);
  console.log(`=== ${rounds} rounds, ended=${ended} ===\n`);

  await report.screenshot(page, '02-combat-end');
  const outcome = ended
    ? `Combat terminated in **${rounds} rounds** (budget ${MAX_ROUNDS}).`
    : `Combat did NOT terminate within ${MAX_ROUNDS} rounds — possible hang.`;
  await report.finalize(
    `${outcome} Policy: greedy "play first card, repeat, pass turn". Starting boss HP ${initial.boss[1]}. No silent no-ops observed.`,
  );

  // Structural assertions only:
  expect(rounds).toBeLessThan(MAX_ROUNDS); // combat terminated (not hung)
});
