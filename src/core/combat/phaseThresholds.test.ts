/**
 * Tests for the phase-threshold resolver (embertide-lhlo.17).
 *
 * Covers:
 *   1. Remix-only type invariant — `assertPhaseTransitionRemixOnly` rejects
 *      new-mechanic transitions at runtime; valid remixes pass.
 *   2. Crossing detection — fires exactly once per threshold, not on staying
 *      in-band; a burst across multiple thresholds fires each exactly once.
 *   3. `CombatBoss.phaseThresholds` carries the typed optional readonly list;
 *      bosses without it are unaffected (no regression).
 *   4. Phantom Vurmox T2 proof — drive the wired boss across a threshold and
 *      assert the remix applied.
 */

import { describe, expect, it } from 'vitest';
import type { BossPhaseTransition, CombatBoss } from '../../types/combat';
import { applyPhaseThresholds, assertPhaseTransitionRemixOnly } from './phaseThresholds';
import { COLOSSEUM_PHANTOM_VURMOX_T2 } from '../../data/colosseum/tier2';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

/** A plain boss with no phaseThresholds (regression safety). */
function makePlainBoss(hp = 20, hpMax = 20): CombatBoss {
  return {
    hp,
    hpMax,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'test-boss',
  };
}

/** A boss with the canonical 75/50/25 thresholds, sequence archetype. */
function makeThresholdBoss(hp: number, hpMax = 20): CombatBoss {
  return {
    hp,
    hpMax,
    attackPattern: {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'threshold-boss',
    archetype: 'sequence',
    stateTags: [
      {
        kind: 'sequence',
        steps: ['step-a', 'step-b'],
        currentIndex: 0,
      },
    ],
    phaseThresholds: [
      {
        atHpFraction: 0.75,
        transition: {
          attackPattern: {
            damagePerTurn: 3,
            targeting: 'player-hp',
            onDefeatEffect: { kind: 'wisp-drop' },
          },
        },
      },
      {
        atHpFraction: 0.5,
        transition: {
          attackPattern: {
            damagePerTurn: 4,
            targeting: 'player-hp',
            onDefeatEffect: { kind: 'wisp-drop' },
          },
        },
      },
      {
        atHpFraction: 0.25,
        transition: {
          attackPattern: {
            damagePerTurn: 5,
            targeting: 'player-hp',
            onDefeatEffect: { kind: 'wisp-drop' },
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. assertPhaseTransitionRemixOnly — type-enforced remix-only invariant.
// ---------------------------------------------------------------------------

describe('assertPhaseTransitionRemixOnly', () => {
  it('passes when transition remaps an existing stateTag kind', () => {
    const boss = makeThresholdBoss(20);
    const transition: BossPhaseTransition = {
      stateTags: [
        {
          kind: 'sequence',
          steps: ['step-a', 'step-b'],
          currentIndex: 1,
        },
      ],
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).not.toThrow();
  });

  it('passes when transition remaps attackPattern only (no stateTags)', () => {
    const boss = makeThresholdBoss(20);
    const transition: BossPhaseTransition = {
      attackPattern: {
        damagePerTurn: 5,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).not.toThrow();
  });

  it('passes when transition is empty (no-op remix)', () => {
    const boss = makeThresholdBoss(20);
    expect(() => assertPhaseTransitionRemixOnly(boss, {})).not.toThrow();
  });

  it('passes when attackPattern re-uses the same bossAttackResolver', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(20),
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
        bossAttackResolver: 'phantom-vurmox-volley',
      },
    };
    const transition: BossPhaseTransition = {
      attackPattern: {
        damagePerTurn: 5,
        targeting: 'aoe',
        onDefeatEffect: { kind: 'wisp-drop' },
        bossAttackResolver: 'phantom-vurmox-volley', // same id — allowed
      },
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).not.toThrow();
  });

  it('throws when transition stateTags introduces a brand-new tag kind', () => {
    // Boss has only 'sequence' in stateTags; transition injects 'adaptive'.
    const boss = makeThresholdBoss(20);
    const transition: BossPhaseTransition = {
      stateTags: [
        { kind: 'adaptive', penalty: 2 }, // 'adaptive' was never declared
      ],
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).toThrowError(
      /stateTag kind 'adaptive' is not present/,
    );
  });

  it('throws when transition stateTags introduces a tag on a boss with no stateTags at all', () => {
    const boss = makePlainBoss(); // no stateTags
    const transition: BossPhaseTransition = {
      stateTags: [{ kind: 'guarded' }],
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).toThrowError(
      /stateTag kind 'guarded' is not present/,
    );
  });

  it('throws when transition attackPattern swaps to a different bossAttackResolver', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(20),
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
        bossAttackResolver: 'phantom-vurmox-volley',
      },
    };
    const transition: BossPhaseTransition = {
      attackPattern: {
        damagePerTurn: 5,
        targeting: 'aoe',
        onDefeatEffect: { kind: 'wisp-drop' },
        bossAttackResolver: 'trinity-aurogax-heads', // different id — rejected
      },
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).toThrowError(
      /attackPattern.bossAttackResolver 'trinity-aurogax-heads' differs/,
    );
  });

  it('allows attackPattern that drops the bossAttackResolver (undefined → absent)', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(20),
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
        bossAttackResolver: 'phantom-vurmox-volley',
      },
    };
    // Transition omits bossAttackResolver entirely (undefined) — allowed
    // because the check only fires when `newResolverId !== undefined`.
    const transition: BossPhaseTransition = {
      attackPattern: {
        damagePerTurn: 5,
        targeting: 'aoe',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
    };
    expect(() => assertPhaseTransitionRemixOnly(boss, transition)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. applyPhaseThresholds — no-op cases.
// ---------------------------------------------------------------------------

describe('applyPhaseThresholds — no-op', () => {
  it('returns the same reference when boss has no phaseThresholds', () => {
    const boss = makePlainBoss(10);
    expect(applyPhaseThresholds(boss)).toBe(boss);
  });

  it('returns the same reference when phaseThresholds is empty', () => {
    const boss: CombatBoss = { ...makePlainBoss(10), phaseThresholds: [] };
    expect(applyPhaseThresholds(boss)).toBe(boss);
  });

  it('returns the same reference when HP is above all thresholds', () => {
    // 20 HP out of 20 = 100 % — above 75 %.
    const boss = makeThresholdBoss(20);
    expect(applyPhaseThresholds(boss)).toBe(boss);
  });

  it('returns the same reference when all thresholds already crossed', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(2), // 10% — below all thresholds
      crossedPhaseThresholds: [0.25, 0.5, 0.75], // all recorded
    };
    expect(applyPhaseThresholds(boss)).toBe(boss);
  });

  it('does not fire when HP is exactly AT the threshold but already crossed', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(10), // exactly 50 %
      // Both 0.75 and 0.5 must be pre-recorded; HP=10/20=50% is below
      // both thresholds so both would otherwise fire.
      crossedPhaseThresholds: [0.5, 0.75],
    };
    const result = applyPhaseThresholds(boss);
    expect(result).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// 3. applyPhaseThresholds — crossing detection (once per threshold).
// ---------------------------------------------------------------------------

describe('applyPhaseThresholds — single threshold crossing', () => {
  it('fires the 75 % transition when HP drops to exactly 75 %', () => {
    const boss = makeThresholdBoss(15); // 15/20 = 75 %
    const result = applyPhaseThresholds(boss);

    expect(result).not.toBe(boss);
    expect(result.attackPattern.damagePerTurn).toBe(3); // transition sets 3
    expect(result.crossedPhaseThresholds).toEqual([0.75]);
  });

  it('fires the 75 % transition when HP drops below 75 % (not just exactly at it)', () => {
    const boss = makeThresholdBoss(14); // 70 % < 75 %
    const result = applyPhaseThresholds(boss);

    expect(result.crossedPhaseThresholds).toEqual([0.75]);
    expect(result.attackPattern.damagePerTurn).toBe(3);
  });

  it('fires the 50 % transition at 50 % HP (75 % already crossed)', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(10), // 50 %
      crossedPhaseThresholds: [0.75],
    };
    const result = applyPhaseThresholds(boss);

    expect(result.crossedPhaseThresholds).toEqual([0.5, 0.75]);
    expect(result.attackPattern.damagePerTurn).toBe(4);
  });

  it('fires the 25 % transition at 25 % HP (75 % and 50 % already crossed)', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(5), // 25 %
      crossedPhaseThresholds: [0.5, 0.75],
    };
    const result = applyPhaseThresholds(boss);

    expect(result.crossedPhaseThresholds).toEqual([0.25, 0.5, 0.75]);
    expect(result.attackPattern.damagePerTurn).toBe(5);
  });

  it('does NOT fire when HP stays within a band (above a threshold)', () => {
    // 16/20 = 80 % — above the 75 % threshold, no transition.
    const boss = makeThresholdBoss(16);
    expect(applyPhaseThresholds(boss)).toBe(boss);
  });

  it('does NOT re-fire an already-crossed threshold (idempotent)', () => {
    const boss: CombatBoss = {
      ...makeThresholdBoss(10), // 50 %
      crossedPhaseThresholds: [0.5, 0.75], // already crossed
    };
    // Should not fire the 50 % transition again.
    const result = applyPhaseThresholds(boss);
    expect(result).toBe(boss);
  });
});

describe('applyPhaseThresholds — burst crossing (multiple thresholds at once)', () => {
  it('fires all three thresholds when HP bursts from 100 % to 0 % in one go', () => {
    const boss = makeThresholdBoss(0); // 0 % — crosses 75, 50, 25 simultaneously
    const result = applyPhaseThresholds(boss);

    expect(result.crossedPhaseThresholds).toEqual([0.25, 0.5, 0.75]);
    // Transitions applied descending: 0.75 → 0.5 → 0.25; last one wins.
    expect(result.attackPattern.damagePerTurn).toBe(5);
  });

  it('fires 75 % and 50 % when HP drops from 80 % to 45 %', () => {
    // 9/20 = 45 % — crosses 0.75 and 0.5, not 0.25.
    const boss = makeThresholdBoss(9);
    const result = applyPhaseThresholds(boss);

    expect(result.crossedPhaseThresholds).toEqual([0.5, 0.75]);
    expect(result.attackPattern.damagePerTurn).toBe(4); // 0.5 transition last
  });

  it('fires each threshold only once across multiple successive calls', () => {
    // Simulate three successive HP drops, each crossing one threshold.
    const boss = makeThresholdBoss(20);

    // Drop to 75 %.
    const at75 = applyPhaseThresholds({ ...boss, hp: 15 });
    expect(at75.crossedPhaseThresholds).toEqual([0.75]);
    expect(at75.attackPattern.damagePerTurn).toBe(3);

    // Drop to 50 % — previous 0.75 is already recorded.
    const at50 = applyPhaseThresholds({ ...at75, hp: 10 });
    expect(at50.crossedPhaseThresholds).toEqual([0.5, 0.75]);
    expect(at50.attackPattern.damagePerTurn).toBe(4);

    // Drop to 25 % — previous 0.75 and 0.5 are already recorded.
    const at25 = applyPhaseThresholds({ ...at50, hp: 5 });
    expect(at25.crossedPhaseThresholds).toEqual([0.25, 0.5, 0.75]);
    expect(at25.attackPattern.damagePerTurn).toBe(5);

    // Stay at 25 % — all thresholds already crossed, no change.
    const stillAt25 = applyPhaseThresholds(at25);
    expect(stillAt25).toBe(at25);
  });
});

// ---------------------------------------------------------------------------
// 4. Phantom Vurmox T2 proof — wired boss driven across a threshold.
// ---------------------------------------------------------------------------

describe('COLOSSEUM_PHANTOM_VURMOX_T2 — phaseThresholds wired', () => {
  it('carries a typed, optional, readonly phaseThresholds list', () => {
    expect(COLOSSEUM_PHANTOM_VURMOX_T2.phaseThresholds).toBeDefined();
    expect(COLOSSEUM_PHANTOM_VURMOX_T2.phaseThresholds!.length).toBe(3);
    // Readonly / typed: every entry has atHpFraction and transition.
    for (const t of COLOSSEUM_PHANTOM_VURMOX_T2.phaseThresholds!) {
      expect(typeof t.atHpFraction).toBe('number');
      expect(t.transition).toBeDefined();
    }
  });

  it('all thresholds declare remix-only transitions (type-backed runtime check)', () => {
    for (const threshold of COLOSSEUM_PHANTOM_VURMOX_T2.phaseThresholds!) {
      expect(() =>
        assertPhaseTransitionRemixOnly(
          COLOSSEUM_PHANTOM_VURMOX_T2,
          threshold.transition,
          `phantom-vurmox threshold ${threshold.atHpFraction}`,
        ),
      ).not.toThrow();
    }
  });

  it('no transition fires at full HP (22/22 = 100 %)', () => {
    expect(applyPhaseThresholds(COLOSSEUM_PHANTOM_VURMOX_T2)).toBe(COLOSSEUM_PHANTOM_VURMOX_T2);
  });

  it('75 % threshold fires when HP drops to 16 (16/22 ≈ 72.7 %)', () => {
    const boss = { ...COLOSSEUM_PHANTOM_VURMOX_T2, hp: 16 };
    const result = applyPhaseThresholds(boss);

    expect(result).not.toBe(boss);
    expect(result.crossedPhaseThresholds).toContain(0.75);
    // At 75 % the transition switches to aoe targeting.
    expect(result.attackPattern.targeting).toBe('aoe');
    expect(result.attackPattern.damagePerTurn).toBe(3);
    // Resolver stays unchanged.
    expect(result.attackPattern.bossAttackResolver).toBe('phantom-vurmox-volley');
  });

  it('50 % threshold fires when HP reaches 11 (75 % already crossed)', () => {
    const after75 = applyPhaseThresholds({ ...COLOSSEUM_PHANTOM_VURMOX_T2, hp: 16 });
    const result = applyPhaseThresholds({ ...after75, hp: 11 });

    expect(result.crossedPhaseThresholds).toContain(0.5);
    expect(result.attackPattern.damagePerTurn).toBe(4);
    expect(result.attackPattern.targeting).toBe('aoe');
  });

  it('25 % threshold fires when HP reaches 5 (75 % and 50 % already crossed)', () => {
    const after75 = applyPhaseThresholds({ ...COLOSSEUM_PHANTOM_VURMOX_T2, hp: 16 });
    const after50 = applyPhaseThresholds({ ...after75, hp: 11 });
    const result = applyPhaseThresholds({ ...after50, hp: 5 });

    expect(result.crossedPhaseThresholds).toContain(0.25);
    expect(result.attackPattern.damagePerTurn).toBe(5);
    expect(result.attackPattern.targeting).toBe('aoe');
  });

  it('stateTags are untouched by phase transitions (sequence tag evolves independently)', () => {
    // Phase transition only touches attackPattern; stateTags should be
    // the same array reference after a phase fires.
    const boss = { ...COLOSSEUM_PHANTOM_VURMOX_T2, hp: 16 };
    const result = applyPhaseThresholds(boss);

    expect(result.stateTags).toBe(COLOSSEUM_PHANTOM_VURMOX_T2.stateTags);
  });

  it('each threshold fires exactly once — driven through all three phases', () => {
    // Simulate the full fight: HP ticks down through all three phases.
    let boss: CombatBoss = COLOSSEUM_PHANTOM_VURMOX_T2;

    // Full HP — no transitions yet.
    boss = applyPhaseThresholds(boss);
    expect(boss.attackPattern.targeting).toBe('battlefield-then-player');
    expect(boss.crossedPhaseThresholds ?? []).toHaveLength(0);

    // Below 75 % (17 → 16 HP).
    boss = applyPhaseThresholds({ ...boss, hp: 16 });
    expect(boss.attackPattern.targeting).toBe('aoe');
    expect(boss.attackPattern.damagePerTurn).toBe(3);
    expect(boss.crossedPhaseThresholds).toHaveLength(1);

    // Still below 75 % but above 50 % (13 HP — stays in band, no new fire).
    const beforeFifty = applyPhaseThresholds({ ...boss, hp: 13 });
    expect(beforeFifty.crossedPhaseThresholds).toHaveLength(1);
    expect(beforeFifty.attackPattern.damagePerTurn).toBe(3); // no change

    // Below 50 % (11 HP).
    boss = applyPhaseThresholds({ ...boss, hp: 11 });
    expect(boss.attackPattern.damagePerTurn).toBe(4);
    expect(boss.crossedPhaseThresholds).toHaveLength(2);

    // Below 25 % (5 HP).
    boss = applyPhaseThresholds({ ...boss, hp: 5 });
    expect(boss.attackPattern.damagePerTurn).toBe(5);
    expect(boss.crossedPhaseThresholds).toHaveLength(3);

    // No further transitions (all crossed) — check that crossedPhaseThresholds
    // stays the same length and damagePerTurn doesn't increase further.
    const final = applyPhaseThresholds({ ...boss, hp: 1 });
    expect(final.crossedPhaseThresholds).toHaveLength(3);
    expect(final.attackPattern.damagePerTurn).toBe(5); // unchanged at max
  });
});

// ---------------------------------------------------------------------------
// 5. Immutability — applyPhaseThresholds returns a new object.
// ---------------------------------------------------------------------------

describe('applyPhaseThresholds — immutability', () => {
  it('returns a new boss object when a transition fires', () => {
    const boss = makeThresholdBoss(15); // 75 %
    const result = applyPhaseThresholds(boss);
    expect(result).not.toBe(boss);
    // Original is unchanged.
    expect(boss.attackPattern.damagePerTurn).toBe(2);
    expect(boss.crossedPhaseThresholds).toBeUndefined();
  });
});
