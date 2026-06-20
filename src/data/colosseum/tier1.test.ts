/**
 * Vocabulary smoke-test for tier-1 colosseum boss specs
 * (embertide-v8ei). Asserts that the 4 designer-assigned
 * archetypes land on the right specs and that each spec carries the
 * stateTag-kinds canonical for that archetype. Numbers are illustrative
 * — they're not asserted, just the SHAPE.
 */
import { describe, expect, it } from 'vitest';
import {
  COLOSSEUM_CRAGHORN_T1,
  COLOSSEUM_COILWORM_T1,
  COLOSSEUM_BONEREAVER_T1,
  COLOSSEUM_BOULDERKIN_T1,
  TIER_1_ROSTER,
} from './tier1';
import type { BossStateTagKind } from '../../types/combat';

function tagKinds(boss: {
  readonly stateTags?: readonly { readonly kind: BossStateTagKind }[];
}): readonly BossStateTagKind[] {
  return (boss.stateTags ?? []).map((t) => t.kind);
}

describe('colosseum tier-1 spec — vocabulary smoke-test', () => {
  it('roster has exactly 4 bosses in designer-ruled order', () => {
    expect(TIER_1_ROSTER).toHaveLength(4);
    expect(TIER_1_ROSTER[0]).toBe(COLOSSEUM_CRAGHORN_T1);
    expect(TIER_1_ROSTER[1]).toBe(COLOSSEUM_COILWORM_T1);
    expect(TIER_1_ROSTER[2]).toBe(COLOSSEUM_BOULDERKIN_T1);
    expect(TIER_1_ROSTER[3]).toBe(COLOSSEUM_BONEREAVER_T1);
  });

  it('Craghorn is Eye archetype with guarded + cycle tags (canonical Eye shape)', () => {
    expect(COLOSSEUM_CRAGHORN_T1.archetype).toBe('eye');
    expect(tagKinds(COLOSSEUM_CRAGHORN_T1)).toEqual(['guarded', 'cycle']);
  });

  it('Coilworm is Eye archetype with guarded + cycle tags (faster cycle)', () => {
    expect(COLOSSEUM_COILWORM_T1.archetype).toBe('eye');
    expect(tagKinds(COLOSSEUM_COILWORM_T1)).toEqual(['guarded', 'cycle']);
  });

  it('Boulderkin is Layered archetype with a layered tag carrying shell + core', () => {
    expect(COLOSSEUM_BOULDERKIN_T1.archetype).toBe('layered');
    expect(tagKinds(COLOSSEUM_BOULDERKIN_T1)).toEqual(['layered']);

    const layeredTag = COLOSSEUM_BOULDERKIN_T1.stateTags?.[0];
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.map((l) => l.id)).toEqual(['shell', 'core']);
    expect(layeredTag.layers.every((l) => !l.defeated)).toBe(true);
  });

  it('Bonereaver is Duel archetype with an adaptive tag carrying a penalty', () => {
    expect(COLOSSEUM_BONEREAVER_T1.archetype).toBe('duel');
    expect(tagKinds(COLOSSEUM_BONEREAVER_T1)).toEqual(['adaptive']);

    const adaptiveTag = COLOSSEUM_BONEREAVER_T1.stateTags?.[0];
    if (adaptiveTag?.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBeGreaterThan(0);
  });

  it('every tier-1 spec carries archetype + at least one stateTag (vocabulary saturated)', () => {
    for (const boss of TIER_1_ROSTER) {
      expect(boss.archetype).toBeDefined();
      expect(boss.stateTags?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
