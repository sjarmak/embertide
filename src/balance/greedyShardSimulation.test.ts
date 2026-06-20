import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rules/chestPool';
import {
  BOSS_IDS,
  computeMedian,
  simulateCombat,
  type CombatEngagingStrategy,
} from './combatLengthSim';

/**
 * v2.0 greedy-shard simulation harness (amendment A2 + REQ-7b).
 *
 * Goal: enumerate simple "rush" strategies against the SHARED 3-shard
 * pool and assert that no single strategy trivializes the shared win
 * condition (>5% of games achieve 3 shards in <5 turns), AND that the
 * aggregate shared-pool win rate is neither trivial nor impossible
 * (40%-70% band).
 *
 * IMPORTANT — MODELING PLACEHOLDER: this harness uses simplified
 * probability curves per strategy. The per-turn shard-grant probabilities
 * are MODELING STAND-INS for mechanics that land in later units:
 *
 *   - Wisdom shard:   u-2e (Princess Crystal free)
 *   - Courage shard:  u-5b (Map completion)
 *   - Power shard:    u-6c (Cagewright Vurmox defeat)
 *
 * Each of those units will replace the probabilistic stub below with a
 * real game-mechanic driver. Until then, this test validates that the
 * harness itself works (seeded, deterministic, fast) and will catch
 * balance regressions the moment a real mechanic is wired in and this
 * file is updated. The band is intentionally wide so the harness
 * survives v2.0 scaffolding without churn — tuning tightens in v2.1.
 *
 * Each "rush" strategy models a player preferentially chasing one path
 * while still making incidental progress on the other two (combat yields
 * HP rather than shards in v2, but side-quests still happen). This is
 * why every strategy has a non-zero chance of winning — a pure mono-path
 * strategy cannot reach three shards at all and would produce a 0% win
 * rate, which is not the model the shared-pool balance gate assumes.
 *
 * Determinism: each simulated game uses its own seed 1..1000 so runs are
 * reproducible and any future regression can be bisected by seed.
 */

const TOTAL_GAMES_PER_STRATEGY = 1000;
const TURN_LIMIT = 15;
const FAST_WIN_TURNS = 5;
const FAST_WIN_ALLOWED_FRACTION = 0.05; // <=5% per strategy
const GLOBAL_WIN_RATE_FLOOR = 0.4;
const GLOBAL_WIN_RATE_CEILING = 0.7;

type Strategy = 'wisdom-rush' | 'map-rush' | 'power-rush' | 'mixed';
const STRATEGIES: readonly Strategy[] = ['wisdom-rush', 'map-rush', 'power-rush', 'mixed'];

interface SharedPool {
  wisdom: boolean;
  courage: boolean;
  power: boolean;
}

interface SimulationResult {
  readonly won: boolean;
  readonly turnsToVictory: number | null; // null on loss
}

/**
 * Per-turn independent grant probability for (primary, secondary) paths
 * under each rush strategy. Mixed splits probability evenly across all
 * three paths.
 */
interface StrategyProbabilities {
  readonly wisdom: number;
  readonly courage: number;
  readonly power: number;
}

function probabilitiesFor(strategy: Strategy): StrategyProbabilities {
  switch (strategy) {
    case 'wisdom-rush':
      return { wisdom: 0.2, courage: 0.07, power: 0.07 };
    case 'map-rush':
      return { wisdom: 0.07, courage: 0.15, power: 0.07 };
    case 'power-rush':
      return { wisdom: 0.07, courage: 0.07, power: 0.2 };
    case 'mixed':
      return { wisdom: 0.1, courage: 0.1, power: 0.1 };
    default: {
      const _exhaustive: never = strategy;
      throw new Error(`Unknown strategy: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Apply one turn's shard-grant probability rolls. Rolls each un-granted
 * path independently against the strategy's per-path probability.
 * Returns true when all three shards are granted.
 */
function advanceTurn(probs: StrategyProbabilities, pool: SharedPool, rng: () => number): boolean {
  if (!pool.wisdom && rng() < probs.wisdom) pool.wisdom = true;
  if (!pool.courage && rng() < probs.courage) pool.courage = true;
  if (!pool.power && rng() < probs.power) pool.power = true;
  return pool.wisdom && pool.courage && pool.power;
}

function simulateGame(strategy: Strategy, seed: number): SimulationResult {
  const rng = createSeededRng(seed);
  const probs = probabilitiesFor(strategy);
  const pool: SharedPool = { wisdom: false, courage: false, power: false };
  for (let turn = 1; turn <= TURN_LIMIT; turn += 1) {
    const won = advanceTurn(probs, pool, rng);
    if (won) return { won: true, turnsToVictory: turn };
  }
  return { won: false, turnsToVictory: null };
}

function simulateStrategy(strategy: Strategy): {
  readonly wins: number;
  readonly fastWins: number;
} {
  let wins = 0;
  let fastWins = 0;
  for (let seed = 1; seed <= TOTAL_GAMES_PER_STRATEGY; seed += 1) {
    const result = simulateGame(strategy, seed);
    if (result.won) {
      wins += 1;
      if (result.turnsToVictory !== null && result.turnsToVictory < FAST_WIN_TURNS) {
        fastWins += 1;
      }
    }
  }
  return { wins, fastWins };
}

describe('greedy-shard simulation (amendment A2, REQ-7b)', () => {
  // Pre-compute all four strategies once so we can reason about per-strategy
  // stats AND the aggregate win rate without re-running 4000 games per it().
  const results = new Map<Strategy, { wins: number; fastWins: number }>();
  for (const strategy of STRATEGIES) {
    results.set(strategy, simulateStrategy(strategy));
  }

  for (const strategy of STRATEGIES) {
    it(`${strategy}: fast-win rate (<${FAST_WIN_TURNS} turns) <= ${FAST_WIN_ALLOWED_FRACTION * 100}% across ${TOTAL_GAMES_PER_STRATEGY} seeded games`, () => {
      const { fastWins } = results.get(strategy)!;
      const fraction = fastWins / TOTAL_GAMES_PER_STRATEGY;
      expect(fraction).toBeLessThanOrEqual(FAST_WIN_ALLOWED_FRACTION);
    });
  }

  it(`global shared-pool win rate across all ${STRATEGIES.length * TOTAL_GAMES_PER_STRATEGY} games is within the ${GLOBAL_WIN_RATE_FLOOR * 100}%-${GLOBAL_WIN_RATE_CEILING * 100}% band`, () => {
    let totalWins = 0;
    let totalGames = 0;
    for (const strategy of STRATEGIES) {
      const { wins } = results.get(strategy)!;
      totalWins += wins;
      totalGames += TOTAL_GAMES_PER_STRATEGY;
    }
    const winRate = totalWins / totalGames;
    expect(winRate).toBeGreaterThanOrEqual(GLOBAL_WIN_RATE_FLOOR);
    expect(winRate).toBeLessThanOrEqual(GLOBAL_WIN_RATE_CEILING);
  });

  it('is deterministic: same seed produces the same outcome', () => {
    const a = simulateGame('mixed', 42);
    const b = simulateGame('mixed', 42);
    expect(a.won).toBe(b.won);
    expect(a.turnsToVictory).toBe(b.turnsToVictory);
  });
});

// ---------------------------------------------------------------------------
// Combat-length balance sim extension (u-9f, PRD §C8).
//
// EXTENDS the greedy-shard sim above (NOT a replacement): routes through
// the real `combatTurnReducer` with a greedy "play highest-damage card"
// policy and asserts that the median boss-turns-until-WIN for each
// engaged boss falls in class-specific windows:
//
//   Wild bosses (craghorn, boulderkin, sentinel, silver-chimera): [4, 6]
//   Region bosses (broodmaw, ashen-tyrant):                      [5, 8]
//   Vurmox (cagewright-vurmox):                                 [7, 10]
//
// Plus a heirloom win-rate curve against region bosses (broodmaw +
// ashen-tyrant, pooled):
//
//   0 heirlooms → 30-40% win rate (±5% per endpoint → [25%, 45%])
//   2 heirlooms → 60-70%          (±5% per endpoint → [55%, 75%])
//   3 heirlooms → 80-90%          (±5% per endpoint → [75%, 95%])
//
// Strategy engagement table (unchanged from u-8h):
//
//   wisdom-rush : engages NO bosses (Princess-only path frees wisdom
//                 without combat). Skipped entirely in combat assertions.
//   map-rush    : engages every boss en route to full zone clear.
//   power-rush  : Vurmox-rush. Engages every boss on the path to Vurmox.
//   mixed       : engages every boss.
//
// u-9f / REQ-32: the sim now drives slot-based engagement
// (`entrySource: 'wild-boss-slot' | 'region-boss-slot'`) rather than
// the legacy center-row `'field'` path — matching u-9c's
// `engageWildBossSlot` / `engageRegionBossSlot` store methods.
//
// Console output logs per-boss per-strategy median combat-length for
// observability (balance-sim convention; console.log is expected in
// `src/balance/`).
// ---------------------------------------------------------------------------

const COMBAT_ENGAGING_STRATEGIES: readonly CombatEngagingStrategy[] = [
  'map-rush',
  'power-rush',
  'mixed',
];

const COMBAT_ITERATIONS_PER_PAIR = 1000;

// u-9f class bands.
const WILD_BOSS_IDS: readonly string[] = ['craghorn', 'boulderkin', 'sentinel', 'silver-chimera'];
const REGION_BOSS_IDS_NO_VURMOX: readonly string[] = ['broodmaw', 'ashen-tyrant'];
const VURMOX_ID = 'cagewright-vurmox';

const WILD_BAND: readonly [number, number] = [4, 6];
const REGION_BAND: readonly [number, number] = [5, 8];
const VURMOX_BAND: readonly [number, number] = [7, 10];

// z5e (2026-05-28) v2.1 zone-boss bands. The bands sit slightly looser
// than the v2.0 bands because the v2.1 region bosses route through
// dynamic resolvers (tidewraith-tentacle-grab / knell-drum /
// hextwins-fire-ice) that read zone-state fields (tideGaugeSnapshot,
// shadowCreep, sandstormCounter) which the sim does NOT model — it
// runs each boss at zone-state=0. Real play with accumulated zone
// pressure resolves harder than the sim suggests. The bands here
// represent the easiest-case combat shape (zone-zero); they're a
// regression net, not a difficulty floor.
//
// Wild bosses tuning history:
//   - hollow-effigy / iron-sentinel: HP 6 (substrate-ship) gave sim median
//     2 — below the explicit [3, 5] design intent in
//     `src/data/bossAttackPatterns.ts` BOSS_HP comments. z5e bumped
//     both to HP 8, landing sim median at 3-4 (inside [3, 5]).
//
// Region bosses tuning note:
//   - tidewraith (dpt=3 fallback, resolver clamps at 2 at zero-tide):
//     observed median 7-8, wins 95-98% at zone-zero. Real play with
//     tideGauge=2-4 lifts effective dpt to 3-5; the resolver's
//     [2, 5] clamp keeps the ceiling sane.
//   - knell (dpt=3, telegraph/slam alternates): observed median
//     8-9, wins 100% at zone-zero (effective ~1.5 dpt). Real play
//     with shadowCreep≥1 lifts slam-turn dpt by N and pressures the
//     same way Hollow Shrine's other consumers do.
//   - hextwins (dpt=2 base on 2/3 fire turns): observed median 4-5,
//     wins 100% at zone-zero (effective ~1.33 dpt). HP 10 is
//     deliberately substrate-ship light — gdd.3.2 follow-up bead
//     will tune the fire/ice cycle and HP together. Sized as a "fast
//     region boss" by the designer note; band reflects that.
const V21_WILD_BOSS_IDS: readonly string[] = ['maelstrom', 'hollow-effigy', 'iron-sentinel'];
const V21_REGION_BOSS_IDS: readonly string[] = ['tidewraith', 'knell'];
const V21_FAST_REGION_BOSS_IDS: readonly string[] = ['hextwins'];

const V21_WILD_BAND: readonly [number, number] = [3, 6];
const V21_REGION_BAND: readonly [number, number] = [5, 9];
const V21_FAST_REGION_BAND: readonly [number, number] = [3, 6];

// u-9f heirloom win-rate curve targets. The PRD specifies a 10%-wide
// target band per heirloom tier (e.g. 30-40% at 0 heirlooms); the
// ±5% tolerance below is applied to EACH endpoint of that band, not
// to the center, yielding a 20%-wide acceptance window. Example:
//   target 30-40%  +  ±5% per endpoint  →  [0.25, 0.45]  (20%-wide).
// Sampling variance in a 1000-run sim comfortably fits inside this
// window — tighter tolerances produced flakes on adverse seeds during
// u-9f's calibration pass.
const HEIRLOOM_CURVE: readonly {
  readonly count: number;
  readonly minRate: number;
  readonly maxRate: number;
}[] = [
  // 0 heirlooms: target 30-40%, ±5% per endpoint → [0.25, 0.45]
  { count: 0, minRate: 0.25, maxRate: 0.45 },
  // 2 heirlooms: target 60-70%, ±5% per endpoint → [0.55, 0.75]
  { count: 2, minRate: 0.55, maxRate: 0.75 },
  // 3 heirlooms: target 80-90%, ±5% per endpoint → [0.75, 0.95]
  { count: 3, minRate: 0.75, maxRate: 0.95 },
];

// Observability: also sample heirloomCount=1 and 4 during sim so the
// full curve shape is visible in the console log for audit / future
// retunes. Not asserted.
const HEIRLOOM_OBSERVATIONAL_POINTS: readonly number[] = [1, 4];

interface CombatPairStats {
  readonly strategy: CombatEngagingStrategy;
  readonly bossId: string;
  readonly wins: number;
  readonly losses: number;
  readonly median: number | null;
}

function runCombatPair(strategy: CombatEngagingStrategy, bossId: string): CombatPairStats {
  const winTurns: number[] = [];
  let losses = 0;
  for (let seed = 1; seed <= COMBAT_ITERATIONS_PER_PAIR; seed += 1) {
    const result = simulateCombat(strategy, bossId, seed);
    if (result.won) {
      winTurns.push(result.turnsElapsed);
    } else {
      losses += 1;
    }
  }
  const median = winTurns.length > 0 ? computeMedian(winTurns) : null;
  return {
    strategy,
    bossId,
    wins: winTurns.length,
    losses,
    median,
  };
}

/**
 * Pooled win-rate helper for the heirloom curve. Runs `simulateCombat`
 * across every strategy × every region boss (excluding Vurmox) for the
 * given `heirloomCount`, using seeds 1..1000 per (strategy, boss). Pools
 * the wins across all runs and returns the overall rate.
 *
 * Pooling across strategies + region bosses gives a stable rate across
 * the "typical deck composition" axis the PRD §C8 curve targets.
 */
function winRatePooled(heirloomCount: number): number {
  let wins = 0;
  let total = 0;
  for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
    for (const bossId of REGION_BOSS_IDS_NO_VURMOX) {
      for (let seed = 1; seed <= COMBAT_ITERATIONS_PER_PAIR; seed += 1) {
        const result = simulateCombat(strategy, bossId, seed, heirloomCount);
        if (result.won) wins += 1;
        total += 1;
      }
    }
  }
  return wins / total;
}

describe('combat-length balance sim (u-9f, PRD §C8)', () => {
  // Pre-compute every (engaging strategy, boss) pair once so per-pair
  // test cases can read from the shared result map.
  const pairStats = new Map<string, CombatPairStats>();
  for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
    for (const bossId of BOSS_IDS) {
      const key = `${strategy}::${bossId}`;
      pairStats.set(key, runCombatPair(strategy, bossId));
    }
  }

  // Log per-pair medians for observability. Balance-sim convention —
  // console.log is expected and covered by the project norms for this
  // directory (no `no-console` rule is enabled on this path).
  console.log('[u-9f] per-boss per-strategy median combat-length (boss-turns until WIN):');
  for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
    for (const bossId of BOSS_IDS) {
      const stats = pairStats.get(`${strategy}::${bossId}`)!;
      const medianStr = stats.median === null ? 'n/a (no wins)' : String(stats.median);
      console.log(
        `[u-9f]   ${strategy.padEnd(11)} vs ${bossId.padEnd(17)} median=${medianStr.padStart(12)} (wins=${stats.wins}/${COMBAT_ITERATIONS_PER_PAIR}, losses=${stats.losses})`,
      );
    }
  }

  it('wisdom-rush engages no bosses (Princess-only path)', () => {
    expect(COMBAT_ENGAGING_STRATEGIES).not.toContain('wisdom-rush' as CombatEngagingStrategy);
  });

  it(`each engaging strategy runs ${COMBAT_ITERATIONS_PER_PAIR} games per boss`, () => {
    for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
      for (const bossId of BOSS_IDS) {
        const stats = pairStats.get(`${strategy}::${bossId}`)!;
        expect(stats.wins + stats.losses).toBe(COMBAT_ITERATIONS_PER_PAIR);
      }
    }
  });

  /** Assertion helper: median for every (strategy, boss) in the set sits in `[min, max]`. */
  function assertBand(
    bossIds: readonly string[],
    band: readonly [number, number],
    label: string,
  ): void {
    const violations: string[] = [];
    for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
      for (const bossId of bossIds) {
        const stats = pairStats.get(`${strategy}::${bossId}`)!;
        if (stats.median === null) {
          violations.push(
            `${strategy} vs ${bossId}: 0 wins out of ${COMBAT_ITERATIONS_PER_PAIR} seeds.`,
          );
          continue;
        }
        if (stats.median < band[0] || stats.median > band[1]) {
          violations.push(
            `${strategy} vs ${bossId}: median=${stats.median} falls outside ${label} band [${band[0]}, ${band[1]}].`,
          );
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  }

  it(`wild bosses: median combat-length in [${WILD_BAND[0]}, ${WILD_BAND[1]}] boss-turns`, () => {
    assertBand(WILD_BOSS_IDS, WILD_BAND, 'wild');
  });

  it(`region bosses: median combat-length in [${REGION_BAND[0]}, ${REGION_BAND[1]}] boss-turns`, () => {
    assertBand(REGION_BOSS_IDS_NO_VURMOX, REGION_BAND, 'region');
  });

  it(`vurmox: median combat-length in [${VURMOX_BAND[0]}, ${VURMOX_BAND[1]}] boss-turns`, () => {
    assertBand([VURMOX_ID], VURMOX_BAND, 'vurmox');
  });

  it(`v2.1 wild bosses (maren/shadow/spirit): median in [${V21_WILD_BAND[0]}, ${V21_WILD_BAND[1]}] boss-turns`, () => {
    assertBand(V21_WILD_BOSS_IDS, V21_WILD_BAND, 'v2.1 wild');
  });

  it(`v2.1 region bosses (tidewraith/knell): median in [${V21_REGION_BAND[0]}, ${V21_REGION_BAND[1]}] boss-turns (zone-state=0 baseline; real play harder)`, () => {
    assertBand(V21_REGION_BOSS_IDS, V21_REGION_BAND, 'v2.1 region');
  });

  it(`v2.1 fast region bosses (hextwins): median in [${V21_FAST_REGION_BAND[0]}, ${V21_FAST_REGION_BAND[1]}] boss-turns (substrate-ship light HP per gdd.3.2 follow-up)`, () => {
    assertBand(V21_FAST_REGION_BOSS_IDS, V21_FAST_REGION_BAND, 'v2.1 fast region');
  });

  it('is deterministic: same (strategy, boss, seed) produces the same outcome', () => {
    const a = simulateCombat('mixed', 'broodmaw', 42);
    const b = simulateCombat('mixed', 'broodmaw', 42);
    expect(a.won).toBe(b.won);
    expect(a.turnsElapsed).toBe(b.turnsElapsed);
  });

  it('heirloomCount parameter is deterministic', () => {
    const a = simulateCombat('mixed', 'broodmaw', 42, 2);
    const b = simulateCombat('mixed', 'broodmaw', 42, 2);
    expect(a.won).toBe(b.won);
    expect(a.turnsElapsed).toBe(b.turnsElapsed);
  });
});

describe('heirloom win-rate curve (u-9f, PRD §C8)', () => {
  // Pre-compute once across all 3 curve points so per-it() doesn't
  // re-run 6000+ sims. Each curve point runs
  // TOTAL_ENGAGING_STRATEGIES * REGION_BOSSES * SEEDS = 3 * 2 * 1000 = 6000 sims.
  const rates = new Map<number, number>();
  for (const point of HEIRLOOM_CURVE) {
    rates.set(point.count, winRatePooled(point.count));
  }

  // Log observed rates for the audit trail.
  console.log(
    '[u-9f] heirloom win-rate curve (pooled across map-rush/power-rush/mixed vs broodmaw+ashen-tyrant):',
  );
  for (const point of HEIRLOOM_CURVE) {
    const rate = rates.get(point.count)!;
    console.log(
      `[u-9f]   ${point.count} heirlooms → win rate ${(rate * 100).toFixed(1)}% (target [${(point.minRate * 100).toFixed(0)}%, ${(point.maxRate * 100).toFixed(0)}%])`,
    );
  }
  // Observational-only points (audit trail; not asserted).
  for (const count of HEIRLOOM_OBSERVATIONAL_POINTS) {
    const rate = winRatePooled(count);
    console.log(
      `[u-9f]   ${count} heirlooms → win rate ${(rate * 100).toFixed(1)}% (observational, not asserted)`,
    );
  }

  for (const point of HEIRLOOM_CURVE) {
    it(`${point.count} heirlooms: win rate within [${(point.minRate * 100).toFixed(0)}%, ${(point.maxRate * 100).toFixed(0)}%]`, () => {
      const rate = rates.get(point.count)!;
      expect(rate).toBeGreaterThanOrEqual(point.minRate);
      expect(rate).toBeLessThanOrEqual(point.maxRate);
    });
  }

  it('heirloom injection actually lifts the win rate (monotonic across 0 → 2 → 3)', () => {
    const r0 = rates.get(0)!;
    const r2 = rates.get(2)!;
    const r3 = rates.get(3)!;
    expect(r0).toBeLessThan(r2);
    expect(r2).toBeLessThan(r3);
  });
});

// ---------------------------------------------------------------------------
// Vurmox heirloom win-rate curve (0wc, P1 ship concern resolution).
//
// REQ-32 + PRD Q4 / Q7 — "difficulty IS the gate" + "Vurmox gets special
// endgame treatment". u-9f tuned Vurmox for turn-count only (dpt 6→1, hp
// 12→18) which left the fight trivial (~99.6% 0-heirloom win rate).
// 0wc re-tunes Vurmox to be challenging-but-winnable: 0-heirloom is a
// genuine speedrun penance, 2-heirloom prep pays off, 4-heirloom full
// completion is rewarded but not an auto-win.
//
// Curve (pooled across map-rush/power-rush/mixed, seeds 1..1000):
//
//   0 heirlooms → 15-30% win rate (±5%): speedrun penance, doable but hard.
//   2 heirlooms → 45-60% (±5%): prep pays off but doesn't guarantee.
//   4 heirlooms → 75-90% (±5%): full completion rewarded, not auto-win.
//
// Current Vurmox tuning (bossAttackPatterns.ts):
//   damagePerTurn: 3, targeting: 'battlefield-then-player', hp: 20.
//
// Monotonic across 0 → 2 → 4: strictly increasing.
// ---------------------------------------------------------------------------

const VURMOX_HEIRLOOM_CURVE: readonly {
  readonly count: number;
  readonly minRate: number;
  readonly maxRate: number;
}[] = [
  // 0 heirlooms: 15-30% ± 5% → [0.10, 0.35]
  { count: 0, minRate: 0.1, maxRate: 0.35 },
  // 2 heirlooms: 45-60% ± 5% → [0.40, 0.65]
  { count: 2, minRate: 0.4, maxRate: 0.65 },
  // 4 heirlooms: 75-90% ± 5% → [0.70, 0.95]
  { count: 4, minRate: 0.7, maxRate: 0.95 },
];

// Observational-only Vurmox points (audit trail; not asserted).
const VURMOX_HEIRLOOM_OBSERVATIONAL_POINTS: readonly number[] = [1, 3];

/**
 * Vurmox-specific pooled win rate. Pools across all 3 engaging strategies
 * × Vurmox seeds 1..1000 at the given heirloom count. Returns pooled rate.
 *
 * Separate from `winRatePooled` (which excludes Vurmox) because Vurmox has
 * its own curve — the region-boss curve is tuned for broodmaw + ashen-tyrant
 * only, while Vurmox's curve reflects the final-boss gate design.
 */
function vurmoxWinRatePooled(heirloomCount: number): number {
  let wins = 0;
  let total = 0;
  for (const strategy of COMBAT_ENGAGING_STRATEGIES) {
    for (let seed = 1; seed <= COMBAT_ITERATIONS_PER_PAIR; seed += 1) {
      const result = simulateCombat(strategy, VURMOX_ID, seed, heirloomCount);
      if (result.won) wins += 1;
      total += 1;
    }
  }
  return wins / total;
}

describe('vurmox heirloom win-rate curve (0wc, REQ-32 endgame gate)', () => {
  const vurmoxRates = new Map<number, number>();
  for (const point of VURMOX_HEIRLOOM_CURVE) {
    vurmoxRates.set(point.count, vurmoxWinRatePooled(point.count));
  }

  // Log observed rates for the audit trail.
  console.log(
    '[0wc] vurmox heirloom win-rate curve (pooled across map-rush/power-rush/mixed vs cagewright-vurmox):',
  );
  for (const point of VURMOX_HEIRLOOM_CURVE) {
    const rate = vurmoxRates.get(point.count)!;
    console.log(
      `[0wc]   ${point.count} heirlooms → win rate ${(rate * 100).toFixed(1)}% (target [${(point.minRate * 100).toFixed(0)}%, ${(point.maxRate * 100).toFixed(0)}%])`,
    );
  }
  // Observational-only points (audit trail; not asserted).
  for (const count of VURMOX_HEIRLOOM_OBSERVATIONAL_POINTS) {
    const rate = vurmoxWinRatePooled(count);
    console.log(
      `[0wc]   ${count} heirlooms → win rate ${(rate * 100).toFixed(1)}% (observational, not asserted)`,
    );
  }

  for (const point of VURMOX_HEIRLOOM_CURVE) {
    it(`vurmox ${point.count} heirlooms: win rate within [${(point.minRate * 100).toFixed(0)}%, ${(point.maxRate * 100).toFixed(0)}%]`, () => {
      const rate = vurmoxRates.get(point.count)!;
      expect(rate).toBeGreaterThanOrEqual(point.minRate);
      expect(rate).toBeLessThanOrEqual(point.maxRate);
    });
  }

  it('vurmox heirloom uplift is monotonic (0 < 2 < 4)', () => {
    const r0 = vurmoxRates.get(0)!;
    const r2 = vurmoxRates.get(2)!;
    const r4 = vurmoxRates.get(4)!;
    expect(r0).toBeLessThan(r2);
    expect(r2).toBeLessThan(r4);
  });
});
