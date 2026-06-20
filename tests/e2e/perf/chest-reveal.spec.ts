// tests/e2e/perf/chest-reveal.spec.ts
//
// PRD T-4 / R-15 / A-18′ — chest-reveal FPS fixture (INERT SCAFFOLD).
//
// Purpose: establish the measurement pipeline now so V-7c can plug in the
// real reveal choreography without also wiring up perf tooling under a
// deadline. This scaffold:
//   1. Navigates to `/` (the real fixture route `/chest-reveal-fixture`
//      will land in V-7c; today `/` is a placeholder page).
//   2. Runs three 1-second rAF sampling passes and computes median FPS.
//   3. Logs the median. Does NOT assert — warn-only until A-18′ flip
//      (14 days post-V-7c merge, tracked in gate-schedule.json).
//
// TODO(V-7c): swap target URL to the chest-reveal fixture page.
// TODO(A-18′): convert this to a blocking assertion (≥55 fps median-of-3
//   with 10% tolerance) at the scheduled flip date.

import { test } from '@playwright/test';

test.describe('perf: chest-reveal FPS @perf', () => {
  test('median-of-3 FPS sample (warn-only)', async ({ page }) => {
    // Allow motion for this perf test — reducedMotion is reduce by default.
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.goto('/');

    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const fps = await sampleFps(page);
      samples.push(fps);
    }
    samples.sort((a, b) => a - b);
    const median = samples[1];

    console.log(
      `[perf:motion] chest-reveal FPS samples=${samples.map((n) => n.toFixed(1)).join(', ')} median=${median.toFixed(1)} (warn-only until V-7c+14d)`,
    );

    // No assertion — this test must always pass until A-18′ flip date.
  });
});

async function sampleFps(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate<number>(() => {
    return new Promise<number>((resolve) => {
      const stamps: number[] = [];
      const start = performance.now();
      function tick(t: number): void {
        stamps.push(t);
        if (t - start < 1000) {
          requestAnimationFrame(tick);
        } else {
          if (stamps.length < 2) {
            resolve(0);
            return;
          }
          const deltas = stamps
            .slice(1)
            .map((v, i) => v - stamps[i])
            .filter((d) => d > 0);
          if (deltas.length === 0) {
            resolve(0);
            return;
          }
          const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          resolve(1000 / avg);
        }
      }
      requestAnimationFrame(tick);
    });
  });
}
