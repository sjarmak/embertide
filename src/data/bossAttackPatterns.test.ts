/**
 * u-8e — Boss attack-pattern unit tests.
 *
 * Asserts the invariants called out in the u-8e acceptance:
 *   (A) `attackPatternFor` returns a valid pattern for all seven bosses;
 *   (B) Silver Chimera's damagePerTurn > Sentinel's damagePerTurn;
 *   (C) Vurmox's onDefeatEffect grants BOTH power AND courage shards;
 *   (D) each boss's targeting is one of the valid discriminants.
 */

import { describe, it, expect } from 'vitest';
import { attackPatternFor, BOSS_ATTACK_PATTERNS } from './bossAttackPatterns';
import type { BossAttackPattern } from '../types/combat';

const BOSS_IDS: readonly string[] = [
  'craghorn',
  'broodmaw',
  'boulderkin',
  'ashen-tyrant',
  // gdd.1 (v2.1): Tidehold wild + region added between Death
  // Mountain and Gilded Cage per the spliced ZONE_ORDER.
  'maelstrom',
  'tidewraith',
  // gdd.2 (v2.1): Hollow Shrine wild + region spliced between Maren and
  // Gilded Cage. Substrate ships with vanilla static patterns —
  // hollow-effigy's delayed-echo dynamic resolver and knell's
  // drum-telegraph dynamic dpt land in follow-up beads (gdd.2.4 +
  // embertide-x1qg) once the bossAttackResolver discriminator
  // pattern from gdd.1.2 is in place.
  'hollow-effigy',
  'knell',
  // gdd.3 (v2.1): Dune Sanctum wild + region spliced between Shadow
  // and Gilded Cage. Substrate ships with vanilla static patterns —
  // iron-sentinel's stagger dynamic resolver (gdd.3.3) and hextwins's
  // fire/ice 3-turn cycle dynamic dpt (gdd.3.2) land in follow-up beads
  // once the bossAttackResolver discriminator pattern is in place.
  'iron-sentinel',
  'hextwins',
  'sentinel',
  'silver-chimera',
  // embertide-044 (2026-04-24): rare post-completion wild boss.
  // Outside the u-9f balance band by design — dynamic-spawn encounter
  // rolled at Silver Chimera's defeat.
  'prism-chimera',
  'cagewright-vurmox',
];

const VALID_TARGETING: ReadonlySet<BossAttackPattern['targeting']> = new Set([
  'player-hp',
  'battlefield-then-player',
  'aoe',
]);

function isValidOnDefeatEffect(effect: BossAttackPattern['onDefeatEffect']): boolean {
  if (effect === null) return true;
  switch (effect.kind) {
    case 'wisp-drop':
    case 'none':
      return true;
    case 'shard-grant':
      return (
        Array.isArray(effect.shards) &&
        effect.shards.length > 0 &&
        effect.shards.every((s) => s === 'power' || s === 'courage' || s === 'wisdom')
      );
    default: {
      // Exhaustiveness check — any new kind must be added above.
      const _never: never = effect;
      return _never;
    }
  }
}

describe('bossAttackPatterns — attackPatternFor', () => {
  it('returns a valid pattern for each of the fourteen v2.1 bosses (9 core + 2 shadow + 2 spirit + rainbow post-completion)', () => {
    for (const id of BOSS_IDS) {
      const pattern = attackPatternFor(id);
      expect(pattern, `missing pattern for ${id}`).toBeDefined();
      expect(pattern.damagePerTurn, `${id}: damagePerTurn must be > 0`).toBeGreaterThan(0);
      expect(
        VALID_TARGETING.has(pattern.targeting),
        `${id}: targeting "${pattern.targeting}" is not a valid discriminant`,
      ).toBe(true);
      expect(
        isValidOnDefeatEffect(pattern.onDefeatEffect),
        `${id}: onDefeatEffect is not a valid CombatOnDefeatEffect variant`,
      ).toBe(true);
    }
  });

  it('defines exactly fourteen boss patterns in the exported map (9 core + 2 shadow + rainbow post-completion)', () => {
    expect(Object.keys(BOSS_ATTACK_PATTERNS).sort()).toEqual([...BOSS_IDS].sort());
  });

  it('throws a descriptive error on an unknown boss card id', () => {
    expect(() => attackPatternFor('not-a-real-boss')).toThrow(/no BossAttackPattern defined/);
  });
});

describe('bossAttackPatterns — bossAttackResolver discriminator', () => {
  // Patterns that declare a dynamic resolver, keyed by boss id.
  // Add new entries here as resolver follow-ups land.
  const RESOLVER_BY_BOSS: Readonly<Record<string, string>> = {
    tidewraith: 'tidewraith-tentacle-grab', // gdd.1.2
    'knell': 'knell-drum', // embertide-x1qg
    hextwins: 'hextwins-fire-ice', // embertide-jghb
    'iron-sentinel': 'iron-sentinel-stagger', // embertide-2iyv
    'hollow-effigy': 'hollow-effigy-mirror', // embertide-44w8
  };

  for (const [bossId, resolverId] of Object.entries(RESOLVER_BY_BOSS)) {
    it(`${bossId} pattern declares bossAttackResolver === "${resolverId}"`, () => {
      const pattern = attackPatternFor(bossId);
      expect(pattern.bossAttackResolver).toBe(resolverId);
    });
  }

  it('every non-resolver pattern leaves bossAttackResolver undefined (legacy static fallback)', () => {
    const wiredIds = new Set(Object.keys(RESOLVER_BY_BOSS));
    const legacyIds = BOSS_IDS.filter((id) => !wiredIds.has(id));
    for (const id of legacyIds) {
      const pattern = attackPatternFor(id);
      expect(
        pattern.bossAttackResolver,
        `${id}: bossAttackResolver should be undefined; resolvers ship per-bead`,
      ).toBeUndefined();
    }
  });

  it('every resolver pattern keeps a non-zero static damagePerTurn fallback (legacy / no-snapshot paths)', () => {
    for (const bossId of Object.keys(RESOLVER_BY_BOSS)) {
      const pattern = attackPatternFor(bossId);
      expect(
        pattern.damagePerTurn,
        `${bossId}: static damagePerTurn must remain > 0 as a resolver fallback`,
      ).toBeGreaterThan(0);
    }
  });

  it('tidewraith resolver keeps battlefield-then-player targeting (front-line absorbs still apply)', () => {
    const tidewraith = attackPatternFor('tidewraith');
    expect(tidewraith.targeting).toBe('battlefield-then-player');
  });
});

describe('bossAttackPatterns — invariants', () => {
  it('Silver Chimera damagePerTurn is STRICTLY GREATER than Sentinel damagePerTurn', () => {
    const sentinel = attackPatternFor('sentinel');
    const chimera = attackPatternFor('silver-chimera');
    expect(chimera.damagePerTurn).toBeGreaterThan(sentinel.damagePerTurn);
  });

  it("Vurmox's onDefeatEffect grants BOTH power AND courage shards (v2.1 coincident)", () => {
    const vurmox = attackPatternFor('cagewright-vurmox');
    expect(vurmox.onDefeatEffect).not.toBeNull();
    expect(vurmox.onDefeatEffect?.kind).toBe('shard-grant');
    // Narrow via discriminant.
    if (vurmox.onDefeatEffect?.kind !== 'shard-grant') {
      throw new Error('expected shard-grant onDefeatEffect');
    }
    const shards = [...vurmox.onDefeatEffect.shards];
    expect(shards).toContain('power');
    expect(shards).toContain('courage');
  });

  it('every boss has a valid targeting discriminant', () => {
    for (const id of BOSS_IDS) {
      const pattern = attackPatternFor(id);
      expect(
        VALID_TARGETING.has(pattern.targeting),
        `${id}: targeting "${pattern.targeting}" is not a valid discriminant`,
      ).toBe(true);
    }
  });
});
