/**
 * Type-level smoke tests for the boss-state keyword union
 * (embertide-k08m, sub of lhlo). These mirror the
 * `combat.test.ts` exhaustiveness pattern — no reducer is exercised,
 * the value here is the compile-time `_exhaustive: never` check that
 * trips when a new variant is added without updating consumers.
 *
 * The runtime assertions only confirm the literal shapes round-trip;
 * the schema correctness is what the type-checker enforces.
 */
import { describe, expect, it } from 'vitest';
import type {
  BossArchetype,
  BossLayer,
  BossStateAdaptive,
  BossStateBreak,
  BossStateCycle,
  BossStateExposed,
  BossStateGuarded,
  BossStateLayered,
  BossStateSequence,
  BossStateSwarm,
  BossStateTag,
  BossStateTagKind,
  CombatBoss,
} from './combat';

function archetypeKind(a: BossArchetype): BossArchetype {
  switch (a) {
    case 'eye':
      return a;
    case 'item-check':
      return a;
    case 'layered':
      return a;
    case 'sequence':
      return a;
    case 'duel':
      return a;
    case 'swarm':
      return a;
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

function bossStateKind(tag: BossStateTag): BossStateTagKind {
  switch (tag.kind) {
    case 'guarded':
      return tag.kind;
    case 'exposed':
      return tag.kind;
    case 'cycle':
      return tag.kind;
    case 'break':
      return tag.kind;
    case 'layered':
      return tag.kind;
    case 'sequence':
      return tag.kind;
    case 'adaptive':
      return tag.kind;
    case 'swarm':
      return tag.kind;
    default: {
      const _exhaustive: never = tag;
      return _exhaustive;
    }
  }
}

describe('BossStateTag — keyword-vocabulary type union', () => {
  it('every variant accepts a structurally-valid literal', () => {
    const guarded: BossStateGuarded = { kind: 'guarded', until: 'cycle-trigger' };
    const exposed: BossStateExposed = { kind: 'exposed', bonus: 2 };
    const cycle: BossStateCycle = {
      kind: 'cycle',
      counter: 0,
      threshold: 2,
      trigger: 'flip-to-exposed',
    };
    const breakTag: BossStateBreak = { kind: 'break', counter: 3 };
    const layered: BossStateLayered = {
      kind: 'layered',
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 10, hpMax: 10, defeated: false },
        { id: 'core', name: 'Crystal Core', hp: 20, hpMax: 20, defeated: false },
      ],
    };
    const sequence: BossStateSequence = {
      kind: 'sequence',
      steps: ['fire', 'ice', 'fire'],
      currentIndex: 0,
    };
    const adaptive: BossStateAdaptive = { kind: 'adaptive', penalty: 1 };
    const swarm: BossStateSwarm = {
      kind: 'swarm',
      minions: [
        { id: 'finger-l', name: 'Left Finger', hp: 4, hpMax: 4, defeated: false },
        { id: 'finger-r', name: 'Right Finger', hp: 4, hpMax: 4, defeated: false },
      ],
    };

    const tags: readonly BossStateTag[] = [
      guarded,
      exposed,
      cycle,
      breakTag,
      layered,
      sequence,
      adaptive,
      swarm,
    ];
    expect(tags.map(bossStateKind)).toEqual([
      'guarded',
      'exposed',
      'cycle',
      'break',
      'layered',
      'sequence',
      'adaptive',
      'swarm',
    ]);
  });

  it('BossStateSwarm carries a parallel minion list (independent of central boss hp)', () => {
    const deadHandSwarm: BossStateSwarm = {
      kind: 'swarm',
      minions: [
        { id: 'finger-1', name: 'Grasping Finger', hp: 3, hpMax: 3, defeated: false },
        { id: 'finger-2', name: 'Grasping Finger', hp: 3, hpMax: 3, defeated: false },
        { id: 'finger-3', name: 'Grasping Finger', hp: 0, hpMax: 3, defeated: true },
      ],
    };
    expect(bossStateKind(deadHandSwarm)).toBe('swarm');
    expect(deadHandSwarm.minions).toHaveLength(3);
    expect(deadHandSwarm.minions[2].defeated).toBe(true);
  });

  it('Guarded permits omitting `until` and Exposed permits omitting `bonus`', () => {
    const guardedNoCondition: BossStateGuarded = { kind: 'guarded' };
    const exposedNoBonus: BossStateExposed = { kind: 'exposed' };
    expect(bossStateKind(guardedNoCondition)).toBe('guarded');
    expect(bossStateKind(exposedNoBonus)).toBe('exposed');
  });

  it('BossLayer enforces hp and defeated independently', () => {
    const downedShell: BossLayer = {
      id: 'shell',
      name: 'Ore Shell',
      hp: 0,
      hpMax: 10,
      defeated: true,
    };
    const aliveCore: BossLayer = {
      id: 'core',
      name: 'Crystal Core',
      hp: 20,
      hpMax: 20,
      defeated: false,
    };
    expect(downedShell.defeated).toBe(true);
    expect(aliveCore.defeated).toBe(false);
  });

  it('BossArchetype literal-union covers the six designer-ruled archetypes', () => {
    const archetypes: readonly BossArchetype[] = [
      'eye',
      'item-check',
      'layered',
      'sequence',
      'duel',
      'swarm',
    ];
    expect(archetypes.map(archetypeKind)).toEqual([
      'eye',
      'item-check',
      'layered',
      'sequence',
      'duel',
      'swarm',
    ]);
  });

  it('CombatBoss accepts an optional stateTags array carrying multiple coexisting tags', () => {
    // Eye-archetype literal: guarded + cycle counting toward an
    // exposed-window flip. Proves multi-tag coexistence at the type
    // level (single-tag-per-boss would not cover the keyword vocab)
    // AND that `archetype` pairs with `stateTags`.
    const eyeBoss: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };

    // Pre-keyword-vocabulary boss literals stay valid — `stateTags` is
    // optional so existing test fixtures and reducers don't churn.
    const legacyBoss: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'broodmaw',
    };

    expect(eyeBoss.stateTags).toHaveLength(2);
    expect(eyeBoss.archetype).toBe('eye');
    expect(legacyBoss.stateTags).toBeUndefined();
    expect(legacyBoss.archetype).toBeUndefined();
  });
});
