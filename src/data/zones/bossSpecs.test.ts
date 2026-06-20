/**
 * Spec-shape tests for ZONE_BOSS_SPECS (embertide-lhlo.1, .2, .3, .4, .5, .6).
 *
 * Forward-compat registry — has NO production consumer until
 * embertide-lhlo.7 (activation). These tests guard structural
 * correctness of the entries so divergence from the keyword-vocabulary
 * substrate is caught at lint/CI time, not at activation time.
 *
 * Mirrors the colosseum tier-1/2/5 smoke-test shape (`src/data/colosseum/
 * tier1.test.ts`, `tier2.test.ts`, `tier5.test.ts`) for consistency
 * across the keyword-vocabulary surface. lhlo.4 adds the duel +
 * sequence archetypes (hollow-effigy + knell) on top of lhlo.1's
 * eye-only scaffolding; per-card resolver constants (hollow-effigy mirror
 * BASE/MAX dpt, knell phase split) are imported here so a
 * resolver tuning that drifts metadata fires a test failure instead
 * of silently de-syncing the spec. lhlo.6 layers Gilded Cage
 * (sentinel item-check, silver-chimera + prism-chimera duel,
 * cagewright-vurmox sequence) on top of that. lhlo.2 adds the layered
 * archetype (boulderkin Shell→Core) plus a second item-check entry
 * (ashen-tyrant bomb). lhlo.5 adds spirit (iron-sentinel layered +
 * hextwins sequence Fire→Ice→Fire).
 */
import { describe, expect, it } from 'vitest';
import { HOLLOW_EFFIGY_BASE_DPT, HOLLOW_EFFIGY_MAX_DPT } from '../../core/combat/bossResolvers/hollowEffigy';
import type { BossArchetype } from '../../types/combat';
import { ZONE_BOSS_SPECS, type ZoneBossSpec } from './bossSpecs';

// The eye resolver (`src/core/combat/archetypeResolvers/eye.ts`) is
// order-agnostic — it uses `findIndex` for tag lookup — so reordering
// [guarded, cycle] is behaviorally benign. The ordered
// `toEqual(['guarded', 'cycle'])` assertions match the colosseum
// precedent and exist as authorial-drift detection: a reorder is a
// flag to re-check resolver assumptions.
function tagKinds(spec: ZoneBossSpec): readonly string[] {
  return spec.stateTags.map((t) => t.kind);
}

// Bound to BossArchetype via `satisfies` so a future variant change in
// the type union forces this list to update (a runtime Set would
// silently drift). Order is irrelevant; `toContain` is unordered.
const CANONICAL_ARCHETYPES = [
  'eye',
  'item-check',
  'layered',
  'sequence',
  'duel',
  'swarm',
] as const satisfies readonly BossArchetype[];

// Per-card eye-archetype expectations. Threshold 2 is locked by the
// designer ruling (mirrors COLOSSEUM_CRAGHORN_T1); per-boss tuning lands
// with lhlo.7 activation.
//   - craghorn / broodmaw: sylvani (lhlo.1)
//   - maelstrom:      maren wild (lhlo.3)
const EYE_ARCHETYPE_CARDS = ['craghorn', 'broodmaw', 'maelstrom'] as const;

// Per-card item-check expectations. The `until` discriminant names
// the item-tag string the item-check resolver reads to flip the
// guard. Mirrors the COLOSSEUM_CINDERWYRM_T2 shape (single guarded tag).
//   - ashen-tyrant (lhlo.2): emberpeak region — bomb weak point
//   - tidewraith (lhlo.3): maren region — grapplethorn pulls nucleus
//   - sentinel (lhlo.6): gilded-cage wild — aegis-pane reflects laser
const ITEM_CHECK_CARDS = [
  { id: 'ashen-tyrant', until: 'item-tag-bomb' },
  { id: 'tidewraith', until: 'item-tag-grapplethorn' },
  { id: 'sentinel', until: 'item-tag-aegis-pane' },
] as const;

// Per-card layered-archetype expectations. The colosseum precedent
// (`COLOSSEUM_BOULDERKIN_T1`) ships a 2-layer Shell→Core split; the
// zone-mode ports mirror that 2-layer shape with HP scaled to the
// per-zone aggregate (see `BOSS_HP` in src/data/bossAttackPatterns.ts).
//   - boulderkin (lhlo.2): emberpeak wild — shell→core, BOSS_HP=10
//   - iron-sentinel (lhlo.5): spirit wild — armor→naked, BOSS_HP=6
const LAYERED_ARCHETYPE_CARDS = [
  {
    id: 'boulderkin',
    layerIds: ['shell', 'core'] as const,
    aggregateHp: 10,
  },
  {
    id: 'iron-sentinel',
    layerIds: ['armor', 'naked'] as const,
    aggregateHp: 6,
  },
] as const;

// Per-card duel-archetype expectations. Single adaptive tag with the
// bead-specified penalty. Mirrors the COLOSSEUM_BONEREAVER_T1 / CHIMERA_T2
// shape (single adaptive entry).
//   - hollow-effigy (lhlo.4): shadow wild — penalty derived from the
//     bespoke `hollow-effigy-mirror` resolver (MAX_DPT − BASE_DPT = 2).
//     Locking penalty to the resolver constant catches drift if the
//     resolver tunes either constant.
//   - silver-chimera (lhlo.6): gilded-cage wild #2 — penalty 3
//     (locked by spec; one knob above COLOSSEUM_CHIMERA_T2's penalty:2).
//   - prism-chimera (lhlo.6): post-completion bonus wild —
//     penalty 4 (tightest duel-discipline knob in v2.0).
const DUEL_ARCHETYPE_CARDS = [
  {
    id: 'hollow-effigy',
    penalty: HOLLOW_EFFIGY_MAX_DPT - HOLLOW_EFFIGY_BASE_DPT,
  },
  { id: 'silver-chimera', penalty: 3 },
  { id: 'prism-chimera', penalty: 4 },
] as const;

// Per-card sequence-archetype expectations. The colosseum precedent
// (`COLOSSEUM_PHANTOM_VURMOX_T2` / `COLOSSEUM_TRINITY_AUROGAX_T5`) ships
// a 2-step or 3-step rotation; zone-mode sequence ports mirror that
// shape with currentIndex starting at 0. Step ids are stable lookup
// keys for the sequence resolver's per-step dispatch.
//   - knell (lhlo.4): shadow region — telegraph → slam derives
//     from the bespoke knell-drum resolver phase split.
//   - hextwins (lhlo.5): spirit region — Fire→Ice→Fire mirrors the
//     bespoke hextwins-fire-ice resolver's `combat.turnIndex % 3`.
//   - cagewright-vurmox (lhlo.6): gilded-cage region / final fight
//     — 3-step rotation captures the canonical 75/50/25 HP-threshold
//     cadence (gloom-charge → bolt-volley → sword-strike).
const SEQUENCE_ARCHETYPE_CARDS = [
  {
    id: 'knell',
    steps: ['telegraph', 'slam'] as readonly string[],
  },
  {
    id: 'hextwins',
    steps: ['fire', 'ice', 'fire'] as readonly string[],
  },
  {
    id: 'cagewright-vurmox',
    steps: ['gloom-charge', 'bolt-volley', 'sword-strike'] as readonly string[],
  },
] as const;

describe('ZONE_BOSS_SPECS — sylvani (lhlo.1) + emberpeak (lhlo.2) + maren (lhlo.3) + shadow (lhlo.4) + spirit (lhlo.5) + gilded-cage (lhlo.6)', () => {
  it.each(EYE_ARCHETYPE_CARDS)('contains entry for %s', (cardId) => {
    expect(ZONE_BOSS_SPECS).toHaveProperty(cardId);
  });

  it.each(ITEM_CHECK_CARDS.map((c) => c.id))('contains entry for %s', (cardId) => {
    expect(ZONE_BOSS_SPECS).toHaveProperty(cardId);
  });

  it.each(LAYERED_ARCHETYPE_CARDS.map((c) => c.id))('contains entry for %s', (cardId) => {
    expect(ZONE_BOSS_SPECS).toHaveProperty(cardId);
  });

  it.each(DUEL_ARCHETYPE_CARDS.map((c) => c.id))('contains entry for %s', (cardId) => {
    expect(ZONE_BOSS_SPECS).toHaveProperty(cardId);
  });

  it.each(SEQUENCE_ARCHETYPE_CARDS.map((c) => c.id))('contains entry for %s', (cardId) => {
    expect(ZONE_BOSS_SPECS).toHaveProperty(cardId);
  });

  describe.each(EYE_ARCHETYPE_CARDS)('%s', (cardId) => {
    const spec = ZONE_BOSS_SPECS[cardId];

    it('is eye archetype with guarded + cycle tags', () => {
      expect(spec.archetype).toBe('eye');
      expect(tagKinds(spec)).toEqual(['guarded', 'cycle']);
    });

    it('guarded tag uses cycle-trigger flavor', () => {
      const guarded = spec.stateTags.find((t) => t.kind === 'guarded');
      if (guarded?.kind !== 'guarded') throw new Error('expected guarded tag');
      expect(guarded.until).toBe('cycle-trigger');
    });

    it('cycle tag has threshold=2 + flip-to-exposed trigger (matches COLOSSEUM_CRAGHORN_T1)', () => {
      const cycle = spec.stateTags.find((t) => t.kind === 'cycle');
      if (cycle?.kind !== 'cycle') throw new Error('expected cycle tag');
      expect(cycle.counter).toBe(0);
      expect(cycle.threshold).toBe(2);
      expect(cycle.trigger).toBe('flip-to-exposed');
    });
  });

  // item-check ports. Single guarded tag with the bead-specified
  // item-tag string as the unblock discriminant; mirrors the
  // COLOSSEUM_CINDERWYRM_T2 shape (single guarded{item-tag-*}).
  describe.each(ITEM_CHECK_CARDS)('$id', ({ id, until }) => {
    const spec = ZONE_BOSS_SPECS[id];

    it('is item-check archetype with a single guarded tag', () => {
      expect(spec.archetype).toBe('item-check');
      expect(tagKinds(spec)).toEqual(['guarded']);
    });

    it(`guarded tag's until names the item-tag (${until})`, () => {
      const guarded = spec.stateTags.find((t) => t.kind === 'guarded');
      if (guarded?.kind !== 'guarded') throw new Error('expected guarded tag');
      expect(guarded.until).toBe(until);
    });
  });

  // layered ports. Two-layer Shell→Core mirrors COLOSSEUM_BOULDERKIN_T1;
  // layer HP sums to the zone aggregate (BOSS_HP). Layer ids are stable
  // lookup keys for the layered resolver's damage routing.
  describe.each(LAYERED_ARCHETYPE_CARDS)('$id', ({ id, layerIds, aggregateHp }) => {
    const spec = ZONE_BOSS_SPECS[id];

    it('is layered archetype with a single layered tag', () => {
      expect(spec.archetype).toBe('layered');
      expect(tagKinds(spec)).toEqual(['layered']);
    });

    it('layer ids match the bead-specified order (outer→inner)', () => {
      const layered = spec.stateTags.find((t) => t.kind === 'layered');
      if (layered?.kind !== 'layered') throw new Error('expected layered tag');
      expect(layered.layers.map((l) => l.id)).toEqual(layerIds);
    });

    it('layer hp sums to the zone aggregate (BOSS_HP)', () => {
      const layered = spec.stateTags.find((t) => t.kind === 'layered');
      if (layered?.kind !== 'layered') throw new Error('expected layered tag');
      const sum = layered.layers.reduce((acc, l) => acc + l.hp, 0);
      expect(sum).toBe(aggregateHp);
    });

    it('every layer ships hp===hpMax + defeated:false (full-shape entry)', () => {
      const layered = spec.stateTags.find((t) => t.kind === 'layered');
      if (layered?.kind !== 'layered') throw new Error('expected layered tag');
      for (const layer of layered.layers) {
        expect(layer.hp, `${layer.id}.hp`).toBe(layer.hpMax);
        expect(layer.defeated, `${layer.id}.defeated`).toBe(false);
      }
    });
  });

  // duel ports. Single adaptive tag with the bead-specified penalty
  // knob. lhlo.4's hollow-effigy locks penalty to the bespoke resolver
  // constant (MAX_DPT − BASE_DPT) so a resolver tuning surfaces here
  // as a failed test, not as silent metadata drift. lhlo.6's silver-
  // chimera + prism-chimera use literal penalties locked by spec.
  describe.each(DUEL_ARCHETYPE_CARDS)('$id', ({ id, penalty }) => {
    const spec = ZONE_BOSS_SPECS[id];

    it('is duel archetype with a single adaptive tag', () => {
      expect(spec.archetype).toBe('duel');
      expect(tagKinds(spec)).toEqual(['adaptive']);
    });

    it(`adaptive tag carries penalty=${penalty}`, () => {
      const adaptive = spec.stateTags.find((t) => t.kind === 'adaptive');
      if (adaptive?.kind !== 'adaptive') throw new Error('expected adaptive tag');
      expect(adaptive.penalty).toBe(penalty);
    });
  });

  // sequence ports. Single sequence tag with the bead-specified step
  // list and currentIndex:0 initial pointer (mirror of
  // COLOSSEUM_PHANTOM_VURMOX_T2 / COLOSSEUM_TRINITY_AUROGAX_T5). lhlo.4's
  // knell and lhlo.5's hextwins step ids derive from their
  // bespoke resolvers' phase splits; lhlo.6's cagewright-vurmox step
  // ids are locked by spec.
  describe.each(SEQUENCE_ARCHETYPE_CARDS)('$id', ({ id, steps }) => {
    const spec = ZONE_BOSS_SPECS[id];

    it('is sequence archetype with a single sequence tag', () => {
      expect(spec.archetype).toBe('sequence');
      expect(tagKinds(spec)).toEqual(['sequence']);
    });

    it('sequence steps match the bead-specified rotation', () => {
      const sequence = spec.stateTags.find((t) => t.kind === 'sequence');
      if (sequence?.kind !== 'sequence') throw new Error('expected sequence tag');
      expect(sequence.steps).toEqual(steps);
    });

    it('currentIndex starts at 0', () => {
      const sequence = spec.stateTags.find((t) => t.kind === 'sequence');
      if (sequence?.kind !== 'sequence') throw new Error('expected sequence tag');
      expect(sequence.currentIndex).toBe(0);
    });
  });

  // Forward-compat invariants. Type-system already forces archetype +
  // stateTags presence (Required<{...}>), so a .toBeDefined() loop
  // would be vacuous. These assertions catch authoring errors that
  // compile cleanly: empty stateTags arrays, malformed cycle counters,
  // archetype values outside the canonical six.
  it('every entry carries a non-empty stateTags array (no compile-clean empties)', () => {
    for (const [cardId, spec] of Object.entries(ZONE_BOSS_SPECS)) {
      expect(spec.stateTags.length, `${cardId} stateTags`).toBeGreaterThan(0);
    }
  });

  it('every cycle tag has counter:0 + threshold>=1 + non-empty trigger', () => {
    for (const [cardId, spec] of Object.entries(ZONE_BOSS_SPECS)) {
      for (const tag of spec.stateTags) {
        if (tag.kind !== 'cycle') continue;
        expect(tag.counter, `${cardId} cycle.counter`).toBe(0);
        expect(tag.threshold, `${cardId} cycle.threshold`).toBeGreaterThanOrEqual(1);
        expect(tag.trigger.length, `${cardId} cycle.trigger`).toBeGreaterThan(0);
      }
    }
  });

  it('every archetype is one of the canonical six', () => {
    for (const [, spec] of Object.entries(ZONE_BOSS_SPECS)) {
      expect(CANONICAL_ARCHETYPES).toContain(spec.archetype);
    }
  });
});
