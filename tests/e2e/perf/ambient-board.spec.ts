// tests/e2e/perf/ambient-board.spec.ts
//
// PRD T-4 / R-15 — ambient-board FPS fixture (INERT SCAFFOLD).
//
// Per embertide-z40.2 and A-18′, the ambient-board perf matrix expands
// alongside chest-reveal. This scaffold mirrors chest-reveal.spec.ts — same
// measurement pipeline, different target — so V-6 / V-7 can populate the
// actual ambient animation (subtle idle motion on the board + chest-row)
// without re-inventing the harness.
//
// TODO(V-6/V-7): swap target URL to the ambient-board fixture page.
// TODO(A-18′ aligned): flip to a blocking assertion when the scheduled
//   gate-schedule.json entry flips to `status: 'blocking'`.

import { test } from '@playwright/test';

test.describe('perf: ambient-board FPS @perf', () => {
  test('median-of-3 FPS sample (warn-only)', async ({ page }) => {
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
      `[perf:ambient] ambient-board FPS samples=${samples.map((n) => n.toFixed(1)).join(', ')} median=${median.toFixed(1)} (warn-only — R-15)`,
    );
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
