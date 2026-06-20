/**
 * Roster shape smoke-test for tier-4 colosseum boss specs
 * (embertide-wacl + bngt). Same shape as tier3.test.ts:
 *   - roster cardinality + designer-ruled order,
 *   - canonical kebab-case sourceCardId,
 *   - bngt's archetype + stateTag mapping is in place — every spec
 *     carries the ruled archetype + the archetype-shape invariant
 *     (mirror of tier1 + tier2 + tier3 vocabulary smoke-tests). The
 *     2026-05-10 designer ruling
 *     (`bd memories
 *      embertide-designer-ruling-colosseum-tier3-tier4-archetypes-2026-05-10`)
 *     locks the per-boss assignment.
 */
import { describe, expect, it } from 'vitest';
import {
  COLOSSEUM_OBLIVAR_T4,
  COLOSSEUM_PYRAX_T4,
  COLOSSEUM_OSSIARCH_T4,
  COLOSSEUM_THE_IMPRISONED_T4,
  TIER_4_ROSTER,
} from './tier4';
import type { BossStateTagKind } from '../../types/combat';

const EXPECTED_ORDER = [
  { spec: COLOSSEUM_OSSIARCH_T4, sourceCardId: 'ossiarch' },
  { spec: COLOSSEUM_THE_IMPRISONED_T4, sourceCardId: 'the-fettered' },
  { spec: COLOSSEUM_PYRAX_T4, sourceCardId: 'pyrax' },
  { spec: COLOSSEUM_OBLIVAR_T4, sourceCardId: 'oblivar' },
] as const;

function tagKinds(boss: {
  readonly stateTags?: readonly { readonly kind: BossStateTagKind }[];
}): readonly BossStateTagKind[] {
  return (boss.stateTags ?? []).map((t) => t.kind);
}

describe('colosseum tier-4 spec — roster shape (embertide-wacl + bngt)', () => {
  it('roster has exactly 4 bosses in designer-ruled order', () => {
    expect(TIER_4_ROSTER).toHaveLength(EXPECTED_ORDER.length);
    EXPECTED_ORDER.forEach((entry, idx) => {
      expect(TIER_4_ROSTER[idx]).toBe(entry.spec);
    });
  });

  it('every spec uses the canonical kebab-case sourceCardId (A4 — no mid-air boss IDs)', () => {
    EXPECTED_ORDER.forEach((entry) => {
      expect(entry.spec.sourceCardId).toBe(entry.sourceCardId);
    });
  });

  it('aggregate hp / hpMax are sane positive integers (placeholder tuning, not designer-locked)', () => {
    for (const boss of TIER_4_ROSTER) {
      expect(boss.hp).toBeGreaterThan(0);
      expect(boss.hpMax).toBe(boss.hp);
      expect(boss.attackPattern.damagePerTurn).toBeGreaterThan(0);
    }
  });

  it('Ossiarch is Layered archetype with spine + skull layers (aggregate hp = sum)', () => {
    expect(COLOSSEUM_OSSIARCH_T4.archetype).toBe('layered');
    expect(tagKinds(COLOSSEUM_OSSIARCH_T4)).toEqual(['layered']);

    const layeredTag = COLOSSEUM_OSSIARCH_T4.stateTags?.[0];
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.map((l) => l.id)).toEqual(['spine', 'skull']);
    expect(layeredTag.layers.every((l) => !l.defeated)).toBe(true);
    const layerSum = layeredTag.layers.reduce((acc, l) => acc + l.hpMax, 0);
    expect(layerSum).toBe(COLOSSEUM_OSSIARCH_T4.hpMax);
  });

  it('The Imprisoned is Sequence archetype with 3-step toe cycle (one longer than Phantom Vurmox T2)', () => {
    expect(COLOSSEUM_THE_IMPRISONED_T4.archetype).toBe('sequence');
    expect(tagKinds(COLOSSEUM_THE_IMPRISONED_T4)).toEqual(['sequence']);

    const sequenceTag = COLOSSEUM_THE_IMPRISONED_T4.stateTags?.[0];
    if (sequenceTag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(sequenceTag.steps).toEqual(['toe-charge', 'toe-strike', 'lap-up']);
    expect(sequenceTag.currentIndex).toBe(0);
  });

  it('Pyrax is Eye archetype with guarded + cycle tags (threshold 1 = faster than Craghorn T1)', () => {
    expect(COLOSSEUM_PYRAX_T4.archetype).toBe('eye');
    expect(tagKinds(COLOSSEUM_PYRAX_T4)).toEqual(['guarded', 'cycle']);

    const guardedTag = COLOSSEUM_PYRAX_T4.stateTags?.[0];
    if (guardedTag?.kind !== 'guarded') throw new Error('expected guarded tag');
    expect(guardedTag.until).toBe('cycle-trigger');

    const cycleTag = COLOSSEUM_PYRAX_T4.stateTags?.[1];
    if (cycleTag?.kind !== 'cycle') throw new Error('expected cycle tag');
    expect(cycleTag.threshold).toBe(1);
    expect(cycleTag.trigger).toBe('flip-to-exposed');
    expect(cycleTag.counter).toBe(0);
  });

  it('Oblivar is Sequence archetype with 3-beat capstone dance', () => {
    expect(COLOSSEUM_OBLIVAR_T4.archetype).toBe('sequence');
    expect(tagKinds(COLOSSEUM_OBLIVAR_T4)).toEqual(['sequence']);

    const sequenceTag = COLOSSEUM_OBLIVAR_T4.stateTags?.[0];
    if (sequenceTag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(sequenceTag.steps).toEqual(['charge', 'lightning', 'sword']);
    expect(sequenceTag.currentIndex).toBe(0);
  });

  it('every tier-4 spec carries archetype + at least one stateTag (vocabulary saturated)', () => {
    for (const boss of TIER_4_ROSTER) {
      expect(boss.archetype).toBeDefined();
      expect(boss.stateTags?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
