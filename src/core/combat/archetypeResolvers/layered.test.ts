/**
 * Unit tests for the Layered-archetype resolver and damage router
 * (embertide-lhlo.11, sub of lhlo).
 *
 * Three test concerns:
 *   1. `applyLayeredArchetypeTick` — registry peg; always returns same
 *      reference for layered bosses (no end-of-boss-turn tick needed).
 *   2. `routeLayeredDamage` — incoming player damage routes to the
 *      first non-defeated layer; overflow carries to subsequent layers;
 *      killing the core (last layer) sets boss.hp=0.
 *   3. Zone-gating regression — a zone layered boss without allowlist
 *      activation takes vanilla boss.hp damage (i.e. the layered routing
 *      ONLY fires once the spec has been merged into the CombatBoss,
 *      which requires allowlist activation; an unactivated boss has no
 *      archetype:'layered' and falls through to legacy routing).
 *   4. Colosseum COLOSSEUM_BOULDERKIN_T1 end-to-end layer depletion.
 */

import { describe, expect, it } from 'vitest';
import type { CombatBoss } from '../../../types/combat';
import { COLOSSEUM_BOULDERKIN_T1 } from '../../../data/colosseum/tier1';
import { ZONE_BOSS_SPECS } from '../../../data/zones/bossSpecs';
import { KEYWORD_VOCABULARY_ZONE_ALLOWLIST } from '../../../store/combatBootstrap';
import { applyLayeredArchetypeTick, routeLayeredDamage } from './layered';
import { applyArchetypeTick } from './index';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeLayeredBoss(args: {
  hp?: number;
  hpMax?: number;
  layers: Array<{
    id: string;
    name: string;
    hp: number;
    hpMax: number;
    defeated: boolean;
  }>;
}): CombatBoss {
  const layers = args.layers;
  const aggregateHp = args.hp ?? layers.reduce((sum, l) => sum + (l.defeated ? 0 : l.hp), 0);
  const aggregateHpMax = args.hpMax ?? layers.reduce((sum, l) => sum + l.hpMax, 0);
  return {
    hp: aggregateHp,
    hpMax: aggregateHpMax,
    attackPattern: {
      damagePerTurn: 3,
      targeting: 'battlefield-then-player',
      onDefeatEffect: { kind: 'wisp-drop' },
    },
    sourceCardId: 'boulderkin',
    archetype: 'layered',
    stateTags: [
      {
        kind: 'layered',
        layers,
      },
    ],
  };
}

/** A minimal two-layer boss: outer shell (8 HP) → inner core (12 HP). */
function makeStoneTalusLike(): CombatBoss {
  return makeLayeredBoss({
    layers: [
      { id: 'shell', name: 'Ore Shell', hp: 8, hpMax: 8, defeated: false },
      { id: 'core', name: 'Crystal Core', hp: 12, hpMax: 12, defeated: false },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. applyLayeredArchetypeTick — registry peg, always same-reference no-op
// ---------------------------------------------------------------------------

describe('applyLayeredArchetypeTick — non-Layered no-op cases', () => {
  it('returns identical boss when archetype is undefined (legacy fixture)', () => {
    const legacy: CombatBoss = {
      hp: 14,
      hpMax: 14,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'broodmaw',
    };
    expect(applyLayeredArchetypeTick(legacy)).toBe(legacy);
  });

  it('returns identical boss when archetype is non-layered (e.g. eye)', () => {
    const eye: CombatBoss = {
      hp: 14,
      hpMax: 14,
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
    expect(applyLayeredArchetypeTick(eye)).toBe(eye);
  });
});

describe('applyLayeredArchetypeTick — layered tick is a same-reference no-op', () => {
  it('returns the SAME reference for a layered boss (no end-of-turn state change)', () => {
    const boss = makeStoneTalusLike();
    const result = applyLayeredArchetypeTick(boss);
    expect(result).toBe(boss);
  });

  it('returns the SAME reference even after layers have been partially depleted', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 0, hpMax: 8, defeated: true },
        { id: 'core', name: 'Crystal Core', hp: 5, hpMax: 12, defeated: false },
      ],
    });
    const result = applyLayeredArchetypeTick(boss);
    expect(result).toBe(boss);
  });

  it('ARCHETYPE_RESOLVERS has a layered entry and applyArchetypeTick dispatches it', () => {
    const boss = makeStoneTalusLike();
    // applyArchetypeTick must find the 'layered' resolver and call it
    // (which is a same-reference no-op for layered).
    const result = applyArchetypeTick(boss);
    expect(result).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// 2. routeLayeredDamage — basic routing, overflow, core death
// ---------------------------------------------------------------------------

describe('routeLayeredDamage — no-op cases', () => {
  it('returns same reference when archetype is not layered', () => {
    const plain: CombatBoss = {
      hp: 20,
      hpMax: 20,
      attackPattern: {
        damagePerTurn: 3,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'craghorn',
    };
    expect(routeLayeredDamage(plain, 5)).toBe(plain);
  });

  it('returns same reference when damage is 0', () => {
    const boss = makeStoneTalusLike();
    expect(routeLayeredDamage(boss, 0)).toBe(boss);
  });

  it('returns same reference when damage is negative', () => {
    const boss = makeStoneTalusLike();
    expect(routeLayeredDamage(boss, -3)).toBe(boss);
  });

  it('returns same reference when all layers are already defeated', () => {
    // routeLayeredDamage skips defeated:true layers; when ALL layers are
    // defeated there is nothing to absorb damage and no change occurs.
    const allDefeated = makeLayeredBoss({
      hp: 0,
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 0, hpMax: 8, defeated: true },
        { id: 'core', name: 'Crystal Core', hp: 0, hpMax: 12, defeated: true },
      ],
    });
    expect(routeLayeredDamage(allDefeated, 5)).toBe(allDefeated);
  });
});

describe('routeLayeredDamage — damage routes to the outermost non-defeated layer', () => {
  it('partial damage to outer layer: reduces shell HP, leaves core untouched', () => {
    const boss = makeStoneTalusLike();
    const next = routeLayeredDamage(boss, 3);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0]).toEqual({
      id: 'shell',
      name: 'Ore Shell',
      hp: 5,
      hpMax: 8,
      defeated: false,
    });
    expect(layeredTag.layers[1]).toEqual({
      id: 'core',
      name: 'Crystal Core',
      hp: 12,
      hpMax: 12,
      defeated: false,
    });
    expect(next.hp).toBe(17); // 5 + 12
  });

  it('exact-kill outer layer: shell hp → 0, shell defeated, core untouched', () => {
    const boss = makeStoneTalusLike();
    const next = routeLayeredDamage(boss, 8);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0].hp).toBe(0);
    expect(layeredTag.layers[0].defeated).toBe(true);
    expect(layeredTag.layers[1].hp).toBe(12);
    expect(layeredTag.layers[1].defeated).toBe(false);
    expect(next.hp).toBe(12);
  });

  it('overflow: damage exceeds shell HP, surplus carries to core', () => {
    const boss = makeStoneTalusLike(); // shell=8, core=12
    const next = routeLayeredDamage(boss, 10); // 8 kills shell, 2 overflow to core

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0].defeated).toBe(true);
    expect(layeredTag.layers[1].hp).toBe(10); // 12 - 2
    expect(next.hp).toBe(10);
  });

  it('skips already-defeated layers when routing overflow', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 0, hpMax: 8, defeated: true },
        { id: 'core', name: 'Crystal Core', hp: 12, hpMax: 12, defeated: false },
      ],
    });
    // shell is already down; all damage should hit core
    const next = routeLayeredDamage(boss, 5);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0].defeated).toBe(true); // still down
    expect(layeredTag.layers[1].hp).toBe(7); // 12 - 5
    expect(next.hp).toBe(7);
  });
});

describe('routeLayeredDamage — core (last layer) death ends the fight', () => {
  it('exact-kill core: boss.hp becomes 0', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 0, hpMax: 8, defeated: true },
        { id: 'core', name: 'Crystal Core', hp: 12, hpMax: 12, defeated: false },
      ],
    });
    const next = routeLayeredDamage(boss, 12);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[1].defeated).toBe(true);
    expect(next.hp).toBe(0);
  });

  it('overkill on core: boss.hp still 0, does not go negative', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Ore Shell', hp: 0, hpMax: 8, defeated: true },
        { id: 'core', name: 'Crystal Core', hp: 4, hpMax: 12, defeated: false },
      ],
    });
    const next = routeLayeredDamage(boss, 100);
    expect(next.hp).toBe(0);
  });

  it('one-shot through both layers: boss.hp = 0', () => {
    const boss = makeStoneTalusLike(); // shell=8, core=12
    const next = routeLayeredDamage(boss, 9999);
    expect(next.hp).toBe(0);
    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.every((l) => l.defeated)).toBe(true);
  });
});

describe('routeLayeredDamage — multi-layer overflow sequencing', () => {
  it('three-layer boss: damage cascades shell → armor → core', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Shell', hp: 4, hpMax: 4, defeated: false },
        { id: 'armor', name: 'Armor', hp: 4, hpMax: 4, defeated: false },
        { id: 'core', name: 'Core', hp: 6, hpMax: 6, defeated: false },
      ],
    });
    // 4 (kills shell) + 3 (to armor, 1 left) — 7 total
    const next = routeLayeredDamage(boss, 7);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0].defeated).toBe(true);
    expect(layeredTag.layers[1].hp).toBe(1);
    expect(layeredTag.layers[1].defeated).toBe(false);
    expect(layeredTag.layers[2].hp).toBe(6); // untouched
    expect(next.hp).toBe(7); // 0 + 1 + 6
  });

  it('three-layer boss: damage overflows all the way through to core', () => {
    const boss = makeLayeredBoss({
      layers: [
        { id: 'shell', name: 'Shell', hp: 4, hpMax: 4, defeated: false },
        { id: 'armor', name: 'Armor', hp: 4, hpMax: 4, defeated: false },
        { id: 'core', name: 'Core', hp: 6, hpMax: 6, defeated: false },
      ],
    });
    // 4 (kills shell) + 4 (kills armor) + 3 (to core) = 11
    const next = routeLayeredDamage(boss, 11);

    const layeredTag = next.stateTags?.find((t) => t.kind === 'layered');
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers[0].defeated).toBe(true);
    expect(layeredTag.layers[1].defeated).toBe(true);
    expect(layeredTag.layers[2].hp).toBe(3);
    expect(next.hp).toBe(3);
  });
});

describe('routeLayeredDamage — immutability', () => {
  it('returns a new boss object (not the same reference) on damage', () => {
    const boss = makeStoneTalusLike();
    const next = routeLayeredDamage(boss, 3);
    expect(next).not.toBe(boss);
    expect(next.stateTags).not.toBe(boss.stateTags);
  });

  it('original boss layers are untouched after routing', () => {
    const boss = makeStoneTalusLike();
    const tag0 = boss.stateTags![0];
    if (tag0.kind !== 'layered') throw new Error('expected layered tag');
    const originalShellHp = tag0.layers[0].hp;
    routeLayeredDamage(boss, 5);
    const stillTag0 = boss.stateTags![0];
    if (stillTag0.kind !== 'layered') throw new Error('expected layered tag');
    const stillOriginal = stillTag0.layers[0].hp;
    expect(stillOriginal).toBe(originalShellHp);
  });
});

// ---------------------------------------------------------------------------
// 3. COLOSSEUM_BOULDERKIN_T1 end-to-end layer depletion
// ---------------------------------------------------------------------------

describe('COLOSSEUM_BOULDERKIN_T1 — end-to-end layer depletion', () => {
  it('routes damage through shell then core until boss.hp = 0', () => {
    let boss: CombatBoss = COLOSSEUM_BOULDERKIN_T1;
    // Shell = 8 HP, Core = 12 HP. Total = 20.

    // Tick 1: 5 damage → shell takes 5 (3 remaining)
    boss = routeLayeredDamage(boss, 5);
    expect(boss.hp).toBe(15); // 3 + 12
    let layered = boss.stateTags?.find((t) => t.kind === 'layered');
    if (layered?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layered.layers[0].hp).toBe(3);
    expect(layered.layers[0].defeated).toBe(false);
    expect(layered.layers[1].hp).toBe(12);

    // Tick 2: 5 damage → shell takes 3 (kills shell), overflow 2 → core (10 remaining)
    boss = routeLayeredDamage(boss, 5);
    expect(boss.hp).toBe(10); // 0 + 10
    layered = boss.stateTags?.find((t) => t.kind === 'layered');
    if (layered?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layered.layers[0].defeated).toBe(true);
    expect(layered.layers[1].hp).toBe(10);

    // Tick 3: 10 damage → core takes 10 (kills core) → boss.hp = 0
    boss = routeLayeredDamage(boss, 10);
    expect(boss.hp).toBe(0);
    layered = boss.stateTags?.find((t) => t.kind === 'layered');
    if (layered?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layered.layers[1].defeated).toBe(true);
  });

  it('applyLayeredArchetypeTick is a no-op throughout depletion', () => {
    let boss: CombatBoss = COLOSSEUM_BOULDERKIN_T1;
    boss = routeLayeredDamage(boss, 5);

    // After a damage tick, the archetype tick must still be same-ref no-op
    const tickResult = applyLayeredArchetypeTick(boss);
    expect(tickResult).toBe(boss);
  });
});

// ---------------------------------------------------------------------------
// 4. Zone-gating regression
// ---------------------------------------------------------------------------

describe('zone-gating regression — layered zone boss without allowlist activation', () => {
  it('a zone boss with no archetype set takes vanilla boss.hp damage (not layered routing)', () => {
    // This simulates a zone boss like 'iron-sentinel' that has NOT been
    // activated via KEYWORD_VOCABULARY_ZONE_ALLOWLIST — enterCombatAction
    // did NOT merge the ZONE_BOSS_SPECS spec, so the boss has no
    // archetype:'layered' and no stateTags.
    const unactivated: CombatBoss = {
      hp: 6,
      hpMax: 6,
      attackPattern: {
        damagePerTurn: 2,
        targeting: 'player-hp',
        onDefeatEffect: { kind: 'wisp-drop' },
      },
      sourceCardId: 'iron-sentinel',
      // No archetype, no stateTags — zone boss before allowlist activation
    };

    // routeLayeredDamage must return the SAME reference (no-op) because
    // archetype !== 'layered'.
    const result = routeLayeredDamage(unactivated, 3);
    expect(result).toBe(unactivated);
    // Vanilla damage path would reduce boss.hp (not tested here; that's
    // applySingleTargetBossDamage's responsibility). The assertion here is
    // purely that routeLayeredDamage does NOT mutate or reroute.
  });

  it('a zone boss WITH archetype:layered but empty allowlist cannot be created via enterCombatAction (allowlist gate)', () => {
    // This test documents the architectural contract: the allowlist gate
    // lives in enterCombatAction (combatBootstrap.ts), not in the resolver.
    // A boss constructed directly with archetype:'layered' (e.g. in tests)
    // WILL be routed by routeLayeredDamage regardless — that is the correct
    // behavior because the colosseum path pre-populates archetype on the spec.
    // The "zone boss stays vanilla unless activated" property is enforced by
    // combatBootstrap, not by the resolver.
    //
    // Verified by: combatBootstrap.test.ts exercises keywordVocabularyActive
    // with an empty allowlist and asserts no spec merge occurs.
    //
    // This test asserts the zone layered boss (iron-sentinel) has a layered
    // spec defined (so activation CAN wire it), but only when zone is in allowlist.
    const ironKnuckleSpec = ZONE_BOSS_SPECS['iron-sentinel'];
    expect(ironKnuckleSpec.archetype).toBe('layered');
    expect(ironKnuckleSpec.stateTags[0].kind).toBe('layered');

    // And the production allowlist is empty — zone activation is off by default.
    expect(KEYWORD_VOCABULARY_ZONE_ALLOWLIST.size).toBe(0);
  });
});
