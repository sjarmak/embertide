/**
 * Roster shape smoke-test for tier-3 colosseum boss specs
 * (embertide-wacl + bngt). Asserts:
 *   - the roster cardinality + designer-ruled order
 *     (Skrall King → Voltwyrm → Vinemaw → Sandscourge → Idolarch),
 *   - every spec uses the canonical kebab-case `sourceCardId` so the
 *     A4 acceptance ("no mid-air boss IDs") is enforced structurally,
 *   - bngt's archetype + stateTag mapping is in place — every spec
 *     carries the ruled archetype + the archetype-shape invariant
 *     (mirror of tier1 + tier2 vocabulary smoke-tests). The 2026-05-10
 *     designer ruling
 *     (`bd memories
 *      embertide-designer-ruling-colosseum-tier3-tier4-archetypes-2026-05-10`)
 *     locks the per-boss assignment.
 */
import { describe, expect, it } from 'vitest';
import {
  COLOSSEUM_VOLTWYRM_T3,
  COLOSSEUM_SKRALL_KING_T3,
  COLOSSEUM_VINEMAW_T3,
  COLOSSEUM_IDOLARCH_T3,
  COLOSSEUM_SANDSCOURGE_T3,
  TIER_3_ROSTER,
} from './tier3';
import type { BossStateTagKind } from '../../types/combat';

const EXPECTED_ORDER = [
  { spec: COLOSSEUM_SKRALL_KING_T3, sourceCardId: 'skrall-king' },
  { spec: COLOSSEUM_VOLTWYRM_T3, sourceCardId: 'voltwyrm' },
  { spec: COLOSSEUM_VINEMAW_T3, sourceCardId: 'vinemaw' },
  { spec: COLOSSEUM_SANDSCOURGE_T3, sourceCardId: 'sandscourge' },
  { spec: COLOSSEUM_IDOLARCH_T3, sourceCardId: 'idolarch' },
] as const;

function tagKinds(boss: {
  readonly stateTags?: readonly { readonly kind: BossStateTagKind }[];
}): readonly BossStateTagKind[] {
  return (boss.stateTags ?? []).map((t) => t.kind);
}

describe('colosseum tier-3 spec — roster shape (embertide-wacl + bngt)', () => {
  it('roster has exactly 5 bosses in designer-ruled order', () => {
    expect(TIER_3_ROSTER).toHaveLength(EXPECTED_ORDER.length);
    EXPECTED_ORDER.forEach((entry, idx) => {
      expect(TIER_3_ROSTER[idx]).toBe(entry.spec);
    });
  });

  it('every spec uses the canonical kebab-case sourceCardId (A4 — no mid-air boss IDs)', () => {
    EXPECTED_ORDER.forEach((entry) => {
      expect(entry.spec.sourceCardId).toBe(entry.sourceCardId);
    });
  });

  it('aggregate hp / hpMax are sane positive integers (placeholder tuning, not designer-locked)', () => {
    for (const boss of TIER_3_ROSTER) {
      expect(boss.hp).toBeGreaterThan(0);
      expect(boss.hpMax).toBe(boss.hp);
      expect(boss.attackPattern.damagePerTurn).toBeGreaterThan(0);
    }
  });

  it('Skrall King is Layered archetype with mask + head layers (aggregate hp = sum)', () => {
    expect(COLOSSEUM_SKRALL_KING_T3.archetype).toBe('layered');
    expect(tagKinds(COLOSSEUM_SKRALL_KING_T3)).toEqual(['layered']);

    const layeredTag = COLOSSEUM_SKRALL_KING_T3.stateTags?.[0];
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.map((l) => l.id)).toEqual(['mask', 'head']);
    expect(layeredTag.layers.every((l) => !l.defeated)).toBe(true);
    const layerSum = layeredTag.layers.reduce((acc, l) => acc + l.hpMax, 0);
    expect(layerSum).toBe(COLOSSEUM_SKRALL_KING_T3.hpMax);
  });

  it('Voltwyrm is Item-Check archetype with a guarded(item-tag-grapnels) tag', () => {
    expect(COLOSSEUM_VOLTWYRM_T3.archetype).toBe('item-check');
    expect(tagKinds(COLOSSEUM_VOLTWYRM_T3)).toEqual(['guarded']);

    const guardedTag = COLOSSEUM_VOLTWYRM_T3.stateTags?.[0];
    if (guardedTag?.kind !== 'guarded') throw new Error('expected guarded tag');
    expect(guardedTag.until).toBe('item-tag-grapnels');
  });

  it('Vinemaw is Item-Check archetype reusing Cinderwyrm T2 bomb-tag', () => {
    expect(COLOSSEUM_VINEMAW_T3.archetype).toBe('item-check');
    expect(tagKinds(COLOSSEUM_VINEMAW_T3)).toEqual(['guarded']);

    const guardedTag = COLOSSEUM_VINEMAW_T3.stateTags?.[0];
    if (guardedTag?.kind !== 'guarded') throw new Error('expected guarded tag');
    expect(guardedTag.until).toBe('item-tag-bomb');
  });

  it('Sandscourge is Layered archetype with pincers + stinger layers (aggregate hp = sum)', () => {
    expect(COLOSSEUM_SANDSCOURGE_T3.archetype).toBe('layered');
    expect(tagKinds(COLOSSEUM_SANDSCOURGE_T3)).toEqual(['layered']);

    const layeredTag = COLOSSEUM_SANDSCOURGE_T3.stateTags?.[0];
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.map((l) => l.id)).toEqual(['pincers', 'stinger']);
    const layerSum = layeredTag.layers.reduce((acc, l) => acc + l.hpMax, 0);
    expect(layerSum).toBe(COLOSSEUM_SANDSCOURGE_T3.hpMax);
  });

  it('Idolarch is Swarm archetype with 6 sword-arm minions (parallel/independent of torso hp)', () => {
    expect(COLOSSEUM_IDOLARCH_T3.archetype).toBe('swarm');
    expect(tagKinds(COLOSSEUM_IDOLARCH_T3)).toEqual(['swarm']);

    const swarmTag = COLOSSEUM_IDOLARCH_T3.stateTags?.[0];
    if (swarmTag?.kind !== 'swarm') throw new Error('expected swarm tag');
    expect(swarmTag.minions).toHaveLength(6);
    expect(swarmTag.minions.every((m) => m.name === 'Sword Arm')).toBe(true);
    expect(swarmTag.minions.every((m) => !m.defeated)).toBe(true);
    // Swarm aggregate boss.hp reads as central-torso channel; minion HP is
    // parallel/independent (mirror Palegrasp T2 convention).
    const minionSum = swarmTag.minions.reduce((acc, m) => acc + m.hpMax, 0);
    expect(minionSum).toBeGreaterThan(0);
  });

  it('every tier-3 spec carries archetype + at least one stateTag (vocabulary saturated)', () => {
    for (const boss of TIER_3_ROSTER) {
      expect(boss.archetype).toBeDefined();
      expect(boss.stateTags?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
