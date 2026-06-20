// tests/e2e/a11y/axe-smoke.spec.ts
//
// PRD T-4 — axe smoke gate.
// Asserts zero `serious` / `critical` axe-core violations on the current app
// root. This is a blocking gate in CI (A-4 tool stack; accessibility.md §11.2).
//
// Today the app is pre-Cathedral (V-1..V-13 not started), so a baseline allow-
// list may be necessary as the UI evolves. Known-violation exclusions are
// added via `.exclude('css-selector')` with a TODO referencing the follow-up
// ticket (PRD A-5′ / R-22 requires the bd-issue-id + expiration format).

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('axe-core smoke @a11y', () => {
  test('root has zero serious|critical violations', async ({ page }) => {
    await page.goto('/');

    const builder = new AxeBuilder({ page })
      // Focus the ruleset on the categories the spec commits to in §11.2.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

    // Allowlist sink for pre-Cathedral violations. Add entries here only with
    // a TODO referencing an open bd issue + expiration date per A-5′/R-22.
    // Example:
    //   .exclude('.legacy-widget') // TODO(embertide-xxx expires 2026-05-01) — pre-Cathedral shell.

    const result = await builder.analyze();
    const blocking = result.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
        .join('\n');
      console.error(`axe found ${blocking.length} blocking violation(s):\n${summary}`);
    }

    expect(blocking).toEqual([]);
  });
});
