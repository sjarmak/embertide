/**
 * Unit tests for the Swarm-archetype damage router (embertide-ki0o,
 * sub of lhlo + 4hr1). Pure-function coverage of the single-target /
 * AoE / non-swarm paths.
 *
 * Single-target rule (per Dead Hand canon): the FIRST non-defeated
 * minion (left-to-right scan) absorbs the full damage; overdamage is
 * WASTED (no spillover) — keeps each finger an explicit target the
 * player must clear. Once every minion is defeated, single-target
 * damage hits `boss.hp` (the central head).
 *
 * AoE rule: hits every non-defeated minion AND `boss.hp`
 * simultaneously, full damage to each. No card emits
 * `combat-aoe-attack` today; the AoE branch is dead-but-correct code
 * waiting for a future consumer.
 *
 * Non-swarm short-circuit: `routeSwarmAttack` returns the same boss
 * reference (===) when `boss.archetype !== 'swarm'` or no swarm tag is
 * attached, so callers can pass any CombatBoss without a guard.
 */

import { describe, expect, it } from 'vitest';
import type { BossLayer, BossStateSwarm, BossStateTag, CombatBoss } from '../../types/combat';
import { exposedBonusFor, routeSwarmAttack, routeSwarmAoeAttack } from './damage';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

function makeMinion(args: {
  id: string;
  hp: number;
  hpMax?: number;
  defeated?: boolean;
}): BossLayer {
  const hpMax = args.hpMax ?? args.hp;
  return {
    id: args.id,
    name: `Minion ${args.id}`,
    hp: args.hp,
    hpMax,
    defeated: args.defeated ?? args.hp <= 0,
  };
}

function makeSwarmBoss(args: {
  hp?: number;
  hpMax?: number;
  minions: readonly BossLayer[];
  extraTags?: readonly BossStateTag[];
}): CombatBoss {
  const hp = args.hp ?? 12;
  const swarmTag: BossStateSwarm = { kind: 'swarm', minions: args.minions };
  return {
    hp,
    hpMax: args.hpMax ?? 12,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'battlefield-then-player',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'palegrasp',
    archetype: 'swarm',
    stateTags: [swarmTag, ...(args.extraTags ?? [])],
  };
}

function makeNonSwarmBoss(): CombatBoss {
  return {
    hp: 14,
    hpMax: 14,
    attackPattern: {
      damagePerTurn: 2,
      targeting: 'player-hp',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'craghorn',
  };
}

function getSwarmMinions(boss: CombatBoss): readonly BossLayer[] {
  const tag = boss.stateTags?.find((t) => t.kind === 'swarm');
  if (!tag || tag.kind !== 'swarm') {
    throw new Error('expected swarm tag');
  }
  return tag.minions;
}

// ---------------------------------------------------------------------------
// Non-swarm short-circuit (A1) — reference equality, no surprises.
// ---------------------------------------------------------------------------

describe('routeSwarmAttack — non-swarm short-circuit (A1, A4e)', () => {
  it('returns the same boss reference when archetype is undefined', () => {
    const boss = makeNonSwarmBoss();
    expect(routeSwarmAttack(boss, 5)).toBe(boss);
  });

  it('returns the same boss reference when archetype is non-swarm (eye)', () => {
    const eye: CombatBoss = {
      ...makeNonSwarmBoss(),
      archetype: 'eye',
      stateTags: [
        { kind: 'guarded', until: 'cycle-trigger' },
        { kind: 'cycle', counter: 0, threshold: 2, trigger: 'flip-to-exposed' },
      ],
    };
    expect(routeSwarmAttack(eye, 4)).toBe(eye);
  });

  it('returns the same boss reference when archetype is swarm but stateTags is missing', () => {
    const malformed: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'battlefield-then-player',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'palegrasp',
      archetype: 'swarm',
    };
    expect(routeSwarmAttack(malformed, 4)).toBe(malformed);
  });

  it('returns the same boss reference when archetype is swarm but no swarm tag is attached', () => {
    const malformed: CombatBoss = {
      hp: 12,
      hpMax: 12,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'battlefield-then-player',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'palegrasp',
      archetype: 'swarm',
      stateTags: [{ kind: 'guarded' }],
    };
    expect(routeSwarmAttack(malformed, 4)).toBe(malformed);
  });

  it('returns the same boss reference for damage <= 0 (no work to do)', () => {
    const boss = makeSwarmBoss({
      minions: [makeMinion({ id: 'finger-1', hp: 4 })],
    });
    expect(routeSwarmAttack(boss, 0)).toBe(boss);
    expect(routeSwarmAttack(boss, -3)).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// Single-target routing (A4 a-c).
// ---------------------------------------------------------------------------

describe('routeSwarmAttack — single-target routing (A4 a-c)', () => {
  it('A4a: minion absorbs the full damage when below its hp', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 4 }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
    });
    const next = routeSwarmAttack(boss, 3);
    expect(next.hp).toBe(12); // head untouched
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(1);
    expect(minions[0].defeated).toBe(false);
    expect(minions[1].hp).toBe(4);
    expect(minions[2].hp).toBe(4);
  });

  it('A4a: damage routes to the FIRST non-defeated minion (left-to-right scan)', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 0, defeated: true }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
    });
    const next = routeSwarmAttack(boss, 3);
    expect(next.hp).toBe(12);
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(0);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(1);
    expect(minions[1].defeated).toBe(false);
    expect(minions[2].hp).toBe(4);
  });

  it('A4b: minion downs and residual damage is WASTED (no spillover)', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 4 }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
    });
    // Deal 7 damage — finger-1 (4hp) downs, residual 3 is wasted.
    const next = routeSwarmAttack(boss, 7);
    expect(next.hp).toBe(12); // head untouched
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(0);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(4); // no spillover
    expect(minions[2].hp).toBe(4);
  });

  it('A4b: exact-kill damage downs minion, no spillover', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [makeMinion({ id: 'finger-1', hp: 4 }), makeMinion({ id: 'finger-2', hp: 4 })],
    });
    const next = routeSwarmAttack(boss, 4);
    expect(next.hp).toBe(12);
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(0);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(4);
  });

  it('A4c: damage hits boss.hp directly when all minions are defeated', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 0, defeated: true }),
        makeMinion({ id: 'finger-2', hp: 0, defeated: true }),
        makeMinion({ id: 'finger-3', hp: 0, defeated: true }),
      ],
    });
    const next = routeSwarmAttack(boss, 5);
    expect(next.hp).toBe(7); // 12 - 5
    // Minions stay defeated, no churn.
    const minions = getSwarmMinions(next);
    expect(minions.every((m) => m.defeated)).toBe(true);
  });

  it('A4c: damage hits boss.hp when minions array is empty', () => {
    const boss = makeSwarmBoss({
      hp: 8,
      minions: [],
    });
    const next = routeSwarmAttack(boss, 3);
    expect(next.hp).toBe(5);
  });

  it('A4c: head HP clamps at 0', () => {
    const boss = makeSwarmBoss({
      hp: 3,
      minions: [makeMinion({ id: 'finger-1', hp: 0, defeated: true })],
    });
    const next = routeSwarmAttack(boss, 99);
    expect(next.hp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AoE routing (A4 d).
// ---------------------------------------------------------------------------

describe('routeSwarmAoeAttack — AoE routing (A4 d)', () => {
  it('A4d: AoE hits all non-defeated minions AND boss.hp simultaneously', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 4 }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
    });
    const next = routeSwarmAoeAttack(boss, 2);
    expect(next.hp).toBe(10); // 12 - 2
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(2);
    expect(minions[1].hp).toBe(2);
    expect(minions[2].hp).toBe(2);
    expect(minions.every((m) => !m.defeated)).toBe(true);
  });

  it('A4d: AoE downs minions whose hp drops to 0 and clamps boss.hp at 0', () => {
    const boss = makeSwarmBoss({
      hp: 5,
      minions: [
        makeMinion({ id: 'finger-1', hp: 4 }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
    });
    const next = routeSwarmAoeAttack(boss, 6);
    expect(next.hp).toBe(0);
    const minions = getSwarmMinions(next);
    expect(minions.every((m) => m.hp === 0 && m.defeated)).toBe(true);
  });

  it('A4d: AoE skips already-defeated minions (no double-tap)', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 0, defeated: true }),
        makeMinion({ id: 'finger-2', hp: 4 }),
      ],
    });
    const next = routeSwarmAoeAttack(boss, 2);
    expect(next.hp).toBe(10);
    const minions = getSwarmMinions(next);
    expect(minions[0].hp).toBe(0);
    expect(minions[0].defeated).toBe(true);
    expect(minions[1].hp).toBe(2);
    expect(minions[1].defeated).toBe(false);
  });

  it('A4d: non-swarm boss returns same reference', () => {
    const boss = makeNonSwarmBoss();
    expect(routeSwarmAoeAttack(boss, 3)).toBe(boss);
  });

  it('A4d: damage <= 0 returns same reference', () => {
    const boss = makeSwarmBoss({
      minions: [makeMinion({ id: 'finger-1', hp: 4 })],
    });
    expect(routeSwarmAoeAttack(boss, 0)).toBe(boss);
    expect(routeSwarmAoeAttack(boss, -2)).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// Immutability invariants (A1).
// ---------------------------------------------------------------------------

describe('routeSwarmAttack — immutability', () => {
  it('does not mutate the input boss, stateTags, or minions arrays', () => {
    const minions = [makeMinion({ id: 'finger-1', hp: 4 }), makeMinion({ id: 'finger-2', hp: 4 })];
    const boss = makeSwarmBoss({ hp: 12, minions });
    const originalMinions = [...minions];
    const originalTags = boss.stateTags ? [...boss.stateTags] : [];
    const next = routeSwarmAttack(boss, 3);
    // Inputs untouched.
    expect(minions).toEqual(originalMinions);
    expect(boss.stateTags).toEqual(originalTags);
    expect(boss.hp).toBe(12);
    // Output is a new object.
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
    expect(getSwarmMinions(next)).not.toBe(minions);
  });

  it('preserves non-swarm tags when the swarm tag is updated', () => {
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [makeMinion({ id: 'finger-1', hp: 4 })],
      extraTags: [{ kind: 'exposed', bonus: 1 }],
    });
    const next = routeSwarmAttack(boss, 2);
    expect(next.stateTags).toBeDefined();
    const exposed = next.stateTags?.find((t) => t.kind === 'exposed');
    expect(exposed).toEqual({ kind: 'exposed', bonus: 1 });
  });
});

// ---------------------------------------------------------------------------
// Integration: exposed-bonus + swarm-routing composition
// (embertide-4hr1.11 — z45d × ki0o cross-bead coverage).
// ---------------------------------------------------------------------------
//
// Both code paths individually are unit-tested above, but the production
// composition `effect.damage + exposedBonusFor(boss)` → `routeSwarmAttack`
// (see `applySingleTargetBossDamage` in playerTurn.ts) had no integration
// coverage. This scenario asserts the two helpers compose to deliver
// (base + bonus) onto the targeted minion in one shot.

describe('exposed-bonus × swarm-routing composition (embertide-4hr1.11)', () => {
  it('delivers base damage + exposed.bonus to finger-1 in one routed hit', () => {
    // Dead Hand swarm boss with an active exposed window (bonus = 1).
    const boss = makeSwarmBoss({
      hp: 12,
      minions: [
        makeMinion({ id: 'finger-1', hp: 6 }),
        makeMinion({ id: 'finger-2', hp: 4 }),
        makeMinion({ id: 'finger-3', hp: 4 }),
      ],
      extraTags: [{ kind: 'exposed', bonus: 1 }],
    });

    // Compose damage exactly as production does: base effect damage +
    // exposedBonusFor(boss), then route through routeSwarmAttack.
    const baseDamage = 4;
    const total = baseDamage + exposedBonusFor(boss);
    const next = routeSwarmAttack(boss, total);

    // 4 (base) + 1 (exposed bonus) = 5 onto finger-1 (the first
    // non-defeated minion, per single-target rule). Head untouched.
    const minions = getSwarmMinions(next);
    expect(minions[0].id).toBe('finger-1');
    expect(minions[0].hp).toBe(1); // 6 - 5
    expect(minions[0].defeated).toBe(false);
    expect(minions[1].hp).toBe(4);
    expect(minions[2].hp).toBe(4);
    expect(next.hp).toBe(12);
  });
});
