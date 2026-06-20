/**
 * Omen keyword contract (lhlo.29, keyword-glossary §DICE/OMEN).
 *
 * Covers the three things the bare `RollDieEffect` type cannot express:
 *   1. bounded-variance invariant — every Omen card is range-grouped and
 *      has no dead roll; ungrouped six-way tables are rejected;
 *   2. cosmetic-only flavor tag — the `omen` flavor never changes the
 *      resolved outcome;
 *   3. relic-only ±1 soft-control — no card carries a roll-adjust; the
 *      relic modifier clamps to the d6 range.
 */

import { describe, it, expect } from 'vitest';
import { KID_CARDS, TEST_ROLL_DIE_SAMPLE_CARD } from '../data/cards';
import type { Card } from '../types/card';
import type { DieFace, OmenFlavor, RollDieEffect } from '../types/effectSpec';
import {
  OMEN_FACES,
  OMEN_RANGES,
  applyOmenSoftControl,
  assertOmenBoundedVariance,
  isOmenRangeGrouped,
  omenFlavorOf,
  resolveOmenFace,
  type OmenSoftControl,
} from './omen';

function allRollDieCards(): readonly Card[] {
  const inPool = KID_CARDS.filter((c) => c.effects.kind === 'roll-die');
  return [...inPool, TEST_ROLL_DIE_SAMPLE_CARD];
}

/** A range-grouped Omen used as a positive fixture. */
const GROUPED: RollDieEffect = {
  kind: 'roll-die',
  outcomes: {
    1: { kind: 'gain', green: 1 },
    2: { kind: 'gain', green: 1 },
    3: { kind: 'draw', amount: 1 },
    4: { kind: 'draw', amount: 1 },
    5: { kind: 'gain', red: 2 },
    6: { kind: 'gain', red: 2 },
  },
};

describe('Omen bounded-variance invariant', () => {
  it('every authored roll-die (Omen) card is range-grouped with no dead roll', () => {
    const cards = allRollDieCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.effects.kind).toBe('roll-die');
      // Throws (failing the test, naming the card) if the card is an
      // ill-formed Omen.
      assertOmenBoundedVariance(card.effects as RollDieEffect, card.id);
    }
  });

  it('accepts a range-grouped table', () => {
    expect(isOmenRangeGrouped(GROUPED)).toBe(true);
    expect(() => assertOmenBoundedVariance(GROUPED, 'grouped')).not.toThrow();
  });

  it('rejects an ungrouped six-way table', () => {
    const sixWay: RollDieEffect = {
      kind: 'roll-die',
      outcomes: {
        1: { kind: 'gain', green: 1 },
        2: { kind: 'gain', green: 2 },
        3: { kind: 'gain', red: 1 },
        4: { kind: 'gain', red: 2 },
        5: { kind: 'draw', amount: 1 },
        6: { kind: 'gain', keys: 1 },
      },
    };
    expect(isOmenRangeGrouped(sixWay)).toBe(false);
    expect(() => assertOmenBoundedVariance(sixWay, 'six-way')).toThrow(/ungrouped/);
  });

  it('rejects a dead roll (empty outcome) via an as-any breach', () => {
    const dead = {
      kind: 'roll-die',
      outcomes: {
        1: {},
        2: {},
        3: { kind: 'gain', green: 1 },
        4: { kind: 'gain', green: 1 },
        5: { kind: 'gain', red: 1 },
        6: { kind: 'gain', red: 1 },
      },
    } as unknown as RollDieEffect;
    expect(() => assertOmenBoundedVariance(dead, 'dead')).toThrow(/dead roll/);
  });

  it('forest-sage is a range-grouped Omen', () => {
    const sage = KID_CARDS.find((c) => c.id === 'forest-sage');
    expect(sage).toBeDefined();
    expect(sage?.effects.kind).toBe('roll-die');
    expect(isOmenRangeGrouped(sage?.effects as RollDieEffect)).toBe(true);
  });
});

describe('Omen flavor tag is cosmetic-only', () => {
  it('changing the flavor tag never changes the resolved outcome', () => {
    const flavors: readonly OmenFlavor[] = ['song', 'ancient', 'shadow', 'none'];
    for (const face of OMEN_FACES) {
      const resolved = flavors.map((omen) => resolveOmenFace({ ...GROUPED, omen }, face));
      // All flavors resolve face → identical outcome object.
      for (const r of resolved) {
        expect(r).toEqual(GROUPED.outcomes[face]);
      }
    }
  });

  it('omenFlavorOf defaults absent tag to "none"', () => {
    expect(omenFlavorOf(GROUPED)).toBe('none');
    expect(omenFlavorOf({ ...GROUPED, omen: 'shadow' })).toBe('shadow');
  });

  it('forest-sage carries the cosmetic "song" tag', () => {
    const sage = KID_CARDS.find((c) => c.id === 'forest-sage');
    expect(omenFlavorOf(sage?.effects as RollDieEffect)).toBe('song');
  });
});

describe('Omen ±1 soft-control is relic-only', () => {
  it('no production card declares a roll-adjust field', () => {
    for (const card of KID_CARDS) {
      if (card.effects.kind !== 'roll-die') continue;
      const effect = card.effects as unknown as Record<string, unknown>;
      // The type has no adjust field; this guards against an `as any`
      // breach that would print a card-side ±1 modifier.
      expect(effect.adjust).toBeUndefined();
      expect(effect.softControl).toBeUndefined();
    }
  });

  it('the soft-control modifier is sourced from a relic', () => {
    const mod: OmenSoftControl = { source: 'relic', adjust: 1 };
    expect(mod.source).toBe('relic');
  });

  it('clamps adjusted face to the d6 range [1,6]', () => {
    const plus: OmenSoftControl = { source: 'relic', adjust: 1 };
    const minus: OmenSoftControl = { source: 'relic', adjust: -1 };
    const noop: OmenSoftControl = { source: 'relic', adjust: 0 };
    expect(applyOmenSoftControl(3, plus)).toBe(4);
    expect(applyOmenSoftControl(3, minus)).toBe(2);
    expect(applyOmenSoftControl(3, noop)).toBe(3);
    // Clamp at the rails — a 6 cannot climb to 7, a 1 cannot drop to 0.
    expect(applyOmenSoftControl(6, plus)).toBe(6);
    expect(applyOmenSoftControl(1, minus)).toBe(1);
  });
});

describe('OMEN_RANGES shape', () => {
  it('covers all six faces exactly once in low→high order', () => {
    const flat = OMEN_RANGES.flat();
    expect(flat).toEqual([1, 2, 3, 4, 5, 6] as DieFace[]);
  });
});
