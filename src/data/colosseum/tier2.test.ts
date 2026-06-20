/**
 * Vocabulary smoke-test for tier-2 colosseum boss specs
 * (embertide-acon, sub of 4hr1 + lhlo). Asserts that the 4
 * designer-assigned archetypes land on the right specs and that each
 * spec carries the stateTag-kinds canonical for that archetype.
 *
 * Tier-2 expands the vocabulary smoke-test (tier1.ts → v8ei) with
 * Item-Check + Sequence + a second Layered + a second Duel + Swarm
 * (Dead Hand, 5fgl after kw.boss-state-swarm 1pyu landed) — proving
 * the keyword substrate scales beyond the entry tier without churn.
 *
 * Numbers are illustrative — they're not asserted, just the SHAPE.
 * Designer balance ruling lands as a playtest follow-up after the
 * resolver beads consume these stateTags.
 */
import { describe, expect, it } from 'vitest';
import {
  COLOSSEUM_BLACKGUARD_T2,
  COLOSSEUM_DEAD_HAND_T2,
  COLOSSEUM_CHIMERA_T2,
  COLOSSEUM_PHANTOM_VURMOX_T2,
  COLOSSEUM_CINDERWYRM_T2,
  TIER_2_ROSTER,
} from './tier2';
import type { BossStateTagKind } from '../../types/combat';

function tagKinds(boss: {
  readonly stateTags?: readonly { readonly kind: BossStateTagKind }[];
}): readonly BossStateTagKind[] {
  return (boss.stateTags ?? []).map((t) => t.kind);
}

describe('colosseum tier-2 spec — vocabulary smoke-test', () => {
  it('roster has exactly 5 bosses in designer-ruled order', () => {
    expect(TIER_2_ROSTER).toHaveLength(5);
    expect(TIER_2_ROSTER[0]).toBe(COLOSSEUM_CHIMERA_T2);
    expect(TIER_2_ROSTER[1]).toBe(COLOSSEUM_BLACKGUARD_T2);
    expect(TIER_2_ROSTER[2]).toBe(COLOSSEUM_CINDERWYRM_T2);
    expect(TIER_2_ROSTER[3]).toBe(COLOSSEUM_PHANTOM_VURMOX_T2);
    expect(TIER_2_ROSTER[4]).toBe(COLOSSEUM_DEAD_HAND_T2);
  });

  it('Chimera is Duel archetype with an adaptive tag carrying a penalty (sharper than Bonereaver T1)', () => {
    expect(COLOSSEUM_CHIMERA_T2.archetype).toBe('duel');
    expect(tagKinds(COLOSSEUM_CHIMERA_T2)).toEqual(['adaptive']);

    const adaptiveTag = COLOSSEUM_CHIMERA_T2.stateTags?.[0];
    if (adaptiveTag?.kind !== 'adaptive') throw new Error('expected adaptive tag');
    expect(adaptiveTag.penalty).toBeGreaterThan(0);
  });

  it('Blackguard is Layered archetype with armor → bare-warrior layers', () => {
    expect(COLOSSEUM_BLACKGUARD_T2.archetype).toBe('layered');
    expect(tagKinds(COLOSSEUM_BLACKGUARD_T2)).toEqual(['layered']);

    const layeredTag = COLOSSEUM_BLACKGUARD_T2.stateTags?.[0];
    if (layeredTag?.kind !== 'layered') throw new Error('expected layered tag');
    expect(layeredTag.layers.map((l) => l.id)).toEqual(['armor', 'warrior']);
    expect(layeredTag.layers.every((l) => !l.defeated)).toBe(true);
  });

  it('Cinderwyrm is Item-Check archetype with guarded(until: bomb-tag)', () => {
    expect(COLOSSEUM_CINDERWYRM_T2.archetype).toBe('item-check');
    expect(tagKinds(COLOSSEUM_CINDERWYRM_T2)).toEqual(['guarded']);

    const guardedTag = COLOSSEUM_CINDERWYRM_T2.stateTags?.[0];
    if (guardedTag?.kind !== 'guarded') throw new Error('expected guarded tag');
    expect(guardedTag.until).toBe('item-tag-bomb');
  });

  it('Phantom Vurmox is Sequence archetype with an ordered ball-volley step rotation', () => {
    expect(COLOSSEUM_PHANTOM_VURMOX_T2.archetype).toBe('sequence');
    expect(tagKinds(COLOSSEUM_PHANTOM_VURMOX_T2)).toEqual(['sequence']);

    const seqTag = COLOSSEUM_PHANTOM_VURMOX_T2.stateTags?.[0];
    if (seqTag?.kind !== 'sequence') throw new Error('expected sequence tag');
    expect(seqTag.steps.length).toBeGreaterThanOrEqual(2);
    expect(seqTag.currentIndex).toBe(0);
  });

  it('Phantom Vurmox wires the phantom-vurmox-volley bossAttackResolver', () => {
    expect(COLOSSEUM_PHANTOM_VURMOX_T2.attackPattern.bossAttackResolver).toBe(
      'phantom-vurmox-volley',
    );
  });

  it('Dead Hand is Swarm archetype with parallel finger minions', () => {
    expect(COLOSSEUM_DEAD_HAND_T2.archetype).toBe('swarm');
    expect(tagKinds(COLOSSEUM_DEAD_HAND_T2)).toEqual(['swarm']);

    const swarmTag = COLOSSEUM_DEAD_HAND_T2.stateTags?.[0];
    if (swarmTag?.kind !== 'swarm') throw new Error('expected swarm tag');
    expect(swarmTag.minions.length).toBeGreaterThanOrEqual(2);
    expect(swarmTag.minions.every((m) => !m.defeated)).toBe(true);
    // Canon Dead Hand: head + finger minions; central head is the
    // boss's own hp/hpMax channel, the minions parallel-coexist.
    expect(swarmTag.minions.every((m) => m.hp === m.hpMax)).toBe(true);
  });

  it('every tier-2 spec carries archetype + at least one stateTag (vocabulary saturated)', () => {
    for (const boss of TIER_2_ROSTER) {
      expect(boss.archetype).toBeDefined();
      expect(boss.stateTags?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
