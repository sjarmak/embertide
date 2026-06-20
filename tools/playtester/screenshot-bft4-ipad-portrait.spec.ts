/**
 * iPad-portrait visual readability sweep (embertide-bft4).
 *
 * 95bo follow-up A4 verification: the typography pass bumped sub-floor
 * sizes to >=12px for kid-readability on iPad. This probe captures the
 * 6 surfaces named in the bead at viewport 768x1024 and reads computed
 * font-sizes for the 5 bumped selectors so the reviewer can confirm
 * "no text below 12px" without eyeballing every pane.
 *
 * NOT run in CI — ad-hoc QA probe.
 *
 * Output:
 *   .screenshots/bft4-<surface>-768x1024.png
 *   stdout: per-surface JSON of computed font-size px for the 5 selectors
 */

import { test, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';

const VIEWPORT = { width: 768, height: 1024 } as const;

const BUMPED_SELECTORS = [
  '.boss-altar-pane-dormant-subline',
  '.boss-altar-pane-phase-subline',
  '.boss-altar-pane-locked-label',
  '.boss-altar-pane-name',
  '.winner-banner-body',
] as const;

interface FontSizeReading {
  readonly selector: string;
  readonly fontSizePx: number | null;
  readonly count: number;
}

async function readFontSizes(page: Page): Promise<FontSizeReading[]> {
  return page.evaluate((selectors: readonly string[]) => {
    const results: { selector: string; fontSizePx: number | null; count: number }[] = [];
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      if (nodes.length === 0) {
        results.push({ selector: sel, fontSizePx: null, count: 0 });
        continue;
      }
      // Read the first node's computed font-size in pixels.
      const cs = window.getComputedStyle(nodes[0]);
      const px = parseFloat(cs.fontSize);
      results.push({ selector: sel, fontSizePx: px, count: nodes.length });
    }
    return results;
  }, BUMPED_SELECTORS);
}

async function captureSurface(page: Page, surface: string): Promise<FontSizeReading[]> {
  await page.screenshot({
    path: `.screenshots/bft4-${surface}-${VIEWPORT.width}x${VIEWPORT.height}.png`,
    fullPage: true,
  });
  const sizes = await readFontSizes(page);
  console.log(`\n=== bft4 ${surface} ${VIEWPORT.width}x${VIEWPORT.height} ===`);
  console.log(JSON.stringify(sizes, null, 2));
  return sizes;
}

test.describe('bft4 iPad-portrait readability sweep', () => {
  test.use({ viewport: VIEWPORT });

  test('title — fresh setup landing (renders title strip)', async ({ page }) => {
    await bootApp(page);
    await captureSurface(page, 'title');
  });

  test('setup — full setup landing', async ({ page }) => {
    // Same surface as title; capture again so reviewer can A/B if the
    // page lengthens after rail interactions. No interaction here —
    // just full-page so the champion picker is visible below the strip.
    await bootApp(page);
    await captureSurface(page, 'setup');
  });

  test('main-board — boss-altar-pane LIVE (turn 6, key held)', async ({ page }) => {
    await bootApp(page, { debug: 'wild-boss-slot' });
    await dismissTutorials(page);
    await captureSurface(page, 'main-board');
  });

  test('main-board-turn1 — wild dormant + region phase-locked', async ({ page }) => {
    // wild-boss-slot seeds turn=6 (BOSS phase) so the wild slot is LIVE.
    // For dormant-subline + phase-subline coverage, force turn=1 (Stirring)
    // so the wild slot renders BossAltarDormant and the region slot renders
    // BossAltarPhaseLocked. Reuse the wild-boss-slot seed for the deck +
    // hero seeding shape, then override turn back to 1.
    await bootApp(page, { debug: 'wild-boss-slot' });
    await dismissTutorials(page);
    await page.evaluate(() => {
      const w = window as unknown as {
        __gameStore?: {
          setState: (fn: (s: unknown) => unknown) => void;
        };
      };
      if (!w.__gameStore) throw new Error('window.__gameStore missing');
      w.__gameStore.setState((s) => ({
        ...(s as Record<string, unknown>),
        turn: 1,
      }));
    });
    // Wait for the dormant pane to actually mount before snapshotting.
    await page.waitForSelector('[data-testid="boss-altar-pane-dormant-subline"]', {
      state: 'visible',
      timeout: 5_000,
    });
    // Reverting turn → 1 retriggers the first-turn Tutorial backdrop;
    // dismiss it again so the screenshot shows the bare board state.
    await dismissTutorials(page);
    await captureSurface(page, 'main-board-turn1');
  });

  test('main-board-sealed — wild SEALED (turn 6, key not held)', async ({ page }) => {
    // Strip the bossKeys seeded by wild-boss-slot so the wild slot
    // renders BossAltarLocked (boss-altar-pane-locked-label = SEALED).
    await bootApp(page, { debug: 'wild-boss-slot' });
    await dismissTutorials(page);
    await page.evaluate(() => {
      const w = window as unknown as {
        __gameStore?: {
          setState: (fn: (s: unknown) => unknown) => void;
        };
      };
      if (!w.__gameStore) throw new Error('window.__gameStore missing');
      w.__gameStore.setState((s) => ({
        ...(s as Record<string, unknown>),
        bossKeys: {
          sylvani: [],
          'emberpeak': [],
          maren: [],
          'hollow-shrine': [],
          'dune-sanctum': [],
          'gilded-cage': [],
        },
      }));
    });
    await page.waitForSelector('[data-testid="boss-altar-pane-locked-label"]', {
      state: 'visible',
      timeout: 5_000,
    });
    await captureSurface(page, 'main-board-sealed');
  });

  test('combat — craghorn', async ({ page }) => {
    await bootApp(page, { debug: 'craghorn' });
    await dismissTutorials(page);
    await captureSurface(page, 'combat');
  });

  test('chest-reveal — heart reward overlay', async ({ page }) => {
    await bootApp(page, { debug: 'wild-boss-slot' });
    await dismissTutorials(page);
    // ChestReveal auto-dismisses via setTimeout(onComplete, 1600). Stub
    // setTimeout BEFORE mounting the portal so the auto-clear never fires
    // and the screenshot captures the steady-state overlay. Limit the
    // stub to chest-reveal's exact 1600ms hold to avoid breaking other
    // timers in the page lifecycle.
    await page.evaluate(() => {
      type SetTimeoutLike = (fn: TimerHandler, ms?: number, ...args: unknown[]) => number;
      const orig = window.setTimeout as unknown as SetTimeoutLike;
      const stub: SetTimeoutLike = (fn, ms, ...args) => {
        if (ms === 1600) {
          // Drop the chest-reveal auto-dismiss timer.
          return 0;
        }
        return orig(fn, ms, ...args);
      };
      (window as unknown as { setTimeout: SetTimeoutLike }).setTimeout = stub;
    });
    // Mutate the live game store via the playtest hook so the
    // ChestReveal portal mounts. Heart is the simplest reward
    // (no card payload needed).
    await page.evaluate(() => {
      const w = window as unknown as {
        __gameStore?: {
          setState: (fn: (s: unknown) => unknown) => void;
          getState: () => unknown;
        };
      };
      if (!w.__gameStore) throw new Error('window.__gameStore missing');
      w.__gameStore.setState((s) => ({
        ...(s as Record<string, unknown>),
        lastChestReward: 'heart',
        lastChestRewardCard: null,
      }));
    });
    await page.waitForSelector('[data-testid="chest-reveal"]', {
      state: 'visible',
      timeout: 5_000,
    });
    // Hold a beat so the spring-mount animation settles before snapshot.
    await page.waitForTimeout(300);
    await captureSurface(page, 'chest-reveal');
  });

  test('win-banner — outcome=win overlay', async ({ page }) => {
    await bootApp(page, { debug: 'wild-boss-slot' });
    await dismissTutorials(page);
    // Force the game-over surface by setting `outcome = 'win'`. The
    // GameBoard portal guards on truthy outcome, so a single setState
    // is enough to mount the winner-banner.
    await page.evaluate(() => {
      const w = window as unknown as {
        __gameStore?: {
          setState: (fn: (s: unknown) => unknown) => void;
        };
      };
      if (!w.__gameStore) throw new Error('window.__gameStore missing');
      w.__gameStore.setState((s) => ({
        ...(s as Record<string, unknown>),
        outcome: 'win',
      }));
    });
    await page.waitForSelector('[data-testid="winner-banner"]', {
      state: 'visible',
      timeout: 5_000,
    });
    // Hold past the overlay-fade (320ms) + banner-rise (420ms) animations
    // so the snapshot captures the steady-state painted overlay rather
    // than mid-fade opacity-0 frames.
    await page.waitForTimeout(600);
    await captureSurface(page, 'win-banner');
  });
});
