// tests/e2e/touch-target-audit.spec.ts
//
// embertide-n8s5 (i5fk.audit) — Touch target audit at iPad portrait.
//
// Apple HIG requires interactive controls ≥ 44×44pt. At iPad portrait
// (768×1024 CSS pixels, 1× scale) "pt" and "CSS px" are interchangeable
// for layout purposes. This spec walks the default Setup→Start flow at
// that viewport, then enumerates every interactive element on the
// resulting GameBoard and reports any whose bounding box shrinks below
// 44×44.
//
// Audit-phase scope (read-only): the spec produces a report-style
// failure listing offenders so the i5fk fix phase has a concrete punch
// list. No production source is modified by this spec.
//
// Run: `npx playwright test --project=desktop tests/e2e/touch-target-audit.spec.ts`
// (the `desktop` project's viewport is overridden via `test.use` below;
//  we reuse it only to inherit the chromium device profile + the
//  webServer config that auto-spawns vite preview on :4173).
//
// Not run in CI by default — `pnpm a11y:axe` only globs `tests/e2e/a11y/`.
//
// CONFIG: set `SKIP_TOUCH_TARGET_FAIL=1` to run as report-only (logs
// offenders but does not fail). Default behaviour fails loudly so the
// spec doubles as a regression gate post-i5fk fix-phase landing.

import { test, expect } from '@playwright/test';

const IPAD_PORTRAIT = { width: 768, height: 1024 } as const;
const MIN_PT = 44;

// Selector targeting "interactive elements" per the i5fk acceptance
// criteria: buttons (HTML + ARIA), cards, hand slots, drop zones,
// chips, items-bag controls, zone cells. Composite controls (a card
// inside a draggable wrapper) report twice — that's deliberate; the
// fix phase decides which level is the canonical click target.
const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  '[data-card-id]',
  '[data-testid$="-button"]',
  '[data-testid^="combat-hand-slot-"]',
  '[data-testid*="-bag"]',
  '[data-testid*="-chip"]',
  '[data-testid*="zone-cell"]',
  '[data-testid="end-turn"]',
  '[data-testid="combat-pass-turn"]',
].join(', ');

interface Offender {
  readonly tag: string;
  readonly testid: string | null;
  readonly cardId: string | null;
  readonly role: string | null;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

test.use({ viewport: IPAD_PORTRAIT });

test.describe('Touch target audit @layout', () => {
  test('all interactive elements ≥ 44×44 at iPad portrait (i5fk audit)', async ({
    page,
    viewport,
  }) => {
    test.skip(
      viewport?.width !== IPAD_PORTRAIT.width || viewport?.height !== IPAD_PORTRAIT.height,
      `iPad-portrait-only spec; current viewport=${viewport?.width}x${viewport?.height}`,
    );

    await page.goto('/');
    await page.waitForSelector('[data-testid="setup-root"]', { state: 'visible' });
    await page.locator('[data-testid="start-button"]').click();
    await page.waitForSelector('[data-testid="game-board"]', { state: 'visible' });
    // Allow first-game tutorial overlay to mount (it dims the board);
    // dismiss it so its own buttons are not double-counted as offenders
    // and so cards underneath are reachable for measurement.
    const tutorialDismiss = page.locator('[data-testid="tutorial-dismiss"]');
    if ((await tutorialDismiss.count()) > 0) {
      await tutorialDismiss.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(120);
    }
    // Settle any entrance animation before measuring.
    await page.waitForTimeout(250);

    const handles = await page.locator(INTERACTIVE_SELECTOR).all();
    const offenders: Offender[] = [];

    for (const h of handles) {
      // Hidden / unmounted nodes report null bounding boxes — exclude
      // them; the audit only cares about visible click targets.
      const isVisible = await h.isVisible().catch(() => false);
      if (!isVisible) continue;
      const box = await h.boundingBox();
      if (!box) continue;
      // Skip sub-4px boxes: these are screen-reader-only spans (clip-path
      // / sr-only utility class) and CSS decoration nodes that happen to
      // match the interactive selector but are not real touch targets.
      // Anything Apple-HIG-relevant is at least an order of magnitude
      // bigger than this floor.
      if (box.width < 4 || box.height < 4) continue;
      if (box.width >= MIN_PT && box.height >= MIN_PT) continue;
      // i5fk fix-phase (2026-05-15): skip decorative span children whose
      // nearest interactive ancestor (button / [role=button] / a) is a
      // different element — those are labels nested inside the real
      // click target (e.g. `items-bag-chip-count-p0` lives inside the
      // `items-bag-chip-p0` button). The button itself is audited on
      // its own row; counting the inner span as a separate offender
      // double-fires the same fix.
      const skipDecorative = await h.evaluate((el) => {
        if (el.tagName.toLowerCase() !== 'span') return false;
        const interactiveAncestor = el.parentElement?.closest('button, [role="button"], a');
        return interactiveAncestor !== null && interactiveAncestor !== el;
      });
      if (skipDecorative) continue;

      const [tag, testid, cardId, role, ariaLabel, text] = await Promise.all([
        h.evaluate((el) => el.tagName.toLowerCase()),
        h.getAttribute('data-testid'),
        h.getAttribute('data-card-id'),
        h.getAttribute('role'),
        h.getAttribute('aria-label'),
        h.innerText().catch(() => ''),
      ]);
      const label =
        ariaLabel?.trim() || text.trim().slice(0, 48) || testid || cardId || '<unlabeled>';
      offenders.push({
        tag,
        testid,
        cardId,
        role,
        label,
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
      });
    }

    if (offenders.length > 0) {
      const lines = offenders.map(
        (o, i) =>
          `  [${i + 1}] ${o.tag}` +
          (o.testid ? `[data-testid="${o.testid}"]` : '') +
          (o.cardId ? `[data-card-id="${o.cardId}"]` : '') +
          (o.role ? `[role="${o.role}"]` : '') +
          ` — ${o.width}×${o.height} — ${o.label}`,
      );
      const report = [
        `iPad-portrait touch-target audit: ${offenders.length} interactive element(s) below ${MIN_PT}×${MIN_PT}.`,
        ...lines,
      ].join('\n');
      // Surface to test output and to the Playwright HTML report.
      console.log('\n[i5fk touch-target audit]\n' + report + '\n');
      test.info().annotations.push({ type: 'i5fk-touch-target-audit', description: report });
    }

    if (process.env.SKIP_TOUCH_TARGET_FAIL === '1') {
      test.info().annotations.push({
        type: 'i5fk-touch-target-audit-mode',
        description: `report-only (SKIP_TOUCH_TARGET_FAIL=1); ${offenders.length} offender(s) found`,
      });
      return;
    }

    expect(
      offenders,
      `${offenders.length} interactive element(s) below ${MIN_PT}×${MIN_PT} at iPad portrait — see annotation/log for full list.`,
    ).toEqual([]);
  });
});
