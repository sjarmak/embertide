/**
 * Scenario: Wisdom-piece path pacing (embertide-vj52).
 *
 * vj52 lands tier-aware crystal damage (regular → 1, wild-boss → 2,
 * region-boss → 3) and bumps PRINCESS_CRYSTAL_INITIAL_CHARGES from 5 to
 * 8 so the Wisdom-piece path lands in the 50-75% session-progress band:
 * after at least one wild-boss kill (so the player has felt the mid-tier
 * pulse), before the final region-boss kill (so it isn't a victory-lap
 * shard). The bumped initial value + tiered decrement is provisional
 * pending designer sign-off; this probe is the analytical surface that
 * lets the designer eyeball the numbers across representative session
 * shapes in one read.
 *
 * Why a Playwright probe (not pure unit math):
 *   1. Confirms the LIVE app constants match the vj52 schema —
 *      PRINCESS_CRYSTAL_INITIAL_CHARGES = 8 read off the bundled module
 *      via __gameStore. If a stale build ships the old 5, the probe
 *      catches it before the playtest reads garbage data.
 *   2. Drives the real `__gameStore.setState`/getState surface so the
 *      probe stays honest to the runtime contract; arithmetic-only
 *      simulators tend to drift from the actual reducer.
 *   3. Markdown reporter emits a per-arm pacing table for the designer.
 *
 * Boots `?debug=embertide-filled` purely because that seed initializes a
 * 2P game AND exposes `window.__gameStore` for `page.evaluate` access.
 * The embertide shards it sets are irrelevant — this probe never reads
 * `sharedTriforce` and resets `princessCrystal` to its canonical
 * (charges=8, freed=false) state at the top of every arm.
 *
 * The probe simulates a sequence of "kills" against a bootstrapped 2P
 * game by mutating `princessCrystal.charges` step-by-step using the
 * tiered decrement values. Each arm represents a representative session
 * shape (aggressive wild-kills, steady drip, mixed-coop, etc.). For each
 * arm it records the kill index at which charges hit 0 ("freed-kill")
 * and asserts the freed-kill lands in the 50-75% band of the arm's
 * total expected kills, AND post-first-wild-boss, AND pre-final-region-
 * boss kill.
 *
 * Soft-asserts the band (designer call) but hard-asserts structural
 * invariants — the bundled constant matches vj52, the freed event is
 * reachable in every arm, and no arm overshoots the region-boss kill.
 */

import { expect, test, type Page } from '@playwright/test';
import { bootApp, dismissTutorials } from './harness';
import { createReporter, type Reporter } from './narrative';

type Tier = 'regular' | 'wild-boss' | 'region-boss';

interface SessionArm {
  /** Stable id for narrative + test labels. */
  readonly slug: string;
  /** Brief description of the session shape this arm represents. */
  readonly shape: string;
  /**
   * Ordered kill sequence — each entry is a tier label. Index = "kill #".
   * Modeled as a uniform-time stream (kill index ≈ session progress).
   */
  readonly killMix: readonly Tier[];
}

/**
 * Five arms parameterizing typical co-op session shapes. Each ends with
 * the final region-boss kill (the session-end milestone the band is
 * defined against). Total kill counts span 8-13 to cover both fast and
 * slow session pacings within the 20-40 min target window.
 */
const SESSION_ARMS: readonly SessionArm[] = [
  {
    slug: 'aggressive-wild-rush',
    shape: 'front-loaded wild-boss kills (turn-1 push)',
    killMix: [
      'regular',
      'wild-boss',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'wild-boss',
      'region-boss',
    ],
  },
  {
    slug: 'steady-drip',
    shape: 'balanced drip — wilds spaced evenly across the session',
    killMix: [
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'region-boss',
    ],
  },
  {
    slug: 'slow-grind',
    shape: 'regulars-heavy grind — single wild before the region boss',
    killMix: [
      'regular',
      'regular',
      'regular',
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'regular',
      'region-boss',
    ],
  },
  {
    slug: 'coop-mixed',
    shape: 'mixed two-player kill stream — alternating wild and regular',
    killMix: [
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'wild-boss',
      'region-boss',
    ],
  },
  {
    slug: 'long-tail',
    shape: 'extended session — slow ramp into a late wild + region boss',
    killMix: [
      'regular',
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'regular',
      'wild-boss',
      'regular',
      'regular',
      'regular',
      'region-boss',
    ],
  },
];

/**
 * Tier → expected damage per the vj52 schema. Mirrors `crystalDamageFor`
 * in src/store/slices/crystal.ts; kept inline here so the probe doubles
 * as an executable spec for the contract.
 */
const DAMAGE_BY_TIER: Readonly<Record<Tier, number>> = {
  regular: 1,
  'wild-boss': 2,
  'region-boss': 3,
};

interface InitialReadout {
  readonly initialCharges: number;
  readonly freed: boolean;
}

/**
 * `applyDebugSeed` runs inside a `useEffect` on mount and only THEN
 * exposes `window.__gameStore` + flips `setupDone=true`, which mounts
 * the GameBoard. bootApp's selector list resolves on the Setup `<main>`
 * before that useEffect runs in some test orderings, so we explicitly
 * wait for the GameBoard to appear before reading store state.
 */
async function waitForGameStore(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="game-board"]', {
    state: 'visible',
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => {
      const w = globalThis as unknown as { __gameStore?: unknown };
      return w.__gameStore !== undefined;
    },
    null,
    { timeout: 10_000 },
  );
}

async function readInitialCrystal(page: Page): Promise<InitialReadout | null> {
  await waitForGameStore(page);
  return page.evaluate(() => {
    const w = globalThis as unknown as {
      __gameStore?: {
        getState(): { princessCrystal: { charges: number; freed: boolean } };
      };
    };
    const s = w.__gameStore?.getState();
    if (!s) return null;
    return {
      initialCharges: s.princessCrystal.charges,
      freed: s.princessCrystal.freed,
    };
  });
}

interface ArmResult {
  readonly slug: string;
  readonly totalKills: number;
  readonly freedKillIdx: number;
  readonly firstWildIdx: number;
  readonly finalRegionIdx: number;
  readonly progressPct: number;
}

/**
 * Run the kill sequence in-place against the live store. After each
 * "kill" the probe writes a new princessCrystal.charges via setState,
 * mirroring the reducer (Math.max(0, charges - dmg)) and freezing
 * `freed=true` on the kill that drops charges to 0. Returns the kill
 * index at which `freed` first flipped true.
 */
async function simulateArm(page: Page, arm: SessionArm, initial: number): Promise<number> {
  return page.evaluate(
    ({ killMix, dmgByTier, initial }) => {
      const w = globalThis as unknown as {
        __gameStore?: {
          getState(): { princessCrystal: { charges: number; freed: boolean } };
          setState(
            updater: (s: { princessCrystal: { charges: number; freed: boolean } }) => unknown,
          ): void;
        };
      };
      const store = w.__gameStore;
      if (!store) throw new Error('wisdom-path-pacing: __gameStore not exposed');
      // Reset to initial (cap, freed=false) so the arm starts from a
      // canonical state regardless of any prior boot-time mutations.
      store.setState((s) => ({
        ...s,
        princessCrystal: { charges: initial, freed: false },
      }));
      let freedIdx = -1;
      for (let i = 0; i < killMix.length; i += 1) {
        const tier = killMix[i] as 'regular' | 'wild-boss' | 'region-boss';
        const dmg = (dmgByTier as Record<string, number>)[tier];
        store.setState((s) => {
          const cur = s.princessCrystal.charges;
          if (s.princessCrystal.freed) return s;
          const next = Math.max(0, cur - dmg);
          // Free the crystal the moment charges hit 0 — mirrors the
          // auto-strike behavior the cell triggers in normal play.
          return {
            ...s,
            princessCrystal: { charges: next, freed: next === 0 },
          };
        });
        const after = store.getState();
        if (after.princessCrystal.freed && freedIdx === -1) {
          freedIdx = i;
        }
      }
      return freedIdx;
    },
    { killMix: arm.killMix.slice(), dmgByTier: DAMAGE_BY_TIER, initial },
  );
}

function describeArm(arm: SessionArm, result: ArmResult): string {
  const killNo = result.freedKillIdx + 1; // 1-indexed kill number for readers
  const inBand =
    result.progressPct >= 50 &&
    result.progressPct <= 75 &&
    result.freedKillIdx > result.firstWildIdx &&
    result.freedKillIdx < result.finalRegionIdx;
  return (
    `**${arm.slug}** (${arm.shape}) — total ${result.totalKills} kills, ` +
    `freed at kill #${killNo} (${result.progressPct.toFixed(0)}% session progress); ` +
    `first wild kill #${result.firstWildIdx + 1}, final region-boss kill #${result.finalRegionIdx + 1}. ` +
    `Band: ${inBand ? 'IN-BAND' : 'OUT-OF-BAND'}.`
  );
}

test('wisdom-path-pacing — runtime constant matches vj52 schema (initial=8)', async ({ page }) => {
  test.setTimeout(60_000);
  await bootApp(page, { debug: 'embertide-filled' });
  await dismissTutorials(page);
  const initial = await readInitialCrystal(page);
  expect(initial).not.toBeNull();
  // Hard-assert the LIVE app ships the vj52 schema. If this regresses
  // (someone reverts the bump or the bundle is stale), every downstream
  // pacing arm reads garbage — fail loudly here instead.
  expect(initial?.initialCharges).toBe(8);
  expect(initial?.freed).toBe(false);
});

for (const arm of SESSION_ARMS) {
  test(`wisdom-path-pacing — ${arm.slug}`, async ({ page }) => {
    test.setTimeout(60_000);
    const report: Reporter = createReporter(`wisdom-path-pacing-${arm.slug}`);
    await bootApp(page, { debug: 'embertide-filled' });
    await dismissTutorials(page);
    const initial = await readInitialCrystal(page);
    expect(initial).not.toBeNull();
    expect(initial?.initialCharges).toBe(8);

    const freedIdx = await simulateArm(page, arm, initial!.initialCharges);
    const totalKills = arm.killMix.length;
    const firstWildIdx = arm.killMix.findIndex((t) => t === 'wild-boss');
    const finalRegionIdx = arm.killMix.lastIndexOf('region-boss');
    const progressPct = ((freedIdx + 1) / totalKills) * 100;

    const result: ArmResult = {
      slug: arm.slug,
      totalKills,
      freedKillIdx: freedIdx,
      firstWildIdx,
      finalRegionIdx,
      progressPct,
    };

    report.step(describeArm(arm, result));
    await report.finalize(
      `Arm "${arm.slug}" — shape: ${arm.shape}.\n\n` +
        `Total kills: ${totalKills}. Freed at kill #${freedIdx + 1} ` +
        `(${progressPct.toFixed(0)}% session progress). ` +
        `First wild-boss kill at #${firstWildIdx + 1}; final region-boss kill at #${finalRegionIdx + 1}.\n\n` +
        `vj52 schema (initial=8, regular=1, wild-boss=2, region-boss=3) — designer ` +
        `tuning surface for the Wisdom-piece path. Soft-asserted band: 50-75% session ` +
        `progress AND post-first-wild-boss AND pre-final-region-boss.`,
    );

    // Hard structural invariants — every arm MUST free the crystal
    // before the final region-boss kill (otherwise the Wisdom path is
    // unreachable within a normal session) and AFTER at least one
    // wild-boss kill (so the player has earned the milestone).
    expect(
      freedIdx,
      `arm ${arm.slug}: crystal must free within the kill mix`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      freedIdx,
      `arm ${arm.slug}: crystal must free BEFORE the final region-boss kill (Wisdom-as-victory-lap is the failure mode)`,
    ).toBeLessThan(finalRegionIdx);
    expect(
      freedIdx,
      `arm ${arm.slug}: crystal must free AFTER the first wild-boss kill (band requires the wild-tier milestone)`,
    ).toBeGreaterThan(firstWildIdx);

    // Soft-assert the 50-75% numeric band — designer-facing data. The
    // band is intentionally NOT a hard gate: tier weights are PROVISIONAL
    // and outliers should surface in the report, not break CI. The
    // structural invariants above are the real gate.
    if (progressPct < 50 || progressPct > 75) {
      report.step(
        `NOTE — arm "${arm.slug}" lands at ${progressPct.toFixed(0)}% (target band 50-75%). ` +
          `Outside band; flag for designer review.`,
      );
    }
  });
}
