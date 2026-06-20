/**
 * Tests for the per-boss named-attack catalog (embertide-9lj6).
 *
 * Three invariants:
 *   (1) Every BOSS_ATTACK_PATTERNS key has a name entry — either in
 *       STATIC_NAMES or DYNAMIC_NAMES. A boss without a catalog entry
 *       would fall back to the literal "Attack" string and lose the
 *       narrative beat the bead landed.
 *   (2) Static-pattern bosses cycle through their 3-name catalog keyed
 *       off `turnIndex % 3`.
 *   (3) Dynamic-resolver bosses dispatch off the SAME state slice their
 *       resolver consumes (turnIndex / tideGaugeSnapshot / echoQueue),
 *       so the rendered name always matches the damage that lands.
 */

import { describe, expect, it } from 'vitest';
import { attackNameFor, BOSS_ATTACK_NAMES } from './bossAttackNames';
import { BOSS_ATTACK_PATTERNS } from './bossAttackPatterns';
import type { CombatBoss } from '../types/combat';

function makeBoss(id: string): CombatBoss {
  const pattern = BOSS_ATTACK_PATTERNS[id];
  return {
    hp: 10,
    hpMax: 10,
    sourceCardId: id,
    attackPattern: pattern,
  };
}

describe('bossAttackNames — catalog coverage (invariant 1)', () => {
  it('every BOSS_ATTACK_PATTERNS key has a name entry', () => {
    const missing: string[] = [];
    for (const id of Object.keys(BOSS_ATTACK_PATTERNS)) {
      const inStatic = id in BOSS_ATTACK_NAMES.static;
      const inDynamic = id in BOSS_ATTACK_NAMES.dynamic;
      if (!inStatic && !inDynamic) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  it('static + dynamic catalogs are disjoint (no boss in both)', () => {
    const collision: string[] = [];
    for (const id of Object.keys(BOSS_ATTACK_NAMES.static)) {
      if (id in BOSS_ATTACK_NAMES.dynamic) collision.push(id);
    }
    expect(collision).toEqual([]);
  });

  it('falls back to literal "Attack" for unknown boss id', () => {
    const ghost: CombatBoss = {
      hp: 1,
      hpMax: 1,
      sourceCardId: 'no-such-boss',
      attackPattern: BOSS_ATTACK_PATTERNS.craghorn,
    };
    expect(attackNameFor(ghost)).toBe('Attack');
  });

  it('does not surface body-horror language ("larva", "flesh", "necro", "bone")', () => {
    // 6yo tone filter — designer ruling 2026-04-25 substituted broodmaw's
    // "Spawn Larva" with "Skitter Charge". This test guards against
    // regression on any future name addition.
    const filtered = ['larva', 'flesh', 'necro', 'bone', 'corpse', 'gore'];
    const allNames: string[] = [];
    for (const trio of Object.values(BOSS_ATTACK_NAMES.static)) {
      allNames.push(...trio);
    }
    // Dynamic resolvers fire functions; sample the full state space we
    // care about here. Cycle indices 0..2 cover every static branch in
    // every dynamic resolver; tide gauge 0/2/4 covers all tidewraith bands;
    // echoQueue null/non-null covers hollow-effigy's two branches.
    const dynamicSamples: Array<Parameters<typeof attackNameFor>[1]> = [
      { turnIndex: 0, tideGaugeSnapshot: 0, echoQueue: null },
      { turnIndex: 1, tideGaugeSnapshot: 2, echoQueue: null },
      { turnIndex: 2, tideGaugeSnapshot: 4, echoQueue: null },
      { turnIndex: 0, tideGaugeSnapshot: 0, echoQueue: { power: 3, sourceCardId: 'x' } },
    ];
    for (const id of Object.keys(BOSS_ATTACK_NAMES.dynamic)) {
      for (const ctx of dynamicSamples) {
        allNames.push(attackNameFor(makeBoss(id), ctx));
      }
    }
    for (const name of allNames) {
      const lower = name.toLowerCase();
      for (const bad of filtered) {
        expect(lower.includes(bad), `name "${name}" contains banned token "${bad}"`).toBe(false);
      }
    }
  });
});

describe('bossAttackNames — static rotation (invariant 2)', () => {
  it('craghorn cycles Rock Throw → Swipe → Stomp', () => {
    const boss = makeBoss('craghorn');
    expect(attackNameFor(boss, { turnIndex: 0 })).toBe('Rock Throw');
    expect(attackNameFor(boss, { turnIndex: 1 })).toBe('Swipe');
    expect(attackNameFor(boss, { turnIndex: 2 })).toBe('Stomp');
    // Wraps around at index 3.
    expect(attackNameFor(boss, { turnIndex: 3 })).toBe('Rock Throw');
  });

  it('broodmaw surfaces softened name (not "Spawn Larva")', () => {
    // Body-horror filter — 6yo tone audit 2026-04-25.
    const boss = makeBoss('broodmaw');
    const turn1Name = attackNameFor(boss, { turnIndex: 1 });
    expect(turn1Name).toBe('Skitter Charge');
    expect(turn1Name.toLowerCase()).not.toContain('larva');
  });

  it('cagewright-vurmox cycles trident → beam → smash', () => {
    const boss = makeBoss('cagewright-vurmox');
    expect(attackNameFor(boss, { turnIndex: 0 })).toBe('Trident Slash');
    expect(attackNameFor(boss, { turnIndex: 1 })).toBe('Dark Beam');
    expect(attackNameFor(boss, { turnIndex: 2 })).toBe('Thunder Smash');
  });

  it('defaults to the index-0 name when turnIndex is omitted', () => {
    const boss = makeBoss('boulderkin');
    expect(attackNameFor(boss)).toBe('Boulder Hurl');
  });
});

describe('bossAttackNames — dynamic dispatch (invariant 3)', () => {
  it('tidewraith names track tide gauge bands (low/mid/high)', () => {
    const boss = makeBoss('tidewraith');
    // Low tide: 0..1
    expect(attackNameFor(boss, { tideGaugeSnapshot: 0 })).toBe('Tentacle Grab');
    expect(attackNameFor(boss, { tideGaugeSnapshot: 1 })).toBe('Tentacle Grab');
    // Mid tide: 2..3
    expect(attackNameFor(boss, { tideGaugeSnapshot: 2 })).toBe('Water Whip');
    expect(attackNameFor(boss, { tideGaugeSnapshot: 3 })).toBe('Water Whip');
    // High tide: 4+
    expect(attackNameFor(boss, { tideGaugeSnapshot: 4 })).toBe('Chain Drag');
    expect(attackNameFor(boss, { tideGaugeSnapshot: 6 })).toBe('Chain Drag');
  });

  it('hollow-effigy reflects echoQueue presence', () => {
    const boss = makeBoss('hollow-effigy');
    expect(attackNameFor(boss, { echoQueue: null })).toBe('Shadow Echo');
    expect(attackNameFor(boss, { echoQueue: { power: 3, sourceCardId: 'wisp-bow' } })).toBe(
      'Mirror Strike',
    );
  });

  it('knell alternates telegraph (even turn) / slam (odd turn)', () => {
    const boss = makeBoss('knell');
    expect(attackNameFor(boss, { turnIndex: 0 })).toBe('Drum Telegraph');
    expect(attackNameFor(boss, { turnIndex: 1 })).toBe('Drum Slam');
    expect(attackNameFor(boss, { turnIndex: 2 })).toBe('Drum Telegraph');
    expect(attackNameFor(boss, { turnIndex: 3 })).toBe('Drum Slam');
  });

  it('hextwins: fire / ice / fire cycle', () => {
    const boss = makeBoss('hextwins');
    expect(attackNameFor(boss, { turnIndex: 0 })).toBe('Fire Blast');
    expect(attackNameFor(boss, { turnIndex: 1 })).toBe('Ice Freeze');
    expect(attackNameFor(boss, { turnIndex: 2 })).toBe('Fire Blast');
  });

  it('iron-sentinel: wind-up / heavy swing / stagger', () => {
    const boss = makeBoss('iron-sentinel');
    expect(attackNameFor(boss, { turnIndex: 0 })).toBe('Wind-up');
    expect(attackNameFor(boss, { turnIndex: 1 })).toBe('Heavy Swing');
    expect(attackNameFor(boss, { turnIndex: 2 })).toBe('Stagger');
  });
});
