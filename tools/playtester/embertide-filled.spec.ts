/**
 * Scenario: EmbertideStrip all-filled state (embertide-68a).
 *
 * Boots `?debug=embertide-filled` which sets sharedEmbertide for all
 * three shards (wisdom/courage/power) to true. Verifies each
 * embertide-shard-<id> element surfaces the filled-shard rendering
 * (data-filled="true"). Captures a screenshot so the fill animation's
 * terminal frame can be reviewed without completing a full run.
 */

import { expect, test } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter } from './narrative';

test('embertide-filled — all three shards render as filled', async ({ page }) => {
  await bootApp(page, { debug: 'embertide-filled' });
  await dismissTutorials(page);

  const report = createReporter('embertide-filled');
  await report.screenshot(page, '01-board-embertide-filled');

  const strip = page.locator('[data-testid="embertide-strip"]');
  await expect(strip).toBeVisible();
  report.step('✓ EmbertideStrip mounted');

  for (const shardId of ['wisdom', 'courage', 'power'] as const) {
    const shard = page.locator(`[data-testid="embertide-shard-${shardId}"]`);
    await expect(shard).toBeVisible();
    await expect(shard).toHaveAttribute('data-filled', 'true');
    report.step(`✓ \`${shardId}\` shard rendered as filled`);
  }

  await report.finalize(
    'All three shared Embertide shards render as filled when sharedEmbertide is fully granted. ' +
      'Baseline screenshot captured for the win-state board surface.',
  );
});
