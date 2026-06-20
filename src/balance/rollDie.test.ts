/**
 * Balance-layer sanity checks for `roll-die` EffectSpec outcomes
 * (REQ-13 Phase 2a + REQ-10 / gm0.7).
 *
 * The fail-forward-floor invariant ("every face 1..6 has a non-zero
 * effect") is enforced primarily by the type — `RollDieEffect.outcomes`
 * is a total `Readonly<Record<DieFace, RollDieOutcomeEffect>>`, so a
 * partial map or an empty `{}` face fails tsc. These runtime assertions
 * are a belt-and-suspenders floor: they ensure every authored roll-die
 * card in the codebase has face outcomes whose `kind` is present and
 * whose numeric magnitudes (when the kind carries them) are strictly
 * positive.
 *
 * Scope: every card whose `effects.kind === 'roll-die'`, including the
 * test-only anchor card. New cards that declare `roll-die` effects are
 * covered automatically — no per-card list to keep in sync.
 */

import { describe, it, expect } from 'vitest';
import { KID_CARDS, TEST_ROLL_DIE_SAMPLE_CARD } from '../data/cards';
import type { Card } from '../types/card';
import type { DieFace, RollDieEffect, RollDieOutcomeEffect } from '../types/effectSpec';

const ALL_FACES: readonly DieFace[] = [1, 2, 3, 4, 5, 6] as const;

/**
 * All cards in the codebase that declare a `roll-die` effect. KID_CARDS
 * is the authoritative runtime pool; the test-only anchor is appended
 * explicitly so it is covered even though it is deliberately excluded
 * from the runtime pool.
 */
function allRollDieCards(): readonly Card[] {
  const rollDieInPool = KID_CARDS.filter((c) => c.effects.kind === 'roll-die');
  return [...rollDieInPool, TEST_ROLL_DIE_SAMPLE_CARD];
}

/**
 * Return true iff `effect`'s numeric payload fields are all > 0. The
 * fields checked are the union of numeric fields across every
 * EffectSpec member: `green`, `red`, `keys`, `amount`, `hearts`. A
 * payload with no numeric fields (the handful of kinds that carry none)
 * returns true by default — presence of `kind` alone is enough.
 */
function hasPositiveMagnitude(effect: RollDieOutcomeEffect): boolean {
  const numericFields: readonly string[] = ['green', 'red', 'keys', 'amount', 'hearts'];
  const record = effect as unknown as Record<string, unknown>;
  let sawNumeric = false;
  for (const field of numericFields) {
    const value = record[field];
    if (typeof value === 'number') {
      sawNumeric = true;
      if (value <= 0) return false;
    }
  }
  return sawNumeric || typeof record.kind === 'string';
}

describe("EffectSpec 'roll-die' outcome floor (REQ-10 fail-forward)", () => {
  it('every authored roll-die card has all six faces present', () => {
    const rollDieCards = allRollDieCards();
    expect(rollDieCards.length).toBeGreaterThan(0);

    for (const card of rollDieCards) {
      expect(card.effects.kind).toBe('roll-die');
      const rollDie = card.effects as RollDieEffect;
      for (const face of ALL_FACES) {
        expect(rollDie.outcomes[face]).toBeDefined();
        expect(rollDie.outcomes[face].kind).toBeDefined();
      }
    }
  });

  it('no outcome row equals {} (rules out the type-breach case)', () => {
    for (const card of allRollDieCards()) {
      if (card.effects.kind !== 'roll-die') continue;
      for (const face of ALL_FACES) {
        const outcome = card.effects.outcomes[face];
        // Structural check — a valid outcome has at least a `kind` key.
        // The type already forbids `{}`, but we belt-and-suspender here
        // because an author could route around the type with `as any`.
        expect(Object.keys(outcome).length).toBeGreaterThan(0);
        expect(typeof (outcome as unknown as { kind?: unknown }).kind).toBe('string');
      }
    }
  });

  it('every rolled-effect has a strictly positive magnitude on its declared numeric fields', () => {
    for (const card of allRollDieCards()) {
      if (card.effects.kind !== 'roll-die') continue;
      for (const face of ALL_FACES) {
        const outcome = card.effects.outcomes[face];
        expect(hasPositiveMagnitude(outcome)).toBe(true);
      }
    }
  });
});
